/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@dmpilot/ui"],
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_SUPPORT_EMAIL:
      process.env.NEXT_PUBLIC_SUPPORT_EMAIL ||
      process.env.SUPPORT_EMAIL ||
      'support@dmpilot.org',
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), geolocation=(), payment=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
