// scripts/test-auth.ts
// Quick smoke test: verify login() succeeds with seeded credentials.
import "dotenv/config";
import { verifyCredentials } from "../src/lib/auth";

(async () => {
  console.log("[test] attempting login with seeded creds…");
  const r = await verifyCredentials("founder@example.com", "ChangeMe123!");
  console.log("[test] result:", JSON.stringify(r));

  console.log("[test] attempting login with WRONG password…");
  const r2 = await verifyCredentials("founder@example.com", "wrong-password");
  console.log("[test] result:", JSON.stringify(r2));

  console.log("[test] attempting login with UNKNOWN email…");
  const r3 = await verifyCredentials("nobody@example.com", "ChangeMe123!");
  console.log("[test] result:", JSON.stringify(r3));

  process.exit(0);
})().catch((e) => {
  console.error("[test] failed:", e);
  process.exit(1);
});
