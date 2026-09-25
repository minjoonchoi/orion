export const navigation = [
  { href: "/", label: "개요", description: "권한 관리 플랫폼의 시작점입니다." },
  {
    href: "/users",
    label: "사용자",
    description: "접근 권한을 부여받는 사용자를 관리합니다.",
  },
  {
    href: "/roles",
    label: "역할",
    description: "업무에 필요한 권한을 역할로 묶어 관리합니다.",
  },
  {
    href: "/resources",
    label: "서버 리소스",
    description: "접근 제어 대상 서버와 리소스를 관리합니다.",
  },
  {
    href: "/access-grants",
    label: "접근 권한",
    description: "사용자와 역할에 부여된 리소스 접근 권한을 관리합니다.",
  },
  {
    href: "/audit-logs",
    label: "감사 로그",
    description: "권한 변경과 접근 이력을 확인합니다.",
  },
] as const;
