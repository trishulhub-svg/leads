// src/lib/inbox.ts
// IMAP inbox monitoring for the reply-to-CRM pipeline.
// Called by the check-replies cron route. For each SMTP config that has IMAP
// credentials, open the inbox, fetch messages with UID > lastCheckedUid, classify,
// and auto-promote positive repliers into the CRM.
import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { eq } from "drizzle-orm";
import { db, schema } from "./db";
import { decrypt } from "./crypto";
import { classifyReply } from "./replyClassifier";
import { normalizeEmail } from "./normalize";

export type InboxResult = {
  configId: number;
  label: string;
  checked: number;
  matched: number;
  promoted: number;
  error?: string;
};

export async function checkAllInboxes(): Promise<InboxResult[]> {
  // Only configs that have IMAP set up are polled for replies.
  const all = await db.select().from(schema.smtpConfigs);
  const withImap = all.filter((c) => c.imapHost && c.imapUser && c.imapPassEnc);

  const results: InboxResult[] = [];
  for (const cfg of withImap) {
    results.push(await checkOneInbox(cfg));
  }
  return results;
}

async function checkOneInbox(cfg: typeof schema.smtpConfigs.$inferSelect): Promise<InboxResult> {
  const result: InboxResult = {
    configId: cfg.id,
    label: cfg.label,
    checked: 0,
    matched: 0,
    promoted: 0,
  };
  if (!cfg.imapHost || !cfg.imapUser || !cfg.imapPassEnc) {
    result.error = "IMAP not configured for this SMTP";
    return result;
  }

  const pass = await decrypt(cfg.imapPassEnc);
  let client: ImapFlow | null = null;
  try {
    client = new ImapFlow({
      host: cfg.imapHost,
      port: cfg.imapPort ?? 993,
      secure: cfg.imapSecure,
      auth: { user: cfg.imapUser, pass },
      logger: false,
    });
    await client.connect();
    const lock = await client.getMailboxLock("INBOX");
    try {
      const status = await client.status("INBOX", { uidNext: true });
      // Fetch messages newer than the last UID we saw.
      const range = cfg.lastCheckedUid > 0 ? `${cfg.lastCheckedUid + 1}:*` : "1:*";
      const uids: number[] = [];
      for await (const msg of client.fetch(range, { uid: true, source: true, envelope: true, headers: true })) {
        uids.push(msg.uid);
        result.checked++;
        try {
          const source = msg.source instanceof Buffer ? msg.source : Buffer.from(msg.source as any);
          const parsed = await simpleParser(source);

          const fromEmail = parsed.from?.value?.[0]?.address || "";
          if (!fromEmail) continue;
          const norm = normalizeEmail(fromEmail);

          const headers = parsed.headers;
          const hstr = (k: string): string => String(headers.get(k) || "");
          const isAutoSubmitted = /yes|auto-generated|auto-replied/i.test(hstr("auto-submitted"));
          const isDeliveryStatus =
            /delivery-status/i.test(hstr("content-type")) ||
            /^postmaster@/i.test(fromEmail) ||
            /mailer-daemon/i.test(fromEmail);

          const subject = parsed.subject || "";
          const text = parsed.text || "";
          const classification = classifyReply({
            subject,
            text,
            isAutoSubmitted,
            isDeliveryStatus,
          });

          // Find the sent_email + lead this reply corresponds to.
          const sentRow = await db
            .select()
            .from(schema.sentEmails)
            .where(eq(schema.sentEmails.emailNorm, norm))
            .limit(1)
            .then((r) => r[0]);

          let leadId: number | null = sentRow?.leadId ?? null;
          if (!leadId) {
            const lead = await db
              .select({ id: schema.leads.id })
              .from(schema.leads)
              .where(eq(schema.leads.emailNorm, norm))
              .limit(1)
              .then((r) => r[0]);
            leadId = lead?.id ?? null;
          }

          // Log every reply (matched or not).
          await db.insert(schema.replyLog).values({
            leadId,
            fromEmail: norm,
            subject: subject.slice(0, 500),
            snippet: text.slice(0, 500),
            classification,
            receivedAt: parsed.date || new Date(),
          });

          if (!leadId || !sentRow) {
            // Reply from an address we never emailed — still logged, no CRM action.
            continue;
          }
          result.matched++;

          // Mark the sent_email as replied.
          if (!sentRow.repliedAt) {
            await db
              .update(schema.sentEmails)
              .set({ repliedAt: new Date(), status: "sent" })
              .where(eq(schema.sentEmails.id, sentRow.id));
          }

          switch (classification) {
            case "bounce": {
              // Bad lead — blacklist + mark bounced.
              await db
                .update(schema.leads)
                .set({ status: "blacklisted" })
                .where(eq(schema.leads.id, leadId));
              await db
                .update(schema.sentEmails)
                .set({ status: "bounced" })
                .where(eq(schema.sentEmails.id, sentRow.id));
              break;
            }
            case "negative": {
              // Move to Wasted in the CRM (or create if missing).
              await upsertCrm(leadId, sentRow.id, "wasted");
              result.promoted++;
              break;
            }
            case "positive": {
              // Promote into the CRM at the first stage.
              await upsertCrm(leadId, sentRow.id, "contacted");
              result.promoted++;
              break;
            }
            case "autoreply":
            case "neutral":
            default:
              // No stage change, but logged above.
              break;
          }
        } catch (err) {
          console.error(`[inbox] message parse error (uid ${msg.uid}):`, err);
        }
      }

      // Advance the UID cursor to the latest we saw (or uidNext - 1).
      const newCursor = status?.uidNext ? Number(status.uidNext) - 1 : Math.max(cfg.lastCheckedUid, ...uids, 0);
      if (newCursor > cfg.lastCheckedUid) {
        await db.update(schema.smtpConfigs).set({ lastCheckedUid: newCursor }).where(eq(schema.smtpConfigs.id, cfg.id));
      }
    } finally {
      lock.release();
    }
    await client.logout();
  } catch (err: any) {
    result.error = err?.message ?? String(err);
    try {
      if (client) await client.logout().catch(() => {});
    } catch {
      /* ignore */
    }
  }
  return result;
}

/** Insert a CRM entry, or update the stage if one already exists for this lead. */
async function upsertCrm(
  leadId: number,
  sentEmailId: number | null,
  stage: "contacted" | "discussed" | "done" | "wasted"
): Promise<void> {
  const existing = await db
    .select()
    .from(schema.crmEntries)
    .where(eq(schema.crmEntries.leadId, leadId))
    .limit(1)
    .then((r) => r[0]);
  if (existing) {
    // Don't demote a lead that has already moved past 'contacted' (except explicit negative → wasted).
    if (stage === "wasted" || existing.stage === "contacted") {
      await db.update(schema.crmEntries).set({ stage }).where(eq(schema.crmEntries.id, existing.id));
    }
  } else {
    await db.insert(schema.crmEntries).values({ leadId, sentEmailId, stage });
  }
}
