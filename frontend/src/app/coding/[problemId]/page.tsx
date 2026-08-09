"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Editor, { loader } from "@monaco-editor/react";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { apiFetch } from "@/lib/api";
import { CaptchaChallenge } from "@/components/CaptchaChallenge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

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
  const [needsCaptcha, setNeedsCaptcha] = useState(false);
  const [monacoReady, setMonacoReady] = useState(false);

  async function handleCaptchaVerified(token: string) {
    const { error: signInError } = await supabase.auth.signInAnonymously({
      options: { captchaToken: token },
    });
    if (signInError) {
      setError(signInError.message);
      return;
    }
    setNeedsCaptcha(false);
  }

  useEffect(() => {
    // Dynamically import monaco-editor's npm package (instead of a static
    // top-level import) so it's never evaluated during server-side
    // rendering, where it crashes on `window is not defined`. Configuring
    // the bundled package (instead of letting @monaco-editor/react fetch
    // its AMD loader from a CDN) keeps this page's loader state consistent
    // with the /interview sub-page, which combines Monaco with MediaPipe
    // and needs this to avoid an AMD `define()` collision.
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
        setNeedsCaptcha(true);
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

  if (needsCaptcha) {
    return <CaptchaChallenge onVerified={handleCaptchaVerified} />;
  }

  if (error && !problem) {
    return (
      <div className="flex flex-1 items-center justify-center px-6">
        <p className="text-sm text-destructive">{error}</p>
      </div>
    );
  }

  if (!problem || !monacoReady) {
    return (
      <div className="flex flex-1 items-center justify-center px-6">
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading…
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-6 px-6 py-12">
      <div className="mx-auto w-full max-w-3xl">
        <h1 className="font-serif text-3xl text-foreground">{problem.title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{problem.description}</p>

        <div className="mt-6 overflow-hidden rounded-xl border border-border">
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
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Running…" : "Submit"}
          </Button>
          <Button asChild variant="outline">
            <Link href={`/coding/${problemId}/interview`}>Record yourself solving this</Link>
          </Button>
        </div>

        {error && <p className="mt-4 text-sm text-destructive">{error}</p>}

        {result && (
          <div className="mt-6 flex flex-col gap-3">
            <h2 className="text-lg font-medium text-foreground">
              {result.all_passed
                ? `All ${result.test_results.length} test cases passed`
                : `${result.test_results.filter((t) => t.passed).length}/${result.test_results.length} test cases passed`}
            </h2>
            {result.test_results.map((t, i) => (
              <Card key={i} className="gap-1 py-3 shadow-none">
                <div className="flex items-center gap-2 px-4 font-mono text-sm text-foreground">
                  {t.passed ? (
                    <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
                  ) : (
                    <XCircle className="size-4 shrink-0 text-destructive" />
                  )}
                  {t.call}
                </div>
                <div className="px-4">
                  <p className="text-sm text-muted-foreground">{t.status}</p>
                  {!t.passed && (t.stdout || t.stderr) && (
                    <pre className="mt-2 overflow-x-auto rounded-md bg-muted p-2 text-xs text-muted-foreground">
                      {t.stderr || t.stdout}
                    </pre>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
