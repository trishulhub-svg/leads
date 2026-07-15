// src/server/auth-actions.ts
"use server";
import { redirect } from "next/navigation";
import { login, logout, sendForgotOtp, verifyForgotOtp, resetPasswordWithToken, getCurrentUser } from "@/lib/auth";

export async function loginAction(_prev: { error?: string } | null, formData: FormData) {
  const email = String(formData.get("email") || "");
  const password = String(formData.get("password") || "");
  const redirectTo = String(formData.get("redirect") || "/");
  const res = await login(email, password);
  if (!res.ok) return { error: res.error };
  // Only allow same-origin relative paths.
  const safe = /^\/(?!\/)/.test(redirectTo) ? redirectTo : "/";
  redirect(safe);
}

/** Clears the session cookie. Callers should hard-navigate to /login afterwards. */
export async function logoutAction() {
  await logout();
}

export async function forgotAction(_prev: { error?: string; ok?: boolean } | null, formData: FormData) {
  const email = String(formData.get("email") || "");
  const res = await sendForgotOtp(email);
  if (!res.ok) return { error: res.error };
  return { ok: true };
}

export async function verifyOtpAction(_prev: { error?: string; token?: string } | null, formData: FormData) {
  const email = String(formData.get("email") || "");
  const otp = String(formData.get("otp") || "").trim();
  const res = await verifyForgotOtp(email, otp);
  if (!res.ok) return { error: res.error };
  return { token: res.token };
}

export async function resetPasswordAction(
  _prev: { error?: string; ok?: boolean } | null,
  formData: FormData
) {
  const token = String(formData.get("token") || "");
  const password = String(formData.get("password") || "");
  const confirm = String(formData.get("confirm") || "");
  if (password.length < 8) return { error: "Password must be at least 8 characters." };
  if (password !== confirm) return { error: "Passwords do not match." };
  const res = await resetPasswordWithToken(token, password);
  if (!res.ok) return { error: res.error };
  return { ok: true };
}

/** Server-action helper for server components to check auth. */
export async function getUserOrRedirect() {
  const user = await getCurrentUser();
  return user;
}
