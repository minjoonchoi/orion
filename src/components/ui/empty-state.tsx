"use client";
import { useI18n } from "@/i18n/provider";
import type { ReactNode } from "react";
export function EmptyState({
  title = "아직 연결된 데이터가 없습니다",
  description = "화면의 기본 경로가 준비되었습니다. 세부 기능은 추후 제공됩니다.",
  action,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
}) {
  const { t } = useI18n();
  return (
    <section className="empty-state">
      <h2>{t(title)}</h2>
      <p>{t(description)}</p>
      {action && <div className="ui-empty-action">{action}</div>}
    </section>
  );
}
