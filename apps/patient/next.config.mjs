import withPWA from "@ducanh2912/next-pwa";

const pwa = withPWA({
  dest: "public",
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: true,
  disable: process.env.NODE_ENV === "development",
  workboxOptions: {
    disableDevLogs: true,
    runtimeCaching: [
      {
        urlPattern: /^https:\/\/.*\.supabase\.co\/rest\/v1\/.*/,
        handler: "NetworkFirst",
        options: {
          cacheName: "supabase-api-cache",
          networkTimeoutSeconds: 8,
          expiration: { maxEntries: 200, maxAgeSeconds: 24 * 60 * 60 },
          cacheableResponse: { statuses: [0, 200] },
        },
      },
      {
        urlPattern: /^https:\/\/.*\.supabase\.co\/storage\/.*/,
        handler: "StaleWhileRevalidate",
        options: {
          cacheName: "supabase-storage-cache",
          expiration: { maxEntries: 100, maxAgeSeconds: 7 * 24 * 60 * 60 },
        },
      },
      {
        urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/,
        handler: "StaleWhileRevalidate",
        options: { cacheName: "google-fonts-stylesheets" },
      },
      {
        urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/,
        handler: "CacheFirst",
        options: {
          cacheName: "google-fonts-webfonts",
          expiration: { maxAgeSeconds: 365 * 24 * 60 * 60 },
        },
      },
      {
        urlPattern: /^https:\/\/api\.mapbox\.com\/.*/,
        handler: "CacheFirst",
        options: {
          cacheName: "mapbox-cache",
          expiration: { maxEntries: 200, maxAgeSeconds: 24 * 60 * 60 },
        },
      },
    ],
  },
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@zambuko/ui", "@zambuko/database", "@zambuko/offline", "@zambuko/triage"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
    ],
    formats: ["image/avif", "image/webp"],
  },
  experimental: {
    optimizePackageImports: ["@zambuko/ui"],
  },
};

export default pwa(nextConfig);
