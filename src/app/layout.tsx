import type { Metadata } from "next";
import "./globals.css";
import "@/components/ui/styles.css";
export const metadata: Metadata = {
  title: { default: "Orion", template: "%s | Orion" },
  description: "사내 백오피스를 위한 통합 인증·인가 플랫폼",
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
