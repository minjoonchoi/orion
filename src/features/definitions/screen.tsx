"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AccessDenied } from "../auth/access-denied";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Tabs } from "@/components/ui/tabs";
import { useI18n, DateValue } from "@/i18n/provider";
import { ChangeViews, YamlDiff } from "../sync-workflow/change-views";
import {
  loadDefinitions,
  previewDefinitions,
  applyDefinitions,
  evaluateDefinitionAccess,
} from "./actions";
import {
  kinds,
  labels,
  href,
  makePlan,
  object,
  fields,
  grants,
  actionKey,
  changed,
  dependentPolicies,
  subjects,
  type Entity,
  type Kind,
  type Snapshot,
  type Preview,
  type Plan,
  type Obj,
} from "./model";
import { stringify } from "yaml";
import "./styles.css";
const errors: Record<string, string> = {
  CONFLICT: "버전이 변경되었습니다. 대상을 새로 불러와 다시 검토하세요.",
  EXPIRED: "검토가 만료되었습니다. 대상을 새로 불러와 다시 검토하세요.",
  FORBIDDEN: "접근 권한이 없습니다",
  UNAUTHENTICATED: "로그인이 필요합니다",
  REQUEST_FAILED: "요청하지 못했습니다. 다시 시도해 주세요.",
  BLOCKED: "차단된 변경을 먼저 해결하세요.",
};
function rows(v: unknown): Obj[] {
  return Array.isArray(v) ? v.map(object) : [];
}
function EntityLink({ entity }: { entity: Entity }) {
  return (
    <Link href={href(entity)}>
      {entity.name}
      <small>
        {entity.parent ? entity.parent + " / " : ""}
        {entity.id}
      </small>
    </Link>
  );
}
function State({ pending }: { pending: boolean }) {
  return (
    <span className={`sync-status ${pending ? "pending" : ""}`}>
      {pending ? "Out of sync" : "Synced"}
    </span>
  );
}
function FieldRules({
  policy,
  entities,
}: {
  policy: Entity;
  entities: Entity[];
}) {
  const { t } = useI18n();
  return (
    <div className="def-rules">
      {grants(policy).map((g) => {
        const a = entities.find((e) => e.key === actionKey(g.ref));
        const ep = entities.find(
          (e) =>
            e.key === a?.refs.find((k) => k.startsWith("service-endpoints:")),
        );
        const response = g.response as Obj | undefined;
        const selected = rows(response?.fields);
        const unmasks = rows(response?.unmask);
        return (
          <section key={actionKey(g.ref)} className="def-card">
            <div className="def-section-head">
              <div>
                {a ? (
                  <EntityLink entity={a} />
                ) : (
                  <code>{actionKey(g.ref)}</code>
                )}
              </div>
              <span>
                {policy.definition.effect === "deny"
                  ? t("거부")
                  : selected.length + " " + t("선택 필드")}
              </span>
            </div>
            {ep && (
              <p className="def-endpoint">
                <span>{String(ep.definition.method)}</span>{" "}
                <code>{String(ep.definition.path)}</code> ·{" "}
                <Link href={href(ep)}>
                  {ep.parent} / {ep.id}
                </Link>
              </p>
            )}
            {policy.definition.effect === "deny" ? (
              <p>{t("이 Action의 호출을 거부합니다.")}</p>
            ) : (
              <>
                <div className="def-table">
                  <table>
                    <thead>
                      <tr>
                        <th>{t("응답 필드")}</th>
                        <th>{t("경로")}</th>
                        <th>{t("타입")}</th>
                        <th>{t("처리 방식")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ep &&
                        Object.entries(fields(ep, "response")).map(
                          ([id, raw]) => {
                            const f = selected.find(
                                (f) => object(f.ref).field === id,
                              ),
                              u = unmasks.some(
                                (f) => object(f.ref).field === id,
                              ),
                              mask = f?.masking as Obj | undefined;
                            const definition = object(raw);
                            return (
                              <tr key={id}>
                                <td>
                                  <code>{id}</code>
                                </td>
                                <td>
                                  <code>{String(definition.path)}</code>
                                </td>
                                <td>{String(definition.type)}</td>
                                <td>
                                  {u
                                    ? t("마스킹 해제 권한")
                                    : f
                                      ? mask
                                        ? `${t("마스킹")} · ${mask.method}${mask.count !== undefined ? ` (${mask.count})` : ""}`
                                        : t("원문")
                                      : t("미포함")}
                                </td>
                              </tr>
                            );
                          },
                        )}
                    </tbody>
                  </table>
                </div>
                {response?.body === "none" && (
                  <p>{t("응답 body를 반환하지 않습니다.")}</p>
                )}
                {unmasks.length > 0 && (
                  <p className="muted">
                    {t(
                      "마스킹 해제는 호출·필드 반환 권한을 추가하지 않습니다.",
                    )}
                  </p>
                )}
              </>
            )}
          </section>
        );
      })}
    </div>
  );
}
function Relations({
  entity,
  entities,
}: {
  entity: Entity;
  entities: Entity[];
}) {
  const { t } = useI18n();
  const children = entities.filter(
    (e) =>
      e.parent === entity.id &&
      ((entity.kind === "domains" && e.kind === "actions") ||
        (entity.kind === "services" && e.kind === "service-endpoints") ||
        (entity.kind === "workspaces" && e.kind === "pages")),
  );
  const refs = entity.refs
    .map((k) => entities.find((e) => e.key === k))
    .filter((e): e is Entity => !!e);
  const uses = entities.filter(
    (e) =>
      e.refs.includes(entity.key) && !children.some((c) => c.key === e.key),
  );
  return (
    <div className="def-relations">
      {[
        ["하위 정의", children],
        ["참조하는 정의", refs],
        ["사용하는 정의", uses],
      ]
        .filter(([, items]) => (items as Entity[]).length > 0)
        .map(([label, items]) => (
          <section key={String(label)}>
            <h3>
              {t(String(label))}{" "}
              <span className="muted">{(items as Entity[]).length}</span>
            </h3>
            {(items as Entity[]).map((e) => (
              <div className="def-relation" key={e.key}>
                <span>{t(labels[e.kind])}</span>
                <EntityLink entity={e} />
              </div>
            ))}
            {!(items as Entity[]).length && (
              <p className="muted">{t("연결된 항목이 없습니다.")}</p>
            )}
          </section>
        ))}
    </div>
  );
}
function ExposureChanges({ plan }: { plan: Plan }) {
  const { t } = useI18n();
  return (
    <div className="def-change-summary">
      {plan.changes.map((c) => {
        const e = c.after ?? c.before!;
        const notes: string[] = [];
        if (e.kind === "policies") {
          const before = c.before ? grants(c.before) : [],
            after = c.after ? grants(c.after) : [];
          for (const g of after) {
            const previous = before.find(
              (x) => actionKey(x.ref) === actionKey(g.ref),
            );
            const r = object(g.response ?? {}),
              p = object(previous?.response ?? {});
            for (const f of rows(r.fields)) {
              const name = String(object(f.ref).field),
                old = rows(p.fields).find((x) => object(x.ref).field === name);
              if (!old) notes.push(`${t("반환 필드 추가")}: ${name}`);
              else if (
                JSON.stringify(old.masking) !== JSON.stringify(f.masking)
              )
                notes.push(`${t("마스킹 변경")}: ${name}`);
            }
            for (const f of rows(p.fields))
              if (
                !rows(r.fields).some(
                  (x) => object(x.ref).field === object(f.ref).field,
                )
              )
                notes.push(`${t("반환 필드 제거")}: ${object(f.ref).field}`);
            for (const f of rows(r.unmask))
              if (
                !rows(p.unmask).some(
                  (x) => object(x.ref).field === object(f.ref).field,
                )
              )
                notes.push(
                  `${t("마스킹 해제 권한 추가")}: ${object(f.ref).field}`,
                );
          }
        }
        return (
          <div key={c.key}>
            <strong>{e.name}</strong>
            <small>{e.key}</small>
            {notes.length ? (
              <ul>
                {notes.map((n, i) => (
                  <li key={i}>{n}</li>
                ))}
              </ul>
            ) : (
              <p>
                {t(
                  !c.before
                    ? "정의 추가"
                    : !c.after
                      ? "정의 삭제"
                      : "정의 변경",
                )}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
function Impact({
  snapshot,
  plan,
  selected,
}: {
  snapshot: Snapshot;
  plan?: Plan;
  selected: string[];
}) {
  const { t } = useI18n();
  const [q, setQ] = useState("");
  const [focus, setFocus] = useState("all");
  const [limit, setLimit] = useState(8);
  const keys = focus === "all" ? selected : [focus];
  const before = plan?.before ?? snapshot.applied,
    after = plan?.after ?? snapshot.applied;
  const affected = [
    ...new Map(
      [
        ...dependentPolicies(before, keys),
        ...dependentPolicies(after, keys),
      ].map((p) => [p.key, p]),
    ).values(),
  ];
  const people = subjects(snapshot.graph, affected);
  const filtered = people.filter((s) =>
    `${s.name} ${s.id} ${s.paths.map((p) => p.role + " " + p.policy.name).join(" ")}`
      .toLowerCase()
      .includes(q.toLowerCase()),
  );
  return (
    <section className="def-impact">
      <div className="def-section-head">
        <h3>{t("영향받는 대상")}</h3>
        {selected.length > 1 && (
          <select
            aria-label={t("영향도 대상")}
            value={focus}
            onChange={(e) => {
              setFocus(e.target.value);
              setLimit(8);
            }}
          >
            <option value="all">{t("선택 전체")}</option>
            {selected.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        )}
      </div>
      {plan && (
        <ExposureChanges
          plan={{
            ...plan,
            changes: plan.changes.filter((c) => keys.includes(c.key)),
          }}
        />
      )}
      <div className="def-counts">
        {(["users", "organizations", "service-accounts"] as const).map(
          (kind, i) => (
            <span key={kind}>
              {t(["사용자", "조직", "서비스 어카운트"][i])}{" "}
              <strong>{people.filter((p) => p.type === kind).length}</strong>
            </span>
          ),
        )}
      </div>
      <p className="muted">
        {t(
          "직접 부여 대상과 조직만 표시합니다. 조직의 멤버는 펼치지 않습니다.",
        )}
      </p>
      {snapshot.graph.serviceAccounts === undefined && (
        <p role="status">
          {t("서비스 어카운트 영향 정보가 제공되지 않았습니다.")}
        </p>
      )}
      <input
        aria-label={t("영향 대상 검색")}
        placeholder={t("이름·역할·정책 검색")}
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setLimit(8);
        }}
      />
      {filtered.slice(0, limit).map((s) => (
        <details className="def-subject" key={s.type + s.id}>
          <summary>
            <strong>{s.name}</strong>{" "}
            <span>
              {t(
                s.type === "users"
                  ? "사용자"
                  : s.type === "organizations"
                    ? "조직"
                    : "서비스 어카운트",
              )}
            </span>
            <small>
              {s.paths.map((p) => p.role + " → " + p.policy.name).join(" · ")}
            </small>
          </summary>
          <div className="def-depth">
            <Link href={`/${s.type}/${s.id}`}>{s.name}</Link>
            {s.paths.map((p) => (
              <div key={p.roleId + p.policy.key}>
                <Link href={`/roles/${p.roleId}`}>{p.role}</Link>
                <div>
                  <EntityLink entity={p.policy} />
                  {p.policy.refs.map((k) => {
                    const e =
                      after.find((x) => x.key === k) ??
                      before.find((x) => x.key === k);
                    return (
                      e && (
                        <div key={k}>
                          <EntityLink entity={e} />
                          {e.kind === "actions" &&
                            e.refs
                              .filter((r) => r.startsWith("service-endpoints:"))
                              .map((r) => {
                                const ep =
                                  after.find((x) => x.key === r) ??
                                  before.find((x) => x.key === r);
                                return (
                                  ep && (
                                    <div key={r}>
                                      <EntityLink entity={ep} />
                                    </div>
                                  )
                                );
                              })}
                        </div>
                      )
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </details>
      ))}
      {!filtered.length && <p>{t("직접 연결된 영향 대상이 없습니다.")}</p>}
      {filtered.length > limit && (
        <Button variant="ghost" onClick={() => setLimit(limit + 8)}>
          {t("더 보기")}
        </Button>
      )}
      <p className="muted">
        {t(
          "연결 관계 기준의 영향도입니다. 최종 접근 결과는 권한 평가에서 확인하세요.",
        )}
      </p>
    </section>
  );
}
function Evaluator({
  snapshot,
  entity,
}: {
  snapshot: Snapshot;
  entity: Entity;
}) {
  const { t, mode } = useI18n();
  const policies = snapshot.applied.filter((e) => e.kind === "policies");
  const people = subjects(snapshot.graph, policies);
  const [who, setWho] = useState("");
  const target = people.find((p) => p.type + ":" + p.id === who);
  const [result, setResult] =
    useState<Awaited<ReturnType<typeof evaluateDefinitionAccess>>["data"]>(
      undefined,
    );
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  async function inspect() {
    if (!target) return;
    setLoading(true);
    setError("");
    setResult(undefined);
    try {
      const r = await evaluateDefinitionAccess(
        { type: target.type, id: target.id },
        { domain: entity.parent, action: entity.id },
      );
      if (r.data) setResult(r.data);
      else setError(r.error ?? "REQUEST_FAILED");
    } catch {
      setError("REQUEST_FAILED");
    } finally {
      setLoading(false);
    }
  }
  return (
    <section>
      <h3>{t("접근 결과 미리보기")}</h3>
      <p className="muted">
        {t(
          mode === "demo"
            ? "데모 정책 합성 결과입니다. 실제 API 호출이나 응답 변환을 실행하지 않습니다."
            : "Orion API의 권한 평가 결과입니다.",
        )}
      </p>
      <select
        aria-label={t("권한 평가 대상")}
        value={who}
        onChange={(e) => {
          setWho(e.target.value);
          setResult(undefined);
          setError("");
        }}
      >
        <option value="">{t("대상 선택")}</option>
        {people.map((p) => (
          <option key={p.type + p.id} value={p.type + ":" + p.id}>
            {p.name} ·{" "}
            {t(
              p.type === "users"
                ? "사용자"
                : p.type === "organizations"
                  ? "조직"
                  : "서비스 어카운트",
            )}
          </option>
        ))}
      </select>
      <Button disabled={!target || loading} onClick={inspect}>
        {t("권한 평가")}
      </Button>
      {error && <p role="alert">{t(errors[error] ?? error)}</p>}
      {result && (
        <>
          <p>
            <strong>{t(result.allowed ? "허용" : "거부")}</strong> ·{" "}
            {result.reason}
          </p>
          <div className="def-table">
            <table>
              <thead>
                <tr>
                  <th>{t("응답 필드")}</th>
                  <th>{t("최종 처리")}</th>
                  <th>{t("근거 정책")}</th>
                </tr>
              </thead>
              <tbody>
                {result.rows.map((r) => (
                  <tr key={r.field}>
                    <td>{r.field}</td>
                    <td>
                      {t(
                        (
                          {
                            plain: "원문",
                            masked: "마스킹",
                            unmask: "마스킹 해제",
                            excluded: "미포함",
                            conflict: "충돌",
                          } as Record<string, string>
                        )[r.mode],
                      )}
                      {r.rule && ` · ${r.rule.method}`}
                    </td>
                    <td>{r.policies.join(", ") || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
export function DefinitionsScreen({
  kind,
  id: routeId,
}: {
  kind?: Kind;
  id?: string;
}) {
  const { t, mode } = useI18n();
  const params = useSearchParams();
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [stage, setStage] = useState(1);
  const [confirmed, setConfirmed] = useState(false);
  const [inspect, setInspect] = useState<Entity | null>(null);
  const [impact, setImpact] = useState<string[] | null>(null);
  const requestedTab = params.get("tab") ?? "overview";
  const tab = ["overview", "relations", "history", "yaml", "evaluate"].includes(
    requestedTab,
  )
    ? requestedTab
    : "overview";
  const setTab = (value: string) => navigate({ tab: value });
  const [notice, setNotice] = useState("");
  const selected = params.getAll("selected"),
    query = params.get("q") ?? "",
    filter = kind ?? params.get("type") ?? "all",
    status = params.get("status") ?? "all",
    page = Number(params.get("page") ?? 1);
  function navigate(updates: Record<string, string | string[]>) {
    const p = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(updates)) {
      p.delete(k);
      for (const value of Array.isArray(v) ? v : [v])
        if (value) p.append(k, value);
    }
    if (!("page" in updates)) p.delete("page");
    window.history.replaceState(null, "", `?${p}`);
  }
  useEffect(() => {
    document.querySelector(".ui-dialog:has(.def-review)")?.scrollTo({ top: 0 });
  }, [stage, preview?.token]);
  async function refresh() {
    setBusy(true);
    try {
      const r = await loadDefinitions();
      if (r.data) {
        setSnapshot(r.data);
        setError("");
      } else setError(r.error ?? "REQUEST_FAILED");
    } catch {
      setError("REQUEST_FAILED");
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    let live = true;
    loadDefinitions()
      .then((r) => {
        if (live) {
          if (r.data) setSnapshot(r.data);
          else setError(r.error ?? "REQUEST_FAILED");
        }
      })
      .catch(() => live && setError("REQUEST_FAILED"));
    return () => {
      live = false;
    };
  }, []);
  async function start(
    keys: string[],
    restore?: { key: string; revision: number },
  ) {
    setBusy(true);
    setError("");
    try {
      const r = await previewDefinitions(keys, restore);
      if (r.data) {
        setInspect(null);
        setPreview(r.data);
        setStage(1);
        setConfirmed(false);
      } else setError(r.error ?? "REQUEST_FAILED");
    } catch {
      setError("REQUEST_FAILED");
    } finally {
      setBusy(false);
    }
  }
  async function apply() {
    if (!preview) return;
    setBusy(true);
    try {
      const r = await applyDefinitions(preview.token);
      if (r.data) {
        setSnapshot(r.data);
        setPreview(null);
        setNotice(t("동기화가 완료되었습니다."));
        navigate({ selected: [] });
      } else setError(r.error ?? "REQUEST_FAILED");
    } catch {
      setError("REQUEST_FAILED");
    } finally {
      setBusy(false);
    }
  }
  if (!snapshot && error === "FORBIDDEN") return <AccessDenied />;
  if (!snapshot)
    return (
      <div className="definitions">
        <h1>{t(kind ? labels[kind] : "변경 관리")}</h1>
        {error ? (
          <p role="alert">{t(errors[error] ?? error)}</p>
        ) : (
          <p role="status">{t("불러오는 중…")}</p>
        )}
        <Button onClick={refresh}>{t("새로고침")}</Button>
      </div>
    );
  const combined = [
    ...new Map(
      [...snapshot.applied, ...snapshot.desired].map((e) => [e.key, e]),
    ).values(),
  ];
  const pending = (e: Entity) => {
    const wanted = snapshot.desired.find((x) => x.key === e.key),
      current = snapshot.applied.find((x) => x.key === e.key);
    return wanted ? changed(current, wanted.absent ? null : wanted) : false;
  };
  const sort = params.get("sort") ?? "name";
  const visible = (kind ? snapshot.applied : combined)
    .filter(
      (e) =>
        (filter === "all" || e.kind === filter) &&
        (!params.get("parent") || e.parent === params.get("parent")) &&
        (status === "all" ||
          (status === "out-of-sync" ? pending(e) : !pending(e))) &&
        `${e.name} ${e.key} ${e.definition.path ?? ""} ${e.definition.method ?? ""}`
          .toLowerCase()
          .includes(query.trim().toLowerCase()),
    )
    .sort(
      (a, b) => a.name.localeCompare(b.name) * (sort === "name-desc" ? -1 : 1),
    );
  const pages = Math.max(1, Math.ceil(visible.length / 10)),
    currentPage = Math.min(
      Math.max(1, Number.isFinite(page) ? page : 1),
      pages,
    );
  const shown = visible.slice((currentPage - 1) * 10, currentPage * 10);
  const entity =
    routeId && kind
      ? [...snapshot.applied, ...snapshot.desired].find(
          (e) =>
            e.kind === kind &&
            (e.parent ? e.parent + "~" + e.id : e.id) === routeId,
        )
      : undefined;
  const table = (items: Entity[], selectable = false) => (
    <div className="def-table">
      <table>
        <thead>
          <tr>
            {selectable && (
              <th>
                <input
                  type="checkbox"
                  aria-label={t("현재 페이지 선택")}
                  checked={
                    items.length > 0 &&
                    items.every((e) => selected.includes(e.key))
                  }
                  onChange={(ev) =>
                    navigate({
                      selected: ev.target.checked
                        ? [
                            ...new Set([
                              ...selected,
                              ...items.map((e) => e.key),
                            ]),
                          ]
                        : selected.filter(
                            (k) => !items.some((e) => e.key === k),
                          ),
                    })
                  }
                />
              </th>
            )}
            <th aria-sort={sort === "name-desc" ? "descending" : "ascending"}>
              <button
                className="def-sort"
                onClick={() =>
                  navigate({
                    sort: sort === "name-desc" ? "name" : "name-desc",
                  })
                }
              >
                {t("이름")} {sort === "name-desc" ? "↓" : "↑"}
              </button>
            </th>
            <th>{t("유형")}</th>
            <th>{t("동기화 상태")}</th>
            <th>{t("작업")}</th>
          </tr>
        </thead>
        <tbody>
          {items.map((e) => (
            <tr key={e.key}>
              {selectable && (
                <td>
                  <input
                    type="checkbox"
                    aria-label={e.name + " · " + t("선택")}
                    checked={selected.includes(e.key)}
                    onChange={(ev) =>
                      navigate({
                        selected: ev.target.checked
                          ? [...selected, e.key]
                          : selected.filter((k) => k !== e.key),
                      })
                    }
                  />
                </td>
              )}
              <td>
                {snapshot.applied.some((x) => x.key === e.key) ||
                snapshot.history.some((h) => h.key === e.key) ? (
                  <EntityLink entity={e} />
                ) : (
                  <>
                    <strong>{e.name}</strong>
                    <small>
                      {e.key} · {t(e.absent ? "삭제됨" : "정의 추가")}
                    </small>
                  </>
                )}
              </td>
              <td>{t(labels[e.kind])}</td>
              <td>
                <State pending={pending(e)} />
              </td>
              <td>
                <div className="def-actions">
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={!pending(e)}
                    onClick={() => setInspect(e)}
                  >
                    {t("변경 검토")}
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={busy || !pending(e)}
                    onClick={() => start([e.key])}
                  >
                    {t("동기화")}
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
  const detail = entity && (
    <>
      <div className="def-section-head">
        <div>
          <p className="muted">
            {t(labels[entity.kind])} · {entity.parent && entity.parent + " / "}
            {entity.id}
          </p>
          <h1>{entity.name}</h1>
        </div>
        <div className="def-actions">
          <State pending={pending(entity)} />
          <Button variant="secondary" onClick={() => setImpact([entity.key])}>
            {t("영향도 검토")}
          </Button>
          <Button
            disabled={busy || !pending(entity)}
            onClick={() => start([entity.key])}
          >
            {t("동기화")}
          </Button>
        </div>
      </div>
      <Tabs
        label="상세 정보"
        value={tab}
        onValueChange={setTab}
        items={[
          {
            value: "overview",
            label: "상세 정보",
            content: (
              <>
                <p className="muted">
                  {String(entity.definition.description ?? "")}
                </p>
                {entity.kind === "policies" ? (
                  <>
                    <div className="def-card">
                      <strong>
                        {t(
                          entity.definition.effect === "allow"
                            ? "허용"
                            : "거부",
                        )}
                      </strong>{" "}
                      ·{" "}
                      {entity.refs.some((k) => k.startsWith("pages:"))
                        ? entity.refs
                            .filter((k) => k.startsWith("pages:"))
                            .map((k) => {
                              const p = snapshot.applied.find(
                                (e) => e.key === k,
                              );
                              return p ? <EntityLink key={k} entity={p} /> : k;
                            })
                        : t("페이지 연결 없음")}
                      <p className="muted">
                        {t(
                          "페이지와 Action 권한은 각각 명시적으로 부여합니다.",
                        )}
                      </p>
                    </div>
                    <FieldRules policy={entity} entities={snapshot.applied} />
                  </>
                ) : entity.kind === "service-endpoints" ? (
                  <>
                    <p className="def-endpoint">
                      <strong>{String(entity.definition.method)}</strong>{" "}
                      <code>{String(entity.definition.path)}</code>
                    </p>
                    {(["request", "response"] as const).map((phase) => (
                      <section key={phase}>
                        <h3>
                          {t(phase === "request" ? "요청 필드" : "응답 필드")}
                        </h3>
                        <div className="def-table">
                          <table>
                            <thead>
                              <tr>
                                <th>ID</th>
                                <th>{t("경로")}</th>
                                <th>{t("타입")}</th>
                                <th>{t("필수")}</th>
                              </tr>
                            </thead>
                            <tbody>
                              {Object.entries(fields(entity, phase)).map(
                                ([id, value]) => (
                                  <tr key={id}>
                                    <td>{id}</td>
                                    <td>
                                      {String(object(value).location ?? "")}{" "}
                                      {String(object(value).path)}
                                    </td>
                                    <td>{String(object(value).type)}</td>
                                    <td>
                                      {object(value).required ? t("필수") : "—"}
                                    </td>
                                  </tr>
                                ),
                              )}
                            </tbody>
                          </table>
                        </div>
                      </section>
                    ))}
                  </>
                ) : entity.kind === "actions" ? (
                  <>
                    <Relations entity={entity} entities={snapshot.applied} />
                    <h3>{t("정책별 응답 범위")}</h3>
                    <p className="muted">
                      {t(
                        "정책별 정의이며, 대상의 최종 권한은 합성 결과에 따라 달라집니다.",
                      )}
                    </p>
                    {snapshot.applied
                      .filter(
                        (e) =>
                          e.kind === "policies" && e.refs.includes(entity.key),
                      )
                      .map((p) => (
                        <section key={p.key}>
                          <EntityLink entity={p} />
                          <FieldRules
                            policy={{
                              ...p,
                              definition: {
                                ...p.definition,
                                resources: {
                                  actions: grants(p).filter(
                                    (g) => actionKey(g.ref) === entity.key,
                                  ),
                                },
                              },
                            }}
                            entities={snapshot.applied}
                          />
                        </section>
                      ))}
                  </>
                ) : (
                  <>
                    <h3>
                      {t(
                        entity.kind === "domains"
                          ? "Action"
                          : entity.kind === "services"
                            ? "엔드포인트"
                            : "페이지",
                      )}
                    </h3>
                    {table(
                      snapshot.applied.filter(
                        (e) =>
                          e.parent === entity.id &&
                          e.kind ===
                            (entity.kind === "domains"
                              ? "actions"
                              : entity.kind === "services"
                                ? "service-endpoints"
                                : "pages"),
                      ),
                    )}
                  </>
                )}
              </>
            ),
          },
          {
            value: "relations",
            label: "연결 관계",
            content: (
              <>
                <Relations entity={entity} entities={snapshot.applied} />
                {entity.kind === "service-endpoints" && (
                  <>
                    <h3>{t("동일 엔드포인트의 Action 비교")}</h3>
                    {snapshot.applied
                      .filter(
                        (e) =>
                          e.kind === "actions" && e.refs.includes(entity.key),
                      )
                      .map((a) => (
                        <section className="def-card" key={a.key}>
                          <EntityLink entity={a} />
                          <p>
                            {t("사용 페이지")}:{" "}
                            {snapshot.applied
                              .filter(
                                (e) =>
                                  e.kind === "pages" && e.refs.includes(a.key),
                              )
                              .map((p) => p.name)
                              .join(", ") || "—"}
                          </p>
                          {snapshot.applied
                            .filter(
                              (e) =>
                                e.kind === "policies" && e.refs.includes(a.key),
                            )
                            .map((p) => (
                              <div key={p.key}>
                                <EntityLink entity={p} />
                                <FieldRules
                                  policy={{
                                    ...p,
                                    definition: {
                                      ...p.definition,
                                      resources: {
                                        actions: grants(p).filter(
                                          (g) => actionKey(g.ref) === a.key,
                                        ),
                                      },
                                    },
                                  }}
                                  entities={snapshot.applied}
                                />
                              </div>
                            ))}
                        </section>
                      ))}
                  </>
                )}
              </>
            ),
          },
          {
            value: "history",
            label: "동기화 이력",
            content: (
              <div>
                {snapshot.history
                  .filter((h) => h.key === entity.key)
                  .sort((a, b) => b.revision - a.revision)
                  .map((h) => (
                    <section className="def-card" key={h.key + h.revision}>
                      <div className="def-section-head">
                        <strong>revision {h.revision}</strong>
                        <Button
                          variant="secondary"
                          disabled={busy || !changed(entity, h.definition)}
                          onClick={() =>
                            start([entity.key], {
                              key: entity.key,
                              revision: h.revision,
                            })
                          }
                        >
                          {t("이 버전으로 복원 검토")}
                        </Button>
                      </div>
                      <p>
                        <DateValue value={h.at} time /> · {h.actor}
                      </p>
                      <details>
                        <summary>{t("YAML 정의서 보기")}</summary>
                        <pre>{stringify(h.definition?.definition ?? null)}</pre>
                      </details>
                    </section>
                  ))}
              </div>
            ),
          },
          {
            value: "yaml",
            label: "YAML",
            content: (
              <pre className="def-yaml">{stringify(entity.definition)}</pre>
            ),
          },
          ...(entity.kind === "actions"
            ? [
                {
                  value: "evaluate",
                  label: "권한 평가",
                  content: <Evaluator snapshot={snapshot} entity={entity} />,
                },
              ]
            : []),
        ]}
      />
    </>
  );
  return (
    <div className="definitions">
      {error && (
        <p role="alert">
          {t(errors[error] ?? error)}{" "}
          {error === "FORBIDDEN" && (
            <Link href="/forbidden">{t("접근 권한이 없습니다")}</Link>
          )}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      {mode === "demo" && (
        <p className="def-demo">
          {t("예제 모드 · 변경사항과 이력은 현재 세션에서만 유지됩니다.")}
        </p>
      )}
      {routeId ? (
        entity ? (
          detail
        ) : (
          <>
            <h1>{t("항목을 찾을 수 없습니다")}</h1>
            <Link href={`/${kind}`}>{t("목록으로 돌아가기")}</Link>
          </>
        )
      ) : (
        <>
          <div className="def-section-head">
            <div>
              <p className="muted">ORION / {t("리소스")}</p>
              <h1>{t(kind ? labels[kind] : "변경 관리")}</h1>
              <p className="muted">
                {t(
                  kind
                    ? "적용된 정의와 연결 관계를 탐색합니다."
                    : "리소스·정책별 변경사항을 검토하고 명시적으로 동기화합니다.",
                )}
              </p>
            </div>
            <Button variant="secondary" disabled={busy} onClick={refresh}>
              {t("새로고침")}
            </Button>
          </div>
          {!kind && (
            <div className="def-counts">
              <span>
                {t("전체")} <strong>{combined.length}</strong>
              </span>
              <span>
                Out of sync <strong>{combined.filter(pending).length}</strong>
              </span>
              <span>
                Synced{" "}
                <strong>{combined.filter((e) => !pending(e)).length}</strong>
              </span>
            </div>
          )}
          <div className="def-toolbar">
            <input
              aria-label={t("리소스 검색")}
              placeholder={t("이름·ID·경로 검색")}
              value={query}
              onChange={(e) => navigate({ q: e.target.value })}
            />
            {!kind && (
              <select
                aria-label={t("리소스 유형")}
                value={filter}
                onChange={(e) => navigate({ type: e.target.value })}
              >
                <option value="all">{t("모든 유형")}</option>
                {kinds.map((k) => (
                  <option key={k} value={k}>
                    {t(labels[k])}
                  </option>
                ))}
              </select>
            )}
            <select
              aria-label={t("동기화 상태")}
              value={status}
              onChange={(e) => navigate({ status: e.target.value })}
            >
              <option value="all">{t("전체")}</option>
              <option value="out-of-sync">Out of sync</option>
              <option value="synced">Synced</option>
            </select>
          </div>
          {!kind && selected.length > 0 && (
            <div className="def-selection">
              <strong>
                {t("선택한 항목")} {selected.length}
              </strong>
              <Button disabled={busy} onClick={() => start(selected)}>
                {t("선택 항목 동기화")}
              </Button>
              <Button variant="ghost" onClick={() => setImpact(selected)}>
                {t("영향도 검토")}
              </Button>
              <Button
                variant="ghost"
                onClick={() => navigate({ selected: [] })}
              >
                {t("선택 해제")}
              </Button>
            </div>
          )}
          {table(shown, !kind)}
          {!shown.length && <p>{t("검색 결과가 없습니다")}</p>}
          <div className="def-pagination">
            <span>
              {visible.length} · {currentPage} / {pages}
            </span>
            <Button
              variant="ghost"
              disabled={currentPage === 1}
              onClick={() => navigate({ page: String(currentPage - 1) })}
            >
              {t("이전")}
            </Button>
            <Button
              variant="ghost"
              disabled={currentPage === pages}
              onClick={() => navigate({ page: String(currentPage + 1) })}
            >
              {t("다음")}
            </Button>
          </div>
        </>
      )}
      <Dialog
        title={t("영향도 검토")}
        description={t("같은 변경 대상의 YAML diff와 영향도를 확인하세요.")}
        trigger={<button hidden />}
        open={!!inspect}
        onOpenChange={(open) => !open && setInspect(null)}
      >
        {inspect && (
          <>
            <h3>{inspect.name}</h3>
            <small>{inspect.key}</small>
            <ChangeViews
              yaml={
                <YamlDiff
                  before={
                    snapshot.applied.find((e) => e.key === inspect.key)
                      ?.definition ?? null
                  }
                  after={
                    snapshot.desired.find((e) => e.key === inspect.key)
                      ?.definition ?? null
                  }
                />
              }
              impact={
                <Impact
                  snapshot={snapshot}
                  plan={makePlan(snapshot, [inspect.key])}
                  selected={[inspect.key]}
                />
              }
            />
            <Button disabled={busy} onClick={() => start([inspect.key])}>
              {t("동기화")}
            </Button>
          </>
        )}
      </Dialog>
      <Dialog
        title={t("영향도 검토")}
        description={t("선택한 정의에 연결된 부여 대상과 경로를 확인합니다.")}
        trigger={<button hidden />}
        open={!!impact}
        onOpenChange={(open) => !open && setImpact(null)}
      >
        {impact && <Impact snapshot={snapshot} selected={impact} />}
      </Dialog>
      <Dialog
        title={t("영향도 검토")}
        description={t("대상 확인 후 변경사항과 영향도를 검토합니다.")}
        trigger={<button hidden />}
        open={!!preview}
        busy={busy}
        onOpenChange={(open) => !open && setPreview(null)}
      >
        {preview && (
          <div className="def-review">
            {error && <p role="alert">{t(errors[error] ?? error)}</p>}
            <div className="def-steps">
              <span aria-current={stage === 1 ? "step" : undefined}>
                1 · {t("대상 확인")}
              </span>
              <span aria-current={stage === 2 ? "step" : undefined}>
                2 · {t("변경사항 및 영향도 검토")}
              </span>
            </div>
            {stage === 1 ? (
              <>
                <p>
                  {t(
                    "선택 항목과 참조하는 정의를 함께 검증합니다. 권한은 자동으로 확대되지 않습니다.",
                  )}
                </p>
                <div className="def-table">
                  <table>
                    <thead>
                      <tr>
                        <th>{t("동기화 대상")}</th>
                        <th>{t("포함 사유")}</th>
                        <th>{t("변경사항")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.plan.keys.map((k) => {
                        const e =
                          preview.plan.after.find((e) => e.key === k) ??
                          preview.plan.before.find((e) => e.key === k);
                        return (
                          <tr key={k}>
                            <td>
                              {e?.name ?? k}
                              <small>{k}</small>
                            </td>
                            <td>
                              {t(
                                preview.plan.selected.includes(k)
                                  ? "직접 선택"
                                  : "참조 의존성",
                              )}
                            </td>
                            <td>
                              {t(
                                preview.plan.changes.some((c) => c.key === k)
                                  ? "변경 있음"
                                  : "변경 없음",
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {preview.plan.blockers.length > 0 && (
                  <div role="alert">
                    <h3>{t("동기화 차단")}</h3>
                    <ul>
                      {preview.plan.blockers.map((b) => (
                        <li key={b}>{b}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            ) : (
              <>
                <p className="muted">
                  {t("검토 유효 기한")} ·{" "}
                  <DateValue value={preview.expiresAt} time />
                </p>
                <ChangeViews
                  yaml={
                    <div>
                      {preview.plan.changes.map((c) => (
                        <section key={c.key}>
                          <h3>{c.after?.name ?? c.before?.name}</h3>
                          <small>{c.key}</small>
                          <YamlDiff
                            before={c.before?.definition ?? null}
                            after={c.after?.definition ?? null}
                          />
                        </section>
                      ))}
                    </div>
                  }
                  impact={
                    <Impact
                      snapshot={snapshot}
                      plan={preview.plan}
                      selected={preview.plan.changes.map((c) => c.key)}
                    />
                  }
                />
                <label className="def-consent">
                  <input
                    type="checkbox"
                    checked={confirmed}
                    onChange={(e) => setConfirmed(e.target.checked)}
                  />
                  {t("변경사항과 영향 범위를 확인했습니다.")}
                </label>
              </>
            )}
            <div className="def-footer">
              <Button
                variant="secondary"
                disabled={busy}
                onClick={() => {
                  if (stage === 1) setPreview(null);
                  else {
                    setStage(1);
                    setConfirmed(false);
                  }
                }}
              >
                {t(stage === 1 ? "취소" : "대상으로 돌아가기")}
              </Button>
              {stage === 1 ? (
                <Button
                  disabled={
                    busy ||
                    !!preview.plan.blockers.length ||
                    !preview.plan.changes.length
                  }
                  onClick={() => setStage(2)}
                >
                  {t("변경사항 및 영향도 검토")}
                </Button>
              ) : (
                <Button disabled={busy || !confirmed} onClick={apply}>
                  {t("동기화 적용")}
                </Button>
              )}
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}
