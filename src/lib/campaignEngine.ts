// src/lib/campaignEngine.ts
// The send pipeline. Campaigns enqueue one send_email job per surviving lead;
// jobs are drained both inline (on the send request) and by the process-campaigns
// cron route. Each drain tick round-robins across the 8-SMTP pool with failover.
//
// Atomic claim: we use a dedicated 'processing' status and a conditional UPDATE
// (WHERE status='queued') to prevent concurrent drains from double-sending.
import { eq, and, inArray, sql } from "drizzle-orm";
import { db, schema } from "./db";
import { pickSmtp, resolveSmtp, markFailure } from "./smtpLoadBalancer";
import { sendCampaignEmail, interpolate } from "./email";
import { createUnsubscribeUrl } from "./unsubscribe";
import { getPublicBrand } from "./brand";

export type SendOutcome = {
  processed: number;
  sent: number;
  failed: number;
  skipped: number;
  stoppedReason?: "timeout" | "pool_exhausted" | "no_jobs";
};

/** Enqueue send jobs for a campaign (dedup-aware). Returns counts. */
export async function enqueueCampaign(
  campaignId: number,
  leadIds?: number[]
): Promise<{ total: number; enqueued: number; alreadySent: number }> {
  const campaign = await db
    .select()
    .from(schema.campaigns)
    .where(eq(schema.campaigns.id, campaignId))
    .limit(1)
    .then((r) => r[0]);
  if (!campaign) throw new Error("Campaign not found");

  // Pick leads: explicit ids, or all raw leads (optionally by niche).
  const leadCols = {
    id: schema.leads.id,
    email: schema.leads.email,
    emailNorm: schema.leads.emailNorm,
    firstName: schema.leads.firstName,
    company: schema.leads.company,
  };
  let leadRows;
  if (leadIds && leadIds.length) {
    leadRows = await db
      .select(leadCols)
      .from(schema.leads)
      .where(and(eq(schema.leads.status, "raw"), inArray(schema.leads.id, leadIds)));
  } else if (campaign.niche) {
    leadRows = await db
      .select(leadCols)
      .from(schema.leads)
      .where(and(eq(schema.leads.status, "raw"), eq(schema.leads.niche, campaign.niche)));
  } else {
    leadRows = await db.select(leadCols).from(schema.leads).where(eq(schema.leads.status, "raw"));
  }

  // Dedup gate: only consider 'sent' rows (not 'failed'/'processing') as truly sent.
  const norms = leadRows.map((l) => l.emailNorm);
  const alreadySent = norms.length
    ? await db
        .select({ emailNorm: schema.sentEmails.emailNorm })
        .from(schema.sentEmails)
        .where(
          and(
            inArray(schema.sentEmails.emailNorm, norms),
            eq(schema.sentEmails.status, "sent")
          )
        )
    : [];
  const sentSet = new Set(alreadySent.map((s) => s.emailNorm));

  const template = campaign.templateId
    ? await db.select().from(schema.templates).where(eq(schema.templates.id, campaign.templateId)).limit(1).then((r) => r[0])
    : null;

  let enqueued = 0;
  for (const lead of leadRows) {
    if (sentSet.has(lead.emailNorm)) continue; // hard dedup
    try {
      await db.insert(schema.sentEmails).values({
        leadId: lead.id,
        campaignId,
        email: lead.email,
        emailNorm: lead.emailNorm,
        subject: template?.subject ?? campaign.name,
        status: "queued",
      });
      enqueued++;
    } catch {
      // Collision on the unique index = already sent in a concurrent insert; skip.
    }
  }

  await db
    .update(schema.campaigns)
    .set({ total: enqueued, status: enqueued > 0 ? "sending" : "done" })
    .where(eq(schema.campaigns.id, campaignId));

  return { total: leadRows.length, enqueued, alreadySent: leadRows.length - enqueued };
}

/**
 * Drain queued send_email jobs for a campaign. Processes up to `maxJobs` or until
 * `deadlineMs` ms have elapsed, whichever comes first.
 *
 * Uses an atomic conditional claim: UPDATE ... SET status='processing' WHERE id=? AND status='queued'.
 * If rowsAffected === 0, another drain already claimed it → skip.
 */
