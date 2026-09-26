"use client";
import { useI18n } from "@/i18n/provider";
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
  const { t } = useI18n();
  const organizations = Array.from(
    new Map(rows.map((a) => [a.organization.id, a.organization])).values(),
  );
  return (
    <>
      <PageHeading
        title={t("서비스 어카운트")}
        description={t(
          "자동화 작업과 서비스 연동에 사용하는 계정의 조직·역할·API 키를 조회합니다.",
        )}
      />
      <DemoNotice />
      <Summary
        items={[
          { label: t("전체 서비스 어카운트"), value: rows.length },
          {
            label: t("활성"),
            value: rows.filter((a) => a.status === "active").length,
          },
          {
            label: t("비활성"),
            value: rows.filter((a) => a.status === "inactive").length,
          },
        ]}
      />
      <BrowseTable
        title={t("서비스 어카운트 목록")}
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
            label: t("상태 필터"),
            options: statusOptions,
            matches: (r, v) => r.status === v,
          },
          {
            key: "organization",
            label: t("소속 조직 필터"),
            options: organizations.map((o) => ({ value: o.id, label: o.name })),
            matches: (r, v) => r.organization.id === v,
          },
        ]}
        columns={[
          {
            key: "name",
            header: t("이름"),
            sortable: true,
            render: (r) => (
              <>
                {link("/service-accounts", r.id, r.name)}
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
            key: "organization",
            header: t("소속 조직"),
            render: (r) =>
              link("/organizations", r.organization.id, r.organization.name),
          },
          {
            key: "status",
            header: t("상태"),
            render: (r) => <StatusBadge status={r.status} />,
          },
          {
            key: "roleCount",
            header: t("역할"),
            sortable: true,
            render: (r) =>
              link(
                "/service-accounts",
                `${r.id}?tab=roles`,
                t(`${r.roleCount}개`),
              ),
          },
          {
            key: "keyCount",
            header: t("API 키"),
            sortable: true,
            render: (r) =>
              link(
                "/service-accounts",
                `${r.id}?tab=api-keys`,
                t(`${r.keyCount}개`),
              ),
          },
          {
            key: "createdAt",
            header: t("등록일"),
            sortable: true,
            render: (r) => date(r.createdAt),
          },
        ]}
      />
    </>
  );
}
export function ServiceAccountScreen({ data }: { data: AccountDetail }) {
  const { t } = useI18n();
  const { account: a, roles, keys } = data;
  return (
    <>
      <Breadcrumbs
        items={[
          { label: t("서비스 어카운트"), href: "/service-accounts" },
          { label: a.name },
        ]}
      />
      <PageHeading title={a.name} description={a.description} />
      <DemoNotice />
      <DetailTabs
        items={[
          {
            value: "info",
            label: t("기본 정보"),
            content: (
              <section className="ui-panel">
                <h2>{t("서비스 어카운트 정보")}</h2>
                <Details
                  items={[
                    { label: t("서비스 어카운트 ID"), value: a.id },
                    { label: t("이름"), value: a.name },
                    { label: t("설명"), value: a.description },
                    {
                      label: t("상태"),
                      value: <StatusBadge status={a.status} />,
                    },
                    {
                      label: t("소속 조직"),
                      value: link(
                        "/organizations",
                        a.organization.id,
                        a.organization.name,
                      ),
                    },
                    { label: t("등록일"), value: date(a.createdAt) },
                    {
                      label: t("최근 사용일"),
                      value: date(a.lastUsedAt),
                    },
                  ]}
                />
              </section>
            ),
          },
          {
            value: "roles",
            label: t(`역할 (${roles.length})`),
            content: (
              <>
                <p className="identity-role-note">
                  {t(
                    "직접 연결된 역할입니다. 소속 조직의 역할 상속이나 유효 권한을 의미하지 않습니다.",
                  )}
                </p>
                <BrowseTable
                  title={t("연결 역할 목록")}
                  rows={roles}
                  searchText={(r) => `${r.id} ${r.name} ${r.description}`}
                  sortValue={(r) => r.name}
                  columns={[
                    {
                      key: "name",
                      header: t("이름"),
                      sortable: true,
                      render: (r) => link("/roles", r.id, r.name),
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
            ),
          },
          {
            value: "api-keys",
            label: t(`API 키 (${keys.length})`),
            content: (
              <>
                <p className="identity-role-note">
                  {t(
                    "연결된 API 키의 메타데이터입니다. 키 원문은 표시하지 않습니다.",
                  )}
                </p>
                <BrowseTable
                  title={t("연결 API 키 목록")}
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
                      label: t("키 상태 필터"),
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
                      header: t("이름"),
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
                      header: t("키 식별 표시"),
                      render: (r) => <code>{r.displayHint}</code>,
                    },
                    {
                      key: "status",
                      header: t("키 상태"),
                      render: (r) => (
                        <Badge tone={keyStates[r.status].tone}>
                          {keyStates[r.status].label}
                        </Badge>
                      ),
                    },
                    {
                      key: "expiresAt",
                      header: t("만료일"),
                      sortable: true,
                      render: (r) =>
                        r.expiresAt ? date(r.expiresAt) : t("만료일 없음"),
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
