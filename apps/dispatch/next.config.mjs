import withPWA from "@ducanh2912/next-pwa";

const pwaConfig = withPWA({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === "development",
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@zambuko/ui", "@zambuko/database"],
  images: { remotePatterns: [{ protocol: "https", hostname: "*.supabase.co" }] },
};

export default pwaConfig(nextConfig);
