import type { Metadata } from "next";
import { Geist, Geist_Mono, Oxanium } from "next/font/google";
import {
  NO_FLASH_SCRIPT,
  ThemeProvider,
} from "@/components/hypemarket/theme-provider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const oxanium = Oxanium({
  variable: "--font-oxanium",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "HypeMarket · Live Esports Prediction Arena",
  description:
    "Watch live, read the arena, and predict outcomes with play-money Hype Credits — a telemetry-synced parimutuel prediction market for esports.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      data-skin="nebula"
      data-mode="dark"
      className={`${geistSans.variable} ${geistMono.variable} ${oxanium.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: NO_FLASH_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col bg-app font-sans text-ink antialiased">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
