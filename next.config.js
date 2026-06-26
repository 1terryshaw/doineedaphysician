/** @type {import('next').NextConfig} */
// US-state quarantine removed 2026-05-12 (empire site-flip sweep).
// US state slugs (/tx, /ca, ...) resolve through the dynamic [region] route
// via lib/vertical.config.ts or lib/constants.ts.
// app/gone/route.ts is retained but unreferenced (no rewrites).
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["nodemailer"],
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.supabase.co",
      },
    ],
  },
};

module.exports = nextConfig;
