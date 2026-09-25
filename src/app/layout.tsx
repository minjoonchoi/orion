import type { Metadata } from "next";
import "./globals.css";
import "@/components/ui/styles.css";
export const metadata: Metadata = {
  title: { default: "Orion", template: "%s | Orion" },
  description: "서버 리소스 접근 권한 관리 플랫폼",
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
