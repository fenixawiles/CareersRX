import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3", "pdf-parse", "pdfjs-dist"],
  // Pin the workspace root so Next doesn't pick a parent-directory lockfile.
  turbopack: {
    root: path.join(__dirname),
  },
  // Security headers (CSP nonce hardening deferred to a later phase).
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
  async redirects() {
    return [
      { source: "/demo", destination: "/register", permanent: true },
      { source: "/demo/live-resume", destination: "/dashboard/seeker/resume", permanent: true },
      { source: "/demo/live-resume/signup", destination: "/register/seeker", permanent: true },
      { source: "/demo/profile", destination: "/dashboard/seeker/profile", permanent: true },
    ];
  },
};

export default nextConfig;
