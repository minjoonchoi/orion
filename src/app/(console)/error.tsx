"use client";
import { useI18n } from "@/i18n/provider";
export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t } = useI18n();
  return (
    <section role="alert">
      <h1>{t("화면을 불러오지 못했습니다")}</h1>
      <p>{t("잠시 후 다시 시도해 주세요.")}</p>
      <button onClick={reset}>{t("다시 시도")}</button>
    </section>
  );
}
