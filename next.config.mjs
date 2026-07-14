import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // xlsx ships untranspiled ESM/CJS from node; allow Next to bundle it.
  serverExternalPackages: ["xlsx", "nodemailer", "imapflow", "mailparser"],
  webpack: (config) => {
    // Map @/drizzle/* and @drizzle/* → ./drizzle/* so the schema (which lives
    // outside src/) is importable from app + lib code.
    config.resolve.alias["@/drizzle"] = path.resolve(__dirname, "drizzle");
    config.resolve.alias["@drizzle"] = path.resolve(__dirname, "drizzle");
    return config;
  },
};

export default nextConfig;
