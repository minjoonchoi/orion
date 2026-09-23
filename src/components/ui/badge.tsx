"use client";
import { useI18n } from "@/i18n/provider";
import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";
export type Tone = "neutral" | "info" | "success" | "warning" | "danger";
export function Badge({
  tone = "neutral",
  className,
  ...props
}: ComponentProps<"span"> & { tone?: Tone }) {
  const { t } = useI18n();
  return (
    <span {...props} className={cn("ui-badge", `ui-tone--${tone}`, className)}>
      {typeof props.children === "string" ? t(props.children) : props.children}
    </span>
  );
}
