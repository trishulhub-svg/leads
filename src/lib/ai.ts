import { eq, inArray } from "drizzle-orm";
import { db, schema } from "./db";
import { decrypt, encrypt } from "./crypto";

const KEYS = {
  apiKey: "ai_deepseek_api_key",
  baseUrl: "ai_deepseek_base_url",
  model: "ai_deepseek_model",
} as const;

export type AiConfig = {
  apiKey: string;
  baseUrl: string;
  model: string;
  source: "database" | "environment" | "none";
};

export type PublicAiConfig = Omit<AiConfig, "apiKey"> & { configured: boolean };

async function getValues(keys: string[]): Promise<Map<string, string>> {
  const rows = await db
    .select({ key: schema.settings.key, value: schema.settings.value })
    .from(schema.settings)
    .where(inArray(schema.settings.key, keys));
  return new Map(rows.map((row) => [row.key, row.value]));
}

export async function getAiConfig(): Promise<AiConfig> {
  const values = await getValues(Object.values(KEYS));
  const encryptedKey = values.get(KEYS.apiKey);
  const databaseKey = encryptedKey ? await decrypt(encryptedKey) : "";
  const environmentKey = process.env.DEEPSEEK_API_KEY || "";

  return {
    apiKey: databaseKey || environmentKey,
    baseUrl:
      values.get(KEYS.baseUrl) ||
      process.env.DEEPSEEK_BASE_URL ||
      "https://api.deepseek.com/v1",
    // Model identifiers are provider-controlled. Keep this editable so a future
    // DeepSeek V4 Flash identifier can be entered as soon as the account exposes it.
    model: values.get(KEYS.model) || process.env.DEEPSEEK_MODEL || "deepseek-chat",
    source: databaseKey ? "database" : environmentKey ? "environment" : "none",
  };
}

export async function getPublicAiConfig(): Promise<PublicAiConfig> {
  const config = await getAiConfig();
  return {
    configured: Boolean(config.apiKey),
    baseUrl: config.baseUrl,
    model: config.model,
    source: config.source,
  };
}

export async function saveAiConfig(input: {
  apiKey?: string;
  baseUrl: string;
  model: string;
}): Promise<void> {
  const baseUrl = normalizeBaseUrl(input.baseUrl);
  const model = input.model.trim();
  if (!model || model.length > 100) throw new Error("Enter a valid model identifier.");

  const updates = [
    { key: KEYS.baseUrl, value: baseUrl },
    { key: KEYS.model, value: model },
  ];
  if (input.apiKey?.trim()) {
    updates.push({ key: KEYS.apiKey, value: await encrypt(input.apiKey.trim()) });
  }

  for (const update of updates) {
    await db
      .insert(schema.settings)
      .values(update)
      .onConflictDoUpdate({ target: schema.settings.key, set: { value: update.value } });
  }
}

export async function clearDatabaseAiKey(): Promise<void> {
  await db.delete(schema.settings).where(eq(schema.settings.key, KEYS.apiKey));
}

function normalizeBaseUrl(value: string): string {
  const raw = value.trim().replace(/\/+$/, "");
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("Enter a valid AI API base URL.");
  }
  if (url.protocol !== "https:" && !(process.env.NODE_ENV !== "production" && url.protocol === "http:")) {
    throw new Error("The AI API URL must use HTTPS.");
  }
  return url.toString().replace(/\/$/, "");
}

export async function testAiConnection(): Promise<{ model: string; message: string }> {
  const config = await getAiConfig();
  if (!config.apiKey) throw new Error("Add a DeepSeek API key first.");
  const response = await callDeepSeek(config, [
    { role: "system", content: "Reply with exactly: Connection successful" },
    { role: "user", content: "Test this API connection." },
  ]);
  return { model: config.model, message: response.slice(0, 120) };
}

export type BusinessForAi = {
  id: string;
  name: string;
  category: string;
  address: string;
  website?: string;
};

/** Rank discovered map records; AI never invents businesses or contact details. */
export async function rankBusinesses(
  businesses: BusinessForAi[],
  requestedCategory: string
): Promise<Map<string, { relevant: boolean; reason: string }>> {
  const config = await getAiConfig();
  if (!config.apiKey || businesses.length === 0) return new Map();

  const response = await callDeepSeek(
    config,
    [
      {
        role: "system",
        content:
          "You rank verified business records for lead research. Never invent records. Return only a JSON array with objects: id, relevant (boolean), reason (max 12 words).",
      },
      {
        role: "user",
        content: JSON.stringify({ requestedCategory, businesses }),
      },
    ],
    { response_format: { type: "json_object" } }
  );

  try {
    const parsed = JSON.parse(response) as unknown;
    const rows = Array.isArray(parsed)
      ? parsed
      : parsed && typeof parsed === "object"
        ? Object.values(parsed as Record<string, unknown>).find(Array.isArray)
        : [];
    const result = new Map<string, { relevant: boolean; reason: string }>();
    for (const row of rows as Array<Record<string, unknown>>) {
      if (typeof row.id === "string" && typeof row.relevant === "boolean") {
        result.set(row.id, {
          relevant: row.relevant,
          reason: typeof row.reason === "string" ? row.reason.slice(0, 120) : "",
        });
      }
    }
    return result;
  } catch {
    return new Map();
  }
}

async function callDeepSeek(
  config: AiConfig,
  messages: Array<{ role: "system" | "user"; content: string }>,
  extra: Record<string, unknown> = {}
): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: config.model,
        messages,
        temperature: 0,
        max_tokens: 1200,
        ...extra,
      }),
    });
    const body = (await response.json().catch(() => null)) as
      | { choices?: Array<{ message?: { content?: string } }>; error?: { message?: string } }
      | null;
    if (!response.ok) throw new Error(body?.error?.message || `AI provider returned HTTP ${response.status}.`);
    const content = body?.choices?.[0]?.message?.content;
    if (!content) throw new Error("AI provider returned an empty response.");
    return content.replace(/^```(?:json)?\s*|\s*```$/g, "").trim();
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw new Error("AI request timed out.");
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
