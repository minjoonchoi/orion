"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useI18n, DateValue } from "@/i18n/provider";
import { AccessDenied } from "@/features/auth/access-denied";
import { loadAuthorization, changeAuthorization } from "./actions";
import {
  impact,
  applyChange,
  resourceKinds,
  type Graph,
  type Change,
  type FocusKind,
  type ResourceKind,
} from "./model";
import "./styles.css";
const labels: Record<FocusKind, string> = {
  users: "사용자",
  organizations: "조직",
  roles: "역할",
  policies: "정책",
  workspaces: "워크스페이스",
  pages: "페이지",
  services: "서비스",
  "service-endpoints": "서비스 엔드포인트",
};
const toggle = (ids: string[], id: string) =>
  ids.includes(id) ? ids.filter((v) => v !== id) : [...ids, id];
const errorLabels: Record<string, string> = {
  FORBIDDEN: "접근 권한이 없습니다",
  UNAUTHENTICATED: "로그인이 필요합니다",
  CONFLICT: "다른 변경사항이 있습니다. 다시 불러온 뒤 적용해 주세요.",
  INVALID_CHANGE: "입력값을 확인해 주세요. 만료 시점은 현재 이후여야 합니다.",
  REQUEST_FAILED: "변경하지 못했습니다. 다시 시도해 주세요.",
};
function ResourceList({
  graph,
  policy,
}: {
  graph: Graph;
  policy: Graph["policies"][number];
}) {
  const { t } = useI18n();
  return (
    <div className="access-resource-list">
      {resourceKinds.map((kind) => {
        const rows = policy.resources.filter((r) => r.kind === kind);
        return (
          rows.length > 0 && (
            <div key={kind}>
              <strong>
                {t(labels[kind])} · {rows.length}
              </strong>
              <ul>
                {rows.map((ref) => {
                  const resource = graph.resources.find(
                    (r) => r.id === ref.id && r.kind === kind,
                  );
                  return (
                    <li key={ref.id}>
                      <Link href={`/${kind}/${encodeURIComponent(ref.id)}`}>
                        {resource?.name ?? ref.id}
                      </Link>
                      {resource?.path && <code>{resource.path}</code>}
                    </li>
                  );
                })}
              </ul>
            </div>
          )
        );
      })}
      {!policy.resources.length && <p>{t("연결된 항목이 없습니다")}</p>}
    </div>
  );
}
function RolePreview({
  graph,
  role,
}: {
  graph: Graph;
  role: Graph["roles"][number];
}) {
  const { t } = useI18n();
  return (
    <details className="access-preview">
      <summary>
        {t("연결 정책과 리소스")} · {role.bindings.length}
      </summary>
      {role.bindings.map((binding) => {
        const policy = graph.policies.find((p) => p.id === binding.policyId);
        if (!policy) return null;
        return (
          <section key={policy.id}>
            <strong>
              <Link href={`/policies/${policy.id}`}>{policy.name}</Link>
            </strong>{" "}
            <span className={`access-effect ${policy.effect}`}>
              {t(policy.effect === "allow" ? "허용" : "거부")}
            </span>
            <p>
              {t("만료 시점")}:{" "}
              {binding.expiresAt ? (
                <DateValue value={binding.expiresAt} time />
              ) : (
                t("무기한")
              )}
            </p>
            <ResourceList graph={graph} policy={policy} />
          </section>
        );
      })}
      {!role.bindings.length && <p>{t("연결된 항목이 없습니다")}</p>}
    </details>
  );
}
function ImpactExplorer({
  graph,
  kind,
  id,
}: {
  graph: Graph;
  kind: ResourceKind;
  id: string;
}) {
  const { t } = useI18n();
  const [expired, setExpired] = useState(false);
  const [query, setQuery] = useState("");
  const paths = impact(graph, kind, id, expired);
  const users = new Set(
    paths.flatMap((p) =>
      p.roles.flatMap((r) => [
        ...r.users.map((u) => u.id),
        ...r.organizations.flatMap((o) => o.members.map((u) => u.id)),
      ]),
    ),
  );
  const roles = new Set(paths.flatMap((p) => p.roles.map((r) => r.role.id)));
  const organizations = new Set(
    paths.flatMap((p) =>
      p.roles.flatMap((r) => r.organizations.map((o) => o.id)),
    ),
  );
  const filtered = paths.filter((p) =>
    [
      p.policy.name,
      ...p.roles.flatMap((r) => [
        r.role.name,
        ...r.users.map((u) => u.name),
        ...r.organizations.flatMap((o) => [
          o.name,
          ...o.members.map((u) => u.name),
        ]),
      ]),
    ]
      .join(" ")
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  return (
    <section className="access-impact" aria-label={t("영향 범위 탐색")}>
      <h3>{t("영향 범위 탐색")}</h3>
      <p>
        {t(
          "리소스 → 정책 → 역할 → 조직·사용자 경로입니다. 조직 멤버는 간접 연결로 구분하며, 실제 접근 판정은 서버가 수행합니다.",
        )}
      </p>
      <div className="access-metrics">
        {[
          [t("정책"), paths.length],
          [t("역할"), roles.size],
          [t("조직"), organizations.size],
          [t("사용자"), users.size],
        ].map(([label, count]) => (
          <div key={label}>
            <strong>{count}</strong>
            <span>{label}</span>
          </div>
        ))}
      </div>
      <div className="access-tools">
        <label>
          {t("관계 검색")}
          <input value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
        <label>
          <input
            type="checkbox"
            checked={expired}
            onChange={(e) => setExpired(e.target.checked)}
          />
          {t("만료된 연결 포함")}
        </label>
      </div>
      <p className="muted">
        {t(
          "사용자 수는 중복을 제외합니다. 서비스·워크스페이스의 하위 리소스 권한을 자동으로 포함하지 않습니다.",
        )}
      </p>
      <div className="access-tree">
        {filtered.map((p) => (
          <details key={p.policy.id} open>
            <summary>
              <span className={`access-effect ${p.policy.effect}`}>
                {t(p.policy.effect === "allow" ? "허용" : "거부")}
              </span>{" "}
              {p.policy.name} · {p.roles.length} {t("역할")}
            </summary>
            <Link href={`/policies/${p.policy.id}`}>{t("정책 상세")}</Link>
            {p.roles.map((r) => (
              <details key={r.role.id} open>
                <summary>
                  {r.role.name}{" "}
                  {r.expired && (
                    <span className="access-effect deny">{t("만료")}</span>
                  )}
                </summary>
                <Link href={`/roles/${r.role.id}`}>{t("역할 상세")}</Link>
                <p>
                  {t("만료 시점")}:{" "}
                  {r.binding.expiresAt ? (
                    <DateValue value={r.binding.expiresAt} time />
                  ) : (
                    t("무기한")
                  )}
                </p>
                <div className="access-paths">
                  <section>
                    <h4>{t("직접 부여 사용자")}</h4>
                    {r.users.length ? (
                      r.users.map((u) => (
                        <Link key={u.id} href={`/users/${u.id}`}>
                          {u.name}
                        </Link>
                      ))
                    ) : (
                      <p>{t("연결된 항목이 없습니다")}</p>
                    )}
                  </section>
                  <section>
                    <h4>{t("조직을 통한 사용자")}</h4>
                    {r.organizations.map((o) => (
                      <details key={o.id} open>
                        <summary>
                          {o.name} · {o.members.length}
                        </summary>
                        <Link href={`/organizations/${o.id}`}>
                          {t("조직 상세")}
                        </Link>
                        <div className="access-members">
                          {o.members.map((u) => (
                            <Link key={u.id} href={`/users/${u.id}`}>
                              {u.name}
                            </Link>
                          ))}
                        </div>
                        {!o.members.length && (
                          <p>{t("연결된 항목이 없습니다")}</p>
                        )}
                      </details>
                    ))}
                  </section>
                </div>
              </details>
            ))}
            {!p.roles.length && <p>{t("연결된 항목이 없습니다")}</p>}
          </details>
        ))}
        {!filtered.length && <p>{t("연결된 항목이 없습니다")}</p>}
      </div>
    </section>
  );
}
function Editor({
  graph,
  kind,
  id,
  onSave,
  busy,
}: {
  graph: Graph;
  kind: FocusKind;
  id: string;
  onSave: (change: Change) => void;
  busy: boolean;
}) {
  const { t } = useI18n();
  const role = graph.roles.find((r) => r.id === id);
  const policy = graph.policies.find((p) => p.id === id);
  const resource = graph.resources.find((r) => r.kind === kind && r.id === id);
  const [tab, setTab] = useState("grants");
  const [query, setQuery] = useState("");
  const [selectedRoles, setRoles] = useState(
    graph.roles
      .filter((r) =>
        (kind === "users" ? r.userIds : r.organizationIds).includes(id),
      )
      .map((r) => r.id),
  );
  const [userIds, setUsers] = useState(role?.userIds ?? []);
  const [organizationIds, setOrganizations] = useState(
    role?.organizationIds ?? [],
  );
  const [bindings, setBindings] = useState(role?.bindings ?? []);
  const [effect, setEffect] = useState<"allow" | "deny">(
    policy?.effect ?? "allow",
  );
  const [refs, setRefs] = useState(policy?.resources ?? []);
  const [resourceType, setType] = useState<ResourceKind>("workspaces");
  const [name, setName] = useState(resource?.name ?? "");
  const [description, setDescription] = useState(resource?.description ?? "");
  const [path, setPath] = useState(resource?.path ?? "");
  const [method, setMethod] = useState(resource?.method ?? "GET");
  const [review, setReview] = useState<Change | null>(null);
  const [invalid, setInvalid] = useState(false);
  const resourceFocus = resourceKinds.includes(kind as ResourceKind);
  const change = (): Change =>
    kind === "users" || kind === "organizations"
      ? { type: "subjectRoles", subjectKind: kind, id, roleIds: selectedRoles }
      : kind === "roles"
        ? tab === "grants"
          ? { type: "grants", roleId: id, userIds, organizationIds }
          : { type: "bindings", roleId: id, bindings }
        : kind === "policies"
          ? { type: "policy", policyId: id, effect, resources: refs }
          : {
              type: "resource",
              kind: kind as ResourceKind,
              id,
              name,
              description,
              path,
              method,
            };
  const matches = (item: { name: string; id: string }) =>
    `${item.name} ${item.id}`.toLowerCase().includes(query.toLowerCase());
  const checkedRef = (r: { kind: ResourceKind; id: string }) =>
    refs.some((ref) => ref.kind === r.kind && ref.id === r.id);
  if (review) {
    const before =
      kind === "roles"
        ? graph.roles.find((r) => r.id === id)
        : kind === "policies"
          ? graph.policies.find((p) => p.id === id)
          : null;
    return (
      <section className="access-review">
        <h3>{t("변경사항 확인")}</h3>
        <p>
          {t(
            "저장하면 연결과 접근 범위에 반영됩니다. 대상과 만료 시점을 확인해 주세요.",
          )}
        </p>
        {review.type === "subjectRoles" && (
          <>
            <p>
              {t("역할")}:{" "}
              {graph.roles
                .filter((r) => selectedRoles.includes(r.id))
                .map((r) => r.name)
                .join(", ") || t("없음")}
            </p>
            <p>
              {t("제거되는 역할")}:{" "}
              {graph.roles
                .filter(
                  (r) =>
                    (kind === "users" ? r.userIds : r.organizationIds).includes(
                      id,
                    ) && !selectedRoles.includes(r.id),
                )
                .map((r) => r.name)
                .join(", ") || t("없음")}
            </p>
          </>
        )}
        {review.type === "grants" && (
          <>
            <p>
              {t("사용자")}:{" "}
              {graph.users
                .filter((u) => userIds.includes(u.id))
                .map((u) => u.name)
                .join(", ") || t("없음")}
            </p>
            <p>
              {t("조직")}:{" "}
              {graph.organizations
                .filter((o) => organizationIds.includes(o.id))
                .map((o) => o.name)
                .join(", ") || t("없음")}
            </p>
            <p>
              {t("기존 연결")}:{" "}
              {role!.userIds.length + role!.organizationIds.length} →{" "}
              {userIds.length + organizationIds.length}
            </p>
          </>
        )}
        {review.type === "bindings" && (
          <>
            <p>
              {t("기존 연결")}: {role!.bindings.length} → {bindings.length}
            </p>
            {bindings.map((b) => (
              <p key={b.policyId}>
                {graph.policies.find((p) => p.id === b.policyId)?.name} ·{" "}
                {b.expiresAt ? (
                  <DateValue value={b.expiresAt} time />
                ) : (
                  t("무기한")
                )}
              </p>
            ))}
          </>
        )}
        {review.type === "policy" && (
          <>
            <p>
              {t("정책 효과")}:{" "}
              {t(policy!.effect === "allow" ? "허용" : "거부")} →{" "}
              <strong>{t(effect === "allow" ? "허용" : "거부")}</strong>
            </p>
            <p>
              {t("기존 연결")}: {policy!.resources.length} → {refs.length}
            </p>
            <ResourceList
              graph={graph}
              policy={{ ...policy!, effect, resources: refs }}
            />
          </>
        )}
        {review.type === "resource" && (
          <>
            <p>
              {resource!.name} → <strong>{name}</strong>
            </p>
            <p>{description}</p>
            <code>
              {method} {path}
            </code>
            <ImpactExplorer graph={graph} kind={kind as ResourceKind} id={id} />
          </>
        )}
        {before && <p className="muted">{before.name}</p>}
        <div className="ui-actions">
          <Button
            variant="secondary"
            disabled={busy}
            onClick={() => setReview(null)}
          >
            {t("수정으로 돌아가기")}
          </Button>
          <Button loading={busy} onClick={() => onSave(review)}>
            {t("변경 적용")}
          </Button>
        </div>
      </section>
    );
  }
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        try {
          const candidate = change();
          applyChange(graph, candidate);
          setInvalid(false);
          setReview(candidate);
        } catch {
          setInvalid(true);
        }
      }}
    >
      <fieldset disabled={busy} className="access-fieldset">
        {kind === "roles" && (
          <div className="ui-actions">
            <Button
              variant={tab === "grants" ? "primary" : "secondary"}
              aria-pressed={tab === "grants"}
              onClick={() => {
                setTab("grants");
                setQuery("");
              }}
            >
              {t("사용자·조직에 역할 부여")}
            </Button>
            <Button
              variant={tab === "bindings" ? "primary" : "secondary"}
              aria-pressed={tab === "bindings"}
              onClick={() => {
                setTab("bindings");
                setQuery("");
              }}
            >
              {t("정책 부여와 만료")}
            </Button>
          </div>
        )}
        {!resourceFocus && (
          <label className="access-search">
            {t("이름 또는 식별자로 검색")}
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
        )}
        {(kind === "users" || kind === "organizations") && (
          <>
            <p>
              {t(
                "직접 부여할 역할을 선택하세요. 각 역할의 정책과 리소스를 확인할 수 있습니다.",
              )}
            </p>
            {graph.roles.filter(matches).map((r) => (
              <article className="access-card" key={r.id}>
                <label>
                  <input
                    type="checkbox"
                    checked={selectedRoles.includes(r.id)}
                    onChange={() => setRoles(toggle(selectedRoles, r.id))}
                  />
                  <strong>{r.name}</strong>
                </label>
                <p>{r.description}</p>
                <RolePreview graph={graph} role={r} />
              </article>
            ))}
          </>
        )}
        {kind === "roles" && tab === "grants" && (
          <>
            <RolePreview graph={graph} role={role!} />
            <div className="access-columns">
              {(["users", "organizations"] as const).map((type) => (
                <section key={type}>
                  <h3>{t(labels[type])}</h3>
                  {graph[type].filter(matches).map((item) => (
                    <label className="access-choice" key={item.id}>
                      <input
                        type="checkbox"
                        checked={(type === "users"
                          ? userIds
                          : organizationIds
                        ).includes(item.id)}
                        onChange={() =>
                          type === "users"
                            ? setUsers(toggle(userIds, item.id))
                            : setOrganizations(toggle(organizationIds, item.id))
                        }
                      />
                      {item.name}
                    </label>
                  ))}
                </section>
              ))}
            </div>
          </>
        )}
        {kind === "roles" && tab === "bindings" && (
          <>
            <p>
              {t(
                "만료 시점은 역할·정책 연결에만 적용됩니다. 다른 역할의 동일 정책에는 영향을 주지 않습니다.",
              )}
            </p>
            <p className="muted">
              {t("입력 시간대")}:{" "}
              {Intl.DateTimeFormat().resolvedOptions().timeZone}
            </p>
            {graph.policies.filter(matches).map((p) => {
              const binding = bindings.find((b) => b.policyId === p.id);
              return (
                <article className="access-card" key={p.id}>
                  <label>
                    <input
                      type="checkbox"
                      checked={Boolean(binding)}
                      onChange={() =>
                        setBindings(
                          binding
                            ? bindings.filter((b) => b.policyId !== p.id)
                            : [
                                ...bindings,
                                { policyId: p.id, expiresAt: null },
                              ],
                        )
                      }
                    />
                    <strong>{p.name}</strong>{" "}
                    <span className={`access-effect ${p.effect}`}>
                      {t(p.effect === "allow" ? "허용" : "거부")}
                    </span>
                  </label>
                  {binding && (
                    <div className="access-expiry">
                      <label>
                        <input
                          type="checkbox"
                          checked={!binding.expiresAt}
                          onChange={(e) =>
                            setBindings(
                              bindings.map((b) =>
                                b.policyId === p.id
                                  ? {
                                      ...b,
                                      expiresAt: e.target.checked
                                        ? null
                                        : new Date(
                                            Date.now() + 86400000,
                                          ).toISOString(),
                                    }
                                  : b,
                              ),
                            )
                          }
                        />
                        {t("무기한")}
                      </label>
                      {binding.expiresAt && (
                        <label>
                          {t("만료 시점")}
                          <input
                            type="datetime-local"
                            required
                            value={localDate(binding.expiresAt)}
                            onChange={(e) => {
                              const value = e.target.value;
                              if (
                                value &&
                                Number.isFinite(new Date(value).getTime())
                              )
                                setBindings(
                                  bindings.map((b) =>
                                    b.policyId === p.id
                                      ? {
                                          ...b,
                                          expiresAt: new Date(
                                            value,
                                          ).toISOString(),
                                        }
                                      : b,
                                  ),
                                );
                            }}
                          />
                        </label>
                      )}
                    </div>
                  )}
                  <details>
                    <summary>{t("연결 리소스")}</summary>
                    <ResourceList graph={graph} policy={p} />
                  </details>
                </article>
              );
            })}
          </>
        )}
        {kind === "policies" && (
          <>
            <fieldset className="access-effect-selector">
              <legend>{t("연결된 모든 리소스에 적용할 효과")}</legend>
              {(["allow", "deny"] as const).map((v) => (
                <label key={v}>
                  <input
                    type="radio"
                    name="effect"
                    checked={effect === v}
                    onChange={() => setEffect(v)}
                  />
                  {t(v === "allow" ? "허용" : "거부")}
                </label>
              ))}
            </fieldset>
            <p>
              {t(
                "유형별로 여러 리소스를 연결할 수 있습니다. 선택한 모든 리소스에 같은 효과가 적용됩니다.",
              )}
            </p>
            <div className="access-tools">
              <label>
                {t("리소스 유형")}
                <select
                  aria-label={t("리소스 유형")}
                  value={resourceType}
                  onChange={(e) => setType(e.target.value as ResourceKind)}
                >
                  {resourceKinds.map((k) => (
                    <option key={k} value={k}>
                      {t(labels[k])} ({refs.filter((r) => r.kind === k).length})
                    </option>
                  ))}
                </select>
              </label>
              <span>
                {t("선택한 리소스")}: {refs.length}
              </span>
              <Button
                variant="secondary"
                onClick={() => {
                  const visible = graph.resources.filter(
                    (r) => r.kind === resourceType && matches(r),
                  );
                  setRefs([
                    ...refs,
                    ...visible
                      .filter((r) => !checkedRef(r))
                      .map(({ kind, id }) => ({ kind, id })),
                  ]);
                }}
              >
                {t("검색 결과 전체 선택")}
              </Button>
            </div>
            {graph.resources
              .filter((r) => r.kind === resourceType && matches(r))
              .map((r) => (
                <label key={r.id} className="access-choice">
                  <input
                    type="checkbox"
                    checked={checkedRef(r)}
                    onChange={() =>
                      setRefs(
                        checkedRef(r)
                          ? refs.filter(
                              (ref) => ref.kind !== r.kind || ref.id !== r.id,
                            )
                          : [...refs, { kind: r.kind, id: r.id }],
                      )
                    }
                  />
                  <span>
                    {r.name}
                    <small>{r.path || r.id}</small>
                  </span>
                </label>
              ))}
            <details open>
              <summary>
                {t("선택한 리소스")} · {refs.length}
              </summary>
              <ResourceList
                graph={graph}
                policy={{ ...policy!, resources: refs, effect }}
              />
            </details>
          </>
        )}
        {resourceFocus && (
          <div className="access-resource-editor">
            <div className="access-resource-fields">
              <label>
                {t("이름")}
                <input
                  required
                  maxLength={120}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </label>
              <label>
                {t("설명")}
                <textarea
                  maxLength={2000}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </label>
              {["pages", "service-endpoints"].includes(kind) && (
                <label>
                  {t("경로")}
                  <input
                    required
                    value={path}
                    onChange={(e) => setPath(e.target.value)}
                  />
                </label>
              )}
              {kind === "service-endpoints" && (
                <label>
                  {t("HTTP 메서드")}
                  <select
                    value={method}
                    onChange={(e) => setMethod(e.target.value)}
                  >
                    {[
                      "GET",
                      "POST",
                      "PUT",
                      "PATCH",
                      "DELETE",
                      "HEAD",
                      "OPTIONS",
                    ].map((m) => (
                      <option key={m}>{m}</option>
                    ))}
                  </select>
                </label>
              )}
            </div>
            <ImpactExplorer graph={graph} kind={kind as ResourceKind} id={id} />
          </div>
        )}
        {invalid && <p role="alert">{t(errorLabels.INVALID_CHANGE)}</p>}
        <div className="access-footer">
          <Button type="submit">{t("변경사항 검토")}</Button>
        </div>
      </fieldset>
    </form>
  );
}
function localDate(value: string) {
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}
export function AuthorizationPanel({
  kind,
  id,
}: {
  kind: FocusKind;
  id: string;
}) {
  const { t, mode } = useI18n();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [graph, setGraph] = useState<Graph | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const title =
    kind === "users" || kind === "organizations"
      ? "역할 부여"
      : kind === "roles"
        ? "역할 부여 관리"
        : kind === "policies"
          ? "리소스 연결과 정책 효과"
          : "리소스 수정과 영향 범위";
  async function load() {
    setBusy(true);
    setError("");
    setSaved(false);
    try {
      const result = await loadAuthorization();
      if (result.graph) setGraph(result.graph);
      else setError(result.error);
    } catch {
      setError("REQUEST_FAILED");
    } finally {
      setBusy(false);
    }
  }
  async function save(change: Change) {
    if (!graph) return;
    setBusy(true);
    setError("");
    try {
      const result = await changeAuthorization(graph.revision, change);
      if (result.graph) {
        setGraph(result.graph);
        setSaved(true);
        router.refresh();
      } else setError(result.error);
    } catch {
      setError("REQUEST_FAILED");
    } finally {
      setBusy(false);
    }
  }
  const exists =
    graph &&
    (kind === "users"
      ? graph.users
      : kind === "organizations"
        ? graph.organizations
        : kind === "roles"
          ? graph.roles
          : kind === "policies"
            ? graph.policies
            : graph.resources.filter((r) => r.kind === kind)
    ).some((r) => r.id === id);
  return (
    <section className="access-entry">
      <Dialog
        title={t(title)}
        description={t(
          "연결된 권한과 리소스를 확인하고 변경사항을 검토한 후 적용하세요.",
        )}
        trigger={<Button variant="secondary">{t(title)}</Button>}
        open={open}
        busy={busy}
        onOpenChange={(next) => {
          setOpen(next);
          if (next) {
            setGraph(null);
            void load();
          }
        }}
      >
        <div className="authorization-editor">
          {mode === "demo" && (
            <p className="identity-demo">
              {t(
                "예제 변경은 현재 브라우저 세션에서만 유지되며 서버 재시작 시 초기화됩니다.",
              )}
            </p>
          )}
          {busy && !graph && <p role="status">{t("불러오는 중…")}</p>}
          {error === "FORBIDDEN" ? (
            <AccessDenied />
          ) : error === "UNAUTHENTICATED" ? (
            <p role="alert">
              <Link href="/login">{t("로그인이 필요합니다")}</Link>
            </p>
          ) : (
            <>
              {error && (
                <div role="alert">
                  <p>{t(errorLabels[error] ?? errorLabels.REQUEST_FAILED)}</p>
                  <Button variant="secondary" disabled={busy} onClick={load}>
                    {t("다시 불러오기")}
                  </Button>
                </div>
              )}
              {saved && <p role="status">{t("변경사항을 적용했습니다")}</p>}
              {graph && exists && (
                <Editor
                  key={`${graph.revision}-${kind}-${id}`}
                  graph={graph}
                  kind={kind}
                  id={id}
                  onSave={save}
                  busy={busy}
                />
              )}{" "}
              {graph && !exists && (
                <p role="alert">{t("접근 권한이 없습니다")}</p>
              )}
            </>
          )}
        </div>
      </Dialog>
    </section>
  );
}
