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
export function EmploymentBadge({
  status,
}: {
  status: "employed" | "on_leave";
}) {
  const { t } = useI18n();
  return (
    <Badge tone="neutral">{t(status === "employed" ? "재직" : "휴직")}</Badge>
  );
}
export function date(value: string | null) {
  return <DateValue value={value} />;
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
