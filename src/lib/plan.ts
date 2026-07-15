// src/lib/plan.ts
// Server-side plan resolution. Client code must import from plan-constants.ts only.
import { getSetting } from "./settings";
import {
  FREE_PLAN,
  PREMIUM_PLAN,
  type PlanLimits,
} from "./plan-constants";

export {
  UPGRADE_WHATSAPP,
  FREE_PLAN,
  PREMIUM_PLAN,
  smtpCapForRole,
  isTemplateAllowed,
  type PlanId,
  type PlanLimits,
} from "./plan-constants";

/** Resolve current plan. Default free; set settings key `plan` = "premium" to unlock. */
export async function getPlanLimits(): Promise<PlanLimits> {
  const raw = (await getSetting("plan"))?.trim().toLowerCase();
  return raw === "premium" ? PREMIUM_PLAN : FREE_PLAN;
}
