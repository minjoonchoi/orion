import { getT } from "@/i18n/server";
import Link from "next/link";
export default async function NotFound() {
  const t = await getT();
  return (
    <section className="ui-panel">
      <h1>{t("서비스 엔드포인트을 찾을 수 없습니다")}</h1>
      <p>{t("주소를 확인하거나 목록에서 다시 선택해 주세요.")}</p>
      <Link className="identity-link" href="/service-endpoints">
        {t("서비스 엔드포인트 목록으로")}
      </Link>
    </section>
  );
}
