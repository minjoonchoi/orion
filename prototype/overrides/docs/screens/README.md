# 현재 정책 계약

독립 정책·직접 부여의 현행 계약은 [독립 정책과 부여](19-independent-policies.md)를 따른다. 기존 ID/API의 호환 동작과 운영 미완료 범위를 함께 구분한다.

# Orion 메뉴별 화면 기획서

현재 제품은 6개 그룹·15개 메뉴를 제공한다. 조직은 전사 공통, 서비스는 관리 조직 소속, 도메인은 플랫폼과 독립된 제품 요건, workspace/page는 플랫폼 소속이다.

| 그룹             | 메뉴                                     | 기준 문서                                                                                                               |
| ---------------- | ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| 내 업무          | 내 접근 권한 · 결재                      | [접근 관리](17-access-management.md), [결재](13-approvals.md)                                                           |
| 전사 조직·계정   | 조직 · 사용자 · 서비스 어카운트 · API 키 | [조직](03-organizations.md), [사용자](02-users.md), [서비스 어카운트](04-service-accounts.md), [API 키](11-api-keys.md) |
| 플랫폼·접근 관리 | 플랫폼 · 역할 · 정책                     | [플랫폼](01-platforms.md), [역할](05-roles.md)                                                                          |
| 제품·화면 정의   | 업무 도메인 · 워크스페이스               | [도메인](08-domains.md), [워크스페이스](06-workspaces.md)                                                               |
| API·정보 보호    | 서비스 · 마스킹 규칙                     | [서비스](07-services.md), [새 YAML UI](18-yaml-gitops-contract.md)                                                      |
| 설정·운영        | 접근 확인 · 변경 관리                    | [접근 관리](17-access-management.md), [변경 관리](10-changes.md)                                                        |

Action·scope는 도메인 하위 정의이며 정책은 독립 정의다. 도메인 상세 첫 탭은 Action이며 정책 부여 여부와 관계없이 탐색한다. 엔드포인트는 서비스 하위, page는 workspace 하위다. 하위 정의마다 독립 상세 URL을 제공하지만 LSB 메뉴를 늘리지 않는다. 정책 메뉴에서 역할/서비스 어카운트 대상과 직접/페이지 실행 권한을 조회한다. 기존 ID의 상세 경로는 호환을 위해 유지한다.

## 구현 상태

신규 YAML UI와 모델은 `src/features/definition-contract/`, 기존 API 계약 UI는 `src/features/definitions/`에 있다. 신규 정의는 기존 목록의 YAML 정의 구역에서 함께 탐색한다. 신규 상세는 모델 식별자에 맞춰 열린다. 기존 ID/API/결재 정책 경로는 보존하며 자동 이관하지 않는다.

신규 화면의 메모리 Sync는 페이지 이동 시 유지되며 새로고침 시 초기화된다. 운영 Git 수집·DB 저장·Gateway 배포·권한 부여 통합은 별도 서버 구현이다. API 모드에서는 미연동 신규 데이터를 예제로 대체하여 표시하지 않는다. 현재 신규 화면의 API 연동 상태를 명시하며 기존 API 화면은 유지한다.

[새 YAML 계약](../definition-management.md), [UI 요구](18-yaml-gitops-contract.md), [공통 규칙](00-common.md), [미완료](15-gaps-and-decisions.md)를 기준으로 함께 관리한다. 스펙은 현행 요구, 검증 이력은 docs/reviews, 이전 계약은 docs/archive로 구분한다.
