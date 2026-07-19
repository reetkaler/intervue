"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Editor, { loader } from "@monaco-editor/react";
import * as monaco from "monaco-editor";
import { FaceDetector, FilesetResolver } from "@mediapipe/tasks-vision";
import { supabase } from "@/lib/supabase";
import { apiFetch } from "@/lib/api";
import { silenceMediapipeStartupLogs } from "@/lib/suppressMediapipeNoise";
import { NoiseFloorTracker, type NoiseLevel } from "@/lib/noiseFloor";

// Use Monaco's bundled npm package instead of letting @monaco-editor/react
// fetch its AMD loader script from a CDN — that loader and MediaPipe's WASM
// glue code both try to register themselves via a global `define()`, which
// collides ("Can only have one anonymous define call per script file") now
// that this page combines both, unlike the plain editor page (Monaco alone)
// or the practice page (MediaPipe alone).
loader.config({ monaco });
silenceMediapipeStartupLogs();

const MAX_DURATION_SECONDS = 360; // 6 minutes — enough to solve + narrate a problem
const DETECTION_INTERVAL_MS = 500;

type Status = "loading" | "ready" | "recording" | "processing" | "done" | "error";

type CodingProblem = {
  id: number;
  title: string;
  description: string;
  starter_code: string;
};

type TestCaseResult = {
  call: string;
  passed: boolean;
  status: string;
  stdout: string;
  stderr: string;
};

type CodingFeedbackResult = {
  transcript: string;
  test_results: { all_passed: boolean; test_results: TestCaseResult[] };
  score_feedback: {
    score: number;
    strengths: string[];
    improvements: string[];
    summary: string;
  };
};

function pickSupportedAudioMimeType(): string {
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) ?? "";
}

