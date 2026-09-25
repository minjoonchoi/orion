"use client";
import Link from "next/link";
import type { ReactNode } from "react";
import { PageHeading } from "@/components/ui/page-heading";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { BrowseTable, statusOptions } from "../identity/browse-table";
import { DetailTabs } from "../identity/detail-tabs";
import { DemoNotice, Details, StatusBadge, Summary } from "../identity/shared";
import type {
  ServiceRow,
  EndpointRow,
  WorkspaceRow,
  PageRow,
  ServiceDetail,
  WorkspaceDetail,
} from "./types";
const link = (route: string, id: string, name: string) => (
  <Link className="identity-link" href={`${route}/${id}`}>
    {name}
  </Link>
);
const identity = (route: string, r: { id: string; name: string }) => (
  <>
    {link(route, r.id, r.name)}
    <div className="identity-meta">{r.id}</div>
  </>
);
function ListFrame({
  title,
  description,
  count,
  children,
}: {
  title: string;
  description: string;
  count: number;
  children: ReactNode;
}) {
  return (
    <>
      <PageHeading title={title} description={description} />
      <DemoNotice />
      <Summary items={[{ label: `전체 ${title}`, value: count }]} />
      {children}
    </>
  );
}
function DetailFrame({
  title,
  route,
  item,
  children,
}: {
  title: string;
  route: string;
  item: { name: string; description?: string };
  children: ReactNode;
}) {
  return (
    <>
      <Breadcrumbs
        items={[{ label: title, href: route }, { label: item.name }]}
      />
      <PageHeading
        title={item.name}
        description={item.description ?? `${title} 상세 정보를 조회합니다.`}
      />
      <DemoNotice />
      {children}
    </>
  );
}
export function ServicesList({ rows }: { rows: ServiceRow[] }) {
  return (
    <ListFrame
      title="서비스"
      description="접근 제어 대상 서비스와 소속 엔드포인트를 조회합니다."
      count={rows.length}
    >
      <BrowseTable
        title="서비스 목록"
        rows={rows}
        searchText={(r) => `${r.name} ${r.id} ${r.description}`}
        sortValue={(r, k) => (k === "endpointCount" ? r.endpointCount : r.name)}
        filters={[
          {
            key: "status",
            label: "상태 필터",
            options: statusOptions,
            matches: (r, v) => r.status === v,
          },
        ]}
        columns={[
          {
            key: "name",
            header: "이름",
            sortable: true,
            render: (r) => identity("/services", r),
          },
          { key: "description", header: "설명", render: (r) => r.description },
          {
            key: "status",
            header: "상태",
            render: (r) => <StatusBadge status={r.status} />,
          },
          {
            key: "endpointCount",
            header: "엔드포인트",
            sortable: true,
            render: (r) => `${r.endpointCount}개`,
          },
        ]}
      />
    </ListFrame>
  );
}
export function EndpointsTable({
  rows,
  services,
}: {
  rows: EndpointRow[];
  services?: { id: string; name: string }[];
}) {
  return (
    <BrowseTable
      title="서비스 엔드포인트 목록"
      rows={rows}
      searchText={(r) =>
        `${r.name} ${r.id} ${r.path} ${r.method} ${r.serviceName}`
      }
      sortValue={(r, k) => (k === "path" ? r.path : r.name)}
      filters={[
        {
          key: "method",
          label: "HTTP 메서드 필터",
          options: [
            { value: "GET", label: "GET" },
            { value: "POST", label: "POST" },
          ],
          matches: (r, v) => r.method === v,
        },
        ...(services
          ? [
              {
                key: "service",
                label: "서비스 필터",
                options: services.map((s) => ({ value: s.id, label: s.name })),
                matches: (r: EndpointRow, v: string) => r.serviceId === v,
              },
            ]
          : []),
      ]}
      columns={[
        {
          key: "name",
          header: "이름",
          sortable: true,
          render: (r) => identity("/service-endpoints", r),
        },
        {
          key: "service",
          header: "서비스",
          render: (r) => link("/services", r.serviceId, r.serviceName),
        },
        { key: "method", header: "메서드", render: (r) => r.method },
        {
          key: "path",
          header: "경로",
          sortable: true,
          render: (r) => <code>{r.path}</code>,
        },
      ]}
    />
  );
}
export function EndpointsList({
  rows,
  services,
}: {
  rows: EndpointRow[];
  services: ServiceRow[];
}) {
  return (
    <ListFrame
      title="서비스 엔드포인트"
      description="서비스별 API 메서드와 경로를 조회합니다."
      count={rows.length}
    >
      <EndpointsTable rows={rows} services={services} />
    </ListFrame>
  );
}
export function WorkspacesList({ rows }: { rows: WorkspaceRow[] }) {
  return (
    <ListFrame
      title="워크스페이스"
      description="화면 접근 제어 대상 워크스페이스와 소속 페이지를 조회합니다."
      count={rows.length}
    >
      <BrowseTable
        title="워크스페이스 목록"
        rows={rows}
        searchText={(r) => `${r.name} ${r.id} ${r.description}`}
        sortValue={(r, k) => (k === "pageCount" ? r.pageCount : r.name)}
        filters={[
          {
            key: "pages",
            label: "페이지 연결 필터",
            options: [
              { value: "linked", label: "연결됨" },
              { value: "empty", label: "미연결" },
            ],
            matches: (r, v) => r.pageCount > 0 === (v === "linked"),
          },
        ]}
        columns={[
          {
            key: "name",
            header: "이름",
            sortable: true,
            render: (r) => identity("/workspaces", r),
          },
          { key: "description", header: "설명", render: (r) => r.description },
          {
            key: "pageCount",
            header: "페이지",
            sortable: true,
            render: (r) => `${r.pageCount}개`,
          },
        ]}
      />
    </ListFrame>
  );
}
export function PagesTable({
  rows,
  workspaces,
}: {
  rows: PageRow[];
  workspaces?: { id: string; name: string }[];
}) {
  return (
    <BrowseTable
      title="페이지 목록"
      rows={rows}
      searchText={(r) =>
        `${r.name} ${r.id} ${r.path} ${r.description} ${r.workspaceName}`
      }
      sortValue={(r, k) => (k === "path" ? r.path : r.name)}
      filters={
        workspaces
          ? [
              {
                key: "workspace",
                label: "워크스페이스 필터",
                options: workspaces.map((w) => ({
                  value: w.id,
                  label: w.name,
                })),
                matches: (r, v) => r.workspaceId === v,
              },
            ]
          : []
      }
      columns={[
        {
          key: "name",
          header: "이름",
          sortable: true,
          render: (r) => identity("/pages", r),
        },
        {
          key: "workspace",
          header: "워크스페이스",
          render: (r) => link("/workspaces", r.workspaceId, r.workspaceName),
        },
        {
          key: "path",
          header: "경로",
          sortable: true,
          render: (r) => <code>{r.path}</code>,
        },
        { key: "description", header: "설명", render: (r) => r.description },
      ]}
    />
  );
}
export function PagesList({
  rows,
  workspaces,
}: {
  rows: PageRow[];
  workspaces: WorkspaceRow[];
}) {
  return (
    <ListFrame
      title="페이지"
      description="워크스페이스별 화면 경로와 페이지 정보를 조회합니다."
      count={rows.length}
    >
      <PagesTable rows={rows} workspaces={workspaces} />
    </ListFrame>
  );
}
export function ServiceScreen({ data }: { data: ServiceDetail }) {
  const { service: s, endpoints } = data;
  return (
    <DetailFrame title="서비스" route="/services" item={s}>
      <DetailTabs
        items={[
          {
            value: "info",
            label: "기본 정보",
            content: (
              <section className="ui-panel">
                <h2>서비스 정보</h2>
                <Details
                  items={[
                    { label: "서비스 ID", value: s.id },
                    { label: "이름", value: s.name },
                    { label: "설명", value: s.description },
                    { label: "상태", value: <StatusBadge status={s.status} /> },
                    { label: "엔드포인트 수", value: s.endpointCount },
                  ]}
                />
              </section>
            ),
          },
          {
            value: "endpoints",
            label: `엔드포인트 (${endpoints.length})`,
            content: <EndpointsTable rows={endpoints} />,
          },
        ]}
      />
    </DetailFrame>
  );
}
export function EndpointScreen({ data: e }: { data: EndpointRow }) {
  return (
    <DetailFrame title="서비스 엔드포인트" route="/service-endpoints" item={e}>
      <section className="ui-panel">
        <h2>엔드포인트 정보</h2>
        <Details
          items={[
            { label: "엔드포인트 ID", value: e.id },
            { label: "이름", value: e.name },
            {
              label: "소속 서비스",
              value: link("/services", e.serviceId, e.serviceName),
            },
            { label: "HTTP 메서드", value: e.method },
            { label: "API 경로", value: <code>{e.path}</code> },
          ]}
        />
      </section>
    </DetailFrame>
  );
}
export function WorkspaceScreen({ data }: { data: WorkspaceDetail }) {
  const { workspace: w, pages } = data;
  return (
    <DetailFrame title="워크스페이스" route="/workspaces" item={w}>
      <DetailTabs
        items={[
          {
            value: "info",
            label: "기본 정보",
            content: (
              <section className="ui-panel">
                <h2>워크스페이스 정보</h2>
                <Details
                  items={[
                    { label: "워크스페이스 ID", value: w.id },
                    { label: "이름", value: w.name },
                    { label: "설명", value: w.description },
                    { label: "페이지 수", value: w.pageCount },
                  ]}
                />
              </section>
            ),
          },
          {
            value: "pages",
            label: `페이지 (${pages.length})`,
            content: <PagesTable rows={pages} />,
          },
        ]}
      />
    </DetailFrame>
  );
}
export function PageScreen({ data: p }: { data: PageRow }) {
  return (
    <DetailFrame title="페이지" route="/pages" item={p}>
      <section className="ui-panel">
        <h2>페이지 정보</h2>
        <Details
          items={[
            { label: "페이지 ID", value: p.id },
            { label: "이름", value: p.name },
            { label: "설명", value: p.description },
            {
              label: "소속 워크스페이스",
              value: link("/workspaces", p.workspaceId, p.workspaceName),
            },
            { label: "화면 경로", value: <code>{p.path}</code> },
          ]}
        />
      </section>
    </DetailFrame>
  );
}
