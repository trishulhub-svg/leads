// src/app/api/settings/brand/route.ts
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getPublicBrand, saveBrandConfig } from "@/lib/brand";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await getCurrentUser())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ brand: await getPublicBrand() });
}

export async function PUT(req: Request) {
  if (!(await getCurrentUser())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = (await req.json()) as {
      brandName?: string;
      senderName?: string;
      accentColor?: string;
      logoBase64?: string | null;
      logoMime?: string | null;
      clearLogo?: boolean;
    };
    const brand = await saveBrandConfig(body);
    return NextResponse.json({ ok: true, brand });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to save brand settings." },
      { status: 400 }
    );
  }
}
