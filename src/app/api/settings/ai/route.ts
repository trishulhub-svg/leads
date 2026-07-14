import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  clearDatabaseAiKey,
  getPublicAiConfig,
  saveAiConfig,
  testAiConnection,
} from "@/lib/ai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await getCurrentUser())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ config: await getPublicAiConfig() });
}

export async function PUT(req: Request) {
  if (!(await getCurrentUser())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = (await req.json()) as {
      apiKey?: string;
      baseUrl?: string;
      model?: string;
      clearKey?: boolean;
    };
    if (body.clearKey) await clearDatabaseAiKey();
    await saveAiConfig({
      apiKey: body.apiKey,
      baseUrl: body.baseUrl || "https://api.deepseek.com/v1",
      model: body.model || "deepseek-chat",
    });
    return NextResponse.json({ ok: true, config: await getPublicAiConfig() });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to save AI settings." },
      { status: 400 }
    );
  }
}

export async function POST() {
  if (!(await getCurrentUser())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    return NextResponse.json({ ok: true, ...(await testAiConnection()) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "AI connection failed." },
      { status: 400 }
    );
  }
}
