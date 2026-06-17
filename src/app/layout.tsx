import type { Metadata, Viewport } from "next";
import "./globals.css";
import KioskGuard from "@/components/KioskGuard";

export const metadata: Metadata = {
  title: "STANLEY+ · your receipt",
  description:
    "Drop your Instagram handle and Stanley reads you back: three insights, your creator type, and a drink, printed on a receipt for the bar.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "STANLEY+",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: "/stanley-mark.png",
    apple: "/stanley-mark.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#14130f",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <KioskGuard />
        {children}
      </body>
    </html>
  );
}
