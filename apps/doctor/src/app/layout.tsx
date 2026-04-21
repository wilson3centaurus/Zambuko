import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Providers } from "@/providers";
import { OfflineBanner } from "@zambuko/ui";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: { default: "Zambuko Doctor", template: "%s · Zambuko Doctor" },
  description: "Doctor portal for the Zambuko Telehealth Platform",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "ZambukoDoc",
  },
  other: { "mobile-web-app-capable": "yes" },
};

export const viewport: Viewport = {
  themeColor: "#0284c7",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="font-sans antialiased bg-gray-50 text-gray-900">
        <Providers>
          <OfflineBanner />
          {children}
        </Providers>
      </body>
    </html>
  );
}
