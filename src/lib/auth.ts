// src/lib/auth.ts
// Single-owner auth: jose HS256 JWT in httpOnly cookie + bcrypt + DB sessions.
import { randomInt } from "crypto";
import { SignJWT } from "jose/jwt/sign";
import { jwtVerify } from "jose/jwt/verify";
import { cookies } from "next/headers";
import { eq, and, isNull, gte } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db, schema } from "./db";
import { checkRateLimit, clearRateLimit } from "./rate-limiter";

const COOKIE = "tl_session";

function cookieOptions(maxAge?: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    ...(maxAge !== undefined ? { maxAge } : {}),
  };
}

function getSecret(): Uint8Array {
  const s = process.env.AUTH_SECRET;
  if (!s || s.trim().length < 32) {
    throw new Error(
      "AUTH_SECRET is required and must be at least 32 characters. " +
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

  if (user.sessionId) {
    try {
      const session = await db
        .select({ revokedAt: schema.sessions.revokedAt, expiresAt: schema.sessions.expiresAt })
        .from(schema.sessions)
        .where(eq(schema.sessions.id, user.sessionId))
        .limit(1)
        .then((r) => r[0]);
      // If a row exists, enforce revocation + server-side expiry.
      // (No row is tolerated: session insert at login is best-effort.)
      if (session) {
        if (session.revokedAt) return null;
        if (session.expiresAt && session.expiresAt.getTime() < Date.now()) return null;
      }
    } catch (err) {
      // Fail CLOSED: if we can't confirm the session is still valid, deny.
      console.error("[auth] session lookup error — failing closed:", err);
      return null;
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

  // No email enumeration — pay the same bcrypt cost when the user is missing.
  if (!user) {
    try {
      await bcrypt.compare(password, await getDummyHash());
    } catch {
      /* ignore */
    }
    return { ok: false, error: "Invalid email or password" };
  }

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
  store.set(COOKIE, token, cookieOptions(60 * 60 * 24));
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
      // invalid token — just clear cookie
    }
  }
  // Must mirror the same path/secure/sameSite used when setting, or browsers keep the cookie.
  store.set(COOKIE, "", { ...cookieOptions(0), expires: new Date(0) });
  store.delete(COOKIE);
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 12);
}

// A fixed dummy hash used to equalize timing when the email doesn't exist, so
// an attacker can't distinguish "no such user" from "wrong password" by timing.
let dummyHashPromise: Promise<string> | null = null;
function getDummyHash(): Promise<string> {
  if (!dummyHashPromise) dummyHashPromise = bcrypt.hash("timing-equalizer", 12);
  return dummyHashPromise;
}

/** HTML-escape a value before embedding it in transactional email markup. */
function escapeEmailHtml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
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
  const normalized = email.trim().toLowerCase();
  if (!normalized || !normalized.includes("@")) {
    return { ok: false, error: "Enter a valid email address." };
  }

  const rl = await checkRateLimit(`forgot:${normalized}`, { max: 3, windowMs: 10 * 60 * 1000 });
  if (!rl.allowed && !rl.dbError) {
    return { ok: false, error: `Too many attempts. Try again in ${rl.retryAfter ?? 60}s.` };
  }

  const user = await db
    .select({ id: schema.users.id, name: schema.users.name })
    .from(schema.users)
    .where(eq(schema.users.email, normalized))
    .limit(1)
    .then((r) => r[0]);

  // Only send a code when this email exists in the workspace database.
  if (!user) {
    return { ok: false, error: "No account found for that email. Use the email registered for this workspace." };
  }

  const otp = generateOtp();
  const hashed = await bcrypt.hash(otp, 12);
  const key = `forgot_otp_${normalized.replace(/[^a-z0-9]/g, "")}`;
  const payload = JSON.stringify({ otp: hashed, userId: user.id, expiresAt: Date.now() + 10 * 60 * 1000 });
  await db
    .insert(schema.settings)
    .values({ key, value: payload })
    .onConflictDoUpdate({
      target: schema.settings.key,
      set: { value: payload },
    });

  try {
    const { sendOwnerEmail } = await import("@/lib/email");
    await sendOwnerEmail({
      to: normalized,
      subject: "Password reset code — Trishulhub Leads",
      html: `
      <div style="max-width:500px;margin:0 auto;font-family:Arial,sans-serif;color:#333">
        <h2 style="color:#0f172a">Password reset</h2>
        <p>Hello <strong>${escapeEmailHtml(user.name)}</strong>,</p>
        <p>Use this 6-digit code to reset your password. It expires in 10 minutes.</p>
        <div style="margin:24px 0;text-align:center">
          <span style="display:inline-block;padding:12px 32px;font-size:28px;font-weight:700;letter-spacing:8px;background:#f3f4f6;border-radius:8px;color:#0f172a">${otp}</span>
        </div>
        <p style="color:#6b7280;font-size:13px">If you did not request this, you can ignore this email.</p>
      </div>
    `,
    });
  } catch (err) {
    console.error("[auth] failed to send reset code email:", err);
    await db.delete(schema.settings).where(eq(schema.settings.key, key));
    return {
      ok: false,
      error: "Could not send the reset code. Check your SMTP in Settings and try again.",
    };
  }

  // Never return the OTP to the client — it is email-only.
  return { ok: true };
}

