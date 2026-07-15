// src/app/forgot-password/forgot-form.tsx
"use client";
import * as React from "react";
import { useActionState } from "react";
import Link from "next/link";
import { Mail, ArrowLeft, Loader2, CheckCircle2, KeyRound } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { forgotAction, verifyOtpAction, resetPasswordAction } from "@/server/auth-actions";
import { AuthShell } from "@/components/auth-shell";
import { Alert } from "@/components/ui/alert";

export function ForgotForm() {
  const [stage, setStage] = React.useState<"request" | "verify" | "done">("request");
  const [email, setEmail] = React.useState("");
  const [resetToken, setResetToken] = React.useState("");

  const [reqState, reqAction, reqPending] = useActionState(forgotAction, null);
  const [otpState, otpAction, otpPending] = useActionState(verifyOtpAction, null);

  React.useEffect(() => {
    // Only advance when a code was actually sent to a known account.
    if (reqState?.ok) setStage("verify");
  }, [reqState]);

  React.useEffect(() => {
    if (otpState?.token) {
      setResetToken(otpState.token);
      setStage("done");
    }
  }, [otpState]);

  return (
    <AuthShell
      title={stage === "request" ? "Reset your password" : stage === "verify" ? "Check your inbox" : "Choose a new password"}
      description={
        stage === "request"
          ? "We’ll email a one-time code only if this address is registered for this workspace."
          : stage === "verify"
            ? "Enter the six-digit code from your email — it is never shown on this page."
            : "Create a strong password for your workspace."
      }
      icon={KeyRound}
      footer={
        <Link href="/login" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-primary">
          <ArrowLeft className="h-4 w-4" /> Back to login
        </Link>
      }
    >
        <div className="mb-6 grid grid-cols-3 gap-2" aria-label="Password reset progress">
          {["Email", "Verify", "Reset"].map((label, index) => {
            const activeIndex = stage === "request" ? 0 : stage === "verify" ? 1 : 2;
            return (
              <div key={label}>
                <div className={`h-1 rounded-full ${index <= activeIndex ? "bg-primary" : "bg-muted"}`} />
                <p className={`mt-1.5 text-[10px] font-semibold ${index === activeIndex ? "text-primary" : "text-muted-foreground"}`}>{label}</p>
              </div>
            );
          })}
        </div>
          {stage === "request" && (
            <form
              action={(fd) => {
                setEmail(String(fd.get("email") || "").trim().toLowerCase());
                reqAction(fd);
              }}
              className="space-y-4"
            >
              <p className="text-sm text-muted-foreground">
                Enter the owner email already saved in this workspace. Unknown emails cannot request a reset.
              </p>
              <div className="space-y-2">
                <Label htmlFor="email">Registered email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    required
                    autoComplete="email"
                    placeholder="owner@yourcompany.com"
                    className="pl-9"
                  />
                </div>
              </div>
              {reqState?.error && (
                <Alert variant="error">{reqState.error}</Alert>
              )}
              {reqState?.ok && (
                <Alert variant="success">Reset code sent. Check your inbox (and spam folder).</Alert>
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
                We sent a 6-digit code to <strong>{email}</strong>. Enter it below — codes are only delivered by email.
              </p>
              <div className="space-y-2">
                <Label htmlFor="otp">Email code</Label>
                <Input
                  id="otp"
                  name="otp"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  required
                  placeholder="Enter 6-digit code"
                  className="text-center text-2xl tracking-[0.35em]"
                  aria-describedby="otp-hint"
                />
                <p id="otp-hint" className="text-[11px] text-muted-foreground">
                  The code is never shown in this app for security.
                </p>
              </div>
              {otpState?.error && (
                <Alert variant="error">{otpState.error}</Alert>
              )}
              <Button type="submit" disabled={otpPending} className="w-full">
                {otpPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Verify code
              </Button>
              <button
                type="button"
                className="w-full text-center text-xs font-medium text-muted-foreground hover:text-primary"
                onClick={() => {
                  setStage("request");
                }}
              >
                Use a different email
              </button>
            </form>
          )}

          {stage === "done" && <ResetPanel token={resetToken} />}
    </AuthShell>
  );
}

function ResetPanel({ token }: { token: string }) {
  const [state, action, pending] = useActionState(resetPasswordAction, null);
  if (state?.ok) {
    return (
      <div className="space-y-4 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-success/10 text-success">
          <CheckCircle2 className="h-7 w-7" />
        </div>
        <p className="text-sm font-medium">Your password has been reset. You can now sign in.</p>
        <Link
          href="/login"
          className={`${buttonVariants({ size: "lg" })} w-full`}
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
        <Alert variant="error">{state.error}</Alert>
      )}
      <Button type="submit" disabled={pending} className="w-full">
        {pending && <Loader2 className="h-4 w-4 animate-spin" />}
        Set new password
      </Button>
    </form>
  );
}
