"use client";
import { PolicyImpactTree } from "../authorization/impact-tree";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { RollbackButton } from "../resource-sync/rollback-button";
import { DateValue, useI18n } from "@/i18n/provider";
import {
  loadPolicySync,
  previewPolicySync,
  executePolicySync,
  policySyncRun,
  policySyncHistory,
  rollbackPolicySync,
} from "./actions";
import {
  diff,
  resourceLabel,
  type Snapshot,
  type Preview,
  type Run,
} from "./model";
import "../resource-sync/styles.css";

const messages: Record<string, string> = {
  CONFLICT: "버전이 변경되었습니다. 새로고침 후 다시 검토하세요.",
  EXPIRED: "검토가 만료되었습니다. 다시 Sync를 눌러 검토하세요.",
  BLOCKED: "차단된 변경을 먼저 해결하세요.",
  FORBIDDEN: "접근 권한이 없습니다",
  UNAUTHENTICATED: "로그인이 필요합니다",
  REQUEST_FAILED: "요청하지 못했습니다. 다시 시도해 주세요.",
};

export function PolicySyncScreen() {
  const { t, mode } = useI18n();
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [run, setRun] = useState<Run | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [confirmed, setConfirmed] = useState(false);
  const [history, setHistory] = useState<Run[] | null>(null);
  const [rollbackId, setRollbackId] = useState("");

  async function refresh() {
    setBusy(true);
    setError("");
    try {
      const r = await loadPolicySync();
      if (r.data) setSnapshot(r.data);
      else setError(r.error!);
      const h = await policySyncHistory();
      if (h.data) setHistory(h.data);
    } catch {
      setError("REQUEST_FAILED");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void loadPolicySync()
      .then((r) => (r.data ? setSnapshot(r.data) : setError(r.error!)))
      .catch(() => setError("REQUEST_FAILED"));
    void policySyncHistory()
      .then((r) => {
        if (r.data) setHistory(r.data);
      })
      .catch(() => undefined);
  }, []);
  useEffect(() => {
    if (!run || !["queued", "running"].includes(run.status)) return;
    let stopped = false;
    const timer = setInterval(() => {
      void policySyncRun(run.id)
        .then((r) => {
          if (stopped) return;
          if (r.data) {
            setRun(r.data);
            if (r.data.status === "succeeded") void refresh();
          } else setError(r.error!);
        })
        .catch(() => !stopped && setError("REQUEST_FAILED"));
    }, 2000);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [run]);

  let result: ReturnType<typeof diff> | null = null;
  let invalid = false;
  try {
    if (snapshot) result = diff(snapshot);
  } catch {
    invalid = true;
  }
  const changes = result?.rows.filter((r) => r.operation !== "unchanged") ?? [];
  const rows = changes.filter(
    (r) =>
      (filter === "all" || r.operation === filter) &&
      `${r.after.name} ${r.after.id} ${r.after.version}`
        .toLowerCase()
        .includes(query.trim().toLowerCase()),
  );
  const previewRows = preview
    ? diff(preview.snapshot).rows.filter((r) => r.operation !== "unchanged")
    : [];
  const users = new Set(
    previewRows.flatMap((row) =>
      row.impact.roles.flatMap((role) => [
        ...role.users.map((u) => u.id),
        ...role.organizations.flatMap((o) => o.members.map((u) => u.id)),
      ]),
    ),
  );
  const active = Boolean(run && ["queued", "running"].includes(run.status));
  const syncState = changes.length ? "Out of sync" : "Synced";
  const operation = (op: string) =>
    t(
      (
        {
          create: "추가",
          update: "수정",
          delete: "삭제",
          unchanged: "변경 없음",
        } as Record<string, string>
      )[op],
    );

  async function review() {
    if (!snapshot) return;
    setBusy(true);
    setError("");
    try {
      const r = await previewPolicySync(
        snapshot.candidateCommit,
        snapshot.digest,
        snapshot.dbRevision,
      );
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
    if (!preview) return;
    setBusy(true);
    setError("");
    try {
      const r = await executePolicySync(preview.token);
      if (r.data) {
        setRun(r.data);
        setPreview(null);
        if (r.data.status === "succeeded") await refresh();
      } else setError(r.error!);
    } catch {
      setError("REQUEST_FAILED");
    } finally {
      setBusy(false);
    }
  }
  async function rollback(runId: string) {
    setRollbackId(runId);
    setError("");
    try {
      const r = await rollbackPolicySync(runId);
      if (r.data) {
        setRun(r.data);
        await refresh();
        return true;
      } else {
        setError(r.error!);
        return false;
      }
    } catch {
      setError("REQUEST_FAILED");
      return false;
    } finally {
      setRollbackId("");
    }
  }

  return (
    <div className="sync-page">
      <Link className="identity-link" href="/policies">
        ← {t("정책")}
      </Link>
      <div className="sync-heading">
        <div>
          <p className="muted">GITOPS / POLICIES</p>
          <h1>{t("정책 Git 동기화")}</h1>
          <p>
            {t(
              "정책의 리소스 접근 범위와 전처리·후처리 구성을 확인하고 검토 후 Sync합니다.",
            )}
          </p>
        </div>
        <Button variant="secondary" disabled={busy || active} onClick={refresh}>
          {t("새로고침")}
        </Button>
      </div>
      {mode === "demo" && (
        <p className="sync-notice">
          {t(
            "예제 모드: 외부 config 서버를 호출하지 않고 세션 데이터에 적용합니다.",
          )}
        </p>
      )}
      {error && (
        <p role="alert">
          {t(messages[error] ?? messages.REQUEST_FAILED)}{" "}
          {error === "UNAUTHENTICATED" && (
            <Link href="/login">{t("로그인")}</Link>
          )}
        </p>
      )}
      {!snapshot && !error && <p role="status">{t("불러오는 중…")}</p>}
      {invalid && (
        <p role="alert">
          {t("YAML 정의서가 유효하지 않습니다. 환경·리전과 참조를 확인하세요.")}
        </p>
      )}
      {snapshot && (
        <>
          <div className="sync-versions">
            <section>
              <span>{t("상태")}</span>
              <strong>{t(syncState)}</strong>
              <code>
                {changes.length
                  ? `${changes.length} ${t("변경 사항")}`
                  : t("변경 없음")}
              </code>
            </section>
            <section>
              <span>{t("Synced")}</span>
              <strong>revision {snapshot.dbRevision}</strong>
              <code>{snapshot.appliedCommit}</code>
            </section>
            <section>
              <span>{t(syncState)}</span>
              <strong>{snapshot.candidateCommit}</strong>
              <code>SHA-256 {snapshot.digest.slice(0, 16)}…</code>
              <span>
                {snapshot.environment} / {snapshot.region} · {t("수동 적용")}
              </span>
            </section>
          </div>
          {run && (
            <div className="sync-notice" role="status">
              <strong>
                {t("동기화 실행")}: {run.status}
              </strong>
              <p>
                {t("적용 revision")}: {run.dbRevision} · {run.commit}
              </p>
            </div>
          )}
          {!!result?.blockers.length && (
            <div role="alert" className="sync-blockers">
              <strong>{t("동기화 차단")}</strong>
              {result.blockers.map((b) => (
                <p key={b}>
                  {t(
                    b.startsWith("ROLE_REFERENCE")
                      ? "역할이 사용하는 정책은 삭제할 수 없습니다."
                      : b.startsWith("RESOURCE_REFERENCE")
                        ? "존재하지 않는 리소스 참조를 먼저 해결하세요."
                        : "config 준비 상태와 synced revision을 확인하세요.",
                  )}{" "}
                  <code>{b}</code>
                </p>
              ))}
            </div>
          )}
          <div className="sync-toolbar">
            <label>
              {t("정책 검색")}
              <input value={query} onChange={(e) => setQuery(e.target.value)} />
            </label>
            <label>
              {t("변경 유형")}
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              >
                {["all", "create", "update", "delete", "unchanged"].map((v) => (
                  <option key={v} value={v}>
                    {v === "all" ? t("전체") : operation(v)}
                  </option>
                ))}
              </select>
            </label>
            <span>
              {t("변경 정책")} · {changes.length}
            </span>
            <Button
              disabled={
                busy ||
                active ||
                invalid ||
                !changes.length ||
                !!result?.blockers.length
              }
              onClick={review}
            >
              Sync · {t("영향도 검토")} · {changes.length}
            </Button>
          </div>
          <div className="sync-diffs">
            {rows.map((row) => (
              <details key={row.key}>
                <summary>
                  <span className={`sync-badge ${row.operation}`}>
                    {operation(row.operation)}
                  </span>
                  <strong>{row.after.name || row.after.id}</strong>
                  <code>{row.after.id}</code>
                  <span>
                    {t("정책 효과")} ·{" "}
                    {t(row.after.effect === "allow" ? "허용" : "거부")}
                  </span>
                  <span>
                    {t("리소스")} {row.after.resources.length} · pre{" "}
                    {row.after.processors.pre.length} · post{" "}
                    {row.after.processors.post.length}
                  </span>
                  <span>
                    {t("역할")} {row.impact.roles.length} · {t("사용자")}{" "}
                    {row.impact.userCount}
                  </span>
                </summary>
                <table>
                  <thead>
                    <tr>
                      <th>{t("필드")}</th>
                      <th>{t("Synced")}</th>
                      <th>{t("Out of sync")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(["version", "name", "description", "effect"] as const)
                      .filter(
                        (f) =>
                          row.operation === "create" ||
                          row.operation === "delete" ||
                          row.before?.[f] !== row.after[f],
                      )
                      .map((f) => (
                        <tr key={f}>
                          <th>{f}</th>
                          <td>{row.before?.[f] || "—"}</td>
                          <td>
                            {row.after.state === "absent"
                              ? "—"
                              : row.after[f] || "—"}
                          </td>
                        </tr>
                      ))}
                    <tr>
                      <th>{t("리소스")}</th>
                      <td>{row.before?.resources.length ?? 0}</td>
                      <td>{row.after.resources.length}</td>
                    </tr>
                    <tr>
                      <th>{t("Processor")}</th>
                      <td>
                        pre {row.before?.processors.pre.length ?? 0} · post{" "}
                        {row.before?.processors.post.length ?? 0}
                        <pre>
                          {JSON.stringify(
                            row.before?.processors ?? { pre: [], post: [] },
                            null,
                            2,
                          )}
                        </pre>
                      </td>
                      <td>
                        pre {row.after.processors.pre.length} · post{" "}
                        {row.after.processors.post.length}
                        <pre>
                          {JSON.stringify(row.after.processors, null, 2)}
                        </pre>
                      </td>
                    </tr>
                  </tbody>
                </table>
                <div className="sync-review-list">
                  <section>
                    <h3>{t("Out of sync 리소스")}</h3>
                    {row.after.resources.length ? (
                      row.after.resources.map((r) => (
                        <p key={`${r.kind}:${r.id}`}>
                          {t(resourceLabel[r.kind])} · <code>{r.id}</code>
                        </p>
                      ))
                    ) : (
                      <p>{t("없음")}</p>
                    )}
                  </section>
                  <section>
                    <h3>{t("엔드포인트 요청·응답 처리")}</h3>
                    <p>
                      {t(
                        "연결된 엔드포인트에만 적용됩니다. 다른 리소스는 접근 권한만 평가합니다.",
                      )}
                    </p>
                    {[...row.after.processors.pre, ...row.after.processors.post]
                      .length ? (
                      <>
                        {row.after.processors.pre.map((p) => (
                          <div
                            key={`pre:${p.endpointId}:${p.target}:${p.handler}`}
                          >
                            <p>
                              <Link href={`/service-endpoints/${p.endpointId}`}>
                                {p.endpointId}
                              </Link>{" "}
                              · <code>{p.target}</code> →{" "}
                              <code>{p.handler}</code> · {t(p.mode)}
                            </p>
                            <pre>{JSON.stringify(p.config, null, 2)}</pre>
                          </div>
                        ))}
                        {row.after.processors.post.map((p) => (
                          <div
                            key={`post:${p.endpointId}:${p.target}:${p.handler}`}
                          >
                            <p>
                              <Link href={`/service-endpoints/${p.endpointId}`}>
                                {p.endpointId}
                              </Link>{" "}
                              · <code>{p.target}</code> →{" "}
                              <code>{p.handler}</code> · {t(p.mode)}
                            </p>
                            <pre>{JSON.stringify(p.config, null, 2)}</pre>
                          </div>
                        ))}
                      </>
                    ) : (
                      <p>{t("없음")}</p>
                    )}
                  </section>
                </div>
              </details>
            ))}
            {!rows.length && <p>{t("연결된 항목이 없습니다")}</p>}
          </div>
          <details className="sync-yaml">
            <summary>{t("YAML 정의서 보기")}</summary>
            <pre>{snapshot.yaml}</pre>
          </details>
          <div className="sync-catalog">
            <table aria-label={t("동기화 이력")}>
              <thead>
                <tr>
                  <th>{t("Revision")}</th>
                  <th>{t("상태")}</th>
                  <th>{t("적용 완료 시간")}</th>
                  <th>{t("작업")}</th>
                </tr>
              </thead>
              <tbody>
                {(history ?? []).map((r) => (
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
                        <RollbackButton
                          revision={r.dbRevision}
                          commit={r.commit}
                          disabled={Boolean(rollbackId)}
                          onConfirm={() => rollback(r.id)}
                        />
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {history && !history.length && (
              <p>{t("동기화 이력이 없습니다.")}</p>
            )}
          </div>
        </>
      )}
      <Dialog
        title={t("정책 영향도 검토")}
        description={t("검토한 Out of sync 변경에 대해서만 적용합니다.")}
        trigger={
          <button type="button" hidden aria-label={t("정책 영향도 검토")} />
        }
        open={Boolean(preview)}
        busy={busy}
        onOpenChange={(v) => {
          if (!v) setPreview(null);
        }}
      >
        {preview && (
          <div className="sync-review">
            {error && (
              <p role="alert">
                {t(messages[error] ?? messages.REQUEST_FAILED)}
              </p>
            )}
            <p>
              <strong>
                {preview.snapshot.environment} / {preview.snapshot.region}
              </strong>{" "}
              · {t("Synced")} revision {preview.snapshot.dbRevision} →{" "}
              {preview.snapshot.candidateCommit}
            </p>
            <p>
              {t("검토 유효 기한")}:{" "}
              <DateValue value={preview.expiresAt} time />
            </p>
            <div className="sync-notice">
              {t("변경 정책")} {previewRows.length} · {t("영향 사용자")}{" "}
              {users.size}
              <p>
                {t(
                  "연결된 엔드포인트에만 적용됩니다. 다른 리소스는 접근 권한만 평가합니다.",
                )}
              </p>
            </div>
            <div className="sync-review-list">
              {previewRows.map((row) => (
                <section key={row.key}>
                  <h3>
                    {operation(row.operation)} ·{" "}
                    {row.after.name || row.after.id}
                  </h3>
                  <p>
                    {t("리소스")} {row.after.resources.length} · pre{" "}
                    {row.after.processors.pre.length} · post{" "}
                    {row.after.processors.post.length}
                  </p>
                  {!row.impact.roles.length ? (
                    <p>
                      {t(
                        "연결된 역할이 없습니다. 정책 추가는 권한을 자동 부여하지 않습니다.",
                      )}
                    </p>
                  ) : (
                    <PolicyImpactTree
                      name={row.after.name || row.after.id}
                      id={row.after.id}
                      roles={row.impact.roles}
                    />
                  )}
                </section>
              ))}
            </div>
            <label className="sync-confirm">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
              />
              {t(
                "정책 리소스와 processor 변경, 연결 역할·사용자 영향을 확인했습니다.",
              )}
            </label>
            <Button disabled={!confirmed || busy} onClick={apply}>
              {t("최종 적용")}
            </Button>
          </div>
        )}
      </Dialog>
    </div>
  );
}
