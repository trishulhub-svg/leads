// scripts/capture-detailed-tour.mjs
// Captures focused screenshots for a detailed product tour.
import puppeteer from "puppeteer-core";
import fs from "fs";
import path from "path";
import { execSync } from "child_process";

const BASE = process.env.DEMO_BASE_URL || "http://localhost:3000";
const EMAIL = process.env.OWNER_EMAIL || "founder@example.com";
const PASSWORD = process.env.OWNER_PASSWORD || "SuperSecret123!";
const RAW = "/opt/cursor/artifacts/tour-raw";
const OUT = path.join(process.cwd(), "public/tour/slides");
const CHROME = fs.existsSync("/usr/bin/google-chrome-stable")
  ? "/usr/bin/google-chrome-stable"
  : "/usr/bin/google-chrome";

fs.mkdirSync(RAW, { recursive: true });
fs.mkdirSync(OUT, { recursive: true });

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function setInput(page, selector, value) {
  await page.waitForSelector(selector, { visible: true });
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
    { timeout: 20000 }
  );
}

async function shot(page, name, clip) {
  const file = path.join(RAW, `${name}.png`);
  if (clip) {
    await page.screenshot({ path: file, clip });
  } else {
    await page.screenshot({ path: file, fullPage: false });
  }
  console.log("raw", file);
  return file;
}

