"use client";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { DateValue, useI18n } from "@/i18n/provider";
import { ResourceImpact } from "../authorization/resource-impact";
import { SubjectImpact } from "../authorization/subject-impact-view";
import { kindLabel, type Run } from "../resource-sync/model";
import { prepareSync, reviewSync, applySync, syncPlanRun } from "./actions";
import {
  buildPlan,
  keyOf,
  type Context,
  type Preview,
  type Selection,
} from "./model";
import "../resource-sync/styles.css";
import "./styles.css";

const errors: Record<string, string> = {
  CONFLICT: "버전이 변경되었습니다. 대상을 새로 불러와 다시 검토하세요.",
  EXPIRED: "검토가 만료되었습니다. 대상을 새로 불러와 다시 검토하세요.",
  BLOCKED: "차단된 변경을 먼저 해결하세요.",
  FORBIDDEN: "접근 권한이 없습니다",
  UNAUTHENTICATED: "로그인이 필요합니다",
  REQUEST_FAILED: "요청하지 못했습니다. 다시 시도해 주세요.",
};
const operations: Record<string, string> = {
  create: "추가",
  update: "수정",
  delete: "삭제",
  unchanged: "변경 없음",
};
const reasons = {
  selected: "선택한 리소스",
  policy: "정책 연결 리소스",
  parent: "필수 상위 리소스",
};
const fields: Record<string, string> = {
  name: "이름",
  description: "설명",
  path: "경로",
  method: "HTTP 메서드",
  parentId: "상위 리소스",
  state: "정의 상태",
  version: "버전",
  effect: "허용/거부",
  resources: "연결 리소스",
  processors: "전처리·후처리",
};

function Changes({
  before,
  after,
}: {
  before: object | null;
  after: object | null;
}) {
  const { t } = useI18n();
  const previous = before as Record<string, unknown> | null;
  const next = after as Record<string, unknown> | null;
  const value = (v: unknown) =>
    v == null || v === ""
      ? "—"
      : typeof v === "object"
        ? JSON.stringify(v, null, 2)
        : String(v);
  return (
    <table>
      <thead>
        <tr>
          <th>{t("필드")}</th>
          <th>Synced</th>
          <th>Out of sync</th>
        </tr>
      </thead>
      <tbody>
        {Object.entries(fields)
          .filter(
            ([key]) =>
              JSON.stringify(previous?.[key]) !== JSON.stringify(next?.[key]),
          )
          .map(([key, label]) => (
            <tr key={key}>
              <th>{t(label)}</th>
              <td>
                <pre>{value(previous?.[key])}</pre>
              </td>
              <td>
                <pre>{value(next?.[key])}</pre>
              </td>
            </tr>
          ))}
      </tbody>
    </table>
  );
}

