import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@electric-sql/pglite"],
  // The PGlite migrator reads ./drizzle/meta/_journal.json (and the SQL files)
  // at runtime. Next only bundles files it can statically trace, and it can't
  // see this runtime read, so on serverless the migrations are missing and
  // migrate() throws "Can't find meta/_journal.json". Force them into every
  // server trace. Only matters when POSTGRES_URL is unset (PGlite fallback,
  // e.g. preview deploys); prod uses postgres-js and never migrates at runtime.
  outputFileTracingIncludes: {
    "/*": ["./drizzle/**/*"],
  },
  // Dev only: allow hitting the dev server from other devices on the LAN
  // (phone testing). Without this Next blocks /_next/* — including the HMR
  // websocket — for any origin other than localhost.
  allowedDevOrigins: ["192.168.1.*"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.igdb.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "static-cdn.jtvnw.net",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
