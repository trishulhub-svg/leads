// src/app/(dashboard)/settings/change-email-form.tsx
"use client";
import * as React from "react";
import { Loader2, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";

export function ChangeEmailForm({ currentEmail }: { currentEmail: string }) {
  const [stage, setStage] = React.useState<"edit" | "verify">("edit");
  const [newEmail, setNewEmail] = React.useState("");
  const [state, setState] = React.useState<{ loading: boolean; error?: string; ok?: string }>({
    loading: false,
  });

  async function requestCode(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setState({ loading: true });
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get("newEmail") || "").trim().toLowerCase();
    const password = String(fd.get("password") || "");
    setNewEmail(email);

    try {
      const res = await fetch("/api/account/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "request", newEmail: email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setState({ loading: false, error: data.error || "Could not start email change." });
        return;
      }
      setStage("verify");
      setState({
        loading: false,
        ok: "Confirmation code sent to your new email via your workspace SMTP.",
      });
    } catch {
      setState({ loading: false, error: "Network error. Please try again." });
    }
  }

  async function confirmCode(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setState({ loading: true });
    const fd = new FormData(e.currentTarget);
    const otp = String(fd.get("otp") || "").trim();

    try {
      const res = await fetch("/api/account/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "confirm", newEmail, otp }),
      });
      const data = await res.json();
      if (!res.ok) {
        setState({ loading: false, error: data.error || "Could not confirm email change." });
        return;
      }
      setState({ loading: false, ok: "Email updated. Sign in again with your new address…" });
      setTimeout(() => {
        window.location.href = "/login";
      }, 1600);
    } catch {
      setState({ loading: false, error: "Network error. Please try again." });
    }
  }

  if (stage === "verify") {
    return (
      <form onSubmit={confirmCode} className="space-y-4 border-t pt-5">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <Mail className="h-4 w-4 text-primary" /> Confirm new email
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Enter the 6-digit code sent to <strong>{newEmail}</strong>. The code is email-only and never shown here.
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email-otp" className="text-xs">Confirmation code</Label>
          <Input
            id="email-otp"
            name="otp"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            maxLength={6}
            required
            placeholder="Enter 6-digit code"
            className="text-center text-xl tracking-[0.35em]"
          />
        </div>
        {state.error && <Alert variant="error">{state.error}</Alert>}
        {state.ok && <Alert variant="success">{state.ok}</Alert>}
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={state.loading}>
            {state.loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Confirm &amp; update email
          </Button>
          <Button
            type="button"
            variant="ghost"
            disabled={state.loading}
            onClick={() => {
              setStage("edit");
              setState({ loading: false });
            }}
          >
            Cancel
          </Button>
        </div>
      </form>
    );
  }

  return (
    <form onSubmit={requestCode} className="space-y-4 border-t pt-5">
      <div>
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <Mail className="h-4 w-4 text-primary" /> Change login email
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Current login: <strong>{currentEmail}</strong>. We&apos;ll send a confirmation code to the new address using your app SMTP.
        </p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="newEmail" className="text-xs">New email</Label>
        <Input id="newEmail" name="newEmail" type="email" required placeholder="new@yourcompany.com" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="email-password" className="text-xs">Current password</Label>
        <Input id="email-password" name="password" type="password" required autoComplete="current-password" />
      </div>
      {state.error && <Alert variant="error">{state.error}</Alert>}
      {state.ok && <Alert variant="success">{state.ok}</Alert>}
      <Button type="submit" disabled={state.loading} variant="outline" className="w-full sm:w-auto">
        {state.loading && <Loader2 className="h-4 w-4 animate-spin" />}
        Send confirmation code
      </Button>
    </form>
  );
}
