import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "@/providers";
import { OfflineBanner } from "@zambuko/ui";

export const metadata: Metadata = {
  title: {
    default: "Hutano — Telehealth for Zimbabwe",
    template: "%s | Hutano",
  },
  description: "Access qualified doctors from anywhere in Zimbabwe. Video, audio, and chat consultations. Emergency dispatch. E-prescriptions.",
  applicationName: "Hutano Patient",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Hutano",
  },
  formatDetection: { telephone: false },
  openGraph: {
    type: "website",
    locale: "en_ZW",
    siteName: "Hutano Telehealth",
  },
};

export const viewport: Viewport = {
  themeColor: "#1A6E7E",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `try{var t=localStorage.getItem("hutano-theme")||"system";var d=t==="dark"||(t==="system"&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",d);document.documentElement.style.colorScheme=d?"dark":"light"}catch(e){}` }} />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
      </head>
      <body className="h-full bg-gray-50 font-sans antialiased">
        <Providers>
          <OfflineBanner className="fixed top-0 left-0 right-0 z-50" />
          {children}
        </Providers>
      </body>
    </html>
  );
}