export async function verifyForgotOtp(
  email: string,
  otp: string
): Promise<{ ok: true; token: string } | { ok: false; error: string }> {
  const rl = await checkRateLimit(`otp_verify:${email.toLowerCase()}`, { max: 5, windowMs: 15 * 60 * 1000 });
  // Fail CLOSED for OTP verification — a DB blip must not disable brute-force protection.
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

  // Bind the reset token to a single-use jti stored server-side. Consumed on the
  // first successful reset so a captured token can't be replayed in its window.
  const jti = crypto.randomUUID();
  const jtiKey = `pwreset_jti_${jti}`;
  await db.insert(schema.settings).values({
    key: jtiKey,
    value: JSON.stringify({ email: email.toLowerCase(), expiresAt: Date.now() + 15 * 60 * 1000 }),
  });

  const resetToken = await new SignJWT({ email: email.toLowerCase(), purpose: "password_reset", jti })
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
    if (payload.purpose !== "password_reset" || !payload.email || !payload.jti) {
      return { ok: false, error: "Invalid reset token." };
    }
    const email = payload.email as string;

    // Consume the single-use jti. If it's missing, the token was already used
    // (or never issued) → reject the replay.
    const jtiKey = `pwreset_jti_${String(payload.jti)}`;
    const jtiRow = await db
      .select({ value: schema.settings.value })
      .from(schema.settings)
      .where(eq(schema.settings.key, jtiKey))
      .limit(1)
      .then((r) => r[0]);
    if (!jtiRow) return { ok: false, error: "This reset link was already used. Request a new code." };
    // Delete first so concurrent replays can't both proceed.
    await db.delete(schema.settings).where(eq(schema.settings.key, jtiKey));
    try {
      const meta = JSON.parse(jtiRow.value) as { email?: string; expiresAt?: number };
      if (meta.email && meta.email !== email) return { ok: false, error: "Invalid reset token." };
      if (meta.expiresAt && Date.now() > meta.expiresAt) {
        return { ok: false, error: "This reset link has expired. Request a new code." };
      }
    } catch {
      return { ok: false, error: "Invalid reset token." };
    }

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

// ──────────────────────────────────────────────────────────────────────────
// Change login email — OTP sent to the NEW address via bound SMTP.
// ──────────────────────────────────────────────────────────────────────────
export async function requestEmailChange(
  userId: number,
  currentPassword: string,
  newEmail: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const normalized = newEmail.trim().toLowerCase();
  if (!normalized.includes("@") || normalized.length < 5) {
    return { ok: false, error: "Enter a valid new email address." };
  }

  const rl = await checkRateLimit(`email_change:${userId}`, { max: 3, windowMs: 15 * 60 * 1000 });
  if (!rl.allowed && !rl.dbError) {
    return { ok: false, error: `Too many attempts. Try again in ${rl.retryAfter ?? 60}s.` };
  }

  const user = await db.select().from(schema.users).where(eq(schema.users.id, userId)).limit(1).then((r) => r[0]);
  if (!user) return { ok: false, error: "User not found." };
  if (!(await bcrypt.compare(currentPassword, user.password))) {
    return { ok: false, error: "Current password is incorrect." };
  }
  if (user.email.toLowerCase() === normalized) {
    return { ok: false, error: "That is already your login email." };
  }

  const taken = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.email, normalized))
    .limit(1)
    .then((r) => r[0]);
  if (taken) return { ok: false, error: "That email is already in use." };

  const otp = generateOtp();
  const hashed = await bcrypt.hash(otp, 12);
  const key = `email_change_${userId}`;
  const payload = JSON.stringify({
    otp: hashed,
    newEmail: normalized,
    expiresAt: Date.now() + 10 * 60 * 1000,
  });
  await db
    .insert(schema.settings)
    .values({ key, value: payload })
    .onConflictDoUpdate({ target: schema.settings.key, set: { value: payload } });

  try {
    const { sendOwnerEmail } = await import("@/lib/email");
    await sendOwnerEmail({
      to: normalized,
      subject: "Confirm your new login email — Trishulhub Leads",
      html: `
      <div style="max-width:500px;margin:0 auto;font-family:Arial,sans-serif;color:#333">
        <h2 style="color:#0f172a">Confirm email change</h2>
        <p>Hello <strong>${escapeEmailHtml(user.name)}</strong>,</p>
        <p>Enter this 6-digit code in Settings to change your login email to <strong>${escapeEmailHtml(normalized)}</strong>.</p>
        <div style="margin:24px 0;text-align:center">
          <span style="display:inline-block;padding:12px 32px;font-size:28px;font-weight:700;letter-spacing:8px;background:#f3f4f6;border-radius:8px;color:#0f172a">${otp}</span>
        </div>
        <p style="color:#6b7280;font-size:13px">This code expires in 10 minutes. If you did not request this, ignore the email.</p>
      </div>
    `,
    });
  } catch (err) {
    console.error("[auth] failed to send email-change code:", err);
    await db.delete(schema.settings).where(eq(schema.settings.key, key));
    return {
      ok: false,
      error: "Could not send the confirmation code. Check your SMTP in Settings and try again.",
    };
  }

  return { ok: true };
}

