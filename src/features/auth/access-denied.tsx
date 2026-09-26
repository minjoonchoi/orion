"use client";
import Link from "next/link";
import { useI18n } from "@/i18n/provider";
import { LogoutButton } from "./logout-button";
export function AccessDenied() {
  const { t } = useI18n();
  return (
    <section className="ui-panel" role="alert">
      <p className="muted">403 · ACCESS DENIED</p>
      <h1>{t("접근 권한이 없습니다")}</h1>
      <p>
        {t(
          "이 페이지를 볼 수 있는 권한이 없습니다. 소속 조직의 관리자에게 권한을 요청해 주세요.",
        )}
      </p>
      <div className="ui-actions">
        <Link href="/">{t("개요로 이동")}</Link>
        <LogoutButton />
      </div>
    </section>
  );
}
