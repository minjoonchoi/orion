"use client";
import * as Primitive from "@radix-ui/react-tabs";
import type { ReactNode } from "react";
export function Tabs({
  label,
  items,
  value,
  onValueChange,
}: {
  label: string;
  items: { value: string; label: string; content: ReactNode }[];
  value: string;
  onValueChange: (value: string) => void;
}) {
  return (
    <Primitive.Root
      value={value}
      onValueChange={onValueChange}
      activationMode="manual"
    >
      <Primitive.List aria-label={label} className="ui-tab-list">
        {items.map((item) => (
          <Primitive.Trigger
            className="ui-tab"
            key={item.value}
            value={item.value}
          >
            {item.label}
          </Primitive.Trigger>
        ))}
      </Primitive.List>
      {items.map((item) => (
        <Primitive.Content
          forceMount
          hidden={value !== item.value}
          className="ui-tab-panel"
          key={item.value}
          value={item.value}
        >
          {item.content}
        </Primitive.Content>
      ))}
    </Primitive.Root>
  );
}
