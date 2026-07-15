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
          ? "We’ll send a secure one-time code to your owner email."
          : stage === "verify"
            ? "Enter the six-digit code to verify your identity."
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
                <Alert variant="error">{reqState.error}</Alert>
              )}
              {reqState?.ok && (
                <Alert variant="success">If the email exists, a reset code has been sent.</Alert>
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
                <Alert variant="error">{otpState.error}</Alert>
              )}
              <Button type="submit" disabled={otpPending} className="w-full">
                {otpPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Verify code
              </Button>
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
