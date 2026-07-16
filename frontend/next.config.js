/** @type {import('next').NextConfig} */
const isStaticExport = process.env.STATIC_EXPORT === "true";
const isMobileBuild = process.env.MOBILE_BUILD === "true";

const nextConfig = {
  reactStrictMode: true,
  output: isStaticExport ? "export" : (isMobileBuild ? undefined : "standalone"),
  images: {
    unoptimized: isStaticExport,
  },
  async rewrites() {
    if (isStaticExport || isMobileBuild) return [];
    const apiBase = process.env.API_INTERNAL_URL || "http://backend:8000";
    return [
      {
        source: "/api/:path*",
        destination: `${apiBase}/api/:path*`,
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
      {
        source: "/manifest.json",
        headers: [{ key: "Content-Type", value: "application/manifest+json" }],
      },
    ];
  },
};

module.exports = nextConfig;
