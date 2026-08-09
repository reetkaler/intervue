"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Editor, { loader } from "@monaco-editor/react";
import { FaceDetector, FilesetResolver } from "@mediapipe/tasks-vision";
import { Video, VideoOff, Volume2, VolumeX, Volume1, Loader2, CheckCircle2, XCircle, ArrowUpCircle } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { apiFetch } from "@/lib/api";
import { silenceMediapipeStartupLogs } from "@/lib/suppressMediapipeNoise";
import { NoiseFloorTracker, type NoiseLevel } from "@/lib/noiseFloor";
import { CaptchaChallenge } from "@/components/CaptchaChallenge";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

silenceMediapipeStartupLogs();

const MAX_DURATION_SECONDS = 360; // 6 minutes — enough to solve + narrate a problem
const DETECTION_INTERVAL_MS = 500;

type Status =
  | "loading"
  | "needs-captcha"
  | "ready"
  | "recording"
  | "processing"
  | "done"
  | "error";

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
  const [monacoReady, setMonacoReady] = useState(false);

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

  async function proceedAfterAuth() {
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
  }

  async function handleCaptchaVerified(token: string) {
    const { error: signInError } = await supabase.auth.signInAnonymously({
      options: { captchaToken: token },
    });
    if (signInError) {
      setError(signInError.message);
      setStatus("error");
      return;
    }
    await proceedAfterAuth();
  }

  useEffect(() => {
    // Dynamically import monaco-editor's npm package (instead of a static
    // top-level import) so it's never evaluated during server-side
    // rendering, where it crashes on `window is not defined`. Configuring
    // the bundled package (instead of letting @monaco-editor/react fetch
    // its AMD loader from a CDN) avoids an AMD `define()` collision with
    // MediaPipe's WASM glue code, which this page also loads.
    import("monaco-editor").then((monaco) => {
      loader.config({ monaco });
      setMonacoReady(true);
    });

    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        // Gate the actual sign-up moment behind a captcha — this only shows
        // once per browser (an existing session skips straight through).
        setStatus("needs-captcha");
        return;
      }

      await proceedAfterAuth();
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

  if (status === "needs-captcha") {
    return <CaptchaChallenge onVerified={handleCaptchaVerified} />;
  }

  if (!problem || !monacoReady) {
    return (
      <div className="flex flex-1 items-center justify-center px-6">
        {error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Loading…
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-6 px-6 py-10">
      <div className="mx-auto w-full max-w-6xl">
        <h1 className="font-serif text-3xl text-foreground">{problem.title}</h1>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">{problem.description}</p>

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[320px_1fr]">
          <div className="flex flex-col items-center gap-4">
            <video
              ref={videoRef}
              autoPlay
              muted
              className="w-full max-w-xs rounded-xl bg-foreground"
            />

            {showLiveIndicators && (
              <div className="flex flex-wrap justify-center gap-2">
                <Badge
                  variant={faceDetected === null ? "outline" : faceDetected ? "success" : "warning"}
                >
                  {faceDetected === null ? (
                    <Loader2 className="animate-spin" />
                  ) : faceDetected ? (
                    <Video />
                  ) : (
                    <VideoOff />
                  )}
                  {faceDetected === null
                    ? "Loading face detection…"
                    : faceDetected
                      ? "Face detected"
                      : "No face detected"}
                </Badge>
                <Badge
                  variant={
                    noiseLevel === null
                      ? "outline"
                      : noiseLevel === "quiet"
                        ? "success"
                        : noiseLevel === "moderate"
                          ? "warning"
                          : "destructive"
                  }
                >
                  {noiseLevel === null ? (
                    <Loader2 className="animate-spin" />
                  ) : noiseLevel === "quiet" ? (
                    <Volume2 />
                  ) : noiseLevel === "moderate" ? (
                    <Volume1 />
                  ) : (
                    <VolumeX />
                  )}
                  {noiseLevel === null
                    ? "Checking noise…"
                    : noiseLevel === "quiet"
                      ? "Quiet"
                      : noiseLevel === "moderate"
                        ? "Somewhat noisy"
                        : "Too noisy"}
                </Badge>
              </div>
            )}

            {status === "ready" && (
              <Button onClick={startRecording} size="lg">
                Start Recording
              </Button>
            )}

            {status === "recording" && (
              <div className="flex flex-col items-center gap-3">
                <p className="text-sm text-muted-foreground">{secondsLeft}s left</p>
                <Button onClick={stopRecording} size="lg" variant="destructive">
                  Stop
                </Button>
              </div>
            )}

            {status === "processing" && (
              <p className="flex items-center gap-2 text-center text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Transcribing, running your code, and scoring…
              </p>
            )}

            {status === "error" && <p className="text-center text-sm text-destructive">{error}</p>}
          </div>

          <div className="overflow-hidden rounded-xl border border-border">
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
          <div className="mx-auto mt-8 grid max-w-5xl grid-cols-1 items-start gap-4 text-left sm:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Transcript</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{result.transcript}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>
                  Test results —{" "}
                  {result.test_results.test_results.filter((t) => t.passed).length}/
                  {result.test_results.test_results.length} passed
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="flex flex-col gap-1">
                  {result.test_results.test_results.map((t, i) => (
                    <li key={i} className="flex items-center gap-2 font-mono text-sm text-muted-foreground">
                      {t.passed ? (
                        <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
                      ) : (
                        <XCircle className="size-4 shrink-0 text-destructive" />
                      )}
                      {t.call}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle>Interview Feedback</CardTitle>
                <Badge variant="success">{result.score_feedback.score}/10</Badge>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <p className="text-sm text-muted-foreground">{result.score_feedback.summary}</p>
                <div>
                  <p className="mb-1 text-sm font-medium text-foreground">Strengths</p>
                  <ul className="flex flex-col gap-1">
                    {result.score_feedback.strengths.map((s, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                        {s}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="mb-1 text-sm font-medium text-foreground">Improvements</p>
                  <ul className="flex flex-col gap-1">
                    {result.score_feedback.improvements.map((s, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                        <ArrowUpCircle className="mt-0.5 size-4 shrink-0 text-amber-600" />
                        {s}
                      </li>
                    ))}
                  </ul>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
