// src/lib/replyClassifier.ts
// v1 reply classification = heuristic keyword + bounce/autoreply detection.
// The classifyReply() function is isolated so an LLM call (OpenAI/AI-SDK) can
// replace it later by editing ONLY this file — no other code changes needed.
import type { ReplyClass } from "@/drizzle/schema";

const POSITIVE = [
  "interested",
  "yes",
  "sure",
  "tell me more",
  "more info",
  "more information",
  "pricing",
  "price",
  "quote",
  "how much",
  "sounds good",
  "let's talk",
  "lets talk",
  "let's schedule",
  "call me",
  "demo",
  "availability",
  "send details",
  "go ahead",
  "proceed",
  "looks interesting",
  "ok send",
  "whats the cost",
  "what's the cost",
];

const NEGATIVE = [
  "not interested",
  "unsubscribe",
  "remove me",
  "remove us",
  "stop emailing",
  "stop sending",
  "no thanks",
  "no thank you",
  "not now",
  "do not contact",
  "do not email",
  "dont contact",
  "don't contact",
  "please remove",
  "take me off",
  "opt out",
  "opt-out",
  "no longer",
  "not relevant",
  "wrong person",
  "not a fit",
  "not a good fit",
  "decline",
];

const BOUNCE_MARKERS = [
  "delivery status notification",
  "mail delivery failed",
  "returned mail",
  "undeliverable",
  "permanent failure",
  "user unknown",
  "no such user",
  "mailbox full",
  "quota exceeded",
  "recipient address rejected",
  "message blocked",
];

const AUTOREPLY_MARKERS = [
  "out of office",
  "out of the office",
  "auto-reply",
  "auto reply",
  "automatic reply",
  "automated response",
  "on vacation",
  "away from",
  "will be away",
];

function matchesAny(text: string, list: string[]): boolean {
  return list.some((kw) => text.includes(kw));
}

export type ClassifyInput = {
  subject: string;
  text: string;
  /** True if the message had an Auto-Submitted header (RFC 3834). */
  isAutoSubmitted?: boolean;
  /** True if it's a Delivery Status Notification (bounce). */
  isDeliveryStatus?: boolean;
};

/**
 * Classify an inbound reply.
 * Returns one of: positive | negative | bounce | autoreply | neutral.
 *
 * ── LLM HOOK ──────────────────────────────────────────────────────────────
 * To upgrade to LLM classification, replace the body of this function with an
 * OpenAI / AI-SDK call. The signature + return type stay the same; no other
 * file needs to change. Example:
 *
 *   if (process.env.OPENAI_API_KEY) {
 *     return await classifyWithOpenAI(input);
 *   }
 *   // …fall through to heuristic below
 */
export function classifyReply(input: ClassifyInput): ReplyClass {
  // Hard signals first.
  if (input.isDeliveryStatus) return "bounce";
  if (input.isAutoSubmitted) return "autoreply";

  const haystack = `${input.subject}\n${input.text}`.toLowerCase();

  if (matchesAny(haystack, BOUNCE_MARKERS)) return "bounce";
  if (matchesAny(haystack, AUTOREPLY_MARKERS)) return "autoreply";
  if (matchesAny(haystack, NEGATIVE)) return "negative";
  if (matchesAny(haystack, POSITIVE)) return "positive";

  return "neutral";
}
