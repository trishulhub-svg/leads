// scripts/capture-walkthrough.mjs
// Captures a full product walkthrough: login → reset password → brand →
// templates edit/preview → leads import → CRM. Skips SMTP setup.
import puppeteer from "puppeteer-core";
import fs from "fs";
import path from "path";

const BASE = process.env.DEMO_BASE_URL || "http://localhost:3000";
const EMAIL = process.env.OWNER_EMAIL || "founder@example.com";
const PASSWORD = process.env.OWNER_PASSWORD || "SuperSecret123!";
const OUT = "/opt/cursor/artifacts/walkthrough-frames";
const CHROME =
  process.env.CHROME_PATH ||
  (fs.existsSync("/usr/bin/google-chrome-stable")
    ? "/usr/bin/google-chrome-stable"
    : "/usr/bin/google-chrome");

fs.mkdirSync(OUT, { recursive: true });
for (const f of fs.readdirSync(OUT)) {
  if (f.endsWith(".png")) fs.unlinkSync(path.join(OUT, f));
}

let step = 0;
async function shot(page, name) {
  step += 1;
  const file = path.join(OUT, `${String(step).padStart(2, "0")}-${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  console.log("shot", file);
  return file;
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function clickText(page, text, { exact = false } = {}) {
  const clicked = await page.evaluate(
    (t, exactMatch) => {
      const nodes = Array.from(document.querySelectorAll("button, a, [role='button']"));
      const el = nodes.find((n) => {
        const label = (n.textContent || "").replace(/\s+/g, " ").trim();
        return exactMatch ? label === t : label.includes(t);
      });
      if (!el) return false;
      el.scrollIntoView({ block: "center" });
      el.click();
      return true;
    },
    text,
    exact
  );
  if (!clicked) throw new Error(`clickText miss: ${text}`);
}

/** Fill React-controlled inputs reliably. */
async function setInput(page, selector, value) {
  await page.waitForSelector(selector, { visible: true });
  await page.$eval(
    selector,
    (el, v) => {
      const input = /** @type {HTMLInputElement|HTMLTextAreaElement} */ (el);
      const proto =
        input instanceof HTMLTextAreaElement
          ? HTMLTextAreaElement.prototype
          : HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
      input.focus();
      setter?.call(input, v);
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    },
    value
  );
}

async function waitHydrated(page) {
  await page.waitForFunction(
    () => {
      const btn = document.querySelector("button");
      return btn && Object.keys(btn).some((k) => k.startsWith("__react"));
    },
    { timeout: 20000 }
  );
}

async function login(page) {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle2" });
  await page.waitForSelector("#email");
  await waitHydrated(page);
  await setInput(page, "#email", EMAIL);
  await setInput(page, "#password", PASSWORD);
  await Promise.all([
    page.click('button[type="submit"]'),
    page.waitForNavigation({ waitUntil: "networkidle2" }),
  ]);
  await page.waitForFunction(() => !location.pathname.includes("/login"), { timeout: 15000 });
  await waitHydrated(page);
  await wait(600);
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
  // ── 1) Login ──────────────────────────────────────────────────────────
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle2" });
  await waitHydrated(page);
  await wait(500);
  await shot(page, "login-landing");
  await setInput(page, "#email", EMAIL);
  await setInput(page, "#password", PASSWORD);
  await wait(250);
  await shot(page, "login-filled");
  await Promise.all([
    page.click('button[type="submit"]'),
    page.waitForNavigation({ waitUntil: "networkidle2" }),
  ]);
  await waitHydrated(page);
  await wait(800);
  await shot(page, "dashboard");

  // ── 2) Reset password ─────────────────────────────────────────────────
  const client = await page.createCDPSession();
  await client.send("Network.clearBrowserCookies");
  await page.goto(`${BASE}/forgot-password`, { waitUntil: "networkidle2" });
  await waitHydrated(page);
  await wait(500);
  await shot(page, "forgot-password");
  await page.waitForSelector("#email, input[type='email']");
  const emailSel = (await page.$("#email")) ? "#email" : "input[type='email']";
  await setInput(page, emailSel, EMAIL);
  await wait(250);
  await shot(page, "forgot-password-filled");
  await page.click('button[type="submit"]');
  await wait(1600);
  await shot(page, "forgot-password-result");

  await login(page);
  await shot(page, "dashboard-after-login");

  // ── 3) Email brand + templates ────────────────────────────────────────
  await page.goto(`${BASE}/campaigns`, { waitUntil: "networkidle2" });
  await waitHydrated(page);
  await wait(700);
  await shot(page, "campaigns");

  await clickText(page, "Email templates");
  await page.waitForSelector("#brand-name", { visible: true, timeout: 15000 });
  await wait(700);
  await shot(page, "templates");

  await setInput(page, "#brand-name", "Trishulhub");
  await setInput(page, "#sender-name", "Growth Team");
  // Hex color sits next to the color picker (no id) — find mono input
  await page.evaluate(() => {
    const inputs = Array.from(document.querySelectorAll("input"));
    const hex = inputs.find(
      (i) =>
        i.type === "text" &&
        /^#[0-9a-fA-F]{3,8}$/.test(i.value || "") &&
        i.className.includes("font-mono")
    );
    if (!hex) return;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    hex.focus();
    setter?.call(hex, "#0f766e");
    hex.dispatchEvent(new Event("input", { bubbles: true }));
    hex.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await wait(400);
  await page.evaluate(() => window.scrollTo(0, 0));
  await shot(page, "brand-setup");

  await clickText(page, "Save brand");
  await wait(1200);
  await shot(page, "brand-saved");

  // Open first named template from the list
  const opened = await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll("button"));
    const t = buttons.find((b) =>
      /Cold Intro|Follow-up|Value Offer|Case Study/i.test(b.textContent || "")
    );
    if (!t) return false;
    t.scrollIntoView({ block: "center" });
    t.click();
    return (t.textContent || "").trim();
  });
  console.log("opened template", opened);
  await wait(900);
  await shot(page, "template-selected");

  await clickText(page, "Visual");
  await wait(600);
  if (await page.$("#tpl-headline")) {
    await setInput(page, "#tpl-headline", "A clearer way to grow outreach");
  }
  if (await page.$("#tpl-cta-label")) {
    await setInput(page, "#tpl-cta-label", "Book a quick call");
  }
  await wait(400);
  await shot(page, "template-visual");

  await clickText(page, "Preview");
  await wait(1000);
  await page.evaluate(() => window.scrollTo(0, 120));
  await wait(300);
  await shot(page, "template-preview");

  try {
    await clickText(page, "HTML");
    await wait(700);
    await shot(page, "template-html");
  } catch (e) {
    console.log("html tab skip", e.message);
  }

  await clickText(page, "Preview");
  await wait(800);
  await page.evaluate(() => window.scrollTo(0, 80));
  await shot(page, "template-preview-final");

  // ── 4) Leads import ───────────────────────────────────────────────────
  await page.goto(`${BASE}/leads`, { waitUntil: "networkidle2" });
  await waitHydrated(page);
  await wait(800);
  await shot(page, "leads");

  const csvPath = "/tmp/demo-leads.csv";
  fs.writeFileSync(
    csvPath,
    "Email Address,Full Name,Company Name,Niche\n" +
      "neha@brightclinic.in,Neha Kapoor,Bright Clinic,Healthcare\n" +
      "arjun@coastalads.com,Arjun Nair,Coastal Ads,Agencies\n" +
      "meera@softnest.io,Meera Iyer,SoftNest,SaaS\n"
  );

  if (await page.$("#import-niche")) {
    await setInput(page, "#import-niche", "Outreach");
  }
  await wait(200);
  await shot(page, "leads-import-ready");

  const fileInput = await page.$("#lead-file-import");
  if (fileInput) {
    await fileInput.uploadFile(csvPath);
    await wait(3200);
    await page.evaluate(() => window.scrollTo(0, 0));
    await shot(page, "leads-imported");
  }

  await page.evaluate(() => window.scrollTo(0, 480));
  await wait(500);
  await shot(page, "leads-directory");

  // ── 5) CRM ────────────────────────────────────────────────────────────
  await page.goto(`${BASE}/crm`, { waitUntil: "networkidle2" });
  await waitHydrated(page);
  await wait(1000);
  await shot(page, "crm");

  const openedCrm = await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll("button"));
    const open = buttons.find((b) => /^\s*Open\s*$/i.test((b.textContent || "").trim()));
    if (!open) return false;
    open.scrollIntoView({ block: "center" });
    open.click();
    return true;
  });
  console.log("opened crm card", openedCrm);
  await wait(1100);
  if (openedCrm) {
    await shot(page, "crm-drawer");
    await page.keyboard.press("Escape");
    await wait(400);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await wait(300);
  await shot(page, "crm-final");

  console.log("DONE frames:", step);
} catch (err) {
  console.error("CAPTURE ERROR:", err);
  await shot(page, "error-state").catch(() => {});
  process.exitCode = 1;
} finally {
  await browser.close();
}
