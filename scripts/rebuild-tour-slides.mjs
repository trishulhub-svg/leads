// scripts/rebuild-tour-slides.mjs
// Clean end-to-end capture: each slide saved with a descriptive name,
// then verified by page URL / visible title before writing.
import puppeteer from "puppeteer-core";
import fs from "fs";
import path from "path";
import { execSync } from "child_process";

const BASE = process.env.DEMO_BASE_URL || "http://localhost:3000";
const EMAIL = process.env.OWNER_EMAIL || "founder@example.com";
const PASSWORD = process.env.OWNER_PASSWORD || "SuperSecret123!";
const RAW = "/opt/cursor/artifacts/tour-rebuild-raw";
const OUT = path.join(process.cwd(), "public/tour/slides");
const CHROME = fs.existsSync("/usr/bin/google-chrome-stable")
  ? "/usr/bin/google-chrome-stable"
  : "/usr/bin/google-chrome";

fs.mkdirSync(RAW, { recursive: true });
fs.mkdirSync(OUT, { recursive: true });
for (const f of fs.readdirSync(OUT)) {
  if (/\.(jpg|jpeg|png)$/i.test(f)) fs.unlinkSync(path.join(OUT, f));
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function setInput(page, selector, value) {
  await page.waitForSelector(selector, { visible: true, timeout: 15000 });
  await page.$eval(
    selector,
    (el, v) => {
      const proto =
        el instanceof HTMLTextAreaElement
          ? HTMLTextAreaElement.prototype
          : HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
      el.focus();
      setter?.call(el, v);
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    },
    value
  );
}

async function clickText(page, text) {
  const ok = await page.evaluate((t) => {
    const nodes = Array.from(document.querySelectorAll("button, a, [role='button']"));
    const el = nodes.find((n) => (n.textContent || "").replace(/\s+/g, " ").trim().includes(t));
    if (!el) return false;
    el.scrollIntoView({ block: "center" });
    el.click();
    return true;
  }, text);
  if (!ok) throw new Error(`click miss: ${text}`);
}

async function waitHydrated(page) {
  await page.waitForFunction(
    () => {
      const btn = document.querySelector("button");
      return btn && Object.keys(btn).some((k) => k.startsWith("__react"));
    },
    { timeout: 25000 }
  );
}

async function assertPath(page, needle) {
  const pathName = await page.evaluate(() => location.pathname);
  if (!pathName.includes(needle)) {
    throw new Error(`Expected path containing ${needle}, got ${pathName}`);
  }
}

async function assertText(page, needle) {
  const ok = await page.evaluate((t) => {
    return document.body.innerText.toLowerCase().includes(String(t).toLowerCase());
  }, needle);
  if (!ok) throw new Error(`Expected page text: ${needle}`);
}

async function shot(page, name) {
  const png = path.join(RAW, `${name}.png`);
  await page.screenshot({ path: png, fullPage: false });
  const jpg = path.join(OUT, `${name}.jpg`);
  execSync(`ffmpeg -y -i "${png}" -vf "scale='min(1200,iw)':-2" -q:v 5 "${jpg}"`, {
    stdio: "ignore",
  });
  console.log("OK", name, Math.round(fs.statSync(jpg).size / 1024) + "KB");
  return name;
}

async function login(page) {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle2" });
  await waitHydrated(page);
  await setInput(page, "#email", EMAIL);
  await setInput(page, "#password", PASSWORD);
  await Promise.all([
    page.click('button[type="submit"]'),
    page.waitForNavigation({ waitUntil: "networkidle2" }),
  ]);
  await waitHydrated(page);
  await wait(500);
}

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: "new",
  args: ["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage", "--window-size=1440,900"],
  defaultViewport: { width: 1440, height: 900, deviceScaleFactor: 1 },
});
const page = await browser.newPage();
page.setDefaultTimeout(60000);

