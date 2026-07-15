// src/app/(dashboard)/settings/change-password-form.tsx
"use client";
import * as React from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";

export function ChangePasswordForm() {
  const [state, setState] = React.useState<{ loading: boolean; error?: string; ok?: boolean }>({ loading: false });

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setState({ loading: true });
    const fd = new FormData(e.currentTarget);
    const current = String(fd.get("current") || "");
    const next = String(fd.get("next") || "");
    const confirm = String(fd.get("confirm") || "");

    if (next !== confirm) {
      setState({ loading: false, error: "Passwords do not match." });
      return;
    }
    if (next.length < 8) {
      setState({ loading: false, error: "Password must be at least 8 characters." });
      return;
    }

    try {
      const res = await fetch("/api/account/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ current, next, confirm }),
      });
      const data = await res.json();
      if (!res.ok) {
        setState({ loading: false, error: data.error || "Failed to update password." });
      } else {
        setState({ loading: false, ok: true });
        (e.target as HTMLFormElement).reset();
        // The server invalidates all sessions on password change — redirect to login.
        setTimeout(() => { window.location.href = "/login"; }, 1500);
      }
    } catch {
      setState({ loading: false, error: "Network error. Please try again." });
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="current" className="text-xs">Current password</Label>
        <Input id="current" name="current" type="password" required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="next" className="text-xs">New password</Label>
        <Input id="next" name="next" type="password" required minLength={8} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="confirm" className="text-xs">Confirm new password</Label>
        <Input id="confirm" name="confirm" type="password" required minLength={8} />
      </div>
      {state.error && <Alert variant="error">{state.error}</Alert>}
      {state.ok && <Alert variant="success">Password changed. Redirecting to login…</Alert>}
      <Button type="submit" disabled={state.loading} className="w-full sm:w-auto">
        {state.loading && <Loader2 className="h-4 w-4 animate-spin" />}
        Update password
      </Button>
    </form>
  );
}