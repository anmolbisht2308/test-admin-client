import type { NextConfig } from "next";
import { z } from "zod";

/** Server-only api base URL. Browsers never see it: they call same-origin /api/*. */
function apiOrigin(): string {
  const parsed = z.url().safeParse(process.env.API_ORIGIN);
  if (!parsed.success) {
    throw new Error(
      "API_ORIGIN must be the api base URL, e.g. http://localhost:4000 (see .env.example)",
    );
  }
  return parsed.data.replace(/\/$/, "");
}

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // packages/ui and packages/api-client ship TypeScript source; Next compiles them.
  transpilePackages: ["@mockprep/ui", "@mockprep/api-client"],
  // Proxy /api/* to the api so auth cookies are first-party (same site as this app).
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${apiOrigin()}/api/:path*` }];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
    ];
  },
};

export default nextConfig;
