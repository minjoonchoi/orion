# 현재 정책 계약

독립 정책·직접 부여의 현행 계약은 [독립 정책과 부여](19-independent-policies.md)를 따른다. 기존 ID/API의 호환 동작과 운영 미완료 범위를 함께 구분한다.

# 신규 YAML 기반 UI

상태: 제품 UI 구현됨 / 운영 API·DB·Orion Gateway 통합 미완료. 전체 문법과 실행 계약은 [YAML 정의](../definition-management.md)를 따른다.

## 화면과 경로

| 화면 ID       | 경로                                             | 동작                                                          |
| ------------- | ------------------------------------------------ | ------------------------------------------------------------- |
| YAML-01       | /domains, /services, /workspaces, /organizations | 신규 정의와 기존 정의를 함께 탐색; 공통 검색·정렬·페이지 이동 |
| YAML-DOMAIN   | /domains/{id}                                    | Action 첫 탭, 정책·scope·사용 페이지·관계·이력·YAML           |
| YAML-02       | /actions/{domain}~{action}                       | 원본 엔드포인트와 요청·응답 허용 목록, 주입·마스킹·로그 보호  |
| YAML-03       | /scopes/{domain}~{scope}                         | 코드 조직 매핑, 사용 Action, 관계·이력                        |
| YAML-04       | /masking-rules                                   | 가상 입력의 마스킹 처리와 참조 필드                           |
| YAML-05       | /definition-sync                                 | 대상 확인 → diff/영향도 → 명시적 적용                         |
| YAML-06       | /definition-sync                                 | 적용 snapshot·이력과 Gateway 반영 대기 구분                   |
| YAML-POLICY   | /policies/{domain}~{policy}                      | 허용/거부 Action 그룹                                         |
| YAML-ENDPOINT | /service-endpoints/{service}~{endpoint}          | 원본 요청·응답 명세와 사용 Action                             |
| YAML-PAGE     | /pages/{platform}~{workspace}~{page}             | 화면에서 사용하는 Action                                      |

/definition-contract는 이전 검토 링크와 재현을 위한 통합 화면으로 유지한다. 제품 기본 진입은 각 메뉴·상세·/definition-sync이며 LSB에 통합 검토 메뉴를 추가하지 않는다.

## 상태와 데이터

config/contract-v2/**/*.yaml을 읽어 신규 명세를 검증하고 정규화한다. 파일 개수/순서와 식별을 분리한다. 신규 demo adapter 상태는 ConsoleLayout의 React context로 격리하여 페이지 이동 중 유지하며 다른 세션/SSR 요청과 공유하지 않는다. 새로고침 시 초기화된다. API 모드에서 새 fixture를 운영 데이터처럼 표시하지 않는다. 기존 API 화면은 그대로 유지한다.

## 수용 기준

Action은 도메인 첫 탭에서 독립 탐색하며 정책에 미연결이어도 조회 가능. 정책·엔드포인트·페이지에서 같은 상세로 이동한다. 공통 BrowseTable/DetailTabs/Button/Dialog/토큰을 사용한다. Git 변경과 적용 상태를 구분하며, 역할/사용자 정보가 없으면 영향 확인 불가로 표시한다. UI의 메모리 Sync 성공을 운영 DB/Gateway 성공으로 오인하지 않게 문서와 연동 상태를 구분한다.

운영 API 연결, 신규 정책-플랫폼 역할 연결, 구형 YAML 마이그레이션, 모든 정의의 삭제/복원·서버 평가와 Gateway 실행은 미완료다.

## 엔드포인트·액션 비교 및 API 키 목록

Action 상세는 요청/응답 각각 엔드포인트의 전체 필드를 기준으로 원본 타입·위치·필수 여부와 액션의 전달/주입/제외/마스킹/unmask, 로그 보호를 비교한다. 원본과 적용 후 JSON 형태를 같은 위치에 나란히 표시하며 모바일은 세로 배치한다. 모든 값은 가상 예시이고 scope/subject 값은 실제 호출자가 아닌 표현용 placeholder다. 실제 API를 호출하지 않는다. 제외 필드도 표에서 숨기지 않아 업무별 차이를 확인할 수 있다.

API 키 목록은 기존 카탈로그와 결재 발급 기록을 ID 기준으로 합쳐 한 표에서 조회한다. 같은 ID에는 결재 관리 레코드를 우선한다. 키 데이터·상세 경로를 보존하고 이관 안내를 제품 목록의 별도 영역으로 노출하지 않는다. 버전 등 제공되지 않은 값은 기록 없음으로 표시하며 만들어 채우지 않는다. 과거 결재의 열람 근거가 없는 기록은 기존 상세의 안전한 조회 범위를 유지한다. 데이터베이스 이관 완료를 의미하지 않는다.
