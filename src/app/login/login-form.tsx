// src/app/login/login-form.tsx
"use client";
import { useActionState } from "react";
import Link from "next/link";
import { Mail, Lock, LogIn, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { loginAction } from "@/server/auth-actions";
import { AuthShell } from "@/components/auth-shell";
import { Alert } from "@/components/ui/alert";

export function LoginForm() {
  const [state, formAction, pending] = useActionState(loginAction, null);

  return (
    <AuthShell
      title="Welcome back"
      description="Sign in to continue managing your lead engine and outreach pipeline."
      footer={<p className="text-xs text-muted-foreground">Secure single-owner access</p>}
    >
          <form action={formAction} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  placeholder="you@example.com"
                  className="pl-9"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <Link
                  href="/forgot-password"
                  className="text-xs text-muted-foreground transition-colors hover:text-primary"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  placeholder="••••••••"
                  className="pl-9"
                />
              </div>
            </div>

            {state?.error && (
              <Alert variant="error">{state.error}</Alert>
            )}

            <Button type="submit" disabled={pending} className="w-full" size="lg">
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
              {pending ? "Signing in…" : "Sign in"}
            </Button>
          </form>
    </AuthShell>
  );
}
