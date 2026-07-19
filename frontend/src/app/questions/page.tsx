"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Question = {
  id: number;
  type: "behavioral" | "technical";
  text: string;
};

export default function QuestionsPage() {
  const [questions, setQuestions] = useState<Question[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/questions`);
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        setQuestions(await res.json());
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    })();
  }, []);

  const behavioral = questions?.filter((q) => q.type === "behavioral") ?? [];
  const technical = questions?.filter((q) => q.type === "technical") ?? [];

  return (
    <div className="flex flex-1 flex-col items-center gap-10 bg-zinc-50 px-6 py-16 dark:bg-black">
      <h1 className="text-3xl font-semibold text-black dark:text-zinc-50">
        Pick a question
      </h1>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {!questions && !error && (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">Loading questions…</p>
      )}

      {questions && (
        <div className="flex w-full max-w-2xl flex-col gap-10">
          <QuestionGroup title="Behavioral" questions={behavioral} />
          <QuestionGroup title="Technical" questions={technical} />
        </div>
      )}
    </div>
  );
}

function QuestionGroup({ title, questions }: { title: string; questions: Question[] }) {
  return (
    <section>
      <h2 className="mb-3 text-lg font-medium text-black dark:text-zinc-50">{title}</h2>
      <ul className="flex flex-col gap-2">
        {questions.map((q) => (
          <li key={q.id}>
            <Link
              href={`/practice/${q.id}`}
              className="block rounded-lg border border-zinc-200 px-4 py-3 text-sm text-black transition hover:border-zinc-400 dark:border-zinc-800 dark:text-zinc-50 dark:hover:border-zinc-600"
            >
              {q.text}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
