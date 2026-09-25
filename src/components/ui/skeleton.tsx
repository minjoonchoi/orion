"use client";
import { useI18n } from "@/i18n/provider";
export function Skeleton({ label = "불러오는 중" }: { label?: string }) {
  const { t } = useI18n();
  return (
    <div className="ui-skeleton-group" role="status">
      <span className="sr-only">{t(label)}</span>
      {[1, 2, 3].map((row) => (
        <div key={row} className="ui-skeleton" aria-hidden="true" />
      ))}
    </div>
  );
}
