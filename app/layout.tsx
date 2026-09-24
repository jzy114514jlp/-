import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "别漏事 · 通知整理小工具",
  description: "把群公告和活动通知整理成可核对的行动卡。",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">{children}</body>
    </html>
  );
}
