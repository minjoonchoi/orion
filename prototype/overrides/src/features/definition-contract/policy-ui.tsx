"use client";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { useI18n } from "@/i18n/provider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { BrowseTable } from "../identity/browse-table";
import { DetailTabs } from "../identity/detail-tabs";
import { useContract } from "./state";
import { obj, type Definition } from "./model";
import {
  grants,
  effective,
  compatible,
  requirements,
  subjects,
  type Grant,
  type Binding,
} from "./policy-model";
import "./styles.css";
const actionHref = (a: string) => `/actions/${a.replace(".", "~")}`;
export function PermissionTable({
  rows,
  title = "실행 가능한 업무",
}: {
  rows: Grant[];
  title?: string;
}) {
  const { t } = useI18n();
  const { applied } = useContract();
  if (!rows.length)
    return (
      <div className="contract-heading">
        <h3>{t(title)}</h3>
        <span>{t("해당 항목 없음")}</span>
      </div>
    );
  return (
    <BrowseTable
      title={t(title)}
      rows={rows}
      searchText={(r) => `${r.action} ${r.workspace} ${r.page}`}
      sortValue={(r) => r.action}
      columns={[
        {
          key: "action",
          header: t("액션"),
          sortable: true,
          render: (r) => (
            <Link href={actionHref(r.action)}>
              {applied.find(
                (d) => d.key === `action/${r.action.replace(".", "/")}`,
              )?.name ?? r.action}
              <small>{r.action}</small>
            </Link>
          ),
        },
        {
          key: "scope",
          header: t("실행 조건"),
          render: (r) =>
            r.workspace ? (
              <>
                <Link
                  href={`/pages/${r.workspace.replace(".", "~")}~${r.page}`}
                >
                  {applied.find(
                    (d) =>
                      d.key ===
                      `page/${r.workspace.replace(".", "/")}/${r.page}`,
                  )?.name ?? r.page}
                </Link>
                <small>{r.workspace}</small>
              </>
            ) : (
              <Badge>{t("페이지 조건 없음")}</Badge>
            ),
        },
      ]}
    />
  );
}
export function PolicyList() {
  const { applied, bindings } = useContract();
  const { t, mode } = useI18n();
  if (mode !== "demo")
    return (
      <p role="status">{t("새 정의 계약의 운영 API 연결이 필요합니다.")}</p>
    );
  const rows = applied.filter((d) => d.kind === "policy" && !d.parent);
  return (
    <section className="contract ui-layout-stack">
      <header>
        <h1>{t("정책")}</h1>
        <p>{t("역할과 서비스 어카운트에 부여할 실행 권한을 확인합니다.")}</p>
      </header>
      <BrowseTable
        title={t("정책 목록")}
        rows={rows}
        searchText={(r) => `${r.name} ${r.id}`}
        sortValue={(r) => r.name}
        filters={[
          {
            key: "target",
            label: t("부여 대상"),
            options: [
              { value: "role", label: t("역할") },
              { value: "service_account", label: t("서비스 어카운트") },
            ],
            matches: (r, v) => r.data.assignable_to === v,
          },
        ]}
        columns={[
          {
            key: "name",
            header: t("정책"),
            sortable: true,
            render: (r) => (
              <Link href={`/policies/${r.id}`}>
                {r.name}
                <small>{r.id}</small>
              </Link>
            ),
          },
          {
            key: "target",
            header: t("부여 대상"),
            render: (r) => (
              <Badge>
                {r.data.assignable_to === "role"
                  ? t("역할")
                  : t("서비스 어카운트")}
              </Badge>
            ),
          },
          {
            key: "effect",
            header: t("효과"),
            render: (r) => (
              <Badge tone={r.data.effect === "deny" ? "danger" : "success"}>
                {r.data.effect === "deny" ? t("거부") : t("허용")}
              </Badge>
            ),
          },
          {
            key: "scope",
            header: t("권한 범위"),
            render: (r) =>
              `${
                new Set(
                  grants(r)
                    .filter((g) => g.page)
                    .map((g) => g.workspace + g.page),
                ).size
              } ${t("페이지")} · ${new Set(grants(r).map((g) => g.action)).size} ${t("액션")}`,
          },
          {
            key: "assignments",
            header: t("부여 대상 수"),
            render: (r) =>
              Object.values(bindings).filter((bs) =>
                bs.some((b) => b.policy === r.id),
              ).length,
          },
        ]}
      />
    </section>
  );
}
export function PolicyPermissions({ entity }: { entity: Definition }) {
  const { t } = useI18n();
  const { bindings } = useContract();
  const rows = grants(entity);
  return (
    <div className="ui-layout-stack">
      <div className="contract-facts">
        <Badge>
          {entity.data.assignable_to === "role"
            ? t("역할용")
            : t("서비스 어카운트용")}
        </Badge>
        <Badge tone={entity.data.effect === "deny" ? "danger" : "success"}>
          {entity.data.effect === "deny" ? t("거부") : t("허용")}
        </Badge>
      </div>
      <PermissionTable
        title="직접 실행 액션"
        rows={rows.filter((g) => !g.page)}
      />
      <PermissionTable
        title="화면별 실행 액션"
        rows={rows.filter((g) => g.page)}
      />
      <p>
        {t(
          "직접 실행은 페이지 접근을 부여하지 않습니다. 화면별 실행은 지정한 페이지와 액션에만 적용됩니다.",
        )}
      </p>
      <BrowseTable
        title={t("부여 현황")}
        rows={subjects.filter((s) =>
          (bindings[s.id] ?? []).some((b) => b.policy === entity.id),
        )}
        searchText={(s) => s.name}
        sortValue={(s) => s.name}
        columns={[
          {
            key: "name",
            header: t("대상"),
            render: (s) => (
              <Link
                href={`/${s.kind === "role" ? "roles" : "service-accounts"}/${s.id}${s.kind === "service_account" ? "?tab=policies" : ""}`}
              >
                {s.name}
              </Link>
            ),
          },
          {
            key: "kind",
            header: t("부여 방식"),
            render: (s) =>
              s.kind === "role" ? t("역할을 통해 부여") : t("직접 부여"),
          },
        ]}
      />
    </div>
  );
}
export function BoundPolicies({ id }: { id: string }) {
  const { t, mode } = useI18n();
  const { applied, bindings, setBindings } = useContract();
  const [now, setNow] = useState(() => Date.now());
  const [open, setOpen] = useState(false),
    [step, setStep] = useState(0),
    [draft, setDraft] = useState<Binding[]>([]),
    [message, setMessage] = useState("");
  const subject = subjects.find((s) => s.id === id);
  if (mode !== "demo")
    return (
      <p role="status">{t("새 정의 계약의 운영 API 연결이 필요합니다.")}</p>
    );
  if (!subject)
    return <p>{t("신규 정책 부여 데이터가 연결되지 않았습니다.")}</p>;
  const current = bindings[id] ?? [];
  const available = applied.filter(
    (d) => d.kind === "policy" && !d.parent && compatible(d, subject),
  );
  const before = effective(applied, current, subject, now),
    after = effective(applied, draft, subject, now);
  const added = after.filter((g) => !before.some((b) => b.id === g.id)),
    removed = before.filter((g) => !after.some((a) => a.id === g.id)),
    kept = after.filter((g) => before.some((a) => a.id === g.id));
  const changed = JSON.stringify(draft) !== JSON.stringify(current);
  const selected = available.filter((p) =>
    draft.some((b) => b.policy === p.id),
  );
  const issues = selected
    .filter((p) => p.data.effect === "allow")
    .flatMap((p) =>
      grants(p).flatMap((g) => requirements(applied, g.action, subject)),
    );
  const invalid = draft.some(
    (b) =>
      b.expiresAt &&
      (!Number.isFinite(Date.parse(b.expiresAt)) ||
        Date.parse(b.expiresAt) <= now),
  );
  const toggle = (policy: string) =>
    setDraft((ds) =>
      ds.some((b) => b.policy === policy)
        ? ds.filter((b) => b.policy !== policy)
        : [...ds, { policy, expiresAt: null }],
    );
  return (
    <section className="contract ui-layout-stack">
      <div className="contract-heading">
        <h2>
          {t(subject.kind === "role" ? "역할에 연결된 정책" : "직접 부여 정책")}
        </h2>
        <Button
          onClick={() => {
            setNow(Date.now());
            setDraft(current.map((b) => ({ ...b })));
            setStep(0);
            setOpen(true);
            setMessage("");
          }}
        >
          {t("정책 변경")}
        </Button>
      </div>
      {message && <p role="status">{t(message)}</p>}
      <BrowseTable
        title={t("부여된 정책")}
        rows={current.map((b) => ({
          ...b,
          id: b.policy,
          name: available.find((p) => p.id === b.policy)?.name ?? b.policy,
        }))}
        searchText={(b) => b.name}
        sortValue={(b) => b.name}
        columns={[
          {
            key: "name",
            header: t("정책"),
            render: (b) => <Link href={`/policies/${b.policy}`}>{b.name}</Link>,
          },
          {
            key: "expiry",
            header: t("만료"),
            render: (b) => b.expiresAt ?? t("무기한"),
          },
          {
            key: "state",
            header: t("상태"),
            render: (b) => (
              <Badge>
                {b.expiresAt && Date.parse(b.expiresAt) <= now
                  ? t("만료됨")
                  : t("활성")}
              </Badge>
            ),
          },
        ]}
      />
      <PermissionTable rows={before} />
      {subject.kind === "service_account" && (
        <p>
          {t(
            "API 호출은 계정·키 활성 상태와 키의 서비스 제한도 만족해야 합니다. 기존 역할 권한은 아래 이관 대상에서 별도로 확인합니다.",
          )}
        </p>
      )}
      <Dialog
        open={open}
        onOpenChange={setOpen}
        trigger={null}
        title={step ? t("정책 변경 검토") : t("정책 선택")}
        description={`${subject.name} · ${t(subject.kind === "role" ? "역할용 정책" : "서비스 어카운트용 정책")}`}
        size="wide"
      >
        <div className="contract ui-layout-stack">
          {!step ? (
            <>
              <p>
                {t(
                  "추가할 정책만 선택합니다. 기존 정책의 유지·해제와 만료를 함께 검토합니다.",
                )}
              </p>
              {available.map((p) => {
                const b = draft.find((b) => b.policy === p.id);
                return (
                  <div className="ui-panel ui-layout-stack" key={p.id}>
                    <div className="contract-heading">
                      <label className="policy-choice">
                        <input
                          type="checkbox"
                          checked={!!b}
                          onChange={() => toggle(p.id)}
                        />
                        {p.name}
                      </label>
                      <Badge
                        tone={p.data.effect === "deny" ? "danger" : "success"}
                      >
                        {p.data.effect === "deny" ? t("거부") : t("허용")}
                      </Badge>
                    </div>
                    <small>
                      {grants(p)
                        .map((g) => g.action)
                        .join(", ")}
                    </small>
                    {b && (
                      <label>
                        {t("만료 시각 · 비우면 무기한")}
                        <input
                          type="datetime-local"
                          value={
                            b.expiresAt
                              ? new Date(
                                  Date.parse(b.expiresAt) -
                                    new Date(b.expiresAt).getTimezoneOffset() *
                                      60000,
                                )
                                  .toISOString()
                                  .slice(0, 16)
                              : ""
                          }
                          onChange={(e) => {
                            const value = e.target.value;
                            setDraft((ds) =>
                              ds.map((x) =>
                                x.policy === p.id
                                  ? {
                                      ...x,
                                      expiresAt: value
                                        ? new Date(value).toISOString()
                                        : null,
                                    }
                                  : x,
                              ),
                            );
                          }}
                        />
                      </label>
                    )}
                  </div>
                );
              })}
            </>
          ) : (
            <>
              <div className="contract-facts">
                <Badge tone="success">
                  {t("추가")} {added.length}
                </Badge>
                <Badge tone="danger">
                  {t("제거")} {removed.length}
                </Badge>
                <Badge>
                  {t("유지")} {kept.length}
                </Badge>
              </div>
              <p>
                {t(
                  "액션 권한은 선택한 모든 정책과 거부 규칙을 합산합니다. 같은 권한을 다른 정책이 허용하면 유지됩니다.",
                )}
              </p>
              <PermissionTable title="추가되는 권한" rows={added} />
              <PermissionTable title="제거되는 권한" rows={removed} />
              <PermissionTable title="유지되는 권한" rows={kept} />
              <details>
                <summary>{t("정책 변경 내역")}</summary>
                <div className="ui-disclosure-body ui-layout-stack">
                  {available
                    .filter(
                      (p) =>
                        current.some((b) => b.policy === p.id) ||
                        draft.some((b) => b.policy === p.id),
                    )
                    .map((p) => (
                      <p key={p.id}>
                        {p.name} ·{" "}
                        {draft.some((b) => b.policy === p.id)
                          ? current.some((b) => b.policy === p.id)
                            ? t("유지")
                            : t("추가")
                          : t("해제")}
                      </p>
                    ))}
                </div>
              </details>
              <p>
                {t(
                  "응답 필드와 마스킹은 각 액션 상세에서 확인합니다. 사용자·조직의 전체 영향 집계는 운영 부여 데이터 연결이 필요합니다.",
                )}
              </p>
            </>
          )}
          {invalid && (
            <p role="alert">{t("만료 시각은 현재 이후여야 합니다.")}</p>
          )}
          {!!issues.length && (
            <p role="alert">{[...new Set(issues)].join(" · ")}</p>
          )}
          <div className="contract-actions">
            <Button
              variant="secondary"
              onClick={() => (step ? setStep(0) : setOpen(false))}
            >
              {t(step ? "이전" : "취소")}
            </Button>
            <Button
              disabled={!changed || invalid || issues.length > 0}
              onClick={() => {
                setNow(Date.now());
                if (
                  draft.some(
                    (b) => b.expiresAt && Date.parse(b.expiresAt) <= Date.now(),
                  )
                )
                  return;
                if (!step) {
                  setStep(1);
                  return;
                }
                setBindings((bs) => ({ ...bs, [id]: draft }));
                setOpen(false);
                setMessage("정책 부여 변경을 반영했습니다.");
              }}
            >
              {t(step ? "적용" : "변경 검토")}
            </Button>
          </div>
        </div>
      </Dialog>
    </section>
  );
}
export function PolicyRoleCatalog() {
  const { t, mode } = useI18n();
  if (mode !== "demo") return null;
  return (
    <section className="contract ui-layout-stack">
      <h2>{t("영업 플랫폼 역할")}</h2>
      {subjects
        .filter((s) => s.kind === "role")
        .map((s) => (
          <Link key={s.id} href={`/roles/${s.id}`}>
            {s.name}
          </Link>
        ))}
    </section>
  );
}
export function PolicyRoleDetail({
  id,
  children,
}: {
  id: string;
  children: ReactNode;
}) {
  const { t, mode } = useI18n();
  const subject = subjects.find((s) => s.id === id && s.kind === "role");
  if (!subject || mode !== "demo") return <>{children}</>;
  return (
    <div className="contract ui-layout-stack">
      <header>
        <h1>{subject.name}</h1>
        <p>
          {subject.platform} · {subject.id}
        </p>
      </header>
      <DetailTabs
        items={[
          {
            value: "policies",
            label: t("정책"),
            content: <BoundPolicies id={id} />,
          },
          {
            value: "members",
            label: t("부여 대상"),
            content: (
              <p>
                <Link
                  href={`/users/${id === "role-sales-manager" ? "usr-001" : "usr-002"}`}
                >
                  {id === "role-sales-manager" ? "usr-001" : "usr-002"}
                </Link>
              </p>
            ),
          },
        ]}
      />
    </div>
  );
}
export function PolicyAccessCheck() {
  const { t, mode } = useI18n();
  const { applied, bindings } = useContract();
  const [subjectId, setSubjectId] = useState(subjects[0].id),
    [action, setAction] = useState("employee.read-regional-employees"),
    [result, setResult] = useState<string | null>(null);
  if (mode !== "demo") return null;
  const subject = subjects.find((s) => s.id === subjectId)!;
  const actions = applied.filter((d) => d.kind === "action");
  const a = actions.find((a) => `${a.parent}.${a.id}` === action),
    ep = obj(a?.data.endpoint);
  const endpoint = applied.find(
    (d) => d.key === `endpoint/${ep.service}/${ep.endpoint}`,
  );
  return (
    <section className="contract ui-panel ui-layout-stack">
      <h1>{t("정책 실행 권한 확인")}</h1>
      <p>
        {t(
          "역할 합산 또는 서비스 어카운트 직접 부여 기준입니다. 실제 인증·멤버십·API 키 검증은 Gateway에서 수행합니다.",
        )}
      </p>
      <div className="contract-toolbar">
        <label>
          {t("확인 대상")}
          <select
            value={subjectId}
            onChange={(e) => {
              setSubjectId(e.target.value);
              setResult(null);
            }}
          >
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} · {s.kind}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t("액션")}
          <select
            value={action}
            onChange={(e) => {
              setAction(e.target.value);
              setResult(null);
            }}
          >
            {actions.map((a) => (
              <option key={a.key} value={`${a.parent}.${a.id}`}>
                {a.name}
              </option>
            ))}
          </select>
        </label>
        <Button
          onClick={() => {
            const allowed = effective(
              applied,
              bindings[subject.id] ?? [],
              subject,
            ).some((g) => g.action === action);
            const issues = requirements(applied, action, subject);
            setResult(
              !allowed
                ? "거부 · 유효한 허용 정책 없음"
                : issues.length
                  ? issues.join(" · ")
                  : "정책 허용 · 운영 인증 및 요청 검증 필요",
            );
          }}
        >
          {t("확인")}
        </Button>
      </div>
      {result && <p role="status">{t(result)}</p>}
      <pre className="policy-code">{`${endpoint?.data.method ?? ""} /gateway/services/${ep.service ?? ""}${endpoint?.data.path ?? ""}\nOrion-Action: ${action}`}</pre>
      <p>
        {t(
          "서비스·메서드·경로가 액션 정의와 일치해야 합니다. 응답 규칙은 호출한 액션 하나만 적용합니다.",
        )}
      </p>
    </section>
  );
}
export function PolicyLegacyNotice() {
  const { mode, t } = useI18n();
  return mode === "demo" ? (
    <p className="ui-panel">
      {t(
        "기존 키·결재의 전용 역할은 이관 대상입니다. 신규 직접 정책과 자동 합산하거나 삭제하지 않으며, 이관 전후 권한 비교가 필요합니다.",
      )}
    </p>
  ) : null;
}
export function ActionInvocation({ entity }: { entity: Definition }) {
  const { applied } = useContract();
  const { t } = useI18n();
  const ep = obj(entity.data.endpoint);
  const endpoint = applied.find(
    (d) => d.key === `endpoint/${ep.service}/${ep.endpoint}`,
  );
  return (
    <section className="contract ui-panel ui-layout-stack">
      <h2>{t("Gateway 호출 계약")}</h2>
      <pre className="policy-code">{`${endpoint?.data.method ?? ""} /gateway/services/${ep.service}${endpoint?.data.path ?? ""}\nOrion-Action: ${entity.parent}.${entity.id}`}</pre>
      <p>
        {t(
          "인증 정보와 액션 키를 전달합니다. 주입 값은 서버에서 결정하며 페이지 헤더는 필수가 아닙니다.",
        )}
      </p>
    </section>
  );
}
export function PolicySyncImpact({
  keys,
  next,
}: {
  keys: string[];
  next: Definition[];
}) {
  const { applied, bindings } = useContract();
  const { t } = useI18n();
  const changed = new Set(keys);
  let size = -1;
  while (size !== changed.size) {
    size = changed.size;
    for (const d of [...applied, ...next])
      if (d.refs.some((r) => changed.has(r))) changed.add(d.key);
  }
  const rows = subjects
    .filter((s) =>
      (bindings[s.id] ?? []).some((b) => changed.has(`policy/${b.policy}`)),
    )
    .map((s) => {
      const before = effective(applied, bindings[s.id] ?? [], s),
        after = effective(next, bindings[s.id] ?? [], s);
      return {
        ...s,
        added: after.filter((g) => !before.some((b) => b.id === g.id)).length,
        removed: before.filter((g) => !after.some((b) => b.id === g.id)).length,
        kept: after.filter((g) => before.some((b) => b.id === g.id)).length,
      };
    });
  return (
    <div className="ui-layout-stack">
      <BrowseTable
        title={t("권한 부여 영향")}
        rows={rows}
        searchText={(r) => r.name}
        sortValue={(r) => r.name}
        columns={[
          { key: "name", header: t("대상"), render: (r) => r.name },
          {
            key: "kind",
            header: t("부여 방식"),
            render: (r) => (r.kind === "role" ? t("역할") : t("직접 부여")),
          },
          {
            key: "change",
            header: t("액션 권한 변화"),
            render: (r) =>
              `${t("추가")} ${r.added} · ${t("제거")} ${r.removed} · ${t("유지")} ${r.kept}`,
          },
        ]}
      />
      <p>
        {t(
          "권한이 유지되어도 scope·요청 주입·응답 필드·마스킹이 바뀌면 데이터 접근 범위가 달라집니다. 아래 정의 차이를 함께 확인하세요.",
        )}
      </p>
    </div>
  );
}
export function UserPolicyAccess({ id }: { id: string }) {
  const { t, mode } = useI18n();
  const { applied, bindings } = useContract();
  if (mode !== "demo") return null;
  const roleIds: Record<string, string[]> = {
    "usr-001": ["role-sales-manager"],
    "usr-002": ["role-sales-reader"],
  };
  const roles = subjects.filter(
    (s) => s.kind === "role" && (roleIds[id] ?? []).includes(s.id),
  );
  const byPlatform = [...new Set(roles.map((r) => r.platform))];
  return (
    <section className="contract ui-panel ui-layout-stack">
      <h2>{t("정책 기준 업무 권한")}</h2>
      <p>
        {t(
          "역할의 정책을 합산한 결과입니다. 플랫폼 멤버십과 운영 권한 검증은 별도로 확인해야 합니다.",
        )}
      </p>
      {byPlatform.length ? (
        byPlatform.map((platform) => {
          const group = roles.filter((r) => r.platform === platform);
          const effectiveBindings = group.flatMap((r) => bindings[r.id] ?? []);
          return (
            <div key={platform} className="ui-layout-stack">
              <h3>{platform}</h3>
              <div className="contract-actions">
                {group.map((r) => (
                  <Link key={r.id} href={`/roles/${r.id}`}>
                    {r.name}
                  </Link>
                ))}
              </div>
              <PermissionTable
                rows={effective(applied, effectiveBindings, group[0])}
              />
            </div>
          );
        })
      ) : (
        <p>{t("신규 정책에 연결된 역할이 없습니다.")}</p>
      )}
    </section>
  );
}
