"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { loadSync, rollbackSync, syncHistory, syncRun } from "./actions";
import {
  currentItem,
  kindLabel,
  type Item,
  type Run,
  type Snapshot,
} from "./model";
import { restoreResource } from "./restore";
import type { ResourceKind } from "../authorization/model";
import { ImpactExplorer } from "../authorization/panel";
import { DateValue, useI18n } from "@/i18n/provider";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import "./styles.css";

const fields = {
  name: "이름",
  description: "설명",
  path: "경로",
  method: "HTTP 메서드",
  parentId: "상위 리소스",
} as const;
function DefinitionDiff({
  before,
  after,
}: {
  before: Item | null;
  after: Item | null;
}) {
  const { t } = useI18n();
  return (
    <div className="sync-history-diff">
      <table>
        <thead>
          <tr>
            <th scope="col">{t("필드")}</th>
            <th scope="col">{t("변경 전")}</th>
            <th scope="col">{t("변경 후")}</th>
          </tr>
        </thead>
        <tbody>
          {(!before || !after) && (
            <tr>
              <th scope="row">{t("정의 상태")}</th>
              <td>{t(before ? "존재" : "없음")}</td>
              <td>{t(after ? "존재" : "없음")}</td>
            </tr>
          )}
          {Object.entries(fields)
            .filter(
              ([key]) =>
                before?.[key as keyof typeof fields] !==
                after?.[key as keyof typeof fields],
            )
            .map(([key, label]) => (
              <tr key={key}>
                <th scope="row">{t(label)}</th>
                <td>{before?.[key as keyof typeof fields] || "—"}</td>
                <td>{after?.[key as keyof typeof fields] || "—"}</td>
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}

export function ResourceHistoryDialog({
  kind,
  id,
  name,
  onClose,
  onUpdated,
}: {
  kind: ResourceKind;
  id: string;
  name: string;
  onClose: () => void;
  onUpdated?: () => void;
}) {
  const { t, mode, environment, region } = useI18n();
  const router = useRouter();
  const [runs, setRuns] = useState<Run[] | null>(null);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [selected, setSelected] = useState<Run | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [pending, setPending] = useState<Run | null>(null);
  const [success, setSuccess] = useState(false);
  async function refresh() {
    setBusy(true);
    setError("");
    try {
      const [history, status] = await Promise.all([
        syncHistory(kind, id),
        loadSync(),
      ]);
      if (history.data && status.data) {
        setRuns(history.data);
        setSnapshot(status.data);
      } else setError("요청하지 못했습니다. 다시 시도해 주세요.");
    } catch {
      setError("요청하지 못했습니다. 다시 시도해 주세요.");
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    let stopped = false;
    void Promise.all([syncHistory(kind, id), loadSync()])
      .then(([history, status]) => {
        if (stopped) return;
        if (history.data && status.data) {
          setRuns(history.data);
          setSnapshot(status.data);
        } else setError("요청하지 못했습니다. 다시 시도해 주세요.");
      })
      .catch(
        () => !stopped && setError("요청하지 못했습니다. 다시 시도해 주세요."),
      );
    return () => {
      stopped = true;
    };
  }, [kind, id]);
  useEffect(() => {
    if (!pending || !["queued", "running"].includes(pending.status)) return;
    let stopped = false;
    const timer = setInterval(() => {
      void syncRun(pending.id)
        .then(async (result) => {
          if (stopped) return;
          if (!result.data) {
            setError("요청하지 못했습니다. 다시 시도해 주세요.");
            return;
          }
          if (result.data.status === "succeeded") {
            const [history, status] = await Promise.all([
              syncHistory(kind, id),
              loadSync(),
            ]);
            if (stopped) return;
            if (history.data && status.data) {
              setRuns(history.data);
              setSnapshot(status.data);
            }
            setSelected(null);
            setSuccess(true);
            router.refresh();
            onUpdated?.();
          } else if (result.data.status === "failed")
            setError(
              "롤백하지 못했습니다. 연결 관계와 최신 상태를 확인한 후 다시 시도하세요.",
            );
          setPending(result.data);
        })
        .catch(
          () =>
            !stopped && setError("요청하지 못했습니다. 다시 시도해 주세요."),
        );
    }, 2000);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [pending, kind, id, router, onUpdated]);
  const active = Boolean(
    pending && ["queued", "running"].includes(pending.status),
  );
  const current = snapshot?.graph.resources.find(
    (r) => r.kind === kind && r.id === id,
  );
  const before = current ? currentItem(current) : null;
  const after = selected?.resources?.[0]?.after ?? null;
  const unchanged = (run: Run) =>
    JSON.stringify(before) ===
    JSON.stringify(run.resources?.[0]?.after ?? null);
  let blocked = false;
  if (selected && snapshot) {
    try {
      restoreResource(
        snapshot.graph,
        { ...snapshot.graph, resources: after ? [after] : [] },
        kind,
        id,
      );
    } catch {
      blocked = true;
    }
  }
  async function apply() {
    if (!selected || !snapshot) return;
    setBusy(true);
    setError("");
    try {
      const result = await rollbackSync(
        selected.id,
        kind,
        id,
        snapshot.dbRevision,
      );
      if (!result.data) {
        setError(
          result.error === "CONFLICT"
            ? "버전이 변경되었습니다. 새로고침 후 다시 검토하세요."
            : "롤백하지 못했습니다. 연결 관계와 최신 상태를 확인한 후 다시 시도하세요.",
        );
        setConfirmed(false);
      } else {
        setPending(result.data);
        if (result.data.status === "succeeded") {
          setSelected(null);
          setSuccess(true);
          await refresh();
          router.refresh();
          onUpdated?.();
        } else if (result.data.status === "failed")
          setError(
            "롤백하지 못했습니다. 연결 관계와 최신 상태를 확인한 후 다시 시도하세요.",
          );
      }
    } catch {
      setError("요청하지 못했습니다. 다시 시도해 주세요.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      title={t(selected ? "영향도 검토" : "동기화 이력")}
      description={`${t(kindLabel[kind])} · ${name} · ${id}`}
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      busy={busy || active}
      trigger={<button hidden aria-label={t("동기화 이력")} />}
    >
      <div className="resource-history">
        <div className="sync-toolbar">
          <span className="muted">
            {environment} / {region}
          </span>
          <Button
            size="sm"
            variant="secondary"
            disabled={busy || active}
            onClick={async () => {
              setSelected(null);
              setConfirmed(false);
              await refresh();
            }}
          >
            {t("새로고침")}
          </Button>
        </div>
        {error && <p role="alert">{t(error)}</p>}
        {success && !selected && (
          <p role="status">{t("선택한 리소스를 복원했습니다.")}</p>
        )}
        {active && <p role="status">{t("롤백 진행 중…")}</p>}
        {!runs && !error && <p role="status">{t("불러오는 중…")}</p>}
        {selected ? (
          <>
            <p className="sync-notice">
              {t("이 리소스만 선택한 revision으로 복원합니다.")}{" "}
              <strong>revision {selected.dbRevision}</strong>
            </p>
            <p>
              <code>{selected.commit}</code>
            </p>
            <DefinitionDiff before={before} after={after} />
            {snapshot && (
              <ImpactExplorer graph={snapshot.graph} kind={kind} id={id} />
            )}
            {blocked && (
              <p role="alert">
                {t("연결된 정책 또는 하위 리소스가 있어 복원할 수 없습니다.")}
              </p>
            )}
            <label className="sync-confirm">
              <input
                type="checkbox"
                checked={confirmed}
                disabled={busy || active || blocked}
                onChange={(e) => setConfirmed(e.target.checked)}
              />
              {t("복원할 revision과 적용 범위를 확인했습니다.")}
            </label>
            <div className="ui-dialog-footer">
              <Button
                variant="secondary"
                disabled={busy || active}
                onClick={() => {
                  setSelected(null);
                  setConfirmed(false);
                  setError("");
                }}
              >
                {t("돌아가기")}
              </Button>
              <Button
                disabled={
                  !confirmed || busy || active || blocked || unchanged(selected)
                }
                loading={busy || active}
                onClick={apply}
              >
                {t("롤백 적용")}
              </Button>
            </div>
          </>
        ) : (
          <>
            <p>
              {t(
                "이 리소스의 변경 이력입니다. revision을 선택하면 변경 내용을 확인할 수 있습니다.",
              )}
            </p>
            {runs?.length === 0 && (
              <p className="sync-notice">
                {t("이 리소스의 동기화 이력이 없습니다.")}
              </p>
            )}
            <div className="sync-history-list">
              {runs?.map((run) => {
                const change = run.resources![0];
                const baseline = run.phase === "baseline";
                return (
                  <details key={run.id} className="sync-history-entry">
                    <summary>
                      <span>
                        <strong>revision {run.dbRevision}</strong>
                        <small>
                          {t(
                            baseline
                              ? "최초 동기화 이전"
                              : run.rollbackOf
                                ? "롤백"
                                : !change.after
                                  ? "삭제"
                                  : !change.before
                                    ? "추가"
                                    : "수정",
                          )}
                          {!baseline && ` · ${t(run.status)}`}
                        </small>
                      </span>
                      <span>
                        {run.completedAt && (
                          <DateValue value={run.completedAt} time />
                        )}
                        {unchanged(run) && <small>{t("현재와 동일")}</small>}
                      </span>
                    </summary>
                    <div className="sync-history-content">
                      <p className="muted">
                        {t("Git commit")} · <code>{run.commit}</code>
                      </p>
                      {!baseline && (
                        <DefinitionDiff
                          before={change.before}
                          after={change.after}
                        />
                      )}
                      {run.status === "succeeded" && (
                        <Button
                          variant="secondary"
                          size="sm"
                          disabled={busy || active || unchanged(run)}
                          onClick={() => {
                            setSelected(run);
                            setConfirmed(false);
                            setError("");
                            setSuccess(false);
                          }}
                        >
                          {t("이 revision으로 롤백")}
                        </Button>
                      )}
                    </div>
                  </details>
                );
              })}
            </div>
            {mode === "demo" && (
              <p className="muted">
                {t("예제 이력은 현재 세션에서만 유지됩니다.")}
              </p>
            )}
          </>
        )}
      </div>
    </Dialog>
  );
}
