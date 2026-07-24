// src/lib/brand.ts
// Workspace brand used in email templates (name, logo, colors, sender).
import { getSettingJson, setSettingJson } from "./settings";
import { appBaseUrl } from "./unsubscribe";

export const BRAND_SETTING_KEY = "brand_config";

export type BrandConfig = {
  brandName: string;
  senderName: string;
  accentColor: string;
  /** raw base64 without data: prefix */
  logoBase64: string | null;
  logoMime: string | null;
};

export type PublicBrand = {
  brandName: string;
  senderName: string;
  accentColor: string;
  hasLogo: boolean;
  logoUrl: string | null;
};

const DEFAULTS: BrandConfig = {
  brandName: "Your Brand",
  senderName: "Your Team",
  accentColor: "#1d4ed8",
  logoBase64: null,
  logoMime: null,
};

export async function getBrandConfig(): Promise<BrandConfig> {
  const stored = await getSettingJson<Partial<BrandConfig>>(BRAND_SETTING_KEY);
  return {
    ...DEFAULTS,
    ...stored,
    brandName: (stored?.brandName || DEFAULTS.brandName).trim() || DEFAULTS.brandName,
    senderName: (stored?.senderName || DEFAULTS.senderName).trim() || DEFAULTS.senderName,
    accentColor: normalizeColor(stored?.accentColor || DEFAULTS.accentColor),
    logoBase64: stored?.logoBase64 || null,
    logoMime: stored?.logoMime || null,
  };
}

export async function getPublicBrand(): Promise<PublicBrand> {
  const brand = await getBrandConfig();
  const base = appBaseUrl();
  const hasLogo = Boolean(brand.logoBase64 && brand.logoMime);
  return {
    brandName: brand.brandName,
    senderName: brand.senderName,
    accentColor: brand.accentColor,
    hasLogo,
    logoUrl: hasLogo && base ? `${base}/api/brand/logo` : hasLogo ? "/api/brand/logo" : null,
  };
}

export async function saveBrandConfig(input: {
  brandName?: string;
  senderName?: string;
  accentColor?: string;
  logoBase64?: string | null;
  logoMime?: string | null;
  clearLogo?: boolean;
}): Promise<PublicBrand> {
  const current = await getBrandConfig();
  const next: BrandConfig = {
    brandName: cleanName(input.brandName ?? current.brandName, DEFAULTS.brandName),
    senderName: cleanName(input.senderName ?? current.senderName, DEFAULTS.senderName),
    accentColor: normalizeColor(input.accentColor ?? current.accentColor),
    logoBase64: current.logoBase64,
    logoMime: current.logoMime,
  };

  if (input.clearLogo) {
    next.logoBase64 = null;
    next.logoMime = null;
  } else if (input.logoBase64 !== undefined) {
    if (input.logoBase64 === null) {
      next.logoBase64 = null;
      next.logoMime = null;
    } else {
      validateLogo(input.logoBase64, input.logoMime || "image/png");
      next.logoBase64 = input.logoBase64;
      next.logoMime = input.logoMime || "image/png";
    }
  }

  await setSettingJson(BRAND_SETTING_KEY, next);
  return getPublicBrand();
}

function cleanName(value: string, fallback: string): string {
  const trimmed = value.trim().slice(0, 80);
  return trimmed || fallback;
}

function normalizeColor(value: string): string {
  const v = value.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(v)) return v.toLowerCase();
  if (/^#[0-9a-fA-F]{3}$/.test(v)) {
    const [r, g, b] = v.slice(1);
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  return DEFAULTS.accentColor;
}

const MAX_LOGO_BYTES = 400_000; // ~400KB raw

function validateLogo(base64: string, mime: string) {
  if (!["image/png", "image/jpeg", "image/webp", "image/gif"].includes(mime)) {
    throw new Error("Logo must be PNG, JPG, WEBP, or GIF.");
  }
  const approxBytes = Math.floor((base64.length * 3) / 4);
  if (approxBytes > MAX_LOGO_BYTES) {
    throw new Error("Logo is too large. Please upload an image under 400KB.");
  }
  // Verify the actual bytes match the declared type (magic-number sniff), so a
  // mismatched/spoofed content-type can't be stored and served back.
  let head: Buffer;
  try {
    head = Buffer.from(base64.slice(0, 32), "base64");
  } catch {
    throw new Error("Logo image is not valid.");
  }
  if (!magicMatches(head, mime)) {
    throw new Error("Logo file contents do not match its type. Upload a real PNG, JPG, WEBP, or GIF.");
  }
}

function magicMatches(head: Buffer, mime: string): boolean {
  const startsWith = (bytes: number[]) => bytes.every((b, i) => head[i] === b);
  switch (mime) {
    case "image/png":
      return startsWith([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    case "image/jpeg":
      return startsWith([0xff, 0xd8, 0xff]);
    case "image/gif":
      return startsWith([0x47, 0x49, 0x46, 0x38]); // GIF8
    case "image/webp":
      // RIFF....WEBP
      return startsWith([0x52, 0x49, 0x46, 0x46]) && head.slice(8, 12).toString("ascii") === "WEBP";
    default:
      return false;
  }
}
