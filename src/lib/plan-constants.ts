// src/lib/plan-constants.ts
// Client-safe plan constants (no db / server imports).

export const UPGRADE_WHATSAPP =
  "https://wa.me/919662106793?text=" +
  encodeURIComponent("Hi trishulhub team, I want to upgrade to Premium");

export type PlanId = "free" | "premium";

export type PlanLimits = {
  plan: PlanId;
  maxPrimarySmtp: number;
  maxEmergencySmtp: number;
  maxTemplates: number;
  leadIntelligence: boolean;
  smartSmtpPool: boolean;
  /** Follow-ups, priority, deal value, reply timeline, analytics, export. */
  advancedCrm: boolean;
};

export const FREE_PLAN: PlanLimits = {
  plan: "free",
  maxPrimarySmtp: 1,
  maxEmergencySmtp: 1,
  maxTemplates: 1,
  leadIntelligence: false,
  smartSmtpPool: false,
  advancedCrm: false,
};

export const PREMIUM_PLAN: PlanLimits = {
  plan: "premium",
  maxPrimarySmtp: 4,
  maxEmergencySmtp: 4,
  maxTemplates: 50,
  leadIntelligence: true,
  smartSmtpPool: true,
  advancedCrm: true,
};

export function smtpCapForRole(limits: PlanLimits, role: "primary" | "emergency"): number {
  return role === "primary" ? limits.maxPrimarySmtp : limits.maxEmergencySmtp;
}

/** Free plan may keep seeded extras in DB; only the earliest template id is editable/usable. */
export function isTemplateAllowed(limits: PlanLimits, templateId: number, allTemplateIdsAsc: number[]): boolean {
  if (limits.plan === "premium") return true;
  const freeId = allTemplateIdsAsc[0];
  return freeId != null && templateId === freeId;
}
