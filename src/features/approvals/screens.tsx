"use client";
import Link from "next/link";
import { PageHeading } from "@/components/ui/page-heading";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Badge, type Tone } from "@/components/ui/badge";
import { BrowseTable } from "../identity/browse-table";
import { DemoNotice, Details, Summary } from "../identity/shared";
import type {
  ApprovalTemplate,
  ApprovalRecord,
  ApprovalStatus,
  RequestType,
} from "./types";
const types: Record<RequestType, string> = {
  issue: "발급",
  renew: "갱신",
  revoke: "폐기",
};
const states: Record<ApprovalStatus, { label: string; tone: Tone }> = {
  pending: { label: "결재 대기", tone: "warning" },
  approved: { label: "승인", tone: "success" },
  rejected: { label: "반려", tone: "danger" },
};
const typeOptions = Object.entries(types).map(([value, label]) => ({
  value,
  label,
}));
const link = (route: string, id: string, label: string) => (
  <Link className="identity-link" href={`${route}/${id}`}>
    {label}
  </Link>
);
function timestamp(value: string | null) {
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
    : "미처리";
}
function TemplateStatus({ status }: { status: ApprovalTemplate["status"] }) {
  return (
    <Badge tone={status === "active" ? "success" : "neutral"}>
      {status === "active" ? "사용 중" : "사용 중지"}
    </Badge>
  );
}
function ApprovalBadge({ status }: { status: ApprovalStatus }) {
  return <Badge tone={states[status].tone}>{states[status].label}</Badge>;
}
export function TemplatesList({ rows }: { rows: ApprovalTemplate[] }) {
  return (
    <>
      <PageHeading
        title="결재 템플릿"
        description="요청 유형별 결재 템플릿의 기본 정보와 작성 안내를 조회합니다."
      />
      <DemoNotice />
      <Summary
        items={[
          { label: "전체 템플릿", value: rows.length },
          {
            label: "사용 중",
            value: rows.filter((t) => t.status === "active").length,
          },
        ]}
      />
      <BrowseTable
        title="결재 템플릿 목록"
        rows={rows}
        searchText={(r) =>
          `${r.id} ${r.name} ${r.description} ${r.instructions}`
        }
        sortValue={(r, k) => (k === "updatedAt" ? r.updatedAt : r.name)}
        filters={[
          {
            key: "status",
            label: "템플릿 상태 필터",
            options: [
              { value: "active", label: "사용 중" },
              { value: "inactive", label: "사용 중지" },
            ],
            matches: (r, v) => r.status === v,
          },
          {
            key: "type",
            label: "요청 유형 필터",
            options: typeOptions,
            matches: (r, v) => r.type === v,
          },
        ]}
        columns={[
          {
            key: "name",
            header: "이름",
            sortable: true,
            render: (r) => (
              <>
                {link("/approval-templates", r.id, r.name)}
                <div className="identity-meta">{r.id}</div>
              </>
            ),
          },
          { key: "description", header: "설명", render: (r) => r.description },
          { key: "type", header: "요청 유형", render: (r) => types[r.type] },
          { key: "version", header: "버전", render: (r) => `v${r.version}` },
          {
            key: "status",
            header: "상태",
            render: (r) => <TemplateStatus status={r.status} />,
          },
          {
            key: "updatedAt",
            header: "수정일 (한국 시간)",
            sortable: true,
            render: (r) => timestamp(r.updatedAt),
          },
        ]}
      />
    </>
  );
}
export function TemplateScreen({ data: t }: { data: ApprovalTemplate }) {
  return (
    <>
      <Breadcrumbs
        items={[
          { label: "결재 템플릿", href: "/approval-templates" },
          { label: t.name },
        ]}
      />
      <PageHeading title={t.name} description={t.description} />
      <DemoNotice />
      <section className="ui-panel">
        <h2>결재 템플릿 정보</h2>
        <Details
          items={[
            { label: "템플릿 ID", value: t.id },
            { label: "이름", value: t.name },
            { label: "설명", value: t.description },
            { label: "요청 유형", value: types[t.type] },
            { label: "버전", value: `v${t.version}` },
            { label: "상태", value: <TemplateStatus status={t.status} /> },
            { label: "작성 안내", value: t.instructions },
            { label: "등록일 (한국 시간)", value: timestamp(t.createdAt) },
            { label: "수정일 (한국 시간)", value: timestamp(t.updatedAt) },
          ]}
        />
      </section>
    </>
  );
}
export function ApprovalsList({ rows }: { rows: ApprovalRecord[] }) {
  const templates = Array.from(
    new Map(
      rows.map((r) => [
        r.templateId,
        { id: r.templateId, name: r.templateName },
      ]),
    ).values(),
  );
  return (
    <>
      <PageHeading
        title="결재"
        description="결재 요청의 상세 정보와 처리 결과를 조회합니다."
      />
      <DemoNotice />
      <Summary
        items={[
          { label: "전체 결재", value: rows.length },
          {
            label: "결재 대기",
            value: rows.filter((r) => r.status === "pending").length,
          },
          {
            label: "승인",
            value: rows.filter((r) => r.status === "approved").length,
          },
          {
            label: "반려",
            value: rows.filter((r) => r.status === "rejected").length,
          },
        ]}
      />
      <BrowseTable
        title="결재 목록"
        rows={rows}
        searchText={(r) =>
          `${r.id} ${r.title} ${r.reason} ${r.comment ?? ""} ${r.requester.name} ${r.reviewer?.name ?? ""}`
        }
        sortValue={(r, k) => (k === "title" ? r.title : r.requestedAt)}
        filters={[
          {
            key: "status",
            label: "결재 상태 필터",
            options: Object.entries(states).map(([value, s]) => ({
              value,
              label: s.label,
            })),
            matches: (r, v) => r.status === v,
          },
          {
            key: "type",
            label: "요청 유형 필터",
            options: typeOptions,
            matches: (r, v) => r.type === v,
          },
          {
            key: "template",
            label: "결재 템플릿 필터",
            options: templates.map((t) => ({ value: t.id, label: t.name })),
            matches: (r, v) => r.templateId === v,
          },
        ]}
        columns={[
          {
            key: "title",
            header: "결재 요청",
            sortable: true,
            render: (r) => (
              <>
                {link("/approvals", r.id, r.title)}
                <div className="identity-meta">{r.id}</div>
              </>
            ),
          },
          {
            key: "status",
            header: "결재 상태",
            render: (r) => <ApprovalBadge status={r.status} />,
          },
          { key: "type", header: "요청 유형", render: (r) => types[r.type] },
          {
            key: "requester",
            header: "요청자",
            render: (r) => link("/users", r.requester.id, r.requester.name),
          },
          {
            key: "reviewer",
            header: "결재자",
            render: (r) =>
              r.reviewer
                ? link("/users", r.reviewer.id, r.reviewer.name)
                : "미지정",
          },
          {
            key: "requestedAt",
            header: "요청일 (한국 시간)",
            sortable: true,
            render: (r) => timestamp(r.requestedAt),
          },
        ]}
      />
    </>
  );
}
export function ApprovalScreen({ data: a }: { data: ApprovalRecord }) {
  return (
    <>
      <Breadcrumbs
        items={[{ label: "결재", href: "/approvals" }, { label: a.id }]}
      />
      <PageHeading
        title={a.title}
        description="결재 요청 정보와 처리 결과를 확인합니다."
      />
      <DemoNotice />
      <section className="ui-panel">
        <h2>결재 정보</h2>
        <Details
          items={[
            { label: "결재 ID", value: a.id },
            { label: "요청 유형", value: types[a.type] },
            { label: "결재 상태", value: <ApprovalBadge status={a.status} /> },
            {
              label: "결재 템플릿",
              value: link(
                "/approval-templates",
                a.templateId,
                `${a.templateName} · v${a.templateVersion}`,
              ),
            },
            {
              label: "대상 API 키",
              value: link("/api-keys", a.keyId, a.keyName),
            },
            {
              label: "요청자",
              value: link("/users", a.requester.id, a.requester.name),
            },
            {
              label: "결재자",
              value: a.reviewer
                ? link("/users", a.reviewer.id, a.reviewer.name)
                : "미지정",
            },
            { label: "요청일 (한국 시간)", value: timestamp(a.requestedAt) },
            { label: "처리일 (한국 시간)", value: timestamp(a.decidedAt) },
            { label: "요청 사유", value: a.reason },
            { label: "결재 의견", value: a.comment ?? "등록된 의견 없음" },
          ]}
        />
      </section>
    </>
  );
}
