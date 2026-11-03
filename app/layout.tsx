import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { cn } from "@/lib/utils";
import AppProviders from "@/components/providers/app-providers";
import { ThemeProvider } from "@/components/providers/theme-provider";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: {
    default: "DineDesk | Smart Restaurant Ordering System",
    template: "%s | DineDesk",
  },
  description: "Browse the menu, customize your order, and pay instantly from your table. A seamless and contactless restaurant dine-in experience.",
  keywords: ["QR menu", "restaurant ordering", "dine-in", "contactless menu", "QR code restaurant"],
  authors: [{ name: "DineDesk" }],
  openGraph: {
    title: "DineDesk | Smart QR Dine-In Ordering System",
    description: "Contactless tableside ordering, digital checkout, and admin insights for modern restaurants.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={cn(geistSans.variable, geistMono.variable, "font-sans")} suppressHydrationWarning>
      <body
        className="antialiased"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <ThemeProvider>
          <AppProviders>{children}</AppProviders>
        </ThemeProvider>
      </body>
    </html>
  );
}
