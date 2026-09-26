"use client";
import { ResourceDeploymentStatus } from "@/features/resource-sync/detail-status";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useI18n, DateValue } from "@/i18n/provider";
import { AccessDenied } from "@/features/auth/access-denied";
import { loadAuthorization, changeAuthorization } from "./actions";
import {
  applyChange,
  resourceKinds,
  type Graph,
  type Change,
  type FocusKind,
  type ResourceKind,
} from "./model";
import "./styles.css";
import { Explorer, type ExplorerNode } from "./explorer";
import { ResourceImpact } from "./resource-impact";
import { SubjectImpact } from "./subject-impact-view";
const labels: Record<FocusKind, string> = {
  users: "사용자",
  organizations: "조직",
  roles: "역할",
  policies: "정책",
  workspaces: "워크스페이스",
  pages: "페이지",
  services: "서비스",
  "service-endpoints": "서비스 엔드포인트",
  domains: "업무 도메인",
  actions: "Action",
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
  return <Explorer nodes={resourceNodes(graph, policy, t)} />;
}
function resourceNodes(
  graph: Graph,
  policy: Graph["policies"][number],
  t: (s: string) => string,
): ExplorerNode[] {
  return resourceKinds
    .filter((kind) => policy.resources.some((r) => r.kind === kind))
    .map((kind) => ({
      id: kind,
      name: t(labels[kind]),
      kind: "리소스 유형",
      children: policy.resources
        .filter((r) => r.kind === kind)
        .map((ref) => {
          const resource = graph.resources.find(
            (r) => r.id === ref.id && r.kind === kind,
          );
          return {
            id: ref.id,
            name: resource?.name ?? ref.id,
            kind: "리소스",
            detail: resource?.path,
            href: `/${kind}/${encodeURIComponent(ref.id)}`,
          };
        }),
    }));
}
function roleNodes(
  graph: Graph,
  roles: Graph["roles"],
  t: (s: string) => string,
): ExplorerNode[] {
  return roles.map((role) => ({
    id: role.id,
    name: role.name,
    kind: "역할",
    href: `/roles/${role.id}`,
    children: role.bindings.flatMap((binding) => {
      const policy = graph.policies.find((p) => p.id === binding.policyId);
      return policy
        ? [
            {
              id: policy.id,
              name: policy.name,
              kind: "정책",
              relation: "정책 부여",
              href: `/policies/${policy.id}`,
              detail: (
                <>
                  {t(policy.effect === "allow" ? "허용" : "거부")} ·{" "}
                  {binding.expiresAt ? (
                    <DateValue value={binding.expiresAt} time />
                  ) : (
                    t("무기한")
                  )}
                </>
              ),
              children: resourceNodes(graph, policy, t),
            },
          ]
        : [];
    }),
  }));
}
export function ImpactExplorer({
  graph,
  kind,
  id,
}: {
  graph: Graph;
  kind: ResourceKind;
  id: string;
}) {
  return <ResourceImpact graph={graph} resources={[{ kind, id }]} />;
}
function ReviewConnections({
  graph,
  change,
}: {
  graph: Graph;
  change: Change;
}) {
  if (change.type === "resource") return null;
  const next = applyChange(graph, change);
  const changedRoles = graph.roles.filter((r) => {
    const after = next.roles.find((a) => a.id === r.id)!;
    return (
      JSON.stringify(r) !== JSON.stringify(after) ||
      (change.type === "policy" &&
        r.bindings.some((b) => b.policyId === change.policyId))
    );
  });
  return (
    <section className="review-connections">
      <SubjectImpact
        graph={graph}
        afterGraph={next}
        scope={{ roleIds: changedRoles.map((r) => r.id) }}
      />
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
  const stepTitle = useRef<HTMLHeadingElement>(null);
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
  useEffect(() => {
    if (review) stepTitle.current?.focus();
  }, [review]);
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
  const selectedRoleItems =
    kind === "roles"
      ? [{ ...role!, bindings: tab === "bindings" ? bindings : role!.bindings }]
      : graph.roles.filter((r) => selectedRoles.includes(r.id));
  const recipients =
    kind === "users" || kind === "organizations"
      ? graph[kind]
          .filter((item) => item.id === id)
          .map((item) => ({ ...item, type: kind }))
      : [
          ...graph.users
            .filter((u) =>
              (kind === "roles" && tab === "bindings"
                ? role!.userIds
                : userIds
              ).includes(u.id),
            )
            .map((u) => ({ ...u, type: "users" })),
          ...graph.organizations
            .filter((o) =>
              (kind === "roles" && tab === "bindings"
                ? role!.organizationIds
                : organizationIds
              ).includes(o.id),
            )
            .map((o) => ({ ...o, type: "organizations" })),
          ...(kind === "roles" && tab === "bindings"
            ? (graph.serviceAccounts ?? [])
                .filter((a) => a.roleIds.includes(id))
                .map((a) => ({ ...a, type: "service-accounts" }))
            : []),
        ];
  const beforeItems =
    kind === "users" || kind === "organizations"
      ? graph.roles
          .filter((r) =>
            (kind === "users" ? r.userIds : r.organizationIds).includes(id),
          )
          .map((r) => ({ id: r.id, name: r.name }))
      : kind === "roles"
        ? tab === "bindings"
          ? graph.policies.filter((p) =>
              role!.bindings.some((b) => b.policyId === p.id),
            )
          : [
              ...graph.users.filter((u) => role!.userIds.includes(u.id)),
              ...graph.organizations.filter((o) =>
                role!.organizationIds.includes(o.id),
              ),
            ]
        : kind === "policies"
          ? graph.resources
              .filter((r) =>
                policy!.resources.some(
                  (ref) => ref.id === r.id && ref.kind === r.kind,
                ),
              )
              .map((r) => ({ id: `${r.kind}:${r.id}`, name: r.name }))
          : [];
  const afterItems =
    kind === "users" || kind === "organizations"
      ? selectedRoleItems
      : kind === "roles"
        ? tab === "bindings"
          ? graph.policies.filter((p) =>
              bindings.some((b) => b.policyId === p.id),
            )
          : recipients
        : kind === "policies"
          ? graph.resources
              .filter((r) =>
                refs.some((ref) => ref.id === r.id && ref.kind === r.kind),
              )
              .map((r) => ({ id: `${r.kind}:${r.id}`, name: r.name }))
          : [];
  const added = afterItems.filter(
    (a) => !beforeItems.some((b) => b.id === a.id),
  );
  const removed = beforeItems.filter(
    (b) => !afterItems.some((a) => a.id === b.id),
  );
  const delta = (
    <div className="assignment-delta">
      <h4>{t("부여 변경사항")}</h4>
      <div className="delta-add">
        <strong>
          {t("추가")} · {added.length}
        </strong>
        <p>{added.map((a) => a.name).join(", ") || t("없음")}</p>
      </div>
      <div className="delta-remove">
        <strong>
          {t("해제")} · {removed.length}
        </strong>
        <p>{removed.map((a) => a.name).join(", ") || t("없음")}</p>
      </div>
      <p className="muted">
        {t(
          "부여 변경 기준입니다. 다른 경로의 접근 유지 여부는 서버 판정이 필요합니다.",
        )}
      </p>
    </div>
  );
  const assignmentSummary =
    !resourceFocus && kind !== "policies" ? (
      <aside className="assignment-summary" aria-label={t("부여 내용 요약")}>
        <h3>{t("부여 내용 요약")}</h3>
        {delta}
        {!!removed.length && (
          <details className="review-resource-details">
            <summary>{t("해제 대상의 리소스 확인")}</summary>
            <Explorer
              nodes={
                kind === "roles" && tab === "bindings"
                  ? roleNodes(
                      graph,
                      [
                        {
                          ...role!,
                          bindings: role!.bindings.filter((b) =>
                            removed.some((r) => r.id === b.policyId),
                          ),
                        },
                      ],
                      t,
                    )
                  : roleNodes(
                      graph,
                      kind === "roles"
                        ? [role!]
                        : graph.roles.filter((r) =>
                            removed.some((item) => item.id === r.id),
                          ),
                      t,
                    )
              }
            />
          </details>
        )}
        <div className="assignment-recipients">
          <strong>
            {t("부여받는 대상")} · {recipients.length}
          </strong>
          <div>
            {recipients.map((item) => (
              <span className="assignment-chip" key={`${item.type}-${item.id}`}>
                {t(
                  item.type === "service-accounts"
                    ? "서비스 어카운트"
                    : labels[item.type as FocusKind],
                )}{" "}
                · {item.name}
              </span>
            ))}
            {!recipients.length && t("없음")}
          </div>
        </div>
        <strong>
          {t("선택한 역할과 접근 범위")} · {selectedRoleItems.length}
        </strong>
        <details className="review-resource-details">
          <summary>{t("변경 후 정책·리소스 확인")}</summary>
          <Explorer nodes={roleNodes(graph, selectedRoleItems, t)} />
        </details>
      </aside>
    ) : kind === "policies" ? (
      <aside className="assignment-summary" aria-label={t("부여 내용 요약")}>
        <h3>{t("부여 내용 요약")}</h3>
        {delta}
        <p>
          {t("정책")} · {policy!.name}
        </p>
        <p>
          {t("정책 효과")} · {t(effect === "allow" ? "허용" : "거부")}
        </p>
        <strong>
          {t("선택한 리소스")} · {refs.length}
        </strong>
        <ResourceList
          graph={graph}
          policy={{ ...policy!, resources: refs, effect }}
        />
      </aside>
    ) : null;
  const steps = (
    <ol className="authorization-steps" aria-label={t("진행 단계")}>
      <li aria-current={!review ? "step" : undefined}>
        <span>1</span>
        {t("대상 선택·수정")}
      </li>
      <li aria-current={review ? "step" : undefined}>
        <span>2</span>
        {t("변경사항 및 영향도 검토")}
      </li>
    </ol>
  );
  const contextName =
    resource?.name ??
    role?.name ??
    policy?.name ??
    (kind === "users" ? graph.users : graph.organizations).find(
      (item) => item.id === id,
    )?.name;
  if (review) {
    const before =
      kind === "roles"
        ? graph.roles.find((r) => r.id === id)
        : kind === "policies"
          ? graph.policies.find((p) => p.id === id)
          : null;
    return (
      <section className="access-review">
        {steps}
        <h3 ref={stepTitle} tabIndex={-1}>
          {t("변경사항 확인")} · {contextName}
        </h3>
        {assignmentSummary}
        <ReviewConnections graph={graph} change={review} />
        <p>
          {t(
            "저장하면 부여 내역과 접근 범위에 반영됩니다. 대상과 만료 시점을 확인해 주세요.",
          )}
        </p>
        {review.type === "bindings" &&
          bindings.some(
            (b) =>
              role!.bindings.find((old) => old.policyId === b.policyId)
                ?.expiresAt !== b.expiresAt,
          ) && (
            <section>
              <h3>{t("정책 만료 변경")}</h3>
              {bindings
                .filter(
                  (b) =>
                    role!.bindings.find((old) => old.policyId === b.policyId)
                      ?.expiresAt !== b.expiresAt,
                )
                .map((b) => {
                  const old = role!.bindings.find(
                    (v) => v.policyId === b.policyId,
                  );
                  return (
                    <p key={b.policyId}>
                      {graph.policies.find((p) => p.id === b.policyId)?.name} ·{" "}
                      {old ? (
                        old.expiresAt ? (
                          <DateValue value={old.expiresAt} time />
                        ) : (
                          t("무기한")
                        )
                      ) : (
                        t("없음")
                      )}{" "}
                      →{" "}
                      {b.expiresAt ? (
                        <DateValue value={b.expiresAt} time />
                      ) : (
                        t("무기한")
                      )}
                    </p>
                  );
                })}
            </section>
          )}
        {review.type === "policy" && (
          <>
            <p>
              {t("정책 효과")}:{" "}
              {t(policy!.effect === "allow" ? "허용" : "거부")} →{" "}
              <strong>{t(effect === "allow" ? "허용" : "거부")}</strong>
            </p>
            <p>
              {t("기존 항목")}: {policy!.resources.length} → {refs.length}
            </p>
          </>
        )}
        {review.type === "resource" && (
          <>
            <p>
              {resource!.name} → <strong>{name}</strong>
            </p>
            <p>
              {resource!.description} → {description}
            </p>
            {(resource!.path || path) && (
              <code>
                {resource!.method} {resource!.path} → {method} {path}
              </code>
            )}
            <ImpactExplorer graph={graph} kind={kind as ResourceKind} id={id} />
          </>
        )}
        {before && <p className="muted">{before.name}</p>}
        <div className="ui-actions access-footer">
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
      {steps}
      <h3>{contextName}</h3>
      <p className="muted">
        {t("대상을 선택한 뒤 다음 단계에서 영향 범위를 확인하세요.")}
      </p>
      <fieldset disabled={busy} className="access-fieldset">
        <div className="selection-stage">
          <div className="assignment-picker">
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
                    "직접 부여할 역할을 선택하세요. 정책과 리소스는 다음 단계에서 검토합니다.",
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
                  </article>
                ))}
              </>
            )}
            {kind === "roles" && tab === "grants" && (
              <>
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
                                : setOrganizations(
                                    toggle(organizationIds, item.id),
                                  )
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
                    "만료 시점은 역할·정책 부여에만 적용됩니다. 다른 역할의 동일 정책에는 영향을 주지 않습니다.",
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
                    </article>
                  );
                })}
              </>
            )}
            {kind === "policies" && (
              <>
                <fieldset className="access-effect-selector">
                  <legend>{t("모든 대상 리소스에 적용할 효과")}</legend>
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
                    "유형별로 여러 리소스를 지정할 수 있습니다. 선택한 모든 리소스에 같은 효과가 적용됩니다.",
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
                          {t(labels[k])} (
                          {refs.filter((r) => r.kind === k).length})
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
                                  (ref) =>
                                    ref.kind !== r.kind || ref.id !== r.id,
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
              </div>
            )}
          </div>
        </div>
        {invalid && <p role="alert">{t(errorLabels.INVALID_CHANGE)}</p>}
        <div className="access-footer">
          <span>{t("1 / 2 단계")}</span>
          <Button type="submit">{t("변경사항 및 영향도 검토")}</Button>
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
          ? "리소스 지정과 정책 효과"
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
  if (resourceKinds.includes(kind as ResourceKind))
    return <ResourceDeploymentStatus kind={kind} id={id} />;
  if (kind === "policies")
    return (
      <section className="access-entry">
        <p>
          {t(
            "정책 정의는 Git에서 관리합니다. 리소스와 요청·응답 처리 변경은 동기화에서 검토하세요.",
          )}
        </p>
        <Link
          className="identity-link"
          href={`/resources?type=policies&resource=${encodeURIComponent(id)}`}
        >
          {t("정책 변경 검토")}
        </Link>
      </section>
    );
  return (
    <section className="access-entry">
      <Dialog
        title={t(title)}
        description={t(
          "부여된 권한과 리소스를 확인하고 변경사항을 검토한 후 적용하세요.",
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
              {saved && (
                <div className="access-success" role="status">
                  <h3>{t("변경사항을 적용했습니다")}</h3>
                  <p>
                    {t("상세 화면에서 적용된 변경사항을 확인할 수 있습니다.")}
                  </p>
                  <Button onClick={() => setOpen(false)}>{t("완료")}</Button>
                </div>
              )}
              {graph && exists && !saved && (
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
