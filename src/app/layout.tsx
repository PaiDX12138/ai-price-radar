import type { Metadata } from "next";
import localFont from "next/font/local";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteTooltips } from "@/components/ui/site-tooltips";
import { BRAND_NAME_EN, BRAND_NAME_ZH } from "@/lib/brand";
import "./globals.css";

const geistSans = localFont({
  src: "./fonts/Geist-Variable.woff2",
  weight: "100 900",
  display: "swap",
  variable: "--font-geist-sans",
});

const geistMono = localFont({
  src: "./fonts/GeistMono-Variable.woff2",
  weight: "100 900",
  display: "swap",
  variable: "--font-geist-mono",
});

export const metadata: Metadata = {
  title: {
    default: BRAND_NAME_ZH,
    template: `%s · ${BRAND_NAME_ZH}`,
  },
  description: `${BRAND_NAME_ZH}（${BRAND_NAME_EN}）— 聚合公开渠道报价，方便购买前核验。`,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="zh-CN"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-background text-foreground font-sans">
        <SiteHeader />
        <main className="flex-1">{children}</main>
        <SiteFooter />
        <SiteTooltips />
      </body>
    </html>
  );
}
