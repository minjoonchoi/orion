import { getT } from "@/i18n/server";
import { LanguageSelect, DeploymentLabel } from "@/i18n/provider";
import "@/features/identity/styles.css";
import Link from "next/link";
import { Navigation } from "@/components/layout/navigation";
export default async function ConsoleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const t = await getT();
  return (
    <div className="shell">
      <a className="skip-link" href="#main">
        {t("본문으로 이동")}
      </a>
      <aside className="sidebar">
        <Link href="/" className="brand" aria-label={t("Orion 개요")}>
          ORION<span>IDENTITY & ACCESS</span>
        </Link>
        <Navigation />
      </aside>
      <div className="workspace">
        <header className="topbar">
          {t("접근 권한 관리")}
          <DeploymentLabel />
          <LanguageSelect />
        </header>
        <main id="main" tabIndex={-1}>
          {children}
        </main>
      </div>
    </div>
  );
}