try {
  // ── Access ────────────────────────────────────────────────────────────
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle2" });
  await waitHydrated(page);
  await wait(400);
  await assertPath(page, "/login");
  await assertText(page, "Sign In");
  await shot(page, "01-login");

  await setInput(page, "#email", EMAIL);
  await setInput(page, "#password", PASSWORD);
  await wait(250);
  await shot(page, "02-login-filled");

  await Promise.all([
    page.click('button[type="submit"]'),
    page.waitForNavigation({ waitUntil: "networkidle2" }),
  ]);
  await waitHydrated(page);
  await wait(700);
  await assertText(page, "Good to see you");
  await shot(page, "03-dashboard");

  // ── Reset password ────────────────────────────────────────────────────
  const client = await page.createCDPSession();
  await client.send("Network.clearBrowserCookies");
  await page.goto(`${BASE}/forgot-password`, { waitUntil: "networkidle2" });
  await waitHydrated(page);
  await wait(400);
  await assertPath(page, "/forgot-password");
  await assertText(page, "Reset your password");
  await shot(page, "04-forgot-password");

  await setInput(page, "#email", EMAIL);
  await wait(200);
  await shot(page, "05-forgot-filled");

  // ── Re-login ──────────────────────────────────────────────────────────
  await login(page);

  // ── Campaigns / brand / templates ─────────────────────────────────────
  await page.goto(`${BASE}/campaigns`, { waitUntil: "networkidle2" });
  await waitHydrated(page);
  await wait(700);
  await assertPath(page, "/campaigns");
  await assertText(page, "Campaign control room");
  await shot(page, "06-campaigns");

  await clickText(page, "Email templates");
  await page.waitForSelector("#brand-name", { visible: true });
  await wait(800);
  await assertText(page, "Your email brand");
  await shot(page, "07-email-templates-tab");

  await setInput(page, "#brand-name", "Trishulhub");
  await setInput(page, "#sender-name", "Growth Team");
  await page.evaluate(() => {
    const inputs = Array.from(document.querySelectorAll("input"));
    const hex = inputs.find(
      (i) => i.type === "text" && /^#[0-9a-fA-F]{3,8}$/.test(i.value || "") && i.className.includes("font-mono")
    );
    if (!hex) return;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    hex.focus();
    setter?.call(hex, "#0f766e");
    hex.dispatchEvent(new Event("input", { bubbles: true }));
    hex.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await page.evaluate(() => window.scrollTo(0, 0));
  await wait(400);
  await assertText(page, "Brand name");
  await shot(page, "08-brand-setup");

  await clickText(page, "Save brand");
  await wait(1200);
  await shot(page, "09-brand-saved");

  // Pick Cold Intro template
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll("button"));
    const t = buttons.find((b) => /Cold Intro/i.test(b.textContent || ""));
    t?.scrollIntoView({ block: "center" });
    t?.click();
  });
  await wait(800);
  await assertText(page, "Cold Intro");
  await shot(page, "10-template-selected");

  await clickText(page, "Visual");
  await wait(500);
  if (await page.$("#tpl-headline")) {
    await setInput(page, "#tpl-headline", "A clearer way to grow outreach");
  }
  if (await page.$("#tpl-cta-label")) {
    await setInput(page, "#tpl-cta-label", "Book a quick call");
  }
  await page.evaluate(() => {
    document.querySelector("#tpl-name")?.scrollIntoView({ block: "start" });
  });
  await wait(400);
  await assertText(page, "Subject line");
  await shot(page, "11-template-visual-fields");

  await page.evaluate(() => {
    document.querySelector("#tpl-body")?.scrollIntoView({ block: "center" });
  });
  await wait(400);
  await assertText(page, "{{first_name}}");
  await shot(page, "12-template-message-tags");

  await page.evaluate(() => {
    document.querySelector("#tpl-cta-label")?.scrollIntoView({ block: "center" });
  });
  await wait(400);
  await assertText(page, "Button text");
  await shot(page, "13-template-cta");

  await clickText(page, "Preview");
  await wait(1000);
  await page.evaluate(() => window.scrollTo(0, 180));
  await wait(400);
  await assertText(page, "Subject");
  await shot(page, "14-template-preview");

  await clickText(page, "HTML");
  await wait(700);
  await page.evaluate(() => window.scrollTo(0, 160));
  await wait(300);
  await assertText(page, "HTML body");
  await shot(page, "15-template-html");

  // ── Leads ─────────────────────────────────────────────────────────────
  await page.goto(`${BASE}/leads`, { waitUntil: "networkidle2" });
  await waitHydrated(page);
  await wait(800);
  await assertPath(page, "/leads");
  await assertText(page, "Smart lead importer");
  // Ensure sidebar shows Leads active — not Campaigns as main view
  const leadsOk = await page.evaluate(() => {
    const active = document.querySelector('a[aria-current="page"]');
    return (active?.textContent || "").includes("Leads");
  });
  if (!leadsOk) throw new Error("Leads nav not active on /leads");
  await page.evaluate(() => window.scrollTo(0, 0));
  await wait(300);
  await shot(page, "16-leads-importer");

  const csvPath = "/tmp/tour-leads-fresh.csv";
  const stamp = Date.now();
  fs.writeFileSync(
    csvPath,
    "Email Address,Full Name,Company Name,Niche\n" +
      `tour${stamp}a@brightclinic.in,Neha Kapoor,Bright Clinic,Healthcare\n` +
      `tour${stamp}b@coastalads.com,Arjun Nair,Coastal Ads,Agencies\n` +
      `tour${stamp}c@softnest.io,Meera Iyer,SoftNest,SaaS\n`
  );
  if (await page.$("#import-niche")) await setInput(page, "#import-niche", "Outreach");
  const fileInput = await page.$("#lead-file-import");
  if (!fileInput) throw new Error("Missing #lead-file-import");
  await fileInput.uploadFile(csvPath);
  await wait(3500);
  await assertText(page, "Import results");
  await page.evaluate(() => window.scrollTo(0, 0));
  await wait(300);
  await shot(page, "17-leads-import-results");

  await page.evaluate(() => window.scrollTo(0, 520));
  await wait(500);
  await assertText(page, "Lead directory");
  await shot(page, "18-leads-directory");

  // ── CRM ───────────────────────────────────────────────────────────────
  await page.goto(`${BASE}/crm`, { waitUntil: "networkidle2" });
  await waitHydrated(page);
  await wait(1000);
  await assertPath(page, "/crm");
  await assertText(page, "CRM");
  const crmOk = await page.evaluate(() => {
    const active = document.querySelector('a[aria-current="page"]');
    return (active?.textContent || "").includes("CRM");
  });
  if (!crmOk) throw new Error("CRM nav not active on /crm");
  await page.evaluate(() => window.scrollTo(0, 0));
  await wait(300);
  await shot(page, "19-crm-board");

  const opened = await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll("button"));
    const open = buttons.find((b) => /^\s*Open\s*$/i.test((b.textContent || "").trim()));
    if (!open) return false;
    open.scrollIntoView({ block: "center" });
    open.click();
    return true;
  });
  if (!opened) throw new Error("No Open button on CRM board");
  await wait(1200);
  await assertText(page, "Save changes");
  // Drawer should show lead details, not campaigns
  const drawerOk = await page.evaluate(() => {
    const text = document.body.innerText;
    return (
      text.includes("Notes") &&
      (text.includes("Priority") || text.includes("PREMIUM")) &&
      !text.includes("Create campaign")
    );
  });
  if (!drawerOk) throw new Error("CRM drawer content unexpected");
  await shot(page, "20-crm-drawer");

  // ── Settings account ──────────────────────────────────────────────────
  await page.goto(`${BASE}/settings`, { waitUntil: "networkidle2" });
  await waitHydrated(page);
  await wait(700);
  await assertPath(page, "/settings");
  await page.evaluate(() => {
    const h = Array.from(document.querySelectorAll("h2,h3")).find((n) =>
      /Account security|Change login email|Change password/i.test(n.textContent || "")
    );
    h?.scrollIntoView({ block: "start" });
  });
  await wait(500);
  await assertText(page, "Account security");
  await shot(page, "21-settings-account");

  console.log("ALL SLIDES CAPTURED");
  console.log(execSync(`du -sh "${OUT}"`).toString().trim());
  console.log(fs.readdirSync(OUT).sort().join("\n"));
} catch (err) {
  console.error("CAPTURE FAILED:", err);
  process.exitCode = 1;
} finally {
  await browser.close();
}
