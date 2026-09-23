import type { ComponentProps } from "react";
export function Switch({
  label,
  ...props
}: Omit<ComponentProps<"input">, "type" | "role" | "className"> & {
  label: string;
}) {
  return (
    <label className="ui-switch">
      <input {...props} type="checkbox" role="switch" />
      <span aria-hidden="true" className="ui-switch-track" />
      <span>{label}</span>
    </label>
  );
}
