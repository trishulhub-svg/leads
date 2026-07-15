// src/lib/sync-templates.ts
import { eq } from "drizzle-orm";
import { db, schema } from "./db";
import { defaultTemplates } from "./default-templates";

const SYNC_FLAG = "templates_professional_v1";

/** Upsert the four canonical Trishulhub templates once (or whenever legacy). */
export async function syncDefaultTemplates(): Promise<void> {
  const flag = await db
    .select()
    .from(schema.settings)
    .where(eq(schema.settings.key, SYNC_FLAG))
    .limit(1)
    .then((r) => r[0]);

  const force = !flag;

  for (const t of defaultTemplates()) {
    const exists = await db
      .select({ id: schema.templates.id, htmlBody: schema.templates.htmlBody })
      .from(schema.templates)
      .where(eq(schema.templates.name, t.name))
      .limit(1)
      .then((r) => r[0]);

    if (!exists) {
      await db.insert(schema.templates).values(t);
      continue;
    }

    const legacy = !exists.htmlBody.includes("{{unsubscribe_url}}");
    if (force || legacy) {
      await db
        .update(schema.templates)
        .set({
          subject: t.subject,
          htmlBody: t.htmlBody,
          ctaType: t.ctaType,
          ctaUrl: t.ctaUrl ?? null,
        })
        .where(eq(schema.templates.id, exists.id));
    }
  }

  if (force) {
    await db
      .insert(schema.settings)
      .values({ key: SYNC_FLAG, value: "1" })
      .onConflictDoUpdate({
        target: schema.settings.key,
        set: { value: "1" },
      });
  }
}
