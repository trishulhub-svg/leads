// src/components/logout-button.tsx
"use client";

import * as React from "react";
import { LogOut, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { logoutAction } from "@/server/auth-actions";

/** Hard-navigates to /login after clearing the session so cached dashboard UI cannot linger. */
export function LogoutButton({ className }: { className?: string }) {
  const [pending, setPending] = React.useState(false);

  async function onLogout() {
    if (pending) return;
    setPending(true);
    try {
      await logoutAction();
    } catch {
      // redirect() throws in Next server actions — treat as success path.
    }
    // Force a full navigation so middleware + cookie state are re-evaluated.
    window.location.assign("/login");
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className={className}
      onClick={onLogout}
      disabled={pending}
    >
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
      {pending ? "Signing out…" : "Sign out"}
    </Button>
  );
}
