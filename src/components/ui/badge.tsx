import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";
export type Tone = "neutral" | "info" | "success" | "warning" | "danger";
export function Badge({
  tone = "neutral",
  className,
  ...props
}: ComponentProps<"span"> & { tone?: Tone }) {
  return (
    <span
      {...props}
      className={cn("ui-badge", `ui-tone--${tone}`, className)}
    />
  );
}
