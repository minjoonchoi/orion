"use client";
import { useId, type ReactNode } from "react";
export type FieldControlProps = {
  id: string;
  "aria-describedby"?: string;
  "aria-invalid"?: true;
  required?: boolean;
};
/** Render prop makes the label/error association explicit for native or custom controls. */
export function Field({
  label,
  hint,
  error,
  required,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: (props: FieldControlProps) => ReactNode;
}) {
  const id = useId();
  const description =
    [hint ? `${id}-hint` : "", error ? `${id}-error` : ""]
      .filter(Boolean)
      .join(" ") || undefined;
  return (
    <div className="ui-field">
      <label htmlFor={id}>
        {label}
        {required && <span aria-hidden="true"> *</span>}
      </label>
      {children({
        id,
        "aria-describedby": description,
        "aria-invalid": error ? true : undefined,
        required,
      })}
      {hint && (
        <p id={`${id}-hint`} className="ui-hint">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="ui-field-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
