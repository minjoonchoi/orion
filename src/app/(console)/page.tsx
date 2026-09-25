import Link from "next/link";
import { navigationGroups } from "@/config/navigation";
import { PageHeading } from "@/components/ui/page-heading";
export default function OverviewPage() {
  return (
    <>
      <PageHeading
        title="통합 인증·인가 관리"
        description="사내 백오피스의 사용자, 조직과 접근 권한을 한곳에서 관리합니다."
      />
      <div className="overview-groups">
        {navigationGroups.map((group) => (
          <section key={group.id} aria-labelledby={`overview-${group.id}`}>
            <h2 id={`overview-${group.id}`} className="overview-group-title">
              {group.label}
            </h2>
            <div className="card-grid">
              {group.items.map((item) => (
                <Link className="card" href={item.href} key={item.href}>
                  <h3>
                    {item.label}
                    <span aria-hidden="true"> →</span>
                  </h3>
                  <p>{item.description}</p>
                  <span className="muted">
                    {["/users", "/organizations"].includes(item.href)
                      ? "조회 화면 · 예제 데이터"
                      : "준비 중"}
                  </span>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
