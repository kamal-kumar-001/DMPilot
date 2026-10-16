/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@autodm/ui"],
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_SUPPORT_EMAIL:
      process.env.NEXT_PUBLIC_SUPPORT_EMAIL ||
      process.env.SUPPORT_EMAIL ||
      'support@dmpilot.org',
  },
};

export default nextConfig;
