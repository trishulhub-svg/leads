// src/components/dashboard-shell.tsx
"use client";
import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Send,
  KanbanSquare,
  Settings as SettingsIcon,
  LogOut,
  Mail,
  Menu,
  X,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { logoutAction } from "@/server/auth-actions";
import { ThemeToggle } from "@/components/theme-toggle";

const NAV = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/leads", label: "Leads", icon: Users },
  { href: "/campaigns", label: "Campaigns", icon: Send },
  { href: "/crm", label: "CRM", icon: KanbanSquare },
  { href: "/settings", label: "Settings", icon: SettingsIcon },
];

const PAGE_META: Record<string, { label: string; context: string }> = {
  "/": { label: "Dashboard", context: "Performance overview" },
  "/leads": { label: "Leads", context: "Discover and qualify" },
  "/campaigns": { label: "Campaigns", context: "Outreach operations" },
  "/crm": { label: "CRM", context: "Reply pipeline" },
  "/settings": { label: "Settings", context: "Workspace controls" },
};

export function DashboardShell({
  user,
  children,
}: {
  user: { name: string; email: string };
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const menuButtonRef = React.useRef<HTMLButtonElement>(null);
  const drawerRef = React.useRef<HTMLElement>(null);
  const current = NAV.find((n) => (n.href === "/" ? pathname === "/" : pathname.startsWith(n.href)));
  const meta = PAGE_META[current?.href ?? "/"];

  React.useEffect(() => {
    if (!mobileOpen) return;
    const menuButton = menuButtonRef.current;
    const focusableSelector = 'button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])';
    const focusFirst = window.setTimeout(() => {
      drawerRef.current?.querySelector<HTMLElement>(focusableSelector)?.focus();
    }, 0);
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileOpen(false);
      if (event.key === "Tab" && drawerRef.current) {
        const focusable = Array.from(drawerRef.current.querySelectorAll<HTMLElement>(focusableSelector));
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", close);
    document.body.style.overflow = "hidden";
    return () => {
      window.clearTimeout(focusFirst);
      document.removeEventListener("keydown", close);
      document.body.style.overflow = "";
      menuButton?.focus();
    };
  }, [mobileOpen]);

  return (
    <div className="min-h-screen">
      <a
        href="#main-content"
        className="fixed left-3 top-3 z-[100] -translate-y-20 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground focus:translate-y-0"
      >
        Skip to content
      </a>
      {/* Sidebar — desktop */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-white/5 bg-sidebar text-sidebar-foreground lg:flex">
        <SidebarContent pathname={pathname} user={user} />
      </aside>

      {/* Sidebar — mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-slate-950/55 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <aside
            ref={drawerRef}
            role="dialog"
            aria-modal="true"
            aria-label="Navigation menu"
            className="absolute inset-y-0 left-0 flex w-[18rem] max-w-[88vw] flex-col border-r border-white/5 bg-sidebar text-sidebar-foreground shadow-2xl"
          >
            <button
              className="absolute right-3 top-3 rounded-lg p-2 text-sidebar-muted transition-colors hover:bg-white/10 hover:text-white"
              onClick={() => setMobileOpen(false)}
              aria-label="Close navigation menu"
            >
              <X className="h-4 w-4" />
            </button>
            <SidebarContent pathname={pathname} user={user} onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      {/* Main */}
      <div className="lg:pl-64">
        {/* Top bar */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border/70 bg-background/75 px-4 backdrop-blur-xl sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <Button
              ref={menuButtonRef}
              variant="ghost"
              size="icon"
              className="-ml-2 rounded-full lg:hidden"
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </Button>
            <div>
              <p className="text-sm font-semibold leading-none">{meta.label}</p>
              <p className="mt-1 hidden text-[11px] text-muted-foreground sm:block">{meta.context}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden items-center gap-2 rounded-full border bg-card/70 px-3 py-1.5 text-[11px] font-semibold text-muted-foreground shadow-sm sm:flex">
              <span className="h-1.5 w-1.5 rounded-full bg-success shadow-[0_0_0_3px_hsl(var(--success)/0.12)]" />
              Workspace live
            </div>
            <ThemeToggle />
          </div>
        </header>

        <main id="main-content" className="mx-auto max-w-[90rem] px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-9">
          {children}
        </main>
      </div>
    </div>
  );
}

function SidebarContent({
  pathname,
  user,
  onNavigate,
}: {
  pathname: string;
  user: { name: string; email: string };
  onNavigate?: () => void;
}) {
  return (
    <>
      <div className="flex h-16 items-center gap-3 border-b border-white/5 px-5">
        <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-400 to-primary shadow-lg shadow-primary/20">
          <Mail className="h-[18px] w-[18px] text-white" />
          <Sparkles className="absolute -right-1 -top-1 h-3 w-3 text-indigo-200" />
        </div>
        <div>
          <span className="block text-sm font-semibold tracking-tight text-white">Trishulhub</span>
          <span className="block text-[10px] font-medium uppercase tracking-[0.2em] text-sidebar-muted">Leads OS</span>
        </div>
      </div>

      <div className="px-5 pb-2 pt-6 text-[10px] font-bold uppercase tracking-[0.18em] text-sidebar-muted/70">
        Workspace
      </div>
      <nav className="flex-1 space-y-1 px-3" onClick={onNavigate} aria-label="Main navigation">
        {NAV.map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
                active
                  ? "bg-white/10 text-white shadow-sm"
                  : "text-sidebar-muted hover:bg-white/[0.06] hover:text-white"
              )}
              aria-current={active ? "page" : undefined}
            >
              {active && <span className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-sidebar-accent" />}
              <Icon className={cn("h-4 w-4 transition-colors", active ? "text-sidebar-accent" : "text-sidebar-muted group-hover:text-white")} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-white/5 p-3">
        <div className="mb-2 flex items-center gap-3 rounded-xl bg-white/[0.04] p-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-xs font-bold text-white ring-1 ring-white/10">
            {user.name.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-white">{user.name}</p>
            <p className="truncate text-[11px] text-sidebar-muted">{user.email}</p>
          </div>
        </div>
        <form action={logoutAction}>
          <Button type="submit" variant="ghost" size="sm" className="w-full justify-start text-sidebar-muted hover:bg-white/[0.06] hover:text-white">
            <LogOut className="h-4 w-4" />
            Sign out
          </Button>
        </form>
      </div>
    </>
  );
}
