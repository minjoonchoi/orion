"use client";
import { useI18n } from "@/i18n/provider";
import type { ReactNode } from "react";
import type { Tone } from "./badge";
export function Alert({
  title,
  children,
  tone = "info",
  action,
}: {
  title: string;
  children?: ReactNode;
  tone?: Tone;
  action?: ReactNode;
}) {
  const { t } = useI18n();
  return (
    <div
      className={`ui-alert ui-tone--${tone}`}
      role={tone === "danger" ? "alert" : "status"}
    >
      <div>
        <strong>{t(title)}</strong>
        {children && <div>{children}</div>}
      </div>
      {action}
    </div>
  );
}