async function clipEl(page, selector, pad = 8) {
  const box = await page.$eval(selector, (el, pad) => {
    const r = el.getBoundingClientRect();
    return {
      x: Math.max(0, r.x - pad),
      y: Math.max(0, r.y - pad),
      width: Math.min(window.innerWidth - Math.max(0, r.x - pad), r.width + pad * 2),
      height: Math.min(window.innerHeight - Math.max(0, r.y - pad), r.height + pad * 2),
    };
  }, pad);
  return box;
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
  // Login
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle2" });
  await waitHydrated(page);
  await wait(400);
  await shot(page, "01-login");
  await setInput(page, "#email", EMAIL);
  await setInput(page, "#password", PASSWORD);
  await wait(200);
  await shot(page, "02-login-filled");
  await Promise.all([
    page.click('button[type="submit"]'),
    page.waitForNavigation({ waitUntil: "networkidle2" }),
  ]);
  await waitHydrated(page);
  await wait(600);
  await shot(page, "03-dashboard");

  // Forgot password
  const client = await page.createCDPSession();
  await client.send("Network.clearBrowserCookies");
  await page.goto(`${BASE}/forgot-password`, { waitUntil: "networkidle2" });
  await waitHydrated(page);
  await wait(400);
  await shot(page, "04-forgot");
  await setInput(page, "#email", EMAIL);
  await wait(200);
  await shot(page, "05-forgot-filled");

  // Re-login for authenticated shots
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle2" });
  await waitHydrated(page);
  await setInput(page, "#email", EMAIL);
  await setInput(page, "#password", PASSWORD);
  await Promise.all([
    page.click('button[type="submit"]'),
    page.waitForNavigation({ waitUntil: "networkidle2" }),
  ]);
  await waitHydrated(page);

  // Campaigns → templates
  await page.goto(`${BASE}/campaigns`, { waitUntil: "networkidle2" });
  await waitHydrated(page);
  await wait(500);
  await shot(page, "06-campaigns");
  await clickText(page, "Email templates");
  await page.waitForSelector("#brand-name", { visible: true });
  await wait(700);
  await shot(page, "07-templates-tab");

  // Brand section — fill + crop tightly
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
  await wait(300);
  await page.evaluate(() => {
    const h = Array.from(document.querySelectorAll("h3")).find((n) =>
      (n.textContent || "").includes("Your email brand")
    );
    h?.closest("div.rounded-xl")?.scrollIntoView({ block: "start" });
  });
  await wait(300);
  // Crop brand card
  const brandBox = await page.evaluate(() => {
    const h = Array.from(document.querySelectorAll("h3")).find((n) =>
      (n.textContent || "").includes("Your email brand")
    );
    const card = h?.closest("div.rounded-xl");
    if (!card) return null;
    const r = card.getBoundingClientRect();
    return { x: Math.max(0, r.x - 6), y: Math.max(0, r.y - 6), width: Math.min(r.width + 12, window.innerWidth), height: Math.min(r.height + 12, window.innerHeight - Math.max(0, r.y - 6)) };
  });
  if (brandBox) await shot(page, "08-brand-card", brandBox);
  await shot(page, "09-brand-full");
  await clickText(page, "Save brand");
  await wait(1000);
  await shot(page, "10-brand-saved");

  // Open template
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll("button"));
    const t = buttons.find((b) => /Cold Intro/i.test(b.textContent || ""));
    t?.click();
  });
  await wait(700);
  await shot(page, "11-template-list");

  // Visual editor — scroll editor into view and crop
  await clickText(page, "Visual");
  await wait(400);
  if (await page.$("#tpl-headline")) {
    await setInput(page, "#tpl-headline", "A clearer way to grow outreach");
  }
  if (await page.$("#tpl-cta-label")) {
    await setInput(page, "#tpl-cta-label", "Book a quick call");
  }
  await wait(300);

  // Crop top of editor (name/subject/headline)
  await page.evaluate(() => {
    const el = document.querySelector("#tpl-name")?.closest("div.min-w-0");
    el?.scrollIntoView({ block: "start" });
  });
  await wait(300);
  const editorTop = await page.evaluate(() => {
    const card = document.querySelector("#tpl-name")?.closest("div.min-w-0.space-y-4");
    if (!card) return null;
    const r = card.getBoundingClientRect();
    return {
      x: Math.max(0, r.x - 4),
      y: Math.max(0, r.y - 4),
      width: Math.min(r.width + 8, window.innerWidth - Math.max(0, r.x - 4)),
      height: Math.min(520, window.innerHeight - Math.max(0, r.y - 4)),
    };
  });
  if (editorTop) await shot(page, "12-visual-top", editorTop);
  await shot(page, "13-visual-full");

  // Scroll to message + merge chips + CTA
  await page.evaluate(() => document.querySelector("#tpl-body")?.scrollIntoView({ block: "center" }));
  await wait(300);
  const bodyBox = await page.evaluate(() => {
    const body = document.querySelector("#tpl-body");
    const cta = document.querySelector("#tpl-cta-label");
    if (!body) return null;
    const top = body.parentElement?.getBoundingClientRect() || body.getBoundingClientRect();
    const bottom = cta?.closest("div.grid")?.getBoundingClientRect() || top;
    const y = Math.max(0, top.y - 12);
    const endY = Math.min(window.innerHeight, Math.max(top.bottom, bottom.bottom) + 12);
    const x = Math.max(0, top.x - 12);
    return {
      x,
      y,
      width: Math.min(window.innerWidth - x - 8, Math.max(top.width, bottom.width || 0) + 24),
      height: Math.max(120, endY - y),
    };
  });
  if (bodyBox && bodyBox.height > 80) await shot(page, "14-visual-body-cta", bodyBox);

  // Preview
  await clickText(page, "Preview");
  await wait(900);
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll("button")).find((b) =>
      (b.textContent || "").includes("Preview")
    );
    btn?.closest("div.min-w-0")?.scrollIntoView({ block: "start" });
  });
  await wait(400);
  const previewBox = await page.evaluate(() => {
    const card = Array.from(document.querySelectorAll("button"))
      .find((b) => (b.textContent || "").includes("Preview") && b.getAttribute("aria-pressed") === "true")
      ?.closest("div.min-w-0.space-y-4");
    if (!card) return null;
    const r = card.getBoundingClientRect();
    return {
      x: Math.max(0, r.x - 4),
      y: Math.max(0, r.y - 4),
      width: Math.min(r.width + 8, window.innerWidth - Math.max(0, r.x - 4)),
      height: Math.min(560, window.innerHeight - Math.max(0, r.y - 4)),
    };
  });
  if (previewBox) await shot(page, "15-preview-editor", previewBox);
  await shot(page, "16-preview-full");

  // HTML tab
  await clickText(page, "HTML");
  await wait(600);
  await shot(page, "17-html");

  // Leads
  await page.goto(`${BASE}/leads`, { waitUntil: "networkidle2" });
  await waitHydrated(page);
  await wait(600);
  await shot(page, "18-leads");
  const csvPath = "/tmp/demo-leads-tour.csv";
  fs.writeFileSync(
    csvPath,
    "Email Address,Full Name,Company Name,Niche\n" +
      "neha@brightclinic.in,Neha Kapoor,Bright Clinic,Healthcare\n" +
      "arjun@coastalads.com,Arjun Nair,Coastal Ads,Agencies\n"
  );
  if (await page.$("#import-niche")) await setInput(page, "#import-niche", "Outreach");
  const fileInput = await page.$("#lead-file-import");
  if (fileInput) {
    await fileInput.uploadFile(csvPath);
    await wait(2800);
  }
  await shot(page, "19-leads-imported");
  await page.evaluate(() => window.scrollTo(0, 420));
  await wait(400);
  await shot(page, "20-leads-directory");

  // CRM
  await page.goto(`${BASE}/crm`, { waitUntil: "networkidle2" });
  await waitHydrated(page);
  await wait(900);
  await shot(page, "21-crm");
  await page.evaluate(() => {
    const open = Array.from(document.querySelectorAll("button")).find((b) =>
      /^\s*Open\s*$/i.test((b.textContent || "").trim())
    );
    open?.click();
  });
  await wait(1000);
  await shot(page, "22-crm-drawer");

  // Settings email change area
  await page.goto(`${BASE}/settings`, { waitUntil: "networkidle2" });
  await waitHydrated(page);
  await wait(600);
  await page.evaluate(() => {
    const h = Array.from(document.querySelectorAll("h2,h3")).find((n) =>
      /Account security|Change login email/i.test(n.textContent || "")
    );
    h?.scrollIntoView({ block: "start" });
  });
  await wait(400);
  await shot(page, "23-settings-account");

  console.log("RAW DONE");
} catch (err) {
  console.error(err);
  process.exitCode = 1;
} finally {
  await browser.close();
}