export default function CodingInterviewPage() {
  const params = useParams<{ problemId: string }>();
  const problemId = Number(params.problemId);

  const [status, setStatus] = useState<Status>("loading");
  const [secondsLeft, setSecondsLeft] = useState(MAX_DURATION_SECONDS);
  const [error, setError] = useState<string | null>(null);
  const [problem, setProblem] = useState<CodingProblem | null>(null);
  const [code, setCode] = useState<string>("");
  const [result, setResult] = useState<CodingFeedbackResult | null>(null);
  const [faceDetected, setFaceDetected] = useState<boolean | null>(null);
  const [noiseLevel, setNoiseLevel] = useState<NoiseLevel | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef<number>(0);
  const autoStopRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mimeTypeRef = useRef<string>("");
  const codeAtStopRef = useRef<string>("");

  const faceDetectorRef = useRef<FaceDetector | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioDataRef = useRef<Uint8Array<ArrayBuffer> | null>(null);
  const lastDetectionRef = useRef<number>(0);
  const detectionLoopRef = useRef<number | null>(null);
  const noiseFloorRef = useRef(new NoiseFloorTracker());

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

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 480 } },
          audio: true,
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }

        const audioContext = new AudioContext();
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 2048;
        audioContext.createMediaStreamSource(stream).connect(analyser);
        audioContextRef.current = audioContext;
        analyserRef.current = analyser;
        audioDataRef.current = new Uint8Array(new ArrayBuffer(analyser.fftSize));

        detectionLoopRef.current = requestAnimationFrame(runDetectionLoop);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        setStatus("error");
        return;
      }

      setStatus("ready");
    })();

    (async () => {
      try {
        const filesetResolver = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm"
        );
        faceDetectorRef.current = await FaceDetector.createFromOptions(filesetResolver, {
          baseOptions: { modelAssetPath: "/models/blaze_face_short_range.tflite" },
          runningMode: "VIDEO",
        });
      } catch {
        // Non-fatal — recording still works without the live face-detection badge.
      }
    })();

    (async () => {
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/coding-problems/${problemId}`
        );
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        const data = await res.json();
        setProblem(data);
        setCode(data.starter_code);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        setStatus("error");
      }
    })();

    return () => {
      stopLiveIndicators();
      streamRef.current?.getTracks().forEach((track) => track.stop());
      if (autoStopRef.current) clearTimeout(autoStopRef.current);
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, [problemId]);

  function runDetectionLoop(timestamp: number) {
    if (timestamp - lastDetectionRef.current >= DETECTION_INTERVAL_MS) {
      lastDetectionRef.current = timestamp;

      if (faceDetectorRef.current && videoRef.current && videoRef.current.readyState >= 2) {
        const detection = faceDetectorRef.current.detectForVideo(videoRef.current, timestamp);
        setFaceDetected(detection.detections.length > 0);
      }

      if (analyserRef.current && audioDataRef.current) {
        analyserRef.current.getByteTimeDomainData(audioDataRef.current);
        let sumSquares = 0;
        for (const sample of audioDataRef.current) {
          const normalized = (sample - 128) / 128;
          sumSquares += normalized * normalized;
        }
        const rms = Math.sqrt(sumSquares / audioDataRef.current.length);
        setNoiseLevel(noiseFloorRef.current.addSample(rms));
      }
    }
    detectionLoopRef.current = requestAnimationFrame(runDetectionLoop);
  }

  function stopLiveIndicators() {
    if (detectionLoopRef.current !== null) {
      cancelAnimationFrame(detectionLoopRef.current);
      detectionLoopRef.current = null;
    }
    audioContextRef.current?.close();
    audioContextRef.current = null;
  }

  function startRecording() {
    setError(null);
    try {
      const stream = streamRef.current;
      if (!stream) throw new Error("Camera/mic stream isn't ready yet");

      const mimeType = pickSupportedAudioMimeType();
      if (!mimeType) {
        throw new Error("No supported audio recording format found in this browser");
      }
      mimeTypeRef.current = mimeType;

      // Audio-only capture — video stays in the live preview only. Body
      // language isn't scored for coding sessions, so there's no reason to
      // record/upload video at all; this also sidesteps Whisper's 25MB
      // limit outright at this longer (6 min) duration.
      const audioOnlyStream = new MediaStream(stream.getAudioTracks());
      chunksRef.current = [];
      const recorder = new MediaRecorder(audioOnlyStream, {
        mimeType,
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
    codeAtStopRef.current = code;
    if (autoStopRef.current) clearTimeout(autoStopRef.current);
    if (tickRef.current) clearInterval(tickRef.current);
    stopLiveIndicators();
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
      const mimeType = mimeTypeRef.current || "audio/webm";
      const extension = mimeType.startsWith("audio/mp4") ? "m4a" : "webm";
      const blob = new Blob(chunksRef.current, { type: mimeType });

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("No authenticated user");

      const audioPath = `${user.id}/${Date.now()}.${extension}`;
      const { error: uploadError } = await supabase.storage
        .from("recordings")
        .upload(audioPath, blob, { contentType: mimeType });
      if (uploadError) throw uploadError;

      const codingSession = await apiFetch("/api/coding-sessions", {
        method: "POST",
        body: JSON.stringify({
          problem_id: problemId,
          audio_path: audioPath,
          duration_seconds: durationSeconds,
          code: codeAtStopRef.current,
        }),
      });

      const feedback = await apiFetch(`/api/coding-sessions/${codingSession.id}/generate`, {
        method: "POST",
      });

      setResult(feedback);
      setStatus("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStatus("error");
    }
  }

  const showLiveIndicators = status === "ready" || status === "recording";

  if (!problem) {
    return (
      <div className="flex flex-1 items-center justify-center bg-zinc-50 px-6 dark:bg-black">
        {error ? (
          <p className="text-sm text-red-600">{error}</p>
        ) : (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">Loading…</p>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-6 bg-zinc-50 px-6 py-10 dark:bg-black">
      <div className="mx-auto w-full max-w-6xl">
        <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">{problem.title}</h1>
        <p className="mt-2 max-w-3xl text-sm text-zinc-600 dark:text-zinc-400">
          {problem.description}
        </p>

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[320px_1fr]">
          <div className="flex flex-col items-center gap-4">
            <video
              ref={videoRef}
              autoPlay
              muted
              className="w-full max-w-xs rounded-lg bg-zinc-900"
            />

            {showLiveIndicators && (
              <div className="flex flex-wrap justify-center gap-2 text-xs">
                <span className="rounded-full bg-zinc-200 px-3 py-1 dark:bg-zinc-800">
                  {faceDetected === null
                    ? "⏳ Loading face detection…"
                    : faceDetected
                      ? "🟢 Face detected"
                      : "🟠 No face detected"}
                </span>
                <span className="rounded-full bg-zinc-200 px-3 py-1 dark:bg-zinc-800">
                  {noiseLevel === null
                    ? "⏳ Checking noise…"
                    : noiseLevel === "quiet"
                      ? "🟢 Quiet"
                      : noiseLevel === "moderate"
                        ? "🟡 Somewhat noisy"
                        : "🔴 Too noisy"}
                </span>
              </div>
            )}

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
                <p className="text-sm text-zinc-600 dark:text-zinc-400">{secondsLeft}s left</p>
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
              <p className="text-center text-sm text-zinc-600 dark:text-zinc-400">
                Transcribing, running your code, and scoring…
              </p>
            )}

            {status === "error" && <p className="text-center text-sm text-red-600">{error}</p>}
          </div>

          <div className="overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800">
            <Editor
              height="420px"
              defaultLanguage="python"
              value={code}
              onChange={(value) => setCode(value ?? "")}
              theme="vs-dark"
              options={{ minimap: { enabled: false }, fontSize: 14 }}
            />
          </div>
        </div>

        {status === "done" && result && (
          <div className="mx-auto mt-8 max-w-3xl space-y-4 rounded-lg border border-zinc-200 p-4 text-left dark:border-zinc-800">
            <div>
              <h2 className="font-medium text-black dark:text-zinc-50">Transcript</h2>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">{result.transcript}</p>
            </div>

            <div>
              <h2 className="font-medium text-black dark:text-zinc-50">
                Test results —{" "}
                {result.test_results.test_results.filter((t) => t.passed).length}/
                {result.test_results.test_results.length} passed
              </h2>
              <ul className="text-sm text-zinc-600 dark:text-zinc-400">
                {result.test_results.test_results.map((t, i) => (
                  <li key={i} className="font-mono">
                    {t.passed ? "✅" : "❌"} {t.call}
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h2 className="font-medium text-black dark:text-zinc-50">
                Interview Feedback — {result.score_feedback.score}/10
              </h2>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                {result.score_feedback.summary}
              </p>
              <p className="mt-2 text-sm font-medium text-black dark:text-zinc-50">Strengths</p>
              <ul className="list-disc pl-5 text-sm text-zinc-600 dark:text-zinc-400">
                {result.score_feedback.strengths.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
              <p className="mt-2 text-sm font-medium text-black dark:text-zinc-50">
                Improvements
              </p>
              <ul className="list-disc pl-5 text-sm text-zinc-600 dark:text-zinc-400">
                {result.score_feedback.improvements.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
