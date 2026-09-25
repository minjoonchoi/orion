import { getT } from "@/i18n/server";
export default async function Loading() {
  const t = await getT();
  return <p role="status">{t("화면을 불러오는 중입니다…")}</p>;
}
