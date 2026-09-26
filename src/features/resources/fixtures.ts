import type { Endpoint, Workspace, ResourcePage } from "./types";
// Synthetic resource catalog shared with policy previews.
export const endpoints: Endpoint[] = [
  {
    id: "ep-users",
    name: "사용자 목록 조회",
    serviceId: "svc-directory",
    method: "GET",
    path: "/api/users",
  },
  {
    id: "ep-orgs",
    name: "조직 목록 조회",
    serviceId: "svc-directory",
    method: "GET",
    path: "/api/organizations",
  },
  {
    id: "ep-roles",
    name: "역할 목록 조회",
    serviceId: "svc-orion",
    method: "GET",
    path: "/api/roles",
  },
  {
    id: "ep-policies",
    name: "정책 목록 조회",
    serviceId: "svc-orion",
    method: "GET",
    path: "/api/policies",
  },
  {
    id: "ep-approvals",
    name: "결재 목록 조회",
    serviceId: "svc-approval",
    method: "GET",
    path: "/api/approvals",
  },
  {
    id: "ep-approval-submit",
    name: "결재 요청",
    serviceId: "svc-approval",
    method: "POST",
    path: "/api/approvals",
  },
];
export const workspaces: Workspace[] = [
  {
    id: "ws-platform",
    name: "플랫폼 운영",
    description: "플랫폼 관리 화면 모음",
  },
  {
    id: "ws-directory",
    name: "구성원 디렉터리",
    description: "구성원과 조직 조회 화면",
  },
  {
    id: "ws-approval",
    name: "결재 업무",
    description: "결재 요청과 이력 화면",
  },
];
export const pages: ResourcePage[] = [
  {
    id: "page-users",
    name: "사용자 관리",
    description: "사용자 정보 조회",
    workspaceId: "ws-platform",
    path: "/users",
  },
  {
    id: "page-organizations",
    name: "조직 관리",
    description: "조직과 멤버 조회",
    workspaceId: "ws-platform",
    path: "/organizations",
  },
  {
    id: "page-roles",
    name: "역할 관리",
    description: "역할과 관계 정보 조회",
    workspaceId: "ws-platform",
    path: "/roles",
  },
  {
    id: "page-policies",
    name: "정책 관리",
    description: "정책 리소스 조회",
    workspaceId: "ws-platform",
    path: "/policies",
  },
  {
    id: "page-services",
    name: "서비스 관리",
    description: "서비스 리소스 조회",
    workspaceId: "ws-platform",
    path: "/services",
  },
  {
    id: "page-workspaces",
    name: "워크스페이스 관리",
    description: "워크스페이스 조회",
    workspaceId: "ws-platform",
    path: "/workspaces",
  },
  {
    id: "page-directory",
    name: "구성원 검색",
    description: "사내 구성원 디렉터리",
    workspaceId: "ws-directory",
    path: "/directory",
  },
  {
    id: "page-approvals",
    name: "결재 목록",
    description: "업무 결재 조회",
    workspaceId: "ws-approval",
    path: "/approvals",
  },
];
workspaces.push({
  id: "ws-empty",
  name: "준비 중 워크스페이스",
  description: "페이지가 없는 예제 워크스페이스",
});