export function SyncDialog({
  selection,
  onClose,
  onApplied,
}: {
  selection: Selection;
  onClose: () => void;
  onApplied: (run: Run) => void;
}) {
  const { t } = useI18n();
  const [context, setContext] = useState<Context | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [run, setRun] = useState<Run | null>(null);
  const workflow = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const dialog = workflow.current?.closest<HTMLElement>(".ui-dialog");
    if (dialog) dialog.scrollTop = 0;
    workflow.current
      ?.querySelector<HTMLElement>('[aria-current="step"]')
      ?.focus({ preventScroll: true });
  }, [preview?.token]);
  const callbacks = useRef({ onApplied, onClose });
  useEffect(() => {
    callbacks.current = { onApplied, onClose };
  }, [onApplied, onClose]);
  useEffect(() => {
    let cancelled = false;
    void prepareSync(selection)
      .then((r) => {
        if (!cancelled) {
          if (r.data) setContext(r.data);
          else setError(r.error!);
        }
      })
      .catch(() => !cancelled && setError("REQUEST_FAILED"));
    return () => {
      cancelled = true;
    };
  }, [selection]);
  const active = Boolean(run && ["queued", "running"].includes(run.status));
  useEffect(() => {
    if (!run || !["queued", "running"].includes(run.status)) return;
    let cancelled = false;
    const timer = setInterval(() => {
      void syncPlanRun(run.id)
        .then((r) => {
          if (cancelled) return;
          if (r.data) {
            setRun(r.data);
            if (r.data.status === "succeeded") {
              callbacks.current.onApplied(r.data);
              callbacks.current.onClose();
            }
          } else setError(r.error!);
        })
        .catch(() => !cancelled && setError("REQUEST_FAILED"));
    }, 2000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [run]);
  const current = preview?.context ?? context;
  let plan: ReturnType<typeof buildPlan> | null = null;
  try {
    if (current) plan = buildPlan(current);
  } catch {
    /* Fail closed if the source snapshots cannot be combined. */
  }
  async function reload() {
    setBusy(true);
    setError("");
    setPreview(null);
    setConfirmed(false);
    setRun(null);
    setContext(null);
    try {
      const r = await prepareSync(selection);
      if (r.data) setContext(r.data);
      else setError(r.error!);
    } catch {
      setError("REQUEST_FAILED");
    } finally {
      setBusy(false);
    }
  }
  async function review() {
    if (!context) return;
    setBusy(true);
    setError("");
    try {
      const r = await reviewSync({
        selection: context.selection,
        revision: context.resource.dbRevision,
        resourceCommit: context.resource.candidateCommit,
        resourceDigest: context.resource.digest,
        policyCommit: context.policy?.candidateCommit ?? "",
        policyDigest: context.policy?.digest ?? "",
      });
      if (r.data) {
        setPreview(r.data);
        setConfirmed(false);
      } else setError(r.error!);
    } catch {
      setError("REQUEST_FAILED");
    } finally {
      setBusy(false);
    }
  }
  async function apply() {
    if (!preview || !confirmed) return;
    setBusy(true);
    setError("");
    try {
      const r = await applySync(preview.token);
      if (r.data) {
        setRun(r.data);
        if (r.data.status === "succeeded") {
          onApplied(r.data);
          onClose();
        }
      } else setError(r.error!);
    } catch {
      setError("REQUEST_FAILED");
    } finally {
      setBusy(false);
    }
  }
  const policyMode = selection.mode === "policies";
  return (
    <Dialog
      title={t("영향도 검토")}
      description={t(
        policyMode
          ? "선택한 정책과 연결된 리소스를 동기화합니다. 변경사항과 영향도를 검토한 뒤 적용하세요."
          : "선택한 리소스를 동기화합니다. 변경사항과 영향도를 검토한 뒤 적용하세요.",
      )}
      open
      busy={busy || active}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
      trigger={<button hidden aria-label={t("영향도 검토")} />}
    >
      <div className="sync-workflow" ref={workflow}>
        <ol className="sync-workflow-steps" aria-label={t("동기화 단계")}>
          <li tabIndex={-1} aria-current={!preview ? "step" : undefined}>
            <span>1</span>
            {t("대상 확인")}
          </li>
          <li tabIndex={-1} aria-current={preview ? "step" : undefined}>
            <span>2</span>
            {t("변경사항 및 영향도 검토")}
          </li>
        </ol>
        {error && (
          <div role="alert" className="sync-blockers">
            {t(errors[error] ?? errors.REQUEST_FAILED)}
            {!active && (
              <Button variant="secondary" disabled={busy} onClick={reload}>
                {t("대상 새로고침")}
              </Button>
            )}
          </div>
        )}
        {!current && !error && <p role="status">{t("불러오는 중…")}</p>}
        {current && !plan && <p role="alert">{t(errors.CONFLICT)}</p>}
        {current && plan && (
          <>
            <p className="muted">
              {current.resource.environment} / {current.resource.region} ·
              revision {current.resource.dbRevision}
            </p>
            <div className="sync-workflow-summary">
              <strong>
                {t("정책")} {plan.policies.length} · {t("리소스")}{" "}
                {plan.resources.length}
              </strong>
              <span>
                {t("적용할 변경")}{" "}
                {plan.changedPolicies.length + plan.changedResources.length} ·{" "}
                {t("변경 없는 대상은 유지됩니다.")}
              </span>
            </div>
            {!preview ? (
              <>
                <p>
                  {t(
                    policyMode
                      ? "정책에 연결된 리소스와 필수 상위 리소스를 함께 검토합니다."
                      : "선택한 리소스와 필요한 상위 리소스만 동기화합니다.",
                  )}
                </p>
                <div className="sync-workflow-targets">
                  <table aria-label={t("동기화 대상")}>
                    <thead>
                      <tr>
                        <th>{t("대상")}</th>
                        <th>{t("포함 사유")}</th>
                        <th>{t("변경")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {plan.policies.map((p) => (
                        <tr key={p.key}>
                          <td>
                            <strong>{p.after.name || p.after.id}</strong>
                            <small>
                              {t("정책")} · {p.after.id}
                            </small>
                          </td>
                          <td>{t("선택한 정책")}</td>
                          <td>
                            <span className={`sync-badge ${p.operation}`}>
                              {t(operations[p.operation])}
                            </span>
                          </td>
                        </tr>
                      ))}
                      {plan.resources.map((r) => (
                        <tr key={keyOf(r)}>
                          <td>
                            <strong>{r.after?.name || r.id}</strong>
                            <small>
                              {t(kindLabel[r.kind])} · {r.id}
                            </small>
                          </td>
                          <td>
                            {t(reasons[r.reason])}
                            {!r.managed && (
                              <small>
                                {t("Git 정의 없음 · 현재 상태 유지")}
                              </small>
                            )}
                          </td>
                          <td>
                            <span className={`sync-badge ${r.operation}`}>
                              {t(operations[r.operation])}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {!!plan.blockers.length && (
                  <div role="alert" className="sync-blockers">
                    <strong>{t("동기화 차단")}</strong>
                    {plan.blockers.map((b) => (
                      <p key={b}>
                        <code>{b}</code>
                      </p>
                    ))}
                  </div>
                )}
                {!plan.changedResources.length &&
                  !plan.changedPolicies.length && (
                    <p>{t("선택 범위에 적용할 변경이 없습니다.")}</p>
                  )}
              </>
            ) : (
              <>
                <p className="muted">
                  {t("검토 유효 기한")}:{" "}
                  <DateValue value={preview.expiresAt} time />
                </p>
                <section className="sync-workflow-impact">
                  {policyMode ? (
                    <SubjectImpact
                      graph={current.policy!.graph}
                      scope={{
                        policyIds: plan.policies.map((p) => p.after.id),
                      }}
                    />
                  ) : (
                    <ResourceImpact
                      graph={current.resource.graph}
                      resources={plan.resources}
                    />
                  )}
                </section>
                {policyMode && !!plan.changedResources.length && (
                  <details className="sync-workflow-extra">
                    <summary>{t("리소스 변경의 추가 영향")}</summary>
                    <p>
                      {t(
                        "함께 변경되는 리소스를 사용하는 다른 정책의 연결 관계도 확인하세요.",
                      )}
                    </p>
                    <ResourceImpact
                      graph={current.resource.graph}
                      resources={plan.changedResources}
                    />
                  </details>
                )}
                <section className="sync-review-list">
                  <h3>{t("변경 전후")}</h3>
                  {plan.changedPolicies.map((p) => (
                    <details key={p.key}>
                      <summary>
                        <strong>{p.after.name || p.after.id}</strong> ·{" "}
                        {t("정책")} · {t(operations[p.operation])}
                      </summary>
                      <Changes
                        before={p.before}
                        after={p.operation === "delete" ? null : p.after}
                      />
                    </details>
                  ))}
                  {plan.changedResources.map((r) => (
                    <details key={keyOf(r)}>
                      <summary>
                        <strong>{r.after?.name || r.id}</strong> ·{" "}
                        {t(kindLabel[r.kind])} · {t(operations[r.operation])}
                      </summary>
                      <Changes
                        before={r.before}
                        after={r.operation === "delete" ? null : r.after}
                      />
                    </details>
                  ))}
                </section>
                <label className="sync-confirm">
                  <input
                    type="checkbox"
                    checked={confirmed}
                    disabled={busy || active}
                    onChange={(e) => setConfirmed(e.target.checked)}
                  />
                  {t("변경사항과 영향 범위를 확인했습니다.")}
                </label>
              </>
            )}
            {run && (
              <p role="status">
                {run.status} · {run.phase} · {run.message}
              </p>
            )}
            <div className="sync-workflow-footer">
              <Button
                variant="secondary"
                disabled={busy || active}
                onClick={() => {
                  if (preview) {
                    setPreview(null);
                    setConfirmed(false);
                    setRun(null);
                    setError("");
                  } else onClose();
                }}
              >
                {t(preview ? "대상으로 돌아가기" : "취소")}
              </Button>
              {preview ? (
                <Button
                  loading={busy || active}
                  disabled={!confirmed || busy || active || Boolean(run)}
                  onClick={apply}
                >
                  {t("동기화 적용")}
                </Button>
              ) : (
                <Button
                  loading={busy}
                  disabled={
                    busy ||
                    !!plan.blockers.length ||
                    (!plan.changedResources.length &&
                      !plan.changedPolicies.length)
                  }
                  onClick={review}
                >
                  {t("변경사항 및 영향도 검토")}
                </Button>
              )}
              {run?.status === "failed" && (
                <Button onClick={reload}>{t("대상 새로고침")}</Button>
              )}
            </div>
          </>
        )}
      </div>
    </Dialog>
  );
}
