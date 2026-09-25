"use client";
import { useEffect, useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { DateValue, useI18n } from "@/i18n/provider";
import { RollbackButton } from "../resource-sync/rollback-button";
import {
  policySyncHistory,
  policySyncRun,
  rollbackPolicySync,
} from "./actions";
import type { Run } from "./model";

export function PolicyHistoryDialog({
  id,
  onClose,
  onUpdated,
}: {
  id: string;
  onClose: () => void;
  onUpdated: () => void;
}) {
  const { t } = useI18n();
  const [runs, setRuns] = useState<Run[] | null>(null);
  const [error, setError] = useState("");
  const [run, setRun] = useState<Run | null>(null);
  const [busy, setBusy] = useState(false);
  const active = Boolean(run && ["queued", "running"].includes(run.status));
  async function refresh() {
    try {
      const r = await policySyncHistory();
      setError("");
      if (r.data) setRuns(r.data);
      else setError(r.error!);
    } catch {
      setError("REQUEST_FAILED");
    }
  }
  useEffect(() => {
    let stopped = false;
    void policySyncHistory()
      .then((r) => {
        if (stopped) return;
        if (r.data) setRuns(r.data);
        else setError(r.error!);
      })
      .catch(() => !stopped && setError("REQUEST_FAILED"));
    return () => {
      stopped = true;
    };
  }, []);
  useEffect(() => {
    if (!run || !active) return;
    let stopped = false;
    const timer = setInterval(() => {
      void policySyncRun(run.id)
        .then((r) => {
          if (stopped) return;
          if (r.data) {
            setRun(r.data);
            if (r.data.status === "succeeded") {
              void refresh();
              onUpdated();
            }
          } else setError(r.error!);
        })
        .catch(() => !stopped && setError("REQUEST_FAILED"));
    }, 2000);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [run, active, onUpdated]);
  const rows = runs?.filter((r) => r.policyIds?.includes(id));
  return (
    <Dialog
      title={t("동기화 이력")}
      description={`${t("정책")} · ${id}`}
      open
      busy={busy || active}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
      trigger={<button hidden />}
    >
      {error && (
        <p role="alert">
          {t(
            error === "FORBIDDEN"
              ? "접근 권한이 없습니다"
              : "요청하지 못했습니다. 다시 시도해 주세요.",
          )}
        </p>
      )}
      <Button variant="secondary" disabled={busy || active} onClick={refresh}>
        {t("새로고침")}
      </Button>
      {!runs && !error && <p role="status">{t("불러오는 중…")}</p>}
      {run && (
        <p role="status">
          {t(run.status)} · {run.phase} · revision {run.dbRevision}
        </p>
      )}
      <p>
        {t(
          "정책과 함께 적용된 리소스가 있으면 해당 실행의 범위를 함께 복원합니다.",
        )}
      </p>
      <div className="sync-catalog">
        <table aria-label={t("동기화 이력")}>
          <thead>
            <tr>
              <th>Revision</th>
              <th>{t("적용 범위")}</th>
              <th>{t("상태")}</th>
              <th>{t("적용 완료 시간")}</th>
              <th>{t("작업")}</th>
            </tr>
          </thead>
          <tbody>
            {rows?.map((r) => (
              <tr key={r.id}>
                <td>
                  revision {r.dbRevision}
                  <small>{r.commit}</small>
                </td>
                <td>
                  {t("정책")} · {r.policyIds?.join(", ")}
                  <small>
                    {t("리소스")} ·{" "}
                    {r.resourceRefs?.map((x) => x.id).join(", ") || "—"}
                  </small>
                </td>
                <td>{t(r.status)}</td>
                <td>
                  {r.completedAt ? (
                    <DateValue value={r.completedAt} time />
                  ) : (
                    "—"
                  )}
                </td>
                <td>
                  {r.status === "succeeded" && (
                    <RollbackButton
                      revision={r.dbRevision}
                      commit={r.commit}
                      scope={`${t("정책")} ${r.policyIds?.join(", ")} · ${t("리소스")} ${r.resourceRefs?.map((x) => x.id).join(", ") || "—"}`}
                      disabled={busy || active}
                      onConfirm={async () => {
                        setBusy(true);
                        setError("");
                        try {
                          const result = await rollbackPolicySync(r.id);
                          if (!result.data) {
                            setError(result.error!);
                            return false;
                          }
                          setRun(result.data);
                          if (result.data.status === "succeeded") {
                            await refresh();
                            onUpdated();
                          }
                          return true;
                        } catch {
                          setError("REQUEST_FAILED");
                          return false;
                        } finally {
                          setBusy(false);
                        }
                      }}
                    />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {runs && !rows?.length && <p>{t("동기화 이력이 없습니다.")}</p>}
      {runs?.some((r) => !r.policyIds) && (
        <p className="muted">
          {t("대상 정보가 없는 이전 실행은 정책별 이력에서 제외됩니다.")}
        </p>
      )}
    </Dialog>
  );
}
