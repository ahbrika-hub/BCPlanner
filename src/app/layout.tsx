import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

import { TooltipProvider } from "@/components/ui/tooltip";

// Interim UI typeface. Self-hosted by next/font (no font files committed).
// Frutiger LT Arabic will replace this once the official files are supplied
// (swap the --font-inter wiring + the --font-sans token in globals.css).
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "TSS Planner",
  description: "TSS Planner — Business Consulting planning platform.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="bg-background text-foreground flex min-h-full flex-col font-sans">
        <TooltipProvider delayDuration={200}>{children}</TooltipProvider>
      </body>
    </html>
  );
}
