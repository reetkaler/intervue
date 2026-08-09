import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <section className="px-6 pt-20 pb-16 sm:pt-28">
        <div className="mx-auto flex max-w-2xl flex-col items-center gap-6 text-center">
          <h1 className="text-balance font-serif text-5xl leading-tight text-foreground sm:text-6xl">
            Practice interview questions on camera
          </h1>
          <p className="max-w-md text-lg leading-7 text-foreground/70">
            Record a real answer, then see feedback on what you said, how you
            said it, and how you looked saying it.
          </p>
          <div className="mt-2 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg">
              <Link href="/questions">Start Practicing</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/coding">Practice Coding</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="px-6 pb-24">
        <div className="mx-auto max-w-md">
          <Card className="gap-4 py-5">
            <div className="flex items-center justify-between px-6">
              <span className="text-sm font-medium text-muted-foreground">
                Your feedback
              </span>
              <Badge variant="success">Score 8/10</Badge>
            </div>
            <div className="flex flex-col gap-4 px-6">
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-foreground">Eye contact</span>
                  <span className="text-muted-foreground">82%</span>
                </div>
                <Progress value={82} />
              </div>
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-foreground">Pace</span>
                  <span className="text-muted-foreground">142 wpm</span>
                </div>
                <Progress value={70} />
              </div>
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-foreground">Filler words</span>
                  <span className="text-muted-foreground">3 total</span>
                </div>
                <Progress value={20} />
              </div>
            </div>
          </Card>
        </div>
      </section>
    </div>
  );
}
