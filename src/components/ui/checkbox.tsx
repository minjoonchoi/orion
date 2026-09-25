"use client";
import { useEffect, useRef, type ComponentProps } from "react";
import { cn } from "@/lib/cn";
export function Checkbox({
  indeterminate = false,
  className,
  ...props
}: Omit<ComponentProps<"input">, "type" | "ref"> & {
  indeterminate?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);
  return (
    <input
      {...props}
      ref={ref}
      type="checkbox"
      aria-checked={indeterminate ? "mixed" : props.checked}
      className={cn("ui-checkbox", className)}
    />
  );
}