// Compress selected frames into public/tour/slides
const map = {
  "01": "01-login.png",
  "02": "02-login-filled.png",
  "03": "04-forgot.png",
  "04": "05-forgot-filled.png",
  "05": "06-campaigns.png",
  "06": "07-templates-tab.png",
  "07": "08-brand-card.png",
  "08": "09-brand-full.png",
  "09": "10-brand-saved.png",
  "10": "11-template-list.png",
  "11": "12-visual-top.png",
  "12": "14-visual-body-cta.png",
  "13": "13-visual-full.png",
  "14": "15-preview-editor.png",
  "15": "16-preview-full.png",
  "16": "17-html.png",
  "17": "18-leads.png",
  "18": "19-leads-imported.png",
  "19": "21-crm.png",
  "20": "22-crm-drawer.png",
  "21": "23-settings-account.png",
};

for (const f of fs.readdirSync(OUT)) {
  if (f.endsWith(".jpg") || f.endsWith(".png")) fs.unlinkSync(path.join(OUT, f));
}

for (const [num, srcName] of Object.entries(map)) {
  const src = path.join(RAW, srcName);
  if (!fs.existsSync(src)) {
    console.warn("missing", src);
    continue;
  }
  const dest = path.join(OUT, `step-${num}.jpg`);
  execSync(
    `ffmpeg -y -i "${src}" -vf "scale='min(1100,iw)':-2" -q:v 6 "${dest}"`,
    { stdio: "ignore" }
  );
  console.log("slide", dest, fs.statSync(dest).size);
}

console.log("TOTAL", execSync(`du -sh "${OUT}"`).toString().trim());
