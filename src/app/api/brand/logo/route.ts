// src/app/api/brand/logo/route.ts
// Public logo endpoint for email clients (no auth — image URLs must be fetchable).
import { NextResponse } from "next/server";
import { getBrandConfig } from "@/lib/brand";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const brand = await getBrandConfig();
  if (!brand.logoBase64 || !brand.logoMime) {
    return new NextResponse("Not found", { status: 404 });
  }
  const bytes = Buffer.from(brand.logoBase64, "base64");
  return new NextResponse(bytes, {
    status: 200,
    headers: {
      "Content-Type": brand.logoMime,
      "Cache-Control": "public, max-age=3600",
    },
  });
}
