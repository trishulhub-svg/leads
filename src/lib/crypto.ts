// src/lib/crypto.ts
// AES-256-GCM encryption for SMTP/IMAP passwords stored in the DB.
// The key is derived (SHA-256) from AUTH_SECRET so nothing extra needs configuring.
import { webcrypto } from "node:crypto";

const subtle = webcrypto.subtle;

async function rawKey(): Promise<CryptoKey> {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("AUTH_SECRET is required (min 32 chars) to encrypt SMTP credentials.");
  }
  const hash = await subtle.digest("SHA-256", new TextEncoder().encode(secret));
  return subtle.importKey("raw", hash, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

const toHex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
const fromHex = (h: string) => {
  const out = new Uint8Array(h.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(h.substr(i * 2, 2), 16);
  return out;
};

/** Encrypt a plaintext string → "v1:<iv-hex>:<ciphertext-hex>". */
export async function encrypt(plain: string): Promise<string> {
  const key = await rawKey();
  const iv = webcrypto.getRandomValues(new Uint8Array(12));
  const ct = await subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(plain));
  return `v1:${toHex(iv)}:${toHex(new Uint8Array(ct))}`;
}

/** Decrypt a value produced by encrypt(). Returns "" if input is empty. */
export async function decrypt(enc: string): Promise<string> {
  if (!enc) return "";
  if (!enc.startsWith("v1:")) {
    // Legacy/unencrypted value — return as-is for migration tolerance.
    return enc;
  }
  const [, ivHex, ctHex] = enc.split(":");
  const key = await rawKey();
  const pt = await subtle.decrypt(
    { name: "AES-GCM", iv: fromHex(ivHex) },
    key,
    fromHex(ctHex)
  );
  return new TextDecoder().decode(pt);
}
