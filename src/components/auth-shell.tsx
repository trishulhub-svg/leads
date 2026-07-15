"use client";

import { BarChart3, Mail, ShieldCheck, Sparkles } from "lucide-react";
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
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_15%,hsl(var(--primary)/0.12),transparent_28rem),radial-gradient(circle_at_90%_90%,rgba(139,92,246,0.09),transparent_30rem)]" />
      <div className="absolute right-4 top-4 z-20 sm:right-6 sm:top-6">
        <ThemeToggle className="border bg-card/70 shadow-sm backdrop-blur" />
      </div>

      <div className="relative mx-auto grid min-h-screen max-w-7xl lg:grid-cols-[1.05fr_0.95fr]">
        <section className="hidden flex-col justify-between p-12 lg:flex xl:p-16">
          <Brand />
          <div className="max-w-xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1.5 text-xs font-semibold text-primary">
              <Sparkles className="h-3.5 w-3.5" />
              Intelligent outreach, one calm workspace
            </div>
            <h2 className="mt-7 text-balance text-5xl font-semibold leading-[1.08] tracking-[-0.045em]">
              Find the right people.
              <span className="block bg-gradient-to-r from-primary to-violet-500 bg-clip-text text-transparent">
                Start better conversations.
              </span>
            </h2>
            <p className="mt-6 max-w-lg text-base leading-7 text-muted-foreground">
              Discover local businesses, orchestrate reliable email campaigns, and move every meaningful reply through one focused pipeline.
            </p>
            <div className="mt-9 grid grid-cols-2 gap-3">
              <Feature icon={BarChart3} title="Clear performance" description="Know what moves the pipeline." />
              <Feature icon={ShieldCheck} title="Reliable delivery" description="Smart failover across SMTPs." />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">Private single-owner workspace · Built for focused operators</p>
        </section>

        <section className="flex min-h-screen items-center justify-center px-4 py-20 sm:px-8 lg:border-l lg:border-border/60 lg:bg-card/25">
          <div className="w-full max-w-md">
            <div className="mb-8 lg:hidden">
              <Brand />
            </div>
            <div className="rounded-2xl border bg-card/90 p-6 shadow-[0_24px_70px_rgba(15,23,42,0.10)] backdrop-blur-xl sm:p-8">
              <div className="mb-7">
                <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/10">
                  <Icon className="h-5 w-5" />
                </div>
                <h1 className="text-2xl font-semibold tracking-[-0.025em]">{title}</h1>
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
    <div className="flex items-center gap-3">
      <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-primary shadow-lg shadow-primary/20">
        <Mail className="h-5 w-5 text-white" />
        <Sparkles className="absolute -right-1 -top-1 h-3 w-3 text-indigo-300" />
      </div>
      <div>
        <p className="text-sm font-semibold leading-none tracking-tight">Trishulhub</p>
        <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Leads OS</p>
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
    <div className="rounded-xl border bg-card/60 p-4 backdrop-blur">
      <Icon className="h-4 w-4 text-primary" />
      <p className="mt-3 text-sm font-semibold">{title}</p>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
    </div>
  );
}
