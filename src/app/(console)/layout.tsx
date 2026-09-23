import { Navigation } from "@/components/layout/navigation";
export default function ConsoleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="shell">
      <a className="skip-link" href="#main">
        본문으로 이동
      </a>
      <aside className="sidebar">
        <div className="brand">
          ORION<span>ACCESS MANAGEMENT</span>
        </div>
        <Navigation />
      </aside>
      <div className="workspace">
        <header className="topbar">
          접근 권한 관리 <span className="badge">초기 구성</span>
        </header>
        <main id="main" tabIndex={-1}>
          {children}
        </main>
      </div>
    </div>
  );
}
