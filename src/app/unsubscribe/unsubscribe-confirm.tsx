"use client";

import * as React from "react";

/**
 * Explicit unsubscribe confirmation. We POST to the one-click endpoint only on a
 * real button press, so mail scanners / link-preview bots that fetch the GET
 * link can't silently unsubscribe recipients.
 */
export function UnsubscribeConfirm({ token, email }: { token: string; email: string }) {
  const [state, setState] = React.useState<"idle" | "loading" | "done" | "error">("idle");
  const [error, setError] = React.useState<string>("");

  async function confirm() {
    setState("loading");
    setError("");
    try {
      const res = await fetch(`/api/unsubscribe?token=${encodeURIComponent(token)}`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Could not process the request. Try again.");
        setState("error");
        return;
      }
      setState("done");
    } catch {
      setError("Network error. Please try again.");
      setState("error");
    }
  }

  if (state === "done") {
    return (
      <>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight">You’re unsubscribed</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          We’ve removed {email || "your address"} from future Trishulhub outreach. You won’t receive
          campaign emails from this workspace again.
        </p>
      </>
    );
  }

  return (
    <>
      <h1 className="mt-4 text-2xl font-semibold tracking-tight">Unsubscribe?</h1>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">
        Confirm to stop receiving campaign emails{email ? ` at ${email}` : ""} from this Trishulhub
        workspace.
      </p>
      {state === "error" && <p className="mt-3 text-sm text-destructive">{error}</p>}
      <button
        type="button"
        onClick={confirm}
        disabled={state === "loading"}
        className="mt-6 inline-flex h-11 w-full items-center justify-center rounded-lg bg-primary px-6 font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 disabled:opacity-60"
      >
        {state === "loading" ? "Unsubscribing…" : "Confirm unsubscribe"}
      </button>
    </>
  );
}
