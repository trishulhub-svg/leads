// src/app/unsubscribe/page.tsx
// Public page — verify token (read-only), then require an explicit button press
// to suppress the address. GET must never mutate (mail scanners fetch links).
import { verifyUnsubscribeToken } from "@/lib/unsubscribe";
import { UnsubscribeConfirm } from "./unsubscribe-confirm";

export const dynamic = "force-dynamic";

export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; ok?: string; error?: string; email?: string }>;
}) {
  const params = await searchParams;

  if (params.ok === "1") {
    return (
      <Shell>
        <Status
          title="You’re unsubscribed"
          body={`We’ve removed ${params.email || "your address"} from future Trishulhub outreach.`}
        />
      </Shell>
    );
  }

  if (params.error && !params.token) {
    return (
      <Shell>
        <Status title="Link problem" body={params.error} tone="error" />
      </Shell>
    );
  }

  const token = params.token;
  if (!token) {
    return (
      <Shell>
        <Status
          title="Missing unsubscribe link"
          body="Open the Unsubscribe button from a Trishulhub email to manage your preference."
          tone="error"
        />
      </Shell>
    );
  }

  const verified = await verifyUnsubscribeToken(token);
  if (!verified.ok) {
    return (
      <Shell>
        <Status title="Link problem" body={verified.error} tone="error" />
      </Shell>
    );
  }

  // Read-only render: the address is only suppressed after the user clicks Confirm.
  return (
    <Shell>
      <UnsubscribeConfirm token={token} email={verified.email} />
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-lg rounded-2xl border bg-card/90 p-8 text-center shadow-xl backdrop-blur sm:p-10">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Trishulhub</p>
        {children}
      </div>
    </main>
  );
}

function Status({
  title,
  body,
  tone = "ok",
}: {
  title: string;
  body: string;
  tone?: "ok" | "error";
}) {
  return (
    <>
      <h1 className="mt-4 text-2xl font-semibold tracking-tight">{title}</h1>
      <p className={`mt-3 text-sm leading-6 ${tone === "error" ? "text-destructive" : "text-muted-foreground"}`}>
        {body}
      </p>
    </>
  );
}
