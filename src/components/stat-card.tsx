import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";

const tones = {
  primary: "bg-primary/10 text-primary ring-primary/10",
  info: "bg-info/10 text-info ring-info/10",
  success: "bg-success/10 text-success ring-success/10",
  warning: "bg-warning/10 text-warning ring-warning/10",
  neutral: "bg-muted text-muted-foreground ring-border/60",
  violet: "bg-violet-500/10 text-violet-600 ring-violet-500/10 dark:text-violet-400",
} as const;

export function StatCard({
  label,
  value,
  icon: Icon,
  detail,
  tone = "primary",
  compact = false,
}: {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  detail?: string;
  tone?: keyof typeof tones;
  compact?: boolean;
}) {
  return (
    <Card className="group overflow-hidden transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/20 hover:shadow-lg hover:shadow-slate-950/[0.04]">
      <CardContent className={cn("relative", compact ? "p-4" : "p-5")}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.13em] text-muted-foreground">{label}</p>
            <p className={cn("mt-2 font-semibold tabular-nums tracking-[-0.035em]", compact ? "text-2xl" : "text-3xl")}>
              {value}
            </p>
            {detail && <p className="mt-1 truncate text-xs text-muted-foreground">{detail}</p>}
          </div>
          {Icon && (
            <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1 transition-transform duration-200 group-hover:scale-105", tones[tone])}>
              <Icon className="h-[18px] w-[18px]" />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
