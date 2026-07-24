import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Security headers applied to every response. We intentionally avoid a strict
// script-src CSP (Next.js relies on inline/runtime scripts); frame-ancestors +
// the classic hardening headers give defense-in-depth without breaking the app.
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ["nodemailer", "imapflow", "mailparser"],
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  webpack: (config) => {
    // Map @/drizzle/* and @drizzle/* → ./drizzle/* so the schema (which lives
    // outside src/) is importable from app + lib code.
    config.resolve.alias["@/drizzle"] = path.resolve(__dirname, "drizzle");
    config.resolve.alias["@drizzle"] = path.resolve(__dirname, "drizzle");
    return config;
  },
};

export default nextConfig;
