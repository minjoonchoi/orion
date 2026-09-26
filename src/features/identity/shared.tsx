"use client";
import { DateValue, useI18n } from "@/i18n/provider";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import type { Status } from "./types";
export function StatusBadge({ status }: { status: Status }) {
  const { t } = useI18n();
  return (
    <Badge tone={status === "active" ? "success" : "neutral"}>
      {status === "active" ? t("활성") : t("비활성")}
    </Badge>
  );
}
export function date(value: string | null) {
  return <DateValue value={value} />;
}

export function DemoNotice() {
  const { t, mode } = useI18n();
  if (mode !== "demo") return null;
  return (
    <p className="identity-demo">
      <Badge>{t("예제 데이터")}</Badge>
      {t("실제 사내 계정과 연결되지 않은 예제 환경입니다.")}
    </p>
  );
}
export function Summary({
  items,
}: {
  items: { label: string; value: number }[];
}) {
  const { t } = useI18n();
  return (
    <div className="identity-summary">
      {items.map((item) => (
        <div key={t(item.label)}>
          <span>{t(item.label)}</span>
          <strong>{item.value}</strong>
        </div>
      ))}
    </div>
  );
}
export function Details({
  items,
}: {
  items: { label: string; value: ReactNode }[];
}) {
  const { t } = useI18n();
  return (
    <dl className="identity-details">
      {items.map((item) => (
        <div key={t(item.label)}>
          <dt>{t(item.label)}</dt>
          <dd>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
