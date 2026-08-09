import Link from "next/link";

export function Header() {
  return (
    <header className="sticky top-0 z-10 w-full border-b border-border bg-background/90 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
        <Link href="/" className="font-serif text-2xl text-foreground">
          Intervue
        </Link>
        <nav className="flex items-center gap-6 text-sm font-medium text-foreground/80">
          <Link href="/questions" className="transition hover:text-foreground">
            Questions
          </Link>
          <Link href="/coding" className="transition hover:text-foreground">
            Coding
          </Link>
        </nav>
      </div>
    </header>
  );
}
