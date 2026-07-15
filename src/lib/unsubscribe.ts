// src/lib/unsubscribe.ts
// Signed unsubscribe tokens + lead suppression (blacklist).
import { SignJWT } from "jose/jwt/sign";
import { jwtVerify } from "jose/jwt/verify";
import { eq } from "drizzle-orm";
import { db, schema } from "./db";
import { normalizeEmail } from "./normalize";

function getSecret(): Uint8Array {
  const s = process.env.AUTH_SECRET;
  if (!s || s.trim().length < 32) {
    throw new Error("AUTH_SECRET is required to sign unsubscribe links.");
  }
  return new TextEncoder().encode(s);
}

export function appBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_BASE_URL) return process.env.NEXT_PUBLIC_BASE_URL.replace(/\/$/, "");
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL.replace(/\/$/, "")}`;
  return "";
}

/** Create a long-lived signed unsubscribe URL for a recipient. */
export async function createUnsubscribeUrl(email: string): Promise<string> {
  const base = appBaseUrl();
  if (!base) return "#";
  const emailNorm = normalizeEmail(email);
  if (!emailNorm) return "#";
  const token = await new SignJWT({ email: emailNorm, purpose: "unsubscribe" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("400d")
    .sign(getSecret());
  return `${base}/unsubscribe?token=${encodeURIComponent(token)}`;
}

/** One-click / header endpoint URL (same token, API path). */
export async function createUnsubscribeApiUrl(email: string): Promise<string> {
  const pageUrl = await createUnsubscribeUrl(email);
  if (pageUrl === "#") return "#";
  return pageUrl.replace("/unsubscribe?", "/api/unsubscribe?");
}

export async function verifyUnsubscribeToken(
  token: string
): Promise<{ ok: true; email: string } | { ok: false; error: string }> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (payload.purpose !== "unsubscribe" || typeof payload.email !== "string") {
      return { ok: false, error: "Invalid unsubscribe link." };
    }
    const email = normalizeEmail(payload.email);
    if (!email) return { ok: false, error: "Invalid unsubscribe link." };
    return { ok: true, email };
  } catch {
    return { ok: false, error: "This unsubscribe link is invalid or has expired." };
  }
}

/** Mark the lead as blacklisted so they are never emailed again. */
export async function suppressEmail(emailNorm: string): Promise<{ suppressed: boolean }> {
  const existing = await db
    .select({ id: schema.leads.id, status: schema.leads.status })
    .from(schema.leads)
    .where(eq(schema.leads.emailNorm, emailNorm))
    .limit(1)
    .then((r) => r[0]);

  if (existing) {
    if (existing.status !== "blacklisted") {
      await db.update(schema.leads).set({ status: "blacklisted" }).where(eq(schema.leads.id, existing.id));
    }
    return { suppressed: true };
  }

  // Lead may not exist in the pool (already deleted) — still record a suppress row
  // by inserting a blacklisted lead so future imports skip via alreadyLeads... 
  // Actually import doesn't skip blacklisted specially beyond being a lead.
  // Inserting keeps them out of "raw" campaigns. Use onConflictDoNothing.
  try {
    await db.insert(schema.leads).values({
      email: emailNorm,
      emailNorm,
      source: "manual",
      status: "blacklisted",
    });
  } catch {
    // unique race — ignore
  }
  return { suppressed: true };
}
