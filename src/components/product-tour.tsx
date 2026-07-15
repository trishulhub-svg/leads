"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Clapperboard, ChevronLeft, ChevronRight, X, PlayCircle } from "lucide-react";

const STORAGE_KEY = "trishulhub-product-tour-seen-v2";

type Step = {
  image: string;
  title: string;
  body: string;
};

/** Lightweight image slideshow — no MP4 / no audio (avoids heavy load + bad voiceover). */
const STEPS: Step[] = [
  {
    image: "/tour/slides/step-01.jpg",
    title: "1. Sign in",
    body: "Open your workspace with the registered owner email and password.",
  },
  {
    image: "/tour/slides/step-02.jpg",
    title: "2. Reset password",
    body: "Forgot password only works for emails that already exist in the database. The code is sent by email — never shown on screen.",
  },
  {
    image: "/tour/slides/step-03.jpg",
    title: "3. Check your inbox",
    body: "Enter the 6-digit email code, then choose a new password.",
  },
  {
    image: "/tour/slides/step-04.jpg",
    title: "4. Email brand setup",
    body: "In Campaigns → Email templates, set brand name, sign-off, accent color, and logo. Save brand applies it everywhere.",
  },
  {
    image: "/tour/slides/step-05.jpg",
    title: "5. Edit & preview templates",
    body: "Use Visual to edit copy, then Preview to see the branded email with sample lead data.",
  },
  {
    image: "/tour/slides/step-06.jpg",
    title: "6. Import leads",
    body: "Smart importer maps messy CSV/Excel columns, de-duplicates, and shows what was added.",
  },
  {
    image: "/tour/slides/step-07.jpg",
    title: "7. CRM pipeline",
    body: "Move replies across Contacted, Discussed, and Done on the CRM board.",
  },
  {
    image: "/tour/slides/step-08.jpg",
    title: "8. Lead drawer",
    body: "Open a card to update notes, stage, priority, deal value, and follow-up date.",
  },
];

export function ProductTour({ autoOpen = true }: { autoOpen?: boolean }) {
  const [open, setOpen] = React.useState(false);
  const [index, setIndex] = React.useState(0);
  const [playing, setPlaying] = React.useState(false);

  React.useEffect(() => {
    if (!autoOpen) return;
    try {
      if (localStorage.getItem(STORAGE_KEY) === "1") return;
      const t = window.setTimeout(() => setOpen(true), 500);
      return () => window.clearTimeout(t);
    } catch {
      /* ignore */
    }
  }, [autoOpen]);

  React.useEffect(() => {
    if (!open) {
      setPlaying(false);
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close(true);
      if (e.key === "ArrowRight") next();
      if (e.key === "ArrowLeft") prev();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, index]);

  React.useEffect(() => {
    if (!open || !playing) return;
    if (index >= STEPS.length - 1) {
      setPlaying(false);
      return;
    }
    const t = window.setTimeout(() => setIndex((i) => Math.min(i + 1, STEPS.length - 1)), 4200);
    return () => window.clearTimeout(t);
  }, [open, playing, index]);

  function close(markSeen: boolean) {
    setOpen(false);
    setPlaying(false);
    if (markSeen) {
      try {
        localStorage.setItem(STORAGE_KEY, "1");
      } catch {
        /* ignore */
      }
    }
  }

  function next() {
    setIndex((i) => Math.min(i + 1, STEPS.length - 1));
  }
  function prev() {
    setIndex((i) => Math.max(i - 1, 0));
  }

  const step = STEPS[index];

  return (
    <>
      <section className="overflow-hidden rounded-2xl border border-border/70 bg-gradient-to-br from-sky-50 via-background to-teal-50/60 p-5 shadow-sm dark:from-sky-950/40 dark:via-background dark:to-teal-950/30 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0 space-y-2">
            <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-teal-700 dark:text-teal-300">
              <Clapperboard className="h-3.5 w-3.5" />
              Product tour
            </p>
            <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
              How to use Trishulhub Leads
            </h2>
            <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
              A light guided tour (screenshots + captions, no heavy video): login, reset password,
              brand, templates, lead import, and CRM. SMTP setup is skipped.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Button
              type="button"
              onClick={() => {
                setIndex(0);
                setOpen(true);
                setPlaying(true);
              }}
              className="min-w-[10.5rem]"
            >
              <PlayCircle className="h-4 w-4" />
              Start tour
            </Button>
          </div>
        </div>
      </section>

      {open ? (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/70 p-3 backdrop-blur-sm sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-label="Product tour"
          onClick={(e) => {
            if (e.target === e.currentTarget) close(true);
          }}
        >
          <div className="relative w-full max-w-4xl overflow-hidden rounded-2xl border border-white/10 bg-slate-950 shadow-2xl">
            <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-white">Trishulhub Leads · Product tour</p>
                <p className="text-xs text-slate-400">
                  Step {index + 1} of {STEPS.length}
                </p>
              </div>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="text-slate-200 hover:bg-white/10 hover:text-white"
                onClick={() => close(true)}
                aria-label="Close tour"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="bg-slate-900">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                key={step.image}
                src={step.image}
                alt={step.title}
                className="aspect-video w-full object-cover object-top"
                loading="eager"
              />
            </div>

            <div className="space-y-3 px-4 py-4">
              <div>
                <h3 className="text-base font-semibold text-white">{step.title}</h3>
                <p className="mt-1 text-sm leading-6 text-slate-300">{step.body}</p>
              </div>
              <div className="flex h-1.5 overflow-hidden rounded-full bg-white/10">
                <div
                  className="rounded-full bg-teal-400 transition-all duration-300"
                  style={{ width: `${((index + 1) / STEPS.length) * 100}%` }}
                />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={index === 0}
                    onClick={prev}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Back
                  </Button>
                  {index < STEPS.length - 1 ? (
                    <Button type="button" size="sm" onClick={next}>
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  ) : (
                    <Button type="button" size="sm" onClick={() => close(true)}>
                      Finish
                    </Button>
                  )}
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="text-slate-300 hover:bg-white/10 hover:text-white"
                  onClick={() => setPlaying((p) => !p)}
                >
                  {playing ? "Pause autoplay" : "Autoplay"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
