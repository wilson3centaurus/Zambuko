import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Providers } from "@/providers";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "Hutano Dispatch",
  description: "Emergency Dispatcher App",
  manifest: "/manifest.json",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Hutano Dispatch" },
};

export const viewport: Viewport = {
  themeColor: "#dc2626",
  viewportFit: "cover",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="font-sans antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
