"use client";
import * as Primitive from "@radix-ui/react-dropdown-menu";
import type { ReactNode } from "react";
export function ActionMenu({
  trigger,
  label,
  items,
}: {
  trigger: ReactNode;
  label: string;
  items: {
    id: string;
    label: string;
    onSelect: () => void;
    disabled?: boolean;
    danger?: boolean;
  }[];
}) {
  return (
    <Primitive.Root>
      <Primitive.Trigger asChild>{trigger}</Primitive.Trigger>
      <Primitive.Portal>
        <Primitive.Content
          className="ui-menu"
          sideOffset={6}
          align="end"
          aria-label={label}
        >
          {items.map((item) => (
            <Primitive.Item
              className="ui-menu-item"
              data-danger={item.danger || undefined}
              key={item.id}
              disabled={item.disabled}
              onSelect={item.onSelect}
            >
              {item.label}
            </Primitive.Item>
          ))}
        </Primitive.Content>
      </Primitive.Portal>
    </Primitive.Root>
  );
}
