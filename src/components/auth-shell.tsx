// src/components/auth-shell.tsx
"use client";

import { BarChart3, Mail, ShieldCheck } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";

export function AuthShell({
  title,
  description,
  icon: Icon = Mail,
  children,
  footer,
}: {
  title: string;
  description: string;
  icon?: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <main className="relative min-h-screen overflow-hidden bg-background">
      {/* Atmospheric layers — cobalt only, no purple */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_-10%,hsl(var(--primary)/0.16),transparent_42%),radial-gradient(ellipse_at_80%_100%,hsl(var(--primary)/0.06),transparent_36%),linear-gradient(180deg,hsl(var(--background))_0%,hsl(var(--muted)/0.35)_100%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.35] [background-image:linear-gradient(hsl(var(--border)/0.45)_1px,transparent_1px),linear-gradient(90deg,hsl(var(--border)/0.45)_1px,transparent_1px)] [background-size:48px_48px] [mask-image:radial-gradient(ellipse_at_center,black_20%,transparent_75%)]" />

      <div className="absolute right-4 top-4 z-20 sm:right-6 sm:top-6">
        <ThemeToggle className="border bg-card/80 shadow-sm backdrop-blur" />
      </div>

      <div className="relative mx-auto grid min-h-screen max-w-6xl lg:grid-cols-[1fr_1fr]">
        {/* Brand + story panel */}
        <section className="relative flex flex-col justify-between px-6 pb-8 pt-14 sm:px-10 lg:px-14 lg:py-16 xl:px-16">
          <div className="flex flex-1 flex-col items-center justify-center text-center">
            <Brand />

            <div className="mt-10 hidden max-w-lg lg:block">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-primary">Outreach workspace</p>
              <h2 className="mt-4 font-display text-balance text-4xl font-semibold leading-[1.1] tracking-[-0.04em] xl:text-5xl">
                Find the right people.
                <span className="mt-1 block text-primary">Start better conversations.</span>
              </h2>
              <p className="mt-5 text-base leading-7 text-muted-foreground">
                Import leads, run reliable email campaigns, and move every meaningful reply through one focused CRM pipeline.
              </p>
              <div className="mt-9 grid grid-cols-2 gap-3 text-left">
                <Feature icon={BarChart3} title="Clear performance" description="See what moves the pipeline." />
                <Feature icon={ShieldCheck} title="Reliable delivery" description="Primary + emergency SMTP failover." />
              </div>
            </div>
          </div>

          <p className="mt-8 hidden text-center text-xs text-muted-foreground lg:block">
            Private single-owner workspace · Built for focused operators
          </p>
        </section>

        {/* Form panel */}
        <section className="flex items-start justify-center px-4 pb-16 sm:px-8 lg:items-center lg:border-l lg:border-border/50 lg:bg-card/20 lg:px-12 lg:py-16">
          <div className="w-full max-w-md">
            <div className="rounded-2xl border border-border/70 bg-card/95 p-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur-xl sm:p-8">
              <div className="mb-7 text-center sm:text-left">
                <div className="mx-auto mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/15 sm:mx-0">
                  <Icon className="h-5 w-5" />
                </div>
                <h1 className="text-2xl font-semibold tracking-[-0.03em]">{title}</h1>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
              </div>
              {children}
            </div>
            {footer && <div className="mt-6 text-center">{footer}</div>}
          </div>
        </section>
      </div>
    </main>
  );
}

function Brand() {
  return (
    <div className="flex w-full flex-col items-center gap-4">
      <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-[hsl(226_72%_38%)] text-primary-foreground shadow-lg shadow-primary/25">
        <Mail className="h-7 w-7" />
      </div>
      <div className="space-y-1.5 text-center">
        <p className="font-display text-3xl font-semibold tracking-[-0.045em] sm:text-4xl">Trishulhub</p>
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground">Leads OS</p>
      </div>
    </div>
  );
}

function Feature({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-xl border border-border/70 bg-card/70 p-4 backdrop-blur">
      <Icon className="h-4 w-4 text-primary" />
      <p className="mt-3 text-sm font-semibold">{title}</p>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
    </div>
  );
}
