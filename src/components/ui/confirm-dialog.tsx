"use client";
import { useI18n } from "@/i18n/provider";
import * as Primitive from "@radix-ui/react-alert-dialog";
import type { ReactNode, RefObject } from "react";
import { Button } from "./button";
import { Alert } from "./alert";
export function ConfirmDialog({
  trigger,
  title,
  description,
  confirmLabel = "삭제",
  open,
  onOpenChange,
  onConfirm,
  pending = false,
  error,
  returnFocusRef,
}: {
  trigger: ReactNode;
  title: string;
  description: string;
  confirmLabel?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  pending?: boolean;
  error?: string;
  returnFocusRef?: RefObject<HTMLElement | null>;
}) {
  const { t } = useI18n();
  return (
    <Primitive.Root
      open={open}
      onOpenChange={(next) => {
        if (!pending) onOpenChange(next);
      }}
    >
      <Primitive.Trigger asChild>{trigger}</Primitive.Trigger>
      <Primitive.Portal>
        <Primitive.Overlay className="ui-overlay" />
        <Primitive.Content
          className="ui-dialog"
          onCloseAutoFocus={(event) => {
            if (returnFocusRef?.current) {
              event.preventDefault();
              returnFocusRef.current.focus();
            }
          }}
          aria-busy={pending || undefined}
          onEscapeKeyDown={(e) => {
            if (pending) e.preventDefault();
          }}
        >
          <Primitive.Title>{t(title)}</Primitive.Title>
          <Primitive.Description>{t(description)}</Primitive.Description>
          {error && <Alert tone="danger" title={t(error)} />}
          <div className="ui-dialog-footer">
            <Primitive.Cancel asChild>
              <Button variant="secondary" disabled={pending}>
                {t("취소")}
              </Button>
            </Primitive.Cancel>
            <Button variant="danger" loading={pending} onClick={onConfirm}>
              {confirmLabel}
            </Button>
          </div>
        </Primitive.Content>
      </Primitive.Portal>
    </Primitive.Root>
  );
}
