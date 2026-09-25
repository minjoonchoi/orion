import { getT } from "@/i18n/server";
import Link from "next/link";
export default async function NotFound() {
  const t = await getT();
  return (
    <main className="standalone">
      <h1>{t("페이지를 찾을 수 없습니다")}</h1>
      <p>{t("주소를 확인하거나 개요 화면으로 이동해 주세요.")}</p>
      <Link href="/">{t("개요로 이동")}</Link>
    </main>
  );
}
