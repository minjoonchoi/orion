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
  return (
    <div
      className={`ui-alert ui-tone--${tone}`}
      role={tone === "danger" ? "alert" : "status"}
    >
      <div>
        <strong>{title}</strong>
        {children && <div>{children}</div>}
      </div>
      {action}
    </div>
  );
}
