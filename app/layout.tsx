import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Geist, Geist_Mono } from "next/font/google";
import { THEME_COOKIE } from "@/lib/api/config";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "TikTok Admin",
  description: "Moderation and operations console",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Read here rather than after hydration so a dark console does not flash white on every load.
  const dark = (await cookies()).get(THEME_COOKIE)?.value === "dark";

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased${dark ? " dark" : ""}`}
    >
      <body className="min-h-full">{children}</body>
    </html>
  );
}
