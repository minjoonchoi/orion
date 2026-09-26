"use client";
import { DateValue, useI18n } from "@/i18n/provider";
import Link from "next/link";
import { PageHeading } from "@/components/ui/page-heading";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Badge, type Tone } from "@/components/ui/badge";
import { BrowseTable } from "../identity/browse-table";
import { DetailTabs } from "../identity/detail-tabs";
import { DemoNotice, Details, Summary } from "../identity/shared";
import type {
  KeyStatus,
  ApprovalStatus,
  RequestType,
  KeyRow,
  KeyDetail,
  ApprovalRow,
  Person,
} from "./types";
const keyStates: Record<KeyStatus, { label: string; tone: Tone }> = {
  active: { label: "활성", tone: "success" },
  expired: { label: "만료", tone: "warning" },
  revoked: { label: "폐기", tone: "neutral" },
};
const approvalStates: Record<ApprovalStatus, { label: string; tone: Tone }> = {
  pending: { label: "결재 대기", tone: "warning" },
  approved: { label: "승인", tone: "success" },
  rejected: { label: "반려", tone: "danger" },
};
const requestTypes: Record<RequestType, string> = {
  issue: "발급",
  renew: "갱신",
  revoke: "폐기",
};
const options = (states: Record<string, { label: string }>) =>
  Object.entries(states).map(([value, s]) => ({ value, label: s.label }));
