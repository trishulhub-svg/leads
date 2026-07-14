// scripts/test-classifier.ts
import { classifyReply } from "../src/lib/replyClassifier";

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error("❌ FAIL:", msg);
    process.exit(1);
  }
  console.log("✅", msg);
}

console.log("\n=== Reply Classifier Tests ===\n");

// Positive
assert(classifyReply({ subject: "Re: outreach", text: "Yes, I'm interested. Send me more info." }) === "positive", "positive: interested + more info");
assert(classifyReply({ subject: "", text: "sure, let's talk next week" }) === "positive", "positive: let's talk");
assert(classifyReply({ subject: "pricing", text: "" }) === "positive", "positive: pricing subject");

// Negative
assert(classifyReply({ subject: "", text: "Not interested, please remove me." }) === "negative", "negative: not interested + remove");
assert(classifyReply({ subject: "unsubscribe", text: "" }) === "negative", "negative: unsubscribe");
assert(classifyReply({ subject: "", text: "Please take me off your list" }) === "negative", "negative: take me off");

// Bounce
assert(classifyReply({ subject: "Delivery Status Notification (Failure)", text: "" }) === "bounce", "bounce: DSN subject");
assert(classifyReply({ subject: "", text: "", isDeliveryStatus: true }) === "bounce", "bounce: DSN header flag");

// Autoreply
assert(classifyReply({ subject: "Out of office", text: "I'll be back Monday." }) === "autoreply", "autoreply: out of office");
assert(classifyReply({ subject: "", text: "", isAutoSubmitted: true }) === "autoreply", "autoreply: auto-submitted header");

// Neutral
assert(classifyReply({ subject: "Re: outreach", text: "Thanks for reaching out. Who is this?" }) === "neutral", "neutral: ambiguous");

console.log("\n=== All classifier tests passed ✅ ===\n");
process.exit(0);
