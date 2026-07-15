"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Clapperboard, ChevronLeft, ChevronRight, X, PlayCircle } from "lucide-react";

const STORAGE_KEY = "trishulhub-product-tour-seen-v3";

type Step = {
  image: string;
  section: string;
  title: string;
  body: string;
  tips: string[];
  dwellMs?: number;
};

/**
 * Detailed screenshot tour — lightweight JPEGs only (no MP4 / no audio).
 * Brand + template sections are expanded with field-level tips.
 */
const STEPS: Step[] = [
  {
    image: "/tour/slides/step-01.jpg",
    section: "Access",
    title: "Sign in to your workspace",
    body: "Open Trishulhub Leads with the owner email and password for this workspace.",
    tips: [
      "Use the registered owner email only — this is a single-owner app.",
      "Forgot password is available under the password field.",
    ],
  },
  {
    image: "/tour/slides/step-02.jpg",
    section: "Access",
    title: "Fill email and password",
    body: "Enter credentials, then click Sign In to open the dashboard.",
    tips: ["After login you land on the command-center dashboard."],
  },
  {
    image: "/tour/slides/step-03.jpg",
    section: "Reset password",
    title: "Request a reset code",
    body: "Forgot password only works for an email that already exists in your database.",
    tips: [
      "Unknown emails show an error and stay on this step — they never advance.",
      "The 6-digit code is emailed via your SMTP and is never shown on screen.",
    ],
    dwellMs: 5500,
  },
  {
    image: "/tour/slides/step-04.jpg",
    section: "Reset password",
    title: "Enter your registered email",
    body: "Submit the owner email so the app can send a one-time code.",
    tips: ["If SMTP is down, you’ll get a clear error instead of a fake success."],
  },
  {
    image: "/tour/slides/step-05.jpg",
    section: "Campaigns",
    title: "Open Campaigns",
    body: "Go to Campaigns to manage outreach runs and email templates.",
    tips: ["Use the Email templates tab for brand + template editing (SMTP setup is separate in Settings)."],
  },
  {
    image: "/tour/slides/step-06.jpg",
    section: "Email brand",
    title: "Switch to Email templates",
    body: "Click Email templates to open brand settings and the template library.",
    tips: [
      "Brand settings sit at the top and apply to every template.",
      "The left list is your template library; the right panel is the editor.",
    ],
    dwellMs: 5500,
  },
  {
    image: "/tour/slides/step-07.jpg",
    section: "Email brand",
    title: "Set your email brand fields",
    body: "Fill the brand bar so every outbound email looks consistent.",
    tips: [
      "Brand name — appears in the email header and {{brand_name}} merge tags.",
      "Sign-off name — used in the closing (Warm regards, …).",
      "Accent color — colors the header/CTA button (pick or type a hex).",
      "Logo — optional Upload for PNG/JPEG/WebP/GIF.",
    ],
    dwellMs: 7000,
  },
  {
    image: "/tour/slides/step-08.jpg",
    section: "Email brand",
    title: "Brand + templates together",
    body: "You can see brand settings above and templates below on the same screen.",
    tips: [
      "Change brand anytime — it updates previews across templates.",
      "Free plan keeps one editable template; Premium unlocks the full library.",
    ],
    dwellMs: 6000,
  },
  {
    image: "/tour/slides/step-09.jpg",
    section: "Email brand",
    title: "Save brand",
    body: "Click Save brand so name, sign-off, color, and logo are stored for campaigns.",
    tips: [
      "Always Save brand before relying on Preview — unsaved color/name won’t stick.",
      "Logo uploads save with the brand record.",
    ],
    dwellMs: 5500,
  },
  {
    image: "/tour/slides/step-10.jpg",
    section: "Edit templates",
    title: "Pick a template from the list",
    body: "Select Cold Intro, Follow-up, Value Offer, or Case Study — or create New template.",
    tips: [
      "Each row shows the template name and subject with merge tags.",
      "Click a row to load it into the Visual / HTML / Preview editor.",
    ],
    dwellMs: 5500,
  },
  {
    image: "/tour/slides/step-11.jpg",
    section: "Edit templates",
    title: "Visual editor — name, subject, headline",
    body: "In Visual mode, set the fields that control inbox appearance and the email header.",
    tips: [
      "Template name — internal label (not shown to prospects).",
      "Subject line — supports {{company}}, {{brand_name}}, {{first_name}}.",
      "Email headline — large title inside the email body.",
      "Preview text — inbox snippet shown before the message is opened.",
    ],
    dwellMs: 7500,
  },
  {
    image: "/tour/slides/step-12.jpg",
    section: "Edit templates",
    title: "Write the message with merge tags",
    body: "Use the Message box and click merge chips to personalize each send.",
    tips: [
      "Click {{first_name}}, {{company}}, {{brand_name}}, or {{sender_name}} to insert at the cursor.",
      "Blank lines create paragraphs; lines starting with - become bullets.",
      "Keep the tone short and specific to the niche you’re emailing.",
    ],
    dwellMs: 7500,
  },
  {
    image: "/tour/slides/step-13.jpg",
    section: "Edit templates",
    title: "Add the call-to-action button",
    body: "Scroll the Visual editor to set button text, type, and URL, then Save changes.",
    tips: [
      "Button text — e.g. Book a quick call.",
      "Button type — Landing / link, WhatsApp, or None.",
      "Button URL — landing page or WhatsApp link (disabled when type is None).",
      "Click Save changes before switching away.",
    ],
    dwellMs: 7000,
  },
  {
    image: "/tour/slides/step-14.jpg",
    section: "Preview",
    title: "Open Preview mode",
    body: "Switch to Preview to see subject + rendered HTML with sample lead data.",
    tips: [
      "Subject shows interpolated values (e.g. Acme Labs + your brand name).",
      "Badges show the active brand and CTA type (Landing / WhatsApp).",
    ],
    dwellMs: 6000,
  },
  {
    image: "/tour/slides/step-15.jpg",
    section: "Preview",
    title: "Review the branded email",
    body: "Confirm header, body, CTA color, and sign-off match your brand before sending campaigns.",
    tips: [
      "Header uses brand name + accent color.",
      "Body replaces merge tags with sample values (Aarav / Acme Labs).",
      "CTA button uses your accent color and button label.",
      "Sign-off uses the Sign-off name from brand settings.",
    ],
    dwellMs: 7500,
  },
  {
    image: "/tour/slides/step-16.jpg",
    section: "HTML (optional)",
    title: "Advanced HTML mode",
    body: "Use HTML only when you need raw markup control.",
    tips: [
      "Keep {{unsubscribe_url}} and {{brand_name}} in the HTML.",
      "Most users can stay in Visual + Preview and skip this tab.",
    ],
  },
  {
    image: "/tour/slides/step-17.jpg",
    section: "Leads",
    title: "Import leads",
    body: "Open Leads and use the smart importer for CSV, Excel, or TXT files.",
    tips: [
      "Optional default niche is applied when the file has no niche column.",
      "Columns are auto-detected even with messy headers.",
    ],
  },
  {
    image: "/tour/slides/step-18.jpg",
    section: "Leads",
    title: "Check import results",
    body: "After upload, review Added / Already leads / Dupes / Invalid counts and field mapping.",
    tips: ["Sample cleaned rows appear under the summary so you can verify mapping."],
    dwellMs: 5500,
  },
  {
    image: "/tour/slides/step-19.jpg",
    section: "CRM",
    title: "Work replies on the CRM board",
    body: "Move conversations across Contacted → Discussed → Done.",
    tips: ["Use search and filters to focus by niche or priority."],
  },
  {
    image: "/tour/slides/step-20.jpg",
    section: "CRM",
    title: "Open a lead drawer",
    body: "Click Open on a card to edit notes, stage, priority, deal value, and follow-up date.",
    tips: ["Save changes in the drawer to keep the pipeline up to date."],
    dwellMs: 5500,
  },
  {
    image: "/tour/slides/step-21.jpg",
    section: "Account",
    title: "Change password or login email",
    body: "In Settings → Account security you can update password or change the login email.",
    tips: [
      "Change login email sends a confirmation code to the new address via your SMTP.",
      "After email change you’ll sign in again with the new address.",
    ],
    dwellMs: 6000,
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
    const dwell = STEPS[index]?.dwellMs ?? 4800;
    const t = window.setTimeout(() => setIndex((i) => Math.min(i + 1, STEPS.length - 1)), dwell);
    return () => window.clearTimeout(t);
  }, [open, playing, index]);

  // Prefetch nearby slides for snappy Next
  React.useEffect(() => {
    if (!open) return;
    [index, index + 1, index + 2].forEach((i) => {
      const src = STEPS[i]?.image;
      if (!src) return;
      const img = new Image();
      img.src = src;
    });
  }, [open, index]);

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
              Detailed guided tour with extra steps for email brand setup and template edit/preview.
              Lightweight screenshots only — no heavy video.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Button
              type="button"
              onClick={() => {
                setIndex(0);
                setOpen(true);
                setPlaying(false);
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
          <div className="relative flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-slate-950 shadow-2xl">
            <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-white">Trishulhub Leads · Product tour</p>
                <p className="text-xs text-slate-400">
                  Step {index + 1} of {STEPS.length} · {step.section}
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

            <div className="min-h-0 flex-1 overflow-y-auto">
              <div className="bg-slate-900">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  key={step.image}
                  src={step.image}
                  alt={step.title}
                  className="mx-auto max-h-[48vh] w-full object-contain object-top sm:max-h-[52vh]"
                  loading="eager"
                />
              </div>

              <div className="space-y-3 px-4 py-4 sm:px-5">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-teal-300/90">
                    {step.section}
                  </p>
                  <h3 className="mt-1 text-lg font-semibold text-white">{step.title}</h3>
                  <p className="mt-1.5 text-sm leading-6 text-slate-300">{step.body}</p>
                </div>
                {step.tips.length > 0 ? (
                  <ul className="space-y-1.5 rounded-xl border border-white/10 bg-white/[0.04] p-3">
                    {step.tips.map((tip) => (
                      <li key={tip} className="flex gap-2 text-sm leading-5 text-slate-200">
                        <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-teal-400" />
                        <span>{tip}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </div>

            <div className="space-y-3 border-t border-white/10 px-4 py-3 sm:px-5">
              <div className="flex h-1.5 overflow-hidden rounded-full bg-white/10">
                <div
                  className="rounded-full bg-teal-400 transition-all duration-300"
                  style={{ width: `${((index + 1) / STEPS.length) * 100}%` }}
                />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex gap-2">
                  <Button type="button" size="sm" variant="secondary" disabled={index === 0} onClick={prev}>
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
