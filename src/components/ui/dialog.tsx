"use client";
import { useI18n } from "@/i18n/provider";
import * as Primitive from "@radix-ui/react-dialog";
import type { ReactNode } from "react";
import { Button } from "./button";
export function Dialog({
  trigger,
  title,
  description,
  children,
  open,
  onOpenChange,
  variant = "modal",
  busy = false,
}: {
  trigger: ReactNode;
  title: string;
  description: string;
  children: ReactNode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  variant?: "modal" | "drawer";
  busy?: boolean;
}) {
  const { t } = useI18n();
  return (
    <Primitive.Root
      open={open}
      onOpenChange={(next) => {
        if (!busy) onOpenChange(next);
      }}
    >
      <Primitive.Trigger asChild>{trigger}</Primitive.Trigger>
      <Primitive.Portal>
        <Primitive.Overlay className="ui-overlay" />
        <Primitive.Content
          className={`ui-dialog ui-dialog--${variant}`}
          aria-busy={busy || undefined}
          onInteractOutside={(event) => event.preventDefault()}
          onEscapeKeyDown={(event) => {
            if (busy) event.preventDefault();
          }}
        >
          <div className="ui-dialog-header">
            <div>
              <Primitive.Title>{t(title)}</Primitive.Title>
              <Primitive.Description>{t(description)}</Primitive.Description>
            </div>
            <Primitive.Close asChild>
              <Button
                variant="ghost"
                size="sm"
                disabled={busy}
                aria-label={t("닫기")}
              >
                ×
              </Button>
            </Primitive.Close>
          </div>
          {children}
        </Primitive.Content>
      </Primitive.Portal>
    </Primitive.Root>
  );
}
