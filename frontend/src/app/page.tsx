import Link from "next/link";
import {
  MessageSquare,
  Video,
  Sparkles,
  FileText,
  AudioLines,
  Eye,
  Code2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

const steps = [
  {
    icon: MessageSquare,
    title: "Pick a question",
    description: "Behavioral, technical, or a live coding problem.",
  },
  {
    icon: Video,
    title: "Record on camera",
    description: "Answer out loud, just like the real thing.",
  },
  {
    icon: Sparkles,
    title: "Get feedback",
    description: "See exactly what to improve before your next interview.",
  },
];

const features = [
  {
    icon: FileText,
    title: "Content",
    description: "Scored against the question for structure and substance.",
  },
  {
    icon: AudioLines,
    title: "Delivery",
    description: "Words per minute and filler word count, from your transcript.",
  },
  {
    icon: Eye,
    title: "Body language",
    description: "Eye contact, expression, and gestures via on-device tracking.",
  },
  {
    icon: Code2,
    title: "Coding",
    description: "Solve real problems and narrate your approach out loud.",
  },
];

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <section className="relative overflow-hidden px-6 pt-20 pb-16 sm:pt-28">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_50%_0%,rgba(55,50,47,0.08),transparent_60%)]" />
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

        <div className="relative mx-auto mt-20 max-w-md pt-3">
          <div
            className="absolute inset-x-6 top-0 h-full rounded-xl border border-border bg-card/50"
            style={{ transform: "rotate(-4deg)" }}
          />
          <div
            className="absolute inset-x-3 top-0 h-full rounded-xl border border-border bg-card/70"
            style={{ transform: "rotate(-2deg)" }}
          />
          <Card className="relative gap-4 py-5 shadow-lg">
            <div className="flex items-center justify-between px-6">
              <span className="text-sm font-medium text-muted-foreground">
                Your feedback
              </span>
              <Badge variant="success">Score 8/10</Badge>
            </div>
            <div className="flex flex-col gap-4 px-6">
              <div>
                <p className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  Body language
                </p>
                <div className="flex flex-col gap-3">
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-foreground">Eye contact</span>
                      <span className="text-muted-foreground">82%</span>
                    </div>
                    <Progress value={82} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-foreground">Positive expression</span>
                      <span className="text-muted-foreground">76%</span>
                    </div>
                    <Progress value={76} />
                  </div>
                </div>
              </div>
              <div>
                <p className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  Delivery
                </p>
                <div className="flex flex-col gap-3">
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
              </div>
            </div>
          </Card>
        </div>
      </section>

      <section className="border-t border-border px-6 py-20">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-center font-serif text-3xl text-foreground">
            How it works
          </h2>
          <div className="mt-12 grid gap-10 sm:grid-cols-3">
            {steps.map((step, i) => (
              <div key={step.title} className="flex flex-col items-center gap-3 text-center">
                <div className="flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <step.icon className="size-5" />
                </div>
                <div className="text-xs font-medium text-muted-foreground">
                  Step {i + 1}
                </div>
                <h3 className="font-medium text-foreground">{step.title}</h3>
                <p className="max-w-[220px] text-sm text-muted-foreground">
                  {step.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-border bg-secondary/50 px-6 py-20">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-center font-serif text-3xl text-foreground">
            What you get feedback on
          </h2>
          <div className="mt-12 grid gap-5 sm:grid-cols-2">
            {features.map((f) => (
              <Card key={f.title} className="gap-2 p-6">
                <f.icon className="size-5 text-primary" />
                <h3 className="font-medium text-foreground">{f.title}</h3>
                <p className="text-sm text-muted-foreground">{f.description}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
