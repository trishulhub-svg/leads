// drizzle/schema.ts
// Trishulhub Leads — complete schema (Turso/libSQL via Drizzle).
// Single-owner system. The sent_emails unique index enforces dedup at the DB layer.
import { sqliteTable, text, integer, uniqueIndex, index } from "drizzle-orm/sqlite-core";

// ──────────────────────────────────────────────────────────────────────────
// Enums (string literals kept for clarity + tight validation)
// ──────────────────────────────────────────────────────────────────────────
export const SMTP_ROLES = ["primary", "emergency"] as const;
export type SmtpRole = (typeof SMTP_ROLES)[number];

export const LEAD_SOURCES = ["scrape", "csv", "manual"] as const;
export type LeadSource = (typeof LEAD_SOURCES)[number];

export const LEAD_STATUS = ["raw", "blacklisted"] as const;
export type LeadStatus = (typeof LEAD_STATUS)[number];

export const SENT_STATUS = ["queued", "sent", "failed", "bounced"] as const;
export type SentStatus = (typeof SENT_STATUS)[number];

export const CAMPAIGN_STATUS = ["draft", "sending", "done", "paused"] as const;
export type CampaignStatus = (typeof CAMPAIGN_STATUS)[number];

export const CTA_TYPES = ["landing", "whatsapp", "none"] as const;
export type CtaType = (typeof CTA_TYPES)[number];

export const CRM_STAGES = ["contacted", "discussed", "done", "wasted"] as const;
export type CrmStage = (typeof CRM_STAGES)[number];

export const REPLY_CLASS = ["positive", "negative", "bounce", "autoreply", "neutral"] as const;
export type ReplyClass = (typeof REPLY_CLASS)[number];

export const JOB_TYPES = ["send_email", "check_reply", "reset_limits"] as const;
export type JobType = (typeof JOB_TYPES)[number];

export const JOB_STATUS = ["pending", "processing", "done", "failed"] as const;
export type JobStatus = (typeof JOB_STATUS)[number];

// ──────────────────────────────────────────────────────────────────────────
// Users — single owner (the founder). No multi-tenant.
// ──────────────────────────────────────────────────────────────────────────
export const users = sqliteTable(
  "users",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    email: text("email").notNull().unique(),
    password: text("password").notNull(), // bcrypt hash
    createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().$onUpdateFn(() => new Date()),
  },
  (t) => ({
    emailIdx: uniqueIndex("users_email_idx").on(t.email),
  })
);

// ──────────────────────────────────────────────────────────────────────────
// Password reset tokens (issued via bound SMTP).
// ──────────────────────────────────────────────────────────────────────────
export const passwordResets = sqliteTable(
  "password_resets",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    token: text("token").notNull().unique(),
    expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
    usedAt: integer("used_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  },
  (t) => ({
    userIdx: index("pwresets_user_idx").on(t.userId),
  })
);

// ──────────────────────────────────────────────────────────────────────────
// Sessions (for revocation / invalidation on logout + password change).
// ──────────────────────────────────────────────────────────────────────────
export const sessions = sqliteTable(
  "sessions",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
    revokedAt: integer("revoked_at", { mode: "timestamp" }),
  },
  (t) => ({
    userIdx: index("sessions_user_idx").on(t.userId),
  })
);

// ──────────────────────────────────────────────────────────────────────────
// SMTP configs — exactly up to 8 (4 primary + 4 emergency).
// IMAP fields let us poll each bound inbox for replies.
// Passwords are encrypted at rest (src/lib/crypto.ts) — not plaintext.
// ──────────────────────────────────────────────────────────────────────────
export const smtpConfigs = sqliteTable(
  "smtp_configs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    label: text("label").notNull(),
    role: text("role", { enum: SMTP_ROLES }).notNull().default("primary"),
    // Outbound SMTP
    host: text("host").notNull(),
    port: integer("port").notNull().default(587),
    secure: integer("secure", { mode: "boolean" }).notNull().default(false),
    user: text("user").notNull(),
    passEnc: text("pass_enc").notNull(), // AES-256-GCM encrypted
    fromName: text("from_name").notNull(),
    fromEmail: text("from_email").notNull(),
    dailyLimit: integer("daily_limit").notNull().default(500),
    sentToday: integer("sent_today").notNull().default(0),
    limitResetAt: integer("limit_reset_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
    healthy: integer("healthy", { mode: "boolean" }).notNull().default(true),
    lastError: text("last_error"),
    lastCheckedAt: integer("last_checked_at", { mode: "timestamp" }),
    // Inbound IMAP (for reply monitoring). Optional per SMTP.
    imapHost: text("imap_host"),
    imapPort: integer("imap_port").default(993),
    imapSecure: integer("imap_secure", { mode: "boolean" }).notNull().default(true),
    imapUser: text("imap_user"),
    imapPassEnc: text("imap_pass_enc"),
    lastCheckedUid: integer("last_checked_uid").notNull().default(0),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().$onUpdateFn(() => new Date()),
  },
  (t) => ({
    roleIdx: index("smtp_role_idx").on(t.role),
  })
);

// ──────────────────────────────────────────────────────────────────────────
// Leads — raw leads pool. Stay here UNTIL they reply (then promoted to CRM).
// ──────────────────────────────────────────────────────────────────────────
export const leads = sqliteTable(
  "leads",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    email: text("email").notNull(),
    emailNorm: text("email_norm").notNull(), // lowercased, trimmed — dedup key
    firstName: text("first_name"),
    company: text("company"),
    niche: text("niche"),
    source: text("source", { enum: LEAD_SOURCES }).notNull().default("manual"),
    status: text("status", { enum: LEAD_STATUS }).notNull().default("raw"),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  },
  (t) => ({
    // One lead row per normalized email address.
    emailNormIdx: uniqueIndex("leads_email_norm_idx").on(t.emailNorm),
    statusIdx: index("leads_status_idx").on(t.status),
  })
);

