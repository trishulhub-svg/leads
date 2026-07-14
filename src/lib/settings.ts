// src/lib/settings.ts
// Tiny key/value helpers over the settings table.
import { eq } from "drizzle-orm";
import { db, schema } from "./db";

export async function getSetting(key: string): Promise<string | null> {
  const row = await db
    .select({ value: schema.settings.value })
    .from(schema.settings)
    .where(eq(schema.settings.key, key))
    .limit(1)
    .then((r) => r[0]);
  return row?.value ?? null;
}

export async function getSettingJson<T>(key: string): Promise<T | null> {
  const raw = await getSetting(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function setSetting(key: string, value: string): Promise<void> {
  await db
    .insert(schema.settings)
    .values({ key, value })
    .onConflictDoUpdate({ target: schema.settings.key, set: { value } });
}

export async function setSettingJson(key: string, value: unknown): Promise<void> {
  await setSetting(key, JSON.stringify(value));
}
