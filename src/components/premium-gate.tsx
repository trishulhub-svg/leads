// src/components/premium-gate.tsx
"use client";
import { Lock, Sparkles } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { UPGRADE_WHATSAPP } from "@/lib/plan";

export function PremiumGate({
  title,
  description,
  className,
  compact = false,
}: {
  title: string;
  description: string;
  className?: string;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-dashed border-amber-500/30 bg-gradient-to-br from-amber-500/[0.07] via-card/80 to-primary/[0.04]",
        compact ? "p-4" : "p-5 sm:p-6",
        className
      )}
    >
      <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-amber-400/10 blur-3xl" />
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-700 dark:text-amber-400">
            <Sparkles className="h-5 w-5" />
            <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 text-white shadow-sm">
              <Lock className="h-3 w-3" />
            </span>
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className={cn("font-semibold tracking-tight", compact ? "text-base" : "text-lg")}>{title}</h3>
              <Badge variant="warning" className="gap-1">
                <Sparkles className="h-3 w-3" /> Premium
              </Badge>
            </div>
            <p className="mt-1 max-w-xl text-sm text-muted-foreground">{description}</p>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-stretch gap-2 sm:items-end">
          <a
            href={UPGRADE_WHATSAPP}
            target="_blank"
            rel="noreferrer"
            className={cn(buttonVariants(), "bg-amber-600 text-white shadow-amber-600/20 hover:bg-amber-600/90")}
          >
            <Lock className="h-4 w-4" />
            Upgrade to unlock
          </a>
          <a
            href={UPGRADE_WHATSAPP}
            target="_blank"
            rel="noreferrer"
            className="text-center text-xs font-medium text-primary underline-offset-2 hover:underline sm:text-right"
          >
            Contact the Trishulhub team for more →
          </a>
        </div>
      </div>
    </div>
  );
}

export function PremiumChip({ label = "Premium" }: { label?: string }) {
  return (
    <Badge variant="warning" className="gap-1">
      <Lock className="h-3 w-3" /> {label}
    </Badge>
  );
}
