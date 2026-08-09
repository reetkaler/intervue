"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";

type CodingProblem = {
  id: number;
  title: string;
  description: string;
};

export default function CodingProblemsPage() {
  const [problems, setProblems] = useState<CodingProblem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/coding-problems`);
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        setProblems(await res.json());
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    })();
  }, []);

  return (
    <div className="flex flex-1 flex-col items-center gap-10 px-6 py-16">
      <h1 className="font-serif text-4xl text-foreground">Pick a coding problem</h1>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {!problems && !error && (
        <p className="text-sm text-muted-foreground">Loading problems…</p>
      )}

      {problems && (
        <div className="flex w-full max-w-2xl flex-col gap-3">
          {problems.map((p) => (
            <Link key={p.id} href={`/coding/${p.id}`}>
              <Card className="gap-1.5 px-5 py-4 shadow-none transition hover:border-primary/40 hover:shadow-sm">
                <span className="text-sm font-medium text-foreground">{p.title}</span>
                <p className="text-sm text-muted-foreground">{p.description}</p>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
