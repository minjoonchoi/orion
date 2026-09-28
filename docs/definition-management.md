# YAML 정의·GitOps·Gateway 계약

상태: 신규 YAML 모델·제품 UI 구현됨 / 운영 DB·Git 수집·Orion Gateway 연동 미완료. 기존 API 정의와 병행하며 자동 이관하지 않는다. 이전 계약은 [호환 문서](archive/definition-management-v1.md)를 따른다.

## 소유와 식별

조직은 전사 공통이다. 서비스는 전사 조직이 관리한다. 도메인은 서비스로 구현할 제품 요건이며 플랫폼/조직과 독립이다. workspace와 page는 플랫폼에 소속된다. 기존 플랫폼 등록과 사용자 소속/역할 부여는 API 관리 영역이다.

| 정의        | 안정 식별자                | 파일                                      |
| ----------- | -------------------------- | ----------------------------------------- |
| 조직        | organization/id            | organizations.yaml의 복수 문서            |
| 공통 마스킹 | masking/id                 | masking-rules.yaml                        |
| 서비스      | service/id                 | services/{관리조직}/{서비스}/service.yaml |
| 엔드포인트  | endpoint/service/id        | 같은 서비스 endpoints/*.yaml              |
| 도메인      | domain/id                  | domains/{도메인}.yaml                     |
| scope       | scope/domain/id            | domain.scopes                             |
| Action      | action/domain/id           | domain.actions                            |
| 정책        | policy/id                  | policies/*.yaml                           |
| workspace   | workspace/platform/id      | platforms/{플랫폼}/workspaces/*.yaml      |
| page        | page/platform/workspace/id | workspace.pages                           |

파일명/정렬은 식별자가 아니다. 전체 소스를 파싱한 뒤 참조를 검증한다. 동일 서비스의 엔드포인트 중복, 중복 YAML 키, 중복 Action 필드를 거부한다. 이동/분할만으로 revision을 올리지 않는다. 파일 생략은 삭제가 아니다. 삭제는 식별자를 유지한 state: absent로 선언하며 사용 중인 참조는 함께 해소한다.

## 스키마

- organization: id, name, parent?; parent는 전사 조직 참조. 순환 금지.
- service: id, name, organization; 서비스별 API 필드 표기는 snake_case 또는 camelCase 하나. 이름은 자동 변환하지 않는다. 작성 규약을 검증할 명시적 서비스 속성은 후속 확정 전까지 추가하지 않는다.
- 분리 엔드포인트 문서: service: 서비스ID, endpoints: 목록. endpoint는 id/name/method/path/request/response를 가진다.
- 원본 request.fields/response.fields는 필드명 맵이다. path/type/privacy/masking?을 소유하며 요청은 location/required?, 배열은 items.type을 가진다. body/응답 경로는 JSON Pointer 기반이며 응답 배열의 *는 각 요소를 의미한다. 요청 주입의 배열 wildcard는 초기 범위에서 허용하지 않는다.
- privacy는 명시적 boolean. true의 masking 생략은 공통 redact를 사용한다. false의 masking은 오류. email/partial은 문자열 전용, redact는 전체 값 대체가 가능하다.
- domain은 id/name/scopes/actions/policies. scope는 name/codes/organizations. code 값은 원문 문자열이며 조직 매핑은 정의된 코드만 참조한다. 상위 조직 자동 상속 없음.
- Action은 name/endpoint. endpoint는 service/endpoint/request/response. 엔드포인트를 직접 참조하고 처리 규칙을 그 아래 둔다.
- Action request.fields/response.fields는 문자열 또는 단일 필드명 맵의 목록. {} 반복은 필요 없다. 중복/여러 필드 키를 가진 목록 항목은 오류.
- 일반 요청 문자열은 클라이언트 값을 검증하여 전달. scope 또는 source가 있으면 Gateway가 추가/대체한다. source는 subject.nickname, subject.email 등 등록된 경로만 허용한다. 임의 표현식/코드 실행 금지.
- 응답 문자열은 선택 반환하며 privacy 마스킹을 상속한다. 필드의 unmask: true는 응답 반환에만 적용하고 로그에는 영향을 주지 않는다. 원문 제공은 새 Action/정책으로 구분하여 명시적으로 부여한다.
- 정책은 독립 정의이며 name/effect/assignable_to/actions/workspaces를 사용한다. effect는 allow 또는 deny. assignable_to는 role 또는 service_account다. 최상위 actions는 페이지 조건 없는 실행, workspaces.pages.actions는 해당 플랫폼/워크스페이스/페이지 경로에서의 실행을 허용한다. 서비스 어카운트는 정책을 직접 부여받는다. [현행 정책 계약](screens/19-independent-policies.md)을 따른다. 같은 Action 평가 시 deny 우선, allow 없음은 거부. 다른 Action의 필드 범위를 합치지 않는다.
- workspace는 id/platform/name/pages. page는 id/name/path/actions(domain/action). 페이지의 사용 관계가 권한을 부여하지 않는다.

## 필드 허용 목록과 처리

Action에 없는 요청 필드는 upstream에 전달하지 않는다. Action에 없는 응답 필드는 반환하지 않는다. fields 생략은 전체 허용이 아니며 명시적 []만 빈 목록으로 인정한다. 엔드포인트 필수 요청 필드를 Action이 누락하면 정의 검증 차단. 값 주입 후 필수/타입 검증. 응답 projection은 선택된 원본 경로의 컨테이너/배열 구조를 유지하며 부모 선택으로 미선택 자식이 노출되지 않도록 실행기 계약을 검증한다.

scope는 해당 도메인의 정의를 참조한다. Gateway는 인증된 호출자와 검증된 업무 조직으로 코드 목록을 구한다. 클라이언트가 제공한 조직/사용자 값을 신뢰하지 않는다. 조직 불명/복수 조직 선택 모호/빈 매핑/필수 source 누락은 차단. SA에 사용자 전용 source를 적용했으나 값이 없으면 차단한다. SA 컨텍스트의 구체적인 등록 계약은 별도 확정한다.

서비스가 snake_case이면 Action도 정확히 그 필드 키를 참조한다. 다른 서비스의 camelCase를 자동 대응시키지 않는다. 같은 경로를 가리키는 중복 필드, 부모/자식의 상충 규칙, 헤더 대소문자 중복도 검증해야 한다.

## 공통 마스킹

masking-rules 맵의 각 규칙은 description/method와 method별 옵션을 가진다.

- email: local-part.keep-start/keep-end, domain: preserve, replacement, replacement-length, on-short/on-invalid: redact.
- partial: keep-start/keep-end, replacement, replacement-length, on-short: redact.
- redact: replacement 고정 문자열.
- replacement-length는 원본 길이가 아닌 반복 수. 보존 글자는 grapheme 기준. 남겨둘 부분만으로 전체가 노출되거나 형식/타입이 다르면 redact. null은 null을 유지한다. 알 수 없는 옵션/음수 옵션/부재 규칙/타입 불일치는 차단한다.
- Gateway의 요청/응답 로그는 원문을 기록하기 전에 마스킹한다. unmask가 있어도 로그는 마스킹. 로그에서 미정의 원문 payload는 기록하지 않는다. 실패 시 원문 fallback 금지. 마스킹 규칙 조회 오류는 해당 값 미기록.
- 개인정보를 포함하는 배열/객체의 원문 fallback, 오류 로그·트레이스의 우회 노출은 실행기 검증 대상이다.

## GitOps → DB → Gateway

Git revision 수집 → 전체 문서 파싱/정규화 → 참조·타입 검증 → 적용 DB snapshot과 diff → 대상/필수 의존성/전후 영향 검토 → 명시적 Sync → DB 트랜잭션 저장 및 이력 기록 → Gateway revision 배포/확인.

Git은 원하는 정의의 원천이며 DB는 검증 후 적용된 정의의 조회/실행용 저장소다. UI 조회는 적용 DB snapshot을 기본으로 하며 Git 변경안을 별도로 표시한다. 화면에서 직접 정의를 편집해 Git과 DB를 이중 원천으로 만들지 않는다.

DB에는 정규화된 정의, 참조 관계, 원본 파일/문서 위치, Git revision, 정의별 revision, 적용 execution ID, 수행자/시각, 변경 전후 snapshot을 저장한다. 조직-코드 및 역할 부여 관계와 Gateway 상태를 조회 API가 제공한다. 실제 테이블/SQL은 백엔드 설계 범위다.

검토 token은 선택/의존 key, before/after, DB revision, Git revision, 만료를 고정한다. 적용 시 권한·revision·참조·만료를 재검증하고 원자 적용한다. DB 저장 실패는 전체 rollback, 이력 성공 처리 금지. 재시도는 execution ID로 중복 적용 방지. Gateway 전파 실패는 DB 적용 실패와 구분하고 재전파/이전 revision 복원 경로를 제공한다. 이전 정의 복원도 새 검토/실행으로 처리한다.

동기화 상태는 Synced / Out of sync. 상세 근거에서 Git revision, DB 적용 revision, 마지막 Sync, Gateway 반영 revision을 확인한다. DB Synced라도 Gateway 적용이 대기/실패이면 운영 반영 완료로 표시하지 않는다.

## UI 범위

| 화면 ID             | 요구                                                                            |
| ------------------- | ------------------------------------------------------------------------------- |
| YAML-01 정의 조회   | 유형별 검색·목록, 적용/Git 비교, 파일 출처, 식별자                              |
| YAML-02 Action 계약 | 엔드포인트 이동/참조, 요청 허용·주입/응답 선택·마스킹·원문, 누락 필드 제외 안내 |
| YAML-03 조회 범위   | 코드 목록, 전사 조직 매핑, 사용 Action, 매핑 전후 차이                          |
| YAML-04 마스킹      | 공통 방법/옵션, 합성 입력 예제와 결과, 연결 필드, 로그/반환 구분                |
| YAML-05 Sync 검토   | 대상 → diff/영향도 검토, 차단 목록, Git/DB 기준, 명시적 적용                    |
| YAML-06 적용 결과   | DB 적용 상태/이력, Gateway revision 및 확인 대기 구분                           |

신규 정의는 기존 조직·서비스·도메인·workspace 목록의 YAML 정의 구역에서 탐색한다. 도메인 상세의 첫 탭은 Action이며 정책·scope·사용 페이지로 이어진다. 정책·엔드포인트·페이지에서 동일 Action 상세로 이동한다. /masking-rules와 /definition-sync는 독립 제품 화면이다. /definition-contract는 기존 검토 링크 호환용 통합 화면이다. 기존 모든 구형 API 모델이 전환된 것으로 표시하지 않는다. 공통 BrowseTable/DetailTabs/Button/Dialog/토큰을 재사용한다.

## 영향도와 운영 경계

원본 필드 변경→Action→정책→역할/직접 주체 및 사용하는 플랫폼 페이지. scope 매핑 변경→조회 코드의 추가/회수, masking 변경→로그와 응답 노출, Action 변경→필드 추가/제거/주입/원문 전환을 전후로 보여준다. 경로 영향과 실제 허용 결과를 구분한다. 역할/사용자 데이터가 없으면 확인 불가이지 0명이 아니다. 실제 조회 건수는 upstream 데이터 없이는 계산하지 않는다.

새 UI의 demo adapter Sync는 메모리 snapshot만 변경하며 같은 페이지 세션의 메뉴 이동 동안 유지한다. 새로고침 시 초기화된다. 실제 DB 저장, Git 수집, Gateway 배포·요청 변환/로그 마스킹은 이 저장소에서 완료된 기능이 아니다. UI에서 Gateway 확인을 임의 성공 처리하지 않는다.

## API 제안과 수용 기준

GET status는 desired/applied와 sourceRevision/databaseRevision/gatewayRevision, definitions/errors/history를 제공한다. POST preview는 선택 key와 expected revisions로 고정 plan/token/expiry를 반환한다. POST apply는 token/execution ID로 적용하며 동기화 결과와 Gateway 전파 상태를 분리한다. 401/403/409/만료/검증 실패는 실패 사유와 재검토 수단을 제공한다.

수용: 미선택 요청/응답 제외, scope/source 대체, duplicate/참조/필수 필드/타입 검증, 서로 다른 Action 결과 격리, privacy 로그 항상 보호, allow/deny 평가, 동일 서비스 파일 병합, 삭제/복원 참조 검증, Sync 취소 무변경/성공 revision 증가/실패 원자성, 검토 후 revision 변경 차단, Gateway 대기 표시, 한영·모바일 정렬.

미확정: 페이지 자체 접근 권한, 복수 조직 업무 컨텍스트 선택, SA source 등록, 플랫폼 간 정책 부여 API, 서비스 필드 표기 규약의 명시 속성. 확정 전 운영 실행을 추정 구현하지 않는다.

## 실행 가능한 예제 파일

- [전사 조직](../config/contract-v2/organizations.yaml)
- [공통 마스킹](../config/contract-v2/masking-rules.yaml)
- [관리서비스](../config/contract-v2/services/identity-team/employee-api/service.yaml)
- [직원 엔드포인트](../config/contract-v2/services/identity-team/employee-api/endpoints/employees.yaml) · [별도 엔드포인트 파일](../config/contract-v2/services/identity-team/employee-api/endpoints/health.yaml)
- [도메인 scope·Action](../config/contract-v2/domains/employee.yaml)
- [플랫폼 workspace·page](../config/contract-v2/platforms/sales-platform/workspaces/sales-console.yaml)

## 구현 상태

제품 UI: 24개 정규화 정의 조회, Action별 요청/응답 계약과 원본 명세 참조, 조직 scope 전후 비교, 공통 마스킹의 가상 값 실행, 선택 scope의 필수 참조 포함과 영향 관계 탐색, 2단계 Sync 취소/적용/이력 및 Gateway 대기 상태. ko/en과 모바일 지원. 기존 정의 목록에서 신규 상세로 진입하며 도메인의 Action·정책·scope·사용 페이지를 탐색한다. 공통 마스킹과 정의 Sync는 별도 제품 화면으로 제공한다.

스펙에만 정의된 운영 과제: 실제 Git revision 수집, DB 트랜잭션/권한 검사/실행 이력 저장, Gateway 배포·필드 projection·로그 마스킹, 역할/사용자 영향 API, 모든 정의 유형의 삭제·복원·마이그레이션 및 기존 메뉴 완전 전환. 신규 파서는 검토 예제와 핵심 참조/타입 오류를 검증하며 운영용 전체 스키마 검증기의 대체물이 아니다.

## 제품과 API 호환

config/contract-v2/**/*.yaml은 서버에서 읽어 검증하고 제품 컴포넌트에 전달한다. HTML은 같은 파일을 번들에 포함한다. 기존 config/definitions와 API 어댑터는 별도로 유지한다. 기존 정책 ID를 domain/policy 복합 키로 자동 변경하거나 역할 부여를 삭제하지 않는다. 신규 정책-역할 부여 및 운영 상태 API 구현 후 명시적 이관 검토가 필요하다. API 모드에서 신규 화면은 연동 필요를 표시하고 기존 API UI는 유지한다.

화면 경로·구현 상태는 [신규 YAML UI](screens/18-yaml-gitops-contract.md), 메뉴 구조는 [화면 목차](screens/README.md)를 따른다.

독립 정책 예시는 [policies YAML](../config/contract-v2/policies/employee.yaml)을 참조한다.
