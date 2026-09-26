"use client";
import { useI18n } from "@/i18n/provider";
import * as Primitive from "@radix-ui/react-dialog";
import { useRef, type ReactNode } from "react";
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
  size = "default",
}: {
  trigger: ReactNode;
  title: string;
  description: string;
  children: ReactNode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  variant?: "modal" | "drawer";
  busy?: boolean;
  size?: "default" | "wide";
}) {
  const { t } = useI18n();
  const returnFocus = useRef<HTMLElement | null>(null);
  return (
    <Primitive.Root
      open={open}
      onOpenChange={(next) => {
        if (!busy) onOpenChange(next);
      }}
    >
      {trigger && <Primitive.Trigger asChild>{trigger}</Primitive.Trigger>}
      <Primitive.Portal>
        <Primitive.Overlay className="ui-overlay" />
        <Primitive.Content
          className={`ui-dialog ui-dialog--${variant} ui-dialog--${size}`}
          aria-busy={busy || undefined}
          onOpenAutoFocus={() => {
            returnFocus.current =
              document.activeElement instanceof HTMLElement
                ? document.activeElement
                : null;
          }}
          onCloseAutoFocus={(event) => {
            if (
              returnFocus.current?.isConnected &&
              returnFocus.current !== document.body
            ) {
              event.preventDefault();
              returnFocus.current.focus();
            }
          }}
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