function State({ state }: { state: { label: string; tone: Tone } }) {
  return <Badge tone={state.tone}>{state.label}</Badge>;
}
function timestamp(value: string | null, empty = "기록 없음") {
  return <DateValue value={value} time empty={empty} />;
}
const personLink = (person: Person) => (
  <Link className="identity-link" href={`/users/${person.id}`}>
    {person.name}
  </Link>
);
const orgLink = (org: Person) => (
  <Link className="identity-link" href={`/organizations/${org.id}`}>
    {org.name}
  </Link>
);
export function ApiKeysList({ rows }: { rows: KeyRow[] }) {
  const { t } = useI18n();
  const organizations = Array.from(
    new Map(rows.map((r) => [r.organization.id, r.organization])).values(),
  );
  return (
    <>
      <PageHeading
        title={t("API 키")}
        description={t("API 키의 상태와 소유 정보, 결재 이력을 조회합니다.")}
      />
      <DemoNotice />
      <p className="identity-role-note">
        {t("키 원문은 저장하거나 표시하지 않습니다.")}
      </p>
      <Summary
        items={[
          { label: t("전체 API 키"), value: rows.length },
          {
            label: t("활성"),
            value: rows.filter((r) => r.status === "active").length,
          },
          {
            label: t("만료"),
            value: rows.filter((r) => r.status === "expired").length,
          },
          {
            label: t("폐기"),
            value: rows.filter((r) => r.status === "revoked").length,
          },
        ]}
      />
      <BrowseTable
        title={t("API 키 목록")}
        rows={rows}
        searchText={(r) =>
          `${r.name} ${r.id} ${r.displayHint} ${r.description} ${r.owner.name} ${r.organization.name}`
        }
        sortValue={(r, k) =>
          k === "createdAt"
            ? r.createdAt
            : k === "expiresAt"
              ? (r.expiresAt ?? "9999")
              : r.name
        }
        filters={[
          {
            key: "status",
            label: t("키 상태 필터"),
            options: options(keyStates),
            matches: (r, v) => r.status === v,
          },
          {
            key: "organization",
            label: t("소속 조직 필터"),
            options: organizations.map((o) => ({ value: o.id, label: o.name })),
            matches: (r, v) => r.organizationId === v,
          },
        ]}
        columns={[
          {
            key: "name",
            header: t("이름"),
            sortable: true,
            render: (r) => (
              <>
                <Link className="identity-link" href={`/api-keys/${r.id}`}>
                  {r.name}
                </Link>
                <div className="identity-meta">
                  {r.id} · {r.displayHint}
                </div>
              </>
            ),
          },
          {
            key: "status",
            header: t("키 상태"),
            render: (r) => <State state={keyStates[r.status]} />,
          },
          {
            key: "organization",
            header: t("소속 조직"),
            render: (r) => orgLink(r.organization),
          },
          {
            key: "owner",
            header: t("소유자"),
            render: (r) => personLink(r.owner),
          },
          {
            key: "createdAt",
            header: t("발급일"),
            sortable: true,
            render: (r) => timestamp(r.createdAt),
          },
          {
            key: "expiresAt",
            header: t("만료일"),
            sortable: true,
            render: (r) => timestamp(r.expiresAt, t("만료일 없음")),
          },
        ]}
      />
    </>
  );
}
function Approvals({ rows }: { rows: ApprovalRow[] }) {
  const { t } = useI18n();
  return (
    <>
      <p className="identity-role-note">
        {t(
          "요청일 최신순으로 표시합니다. 결재 결과와 키의 현재 상태는 별도 정보입니다. 시각은 배포 설정의 시간대로 표시합니다.",
        )}
      </p>
      <BrowseTable
        title={t("결재 이력 목록")}
        rows={rows}
        searchText={(r) =>
          `${r.id} ${r.requester.name} ${r.reviewer?.name ?? ""} ${r.reason} ${r.comment ?? ""}`
        }
        sortValue={(r, k) =>
          k === "decidedAt" ? (r.decidedAt ?? "9999") : r.requestedAt
        }
        filters={[
          {
            key: "status",
            label: t("결재 상태 필터"),
            options: options(approvalStates),
            matches: (r, v) => r.status === v,
          },
          {
            key: "type",
            label: t("요청 유형 필터"),
            options: Object.entries(requestTypes).map(([value, label]) => ({
              value,
              label,
            })),
            matches: (r, v) => r.type === v,
          },
        ]}
        emptyTitle={t("결재 이력이 없습니다")}
        columns={[
          {
            key: "requestedAt",
            header: t("요청일"),
            sortable: true,
            render: (r) => (
              <>
                {timestamp(r.requestedAt)}
                <div className="identity-meta">
                  <Link className="identity-link" href={`/approvals/${r.id}`}>
                    {r.id}
                  </Link>
                </div>
              </>
            ),
          },
          {
            key: "type",
            header: t("요청 유형"),
            render: (r) => t(requestTypes[r.type]),
          },
          {
            key: "status",
            header: t("결재 상태"),
            render: (r) => <State state={approvalStates[r.status]} />,
          },
          {
            key: "requester",
            header: t("요청자"),
            render: (r) => personLink(r.requester),
          },
          { key: "reason", header: t("요청 사유"), render: (r) => r.reason },
          {
            key: "reviewer",
            header: t("결재자"),
            render: (r) => (r.reviewer ? personLink(r.reviewer) : t("미지정")),
          },
          {
            key: "decidedAt",
            header: t("처리일"),
            sortable: true,
            render: (r) => timestamp(r.decidedAt, t("미처리")),
          },
          {
            key: "comment",
            header: t("결재 의견"),
            render: (r) => r.comment ?? t("등록된 의견 없음"),
          },
        ]}
      />
    </>
  );
}
export function ApiKeyScreen({ data }: { data: KeyDetail }) {
  const { t } = useI18n();
  const { key: k, approvals } = data;
  return (
    <>
      <Breadcrumbs
        items={[{ label: t("API 키"), href: "/api-keys" }, { label: k.name }]}
      />
      <PageHeading title={k.name} description={k.description} />
      <DemoNotice />
      <p className="identity-role-note">
        {t("키 식별 표시는 원문이 아닌 구분용 정보입니다.")}
      </p>
      <DetailTabs
        items={[
          {
            value: "info",
            label: t("기본 정보"),
            content: (
              <section className="ui-panel">
                <h2>{t("API 키 정보")}</h2>
                <Details
                  items={[
                    { label: t("API 키 ID"), value: k.id },
                    { label: t("이름"), value: k.name },
                    { label: t("설명"), value: k.description },
                    {
                      label: t("키 식별 표시"),
                      value: <code>{k.displayHint}</code>,
                    },
                    {
                      label: t("키 상태"),
                      value: <State state={keyStates[k.status]} />,
                    },
                    { label: t("소속 조직"), value: orgLink(k.organization) },
                    { label: t("소유자"), value: personLink(k.owner) },
                    {
                      label: t("발급일"),
                      value: timestamp(k.createdAt),
                    },
                    {
                      label: t("만료일"),
                      value: timestamp(k.expiresAt, t("만료일 없음")),
                    },
                    {
                      label: t("최근 사용일"),
                      value: timestamp(k.lastUsedAt),
                    },
                    {
                      label: t("폐기일"),
                      value: timestamp(k.revokedAt, t("해당 없음")),
                    },
                  ]}
                />
              </section>
            ),
          },
          {
            value: "approvals",
            label: t(`결재 이력 (${approvals.length})`),
            content: <Approvals rows={approvals} />,
          },
        ]}
      />
    </>
  );
}
