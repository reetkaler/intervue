"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Editor, { loader } from "@monaco-editor/react";
import * as monaco from "monaco-editor";
import { supabase } from "@/lib/supabase";
import { apiFetch } from "@/lib/api";

// Use the bundled npm package instead of fetching Monaco's AMD loader from a
// CDN — keeps this page's global loader state consistent with the
// /interview sub-page (which combines Monaco with MediaPipe and needs this
// to avoid an AMD `define()` collision), so client-side navigation between
// the two never leaves stale loader state behind.
loader.config({ monaco });

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

type SubmissionResult = {
  all_passed: boolean;
  test_results: TestCaseResult[];
};

export default function CodingProblemPage() {
  const params = useParams<{ problemId: string }>();
  const problemId = Number(params.problemId);

  const [problem, setProblem] = useState<CodingProblem | null>(null);
  const [code, setCode] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<SubmissionResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        await supabase.auth.signInAnonymously();
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
      }
    })();
  }, [problemId]);

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    setResult(null);
    try {
      const submission = await apiFetch(`/api/coding-problems/${problemId}/submit`, {
        method: "POST",
        body: JSON.stringify({ code }),
      });
      setResult(submission);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  if (error && !problem) {
    return (
      <div className="flex flex-1 items-center justify-center bg-zinc-50 px-6 dark:bg-black">
        <p className="text-sm text-red-600">{error}</p>
      </div>
    );
  }

  if (!problem) {
    return (
      <div className="flex flex-1 items-center justify-center bg-zinc-50 px-6 dark:bg-black">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">Loading…</p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-6 bg-zinc-50 px-6 py-12 dark:bg-black">
      <div className="mx-auto w-full max-w-3xl">
        <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">
          {problem.title}
        </h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          {problem.description}
        </p>

        <div className="mt-6 overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800">
          <Editor
            height="320px"
            defaultLanguage="python"
            value={code}
            onChange={(value) => setCode(value ?? "")}
            theme="vs-dark"
            options={{ minimap: { enabled: false }, fontSize: 14 }}
          />
        </div>

        <div className="mt-4 flex gap-3">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="rounded-full bg-black px-6 py-3 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
          >
            {submitting ? "Running…" : "Submit"}
          </button>
          <Link
            href={`/coding/${problemId}/interview`}
            className="rounded-full border border-black px-6 py-3 text-sm font-medium text-black transition hover:bg-zinc-100 dark:border-white dark:text-white dark:hover:bg-zinc-900"
          >
            Record yourself solving this
          </Link>
        </div>

        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

        {result && (
          <div className="mt-6 space-y-3">
            <h2 className="text-lg font-medium text-black dark:text-zinc-50">
              {result.all_passed
                ? `All ${result.test_results.length} test cases passed ✅`
                : `${result.test_results.filter((t) => t.passed).length}/${result.test_results.length} test cases passed`}
            </h2>
            {result.test_results.map((t, i) => (
              <div
                key={i}
                className="rounded-lg border border-zinc-200 p-3 text-sm dark:border-zinc-800"
              >
                <p className="font-mono text-black dark:text-zinc-50">
                  {t.passed ? "✅" : "❌"} {t.call}
                </p>
                <p className="mt-1 text-zinc-600 dark:text-zinc-400">{t.status}</p>
                {!t.passed && (t.stdout || t.stderr) && (
                  <pre className="mt-2 overflow-x-auto rounded bg-zinc-100 p-2 text-xs text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
                    {t.stderr || t.stdout}
                  </pre>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