export async function drainCampaign(campaignId: number, opts: { maxJobs?: number; deadlineMs?: number } = {}): Promise<SendOutcome> {
  const maxJobs = opts.maxJobs ?? 100;
  const deadline = Date.now() + (opts.deadlineMs ?? 9_000); // default 9s — safe for Hobby's 10s cap
  const out: SendOutcome = { processed: 0, sent: 0, failed: 0, skipped: 0 };

  const campaign = await db.select().from(schema.campaigns).where(eq(schema.campaigns.id, campaignId)).limit(1).then((r) => r[0]);
  if (!campaign) return { ...out, stoppedReason: "no_jobs" };
  const template = campaign.templateId
    ? await db.select().from(schema.templates).where(eq(schema.templates.id, campaign.templateId)).limit(1).then((r) => r[0])
    : null;
  const brand = await getPublicBrand();

  for (let i = 0; i < maxJobs; i++) {
    if (Date.now() > deadline) return { ...out, stoppedReason: "timeout" };

    // Pick the next queued email for this campaign.
    const next = await db
      .select()
      .from(schema.sentEmails)
      .where(and(eq(schema.sentEmails.campaignId, campaignId), eq(schema.sentEmails.status, "queued")))
      .limit(1)
      .then((r) => r[0]);
    if (!next) break; // nothing left to send

    out.processed++;

    // ATOMIC CLAIM: conditionally set status='processing' only if still 'queued'.
    // This prevents concurrent drains from double-sending.
    const claimResult = await db
      .update(schema.sentEmails)
      .set({ status: "processing" })
      .where(and(eq(schema.sentEmails.id, next.id), eq(schema.sentEmails.status, "queued")))
      .returning({ id: schema.sentEmails.id });

    if (claimResult.length === 0) {
      // Another drain already claimed this row → skip.
      out.skipped++;
      continue;
    }

    // Pick an SMTP (Primary → Emergency failover). Pool exhausted?
    const smtpRow = await pickSmtp();
    if (!smtpRow) {
      // Mark this email back to queued (so a later drain can retry) and stop.
      await db.update(schema.sentEmails).set({ status: "queued" }).where(eq(schema.sentEmails.id, next.id));
      return { ...out, stoppedReason: "pool_exhausted" };
    }

    const lead = next.leadId
      ? await db.select().from(schema.leads).where(eq(schema.leads.id, next.leadId)).limit(1).then((r) => r[0])
      : null;

    const unsubscribeUrl = await createUnsubscribeUrl(next.email);
    const mergeVars = {
      firstName: lead?.firstName,
      company: lead?.company,
      email: next.email,
      ctaUrl: template?.ctaUrl,
      unsubscribeUrl,
      brandName: brand.brandName,
      senderName: brand.senderName,
      brandColor: brand.accentColor,
      logoUrl: brand.logoUrl,
    };
    const htmlBody = template ? interpolate(template.htmlBody, mergeVars) : `<p>${escapeBasic(next.email)}</p>`;
    const subject = template ? interpolate(template.subject, mergeVars) : next.subject;

    try {
      const smtp = await resolveSmtp(smtpRow);
      await sendCampaignEmail({
        smtp: { id: smtp.id, fromName: smtp.fromName, fromEmail: smtp.fromEmail, transporter: smtp.transporter },
        to: next.email,
        subject,
        html: htmlBody,
        sentEmailId: next.id,
        unsubscribeUrl,
      });
      await db.update(schema.sentEmails).set({ status: "sent", smtpConfigId: smtpRow.id, sentAt: new Date() }).where(eq(schema.sentEmails.id, next.id));
      out.sent++;
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      // Sending failed on this SMTP — mark it unhealthy, put the email back to queued,
      // and the next pickSmtp() will choose a different SMTP (failover).
      await markFailure(smtpRow.id, errMsg);
      await db.update(schema.sentEmails).set({ status: "queued", errorMsg: errMsg.slice(0, 300) }).where(eq(schema.sentEmails.id, next.id));
      out.failed++;
      continue;
    }
  }

  // Tally campaign counters + mark done if nothing queued remains.
  await refreshCampaignCounters(campaignId);
  return out;
}

/** Recompute sent/failed/total + status using aggregate SQL (not full-table fetch). */
export async function refreshCampaignCounters(campaignId: number): Promise<void> {
  const stats = await db
    .select({
      sent: sql<number>`sum(case when ${schema.sentEmails.status}='sent' then 1 else 0 end)`,
      failed: sql<number>`sum(case when ${schema.sentEmails.status}='failed' then 1 else 0 end)`,
      queued: sql<number>`sum(case when ${schema.sentEmails.status}='queued' then 1 else 0 end)`,
      processing: sql<number>`sum(case when ${schema.sentEmails.status}='processing' then 1 else 0 end)`,
      opened: sql<number>`sum(case when ${schema.sentEmails.openedAt} is not null then 1 else 0 end)`,
      replied: sql<number>`sum(case when ${schema.sentEmails.repliedAt} is not null then 1 else 0 end)`,
    })
    .from(schema.sentEmails)
    .where(eq(schema.sentEmails.campaignId, campaignId));

  const s = stats[0];
  const sent = Number(s?.sent ?? 0);
  const failed = Number(s?.failed ?? 0);
  const queued = Number(s?.queued ?? 0);
  const processing = Number(s?.processing ?? 0);
  const opened = Number(s?.opened ?? 0);
  const replied = Number(s?.replied ?? 0);

  const total = sent + failed + queued + processing;

  await db
    .update(schema.campaigns)
    .set({
      sent,
      failed,
      opened,
      replied,
      total,
      status: queued + processing === 0 ? "done" : "sending",
    })
    .where(eq(schema.campaigns.id, campaignId));
}

function escapeBasic(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}