// src/lib/crypto.ts
// AES-256-GCM encryption for SMTP/IMAP passwords + AI keys stored in the DB.
//
// Key management:
//   - Prefer a dedicated ENCRYPTION_KEY (independent from AUTH_SECRET) so that
//     rotating the session-signing secret never makes stored credentials
//     undecryptable, and a leaked AUTH_SECRET does not also expose credentials.
//   - For backward compatibility (existing installs that only set AUTH_SECRET),
//     decryption transparently falls back to a key derived from AUTH_SECRET.
import { webcrypto } from "node:crypto";

const subtle = webcrypto.subtle;

async function deriveKey(secret: string): Promise<CryptoKey> {
  const hash = await subtle.digest("SHA-256", new TextEncoder().encode(secret));
  return subtle.importKey("raw", hash, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

/** The primary key used for NEW encryptions (ENCRYPTION_KEY, else AUTH_SECRET). */
async function primaryKey(): Promise<CryptoKey> {
  const dedicated = process.env.ENCRYPTION_KEY;
  if (dedicated && dedicated.trim().length >= 32) {
    return deriveKey(dedicated.trim());
  }
  const auth = process.env.AUTH_SECRET;
  if (auth && auth.trim().length >= 32) {
    return deriveKey(auth.trim());
  }
  throw new Error(
    "ENCRYPTION_KEY (preferred) or AUTH_SECRET must be set (min 32 chars) to encrypt credentials."
  );
}

/** Candidate keys for DECRYPTION, in priority order (primary + AUTH_SECRET fallback). */
async function decryptionKeys(): Promise<CryptoKey[]> {
  const keys: CryptoKey[] = [];
  const dedicated = process.env.ENCRYPTION_KEY;
  const auth = process.env.AUTH_SECRET;
  if (dedicated && dedicated.trim().length >= 32) keys.push(await deriveKey(dedicated.trim()));
  // Always try AUTH_SECRET too, so values encrypted before ENCRYPTION_KEY existed still open.
  if (auth && auth.trim().length >= 32) keys.push(await deriveKey(auth.trim()));
  if (keys.length === 0) {
    throw new Error("ENCRYPTION_KEY or AUTH_SECRET must be set (min 32 chars) to decrypt credentials.");
  }
  return keys;
}

const toHex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
const fromHex = (h: string) => {
  const out = new Uint8Array(h.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(h.substr(i * 2, 2), 16);
  return out;
};

/** Encrypt a plaintext string → "v1:<iv-hex>:<ciphertext-hex>". */
export async function encrypt(plain: string): Promise<string> {
  const key = await primaryKey();
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
  const iv = fromHex(ivHex);
  const ct = fromHex(ctHex);
  const keys = await decryptionKeys();
  let lastErr: unknown;
  for (const key of keys) {
    try {
      const pt = await subtle.decrypt({ name: "AES-GCM", iv }, key, ct);
      return new TextDecoder().decode(pt);
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("Failed to decrypt stored credential.");
}
