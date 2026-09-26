# 경로 전수 목록과 인수 검수

## 경로 대응표

기준 master의 모든 page.tsx 경로와 P18 신규 `/approvals/new`를 대조했다. `[id]`는 실제 라우트 파일 표기이며 기획서의 `{workspaceId}~{pageId}` 등은 그 안에 들어갈 복합 식별자다. 같은 URL의 일반/결재 관리 정책·역할은 변형 화면으로 구분한다.

| URL                                  | 화면 ID              | 기획서                                               |
| ------------------------------------ | -------------------- | ---------------------------------------------------- |
| `/`                                  | COM-02               | [00-common.md](00-common.md)                         |
| `/access-grants`                     | COM-09 (placeholder) | [00-common.md](00-common.md)                         |
| `/actions`                           | ACT-01               | [08-domains.md](08-domains.md)                       |
| `/actions/[id]`                      | ACT-02               | [08-domains.md](08-domains.md)                       |
| `/api-keys`                          | KEY-01               | [11-api-keys.md](11-api-keys.md)                     |
| `/api-keys/[id]`                     | KEY-02               | [11-api-keys.md](11-api-keys.md)                     |
| `/approval-templates`                | TPL-01               | [12-approval-templates.md](12-approval-templates.md) |
| `/approval-templates/[id]`           | TPL-02               | [12-approval-templates.md](12-approval-templates.md) |
| `/approvals`                         | APR-01               | [13-approvals.md](13-approvals.md)                   |
| `/approvals/[id]`                    | APR-03               | [13-approvals.md](13-approvals.md)                   |
| `/approvals/new`                     | APR-02 (P18)         | [13-approvals.md](13-approvals.md)                   |
| `/audit-logs`                        | COM-09 (placeholder) | [00-common.md](00-common.md)                         |
| `/components`                        | COM-09 (개발용)      | [00-common.md](00-common.md)                         |
| `/domains`                           | DOM-01               | [08-domains.md](08-domains.md)                       |
| `/domains/[id]`                      | DOM-02               | [08-domains.md](08-domains.md)                       |
| `/forbidden`                         | COM-03               | [00-common.md](00-common.md)                         |
| `/login`                             | COM-01               | [00-common.md](00-common.md)                         |
| `/organizations`                     | ORG-01               | [03-organizations.md](03-organizations.md)           |
| `/organizations/[id]`                | ORG-02               | [03-organizations.md](03-organizations.md)           |
| `/pages`                             | PAG-01               | [06-workspaces.md](06-workspaces.md)                 |
| `/pages/[id]`                        | PAG-02               | [06-workspaces.md](06-workspaces.md)                 |
| `/platforms`                         | PLT-01               | [01-platforms.md](01-platforms.md)                   |
| `/platforms/[id]`                    | PLT-02               | [01-platforms.md](01-platforms.md)                   |
| `/platforms/[id]/members/[memberId]` | PLT-03               | [01-platforms.md](01-platforms.md)                   |
| `/policies`                          | POL-01               | [09-policies.md](09-policies.md)                     |
| `/policies/[id]`                     | POL-02 / POL-04      | [09-policies.md](09-policies.md)                     |
| `/policies/sync`                     | CHG-05 (이동)        | [10-changes.md](10-changes.md)                       |
| `/policy-sync`                       | CHG-05 (이동)        | [10-changes.md](10-changes.md)                       |
| `/resource-sync`                     | CHG-05 (이동)        | [10-changes.md](10-changes.md)                       |
| `/resource-sync/history`             | CHG-05 (이동)        | [10-changes.md](10-changes.md)                       |
| `/resources`                         | CHG-01               | [10-changes.md](10-changes.md)                       |
| `/roles`                             | ROL-01               | [05-roles.md](05-roles.md)                           |
| `/roles/[id]`                        | ROL-02 / ROL-06      | [05-roles.md](05-roles.md)                           |
| `/service-accounts`                  | SAC-01               | [04-service-accounts.md](04-service-accounts.md)     |
| `/service-accounts/[id]`             | SAC-02               | [04-service-accounts.md](04-service-accounts.md)     |
| `/service-endpoints`                 | END-01               | [07-services.md](07-services.md)                     |
| `/service-endpoints/[id]`            | END-02               | [07-services.md](07-services.md)                     |
| `/services`                          | SVC-01               | [07-services.md](07-services.md)                     |
| `/services/[id]`                     | SVC-02               | [07-services.md](07-services.md)                     |
| `/users`                             | USR-01               | [02-users.md](02-users.md)                           |
| `/users/[id]`                        | USR-02               | [02-users.md](02-users.md)                           |
| `/workspaces`                        | WSP-01               | [06-workspaces.md](06-workspaces.md)                 |
| `/workspaces/[id]`                   | WSP-02               | [06-workspaces.md](06-workspaces.md)                 |

## URL 없이 열리는 모달·탭 업무

