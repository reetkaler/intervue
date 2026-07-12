import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-col flex-1 items-center justify-center bg-zinc-50 dark:bg-black">
      <main className="flex flex-col items-center gap-6 px-6 text-center">
        <h1 className="text-4xl font-semibold tracking-tight text-black dark:text-zinc-50">
          Intervue
        </h1>
        <p className="max-w-md text-lg leading-8 text-zinc-600 dark:text-zinc-400">
          Practice interview responses on camera and get AI feedback on
          content, delivery, and body language.
        </p>
        <Link
          href="/practice/1"
          className="rounded-full bg-black px-6 py-3 text-sm font-medium text-white transition hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
        >
          Start Practicing
        </Link>
      </main>
    </div>
  );
}
