"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { apiFetch } from "@/lib/api";

const MAX_DURATION_SECONDS = 180;

type Status = "loading" | "ready" | "recording" | "processing" | "done" | "error";

type FeedbackResult = {
  transcript: string;
  delivery: { words_per_minute: number; filler_word_count: number };
  content: {
    score: number;
    strengths: string[];
    improvements: string[];
    summary: string;
  } | null;
  body_language: {
    face_detected: boolean;
    eye_contact_percent: number;
    positive_expression_percent: number;
    hands_visible_percent: number;
    gesture_activity_score: number;
  } | null;
};

function gestureActivityLabel(score: number): string {
  if (score < 15) return "minimal gesturing";
  if (score < 45) return "natural, moderate gesturing";
  return "very active gesturing";
}

function pickSupportedMimeType(): string {
  const candidates = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
    "video/mp4",
  ];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) ?? "";
}

export default function PracticePage() {
  const params = useParams<{ questionId: string }>();
  const questionId = Number(params.questionId);

  const [status, setStatus] = useState<Status>("loading");
  const [secondsLeft, setSecondsLeft] = useState(MAX_DURATION_SECONDS);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<FeedbackResult | null>(null);
  const [questionText, setQuestionText] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef<number>(0);
  const autoStopRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mimeTypeRef = useRef<string>("");

  useEffect(() => {
    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        const { error: signInError } = await supabase.auth.signInAnonymously();
        if (signInError) {
          setError(signInError.message);
          setStatus("error");
          return;
        }
      }
      setStatus("ready");
    })();

    (async () => {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/questions/${questionId}`);
        if (res.ok) {
          const question = await res.json();
          setQuestionText(question.text);
        }
      } catch {
        // Non-fatal — the page still works without the question text shown.
      }
    })();

    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      if (autoStopRef.current) clearTimeout(autoStopRef.current);
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, []);

  async function startRecording() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 } },
        audio: true,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      const mimeType = pickSupportedMimeType();
      if (!mimeType) {
        throw new Error("No supported video recording format found in this browser");
      }
      mimeTypeRef.current = mimeType;

      chunksRef.current = [];
      // Whisper caps uploads at 25MB; at the 180s max recording length this
      // bitrate keeps worst-case file size well under that (~11MB). Audio is
      // prioritized over video quality since transcription accuracy is the
      // core value here — video only needs to be good enough for MediaPipe's
      // landmark detection, not for human viewing.
      const recorder = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond: 350_000,
        audioBitsPerSecond: 160_000,
      });
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = handleStop;
      recorderRef.current = recorder;

      startedAtRef.current = Date.now();
      setSecondsLeft(MAX_DURATION_SECONDS);
      recorder.start();
      setStatus("recording");

      tickRef.current = setInterval(() => {
        setSecondsLeft((s) => Math.max(0, s - 1));
      }, 1000);
      autoStopRef.current = setTimeout(stopRecording, MAX_DURATION_SECONDS * 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStatus("error");
    }
  }

  function stopRecording() {
    if (autoStopRef.current) clearTimeout(autoStopRef.current);
    if (tickRef.current) clearInterval(tickRef.current);
    recorderRef.current?.stop();
    streamRef.current?.getTracks().forEach((track) => track.stop());
  }

  async function handleStop() {
    setStatus("processing");
    try {
      const durationSeconds = Math.min(
        MAX_DURATION_SECONDS,
        Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1000))
      );
      const mimeType = mimeTypeRef.current || "video/webm";
      const extension = mimeType.startsWith("video/mp4") ? "mp4" : "webm";
      const blob = new Blob(chunksRef.current, { type: mimeType });

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("No authenticated user");

      const videoPath = `${user.id}/${Date.now()}.${extension}`;
      const { error: uploadError } = await supabase.storage
        .from("recordings")
        .upload(videoPath, blob, { contentType: mimeType });
      if (uploadError) throw uploadError;

      const session = await apiFetch("/api/sessions", {
        method: "POST",
        body: JSON.stringify({
          question_id: questionId,
          video_path: videoPath,
          duration_seconds: durationSeconds,
        }),
      });

      const feedback = await apiFetch(`/api/feedback/${session.id}/generate`, {
        method: "POST",
      });

      setResult(feedback);
      setStatus("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStatus("error");
    }
  }

  return (
    <div className="flex flex-col flex-1 items-center justify-center gap-6 bg-zinc-50 px-6 py-12 dark:bg-black">
      <h1 className="max-w-md text-center text-2xl font-semibold text-black dark:text-zinc-50">
        {questionText ?? `Question ${questionId}`}
      </h1>

      <video
        ref={videoRef}
        autoPlay
        muted
        className="w-full max-w-md rounded-lg bg-zinc-900"
      />

      {status === "ready" && (
        <button
          type="button"
          onClick={startRecording}
          className="rounded-full bg-black px-6 py-3 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
        >
          Start Recording
        </button>
      )}

      {status === "recording" && (
        <div className="flex flex-col items-center gap-3">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {secondsLeft}s left
          </p>
          <button
            type="button"
            onClick={stopRecording}
            className="rounded-full bg-red-600 px-6 py-3 text-sm font-medium text-white hover:bg-red-700"
          >
            Stop
          </button>
        </div>
      )}

      {status === "processing" && (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Uploading and transcribing…
        </p>
      )}

      {status === "error" && (
        <p className="max-w-md text-center text-sm text-red-600">{error}</p>
      )}

      {status === "done" && result && (
        <div className="w-full max-w-md space-y-4 rounded-lg border border-zinc-200 p-4 text-left dark:border-zinc-800">
          <div>
            <h2 className="font-medium text-black dark:text-zinc-50">Transcript</h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">{result.transcript}</p>
          </div>
          <div>
            <h2 className="font-medium text-black dark:text-zinc-50">Delivery</h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              {result.delivery.words_per_minute} words/min ·{" "}
              {result.delivery.filler_word_count} filler words
            </p>
          </div>
          {result.content && (
            <div>
              <h2 className="font-medium text-black dark:text-zinc-50">
                Content — {result.content.score}/10
              </h2>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                {result.content.summary}
              </p>
              <p className="mt-2 text-sm font-medium text-black dark:text-zinc-50">
                Strengths
              </p>
              <ul className="list-disc pl-5 text-sm text-zinc-600 dark:text-zinc-400">
                {result.content.strengths.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
              <p className="mt-2 text-sm font-medium text-black dark:text-zinc-50">
                Improvements
              </p>
              <ul className="list-disc pl-5 text-sm text-zinc-600 dark:text-zinc-400">
                {result.content.improvements.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </div>
          )}
          {result.body_language && (
            <div>
              <h2 className="font-medium text-black dark:text-zinc-50">
                Body Language
              </h2>
              {result.body_language.face_detected ? (
                <ul className="list-disc pl-5 text-sm text-zinc-600 dark:text-zinc-400">
                  <li>Facing the camera {result.body_language.eye_contact_percent}% of the time</li>
                  <li>
                    Positive/engaged expression {result.body_language.positive_expression_percent}%
                    of the time
                  </li>
                  <li>
                    Hands visible {result.body_language.hands_visible_percent}% of the time
                    {result.body_language.hands_visible_percent > 0 &&
                      ` — ${gestureActivityLabel(result.body_language.gesture_activity_score)}`}
                  </li>
                </ul>
              ) : (
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  No face reliably detected in the recording — point the camera at
                  your face for this analysis to work.
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
