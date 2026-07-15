import * as React from "react";
import { AlertCircle, CheckCircle2, Info, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";

const styles = {
  success: {
    icon: CheckCircle2,
    className: "border-success/20 bg-success/10 text-success-foreground",
  },
  error: {
    icon: AlertCircle,
    className: "border-destructive/20 bg-destructive/10 text-destructive",
  },
  warning: {
    icon: TriangleAlert,
    className: "border-warning/20 bg-warning/10 text-warning-foreground",
  },
  info: {
    icon: Info,
    className: "border-info/20 bg-info/10 text-info-foreground",
  },
} as const;

export function Alert({
  variant = "info",
  children,
  className,
}: {
  variant?: keyof typeof styles;
  children: React.ReactNode;
  className?: string;
}) {
  const { icon: Icon, className: variantClass } = styles[variant];
  return (
    <div
      role={variant === "error" ? "alert" : "status"}
      aria-live="polite"
      className={cn("flex items-start gap-2.5 rounded-xl border px-3.5 py-3 text-sm", variantClass, className)}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="min-w-0 leading-5">{children}</div>
    </div>
  );
}
