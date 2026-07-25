import type { Metadata } from "next";
import { Providers } from "@/providers";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Hutano Admin", template: "%s · Admin" },
  description: "Hutano Telehealth — Admin Dashboard",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-sans antialiased bg-gray-950 text-white">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
