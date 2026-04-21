/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@zambuko/ui", "@zambuko/database"],
  images: { remotePatterns: [{ protocol: "https", hostname: "*.supabase.co" }] },
};

export default nextConfig;
