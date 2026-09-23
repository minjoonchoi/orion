"use client";
import { useI18n } from "@/i18n/provider";
import Link from "next/link";
import type { ReactNode } from "react";
import { PageHeading } from "@/components/ui/page-heading";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import type { Column } from "@/components/ui/data-table";
import { BrowseTable, type BrowseFilter } from "../identity/browse-table";
import { DetailTabs } from "../identity/detail-tabs";
import { DemoNotice, Details, Summary, StatusBadge } from "../identity/shared";
import type {
  RoleRow,
  PolicyRow,
  RoleDetail,
  PolicyDetail,
} from "./repository";
type Named = { id: string; name: string; description: string };
const link = (href: string, name: string) => (
  <Link className="identity-link" href={href}>
    {name}
  </Link>
);
function ResourceTable<T extends Named>({
  title,
  rows,
  route,
  columns = [],
  filters = [],
}: {
  title: string;
  rows: T[];
  route?: string;
  columns?: Column<T>[];
  filters?: BrowseFilter<T>[];
}) {
  const { t } = useI18n();
  return (
    <BrowseTable
      title={t(title)}
      rows={rows}
      searchText={(r) => `${r.name} ${r.id} ${r.description}`}
      sortValue={(r, key) => {
        const value = r[key as keyof T];
        return typeof value === "number" ? value : String(value ?? "");
      }}
      filters={filters}
      columns={[
        {
          key: "name",
          header: t("이름"),
          sortable: true,
          render: (r) => (
            <>
              {route ? link(`${route}/${r.id}`, r.name) : r.name}
              <div className="identity-meta">{r.id}</div>
            </>
          ),
        },
        { key: "description", header: t("설명"), render: (r) => r.description },
        ...columns,
      ]}
    />
  );
}
function Policies({ rows }: { rows: PolicyRow[] }) {
  const { t } = useI18n();
  return (
    <ResourceTable
      title={t("정책 목록")}
      rows={rows}
      route="/policies"
      filters={[
        {
          key: "resources",
          label: t("리소스 연결 필터"),
          options: [
            { value: "linked", label: t("연결됨") },
            { value: "empty", label: t("미연결") },
          ],
          matches: (r, v) =>
            r.serviceCount + r.endpointCount + r.workspaceCount > 0 ===
            (v === "linked"),
        },
      ]}
      columns={[
        {
          key: "serviceCount",
          header: t("서비스"),
          sortable: true,
          render: (r) =>
            link(`/policies/${r.id}?tab=services`, t(`${r.serviceCount}개`)),
        },
        {
          key: "endpointCount",
          header: t("엔드포인트"),
          sortable: true,
          render: (r) =>
            link(`/policies/${r.id}?tab=endpoints`, t(`${r.endpointCount}개`)),
        },
        {
          key: "workspaceCount",
          header: t("워크스페이스"),
          sortable: true,
          render: (r) =>
            link(
              `/policies/${r.id}?tab=workspaces`,
              t(`${r.workspaceCount}개`),
            ),
        },
      ]}
    />
  );
}
export function RolesList({ rows }: { rows: RoleRow[] }) {
  const { t } = useI18n();
  return (
    <>
      <PageHeading
        title={t("역할")}
        description={t("역할에 직접 연결된 사용자·조직과 정책을 조회합니다.")}
      />
      <DemoNotice />
      <Summary
        items={[
          { label: t("전체 역할"), value: rows.length },
          {
            label: t("정책 연결 역할"),
            value: rows.filter((r) => r.policyCount > 0).length,
          },
          {
            label: t("정책 미연결 역할"),
            value: rows.filter((r) => r.policyCount === 0).length,
          },
        ]}
      />
      <ResourceTable
        title={t("역할 목록")}
        rows={rows}
        route="/roles"
        filters={[
          {
            key: "policies",
            label: t("정책 연결 필터"),
            options: [
              { value: "linked", label: t("연결됨") },
              { value: "empty", label: t("미연결") },
            ],
            matches: (r, v) => r.policyCount > 0 === (v === "linked"),
          },
        ]}
        columns={[
          {
            key: "userCount",
            header: t("사용자"),
            sortable: true,
            render: (r) =>
              link(`/roles/${r.id}?tab=users`, t(`${r.userCount}명`)),
          },
          {
            key: "organizationCount",
            header: t("조직"),
            sortable: true,
            render: (r) =>
              link(
                `/roles/${r.id}?tab=organizations`,
                t(`${r.organizationCount}개`),
              ),
          },
          {
            key: "policyCount",
            header: t("정책"),
            sortable: true,
            render: (r) =>
              link(`/roles/${r.id}?tab=policies`, t(`${r.policyCount}개`)),
          },
        ]}
      />
    </>
  );
}
export function PoliciesList({ rows }: { rows: PolicyRow[] }) {
  const { t } = useI18n();
  return (
    <>
      <PageHeading
        title={t("정책")}
        description={t(
          "정책에 연결된 서비스·엔드포인트·워크스페이스를 조회합니다.",
        )}
      />
      <DemoNotice />
      <Summary
        items={[
          { label: t("전체 정책"), value: rows.length },
          {
            label: t("리소스 연결 정책"),
            value: rows.filter(
              (r) => r.serviceCount + r.endpointCount + r.workspaceCount > 0,
            ).length,
          },
        ]}
      />
      <Policies rows={rows} />
    </>
  );
}
function Frame({
  kind,
  item,
  children,
}: {
  kind: "roles" | "policies";
  item: Named;
  children: ReactNode;
}) {
  const { t } = useI18n();
  return (
    <>
      <Breadcrumbs
        items={[
          { label: kind === "roles" ? t("역할") : t("정책"), href: `/${kind}` },
          { label: item.name },
        ]}
      />
      <PageHeading title={item.name} description={item.description} />
      <DemoNotice />
      {children}
    </>
  );
}
function Info({ item, label }: { item: Named; label: string }) {
  const { t } = useI18n();
  return (
    <section className="ui-panel">
      <h2>
        {t(label)} {t("정보")}
      </h2>
      <Details
        items={[
          { label: `${label} ID`, value: item.id },
          { label: t("이름"), value: item.name },
          { label: t("설명"), value: item.description },
        ]}
      />
    </section>
  );
}
export function RoleScreen({ data }: { data: RoleDetail }) {
  const { t } = useI18n();
  const { role, users, organizations, policies } = data;
  return (
    <Frame kind="roles" item={role}>
      <p className="identity-role-note">
        {t(
          "직접 연결된 사용자와 조직입니다. 조직 소속에 따른 역할 상속은 포함하지 않습니다.",
        )}
      </p>
      <DetailTabs
        items={[
          {
            value: "info",
            label: t("기본 정보"),
            content: <Info item={role} label={t("역할")} />,
          },
          {
            value: "users",
            label: t(`사용자 (${users.length})`),
            content: (
              <BrowseTable
                title={t("연결 사용자 목록")}
                rows={users}
                searchText={(r) =>
                  `${r.id} ${r.name} ${r.email} ${r.employeeNumber}`
                }
                sortValue={(r) => r.name}
                columns={[
                  {
                    key: "name",
                    header: t("이름"),
                    sortable: true,
                    render: (r) => link(`/users/${r.id}`, r.name),
                  },
                  { key: "email", header: t("이메일"), render: (r) => r.email },
                  {
                    key: "status",
                    header: t("상태"),
                    render: (r) => <StatusBadge status={r.status} />,
                  },
                ]}
              />
            ),
          },
          {
            value: "organizations",
            label: t(`조직 (${organizations.length})`),
            content: (
              <ResourceTable
                title={t("연결 조직 목록")}
                rows={organizations}
                route="/organizations"
                columns={[
                  {
                    key: "code",
                    header: t("조직 코드"),
                    render: (r) => r.code,
                  },
                  {
                    key: "status",
                    header: t("상태"),
                    render: (r) => <StatusBadge status={r.status} />,
                  },
                ]}
              />
            ),
          },
          {
            value: "policies",
            label: t(`정책 (${policies.length})`),
            content: <Policies rows={policies} />,
          },
        ]}
      />
    </Frame>
  );
}
export function PolicyScreen({ data }: { data: PolicyDetail }) {
  const { t } = useI18n();
  const { policy, services, endpoints, workspaces } = data;
  return (
    <Frame kind="policies" item={policy}>
      <p className="identity-role-note">
        {t(
          "정책에 연결된 리소스입니다. 서비스 연결이 모든 엔드포인트에 대한 권한을 의미하지는 않습니다.",
        )}
      </p>
      <DetailTabs
        items={[
          {
            value: "info",
            label: t("기본 정보"),
            content: <Info item={policy} label={t("정책")} />,
          },
          {
            value: "services",
            label: t(`서비스 (${services.length})`),
            content: (
              <ResourceTable
                title={t("서비스 목록")}
                route="/services"
                rows={services}
                columns={[
                  {
                    key: "status",
                    header: t("상태"),
                    render: (r) => <StatusBadge status={r.status} />,
                  },
                ]}
              />
            ),
          },
          {
            value: "endpoints",
            label: t(`엔드포인트 (${endpoints.length})`),
            content: (
              <BrowseTable
                title={t("서비스 엔드포인트 목록")}
                rows={endpoints}
                searchText={(r) =>
                  `${r.id} ${r.name} ${r.path} ${r.method} ${r.serviceName}`
                }
                sortValue={(r, k) => (k === "path" ? r.path : r.name)}
                filters={[
                  {
                    key: "method",
                    label: t("HTTP 메서드 필터"),
                    options: [
                      { value: "GET", label: "GET" },
                      { value: "POST", label: "POST" },
                    ],
                    matches: (r, v) => r.method === v,
                  },
                ]}
                columns={[
                  {
                    key: "name",
                    header: t("이름"),
                    sortable: true,
                    render: (r) => (
                      <>
                        {link(`/service-endpoints/${r.id}`, r.name)}
                        <div className="identity-meta">{r.id}</div>
                      </>
                    ),
                  },
                  {
                    key: "service",
                    header: t("서비스"),
                    render: (r) =>
                      link(`/services/${r.serviceId}`, r.serviceName),
                  },
                  {
                    key: "method",
                    header: t("메서드"),
                    render: (r) => r.method,
                  },
                  {
                    key: "path",
                    header: t("경로"),
                    sortable: true,
                    render: (r) => <code>{r.path}</code>,
                  },
                ]}
              />
            ),
          },
          {
            value: "workspaces",
            label: t(`워크스페이스 (${workspaces.length})`),
            content: (
              <ResourceTable
                title={t("워크스페이스 목록")}
                rows={workspaces}
                route="/workspaces"
              />
            ),
          },
        ]}
      />
    </Frame>
  );
}
