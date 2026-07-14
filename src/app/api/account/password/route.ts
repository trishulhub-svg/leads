// src/app/api/account/password/route.ts
import { NextResponse } from "next/server";
import { getCurrentUser, changePassword } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { current, next, confirm } = await req.json();
  if (!current || !next) return NextResponse.json({ error: "All fields required." }, { status: 400 });
  if (next !== confirm) return NextResponse.json({ error: "Passwords do not match." }, { status: 400 });
  if (next.length < 8) return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });

  const res = await changePassword(user.id, current, next);
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 });
  return NextResponse.json({ ok: true });
}
