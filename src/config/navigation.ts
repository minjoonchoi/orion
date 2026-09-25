export const navigationGroups = [
  {
    id: "identity",
    label: "사용자·조직",
    items: [
      {
        href: "/users",
        label: "사용자",
        description: "사용자 정보, 소속 조직과 역할을 조회합니다.",
      },
      {
        href: "/organizations",
        label: "조직",
        description:
          "조직 멤버, 서비스 어카운트, 관리 서비스와 역할을 조회합니다.",
      },
      {
        href: "/service-accounts",
        label: "서비스 어카운트",
        description: "서비스 어카운트 정보와 연결된 역할·API 키를 조회합니다.",
      },
    ],
  },
  {
    id: "authorization",
    label: "권한 관리",
    items: [
      {
        href: "/roles",
        label: "역할",
        description: "역할에 연결된 사용자, 조직과 정책을 조회합니다.",
      },
    ],
  },
  {
    id: "resources",
    label: "리소스",
    items: [
      {
        href: "/workspaces",
        label: "워크스페이스",
        description: "워크스페이스와 소속 페이지를 탐색합니다.",
      },
      {
        href: "/pages",
        label: "페이지",
        description: "페이지 경로와 소속 워크스페이스를 탐색합니다.",
      },
      {
        href: "/services",
        label: "서비스",
        description: "서비스와 소속 엔드포인트를 탐색합니다.",
      },
      {
        href: "/service-endpoints",
        label: "엔드포인트",
        description: "HTTP 메서드와 경로로 엔드포인트를 탐색합니다.",
      },
      {
        href: "/policies",
        label: "정책",
        description:
          "정책에 연결된 서비스, 엔드포인트와 워크스페이스를 조회합니다.",
      },
      {
        href: "/resources",
        label: "변경 관리",
        description: "정책과 리소스의 변경사항을 검토하고 적용합니다.",
      },
    ],
  },
  {
    id: "api-access",
    label: "API 접근",
    items: [
      {
        href: "/api-keys",
        label: "API 키",
        description: "API 키 정보와 결재 이력을 조회합니다.",
      },
    ],
  },
  {
    id: "approvals",
    label: "결재",
    items: [
      {
        href: "/approval-templates",
        label: "결재 템플릿",
        description: "결재 템플릿의 기본 정보와 요청 안내를 조회합니다.",
      },
      {
        href: "/approvals",
        label: "결재",
        description: "결재 요청 정보와 처리 결과를 조회합니다.",
      },
    ],
  },
] as const;

export const navigation = navigationGroups.flatMap((group) => [...group.items]);

export function isNavigationActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}
