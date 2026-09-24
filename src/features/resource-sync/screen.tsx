"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { DateValue, useI18n } from "@/i18n/provider";
import { loadSync, previewSync, executeSync, syncRun } from "./actions";
import {
  diff,
  kindLabel,
  type Snapshot,
  type Preview,
  type Run,
} from "./model";
import "./styles.css";
const messages: Record<string, string> = {
  CONFLICT: "버전이 변경되었습니다. 새로고침 후 다시 검토하세요.",
  EXPIRED: "검토가 만료되었습니다. 다시 Sync를 눌러 검토하세요.",
  BLOCKED: "차단된 변경을 먼저 해결하세요.",
  FORBIDDEN: "접근 권한이 없습니다",
  UNAUTHENTICATED: "로그인이 필요합니다",
  REQUEST_FAILED: "요청하지 못했습니다. 다시 시도해 주세요.",
};
export function ResourceSyncScreen() {
  const { t, mode } = useI18n();
  const params = useSearchParams();
  const router = useRouter();
  const tab = params.get("tab") === "changes" ? "changes" : "current";
  const kind = params.get("type") ?? "all";
  const selectedId = params.get("resource");
  function navigate(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    next.set(key, value);
    if (key !== "page") next.delete("page");
    next.delete("resource");
    router.replace("/resources?" + next.toString(), { scroll: false });
  }
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [run, setRun] = useState<Run | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [confirmed, setConfirmed] = useState(false);
  async function refresh() {
    setBusy(true);
    setError("");
    try {
      const r = await loadSync();
      if (r.data) setSnapshot(r.data);
      else setError(r.error!);
    } catch {
      setError("REQUEST_FAILED");
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    void loadSync()
      .then((r) => (r.data ? setSnapshot(r.data) : setError(r.error!)))
      .catch(() => setError("REQUEST_FAILED"));
  }, []);
  useEffect(() => {
    if (!run || !["queued", "running"].includes(run.status)) return;
    let stopped = false;
    const timer = setInterval(() => {
      void syncRun(run.id)
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
  const rows =
    result?.rows.filter(
      (r) =>
        r.operation !== "unchanged" &&
        (kind === "all" || r.after.kind === kind) &&
        (!selectedId || r.after.id === selectedId) &&
        (filter === "all" || r.operation === filter) &&
        `${r.after.name} ${r.after.id}`
          .toLowerCase()
          .includes(query.toLowerCase()),
    ) ?? [];
  const catalog = (snapshot?.graph.resources ?? [])
    .filter(
      (r) =>
        (kind === "all" || kind === r.kind) &&
        `${r.name} ${r.id} ${r.path}`
          .toLowerCase()
          .includes(query.trim().toLowerCase()),
    )
    .sort((a, b) =>
      params.get("sort") === "desc"
        ? b.name.localeCompare(a.name)
        : a.name.localeCompare(b.name),
    );
  const pages = Math.max(1, Math.ceil(catalog.length / 10));
  const currentPage = Math.min(
    pages,
    Math.max(1, Number(params.get("page")) || 1),
  );
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
  const active = Boolean(run && ["queued", "running"].includes(run.status));
  const previewRows = preview
    ? diff(preview.snapshot).rows.filter((r) => r.operation !== "unchanged")
    : [];
  const users = new Set(previewRows.flatMap((r) => r.users));
  async function review() {
    if (!snapshot) return;
    setBusy(true);
    setError("");
    try {
      const r = await previewSync(
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
      const r = await executeSync(preview.token);
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
  return (
    <div className="sync-page">
      <div className="sync-heading">
        <div>
          <p className="muted">GITOPS / CLOUD CONFIG</p>
          <h1>{t("리소스 관리")}</h1>
          <p>
            {t(
              "Git 정의서와 현재 DB를 비교하고 검토한 버전을 수동 적용합니다.",
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
            "예제 모드: Argo·Cloud Config를 호출하지 않고 세션 데이터에 적용합니다.",
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
              <span>{t("현재 DB")}</span>
              <strong>revision {snapshot.dbRevision}</strong>
              <code>{snapshot.appliedCommit}</code>
            </section>
            <section>
              <span>{t("Cloud Config 후보")}</span>
              <strong>{snapshot.candidateCommit}</strong>
              <code>SHA-256 {snapshot.digest.slice(0, 16)}…</code>
            </section>
            <section>
              <span>{t("배포 범위")}</span>
              <strong>
                {snapshot.environment} / {snapshot.region}
              </strong>
              <span>
                Auto Sync: {snapshot.autoSync} · Config: {snapshot.cloudConfig}
              </span>
            </section>
          </div>
          {run && (
            <div className="sync-notice" role="status">
              <strong>
                {t("동기화 실행")}: {run.status}
              </strong>
              <p>
                {t("적용 commit")}: {run.commit} · DB {run.dbRevision}
              </p>
              <p>
                {run.phase} ·{" "}
                {run.message === "DEMO_APPLIED"
                  ? t("예제 DB 적용 완료")
                  : run.message}
              </p>
            </div>
          )}
          {!!result?.blockers.length && (
            <div role="alert" className="sync-blockers">
              <strong>{t("동기화 차단")}</strong>
              {result.blockers.map((b) => (
                <p key={b}>
                  {t(
                    b.startsWith("POLICY_REFERENCE")
                      ? "정책이 연결된 리소스는 삭제할 수 없습니다."
                      : b.startsWith("PARENT_REFERENCE")
                        ? "하위 리소스의 상위 참조를 먼저 해결하세요."
                        : b === "AUTO_SYNC_ENABLED"
                          ? "Argo Auto Sync를 먼저 비활성화하세요."
                          : "설정 준비 상태와 DB revision을 확인하세요.",
                  )}{" "}
                  <code>{b}</code>
                </p>
              ))}
            </div>
          )}
          <nav className="sync-tabs" aria-label={t("리소스 보기")}>
            <Button
              variant={tab === "current" ? "primary" : "secondary"}
              aria-pressed={tab === "current"}
              onClick={() => navigate("tab", "current")}
            >
              {t("현재 리소스")} · {snapshot.graph.resources.length}
            </Button>
            <Button
              variant={tab === "changes" ? "primary" : "secondary"}
              aria-pressed={tab === "changes"}
              onClick={() => navigate("tab", "changes")}
            >
              {t("변경 사항")} · {changes.length}
            </Button>
          </nav>
          <div className="sync-toolbar">
            <label>
              {t("리소스 검색")}
              <input
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  if (params.has("page")) navigate("page", "1");
                }}
              />
            </label>
            <label>
              {t("리소스 유형")}
              <select
                value={kind}
                onChange={(e) => navigate("type", e.target.value)}
              >
                <option value="all">{t("전체")}</option>
                {Object.entries(kindLabel).map(([key, label]) => (
                  <option key={key} value={key}>
                    {t(label)}
                  </option>
                ))}
              </select>
            </label>
            {tab === "changes" && (
              <label>
                {t("변경 유형")}
                <select
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                >
                  {["all", "create", "update", "delete", "unchanged"].map(
                    (v) => (
                      <option key={v} value={v}>
                        {v === "all" ? t("전체") : operation(v)}
                      </option>
                    ),
                  )}
                </select>
              </label>
            )}
            <span>
              {t("변경 리소스")} · {changes.length}
            </span>
            {tab === "changes" && (
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
            )}
          </div>
          {tab === "current" ? (
            <div className="sync-catalog">
              <table aria-label={t("현재 리소스")}>
                <thead>
                  <tr>
                    <th
                      aria-sort={
                        params.get("sort") === "desc"
                          ? "descending"
                          : "ascending"
                      }
                    >
                      <Button
                        variant="ghost"
                        onClick={() =>
                          navigate(
                            "sort",
                            params.get("sort") === "desc" ? "asc" : "desc",
                          )
                        }
                      >
                        {t("리소스")} ↕
                      </Button>
                    </th>
                    <th>{t("유형")}</th>
                    <th>{t("상위 리소스")}</th>
                    <th>{t("하위 리소스")}</th>
                    <th>{t("변경 사항")}</th>
                  </tr>
                </thead>
                <tbody>
                  {catalog
                    .slice((currentPage - 1) * 10, currentPage * 10)
                    .map((r) => {
                      const change = changes.find(
                        (c) => c.after.kind === r.kind && c.after.id === r.id,
                      );
                      const parentKind =
                        r.kind === "pages" ? "workspaces" : "services";
                      const parent = snapshot.graph.resources.find(
                        (p) => p.kind === parentKind && p.id === r.parentId,
                      );
                      return (
                        <tr key={`${r.kind}:${r.id}`}>
                          <td>
                            <Link href={`/${r.kind}/${r.id}`}>{r.name}</Link>
                            <small>
                              {r.id}
                              {r.path && ` · ${r.method} ${r.path}`}
                            </small>
                          </td>
                          <td>{t(kindLabel[r.kind])}</td>
                          <td>
                            {parent ? (
                              <Link href={`/${parent.kind}/${parent.id}`}>
                                {parent.name}
                              </Link>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td>
                            {["services", "workspaces"].includes(r.kind) ? (
                              <Link
                                href={`/${r.kind}/${r.id}?tab=${r.kind === "services" ? "endpoints" : "pages"}`}
                              >
                                {
                                  snapshot.graph.resources.filter(
                                    (child) =>
                                      child.parentId === r.id &&
                                      child.kind ===
                                        (r.kind === "services"
                                          ? "service-endpoints"
                                          : "pages"),
                                  ).length
                                }
                                {t("개")}
                              </Link>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td>
                            {change ? (
                              <Link
                                className={`sync-badge ${change.operation}`}
                                href={`/resources?tab=changes&type=${r.kind}&resource=${r.id}`}
                              >
                                {operation(change.operation)} · {t("diff 확인")}
                              </Link>
                            ) : (
                              t("변경 없음")
                            )}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
              {!catalog.length && <p>{t("연결된 항목이 없습니다")}</p>}
              <div className="sync-toolbar sync-pagination">
                <span>
                  {catalog.length} · {currentPage} / {pages}
                </span>
                <div>
                  <Button
                    variant="secondary"
                    disabled={currentPage <= 1}
                    onClick={() => navigate("page", String(currentPage - 1))}
                  >
                    {t("이전")}
                  </Button>{" "}
                  <Button
                    variant="secondary"
                    disabled={currentPage >= pages}
                    onClick={() => navigate("page", String(currentPage + 1))}
                  >
                    {t("다음")}
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <>
              <p className="muted">
                {t(
                  "필터는 조회에만 적용됩니다. Sync는 이 환경·리전의 변경 전체를 적용합니다.",
                )}
              </p>
              {selectedId && (
                <Button
                  variant="secondary"
                  onClick={() => navigate("type", kind)}
                >
                  {t("전체 변경 보기")}
                </Button>
              )}
              <div className="sync-diffs">
                {rows.map((row) => (
                  <details key={row.key} open={Boolean(selectedId)}>
                    <summary>
                      <span className={`sync-badge ${row.operation}`}>
                        {operation(row.operation)}
                      </span>
                      <strong>{row.after.name || row.after.id}</strong>
                      <span>{t(kindLabel[row.after.kind])}</span>
                      <code>{row.after.id}</code>
                      {row.after.parentId && (
                        <span>
                          {t("상위 리소스")}: {row.after.parentId}
                        </span>
                      )}
                      <span>
                        {t("정책")} {row.paths.length} · {t("사용자")}{" "}
                        {row.users.length}
                      </span>
                    </summary>
                    <table>
                      <thead>
                        <tr>
                          <th>{t("필드")}</th>
                          <th>{t("현재 DB")}</th>
                          <th>{t("Git 후보")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(
                          [
                            "name",
                            "description",
                            "path",
                            "method",
                            "parentId",
                            "state",
                          ] as const
                        )
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
                      </tbody>
                    </table>
                    {row.operation === "unchanged" && <p>{t("변경 없음")}</p>}
                  </details>
                ))}
                {!rows.length && <p>{t("연결된 항목이 없습니다")}</p>}
              </div>
            </>
          )}
          <details className="sync-yaml">
            <summary>{t("YAML 정의서 보기")}</summary>
            <pre>{snapshot.yaml}</pre>
          </details>
        </>
      )}
      <Dialog
        title={t("동기화 영향도 검토")}
        description={t("검토한 commit과 DB revision에 대해서만 적용합니다.")}
        trigger={
          <button type="button" hidden aria-label={t("동기화 영향도 검토")} />
        }
        open={Boolean(preview)}
        busy={busy}
        onOpenChange={(v) => {
          if (!v) setPreview(null);
        }}
      >
        {preview && (
          <div className="sync-review">
            <p>
              <strong>
                {preview.snapshot.environment} / {preview.snapshot.region}
              </strong>{" "}
              · DB {preview.snapshot.dbRevision} →{" "}
              {preview.snapshot.candidateCommit}
            </p>
            <p>
              {t("검토 유효 기한")}:{" "}
              <DateValue value={preview.expiresAt} time />
            </p>
            <div className="sync-notice">
              {t("변경 리소스")} {previewRows.length} · {t("연결된 사용자")}{" "}
              {users.size}
              <p>
                {t(
                  "연결 관계 기준이며 최종 접근 허용 여부는 서버에서 판정합니다.",
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
                  {!row.paths.length ? (
                    <p>
                      {t(
                        "연결된 정책이 없습니다. 리소스 추가는 권한을 자동 부여하지 않습니다.",
                      )}
                    </p>
                  ) : (
                    row.paths.map((p) => (
                      <details key={p.policy.id}>
                        <summary>
                          {p.policy.name} ·{" "}
                          {t(p.policy.effect === "allow" ? "허용" : "거부")} ·{" "}
                          {t("역할")} {p.roles.length}
                        </summary>
                        {p.roles.map((r) => (
                          <div key={r.role.id}>
                            <Link href={`/roles/${r.role.id}`}>
                              {r.role.name}
                            </Link>
                            {r.expired && <span> · {t("만료")}</span>}
                            <p>
                              {t("직접 부여 사용자")}:{" "}
                              {r.users.map((u) => u.name).join(", ") ||
                                t("없음")}
                            </p>
                            {r.organizations.map((o) => (
                              <p key={o.id}>
                                {o.name} →{" "}
                                {o.members.map((u) => u.name).join(", ") ||
                                  t("없음")}
                              </p>
                            ))}
                          </div>
                        ))}
                      </details>
                    ))
                  )}
                </section>
              ))}
            </div>
            {error && (
              <p role="alert">
                {t(messages[error] ?? messages.REQUEST_FAILED)}
              </p>
            )}
            <label className="sync-confirm">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
              />
              {t("변경사항과 영향 범위를 확인했습니다.")}
            </label>
            <div className="sync-toolbar">
              <Button
                variant="secondary"
                disabled={busy}
                onClick={() => setPreview(null)}
              >
                {t("돌아가기")}
              </Button>
              <Button
                disabled={!confirmed || busy}
                loading={busy}
                onClick={apply}
              >
                {t("최종 Sync 적용")}
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}
