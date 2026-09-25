import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";
export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input {...props} className={cn("ui-input", className)} />;
}
export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea rows={4} {...props} className={cn("ui-input", className)} />;
}
export function Select({ className, ...props }: ComponentProps<"select">) {
  return <select {...props} className={cn("ui-input", className)} />;
}
