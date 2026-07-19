"use client";

import { Turnstile } from "@marsidev/react-turnstile";

export function CaptchaChallenge({ onVerified }: { onVerified: (token: string) => void }) {
  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-50 px-6 py-12 dark:bg-black">
      <Turnstile
        siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY!}
        onSuccess={onVerified}
      />
    </div>
  );
}
