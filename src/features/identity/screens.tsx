"use client";
import { Memberships, UserPlatformRoles } from "../platforms/screens";
import { userRoleIds, type Directory } from "../platforms/model";
import type { RelatedGroup } from "../relationships/repository";
import { useI18n } from "@/i18n/provider";
import Link from "next/link";

import type { ReactNode } from "react";
import { PageHeading } from "@/components/ui/page-heading";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { DetailTabs } from "./detail-tabs";
import { BrowseTable, statusOptions } from "./browse-table";
import { date, Details, StatusBadge, EmploymentBadge, Summary } from "./shared";
import type {
  UserRow,
  OrganizationRow,
  UserDetail,
  OrganizationDetail,
  Role,
  Status,
} from "./types";
const nameColumn = { key: "name", header: "이름", sortable: true };
const statusColumn = {
  key: "status",
  header: "상태",
  render: (row: { status: Status }) => <StatusBadge status={row.status} />,
};
const statusFilter = {
  key: "status",
  label: "상태 필터",
  options: statusOptions,
  matches: (row: { status: Status }, value: string) => row.status === value,
};
const employmentColumn = {
  key: "status",
  header: "재직 상태",
  render: (row: UserRow | OrganizationDetail["members"][number]) => (
    <EmploymentBadge status={row.status} />
  ),
};
const employmentFilter = {
  key: "status",
  label: "재직 상태 필터",
  options: [
    { value: "employed", label: "재직" },
    { value: "on_leave", label: "휴직" },
  ],
  matches: (row: { status: string }, value: string) => row.status === value,
};
function DetailLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link className="identity-link" href={href}>
      {children}
    </Link>
  );
}
export function UsersList({
  rows,
  organizations,
  directory,
}: {
  directory: Directory;
  rows: UserRow[];
  organizations: OrganizationRow[];
}) {
  const { t } = useI18n();
  return (
    <>
      <PageHeading
        title={t("사용자")}
        description={t(
          "전역 사용자 카탈로그에서 사용자 정보와 플랫폼별 역할을 조회합니다.",
        )}
      />
      <Summary
        items={[
          { label: t("전체 사용자"), value: rows.length },
          {
            label: t("재직 사용자"),
            value: rows.filter((r) => r.status === "employed").length,
          },
          {
            label: t("휴직 사용자"),
            value: rows.filter((r) => r.status === "on_leave").length,
          },
        ]}
      />
      <BrowseTable
        title={t("사용자 목록")}
        rows={rows.map((r) => ({
          ...r,
          roleCount: userRoleIds(directory, r.id).length,
        }))}
        searchText={(r) => `${r.name} ${r.email} ${r.id}`}
        sortValue={(r, k) => (k === "roleCount" ? r.roleCount : r.name)}
        filters={[
          employmentFilter,
          {
            key: "organization",
            label: t("소속 조직 필터"),
            options: organizations.map((o) => ({ value: o.id, label: o.name })),
            matches: (r, v) => r.organizations.some((o) => o.id === v),
          },
        ]}
        columns={[
          {
            ...nameColumn,
            header: t("닉네임"),
            render: (r) => (
              <>
                <DetailLink href={`/users/${r.id}`}>{r.name}</DetailLink>
              </>
            ),
          },
          { key: "email", header: t("이메일"), render: (r) => r.email },
          employmentColumn,
          {
            key: "organizations",
            header: t("소속 조직"),
            render: (r) => (
              <div className="identity-org-links">
                {r.organizations.length
                  ? r.organizations.map((o) => (
                      <DetailLink key={o.id} href={`/organizations/${o.id}`}>
                        {o.name}
                      </DetailLink>
                    ))
                  : t("소속 없음")}
              </div>
            ),
          },
          {
            key: "roleCount",
            header: t("역할"),
            sortable: true,
            render: (r) => (
              <DetailLink href={`/users/${r.id}?tab=roles`}>
                {r.roleCount}
                {t("개")}
              </DetailLink>
            ),
          },
        ]}
      />
    </>
  );
}
export function OrganizationsList({ rows }: { rows: OrganizationRow[] }) {
  const { t } = useI18n();
  return (
    <>
      <PageHeading
        title={t("조직")}
        description={t("조직별 멤버와 서비스, 역할의 현황을 조회합니다.")}
      />
      <Summary
        items={[
          { label: t("전체 조직"), value: rows.length },
          {
            label: t("활성 조직"),
            value: rows.filter((r) => r.status === "active").length,
          },
          {
            label: t("비활성 조직"),
            value: rows.filter((r) => r.status === "inactive").length,
          },
        ]}
      />
      <BrowseTable
        title={t("조직 목록")}
        rows={rows}
        searchText={(r) => `${r.name} ${r.code} ${r.id} ${r.description}`}
        sortValue={(r, k) => (k === "name" ? r.name : r.memberCount)}
        filters={[statusFilter]}
        columns={[
          {
            ...nameColumn,
            render: (r) => (
              <>
                <DetailLink href={`/organizations/${r.id}`}>
                  {r.name}
                </DetailLink>
                <div className="identity-meta">{r.code}</div>
              </>
            ),
          },
          {
            key: "description",
            header: t("설명"),
            render: (r) => r.description,
          },
          statusColumn,
          {
            key: "memberCount",
            header: t("멤버"),
            sortable: true,
            render: (r) => (
              <DetailLink href={`/organizations/${r.id}?tab=members`}>
                {r.memberCount}
                {t("명")}
              </DetailLink>
            ),
          },
          {
            key: "leader",
            header: t("조직장"),
            render: (r) =>
              r.leader ? (
                <DetailLink href={`/users/${r.leader.id}`}>
                  {r.leader.name}
                </DetailLink>
              ) : (
                t("미지정")
              ),
          },
          {
            key: "parentOrganization",
            header: t("상위 조직"),
            render: (r) =>
              r.parentOrganization ? (
                <DetailLink href={`/organizations/${r.parentOrganization.id}`}>
                  {r.parentOrganization.name}
                </DetailLink>
              ) : (
                t("없음")
              ),
          },
          {
            key: "roleCount",
            header: t("역할"),
            render: (r) => (
              <DetailLink href={`/organizations/${r.id}?tab=roles`}>
                {r.roleCount}
                {t("개")}
              </DetailLink>
            ),
          },
        ]}
      />
    </>
  );
}
function Roles({ rows }: { rows: Role[] }) {
  const { t } = useI18n();
  return (
    <>
      <p className="identity-role-note">
        {t(
          "직접 부여된 역할입니다. 조직 역할에 따른 권한 상속은 표시하지 않습니다.",
        )}
      </p>
      <BrowseTable
        title={t("역할 목록")}
        rows={rows}
        searchText={(r) => `${r.name} ${r.id} ${r.description}`}
        sortValue={(r) => r.name}
        columns={[
          {
            ...nameColumn,
            render: (r) => (
              <DetailLink href={`/roles/${r.id}`}>{r.name}</DetailLink>
            ),
          },
          { key: "id", header: t("역할 ID"), render: (r) => r.id },
          {
            key: "description",
            header: t("설명"),
            render: (r) => r.description,
          },
        ]}
      />
    </>
  );
}
export function UserScreen({
  data,
  directory,
}: {
  data: UserDetail;
  directory: Directory;
}) {
  const { t } = useI18n();
  const { user: u, organizations } = data;
  return (
    <>
      <Breadcrumbs
        items={[{ label: t("사용자"), href: "/users" }, { label: u.name }]}
      />
      <PageHeading title={u.name} description={u.email} />
      <DetailTabs
        items={[
          {
            value: "info",
            label: t("기본 정보"),
            content: (
              <section className="ui-panel">
                <h2 className="identity-info-title">{t("사용자 정보")}</h2>
                <Details
                  items={[
                    { label: t("닉네임"), value: u.name },
                    { label: t("이메일"), value: u.email },
                    {
                      label: t("재직 상태"),
                      value: <EmploymentBadge status={u.status} />,
                    },
                  ]}
                />
              </section>
            ),
          },
          {
            value: "platforms",
            label: t(
              `플랫폼 (${directory.members.filter((m) => m.userId === u.id).length})`,
            ),
            content: <Memberships d={directory} userId={u.id} />,
          },
          {
            value: "organizations",
            label: t(`소속 조직 (${organizations.length})`),
            content: (
              <>
                <BrowseTable
                  title={t("소속 조직 목록")}
                  rows={organizations}
                  searchText={(r) => `${r.name} ${r.code} ${r.id}`}
                  sortValue={(r) => r.name}
                  filters={[statusFilter]}
                  columns={[
                    {
                      ...nameColumn,
                      render: (r) => (
                        <DetailLink href={`/organizations/${r.id}`}>
                          {r.name}
                        </DetailLink>
                      ),
                    },
                    {
                      key: "code",
                      header: t("조직 코드"),
                      render: (r) => r.code,
                    },
                    statusColumn,
                    {
                      key: "joinedAt",
                      header: t("소속일"),
                      render: (r) => date(r.joinedAt),
                    },
                  ]}
                />
              </>
            ),
          },
          {
            value: "roles",
            label: t(`역할 (${userRoleIds(directory, u.id).length})`),
            content: <UserPlatformRoles d={directory} userId={u.id} />,
          },
        ]}
      />
    </>
  );
}
export function OrganizationScreen({
  data,
  groups = [],
}: {
  data: OrganizationDetail;
  groups?: RelatedGroup[];
}) {
  const { t } = useI18n();
  const { organization: o, members, serviceAccounts, services, roles } = data;
  const accountKeys = (id: string) =>
    groups
      .flatMap((group) => group.rows)
      .filter((key) =>
        key.serviceAccounts?.some((account) => account.id === id),
      );
  return (
    <>
      <Breadcrumbs
        items={[
          { label: t("조직"), href: "/organizations" },
          { label: o.name },
        ]}
      />
      <PageHeading title={o.name} description={o.description} />
      <DetailTabs
        aliases={{ "api-keys": "service-accounts" }}
        items={[
          {
            value: "info",
            label: t("기본 정보"),
            content: (
              <section className="ui-panel">
                <h2 className="identity-info-title">{t("조직 정보")}</h2>
                <Details
                  items={[
                    { label: t("조직 ID"), value: o.id },
                    {
                      label: t("조직장"),
                      value: o.leader ? (
                        <DetailLink href={`/users/${o.leader.id}`}>
                          {o.leader.name}
                        </DetailLink>
                      ) : (
                        t("미지정")
                      ),
                    },
                    {
                      label: t("상위 조직"),
                      value: o.parentOrganization ? (
                        <DetailLink
                          href={`/organizations/${o.parentOrganization.id}`}
                        >
                          {o.parentOrganization.name}
                        </DetailLink>
                      ) : (
                        t("없음")
                      ),
                    },
                    { label: t("조직명"), value: o.name },
                    { label: t("조직 코드"), value: o.code },
                    { label: t("설명"), value: o.description },
                    {
                      label: t("상태"),
                      value: <StatusBadge status={o.status} />,
                    },
                    { label: t("등록일"), value: date(o.createdAt) },
                  ]}
                />
              </section>
            ),
          },
          {
            value: "members",
            label: t(`멤버 (${members.length})`),
            content: (
              <BrowseTable
                title={t("멤버 목록")}
                rows={members}
                searchText={(r) => `${r.name} ${r.email} ${r.id}`}
                sortValue={(r) => r.name}
                filters={[employmentFilter]}
                columns={[
                  {
                    ...nameColumn,
                    header: t("닉네임"),
                    render: (r) => (
                      <DetailLink href={`/users/${r.id}`}>{r.name}</DetailLink>
                    ),
                  },
                  { key: "email", header: t("이메일"), render: (r) => r.email },
                  employmentColumn,
                  {
                    key: "joinedAt",
                    header: t("소속일"),
                    render: (r) => date(r.joinedAt),
                  },
                ]}
              />
            ),
          },
          {
            value: "service-accounts",
            label: t(`서비스 어카운트 (${serviceAccounts.length})`),
            content: (
              <BrowseTable
                title={t("서비스 어카운트 목록")}
                rows={serviceAccounts}
                searchText={(r) =>
                  `${r.name} ${r.id} ${r.description} ${accountKeys(r.id)
                    .map((key) => `${key.name} ${key.id}`)
                    .join(" ")}`
                }
                sortValue={(r) => r.name}
                filters={[statusFilter]}
                columns={[
                  {
                    ...nameColumn,
                    render: (r) => (
                      <>
                        <DetailLink href={`/service-accounts/${r.id}`}>
                          {r.name}
                        </DetailLink>
                        <div className="identity-meta">{r.id}</div>
                      </>
                    ),
                  },
                  {
                    key: "description",
                    header: t("설명"),
                    render: (r) => r.description,
                  },
                  {
                    key: "apiKeys",
                    header: t("API 키"),
                    render: (account) => (
                      <DetailLink
                        href={`/service-accounts/${account.id}?tab=api-keys`}
                      >
                        {accountKeys(account.id).length}
                        {t("개")}
                      </DetailLink>
                    ),
                  },
                  statusColumn,
                  {
                    key: "createdAt",
                    header: t("등록일"),
                    render: (r) => date(r.createdAt),
                  },
                  {
                    key: "lastUsedAt",
                    header: t("최근 사용일"),
                    render: (r) => date(r.lastUsedAt),
                  },
                ]}
              />
            ),
          },
          {
            value: "services",
            label: t(`관리 서비스 (${services.length})`),
            content: (
              <BrowseTable
                title={t("관리 서비스 목록")}
                rows={services}
                searchText={(r) => `${r.name} ${r.id} ${r.description}`}
                sortValue={(r) => r.name}
                filters={[statusFilter]}
                columns={[
                  {
                    ...nameColumn,
                    render: (r) => (
                      <>
                        <DetailLink href={`/services/${r.id}`}>
                          {r.name}
                        </DetailLink>
                        <div className="identity-meta">{r.id}</div>
                      </>
                    ),
                  },
                  {
                    key: "description",
                    header: t("설명"),
                    render: (r) => r.description,
                  },
                  statusColumn,
                ]}
              />
            ),
          },
          {
            value: "roles",
            label: t(`역할 (${roles.length})`),
            content: <Roles rows={roles} />,
          },
        ]}
      />
    </>
  );
}
