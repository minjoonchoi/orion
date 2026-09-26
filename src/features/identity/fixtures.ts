import type {
  User,
  Organization,
  Role,
  ManagedService,
  ServiceAccount,
  Membership,
} from "./types";
// Synthetic read-only fixture data. These are not Okta accounts or production records.
export const users: User[] = [
  "김가람",
  "김다온",
  "김하늘",
  "박나래",
  "박서준",
  "서도윤",
  "윤지안",
  "이가온",
  "이서연",
  "정다솜",
  "최도현",
  "한지우",
  "강민서",
  "송유진",
].map((name, i) => ({
  id: `usr-${String(i + 1).padStart(3, "0")}`,
  name,
  email: `member${i + 1}@example.test`,
  status: i === 4 || i === 11 ? "on_leave" : "employed",
}));
export const organizations: Organization[] = [
  {
    id: "org-platform",
    name: "플랫폼개발팀",
    code: "PLATFORM",
    description: "사내 공통 플랫폼과 인증 서비스를 개발합니다.",
    status: "active",
    createdAt: "2026-06-01T00:00:00Z",
  },
  {
    id: "org-security",
    name: "정보보안팀",
    code: "SECURITY",
    description: "접근 정책과 보안 운영을 담당합니다.",
    status: "active",
    createdAt: "2026-06-01T00:00:00Z",
  },
  {
    id: "org-product",
    name: "프로덕트팀",
    code: "PRODUCT",
    description: "제품 기획과 사용자 경험을 관리합니다.",
    status: "active",
    createdAt: "2026-06-15T00:00:00Z",
  },
  {
    id: "org-operations",
    name: "서비스운영팀",
    code: "OPERATIONS",
    description: "사내 업무 서비스의 운영을 담당합니다.",
    status: "active",
    createdAt: "2026-07-01T00:00:00Z",
  },
  {
    id: "org-finance",
    name: "재무팀",
    code: "FINANCE",
    description: "정산과 재무 업무를 관리합니다.",
    status: "active",
    createdAt: "2026-07-15T00:00:00Z",
  },
  {
    id: "org-archive",
    name: "프로젝트 아카이브",
    code: "ARCHIVE",
    description: "종료된 프로젝트를 보관하는 예제 조직입니다.",
    status: "inactive",
    createdAt: "2026-08-01T00:00:00Z",
  },
];
export const roles: Role[] = [
  {
    id: "role-platform",
    name: "플랫폼 관리자",
    description: "플랫폼 운영에 필요한 관리 역할입니다.",
  },
  {
    id: "role-viewer",
    name: "업무 조회자",
    description: "업무 정보를 조회하는 역할입니다.",
  },
  {
    id: "role-security",
    name: "보안 검토자",
    description: "접근 정책과 권한 요청을 검토하는 역할입니다.",
  },
  {
    id: "role-operator",
    name: "서비스 운영자",
    description: "서비스 운영 업무를 수행하는 역할입니다.",
  },
];
export const services: ManagedService[] = [
  {
    id: "svc-orion",
    name: "Orion",
    description: "통합 인증·인가 플랫폼",
    status: "active",
  },
  {
    id: "svc-directory",
    name: "사내 디렉터리",
    description: "구성원과 조직 정보 제공",
    status: "active",
  },
  {
    id: "svc-approval",
    name: "전자결재",
    description: "업무 승인과 결재 이력 관리",
    status: "active",
  },
  {
    id: "svc-settlement",
    name: "정산 관리",
    description: "정산 데이터 조회 및 처리",
    status: "inactive",
  },
];
export const memberships: Membership[] = [
  ...users.slice(0, 7).map((user) => ({
    userId: user.id,
    organizationId: "org-platform",
    joinedAt: "2026-07-01T00:00:00Z",
  })),
  ...users.slice(5, 9).map((user) => ({
    userId: user.id,
    organizationId: "org-security",
    joinedAt: "2026-08-01T00:00:00Z",
  })),
  ...users.slice(8, 11).map((user) => ({
    userId: user.id,
    organizationId: "org-product",
    joinedAt: "2026-08-10T00:00:00Z",
  })),
  {
    userId: "usr-001",
    organizationId: "org-security",
    joinedAt: "2026-08-01T00:00:00Z",
  },
  {
    userId: "usr-012",
    organizationId: "org-operations",
    joinedAt: "2026-08-10T00:00:00Z",
  },
  {
    userId: "usr-013",
    organizationId: "org-finance",
    joinedAt: "2026-08-20T00:00:00Z",
  },
];
export const userRoles: Record<string, string[]> = {
  "usr-001": ["role-platform", "role-viewer"],
  "usr-002": ["role-viewer"],
  "usr-003": ["role-viewer"],
  "usr-006": ["role-security"],
  "usr-007": ["role-security", "role-viewer"],
  "usr-012": ["role-operator"],
};
export const organizationRoles: Record<string, string[]> = {
  "org-platform": ["role-platform", "role-viewer"],
  "org-security": ["role-security"],
  "org-product": ["role-viewer"],
  "org-operations": ["role-operator"],
  "org-finance": ["role-viewer"],
};
export const organizationServices: Record<string, string[]> = {
  "org-platform": ["svc-orion", "svc-directory"],
  "org-security": ["svc-orion"],
  "org-operations": ["svc-approval"],
  "org-finance": ["svc-settlement"],
  "org-product": ["svc-orion"],
};
export const serviceAccounts: (ServiceAccount & { organizationId: string })[] =
  [
    {
      id: "sa-finance-report",
      name: "finance-report",
      description: "정산 리포트 연동",
      status: "active",
      organizationId: "org-finance",
      createdAt: "2026-07-15T00:00:00Z",
      lastUsedAt: null,
    },
    {
      id: "sa-product-metrics",
      name: "product-metrics",
      description: "제품 지표 연동",
      status: "active",
      organizationId: "org-product",
      createdAt: "2026-09-01T00:00:00Z",
      lastUsedAt: null,
    },
    {
      id: "sa-directory-sync",
      name: "directory-sync",
      description: "구성원 동기화 작업용",
      status: "active",
      organizationId: "org-platform",
      createdAt: "2026-07-05T00:00:00Z",
      lastUsedAt: "2026-09-23T02:00:00Z",
    },
    {
      id: "sa-platform-ci",
      name: "platform-ci",
      description: "배포 파이프라인 조회용",
      status: "active",
      organizationId: "org-platform",
      createdAt: "2026-08-01T00:00:00Z",
      lastUsedAt: "2026-09-22T03:00:00Z",
    },
    {
      id: "sa-audit-export",
      name: "audit-export",
      description: "감사 자료 추출용",
      status: "inactive",
      organizationId: "org-security",
      createdAt: "2026-08-01T00:00:00Z",
      lastUsedAt: null,
    },
    {
      id: "sa-approval-bot",
      name: "approval-bot",
      description: "결재 알림 작업용",
      status: "active",
      organizationId: "org-operations",
      createdAt: "2026-08-01T00:00:00Z",
      lastUsedAt: "2026-09-23T00:00:00Z",
    },
  ];

// Explicit synthetic organization hierarchy and leaders; null denotes no assignment.
export const organizationLeaders: Record<string, string> = {
  "org-platform": "usr-001",
  "org-security": "usr-006",
  "org-product": "usr-009",
  "org-operations": "usr-012",
  "org-finance": "usr-013",
};
export const organizationParents: Record<string, string> = {
  "org-security": "org-platform",
  "org-product": "org-platform",
  "org-operations": "org-platform",
  "org-archive": "org-product",
};
