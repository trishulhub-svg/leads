// src/app/(dashboard)/settings/change-password-form.tsx
"use client";
import * as React from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ChangePasswordForm() {
  const [state, setState] = React.useState<{ loading: boolean; error?: string; ok?: boolean }>({ loading: false });

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setState({ loading: true });
    const fd = new FormData(e.currentTarget);
    const res = await fetch("/api/account/password", {
      method: "POST",
      body: JSON.stringify({
        current: fd.get("current"),
        next: fd.get("next"),
        confirm: fd.get("confirm"),
      }),
      headers: { "Content-Type": "application/json" },
    });
    const data = await res.json();
    if (!res.ok) setState({ loading: false, error: data.error });
    else {
      setState({ loading: false, ok: true });
      (e.target as HTMLFormElement).reset();
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
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
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      {state.ok && <p className="text-sm text-emerald-600 dark:text-emerald-400">Password changed. Please sign in again.</p>}
      <Button type="submit" disabled={state.loading} size="sm">
        {state.loading && <Loader2 className="h-4 w-4 animate-spin" />}
        Update password
      </Button>
    </form>
  );
}
