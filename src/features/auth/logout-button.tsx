"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n/provider";
import { logout } from "./logout";
export function LogoutButton() {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  return (
    <div>
      <Button
        variant="ghost"
        loading={busy}
        onClick={async () => {
          setBusy(true);
          setError(false);
          try {
            const result = await logout();
            if (result.ok) {
              location.replace("/login");
              return;
            }
            setError(true);
          } catch {
            setError(true);
          } finally {
            setBusy(false);
          }
        }}
      >
        {t("로그아웃")}
      </Button>
      {error && (
        <span role="alert">
          {t("로그아웃하지 못했습니다. 다시 시도해 주세요.")}
        </span>
      )}
    </div>
  );
}
