"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { rollbackSync, syncHistory } from "./actions";
import type { Run } from "./model";
import { DateValue, useI18n } from "@/i18n/provider";
import { Button } from "@/components/ui/button";
import "./styles.css";
export function SyncHistoryScreen() {
  const { t, mode, environment, region } = useI18n();
  const [runs, setRuns] = useState<Run[] | null>(null);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [rollbackId, setRollbackId] = useState("");
  async function refresh() {
    setBusy(true);
    setError(false);
    try {
      const r = await syncHistory();
      if (r.data) setRuns(r.data);
      else setError(true);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    void syncHistory()
      .then((r) => (r.data ? setRuns(r.data) : setError(true)))
      .catch(() => setError(true));
  }, []);
  async function rollback(runId: string) {
    setRollbackId(runId);
    setError(false);
    try {
      const r = await rollbackSync(runId);
      if (!r.data) setError(true);
      await refresh();
    } catch {
      setError(true);
    } finally {
      setRollbackId("");
    }
  }
  return (
    <div className="sync-page">
      <div className="sync-heading">
        <div>
          <p className="muted">GITOPS / SYNC HISTORY</p>
          <h1>{t("동기화 이력")}</h1>
          <p>
            {environment} / {region}
          </p>
          <p>
            {t(
              "환경·리전별 Sync 이력과 rollback 가능한 revision을 확인합니다.",
            )}
          </p>
        </div>
        <Button variant="secondary" disabled={busy} onClick={refresh}>
          {t("새로고침")}
        </Button>
      </div>
      <Link href="/resources?tab=changes">{t("리소스 관리")}</Link>
      {mode === "demo" && (
        <p className="sync-notice">
          {t("예제 이력은 현재 세션에서만 유지됩니다.")}
        </p>
      )}
      {error && (
        <p role="alert">{t("요청하지 못했습니다. 다시 시도해 주세요.")}</p>
      )}
      {!runs && !error && <p role="status">{t("불러오는 중…")}</p>}
      {runs && (
        <div className="sync-catalog">
          <table>
            <thead>
              <tr>
                <th>{t("Revision")}</th>
                <th>{t("상태")}</th>
                <th>{t("적용 완료 시간")}</th>
                <th>{t("작업")}</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((r) => (
                <tr key={r.id}>
                  <td>
                    revision {r.dbRevision}
                    <small>
                      <code>{r.commit}</code>
                    </small>
                    {r.rollbackOf && (
                      <small>
                        {t("Rollback")} → revision {r.targetRevision}
                      </small>
                    )}
                    <small>{r.id}</small>
                  </td>
                  <td>
                    {t(r.status)}
                    <small>{r.phase}</small>
                  </td>
                  <td>
                    {r.completedAt ? (
                      <DateValue value={r.completedAt} time />
                    ) : (
                      "—"
                    )}
                  </td>
                  <td>
                    {r.status === "succeeded" ? (
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={Boolean(rollbackId)}
                        loading={rollbackId === r.id}
                        onClick={() => rollback(r.id)}
                      >
                        {t("이 revision으로 롤백")}
                      </Button>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!runs.length && <p>{t("동기화 이력이 없습니다.")}</p>}
        </div>
      )}
    </div>
  );
}
