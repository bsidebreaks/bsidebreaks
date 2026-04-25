import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import dotenv from "dotenv";

// The repo keeps `.env` in the parent folder, but `next dev` runs from `main/`.
// Load that file so NextAuth sees NEXTAUTH_SECRET, NEXTAUTH_URL, etc.
const configDir = path.dirname(fileURLToPath(import.meta.url));
const parentEnv = path.join(configDir, "..", ".env");
if (fs.existsSync(parentEnv)) {
  dotenv.config({ path: parentEnv, override: false });
}

// NextAuth resolves `req.origin` from X-Forwarded-* only if VERCEL or AUTH_TRUST_HOST
// is set; otherwise it always uses NEXTAUTH_URL (so production can redirect to
// http://localhost:3000/... and CSRF can fail, yielding /api/auth/signin?csrf=true).
if (process.env.AUTH_TRUST_HOST === undefined) {
  process.env.AUTH_TRUST_HOST = "1";
}

const nextConfig: NextConfig = {
  // Dev server accessed as torv.io (tunnel / host header) so HMR and auth work.
  allowedDevOrigins: ["torv.io", "*.torv.io"],
};

export default nextConfig;
