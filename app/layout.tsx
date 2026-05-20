import type { Metadata } from "next";
import { Geist_Mono } from "next/font/google";
import "./globals.css";

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "NetScope — API Performance Simulator",
  description:
    "Browser-based API monitor and performance analyzer. Session-only, no data stored.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistMono.variable} dark h-full`}>
      <body
        className="min-h-full bg-zinc-950 text-zinc-100 antialiased"
        suppressHydrationWarning
      >
        {children}
      </body>
    </html>
  );
}
