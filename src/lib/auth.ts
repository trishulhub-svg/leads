// src/lib/auth.ts
// Single-owner auth: jose HS256 JWT in httpOnly cookie + bcrypt + DB sessions.
import { randomInt } from "crypto";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { eq, and, isNull, gte } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db, schema } from "./db";
import { checkRateLimit, clearRateLimit } from "./rate-limiter";

const COOKIE = "tl_session";

function getSecret(): Uint8Array {
  const s = process.env.AUTH_SECRET;
  if (!s || s.trim().length < 8) {
    throw new Error(
      "AUTH_SECRET is required and must be at least 8 characters. " +
        "Generate one: node -e \"console.log(require('crypto').randomBytes(32).toString('base64'))\""
    );
  }
  return new TextEncoder().encode(s);
}

export type SessionUser = {
  id: number;
  name: string;
  email: string;
  sessionId?: string;
};

async function sign(user: SessionUser): Promise<string> {
  const sessionId = crypto.randomUUID();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 1000 * 60 * 60 * 24); // 1 day

  // Persist session for revocation (logout / password change). Non-blocking on DB error.
  try {
    await db.insert(schema.sessions).values({
      id: sessionId,
      userId: user.id,
      expiresAt,
      createdAt: now,
    });
  } catch (err) {
    console.error("[auth] sign() DB error (non-blocking):", err);
  }

  return new SignJWT({ ...user, sessionId })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(user.id))
    .setIssuedAt()
    .setExpirationTime("1d")
    .sign(getSecret());
}

async function verify(token: string): Promise<SessionUser | null> {
  let payload;
  try {
    ({ payload } = await jwtVerify(token, getSecret()));
  } catch {
    return null;
  }
  const user = payload as unknown as SessionUser;
  if (!user || typeof user.id !== "number") return null;

  // Fail closed only when we positively know a session is revoked.
  if (user.sessionId) {
    try {
      const session = await db
        .select({ revokedAt: schema.sessions.revokedAt, expiresAt: schema.sessions.expiresAt })
        .from(schema.sessions)
        .where(eq(schema.sessions.id, user.sessionId))
        .limit(1)
        .then((r) => r[0]);
      if (session?.revokedAt) return null;
    } catch (err) {
      console.error("[auth] session lookup error — failing open:", err);
    }
  }
  return user;
}

/** Get current user from cookie (server components / route handlers). */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (!token) return null;
  return verify(token);
}

/** Require an authenticated owner, else return null so callers can redirect. */
export async function requireUser(): Promise<SessionUser | null> {
  return getCurrentUser();
}

/** Verify credentials (without touching cookies) — shared by login() + tests. */
async function verifyCredentials(
  email: string,
  password: string
): Promise<{ ok: true; user: { id: number; name: string; email: string } } | { ok: false; error: string }> {
  const rl = await checkRateLimit(`login:${email.toLowerCase()}`, { max: 5, windowMs: 5 * 60 * 1000 });
  if (!rl.allowed) {
    if (!rl.dbError) return { ok: false, error: `Too many attempts. Try again in ${rl.retryAfter ?? 60}s.` };
    console.error("[auth] rate-limit DB down — allowing login attempt for", email);
  }

  let user;
  try {
    user = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, email.toLowerCase()))
      .limit(1)
      .then((r) => r[0]);
  } catch (err) {
    console.error("[auth] DB error:", err);
    return { ok: false, error: "Server error. Please try again." };
  }

  // No email enumeration.
  if (!user) return { ok: false, error: "Invalid email or password" };

  let match = false;
  try {
    match = await bcrypt.compare(password, user.password);
  } catch (err) {
    console.error("[auth] bcrypt error:", err);
    return { ok: false, error: "Server error. Please try again." };
  }
  if (!match) return { ok: false, error: "Invalid email or password" };

  try {
    await clearRateLimit(`login:${email.toLowerCase()}`);
  } catch (err) {
    console.error("[auth] clearRateLimit error:", err);
  }
  return { ok: true, user: { id: user.id, name: user.name, email: user.email } };
}

export async function login(
  email: string,
  password: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const res = await verifyCredentials(email, password);
  if (!res.ok) return res;

  const store = await cookies();
  let token;
  try {
    token = await sign(res.user);
  } catch (err) {
    console.error("[auth] sign error:", err);
    return { ok: false, error: "Server error. Please try again." };
  }
  store.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24,
  });
  return { ok: true };
}

// Exported for direct testing (no cookie dependency).
export { verifyCredentials };

export async function logout(): Promise<void> {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (token) {
    try {
      const { payload } = await jwtVerify(token, getSecret());
      const sid = payload.sessionId as string | undefined;
      if (sid) {
        await db.update(schema.sessions).set({ revokedAt: new Date() }).where(eq(schema.sessions.id, sid));
      }
    } catch {
      // invalid token — just delete cookie
    }
  }
  store.delete(COOKIE);
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 12);
}

// ──────────────────────────────────────────────────────────────────────────
// Forgot password — OTP via a bound SMTP.
// ──────────────────────────────────────────────────────────────────────────
function generateOtp(): string {
  return String(randomInt(100000, 1000000));
}

