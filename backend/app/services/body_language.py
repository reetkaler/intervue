import math
import os
import tempfile

import cv2
import mediapipe as mp
import numpy as np
from mediapipe.tasks.python import BaseOptions, vision

from app.models.schemas import BodyLanguageStats

_ASSETS_DIR = os.path.join(os.path.dirname(__file__), "..", "assets")
_MAX_SAMPLES = 90  # ~1 frame/sec, hard ceiling so runtime stays bounded regardless of video length/metadata
_FACE_DETECTED_THRESHOLD = 0.3  # fraction of sampled frames that must have a face for face_detected=True

# "Facing the camera" = head yaw/pitch within this many degrees of straight-on,
# derived from MediaPipe's actual 3D head-pose transform (not a 2D keypoint
# proxy, which can look "centered" even during a real head turn).
_YAW_THRESHOLD_DEG = 20.0
_PITCH_THRESHOLD_DEG = 20.0

_SMILE_THRESHOLD = 0.3  # mouthSmile blendshape score above this counts as a positive expression
_GESTURE_SCALE = 1000  # scales small normalized wrist displacements into a readable 0-100 range

_face_landmarker = vision.FaceLandmarker.create_from_options(
    vision.FaceLandmarkerOptions(
        base_options=BaseOptions(model_asset_path=os.path.join(_ASSETS_DIR, "face_landmarker.task")),
        running_mode=vision.RunningMode.IMAGE,
        output_facial_transformation_matrixes=True,
        output_face_blendshapes=True,
        num_faces=1,
    )
)
_hand_landmarker = vision.HandLandmarker.create_from_options(
    vision.HandLandmarkerOptions(
        base_options=BaseOptions(model_asset_path=os.path.join(_ASSETS_DIR, "hand_landmarker.task")),
        running_mode=vision.RunningMode.IMAGE,
        num_hands=2,
    )
)


def analyze_body_language(video_bytes: bytes, filename: str) -> BodyLanguageStats:
    suffix = os.path.splitext(filename)[1] or ".mp4"
    with tempfile.NamedTemporaryFile(suffix=suffix) as tmp:
        tmp.write(video_bytes)
        tmp.flush()
        return _analyze(tmp.name)


def _analyze(video_path: str) -> BodyLanguageStats:
    cap = cv2.VideoCapture(video_path)
    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    sample_interval = max(1, round(fps))

    frames_seen = 0
    processed = 0
    frames_with_face = 0
    facing_camera_frames = 0
    smiling_frames = 0
    frames_with_hands = 0
    wrist_positions: list[tuple[float, float]] = []

    try:
        while processed < _MAX_SAMPLES:
            ok, frame = cap.read()
            if not ok:
                break
            if frames_seen % sample_interval == 0:
                processed += 1
                mp_image = _to_mp_image(frame)

                face = _detect_face(mp_image)
                if face is not None:
                    frames_with_face += 1
                    yaw_deg, pitch_deg, smiling = face
                    if abs(yaw_deg) <= _YAW_THRESHOLD_DEG and abs(pitch_deg) <= _PITCH_THRESHOLD_DEG:
                        facing_camera_frames += 1
                    if smiling:
                        smiling_frames += 1

                wrist = _detect_wrist_center(mp_image)
                if wrist is not None:
                    frames_with_hands += 1
                    wrist_positions.append(wrist)
            frames_seen += 1
    finally:
        cap.release()

    if frames_with_face == 0:
        return BodyLanguageStats(
            face_detected=False,
            eye_contact_percent=0.0,
            positive_expression_percent=0.0,
            hands_visible_percent=round(100 * frames_with_hands / processed, 1) if processed else 0.0,
            gesture_activity_score=round(min(100.0, _GESTURE_SCALE * _mean_displacement(wrist_positions)), 1),
        )

    return BodyLanguageStats(
        face_detected=(frames_with_face / processed) >= _FACE_DETECTED_THRESHOLD,
        # Denominator is total sampled frames, not just frames with a detected
        # face — looking away often makes the detector fail entirely, and
        # that should count against eye contact, not get silently excluded.
        eye_contact_percent=round(100 * facing_camera_frames / processed, 1),
        positive_expression_percent=round(100 * smiling_frames / frames_with_face, 1),
        hands_visible_percent=round(100 * frames_with_hands / processed, 1),
        gesture_activity_score=round(min(100.0, _GESTURE_SCALE * _mean_displacement(wrist_positions)), 1),
    )


def _to_mp_image(frame):
    rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    return mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)


def _detect_face(mp_image) -> tuple[float, float, bool] | None:
    result = _face_landmarker.detect(mp_image)
    if not result.facial_transformation_matrixes:
        return None
    yaw_deg, pitch_deg = _yaw_pitch_from_matrix(result.facial_transformation_matrixes[0])
    smiling = False
    if result.face_blendshapes:
        scores = {c.category_name: c.score for c in result.face_blendshapes[0]}
        smile = (scores.get("mouthSmileLeft", 0.0) + scores.get("mouthSmileRight", 0.0)) / 2
        smiling = smile > _SMILE_THRESHOLD
    return yaw_deg, pitch_deg, smiling


def _detect_wrist_center(mp_image) -> tuple[float, float] | None:
    result = _hand_landmarker.detect(mp_image)
    if not result.hand_landmarks:
        return None
    wrists = [hand[0] for hand in result.hand_landmarks]  # landmark 0 = wrist
    return (sum(w.x for w in wrists) / len(wrists), sum(w.y for w in wrists) / len(wrists))


def _yaw_pitch_from_matrix(matrix: np.ndarray) -> tuple[float, float]:
    r = matrix[:3, :3]
    pitch = math.degrees(math.atan2(r[2, 1], r[2, 2]))
    yaw = math.degrees(math.atan2(-r[2, 0], math.sqrt(r[2, 1] ** 2 + r[2, 2] ** 2)))
    return yaw, pitch


def _mean_displacement(positions: list[tuple[float, float]]) -> float:
    if len(positions) < 2:
        return 0.0
    distances = [math.dist(positions[i], positions[i + 1]) for i in range(len(positions) - 1)]
    return sum(distances) / len(distances)
