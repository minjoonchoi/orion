"use client";
import "./styles.css";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useI18n } from "@/i18n/provider";
import { PageHeading } from "@/components/ui/page-heading";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { BrowseTable } from "../identity/browse-table";
import { DetailTabs } from "../identity/detail-tabs";
import { Details, DemoNotice } from "../identity/shared";
import { userRoleIds, type Directory } from "./model";
import { saveRecipients } from "./actions";
const link = (href: string, name: string) => (
  <Link className="identity-link" href={href}>
    {name}
  </Link>
);
const memberHref = (m: Directory["members"][number]) =>
  `/platforms/${m.platformId}/members/${m.id}`;
export function Memberships({
  d,
  userId,
  platformId,
}: {
  d: Directory;
  userId?: string;
  platformId?: string;
}) {
  const { t } = useI18n();
  const rows = d.members.filter(
    (m) =>
      (!userId || m.userId === userId) &&
      (!platformId || m.platformId === platformId),
  );
  return (
    <BrowseTable
      title={t(userId ? "플랫폼 멤버십" : "플랫폼 멤버 목록")}
      rows={rows.map((m) => ({
        ...m,
        id: `${m.platformId}/${m.id}`,
        href: memberHref(m),
      }))}
      searchText={(m) =>
        `${m.name} ${m.email} ${d.platforms.find((p) => p.id === m.platformId)?.name}`
      }
      sortValue={(m) => m.name}
      columns={[
        {
          key: "platform",
          header: t("플랫폼"),
          render: (m) =>
            link(
              `/platforms/${m.platformId}`,
              d.platforms.find((p) => p.id === m.platformId)!.name,
            ),
        },
        {
          key: "name",
          header: t("닉네임"),
          sortable: true,
          render: (m) => link(m.href, m.name),
        },
        { key: "email", header: t("이메일"), render: (m) => m.email },
        {
          key: "status",
          header: t("멤버 상태"),
          render: (m) => (
            <Badge>{t(m.status === "active" ? "활성" : "중지")}</Badge>
          ),
        },
        {
          key: "roles",
          header: t("역할"),
          render: (m) =>
            link(
              `${m.href}?tab=roles`,
              `${userRoleIds(d, m.userId, m.platformId).length}${t("개")}`,
            ),
        },
      ]}
    />
  );
}
export function ScopedRoles({
  d,
  platformId,
  roleIds,
}: {
  d: Directory;
  platformId?: string;
  roleIds?: string[];
}) {
  const { t } = useI18n();
  const rows = d.roles.filter(
    (r) =>
      (!platformId || r.platformId === platformId) &&
      (!roleIds || roleIds.includes(r.id)),
  );
  return (
    <BrowseTable
      title={t("플랫폼 역할 목록")}
      rows={rows}
      searchText={(r) => `${r.name} ${r.description} ${r.platformId}`}
      sortValue={(r) => r.name}
      filters={
        platformId
          ? []
          : [
              {
                key: "platform",
                label: t("플랫폼 필터"),
                options: d.platforms.map((p) => ({
                  value: p.id,
                  label: p.name,
                })),
                matches: (r, v) => r.platformId === v,
              },
            ]
      }
      columns={[
        {
          key: "name",
          header: t("역할"),
          sortable: true,
          render: (r) => link(`/roles/${r.id}`, r.name),
        },
        {
          key: "platform",
          header: t("플랫폼"),
          render: (r) =>
            link(
              `/platforms/${r.platformId}`,
              d.platforms.find((p) => p.id === r.platformId)!.name,
            ),
        },
        { key: "description", header: t("설명"), render: (r) => r.description },
        {
          key: "members",
          header: t("사용자"),
          render: (r) =>
            link(
              `/roles/${r.id}?tab=users`,
              `${d.userRoles.filter((a) => a.platformId === r.platformId && a.roleIds.includes(r.id)).length}${t("명")}`,
            ),
        },
        {
          key: "accounts",
          header: t("서비스 어카운트"),
          render: (r) =>
            r.platformId === "orion"
              ? link(
                  `/roles/${r.id}?tab=service-accounts`,
                  `${d.accounts.filter((a) => a.roleIds.includes(r.id)).length}${t("개")}`,
                )
              : "—",
        },
        {
          key: "policies",
          header: t("정책"),
          render: (r) =>
            link(
              `/roles/${r.id}?tab=policies`,
              `${r.policyIds.length}${t("개")}`,
            ),
        },
      ]}
    />
  );
}
export function PlatformsScreen({ d, id }: { d: Directory; id?: string }) {
  const { t } = useI18n();
  const p = d.platforms.find((p) => p.id === id);
  if (!id)
    return (
      <>
        <PageHeading
          title={t("플랫폼")}
          description={t(
            "플랫폼별 로그인 인증과 멤버·워크스페이스·역할을 관리합니다.",
          )}
        />
        <DemoNotice />
        <BrowseTable
          title={t("플랫폼 목록")}
          rows={d.platforms}
          searchText={(p) => `${p.name} ${p.description}`}
          sortValue={(p) => p.name}
          columns={[
            {
              key: "name",
              header: t("플랫폼"),
              sortable: true,
              render: (p) => link(`/platforms/${p.id}`, p.name),
            },
            {
              key: "description",
              header: t("설명"),
              render: (p) => p.description,
            },
            {
              key: "auth",
              header: t("로그인 인증"),
              render: (p) => p.provider,
            },
            {
              key: "members",
              header: t("멤버"),
              render: (p) =>
                link(
                  `/platforms/${p.id}?tab=members`,
                  `${d.members.filter((m) => m.platformId === p.id).length}${t("명")}`,
                ),
            },
            {
              key: "workspaces",
              header: t("워크스페이스"),
              render: (p) =>
                link(
                  `/platforms/${p.id}?tab=workspaces`,
                  `${d.workspaces.filter((w) => w.platformId === p.id).length}${t("개")}`,
                ),
            },
            {
              key: "roles",
              header: t("역할"),
              render: (p) =>
                link(
                  `/platforms/${p.id}?tab=roles`,
                  `${d.roles.filter((r) => r.platformId === p.id).length}${t("개")}`,
                ),
            },
          ]}
        />
      </>
    );
  if (!p) return <p>{t("항목을 찾을 수 없습니다")}</p>;
  const workspaces = d.workspaces.filter((w) => w.platformId === p.id);
  return (
    <>
      <Breadcrumbs
        items={[{ label: t("플랫폼"), href: "/platforms" }, { label: p.name }]}
      />
      <PageHeading title={p.name} description={p.description} />
      <DemoNotice />
      <DetailTabs
        actions={{ members: <RecipientPicker d={d} platformId={p.id} /> }}
        items={[
          {
            value: "info",
            label: t("기본 정보"),
            content: (
              <section className="ui-panel">
                <h2>{t("플랫폼 정보")}</h2>
                <Details
                  items={[
                    { label: "ID", value: p.id },
                    { label: t("플랫폼"), value: p.name },
                    { label: t("로그인 인증"), value: p.provider },
                    { label: t("인증 주체"), value: t("플랫폼 멤버") },
                  ]}
                />
              </section>
            ),
          },
          {
            value: "members",
            label: `${t("멤버")} (${d.members.filter((m) => m.platformId === p.id).length})`,
            content: <Memberships d={d} platformId={p.id} />,
          },
          {
            value: "workspaces",
            label: `${t("워크스페이스")} (${workspaces.length})`,
            content: (
              <BrowseTable
                title={t("워크스페이스 목록")}
                rows={workspaces}
                searchText={(w) => w.name}
                sortValue={(w) => w.name}
                columns={[
                  {
                    key: "name",
                    header: t("이름"),
                    sortable: true,
                    render: (w) => link(`/workspaces/${w.id}`, w.name),
                  },
                  {
                    key: "platform",
                    header: t("플랫폼"),
                    render: () => p.name,
                  },
                ]}
              />
            ),
          },
          {
            value: "roles",
            label: `${t("역할")} (${d.roles.filter((r) => r.platformId === p.id).length})`,
            content: <ScopedRoles d={d} platformId={p.id} />,
          },
          {
            value: "authentication",
            label: t("인증 설정"),
            content: (
              <section className="ui-panel">
                <h2>{t("플랫폼별 로그인 인증")}</h2>
                <p>
                  {t(
                    "로그인 후 플랫폼 멤버 상태를 확인하고, 사용자에게 부여된 이 플랫폼의 역할로 접근을 판단합니다.",
                  )}
                </p>
                <Details
                  items={[
                    { label: t("인증 제공자"), value: p.provider },
                    { label: "Issuer", value: p.issuer },
                    { label: "Client ID", value: p.clientId },
                    { label: t("로그인 API"), value: p.loginPath },
                  ]}
                />
              </section>
            ),
          },
        ]}
      />
    </>
  );
}
function RecipientPicker({
  d,
  platformId,
  roleId,
  operation = "add",
}: {
  d: Directory;
  platformId: string;
  roleId?: string;
  operation?: "add" | "remove";
}) {
  const { t } = useI18n(),
    router = useRouter();
  const [open, setOpen] = useState(false),
    [step, setStep] = useState(1),
    [selected, setSelected] = useState<string[]>([]),
    [query, setQuery] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const platform = d.platforms.find((p) => p.id === platformId)!;
  const role = d.roles.find((r) => r.id === roleId);
  const eligible = d.users.filter((u) => {
    const exists = role
      ? userRoleIds(d, u.id, platformId).includes(role.id)
      : d.members.some((m) => m.platformId === platformId && m.userId === u.id);
    return operation === "add" ? !exists : exists;
  });
  const filtered = eligible.filter((u) =>
    (u.name + " " + u.email + " " + u.id)
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  const chosen = d.users.filter((u) => selected.includes(u.id));
  const title = role
    ? operation === "add"
      ? "사용자 추가"
      : "사용자 해제"
    : "멤버 추가";
  return (
    <Dialog
      title={t(title)}
      description={t(
        role
          ? "이 역할을 부여할 사용자를 역할 상세에서 관리합니다."
          : "사용자 카탈로그에서 플랫폼에 추가할 멤버를 선택합니다.",
      )}
      open={open}
      busy={busy}
      onOpenChange={(v) => {
        setOpen(v);
        if (v) {
          setStep(1);
          setSelected([]);
          setQuery("");
          setError("");
        }
      }}
      trigger={
        <Button
          variant={operation === "remove" ? "secondary" : "primary"}
          disabled={platform.status !== "active" || !eligible.length}
        >
          {t(title)}
        </Button>
      }
    >
      <div className="ui-stack platform-role-review">
        <div className="platform-recipient-summary">
          <span>
            {t("플랫폼")} · {platform.name}
          </span>
          {role && (
            <strong>
              {t("역할")} · {role.name}
            </strong>
          )}
        </div>
        <p className="muted">
          {t(step === 1 ? "1. 사용자 선택" : "2. 변경사항 및 영향도 검토")}
        </p>
        {step === 1 ? (
          <>
            <label
              htmlFor={"recipient-search-" + (roleId ?? platformId) + operation}
            >
              {t("사용자 검색")}
            </label>
            <input
              id={"recipient-search-" + (roleId ?? platformId) + operation}
              className="platform-user-search"
              placeholder={t("닉네임·이메일 검색")}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <p aria-live="polite">
              {t("선택한 사용자")} {selected.length}
              {t("명")} · {t("검색 결과")} {filtered.length}
              {t("명")}
            </p>
            <div className="platform-recipient-list">
              {filtered.map((u) => (
                <label key={u.id}>
                  <input
                    type="checkbox"
                    checked={selected.includes(u.id)}
                    onChange={(e) =>
                      setSelected(
                        e.target.checked
                          ? [...selected, u.id]
                          : selected.filter((id) => id !== u.id),
                      )
                    }
                  />
                  <span>
                    <strong>{u.name}</strong>
                    <small>{u.email}</small>
                  </span>
                  {role && (
                    <Badge>
                      {t(
                        d.members.some(
                          (m) =>
                            m.platformId === platformId &&
                            m.userId === u.id &&
                            m.status === "active",
                        )
                          ? "활성 멤버"
                          : "활성 멤버십 없음",
                      )}
                    </Badge>
                  )}
                </label>
              ))}
              {!filtered.length && <p>{t("검색 결과가 없습니다.")}</p>}
            </div>
          </>
        ) : (
          <>
            <section>
              <strong>
                {t("선택한 사용자")} · {chosen.length}
                {t("명")}
              </strong>
              <ul className="platform-review-users">
                {chosen.map((u) => (
                  <li key={u.id}>
                    {u.name} <span className="muted">{u.email}</span>
                  </li>
                ))}
              </ul>
            </section>
            <section>
              <strong>
                {t(
                  role
                    ? operation === "add"
                      ? "역할 부여"
                      : "역할 해제"
                    : "플랫폼 멤버 추가",
                )}
              </strong>
              <p>
                {t(
                  role
                    ? operation === "add"
                      ? "선택한 사용자에게 이 역할을 부여합니다. 플랫폼 멤버십은 변경하지 않습니다."
                      : "선택한 사용자의 이 역할만 해제합니다. 다른 역할과 플랫폼 멤버십은 유지합니다."
                    : "선택한 사용자를 활성 멤버로 추가합니다. 역할은 자동으로 부여하지 않습니다.",
                )}
              </p>
              {role ? (
                <>
                  <p>
                    {t("역할")} → {role.name} → {t("정책")}
                  </p>
                  <ul>
                    {role.policyIds.map((id) => (
                      <li key={id}>
                        {link(
                          "/policies/" + id,
                          d.policies.find((p) => p.id === id)?.name ?? id,
                        )}
                      </li>
                    ))}
                  </ul>
                  {!role.policyIds.length && <p>{t("정책 없음")}</p>}
                  <p>
                    {t("실제 접근에는 활성 멤버십과 정책 평가가 필요합니다.")}
                  </p>
                </>
              ) : (
                <p>
                  {t(
                    "기존 사용자 역할은 유지하며 해당 플랫폼 로그인 시 확인합니다.",
                  )}
                </p>
              )}
            </section>
          </>
        )}
        {error && <p role="alert">{t(error)}</p>}
        <div>
          {step === 2 && (
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => setStep(1)}
            >
              {t("이전")}
            </Button>
          )}
          <Button
            disabled={busy || !selected.length}
            onClick={async () => {
              if (step === 1) {
                setStep(2);
                return;
              }
              setBusy(true);
              try {
                const result = await saveRecipients({
                  kind: role ? "role-users" : "members",
                  platformId,
                  roleId: role?.id,
                  operation,
                  userIds: selected,
                  expectedRevision: d.revision,
                });
                if (result.error) setError(result.error);
                else {
                  setOpen(false);
                  router.refresh();
                }
              } catch {
                setError("변경사항을 저장하지 못했습니다.");
              } finally {
                setBusy(false);
              }
            }}
          >
            {t(
              busy
                ? "저장 중…"
                : step === 1
                  ? "변경사항 및 영향도 검토"
                  : "변경 적용",
            )}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

export function MemberScreen({
  d,
  platformId,
  id,
}: {
  d: Directory;
  platformId: string;
  id: string;
}) {
  const { t } = useI18n();
  const m = d.members.find((m) => m.platformId === platformId && m.id === id)!;
  const p = d.platforms.find((p) => p.id === platformId)!;
  return (
    <>
      <Breadcrumbs
        items={[
          { label: t("플랫폼"), href: "/platforms" },
          { label: p.name, href: `/platforms/${p.id}?tab=members` },
          { label: m.name },
        ]}
      />
      <PageHeading
        title={m.name}
        description={`${p.name} · ${t("플랫폼 멤버")}`}
      />
      <DemoNotice />
      <DetailTabs
        items={[
          {
            value: "info",
            label: t("기본 정보"),
            content: (
              <section className="ui-panel">
                <h2>{t("플랫폼 멤버 정보")}</h2>
                <Details
                  items={[
                    {
                      label: t("사용자"),
                      value: link(`/users/${m.userId}`, m.name),
                    },
                    {
                      label: t("플랫폼"),
                      value: link(`/platforms/${p.id}`, p.name),
                    },
                    { label: t("이메일"), value: m.email },
                    {
                      label: t("멤버 상태"),
                      value: t(m.status === "active" ? "활성" : "중지"),
                    },
                    { label: t("로그인 인증"), value: p.provider },
                  ]}
                />
              </section>
            ),
          },
          {
            value: "roles",
            label: `${t("역할")} (${userRoleIds(d, m.userId, m.platformId).length})`,
            content: (
              <>
                <p>
                  {t(
                    "사용자에게 부여된 플랫폼 역할입니다. 멤버는 이 역할을 통해 권한을 확인합니다.",
                  )}
                </p>
                <ScopedRoles
                  d={d}
                  platformId={p.id}
                  roleIds={userRoleIds(d, m.userId, m.platformId)}
                />
              </>
            ),
          },
        ]}
      />
    </>
  );
}
export function ScopedRoleScreen({ d, id }: { d: Directory; id: string }) {
  const { t } = useI18n();
  const r = d.roles.find((r) => r.id === id)!;
  const p = d.platforms.find((p) => p.id === r.platformId)!;
  const users = d.users.filter((u) => userRoleIds(d, u.id, p.id).includes(id)),
    organizations = d.organizations.filter(
      (o) => o.platformId === p.id && o.roleIds.includes(id),
    ),
    accounts = d.accounts.filter((a) => a.roleIds.includes(id)),
    policies = d.policies.filter((p) => r.policyIds.includes(p.id));
  return (
    <>
      <Breadcrumbs
        items={[{ label: t("역할"), href: "/roles" }, { label: r.name }]}
      />
      <PageHeading
        title={r.name}
        description={`${p.name} · ${r.description}`}
      />
      <DemoNotice />
      <DetailTabs
        aliases={{ members: "users" }}
        actions={{
          users: (
            <div className="platform-recipient-actions">
              <RecipientPicker d={d} platformId={p.id} roleId={r.id} />
              <RecipientPicker
                d={d}
                platformId={p.id}
                roleId={r.id}
                operation="remove"
              />
            </div>
          ),
        }}
        items={[
          {
            value: "info",
            label: t("기본 정보"),
            content: (
              <section className="ui-panel">
                <h2>{t("역할 정보")}</h2>
                <Details
                  items={[
                    { label: "ID", value: r.id },
                    {
                      label: t("플랫폼"),
                      value: link(`/platforms/${p.id}`, p.name),
                    },
                    {
                      label: t("부여 대상"),
                      value: t(
                        p.id === "orion"
                          ? "사용자·조직·전역 서비스 어카운트"
                          : "사용자·조직",
                      ),
                    },
                  ]}
                />
              </section>
            ),
          },
          {
            value: "users",
            label: `${t("사용자")} (${users.length})`,
            content: (
              <BrowseTable
                title={t("사용자 목록")}
                rows={users}
                searchText={(u) => u.name + " " + u.email}
                sortValue={(u) => u.name}
                columns={[
                  {
                    key: "name",
                    header: t("닉네임"),
                    render: (u) => link(`/users/${u.id}?tab=roles`, u.name),
                  },
                  { key: "email", header: t("이메일"), render: (u) => u.email },
                  {
                    key: "membership",
                    header: t("멤버 상태"),
                    render: (u) =>
                      t(
                        d.members.some(
                          (m) =>
                            m.platformId === p.id &&
                            m.userId === u.id &&
                            m.status === "active",
                        )
                          ? "활성"
                          : "로그인 불가",
                      ),
                  },
                ]}
              />
            ),
          },
          {
            value: "organizations",
            label: `${t("조직")} (${organizations.length})`,
            content: (
              <>
                <p>{t("해당 플랫폼의 멤버인 조직원에게만 적용합니다.")}</p>
                <BrowseTable
                  title={t("조직 목록")}
                  rows={organizations}
                  searchText={(o) => o.name}
                  sortValue={(o) => o.name}
                  columns={[
                    {
                      key: "name",
                      header: t("조직"),
                      render: (o) =>
                        link(`/organizations/${o.id}?tab=roles`, o.name),
                    },
                  ]}
                />
              </>
            ),
          },
          ...(p.id === "orion"
            ? [
                {
                  value: "service-accounts",
                  label: `${t("서비스 어카운트")} (${accounts.length})`,
                  content: (
                    <>
                      <p>
                        {t(
                          "플랫폼 멤버십 없이 API 키로 인증하는 전역 서버 통신 주체입니다.",
                        )}
                      </p>
                      <BrowseTable
                        title={t("서비스 어카운트 목록")}
                        rows={accounts}
                        searchText={(a) => a.name}
                        sortValue={(a) => a.name}
                        columns={[
                          {
                            key: "name",
                            header: t("서비스 어카운트"),
                            render: (a) =>
                              link(
                                `/service-accounts/${a.id}?tab=roles`,
                                a.name,
                              ),
                          },
                        ]}
                      />
                    </>
                  ),
                },
              ]
            : []),
          {
            value: "policies",
            label: `${t("정책")} (${policies.length})`,
            content: (
              <BrowseTable
                title={t("정책 목록")}
                rows={policies}
                searchText={(p) => p.name}
                sortValue={(p) => p.name}
                columns={[
                  {
                    key: "name",
                    header: t("정책"),
                    render: (p) => link(`/policies/${p.id}`, p.name),
                  },
                ]}
              />
            ),
          },
        ]}
      />
    </>
  );
}
export function RoleCatalog({ d }: { d: Directory }) {
  const { t } = useI18n();
  return (
    <>
      <PageHeading
        title={t("역할")}
        description={t(
          "플랫폼별 역할을 관리합니다. 서비스 어카운트에는 Orion 역할을 부여합니다.",
        )}
      />
      <DemoNotice />
      <ScopedRoles d={d} />
    </>
  );
}

export function UserPlatformRoles({
  d,
  userId,
}: {
  d: Directory;
  userId: string;
}) {
  const { t } = useI18n();
  const [platformId, setPlatformId] = useState(d.platforms[0]?.id ?? "");
  return (
    <>
      <div className="ui-panel platform-role-toolbar">
        <label>
          {t("플랫폼")}{" "}
          <select
            aria-label={t("플랫폼 필터")}
            value={platformId}
            onChange={(e) => setPlatformId(e.target.value)}
          >
            {d.platforms.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>{" "}
        <p>{t("역할은 역할 상세의 사용자 탭에서 관리합니다.")}</p>
      </div>
      <ScopedRoles
        d={d}
        platformId={platformId}
        roleIds={userRoleIds(d, userId, platformId)}
      />
    </>
  );
}
