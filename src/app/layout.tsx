import { getT } from "@/i18n/server";
import { getLocale } from "@/i18n/server";
import { I18nProvider } from "@/i18n/provider";
import { deployment } from "@/lib/api/server";
import type { Metadata } from "next";
import "./globals.css";
import "@/components/ui/styles.css";
export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return {
    title: { default: "Orion", template: "%s | Orion" },
    description: t("사내 백오피스를 위한 통합 인증·인가 플랫폼"),
  };
}
export const dynamic = "force-dynamic";
export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const locale = await getLocale();
  const { timeZone, mode, environment, region } = deployment();
  return (
    <html lang={locale}>
      <body>
        <I18nProvider {...{ locale, timeZone, mode, environment, region }}>
          {children}
        </I18nProvider>
      </body>
    </html>
  );
}
