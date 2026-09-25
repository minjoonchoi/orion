"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { useI18n } from "@/i18n/provider";

export function RollbackButton({
  revision,
  commit,
  disabled,
  onConfirm,
}: {
  revision: number;
  commit: string;
  disabled: boolean;
  onConfirm: () => Promise<boolean>;
}) {
  const { t, environment, region } = useI18n();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState(false);
  return (
    <Dialog
      title={t("롤백 검토")}
      description={t(
        "선택한 revision의 정의 전체를 복원합니다. 사용자·조직·역할 부여는 유지됩니다.",
      )}
      trigger={
        <Button variant="secondary" size="sm" disabled={disabled}>
          {t("이 revision으로 롤백")}
        </Button>
      }
      open={open}
      busy={busy}
      onOpenChange={(next) => {
        setOpen(next);
        setConfirmed(false);
        setError(false);
      }}
    >
      <p>
        {environment} / {region}
      </p>
      <h3>revision {revision}</h3>
      <p>
        <code>{commit}</code>
      </p>
      <p>
        {t(
          "이후 Sync로 적용된 정의가 교체되므로 연결된 권한의 동작이 달라질 수 있습니다.",
        )}
      </p>
      <label className="sync-confirm">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
        />
        {t("복원할 revision과 적용 범위를 확인했습니다.")}
      </label>
      {error && (
        <p role="alert">
          {t(
            "롤백하지 못했습니다. 연결 관계와 최신 상태를 확인한 후 다시 시도하세요.",
          )}
        </p>
      )}
      <div className="ui-dialog-footer">
        <Button
          variant="secondary"
          disabled={busy}
          onClick={() => setOpen(false)}
        >
          {t("취소")}
        </Button>
        <Button
          disabled={!confirmed || busy}
          loading={busy}
          onClick={async () => {
            setBusy(true);
            setError(false);
            try {
              if (await onConfirm()) setOpen(false);
              else setError(true);
            } catch {
              setError(true);
            } finally {
              setBusy(false);
            }
          }}
        >
          {t("롤백 적용")}
        </Button>
      </div>
    </Dialog>
  );
}