export async function sendForgotOtp(
  email: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const rl = await checkRateLimit(`forgot:${email.toLowerCase()}`, { max: 3, windowMs: 10 * 60 * 1000 });
  if (!rl.allowed && !rl.dbError) {
    return { ok: false, error: `Too many attempts. Try again in ${rl.retryAfter ?? 60}s.` };
  }

  const user = await db
    .select({ id: schema.users.id, name: schema.users.name })
    .from(schema.users)
    .where(eq(schema.users.email, email.toLowerCase()))
    .limit(1)
    .then((r) => r[0]);
  // Do not reveal whether the email exists.
  if (!user) return { ok: true };

  const otp = generateOtp();
  const hashed = await bcrypt.hash(otp, 12);
  const key = `forgot_otp_${email.toLowerCase().replace(/[^a-z0-9]/g, "")}`;
  await db
    .insert(schema.settings)
    .values({
      key,
      value: JSON.stringify({ otp: hashed, userId: user.id, expiresAt: Date.now() + 10 * 60 * 1000 }),
    })
    .onConflictDoUpdate({
      target: schema.settings.key,
      set: {
        value: JSON.stringify({ otp: hashed, userId: user.id, expiresAt: Date.now() + 10 * 60 * 1000 }),
      },
    });

  const { sendOwnerEmail } = await import("@/lib/email");
  await sendOwnerEmail({
    to: email,
    subject: "Password Reset OTP — Trishulhub Leads",
    html: `
      <div style="max-width:500px;margin:0 auto;font-family:Arial,sans-serif;color:#333">
        <h2 style="color:#0f172a">Password Reset Request</h2>
        <p>Hello <strong>${user.name}</strong>,</p>
        <p>Use the following OTP to reset your password. It expires in 10 minutes.</p>
        <div style="margin:24px 0;text-align:center">
          <span style="display:inline-block;padding:12px 32px;font-size:28px;font-weight:700;letter-spacing:8px;background:#f3f4f6;border-radius:8px;color:#0f172a">${otp}</span>
        </div>
        <p style="color:#6b7280;font-size:13px">If you did not request this, please ignore this email.</p>
      </div>
    `,
  });

  return { ok: true };
}

export async function verifyForgotOtp(
  email: string,
  otp: string
): Promise<{ ok: true; token: string } | { ok: false; error: string }> {
  const rl = await checkRateLimit(`otp_verify:${email.toLowerCase()}`, { max: 5, windowMs: 15 * 60 * 1000 });
  if (!rl.allowed) return { ok: false, error: "Too many attempts. Try again later." };

  const key = `forgot_otp_${email.toLowerCase().replace(/[^a-z0-9]/g, "")}`;
  const row = await db.select().from(schema.settings).where(eq(schema.settings.key, key)).limit(1).then((r) => r[0]);
  if (!row) return { ok: false, error: "No OTP was requested for this email." };

  let data: { otp: string; userId: number; expiresAt: number };
  try {
    data = JSON.parse(row.value);
  } catch {
    await db.delete(schema.settings).where(eq(schema.settings.key, key));
    return { ok: false, error: "OTP record corrupted. Please request a new one." };
  }
  if (Date.now() > data.expiresAt) {
    await db.delete(schema.settings).where(eq(schema.settings.key, key));
    return { ok: false, error: "OTP has expired. Request a new one." };
  }
  if (!(await bcrypt.compare(otp, data.otp))) return { ok: false, error: "Invalid OTP." };

  await db.delete(schema.settings).where(eq(schema.settings.key, key));

  const resetToken = await new SignJWT({ email: email.toLowerCase(), purpose: "password_reset" })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("15m")
    .sign(getSecret());
  return { ok: true, token: resetToken };
}

export async function resetPasswordWithToken(
  token: string,
  newPassword: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (payload.purpose !== "password_reset" || !payload.email) {
      return { ok: false, error: "Invalid reset token." };
    }
    const email = payload.email as string;
    const user = await db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.email, email))
      .limit(1)
      .then((r) => r[0]);
    if (!user) return { ok: false, error: "User not found." };

    await db
      .update(schema.users)
      .set({ password: await hashPassword(newPassword) })
      .where(eq(schema.users.id, user.id));
    // Invalidate all sessions.
    await db
      .update(schema.sessions)
      .set({ revokedAt: new Date() })
      .where(and(eq(schema.sessions.userId, user.id), isNull(schema.sessions.revokedAt)));

    return { ok: true };
  } catch {
    return { ok: false, error: "Invalid or expired reset token." };
  }
}

export async function changePassword(
  userId: number,
  current: string,
  next: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await db.select().from(schema.users).where(eq(schema.users.id, userId)).limit(1).then((r) => r[0]);
  if (!user) return { ok: false, error: "User not found" };
  if (current === next) return { ok: false, error: "New password must be different from the current one." };
  if (!(await bcrypt.compare(current, user.password))) return { ok: false, error: "Current password is incorrect" };
  await db.update(schema.users).set({ password: await hashPassword(next) }).where(eq(schema.users.id, userId));
  await db
    .update(schema.sessions)
    .set({ revokedAt: new Date() })
    .where(and(eq(schema.sessions.userId, userId), isNull(schema.sessions.revokedAt)));
  return { ok: true };
}

// Suppress unused-import warning for gte (kept for future expirer job).
void gte;
