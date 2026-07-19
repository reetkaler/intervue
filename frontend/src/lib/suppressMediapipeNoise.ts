// MediaPipe's WASM runtime routes some of its own startup/info logging
// through console.error rather than console.log (a known quirk of the
// Emscripten-compiled module's stderr wiring) — these are never actual
// errors, just noisy one-time init messages. Filter only these specific,
// known-benign lines; everything else still logs normally.
const BENIGN_PATTERNS = [
  "TensorFlow Lite",
  "XNNPACK",
  "inference_feedback_manager",
  "Fiber init",
  "gl_context.cc",
  "landmark_projection_calculator",
];

let patched = false;

export function silenceMediapipeStartupLogs() {
  if (patched) return;
  patched = true;

  const original = console.error;
  console.error = (...args: unknown[]) => {
    const text = args.map(String).join(" ");
    if (BENIGN_PATTERNS.some((p) => text.includes(p))) return;
    original(...args);
  };
}
