"use client";
import { loadPolicySync } from "../policy-sync/actions";
import {
  diff as policyDiff,
  type Snapshot as PolicySnapshot,
} from "../policy-sync/model";
import { PolicyHistoryDialog } from "../policy-sync/history";
import { SubjectImpact } from "../authorization/subject-impact-view";
import { ChangeViews, YamlDiff } from "../sync-workflow/change-views";
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
  EXPIRED: "검토가 만료되었습니다. 다시 동기화를 눌러 검토하세요.",
  BLOCKED: "차단된 변경을 먼저 해결하세요.",
  FORBIDDEN: "접근 권한이 없습니다",
  UNAUTHENTICATED: "로그인이 필요합니다",
  REQUEST_FAILED: "요청하지 못했습니다. 다시 시도해 주세요.",
};
type CatalogItem = {
  kind: ResourceKind | "policies";
  id: string;
  name: string;
  path: string;
  method: string;
  parentId?: string;
};
const catalogLabels = { ...kindLabel, policies: "정책" };
const isAccessResource = (r: CatalogItem): r is CatalogItem & ResourceRef =>
  r.kind !== "policies";
export function ResourceSyncScreen() {
  const { t, mode } = useI18n();
  const params = useSearchParams();
  const router = useRouter();
  const status =
    params.get("status") ??
    (params.get("tab") === "changes" ? "out-of-sync" : "all");
  const kind = params.get("type") ?? "all";
  const selectedId = params.get("resource");
  const diffKind = params.get("diffType") ?? kind;
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
    if (!value) next.delete(key);
    window.history.replaceState(null, "", "/resources?" + next.toString());
  }
  const [policySnapshot, setPolicySnapshot] = useState<PolicySnapshot | null>(
    null,
  );
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [syncSelection, setSyncSelection] = useState<Selection | null>(null);
  const [run, setRun] = useState<Run | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const query = params.get("q") ?? "";
  const filter = params.get("change") ?? "all";
  const [impactReview, setImpactReview] = useState<{
    snapshot: Snapshot;
    resources: CatalogItem[];
  } | null>(null);
  async function inspectImpact(resources: CatalogItem[]) {
    if (!resources.length) return;
    setBusy(true);
    setError("");
    try {
      const result = await loadSnapshots();
      setImpactReview({
        snapshot: { ...result.resource, graph: result.policy.graph },
        resources,
      });
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
  async function loadSnapshots() {
    const r = await loadSync();
    if (!r.data) throw Error(r.error);
    const p = await loadPolicySync();
    if (!p.data) throw Error(p.error);
    if (
      r.data.dbRevision !== p.data.dbRevision ||
      r.data.environment !== p.data.environment ||
      r.data.region !== p.data.region
    )
      throw Error("CONFLICT");
    setSnapshot(r.data);
    setPolicySnapshot(p.data);
    return { resource: r.data, policy: p.data };
  }
  async function refresh() {
    setBusy(true);
    setError("");
    try {
      await loadSnapshots();
    } catch (e) {
      setError(e instanceof Error ? e.message : "REQUEST_FAILED");
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    void loadSnapshots().catch((e) =>
      setError(e instanceof Error ? e.message : "REQUEST_FAILED"),
    );
    // The catalog is reloaded explicitly after an apply, rollback or refresh.
  }, []);
  let result: ReturnType<typeof diff> | null = null;
  let policies: ReturnType<typeof policyDiff> | null = null;
  let invalid = false;
  try {
    if (snapshot) result = diff(snapshot);
    if (policySnapshot) policies = policyDiff(policySnapshot);
  } catch {
    invalid = true;
  }
  const resourceChanges =
    result?.rows.filter((r) => r.operation !== "unchanged") ?? [];
  const policyChanges =
    policies?.rows.filter((r) => r.operation !== "unchanged") ?? [];
  const changes = [
    ...resourceChanges.map((r) => ({ ...r, after: r.after as CatalogItem })),
    ...policyChanges.map((r) => ({
      ...r,
      after: { ...r.after, kind: "policies" as const, path: "", method: "" },
    })),
  ];
  const rows =
    result?.rows.filter(
      (r) =>
        r.operation !== "unchanged" &&
        (diffKind === "all" || r.after.kind === diffKind) &&
        (!selectedId || r.after.id === selectedId),
    ) ?? [];
  const resourceCatalog: CatalogItem[] = [
    ...(snapshot?.graph.resources ?? []),
    ...resourceChanges
      .filter((r) => r.operation === "create")
      .map((r) => r.after),
    ...(result?.rows
      .filter((r) => r.after.state === "absent" && !r.before)
      .map((r) => r.after) ?? []),
    ...(policySnapshot?.graph.policies ?? []).map((p) => ({
      ...p,
      kind: "policies" as const,
      path: "",
      method: "",
    })),
    ...(policies?.rows
      .filter((p) => !p.before)
      .map((p) => ({
        ...p.after,
        kind: "policies" as const,
        path: "",
        method: "",
      })) ?? []),
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
  function startSync(resources: CatalogItem[]) {
    setSyncSelection({
      mode: resources.some((r) => r.kind === "policies")
        ? "policies"
        : "resources",
      resources: resources
        .filter(isAccessResource)
        .map(({ kind, id }) => ({ kind, id })),
      policyIds: resources
        .filter((r) => r.kind === "policies")
        .map((r) => r.id),
    });
  }
  return (
    <div className="sync-page">
      <div className="sync-heading">
        <div>
          <p className="muted">{t("리소스")}</p>
          <h1>{t("변경 관리")}</h1>
          <p>{t("정책과 리소스의 변경사항을 검토하고 적용합니다.")}</p>
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
          <p className="muted">
            {t("동기화 상태와 변경사항은 각 리소스·정책 단위로 확인합니다.")}
          </p>
          <div
            className="sync-versions"
            aria-label={t("항목별 동기화 상태 요약")}
          >
            <section>
              <span>{t("전체 항목")}</span>
              <strong>{resourceCatalog.length}</strong>
            </section>
            <section>
              <span>Out of sync</span>
              <strong>{changes.length}</strong>
            </section>
            <section>
              <span>Synced</span>
              <strong>{resourceCatalog.length - changes.length}</strong>
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
                  ? t("예제 동기화 완료")
                  : run.message === "DEMO_ROLLED_BACK"
                    ? t("예제 Rollback 완료")
                    : run.message}
              </p>
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
                {Object.entries(catalogLabels).map(([key, label]) => (
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
          </div>
          <section className="sync-selection" aria-label={t("리소스 선택")}>
            <div className="ui-actions">
              <strong>
                {t("선택한 항목")} · {selection.length}
              </strong>
              {hiddenSelected > 0 && (
                <span className="muted">
                  {t("현재 필터 밖 선택")} · {hiddenSelected}
                </span>
              )}
              <Button
                disabled={
                  !selection.length ||
                  busy ||
                  active ||
                  invalid ||
                  !policySnapshot
                }
                onClick={() => startSync(selection)}
              >
                {t("선택 항목 동기화")}
              </Button>
              <Button
                variant="secondary"
                disabled={
                  !selection.length ||
                  busy ||
                  active ||
                  invalid ||
                  !policySnapshot
                }
                onClick={() => inspectImpact(selection)}
              >
                {t("선택 리소스 영향도 검토")}
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
                        {t(catalogLabels[r.kind])} · {r.name}
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
                "선택한 항목의 변경사항과 영향도를 검토합니다. 정책 연결 리소스와 필수 상위 리소스는 포함 사유와 함께 표시됩니다.",
              )}
            </p>
          </section>
          {
            <div className="sync-catalog">
              <table aria-label={t("변경 관리")}>
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
                    <th>{t("작업")}</th>
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
                      !(r.kind === "policies"
                        ? policySnapshot?.graph.policies.some(
                            (p) => p.id === r.id,
                          )
                        : snapshot.graph.resources.some(
                            (p) => p.kind === r.kind && p.id === r.id,
                          )) && change?.operation !== "create";
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
                        <td>{t(catalogLabels[r.kind])}</td>
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
                          <span
                            className={`sync-status ${change ? "pending" : ""}`}
                          >
                            {change ? "Out of sync" : "Synced"}
                          </span>
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
                          <div className="sync-row-actions">
                            {change && (
                              <Button
                                variant="ghost"
                                size="sm"
                                aria-label={`${r.name} · ${t("변경 검토")}`}
                                onClick={() => {
                                  const next = new URLSearchParams(
                                    params.toString(),
                                  );
                                  next.set("resource", r.id);
                                  next.set("diffType", r.kind);
                                  window.history.replaceState(
                                    null,
                                    "",
                                    `/resources?${next}`,
                                  );
                                }}
                              >
                                {t("변경 검토")}
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="secondary"
                              disabled={
                                !change ||
                                busy ||
                                active ||
                                invalid ||
                                !policySnapshot
                              }
                              aria-label={`${r.name} · ${t("동기화")}`}
                              onClick={() => startSync([r])}
                            >
                              {t("동기화")}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={busy || active}
                              aria-label={`${r.name} · ${t("영향도 검토")}`}
                              onClick={() => inspectImpact([r])}
                            >
                              {t("영향도 검토")}
                            </Button>
                          </div>
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
              {historyKind === "policies" && historyId && (
                <PolicyHistoryDialog
                  key={historyId}
                  id={historyId}
                  onClose={() => navigate("history", "")}
                  onUpdated={() => {
                    void refresh();
                    router.refresh();
                  }}
                />
              )}
              <p className="muted">
                {t(
                  "각 행에서 동기화하거나 여러 항목을 선택해 함께 검토할 수 있습니다.",
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
                title={t("영향도 검토")}
                description={t(
                  "같은 변경 대상의 YAML diff와 영향도를 확인하세요.",
                )}
                open={Boolean(selectedId)}
                onOpenChange={(open) => {
                  if (!open) navigate("resource", "");
                }}
                trigger={<button hidden aria-label={t("변경사항")} />}
              >
                <div className="sync-diffs" id="resource-diff">
                  {(diffKind === "policies" || diffKind === "all") &&
                    policies?.rows
                      .filter((row) => row.after.id === selectedId)
                      .map((row) => (
                        <details key={`policies:${row.key}`} open>
                          <summary>
                            <strong>{row.after.name}</strong> · {t("정책")} ·{" "}
                            {row.after.id}
                          </summary>
                          <ChangeViews
                            yaml={
                              <YamlDiff before={row.before} after={row.after} />
                            }
                            impact={
                              <SubjectImpact
                                graph={policySnapshot!.graph}
                                scope={{ policyIds: [row.after.id] }}
                              />
                            }
                          />
                          <Button
                            onClick={() => {
                              navigate("resource", "");
                              startSync([
                                {
                                  kind: "policies",
                                  id: row.after.id,
                                  name: row.after.name,
                                  path: "",
                                  method: "",
                                },
                              ]);
                            }}
                          >
                            {t("이 정책 동기화")}
                          </Button>
                        </details>
                      ))}
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
                        <ChangeViews
                          yaml={
                            <YamlDiff before={row.before} after={row.after} />
                          }
                          impact={
                            <ResourceImpact
                              graph={snapshot.graph}
                              resources={[row.after]}
                            />
                          }
                        />
                        <Button
                          onClick={() => {
                            navigate("resource", "");
                            startSync([row.after]);
                          }}
                        >
                          {t("동기화")}
                        </Button>
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
            <h3>{t("리소스")}</h3>
            <pre>{snapshot.yaml}</pre>
            <h3>{t("정책")}</h3>
            <pre>{policySnapshot?.yaml}</pre>
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
        title={t("영향도 검토")}
        description={t(
          "조회 대상으로 선택한 정책과 리소스의 연결 관계만 표시합니다.",
        )}
        trigger={<button hidden aria-label={t("영향도 검토")} />}
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
            {impactReview.resources.some((r) => r.kind === "policies") ? (
              <>
                <p>
                  {t("선택한 항목")} ·{" "}
                  {impactReview.resources
                    .map((r) => `${t(catalogLabels[r.kind])}: ${r.name}`)
                    .join(", ")}
                </p>
                <SubjectImpact
                  graph={{
                    ...impactReview.snapshot.graph,
                    policies: impactReview.snapshot.graph.policies
                      .map((p) => ({
                        ...p,
                        resources: impactReview.resources.some(
                          (r) => r.kind === "policies" && r.id === p.id,
                        )
                          ? p.resources
                          : p.resources.filter((ref) =>
                              impactReview.resources.some(
                                (r) => r.kind === ref.kind && r.id === ref.id,
                              ),
                            ),
                      }))
                      .filter(
                        (p) =>
                          p.resources.length ||
                          impactReview.resources.some(
                            (r) => r.kind === "policies" && r.id === p.id,
                          ),
                      ),
                  }}
                  scope={{}}
                />
              </>
            ) : (
              <ResourceImpact
                key={impactReview.resources
                  .map((r) => `${r.kind}:${r.id}`)
                  .join(",")}
                graph={impactReview.snapshot.graph}
                resources={impactReview.resources.filter(isAccessResource)}
              />
            )}
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
