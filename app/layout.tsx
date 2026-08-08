import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "墨境行者｜战墨破境",
  description: "一款以中国水墨画为主题的 2D 横版动作游戏原型。",
  other: {
    "codex-preview": "development",
  },
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
      <body>{children}</body>
    </html>
  );
}
