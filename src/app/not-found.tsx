import Link from "next/link";
import { Compass } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-lg rounded-2xl border bg-card/90 p-8 text-center shadow-xl backdrop-blur sm:p-12">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Compass className="h-6 w-6" />
        </div>
        <p className="mt-6 text-xs font-bold uppercase tracking-[0.2em] text-primary">404 · Off course</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">This page isn’t in your workspace</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          The link may be outdated, or the destination may have moved.
        </p>
        <Link href="/" className={`${buttonVariants()} mt-6`}>
          Return to dashboard
        </Link>
      </div>
    </main>
  );
}
