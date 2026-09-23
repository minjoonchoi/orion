"use client";
import Link from "next/link";
import { PageHeading } from "@/components/ui/page-heading";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Badge, type Tone } from "@/components/ui/badge";
import { BrowseTable, statusOptions } from "../identity/browse-table";
import { DetailTabs } from "../identity/detail-tabs";
import {
  DemoNotice,
  Details,
  Summary,
  StatusBadge,
  date,
} from "../identity/shared";
import type { AccountRow, AccountDetail } from "./repository";
import type { KeyStatus } from "../api-keys/types";
const link = (route: string, id: string, name: string) => (
  <Link className="identity-link" href={`${route}/${id}`}>
    {name}
  </Link>
);
const keyStates: Record<KeyStatus, { label: string; tone: Tone }> = {
  active: { label: "활성", tone: "success" },
  expired: { label: "만료", tone: "warning" },
  revoked: { label: "폐기", tone: "neutral" },
};
export function ServiceAccountsList({ rows }: { rows: AccountRow[] }) {
  const organizations = Array.from(
    new Map(rows.map((a) => [a.organization.id, a.organization])).values(),
  );
  return (
    <>
      <PageHeading
        title="서비스 어카운트"
        description="자동화 작업과 서비스 연동에 사용하는 계정의 조직·역할·API 키를 조회합니다."
      />
      <DemoNotice />
      <Summary
        items={[
          { label: "전체 서비스 어카운트", value: rows.length },
          {
            label: "활성",
            value: rows.filter((a) => a.status === "active").length,
          },
          {
            label: "비활성",
            value: rows.filter((a) => a.status === "inactive").length,
          },
        ]}
      />
      <BrowseTable
        title="서비스 어카운트 목록"
        rows={rows}
        searchText={(r) =>
          `${r.id} ${r.name} ${r.description} ${r.organization.name}`
        }
        sortValue={(r, k) =>
          k === "roleCount"
            ? r.roleCount
            : k === "keyCount"
              ? r.keyCount
              : k === "createdAt"
                ? r.createdAt
                : r.name
        }
        filters={[
          {
            key: "status",
            label: "상태 필터",
            options: statusOptions,
            matches: (r, v) => r.status === v,
          },
          {
            key: "organization",
            label: "소속 조직 필터",
            options: organizations.map((o) => ({ value: o.id, label: o.name })),
            matches: (r, v) => r.organization.id === v,
          },
        ]}
        columns={[
          {
            key: "name",
            header: "이름",
            sortable: true,
            render: (r) => (
              <>
                {link("/service-accounts", r.id, r.name)}
                <div className="identity-meta">{r.id}</div>
              </>
            ),
          },
          { key: "description", header: "설명", render: (r) => r.description },
          {
            key: "organization",
            header: "소속 조직",
            render: (r) =>
              link("/organizations", r.organization.id, r.organization.name),
          },
          {
            key: "status",
            header: "상태",
            render: (r) => <StatusBadge status={r.status} />,
          },
          {
            key: "roleCount",
            header: "역할",
            sortable: true,
            render: (r) =>
              link(
                "/service-accounts",
                `${r.id}?tab=roles`,
                `${r.roleCount}개`,
              ),
          },
          {
            key: "keyCount",
            header: "API 키",
            sortable: true,
            render: (r) =>
              link(
                "/service-accounts",
                `${r.id}?tab=api-keys`,
                `${r.keyCount}개`,
              ),
          },
          {
            key: "createdAt",
            header: "등록일",
            sortable: true,
            render: (r) => date(r.createdAt),
          },
        ]}
      />
    </>
  );
}
export function ServiceAccountScreen({ data }: { data: AccountDetail }) {
  const { account: a, roles, keys } = data;
  return (
    <>
      <Breadcrumbs
        items={[
          { label: "서비스 어카운트", href: "/service-accounts" },
          { label: a.name },
        ]}
      />
      <PageHeading title={a.name} description={a.description} />
      <DemoNotice />
      <DetailTabs
        items={[
          {
            value: "info",
            label: "기본 정보",
            content: (
              <section className="ui-panel">
                <h2>서비스 어카운트 정보</h2>
                <Details
                  items={[
                    { label: "서비스 어카운트 ID", value: a.id },
                    { label: "이름", value: a.name },
                    { label: "설명", value: a.description },
                    { label: "상태", value: <StatusBadge status={a.status} /> },
                    {
                      label: "소속 조직",
                      value: link(
                        "/organizations",
                        a.organization.id,
                        a.organization.name,
                      ),
                    },
                    { label: "등록일 (한국 시간)", value: date(a.createdAt) },
                    {
                      label: "최근 사용일 (한국 시간)",
                      value: date(a.lastUsedAt),
                    },
                  ]}
                />
              </section>
            ),
          },
          {
            value: "roles",
            label: `역할 (${roles.length})`,
            content: (
              <>
                <p className="identity-role-note">
                  직접 연결된 역할입니다. 소속 조직의 역할 상속이나 유효 권한을
                  의미하지 않습니다.
                </p>
                <BrowseTable
                  title="연결 역할 목록"
                  rows={roles}
                  searchText={(r) => `${r.id} ${r.name} ${r.description}`}
                  sortValue={(r) => r.name}
                  columns={[
                    {
                      key: "name",
                      header: "이름",
                      sortable: true,
                      render: (r) => link("/roles", r.id, r.name),
                    },
                    { key: "id", header: "역할 ID", render: (r) => r.id },
                    {
                      key: "description",
                      header: "설명",
                      render: (r) => r.description,
                    },
                  ]}
                />
              </>
            ),
          },
          {
            value: "api-keys",
            label: `API 키 (${keys.length})`,
            content: (
              <>
                <p className="identity-role-note">
                  연결된 API 키의 메타데이터입니다. 키 원문은 표시하지 않습니다.
                </p>
                <BrowseTable
                  title="연결 API 키 목록"
                  rows={keys}
                  searchText={(r) =>
                    `${r.id} ${r.name} ${r.displayHint} ${r.description}`
                  }
                  sortValue={(r, k) =>
                    k === "expiresAt" ? (r.expiresAt ?? "9999") : r.name
                  }
                  filters={[
                    {
                      key: "status",
                      label: "키 상태 필터",
                      options: Object.entries(keyStates).map(([value, s]) => ({
                        value,
                        label: s.label,
                      })),
                      matches: (r, v) => r.status === v,
                    },
                  ]}
                  columns={[
                    {
                      key: "name",
                      header: "이름",
                      sortable: true,
                      render: (r) => (
                        <>
                          {link("/api-keys", r.id, r.name)}
                          <div className="identity-meta">{r.id}</div>
                        </>
                      ),
                    },
                    {
                      key: "hint",
                      header: "키 식별 표시",
                      render: (r) => <code>{r.displayHint}</code>,
                    },
                    {
                      key: "status",
                      header: "키 상태",
                      render: (r) => (
                        <Badge tone={keyStates[r.status].tone}>
                          {keyStates[r.status].label}
                        </Badge>
                      ),
                    },
                    {
                      key: "expiresAt",
                      header: "만료일 (한국 시간)",
                      sortable: true,
                      render: (r) =>
                        r.expiresAt ? date(r.expiresAt) : "만료일 없음",
                    },
                  ]}
                />
              </>
            ),
          },
        ]}
      />
    </>
  );
}
