export const navigationGroups = [
  {
    id: "my-access",
    label: "내 업무",
    items: [
      {
        href: "/my-access",
        label: "내 접근 권한",
        description: "보유 권한과 권한 신청을 확인합니다.",
      },
      {
        href: "/approvals",
        label: "결재",
        description: "결재 요청 정보와 처리 결과를 조회합니다.",
      },
    ],
  },
  {
    id: "identity",
    label: "플랫폼·계정",
    items: [
      {
        href: "/platforms",
        label: "플랫폼",
        description: "플랫폼별 인증과 멤버·역할을 관리합니다.",
      },
      {
        href: "/users",
        label: "사용자",
        description: "전역 사용자 카탈로그와 플랫폼 멤버십을 조회합니다.",
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
        description: "서비스 어카운트 정보와 관련된 역할·API 키를 조회합니다.",
      },
      {
        href: "/api-keys",
        label: "API 키",
        description: "API 키 정보와 결재 이력을 조회합니다.",
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
        description: "역할에 관련된 사용자, 조직과 정책을 조회합니다.",
      },
      {
        href: "/policies",
        label: "정책",
        description:
          "정책에 대상 서비스, 엔드포인트와 워크스페이스를 조회합니다.",
      },
      {
        href: "/access-check",
        label: "접근 확인",
        description: "사용자와 업무의 접근 가능 여부를 확인합니다.",
      },
    ],
  },
  {
    id: "resources",
    label: "리소스 관리",
    items: [
      {
        href: "/workspaces",
        label: "워크스페이스",
        description: "워크스페이스와 소속 페이지를 탐색합니다.",
      },
      {
        href: "/services",
        label: "서비스",
        description: "서비스와 소속 엔드포인트를 탐색합니다.",
      },
      {
        href: "/domains",
        label: "업무 도메인",
        description: "도메인별 Action과 관계 엔드포인트를 탐색합니다.",
      },
    ],
  },
  {
    id: "operations",
    label: "설정 운영",
    items: [
      {
        href: "/resources",
        label: "변경 관리",
        description: "정책과 리소스의 변경사항을 검토하고 적용합니다.",
      },
    ],
  },
] as const;

export const navigation = navigationGroups.flatMap((group) => [...group.items]);

export function isNavigationActive(pathname: string, href: string) {
  const child: Record<string, string> = {
    "/workspaces": "/pages",
    "/services": "/service-endpoints",
    "/domains": "/actions",
    "/approvals": "/approval-templates",
  };
  return (
    pathname === href ||
    pathname.startsWith(`${href}/`) ||
    Boolean(
      child[href] &&
      (pathname === child[href] || pathname.startsWith(child[href] + "/")),
    )
  );
}