| 화면 ID         | 진입                    | 검수 포인트                                          |
| --------------- | ----------------------- | ---------------------------------------------------- |
| PLT-04          | 플랫폼 멤버 탭          | 사용자 선택→검토, 기존 멤버 제외, 역할 불변          |
| ROL-03          | 역할 사용자 탭          | 사용자 추가/해제, 플랫폼 문맥, 다른 부여 보존        |
| ROL-04/05       | 역할 조직/정책 탭(목표) | 수신 조직, 관계 만료, 선택 정책/리소스 영향          |
| ACT-03          | Action 권한 평가 탭     | 주체·Action 평가와 응답 규칙 근거                    |
| POL-03          | 정책 Action별 응답      | field ref, masking/unmask, 호출/필드 권한 구분       |
| CHG-02/03/04    | 행/상세/선택 집합       | 동일 대상 diff·영향도, 대상→검토→명시 적용           |
| CHG-05          | 항목 동기화 이력        | 과거 revision을 새 revision으로 복원, 현재 참조 보호 |
| KEY-03/04/05    | 키/계정/결재 요청       | 템플릿 요청으로 이동, 재사용 필드 고정               |
| KEY-06 / APR-06 | 완료 결재 후속 처리     | 담당 팀 실행, 원문 미보관, hash와 이력               |
| TPL-03/04       | 템플릿 목록/상세        | 생성, 카탈로그 기반 라인 편집, 버전 불변성           |
| APR-04          | 현재 결재 단계          | 권한 검사 후 검토·승인/합의·반려                     |
| APR-05          | 열람자 탭               | 자동 등록, 수동 추가 출처, 조회만 허용               |

## 핵심 시나리오와 완료 조건

각 행의 ‘확인’은 기획의 수용 기준이다. 아래 표가 모두 실제 운영 환경에서 실행되었다는 뜻은 아니다. 이번 문서 PR에서는 경로·문서 링크·명세 대응을 검증한다.

| 검수 ID | 화면                   | 시나리오 / 기대 결과                                                                                 |
| ------- | ---------------------- | ---------------------------------------------------------------------------------------------------- |
| QA-01   | COM-01/03/05           | 미설정 로그인 비활성, API 401/403, 로그아웃 실패/성공과 언어 유지                                    |
| QA-02   | PLT-03/04, USR-02      | 같은 사용자의 두 플랫폼 멤버십, 역할은 독립. 멤버 추가가 역할 생성/변경을 유발하지 않음              |
| QA-03   | ROL-03                 | 기존 수신자 중복 제외, 해제 시 다른 역할·다른 플랫폼·멤버십 보존, revision 충돌 재검토               |
| QA-04   | ORG-01/02, SAC-02      | 조직장/상위 조직 이동, 조직 API 키의 계정 탭 경유, 서비스별 키 N개                                   |
| QA-05   | PAG-02, END-02, ACT-02 | 다른 부모의 같은 ID/path/field가 섞이지 않고 원본 endpoint 필드에서 참조 해석                        |
| QA-06   | POL-03, ACT-03         | page 없이 Action 사용, 같은 endpoint의 다른 Action, deny/allow/마스킹/unmask 합성                    |
| QA-07   | ROL-05                 | 동일 정책이 다른 역할에 있을 때 한 관계의 만료만 변경. 만료된 경로 기본 제외                         |
| QA-08   | CHG-02/03              | 상세 단일과 목록 단일 동일 검토, 복수 선택에서 필수 참조만 포함, 새 소스/revision으로 token 무효화   |
| QA-09   | CHG-04                 | 유형 탭 없는 직접 대상 목록, 조직원 제외, 경로 depth, 데이터 누락을 0으로 오인하지 않음              |
| QA-10   | CHG-05                 | 현재 참조를 깨는 롤백 차단, 다른 정의/부여 유지, 새 revision/이력 기록                               |
| QA-11   | TPL-04, APR-03         | 템플릿 v2 이후 기존 v1 문서의 입력/라인/필드 라벨이 변하지 않음                                      |
| QA-12   | APR-01/05              | 사용자 직접 열람/조직 현재 멤버 열람, 탈퇴 후 차단, 수동 열람자 권한 비승격, 목록·직접 URL 동일 조건 |
| QA-13   | APR-02/04              | 필수값/endpoint 검증, 같은 조합의 병렬 요청 차단, 미래 단계 승인 금지, 반려 후 실행 불가             |
| QA-14   | KEY-06 / APR-06        | 승인만으로 키 없음. 담당 팀만 실행하고 실제 저장 성공 시 hash/version·정책/역할 부여 기록            |
| QA-15   | KEY-04                 | 교체가 같은 관리 ID/정책/역할/Secret 필드를 재사용하고 endpoint 변경·구 hash·결재를 보존             |
| QA-16   | KEY-05                 | 폐기 결재에 보안팀 없음, 실제 폐기 결과와 결재 상태 분리, 이력 보존                                  |
| QA-17   | KEY-06                 | Secret 실패/중복 실행/timeout 후 재시도에서 중복 키·권한 없음. 다른 Secret 필드 보존                 |
| QA-18   | 전체                   | 한/영, 날짜, 빈 상태, 키보드/모달 포커스, 모바일, ID/hash 넘침, 민감정보 미노출                      |

## 검증 근거와 범위

- master 소스: `src/config/navigation.ts`, `src/app`, `src/features/identity`, `platforms`, `definitions`, `service-accounts`, 공통 UI.
- P18 소스: [approval-workflow](https://github.com/minjoonchoi/orion/tree/20f1da401851007852ed8cfe4a0ff602636362d4/src/features/approval-workflow), [캡처 스크립트](https://github.com/minjoonchoi/orion/blob/20f1da401851007852ed8cfe4a0ff602636362d4/scripts/approval-workflow-screens.mjs).
- 앞선 구현 PR의 테스트 결과는 해당 PR에 기록되어 있다. 이 문서 PR은 기능 코드를 변경하지 않으며 기존 검증을 이번에 재실행한 것처럼 서술하지 않는다.
- 실제 OIDC·인가·Cloud Config·AWS·분산 실패 복구는 각각 별도 서버 통합 검수가 필요하다. [미완료 표](15-gaps-and-decisions.md)의 항목을 해결한 뒤 운영 완료로 전환한다.
