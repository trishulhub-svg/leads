import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  compact = false,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  compact?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border border-dashed border-border/80 bg-muted/20 px-5 text-center",
        compact ? "py-7" : "py-14",
        className
      )}
    >
      <div className={cn("flex items-center justify-center rounded-2xl bg-card text-primary shadow-sm ring-1 ring-border/70", compact ? "h-9 w-9" : "h-12 w-12")}>
        <Icon className={compact ? "h-4 w-4" : "h-5 w-5"} />
      </div>
      <p className={cn("font-semibold tracking-tight", compact ? "mt-3 text-sm" : "mt-4")}>{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm leading-6 text-muted-foreground">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
