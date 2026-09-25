"use client";
import { SyncDialog } from "../sync-workflow/dialog";
import type { Selection } from "../sync-workflow/model";
import { ResourceImpact } from "../authorization/resource-impact";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { useI18n } from "@/i18n/provider";
import { loadSync } from "./actions";
import { ResourceHistoryDialog } from "./history";
import {
  resourceKinds,
  type ResourceKind,
  type ResourceRef,
} from "../authorization/model";
import { diff, kindLabel, type Snapshot, type Run } from "./model";
import "./styles.css";
const messages: Record<string, string> = {
  CONFLICT: "버전이 변경되었습니다. 새로고침 후 다시 검토하세요.",
  EXPIRED: "검토가 만료되었습니다. 다시 Sync를 눌러 검토하세요.",
  BLOCKED: "차단된 변경을 먼저 해결하세요.",
  FORBIDDEN: "접근 권한이 없습니다",
  UNAUTHENTICATED: "로그인이 필요합니다",
  REQUEST_FAILED: "요청하지 못했습니다. 다시 시도해 주세요.",
};
const fieldLabels = {
  name: "이름",
  description: "설명",
  path: "경로",
  method: "HTTP 메서드",
  parentId: "상위 리소스",
  state: "정의 상태",
};
export function ResourceSyncScreen() {
  const { t, mode } = useI18n();
  const params = useSearchParams();
  const router = useRouter();
  const status =
    params.get("status") ??
    (params.get("tab") === "changes" ? "out-of-sync" : "all");
  const kind = params.get("type") ?? "all";
  const selectedId = params.get("resource");
  const [historyKind, historyId] = (params.get("history") ?? "").split(":");
  function historyUrl(kind: string, id: string) {
    const next = new URLSearchParams(params.toString());
    next.delete("resource");
    next.set("history", `${kind}:${id}`);
    return `/resources?${next}`;
  }
  function navigate(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    next.set(key, value);
    if (key !== "page") next.delete("page");
    if (key !== "resource") next.delete("resource");
    if (key === "resource" && !value) next.delete("resource");
    window.history.replaceState(null, "", "/resources?" + next.toString());
  }
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [syncSelection, setSyncSelection] = useState<Selection | null>(null);
  const [run, setRun] = useState<Run | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const query = params.get("q") ?? "";
  const filter = params.get("change") ?? "all";
  const [impactReview, setImpactReview] = useState<{
    snapshot: Snapshot;
    resources: ResourceRef[];
  } | null>(null);
  async function inspectImpact(resources: ResourceRef[]) {
    if (!resources.length) return;
    setBusy(true);
    setError("");
    try {
      const result = await loadSync();
      if (result.data) {
        setSnapshot(result.data);
        setImpactReview({ snapshot: result.data, resources });
      } else setError(result.error!);
    } catch {
      setError("REQUEST_FAILED");
    } finally {
      setBusy(false);
    }
  }
  function selectResources(keys: Set<string>) {
    const next = new URLSearchParams(params.toString());
    next.delete("selected");
    keys.forEach((key) => next.append("selected", key));
    window.history.replaceState(null, "", `/resources?${next}`);
  }
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
        (!selectedId || r.after.id === selectedId),
    ) ?? [];
  const resourceCatalog = [
    ...(snapshot?.graph.resources ?? []),
    ...changes.filter((r) => r.operation === "create").map((r) => r.after),
    ...(result?.rows
      .filter((r) => r.after.state === "absent" && !r.before)
      .map((r) => r.after) ?? []),
  ];
  const catalog = resourceCatalog
    .filter((r) => {
      const change = changes.find(
        (c) => c.after.kind === r.kind && c.after.id === r.id,
      );
      return (
        (status === "all" ||
          (status === "out-of-sync" ? Boolean(change) : !change)) &&
        (filter === "all" || change?.operation === filter) &&
        (kind === "all" || kind === r.kind) &&
        `${r.name} ${r.id} ${r.path}`
          .toLowerCase()
          .includes(query.trim().toLowerCase())
      );
    })
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
  const pageResources = catalog.slice((currentPage - 1) * 10, currentPage * 10);
  const selection = resourceCatalog.filter((r) =>
    params.getAll("selected").includes(`${r.kind}:${r.id}`),
  );
  const selectedKeys = new Set(selection.map((r) => `${r.kind}:${r.id}`));
  const pageSelected = pageResources.filter((r) =>
    selectedKeys.has(`${r.kind}:${r.id}`),
  ).length;
  const hiddenSelected = selection.filter(
    (r) => !catalog.some((item) => item.kind === r.kind && item.id === r.id),
  ).length;
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
  const syncState = changes.length ? "Out of sync" : "Synced";
  function startSync(resources: ResourceRef[]) {
    setSyncSelection({
      mode: "resources",
      resources: resources.map(({ kind, id }) => ({ kind, id })),
      policyIds: [],
    });
  }
  return (
    <div className="sync-page">
      <div className="sync-heading">
        <div>
          <p className="muted">GITOPS / RESOURCES</p>
          <h1>{t("리소스 관리")}</h1>
          <p>
            {t(
              "Synced revision과 Git 정의서의 차이를 확인하고 검토 후 Sync합니다.",
            )}
          </p>
        </div>
        <div className="ui-actions">
          <Button
            variant="secondary"
            disabled={busy || active}
            onClick={refresh}
          >
            {t("새로고침")}
          </Button>
        </div>
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
              <span>
                {changes.length
                  ? `${changes.length} ${t("변경 사항")}`
                  : t("변경 없음")}
              </span>
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
              <p>
                {run.phase} ·{" "}
                {run.message === "DEMO_APPLIED"
                  ? t("예제 Sync 완료")
                  : run.message === "DEMO_ROLLED_BACK"
                    ? t("예제 Rollback 완료")
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
                        : "config 준비 상태와 synced revision을 확인하세요.",
                  )}{" "}
                  <code>{b}</code>
                </p>
              ))}
            </div>
          )}
          <div className="sync-toolbar">
            <label>
              {t("리소스 검색")}
              <input
                value={query}
                onChange={(e) => {
                  navigate("q", e.target.value);
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
            <label>
              {t("동기화 상태")}
              <select
                value={status}
                onChange={(e) => navigate("status", e.target.value)}
              >
                <option value="all">{t("전체")}</option>
                <option value="out-of-sync">Out of sync</option>
                <option value="synced">Synced</option>
              </select>
            </label>
            {
              <label>
                {t("변경 유형")}
                <select
                  value={filter}
                  onChange={(e) => navigate("change", e.target.value)}
                >
                  {["all", "create", "update", "delete"].map((v) => (
                    <option key={v} value={v}>
                      {v === "all" ? t("전체") : operation(v)}
                    </option>
                  ))}
                </select>
              </label>
            }
            <span>
              {t("변경 리소스")} · {changes.length}
            </span>
            {(query ||
              filter !== "all" ||
              kind !== "all" ||
              status !== "all") && (
              <Button
                variant="ghost"
                onClick={() => {
                  const next = new URLSearchParams();
                  selectedKeys.forEach((key) => next.append("selected", key));
                  router.replace(`/resources?${next}`, { scroll: false });
                }}
              >
                {t("초기화")}
              </Button>
            )}
            {
              <Button
                disabled={
                  busy ||
                  active ||
                  invalid ||
                  !changes.length ||
                  !!result?.blockers.length
                }
                onClick={() => startSync(changes.map((r) => r.after))}
              >
                {t("전체 변경")} Sync · {t("영향도 검토")} · {changes.length}
              </Button>
            }
          </div>
          <section className="sync-selection" aria-label={t("리소스 선택")}>
            <div className="ui-actions">
              <strong>
                {t("선택한 리소스")} · {selection.length}
              </strong>
              {hiddenSelected > 0 && (
                <span className="muted">
                  {t("현재 필터 밖 선택")} · {hiddenSelected}
                </span>
              )}
              <Button
                disabled={!selection.length || busy || active}
                onClick={() => startSync(selection)}
              >
                {t("선택 리소스 Sync")}
              </Button>
              <Button
                variant="secondary"
                disabled={!selection.length || busy || active}
                onClick={() => inspectImpact(selection)}
              >
                {t("선택 리소스 영향도 보기")}
              </Button>
              <Button
                variant="ghost"
                disabled={!selection.length}
                onClick={() => selectResources(new Set())}
              >
                {t("선택 해제")}
              </Button>
            </div>
            {!!selection.length && (
              <details>
                <summary>{t("선택 목록 확인")}</summary>
                <ul>
                  {selection.map((r) => (
                    <li key={`${r.kind}:${r.id}`}>
                      <span>
                        {t(kindLabel[r.kind])} · {r.name}
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-label={`${r.name} · ${t("선택 해제")}`}
                        onClick={() => {
                          const next = new Set(selectedKeys);
                          next.delete(`${r.kind}:${r.id}`);
                          selectResources(next);
                        }}
                      >
                        ×
                      </Button>
                    </li>
                  ))}
                </ul>
              </details>
            )}
            <p className="muted">
              {t(
                "선택한 리소스를 기준으로 변경과 영향도를 검토합니다. 필수 상위 리소스는 포함 사유와 함께 표시됩니다.",
              )}
            </p>
          </section>
          {
            <div className="sync-catalog">
              <table aria-label={t("리소스 관리")}>
                <thead>
                  <tr>
                    <th>
                      <input
                        type="checkbox"
                        aria-label={t("현재 페이지 리소스 선택")}
                        disabled={!pageResources.length}
                        checked={
                          !!pageResources.length &&
                          pageSelected === pageResources.length
                        }
                        ref={(element) => {
                          if (element)
                            element.indeterminate =
                              pageSelected > 0 &&
                              pageSelected < pageResources.length;
                        }}
                        onChange={(e) => {
                          const next = new Set(selectedKeys);
                          pageResources.forEach((r) => {
                            const key = `${r.kind}:${r.id}`;
                            if (e.target.checked) next.add(key);
                            else next.delete(key);
                          });
                          selectResources(next);
                        }}
                      />
                    </th>
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
                    <th>{t("동기화 상태")}</th>
                    <th>{t("동기화 이력")}</th>
                    <th>{t("영향도")}</th>
                  </tr>
                </thead>
                <tbody>
                  {pageResources.map((r) => {
                    const change = changes.find(
                      (c) => c.after.kind === r.kind && c.after.id === r.id,
                    );
                    const parentKind =
                      r.kind === "pages" ? "workspaces" : "services";
                    const deleted =
                      !snapshot.graph.resources.some(
                        (current) =>
                          current.kind === r.kind && current.id === r.id,
                      ) && change?.operation !== "create";
                    const parent = snapshot.graph.resources.find(
                      (p) => p.kind === parentKind && p.id === r.parentId,
                    );
                    return (
                      <tr key={`${r.kind}:${r.id}`}>
                        <td>
                          <input
                            type="checkbox"
                            aria-label={`${r.name} · ${t("리소스 선택")}`}
                            checked={selectedKeys.has(`${r.kind}:${r.id}`)}
                            onChange={(e) => {
                              const next = new Set(selectedKeys);
                              if (e.target.checked)
                                next.add(`${r.kind}:${r.id}`);
                              else next.delete(`${r.kind}:${r.id}`);
                              selectResources(next);
                            }}
                          />
                        </td>
                        <td>
                          {change?.operation === "create" || deleted ? (
                            <strong>{r.name}</strong>
                          ) : (
                            <Link href={`/${r.kind}/${r.id}`}>{r.name}</Link>
                          )}
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
                          {!deleted &&
                          change?.operation !== "create" &&
                          ["services", "workspaces"].includes(r.kind) ? (
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
                            <Button
                              variant="ghost"
                              size="sm"
                              className={`sync-badge ${change.operation}`}
                              onClick={() => navigate("resource", r.id)}
                            >
                              Out of sync · {operation(change.operation)} ·{" "}
                              {t("diff 확인")}
                            </Button>
                          ) : deleted ? (
                            `Synced · ${t("삭제됨")}`
                          ) : (
                            "Synced"
                          )}
                        </td>
                        <td>
                          <Link
                            href={historyUrl(r.kind, r.id)}
                            scroll={false}
                            aria-label={`${r.name} · ${t("동기화 이력")}`}
                          >
                            {t("이력 보기")}
                          </Link>
                        </td>
                        <td>
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={busy || active}
                            aria-label={`${r.name} · ${t("영향도 보기")}`}
                            onClick={() => inspectImpact([r])}
                          >
                            {t("영향도 보기")}
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {!catalog.length && (
                <p>
                  {t("검색 결과가 없습니다")} ·{" "}
                  {t("검색어나 필터를 변경해 주세요.")}
                </p>
              )}
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
          }
          {
            <>
              {historyId &&
                resourceKinds.includes(historyKind as ResourceKind) && (
                  <ResourceHistoryDialog
                    key={`${historyKind}:${historyId}`}
                    kind={historyKind as ResourceKind}
                    id={historyId}
                    name={
                      catalog.find(
                        (r) => r.kind === historyKind && r.id === historyId,
                      )?.name ?? historyId
                    }
                    onUpdated={() => {
                      void refresh();
                    }}
                    onClose={() => {
                      const next = new URLSearchParams(params.toString());
                      next.delete("history");
                      window.history.replaceState(
                        null,
                        "",
                        `/resources?${next}`,
                      );
                    }}
                  />
                )}
              <p className="muted">
                {t(
                  "선택 리소스 Sync는 선택 범위에만 적용됩니다. 전체 변경 Sync는 모든 변경을 검토합니다.",
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
              <Dialog
                title={t("리소스 변경 내용")}
                description={t(
                  "변경 전후를 확인한 뒤 선택 리소스 Sync에서 영향도를 검토하세요.",
                )}
                open={Boolean(selectedId)}
                onOpenChange={(open) => {
                  if (!open) navigate("resource", "");
                }}
                trigger={<button hidden aria-label={t("리소스 변경 내용")} />}
              >
                <div className="sync-diffs" id="resource-diff">
                  {rows
                    .filter((row) => row.after.id === selectedId)
                    .map((row) => (
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
                            {t("정책")} {row.paths.length}
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
                                  <th>{t(fieldLabels[f])}</th>
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
                        {row.operation === "unchanged" && (
                          <p>{t("변경 없음")}</p>
                        )}
                      </details>
                    ))}
                </div>
                <Button
                  variant="secondary"
                  onClick={() => navigate("resource", "")}
                >
                  {t("목록으로 돌아가기")}
                </Button>
              </Dialog>
            </>
          }
          <details className="sync-yaml">
            <summary>{t("YAML 정의서 보기")}</summary>
            <pre>{snapshot.yaml}</pre>
          </details>
        </>
      )}
      {syncSelection && (
        <SyncDialog
          selection={syncSelection}
          onClose={() => setSyncSelection(null)}
          onApplied={(r) => {
            setRun(r);
            void refresh();
            router.refresh();
          }}
        />
      )}
      <Dialog
        title={t("리소스 영향도 검토")}
        description={t("조회 대상으로 선택한 리소스의 연결 관계만 표시합니다.")}
        trigger={<button hidden aria-label={t("리소스 영향도 검토")} />}
        open={Boolean(impactReview)}
        onOpenChange={(open) => {
          if (!open) setImpactReview(null);
        }}
      >
        {impactReview && (
          <div className="resource-impact-review">
            <p className="muted">
              {impactReview.snapshot.environment} /{" "}
              {impactReview.snapshot.region} · {t("조회 기준")} revision{" "}
              {impactReview.snapshot.dbRevision}
            </p>
            <ResourceImpact
              key={impactReview.resources
                .map((r) => `${r.kind}:${r.id}`)
                .join(",")}
              graph={impactReview.snapshot.graph}
              resources={impactReview.resources}
            />
            <div className="ui-dialog-footer">
              <Button variant="secondary" onClick={() => setImpactReview(null)}>
                {t("목록으로 돌아가기")}
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}