export async function confirmEmailChange(
  userId: number,
  newEmail: string,
  otp: string
): Promise<{ ok: true; email: string } | { ok: false; error: string }> {
  const normalized = newEmail.trim().toLowerCase();
  const code = otp.trim();
  if (!/^\d{6}$/.test(code)) return { ok: false, error: "Enter the 6-digit code from your email." };

  const rl = await checkRateLimit(`email_change_verify:${userId}`, { max: 5, windowMs: 15 * 60 * 1000 });
  // Fail CLOSED for OTP verification — a DB blip must not disable brute-force protection.
  if (!rl.allowed) return { ok: false, error: "Too many attempts. Try again later." };

  const key = `email_change_${userId}`;
  const row = await db.select().from(schema.settings).where(eq(schema.settings.key, key)).limit(1).then((r) => r[0]);
  if (!row) return { ok: false, error: "No email change was requested. Start again." };

  let data: { otp: string; newEmail: string; expiresAt: number };
  try {
    data = JSON.parse(row.value);
  } catch {
    await db.delete(schema.settings).where(eq(schema.settings.key, key));
    return { ok: false, error: "Code record corrupted. Please request a new one." };
  }
  if (Date.now() > data.expiresAt) {
    await db.delete(schema.settings).where(eq(schema.settings.key, key));
    return { ok: false, error: "Code has expired. Request a new one." };
  }
  if (data.newEmail !== normalized) {
    return { ok: false, error: "Email does not match the pending change request." };
  }
  if (!(await bcrypt.compare(code, data.otp))) return { ok: false, error: "Invalid confirmation code." };

  await db.update(schema.users).set({ email: normalized }).where(eq(schema.users.id, userId));
  await db.delete(schema.settings).where(eq(schema.settings.key, key));
  // Force re-login so the session cookie picks up the new email.
  await db
    .update(schema.sessions)
    .set({ revokedAt: new Date() })
    .where(and(eq(schema.sessions.userId, userId), isNull(schema.sessions.revokedAt)));

  return { ok: true, email: normalized };
}

// Suppress unused-import warning for gte (kept for future expirer job).
void gte;
