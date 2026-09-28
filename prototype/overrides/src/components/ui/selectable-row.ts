import type { MouseEvent } from "react";
/** Row clicks delegate to the existing checkbox, preserving its controlled state and keyboard semantics. */
export function selectableRowProps() {
  return {
    "data-selectable-row": true,
    onClick(event: MouseEvent<HTMLTableRowElement>) {
      if (event.defaultPrevented || event.button !== 0) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (
        target.closest(
          'a, button, input, select, textarea, label, summary, [role="button"], [role="link"], [role="checkbox"], [role="switch"], [role="combobox"], [contenteditable]:not([contenteditable="false"]), [data-row-selection-ignore]',
        )
      )
        return;
      if (window.getSelection()?.toString()) return;
      const checkbox = event.currentTarget.querySelector<HTMLInputElement>(
        'input[type="checkbox"]',
      );
      if (
        checkbox &&
        !checkbox.disabled &&
        checkbox.getAttribute("aria-disabled") !== "true"
      )
        checkbox.click();
    },
  };
}
