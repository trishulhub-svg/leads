// src/app/api/account/email/route.ts
import { NextResponse } from "next/server";
import { getCurrentUser, requestEmailChange, confirmEmailChange } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** Step 1: verify password + send confirmation code to the NEW email via SMTP. */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const action = String(body.action || "request");

  if (action === "confirm") {
    const newEmail = String(body.newEmail || "");
    const otp = String(body.otp || "");
    if (!newEmail || !otp) {
      return NextResponse.json({ error: "Email and confirmation code are required." }, { status: 400 });
    }
    const res = await confirmEmailChange(user.id, newEmail, otp);
    if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 });
    return NextResponse.json({ ok: true, email: res.email });
  }

  const newEmail = String(body.newEmail || "");
  const password = String(body.password || "");
  if (!newEmail || !password) {
    return NextResponse.json({ error: "New email and current password are required." }, { status: 400 });
  }

  const res = await requestEmailChange(user.id, password, newEmail);
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 });
  return NextResponse.json({ ok: true });
}
