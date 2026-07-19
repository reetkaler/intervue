"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

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
    <div className="flex flex-1 flex-col items-center gap-10 bg-zinc-50 px-6 py-16 dark:bg-black">
      <h1 className="text-3xl font-semibold text-black dark:text-zinc-50">
        Pick a coding problem
      </h1>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {!problems && !error && (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">Loading problems…</p>
      )}

      {problems && (
        <ul className="flex w-full max-w-2xl flex-col gap-2">
          {problems.map((p) => (
            <li key={p.id}>
              <Link
                href={`/coding/${p.id}`}
                className="block rounded-lg border border-zinc-200 px-4 py-3 text-sm text-black transition hover:border-zinc-400 dark:border-zinc-800 dark:text-zinc-50 dark:hover:border-zinc-600"
              >
                <span className="font-medium">{p.title}</span>
                <p className="mt-1 text-zinc-600 dark:text-zinc-400">{p.description}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
