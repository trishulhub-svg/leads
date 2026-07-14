// scripts/test-loadbalancer.ts
// Verifies the 8-SMTP load balancer: round-robin across primaries, failover to
// emergency when primaries are exhausted, and daily-limit enforcement.
import "dotenv/config";
import { eq } from "drizzle-orm";
import { db, schema } from "../src/lib/db";
import { encrypt } from "../src/lib/crypto";
import { pickSmtp, markFailure, markHealthy, resetAllDailyLimits } from "../src/lib/smtpLoadBalancer";

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error("❌ FAIL:", msg);
    process.exit(1);
  }
  console.log("✅", msg);
}

async function seedTestSmtps() {
  // Wipe existing test SMTPs.
  const existing = await db.select().from(schema.smtpConfigs);
  for (const e of existing) {
    await db.delete(schema.smtpConfigs).where(eq(schema.smtpConfigs.id, e.id));
  }
  const enc = await encrypt("dummy-pass");
  // 2 primaries, 1 emergency.
  await db.insert(schema.smtpConfigs).values([
    { label: "P1", role: "primary", host: "p1.test", port: 587, user: "p1", passEnc: enc, fromName: "T", fromEmail: "t@p1.test", dailyLimit: 2 },
    { label: "P2", role: "primary", host: "p2.test", port: 587, user: "p2", passEnc: enc, fromName: "T", fromEmail: "t@p2.test", dailyLimit: 2 },
    { label: "E1", role: "emergency", host: "e1.test", port: 587, user: "e1", passEnc: enc, fromName: "T", fromEmail: "t@e1.test", dailyLimit: 5 },
  ]);
  await resetAllDailyLimits();
}

(async () => {
  console.log("\n=== 8-SMTP Load Balancer Tests ===\n");
  await seedTestSmtps();

  // Test 1: round-robin alternates between P1 and P2.
  const pick1 = await pickSmtp();
  const pick2 = await pickSmtp();
  const pick3 = await pickSmtp();
  assert(!!pick1, "pickSmtp() returns a config");
  assert(pick1!.role === "primary", "first pick is a Primary");
  assert(pick2!.id !== pick1!.id, "second pick is a different Primary (round-robin)");
  assert(pick3!.id === pick1!.id, "third pick wraps back to the first (round-robin cycle)");
  console.log(`   picks: ${pick1!.label} → ${pick2!.label} → ${pick3!.label}`);

  // Test 2: when P1 fails (marked unhealthy), picks avoid it.
  await markFailure(pick1!.id, "simulated failure");
  const afterFail = await pickSmtp();
  assert(afterFail!.id !== pick1!.id, "after P1 fails, it's skipped");
  console.log(`   after P1 fails, pick was: ${afterFail!.label}`);

  // Test 3: when ALL primaries fail, failover to emergency.
  await markFailure(pick2!.id, "simulated failure");
  const emergencyPick = await pickSmtp();
  assert(emergencyPick!.role === "emergency", "all primaries down → fails over to Emergency");
  console.log(`   all primaries down → emergency pick: ${emergencyPick!.label}`);

  // Test 4: restore primaries → back to primary routing.
  await markHealthy(pick1!.id);
  await markHealthy(pick2!.id);
  const restored = await pickSmtp();
  assert(restored!.role === "primary", "primaries restored → routing returns to Primary pool");
  console.log(`   primaries restored → pick: ${restored!.label}`);

  // Test 5: daily limit enforcement. Exhaust P1's limit (2) by marking sent.
  await resetAllDailyLimits();
  // Mark P1 unhealthy so we force round-robin to P2 only, then exhaust P2.
  await markFailure(pick1!.id, "temp");
  // Drain P2's limit.
  const p2row = (await db.select().from(schema.smtpConfigs).where(eq(schema.smtpConfigs.label, "P2")))[0];
  await db.update(schema.smtpConfigs).set({ sentToday: 2 }).where(eq(schema.smtpConfigs.id, p2row.id));
  const limitPick = await pickSmtp();
  assert(limitPick!.role === "emergency", "when the only healthy primary hits its limit, failover to emergency");
  console.log(`   primary at limit → emergency pick: ${limitPick!.label}`);

  // Cleanup: remove test data.
  for (const e of await db.select().from(schema.smtpConfigs)) {
    await db.delete(schema.smtpConfigs).where(eq(schema.smtpConfigs.id, e.id));
  }
  await resetAllDailyLimits();
  console.log("\n=== All load-balancer tests passed ✅ ===\n");
  process.exit(0);
})().catch((e) => {
  console.error("Test error:", e);
  process.exit(1);
});
