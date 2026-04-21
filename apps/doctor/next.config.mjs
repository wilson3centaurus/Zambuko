import withPWA from "@ducanh2912/next-pwa";

const pwaConfig = withPWA({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === "development",
  workboxOptions: {
    runtimeCaching: [
      {
        urlPattern: /^https:\/\/.*\.supabase\.co\/(rest|realtime)\/.*/,
        handler: "NetworkFirst",
        options: {
          cacheName: "supabase-api",
          expiration: { maxAgeSeconds: 24 * 60 * 60 },
          networkTimeoutSeconds: 8,
        },
      },
      {
        urlPattern: /^https:\/\/.*\.supabase\.co\/storage\/.*/,
        handler: "CacheFirst",
        options: {
          cacheName: "supabase-storage",
          expiration: { maxEntries: 100, maxAgeSeconds: 7 * 24 * 60 * 60 },
        },
      },
    ],
  },
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@zambuko/ui", "@zambuko/database", "@zambuko/offline"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co" },
    ],
  },
};

export default pwaConfig(nextConfig);
