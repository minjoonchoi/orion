"use client";
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
  return value
    ? new Intl.DateTimeFormat("ko-KR", {
        timeZone: "Asia/Seoul",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      }).format(new Date(value))
    : empty;
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
  const organizations = Array.from(
    new Map(rows.map((r) => [r.organization.id, r.organization])).values(),
  );
  return (
    <>
      <PageHeading
        title="API 키"
        description="API 키의 상태와 소유 정보, 결재 이력을 조회합니다."
      />
      <DemoNotice />
      <p className="identity-role-note">
        2026년 9월 23일 기준 예제입니다. 키 원문은 저장하거나 표시하지 않습니다.
      </p>
      <Summary
        items={[
          { label: "전체 API 키", value: rows.length },
          {
            label: "활성",
            value: rows.filter((r) => r.status === "active").length,
          },
          {
            label: "만료",
            value: rows.filter((r) => r.status === "expired").length,
          },
          {
            label: "폐기",
            value: rows.filter((r) => r.status === "revoked").length,
          },
        ]}
      />
      <BrowseTable
        title="API 키 목록"
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
            label: "키 상태 필터",
            options: options(keyStates),
            matches: (r, v) => r.status === v,
          },
          {
            key: "organization",
            label: "소속 조직 필터",
            options: organizations.map((o) => ({ value: o.id, label: o.name })),
            matches: (r, v) => r.organizationId === v,
          },
        ]}
        columns={[
          {
            key: "name",
            header: "이름",
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
            header: "키 상태",
            render: (r) => <State state={keyStates[r.status]} />,
          },
          {
            key: "organization",
            header: "소속 조직",
            render: (r) => orgLink(r.organization),
          },
          {
            key: "owner",
            header: "소유자",
            render: (r) => personLink(r.owner),
          },
          {
            key: "createdAt",
            header: "발급일 (한국 시간)",
            sortable: true,
            render: (r) => timestamp(r.createdAt),
          },
          {
            key: "expiresAt",
            header: "만료일 (한국 시간)",
            sortable: true,
            render: (r) => timestamp(r.expiresAt, "만료일 없음"),
          },
        ]}
      />
    </>
  );
}
function Approvals({ rows }: { rows: ApprovalRow[] }) {
  return (
    <>
      <p className="identity-role-note">
        요청일 최신순으로 표시합니다. 결재 결과와 키의 현재 상태는 별도
        정보입니다. 모든 시각은 한국 시간입니다.
      </p>
      <BrowseTable
        title="결재 이력 목록"
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
            label: "결재 상태 필터",
            options: options(approvalStates),
            matches: (r, v) => r.status === v,
          },
          {
            key: "type",
            label: "요청 유형 필터",
            options: Object.entries(requestTypes).map(([value, label]) => ({
              value,
              label,
            })),
            matches: (r, v) => r.type === v,
          },
        ]}
        emptyTitle="결재 이력이 없습니다"
        columns={[
          {
            key: "requestedAt",
            header: "요청일",
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
            header: "요청 유형",
            render: (r) => requestTypes[r.type],
          },
          {
            key: "status",
            header: "결재 상태",
            render: (r) => <State state={approvalStates[r.status]} />,
          },
          {
            key: "requester",
            header: "요청자",
            render: (r) => personLink(r.requester),
          },
          { key: "reason", header: "요청 사유", render: (r) => r.reason },
          {
            key: "reviewer",
            header: "결재자",
            render: (r) => (r.reviewer ? personLink(r.reviewer) : "미지정"),
          },
          {
            key: "decidedAt",
            header: "처리일",
            sortable: true,
            render: (r) => timestamp(r.decidedAt, "미처리"),
          },
          {
            key: "comment",
            header: "결재 의견",
            render: (r) => r.comment ?? "등록된 의견 없음",
          },
        ]}
      />
    </>
  );
}
export function ApiKeyScreen({ data }: { data: KeyDetail }) {
  const { key: k, approvals } = data;
  return (
    <>
      <Breadcrumbs
        items={[{ label: "API 키", href: "/api-keys" }, { label: k.name }]}
      />
      <PageHeading title={k.name} description={k.description} />
      <DemoNotice />
      <p className="identity-role-note">
        2026년 9월 23일 기준 예제입니다. 키 식별 표시는 원문이 아닌 구분용
        정보입니다.
      </p>
      <DetailTabs
        items={[
          {
            value: "info",
            label: "기본 정보",
            content: (
              <section className="ui-panel">
                <h2>API 키 정보</h2>
                <Details
                  items={[
                    { label: "API 키 ID", value: k.id },
                    { label: "이름", value: k.name },
                    { label: "설명", value: k.description },
                    {
                      label: "키 식별 표시",
                      value: <code>{k.displayHint}</code>,
                    },
                    {
                      label: "키 상태",
                      value: <State state={keyStates[k.status]} />,
                    },
                    { label: "소속 조직", value: orgLink(k.organization) },
                    { label: "소유자", value: personLink(k.owner) },
                    {
                      label: "발급일 (한국 시간)",
                      value: timestamp(k.createdAt),
                    },
                    {
                      label: "만료일 (한국 시간)",
                      value: timestamp(k.expiresAt, "만료일 없음"),
                    },
                    {
                      label: "최근 사용일 (한국 시간)",
                      value: timestamp(k.lastUsedAt),
                    },
                    {
                      label: "폐기일 (한국 시간)",
                      value: timestamp(k.revokedAt, "해당 없음"),
                    },
                  ]}
                />
              </section>
            ),
          },
          {
            value: "approvals",
            label: `결재 이력 (${approvals.length})`,
            content: <Approvals rows={approvals} />,
          },
        ]}
      />
    </>
  );
}
