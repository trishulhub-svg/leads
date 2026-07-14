// src/app/forgot-password/forgot-form.tsx
"use client";
import * as React from "react";
import { useActionState } from "react";
import Link from "next/link";
import { Mail, ArrowLeft, Loader2, CheckCircle2, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { forgotAction, verifyOtpAction, resetPasswordAction } from "@/server/auth-actions";

export function ForgotForm() {
  const [stage, setStage] = React.useState<"request" | "verify" | "done">("request");
  const [email, setEmail] = React.useState("");
  const [resetToken, setResetToken] = React.useState("");

  const [reqState, reqAction, reqPending] = useActionState(forgotAction, null);
  const [otpState, otpAction, otpPending] = useActionState(verifyOtpAction, null);

  React.useEffect(() => {
    if (reqState?.ok) setStage("verify");
  }, [reqState]);

  React.useEffect(() => {
    if (otpState?.token) {
      setResetToken(otpState.token);
      setStage("done");
    }
  }, [otpState]);

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 via-white to-blue-50/40 px-4 dark:from-slate-950 dark:via-slate-950 dark:to-blue-950/30">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary shadow-lg shadow-primary/25">
            <KeyRound className="h-7 w-7 text-primary-foreground" />
          </div>
          <h1 className="text-xl font-bold tracking-tight">Reset your password</h1>
        </div>

        <div className="rounded-2xl border bg-card/80 p-8 shadow-xl backdrop-blur-sm">
          {stage === "request" && (
            <form
              action={(fd) => {
                setEmail(String(fd.get("email") || ""));
                reqAction(fd);
              }}
              className="space-y-4"
            >
              <p className="text-sm text-muted-foreground">
                Enter your email and we&apos;ll send a one-time code to reset your password.
              </p>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input id="email" name="email" type="email" required placeholder="you@example.com" className="pl-9" />
                </div>
              </div>
              {reqState?.error && (
                <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{reqState.error}</div>
              )}
              {reqState?.ok && (
                <div className="rounded-md bg-emerald-500/10 px-3 py-2 text-sm text-emerald-600 dark:text-emerald-400">
                  If the email exists, a reset code has been sent.
                </div>
              )}
              <Button type="submit" disabled={reqPending} className="w-full">
                {reqPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Send reset code
              </Button>
            </form>
          )}

          {stage === "verify" && (
            <form action={otpAction} className="space-y-4">
              <input type="hidden" name="email" value={email} />
              <p className="text-sm text-muted-foreground">
                Enter the 6-digit code we sent to <strong>{email}</strong>.
              </p>
              <div className="space-y-2">
                <Label htmlFor="otp">Reset code</Label>
                <Input
                  id="otp"
                  name="otp"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  required
                  placeholder="123456"
                  className="text-center text-2xl tracking-[0.5em]"
                />
              </div>
              {otpState?.error && (
                <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{otpState.error}</div>
              )}
              <Button type="submit" disabled={otpPending} className="w-full">
                {otpPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Verify code
              </Button>
            </form>
          )}

          {stage === "done" && <ResetPanel token={resetToken} />}
        </div>

        <div className="mt-6 text-center">
          <Link href="/login" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary">
            <ArrowLeft className="h-4 w-4" /> Back to login
          </Link>
        </div>
      </div>
    </div>
  );
}

function ResetPanel({ token }: { token: string }) {
  const [state, action, pending] = useActionState(resetPasswordAction, null);
  if (state?.ok) {
    return (
      <div className="space-y-4 text-center">
        <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500" />
        <p className="text-sm">Your password has been reset. You can now sign in.</p>
        <Link
          href="/login"
          className="inline-flex h-11 w-full items-center justify-center rounded-md bg-primary px-8 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Sign in
        </Link>
      </div>
    );
  }
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <div className="space-y-2">
        <Label htmlFor="password">New password</Label>
        <Input id="password" name="password" type="password" required minLength={8} placeholder="At least 8 characters" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirm">Confirm password</Label>
        <Input id="confirm" name="confirm" type="password" required minLength={8} placeholder="Repeat password" />
      </div>
      {state?.error && (
        <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{state.error}</div>
      )}
      <Button type="submit" disabled={pending} className="w-full">
        {pending && <Loader2 className="h-4 w-4 animate-spin" />}
        Set new password
      </Button>
    </form>
  );
}
