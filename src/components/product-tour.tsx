"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { PlayCircle, X, Clapperboard } from "lucide-react";

const STORAGE_KEY = "trishulhub-product-tour-seen-v1";
const VIDEO_SRC = "/tour/trishulhub-leads-walkthrough.mp4";

const CHAPTERS = [
  "Sign in",
  "Reset password",
  "Email brand setup",
  "Edit & preview templates",
  "Import leads",
  "Work replies in CRM",
];

export function ProductTour({ autoOpen = true }: { autoOpen?: boolean }) {
  const [open, setOpen] = React.useState(false);
  const videoRef = React.useRef<HTMLVideoElement>(null);

  React.useEffect(() => {
    if (!autoOpen) return;
    try {
      if (localStorage.getItem(STORAGE_KEY) === "1") return;
      const t = window.setTimeout(() => setOpen(true), 600);
      return () => window.clearTimeout(t);
    } catch {
      /* ignore */
    }
  }, [autoOpen]);

  React.useEffect(() => {
    if (!open) {
      videoRef.current?.pause();
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close(true);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  function close(markSeen: boolean) {
    setOpen(false);
    if (markSeen) {
      try {
        localStorage.setItem(STORAGE_KEY, "1");
      } catch {
        /* ignore */
      }
    }
  }

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
              Watch how to use Trishulhub Leads
            </h2>
            <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
              A ~90 second walkthrough: login, reset password, email brand, templates,
              lead import, and CRM. SMTP setup is skipped because it is already done.
            </p>
            <ul className="flex flex-wrap gap-2 pt-1">
              {CHAPTERS.map((c) => (
                <li
                  key={c}
                  className="rounded-md bg-background/80 px-2.5 py-1 text-[11px] font-medium text-foreground/80 ring-1 ring-border/60"
                >
                  {c}
                </li>
              ))}
            </ul>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Button type="button" onClick={() => setOpen(true)} className="min-w-[10.5rem]">
              <PlayCircle className="h-4 w-4" />
              Watch tour
            </Button>
          </div>
        </div>
      </section>

      {open ? (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/70 p-3 backdrop-blur-sm sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-label="Product tour video"
          onClick={(e) => {
            if (e.target === e.currentTarget) close(true);
          }}
        >
          <div className="relative w-full max-w-4xl overflow-hidden rounded-2xl border border-white/10 bg-slate-950 shadow-2xl">
            <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-white">Trishulhub Leads · Product tour</p>
                <p className="text-xs text-slate-400">Login → brand → templates → leads → CRM</p>
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
            <div className="bg-black">
              <video
                ref={videoRef}
                className="aspect-video w-full"
                src={VIDEO_SRC}
                controls
                autoPlay
                playsInline
                preload="metadata"
              >
                Your browser does not support video playback.
              </video>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
              <p className="text-xs text-slate-400">Tip: use fullscreen on the player for the clearest view.</p>
              <Button type="button" size="sm" variant="secondary" onClick={() => close(true)}>
                Done
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
