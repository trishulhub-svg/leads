// src/app/api/track/open/[id]/route.ts
// Open-tracking pixel. Returns a 1x1 transparent GIF and records the open.
// This route is PUBLIC (allowed in middleware) so recipients' email clients can hit it.
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 1x1 transparent GIF.
const PIXEL = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64"
);

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sentEmailId = Number(id);
  if (sentEmailId) {
    // Record the open once (only if not already opened).
    try {
      const row = await db
        .select({ id: schema.sentEmails.id, openedAt: schema.sentEmails.openedAt, campaignId: schema.sentEmails.campaignId })
        .from(schema.sentEmails)
        .where(eq(schema.sentEmails.id, sentEmailId))
        .limit(1)
        .then((r) => r[0]);
      if (row && !row.openedAt) {
        await db.update(schema.sentEmails).set({ openedAt: new Date() }).where(eq(schema.sentEmails.id, sentEmailId));
      }
    } catch {
      // Swallow — the pixel must always return 200.
    }
  }
  return new NextResponse(PIXEL, {
    status: 200,
    headers: {
      "Content-Type": "image/gif",
      "Cache-Control": "no-store, max-age=0",
    },
  });
}
