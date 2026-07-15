"use client";

import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-lg rounded-2xl border bg-card/90 p-8 text-center shadow-xl backdrop-blur sm:p-12">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
          <AlertTriangle className="h-6 w-6" />
        </div>
        <p className="mt-6 text-xs font-bold uppercase tracking-[0.2em] text-destructive">Something went wrong</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">The workspace hit an unexpected issue</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Your data is safe. Try this screen again, or return in a moment.
        </p>
        <Button onClick={reset} className="mt-6">
          <RotateCcw className="h-4 w-4" />
          Try again
        </Button>
      </div>
    </main>
  );
}
