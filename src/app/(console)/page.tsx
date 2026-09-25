import Link from "next/link";
import { navigation } from "@/config/navigation";
import { PageHeading } from "@/components/ui/page-heading";
export default function OverviewPage() {
  return (
    <>
      <PageHeading
        title="접근 권한 관리"
        description="사용자와 서버 리소스의 접근 권한을 한곳에서 관리합니다."
      />
      <section className="intro">
        <span className="eyebrow">ORION PLATFORM</span>
        <h2>필요한 사람에게, 필요한 권한을.</h2>
        <p>사용자, 역할, 리소스와 권한 이력을 체계적으로 관리할 공간입니다.</p>
      </section>
      <div className="card-grid">
        {navigation.slice(1).map((item) => (
          <Link className="card" href={item.href} key={item.href}>
            <h2>
              {item.label}
              <span aria-hidden="true"> →</span>
            </h2>
            <p>{item.description}</p>
            <span className="muted">준비 중</span>
          </Link>
        ))}
      </div>
    </>
  );
}
