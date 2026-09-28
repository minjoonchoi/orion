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
        description: "요청과 결재 결과를 확인합니다.",
      },
    ],
  },
  {
    id: "identity",
    label: "전사 조직·계정",
    items: [
      {
        href: "/organizations",
        label: "조직",
        description: "전사 조직과 구성원을 관리합니다.",
      },
      {
        href: "/users",
        label: "사용자",
        description: "사용자와 조직 소속을 조회합니다.",
      },
      {
        href: "/service-accounts",
        label: "서비스 어카운트",
        description: "서버 통신 주체를 관리합니다.",
      },
      {
        href: "/api-keys",
        label: "API 키",
        description: "API 키와 발급 이력을 확인합니다.",
      },
    ],
  },
  {
    id: "platform-access",
    label: "플랫폼·접근 관리",
    items: [
      {
        href: "/platforms",
        label: "플랫폼",
        description: "플랫폼 멤버와 화면 소속을 관리합니다.",
      },
      {
        href: "/roles",
        label: "역할",
        description: "역할별 정책 부여를 관리합니다.",
      },
      {
        href: "/policies",
        label: "정책",
        description: "역할과 서비스 어카운트의 실행 권한을 확인합니다.",
      },
    ],
  },
  {
    id: "product",
    label: "제품·화면 정의",
    items: [
      {
        href: "/domains",
        label: "업무 도메인",
        description: "Action과 조회 범위를 탐색합니다.",
      },
      {
        href: "/workspaces",
        label: "워크스페이스",
        description: "플랫폼별 페이지와 사용 Action을 확인합니다.",
      },
    ],
  },
  {
    id: "api-privacy",
    label: "API·정보 보호",
    items: [
      {
        href: "/services",
        label: "서비스",
        description: "관리 조직별 API 명세를 확인합니다.",
      },
      {
        href: "/masking-rules",
        label: "마스킹 규칙",
        description: "공통 민감정보 처리 규칙을 관리합니다.",
      },
    ],
  },
  {
    id: "operations",
    label: "설정·운영",
    items: [
      {
        href: "/access-check",
        label: "접근 확인",
        description:
          "운영자가 사용자·서비스 어카운트의 실행 권한을 진단합니다.",
      },
      {
        href: "/resources",
        label: "변경 관리",
        description: "GitOps 변경 검토와 적용 결과를 확인합니다.",
      },
    ],
  },
] as const;
export const navigation = navigationGroups.flatMap((group) => [...group.items]);
export function isNavigationActive(pathname: string, href: string) {
  const children: Record<string, string[]> = {
    "/workspaces": ["/pages"],
    "/services": ["/service-endpoints"],
    "/domains": ["/actions", "/scopes"],
    "/approvals": ["/approval-templates"],
    "/resources": ["/definition-sync", "/definition-contract"],
  };
  return [href, ...(children[href] ?? [])].some(
    (p) => pathname === p || pathname.startsWith(p + "/"),
  );
}
