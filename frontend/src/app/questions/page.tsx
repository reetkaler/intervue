"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";

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
    <div className="flex flex-1 flex-col items-center gap-10 px-6 py-16">
      <h1 className="font-serif text-4xl text-foreground">Pick a question</h1>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {!questions && !error && (
        <p className="text-sm text-muted-foreground">Loading questions…</p>
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
      <h2 className="mb-3 text-lg font-medium text-foreground">{title}</h2>
      <div className="flex flex-col gap-3">
        {questions.map((q) => (
          <Link key={q.id} href={`/practice/${q.id}`}>
            <Card className="px-5 py-4 shadow-none transition hover:border-primary/40 hover:shadow-sm">
              <span className="text-sm text-foreground">{q.text}</span>
            </Card>
          </Link>
        ))}
      </div>
    </section>
  );
}
