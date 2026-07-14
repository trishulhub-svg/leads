// src/lib/campaignEngine.ts
// The send pipeline. Campaigns enqueue one send_email job per surviving lead;
// jobs are drained both inline (on the send request) and by the process-campaigns
// cron route. Each drain tick round-robins across the 8-SMTP pool with failover.
import { eq, and, inArray } from "drizzle-orm";
import { db, schema } from "./db";
import { pickSmtp, resolveSmtp, markFailure } from "./smtpLoadBalancer";
import { sendCampaignEmail, interpolate } from "./email";
import { normalizeEmail } from "./normalize";

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

  // Dedup gate: which of these have NEVER been sent before?
  const norms = leadRows.map((l) => l.emailNorm);
  const alreadySent = norms.length
    ? await db
        .select({ emailNorm: schema.sentEmails.emailNorm })
        .from(schema.sentEmails)
        .where(inArray(schema.sentEmails.emailNorm, norms))
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
 * `deadlineMs` ms have elapsed, whichever comes first. This is the workhorse for
 * both the inline send request and the cron drain.
 */
export async function drainCampaign(campaignId: number, opts: { maxJobs?: number; deadlineMs?: number } = {}): Promise<SendOutcome> {
  const maxJobs = opts.maxJobs ?? 100;
  const deadline = Date.now() + (opts.deadlineMs ?? 25_000);
  const out: SendOutcome = { processed: 0, sent: 0, failed: 0, skipped: 0 };

  const campaign = await db.select().from(schema.campaigns).where(eq(schema.campaigns.id, campaignId)).limit(1).then((r) => r[0]);
  if (!campaign) return { ...out, stoppedReason: "no_jobs" };
  const template = campaign.templateId
    ? await db.select().from(schema.templates).where(eq(schema.templates.id, campaign.templateId)).limit(1).then((r) => r[0])
    : null;

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

    // Claim it (mark processing so concurrent drains don't double-send).
    await db.update(schema.sentEmails).set({ status: "failed" }).where(eq(schema.sentEmails.id, next.id));
    // We set status to a non-queued value as a cheap claim; on success we'll set 'sent'.
    // Re-read to confirm we won the claim (libSQL row locking is light).
    const claimed = await db.select().from(schema.sentEmails).where(eq(schema.sentEmails.id, next.id)).limit(1).then((r) => r[0]);
    if (!claimed || claimed.status !== "failed") {
      // Someone else took it; skip.
      out.skipped++;
      continue;
    }

    // Pick an SMTP (Primary → Emergency failover). Pool exhausted?
    const smtpRow = await pickSmtp();
    if (!smtpRow) {
      // Mark this email back to queued (so a later drain can retry) and pause.
      await db.update(schema.sentEmails).set({ status: "queued" }).where(eq(schema.sentEmails.id, next.id));
      return { ...out, stoppedReason: "pool_exhausted" };
    }

    const lead = next.leadId
      ? await db.select().from(schema.leads).where(eq(schema.leads.id, next.leadId)).limit(1).then((r) => r[0])
      : null;

    const htmlBody = template
      ? interpolate(template.htmlBody, { firstName: lead?.firstName, company: lead?.company, email: next.email })
      : `<p>${escapeBasic(next.email)}</p>`;
    const subject = template ? interpolate(template.subject, { firstName: lead?.firstName, company: lead?.company }) : next.subject;

    try {
      const smtp = await resolveSmtp(smtpRow);
      await sendCampaignEmail({
        smtp: { id: smtp.id, fromName: smtp.fromName, fromEmail: smtp.fromEmail, transporter: smtp.transporter },
        to: next.email,
        subject,
        html: htmlBody,
        sentEmailId: next.id,
      });
      await db.update(schema.sentEmails).set({ status: "sent", smtpConfigId: smtpRow.id, sentAt: new Date() }).where(eq(schema.sentEmails.id, next.id));
      out.sent++;
    } catch (err: any) {
      // Sending failed on this SMTP — mark it unhealthy, put the email back to queued,
      // and retry the same email on the next pick (failover).
      await markFailure(smtpRow.id, err?.message ?? String(err));
      await db.update(schema.sentEmails).set({ status: "queued", errorMsg: (err?.message ?? String(err)).slice(0, 300) }).where(eq(schema.sentEmails.id, next.id));
      out.failed++;
      // Loop continues; next pickSmtp() will choose a different SMTP.
      continue;
    }
  }

  // Tally campaign counters + mark done if nothing queued remains.
  await refreshCampaignCounters(campaignId);
  return out;
}

/** Recompute sent/failed/total + status from sent_emails. */
export async function refreshCampaignCounters(campaignId: number): Promise<void> {
  const rows = await db.select().from(schema.sentEmails).where(eq(schema.sentEmails.campaignId, campaignId));
  const sent = rows.filter((r) => r.status === "sent").length;
  const failed = rows.filter((r) => r.status === "failed").length;
  const queued = rows.filter((r) => r.status === "queued").length;
  const opened = rows.filter((r) => r.openedAt).length;
  const replied = rows.filter((r) => r.repliedAt).length;
  await db
    .update(schema.campaigns)
    .set({
      sent,
      failed,
      opened,
      replied,
      total: rows.length,
      status: queued === 0 ? "done" : "sending",
    })
    .where(eq(schema.campaigns.id, campaignId));
}

function escapeBasic(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

void normalizeEmail;
