"use client";
import { useI18n } from "@/i18n/provider";
import type { ComponentProps } from "react";
export function Switch({
  label,
  ...props
}: Omit<ComponentProps<"input">, "type" | "role" | "className"> & {
  label: string;
}) {
  const { t } = useI18n();
  return (
    <label className="ui-switch">
      <input {...props} type="checkbox" role="switch" />
      <span aria-hidden="true" className="ui-switch-track" />
      <span>{t(label)}</span>
    </label>
  );
}