// ──────────────────────────────────────────────────────────────────────────
// Templates — 4 seeded defaults; editable.
// ──────────────────────────────────────────────────────────────────────────
export const templates = sqliteTable(
  "templates",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    subject: text("subject").notNull(),
    htmlBody: text("html_body").notNull(),
    ctaType: text("cta_type", { enum: CTA_TYPES }).notNull().default("landing"),
    ctaUrl: text("cta_url"), // landing page URL or whatsapp number/link
    createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().$onUpdateFn(() => new Date()),
  }
);

// ──────────────────────────────────────────────────────────────────────────
// Campaigns — a send run: template + a batch of leads.
// ──────────────────────────────────────────────────────────────────────────
export const campaigns = sqliteTable(
  "campaigns",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    templateId: integer("template_id").references(() => templates.id),
    status: text("status", { enum: CAMPAIGN_STATUS }).notNull().default("draft"),
    niche: text("niche"),
    total: integer("total").notNull().default(0),
    sent: integer("sent").notNull().default(0),
    failed: integer("failed").notNull().default(0),
    opened: integer("opened").notNull().default(0),
    replied: integer("replied").notNull().default(0),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().$onUpdateFn(() => new Date()),
  }
);

// ──────────────────────────────────────────────────────────────────────────
// sent_emails — THE dedup ledger.
// Unique index on emailNorm means: an address can only ever be sent ONCE across
// all campaigns. The lead-generation import checks this table too.
// ──────────────────────────────────────────────────────────────────────────
export const sentEmails = sqliteTable(
  "sent_emails",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    leadId: integer("lead_id").references(() => leads.id, { onDelete: "set null" }),
    campaignId: integer("campaign_id").references(() => campaigns.id, { onDelete: "cascade" }),
    smtpConfigId: integer("smtp_config_id").references(() => smtpConfigs.id),
    email: text("email").notNull(),
    emailNorm: text("email_norm").notNull(),
    subject: text("subject").notNull(),
    status: text("status", { enum: SENT_STATUS }).notNull().default("queued"),
    openedAt: integer("opened_at", { mode: "timestamp" }),
    repliedAt: integer("replied_at", { mode: "timestamp" }),
    errorMsg: text("error_msg"),
    sentAt: integer("sent_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  },
  (t) => ({
    // HARD dedup: one outbound send per address, ever.
    emailNormIdx: uniqueIndex("sent_email_norm_idx").on(t.emailNorm),
    campaignIdx: index("sent_campaign_idx").on(t.campaignId),
    statusIdx: index("sent_status_idx").on(t.status),
  })
);

// ──────────────────────────────────────────────────────────────────────────
// CRM entries — ONLY for leads that have replied. Stages are strictly enforced.
// ──────────────────────────────────────────────────────────────────────────
export const crmEntries = sqliteTable(
  "crm_entries",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    leadId: integer("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    sentEmailId: integer("sent_email_id").references(() => sentEmails.id),
    stage: text("stage", { enum: CRM_STAGES }).notNull().default("contacted"),
    notes: text("notes"),
    firstRepliedAt: integer("first_replied_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().$onUpdateFn(() => new Date()),
  },
  (t) => ({
    // One CRM entry per lead.
    leadIdx: uniqueIndex("crm_lead_idx").on(t.leadId),
    stageIdx: index("crm_stage_idx").on(t.stage),
  })
);

// ──────────────────────────────────────────────────────────────────────────
// Reply log — every inbound reply (matched to a sent lead or not).
// ──────────────────────────────────────────────────────────────────────────
export const replyLog = sqliteTable(
  "reply_log",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    leadId: integer("lead_id").references(() => leads.id, { onDelete: "set null" }),
    fromEmail: text("from_email").notNull(),
    subject: text("subject"),
    snippet: text("snippet"),
    classification: text("classification", { enum: REPLY_CLASS }).notNull().default("neutral"),
    receivedAt: integer("received_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  },
  (t) => ({
    leadIdx: index("reply_lead_idx").on(t.leadId),
  })
);

// ──────────────────────────────────────────────────────────────────────────
// Jobs — the queue (replaces BullMQ/Redis). Drained by Vercel Cron routes.
// ──────────────────────────────────────────────────────────────────────────
export const jobs = sqliteTable(
  "jobs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    type: text("type", { enum: JOB_TYPES }).notNull(),
    payloadJson: text("payload_json").notNull(),
    status: text("status", { enum: JOB_STATUS }).notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(3),
    runAfter: integer("run_after", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
    errorMsg: text("error_msg"),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().$onUpdateFn(() => new Date()),
  },
  (t) => ({
    typeStatusIdx: index("jobs_type_status_idx").on(t.type, t.status),
    runAfterIdx: index("jobs_run_after_idx").on(t.runAfter),
  })
);

// ──────────────────────────────────────────────────────────────────────────
// Settings — key/value store (rate-limit counters, round-robin cursor, etc.)
// ──────────────────────────────────────────────────────────────────────────
export const settings = sqliteTable(
  "settings",
  {
    key: text("key").primaryKey(),
    value: text("value").notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().$onUpdateFn(() => new Date()),
  }
);
