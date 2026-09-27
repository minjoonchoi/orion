# 권한 그래프와 영향도 계약

이 문서는 `src/features/authorization`의 그래프·변경·영향도 계약을 설명한다. 플랫폼 사용자 역할의 현재 변경 API는 [플랫폼 멤버십 계약](platform-membership-ui.md)을 사용한다. 두 모델과 definitions 평가의 운영 통합은 미완료이며 [GAP-02~04](screens/15-gaps-and-decisions.md)에 기록한다. 화면별 편집 가능 범위는 [역할 명세](screens/05-roles.md)를 따른다.

## API 계약 (백엔드 구현·합의 필요)

기존 런타임 API base URL, locale, region, allowlist 세션 쿠키 전달 설정을 재사용합니다. Next Server Actions의 동일 출처 검증을 사용하며 별도의 브라우저 직접 API 호스트는 없습니다.

### GET `authorization/graph`

`{ "data": Graph }`를 반환합니다. 정규화된 Graph 필드는 `src/features/authorization/model.ts`의 `graphSchema`에 정의되어 있습니다.

- `revision`: 현재 그래프의 정수 버전
- `users`: `{id,name}[]`
- `serviceAccounts`: `{id,name,organizationId,roleIds:string[]}[]`. 직접 부여 역할만 포함합니다. 소속 조직은 권한 상속을 의미하지 않습니다.
- `organizations`: `{id,name,memberIds[]}[]`
- `roles`: `{id,name,description,userIds[],organizationIds[],bindings:[{policyId,expiresAt}]}[]`
- `policies`: `{id,name,description,effect:"allow"|"deny",resources:[{kind,id}]}[]`
- `resources`: `{id,kind,name,description,path,method}[]`; 경로나 메서드가 없는 유형은 빈 문자열
- `kind`: `workspaces`, `pages`, `services`, `service-endpoints`, `domains`, `actions`. 자식 정의는 부모 범위를 포함한 복합 ID를 사용한다.

서버는 인증된 관리자가 조회·편집할 수 있는 범위만 반환해야 합니다. 모든 참조는 그래프 내 엔티티로 해석되어야 합니다. 목록을 임의로 잘라 반환하면 영향 범위가 불완전해지므로, 대규모 환경에서는 검색/분할 로딩 계약을 추가해야 합니다. 그래프를 사용하는 영향도·편집 컴포넌트는 한 번에 완전한 관리 범위를 받습니다.

### POST `authorization/changes`

요청은 `{revision, change}`이고 응답은 저장 후 **전체 Graph**를 담은 `{data: Graph}`입니다. 서버에서 revision 확인과 변경 적용을 하나의 트랜잭션으로 수행해야 합니다. 각 변경은 아래 필드 집합 전체를 교체합니다. 만료는 역할·정책 관계에 속하며 시간대가 포함된 ISO 시각을 사용하고 `null`은 무기한입니다.

| change.type    | 필드                                                         | 적용 범위                         |
| -------------- | ------------------------------------------------------------ | --------------------------------- |
| `subjectRoles` | `subjectKind: users / organizations`, `id`, `roleIds[]`      | 이전 그래프 모델의 주체 역할 집합 |
| `grants`       | `roleId`, `userIds[]`, `organizationIds[]`                   | 이전 그래프 모델의 역할 수신자    |
| `bindings`     | `roleId`, `bindings:[{policyId,expiresAt:string 또는 null}]` | 역할·정책 관계와 만료             |

`policy`와 `resource` 변경 타입은 이전 모델에 남아 있으나 현재 `changeAuthorization` 서버 액션에서 차단한다. 정책·리소스 정의는 [YAML 정의 계약](definition-management.md)의 preview/application으로 변경한다. 위 그래프 변경 API가 존재한다는 이유로 현재 플랫폼 역할 상세의 조직·정책 편집 통합이 완료되었다고 판단하지 않는다.

서버는 모든 요청마다 권한, 대상 존재 여부, 리소스 유형, 중복, 만료 시점, 정책 부여의 최소 1개 리소스, 리소스 필드 제약을 검증해야 합니다. UI의 검토 단계는 인가 검증을 대체하지 않습니다. 읽기 전용 API DTO에도 저장 결과를 반영해야 기존 목록·상세가 일치합니다. 이전 조회 DTO의 `effect`, `pageIds`, `pages`는 호환용 선택 필드이며 YAML 정책 계약을 대체하지 않는다.

- 401: 재로그인 안내
- 403: 공통 권한 오류 UI
- 409: 동시 변경 충돌 안내; 다시 불러와 재편집
- 기타 오류: 성공으로 처리하지 않고 재시도 안내

## 예제 모드

예제 모드는 그래프 모델과 이를 사용하는 컴포넌트의 동작을 확인하는 용도입니다. 예제 그래프는 HttpOnly 세션 식별자로 브라우저별 분리된 서버 메모리에 보관하며, 기존 목록·상세 어댑터에도 변경 결과를 투영합니다. 서버 재시작 또는 마지막 저장에서 1시간이 지나면 초기화됩니다. 동시 변경은 revision으로 방지합니다. 예제 모드는 영구 저장소나 실제 권한 판정기가 아닙니다. API 모드에서는 이 예제 저장소를 사용하지 않습니다.

## 검증 범위

`src/features/authorization/model.test.ts`, `rollback.test.ts`, `subject-impact.test.ts`에서 참조·만료·부여 보존·영향 경로를 검증한다. 현재 플랫폼 역할 화면의 검증은 [화면 검수표](screens/16-acceptance.md)를 따른다. 모델 검증은 운영 인가 서버와의 통합 완료를 뜻하지 않는다.

## 대상 중심 영향도

리소스 단일/선택 조회, Sync·롤백 및 역할·정책 부여 변경의 검토는 사용자·조직·서비스 어카운트 목록을 먼저 표시합니다. 유형별 탭 없이 전체 대상을 한 목록에 표시하고 행의 배지로 유형을 구분합니다. 상단은 유형별 전체 건수 요약이며, 필요하면 유형 필터로 좁혀 볼 수 있습니다. 대상 유형+ID로 중복을 제거하고 직접 역할이 부여된 사용자만 목록·집계에 포함합니다. 조직은 별도 대상으로 유지하며 멤버 사용자로 확장하지 않습니다. 역할·정책·리소스 이름과 ID로 검색할 수 있고 대상은 8개씩, 펼친 영향 경로는 5개씩 추가 조회합니다. 이는 수신한 전체 그래프의 클라이언트 페이지 구분입니다.

대상을 펼치면 역할 → 정책(허용/거부, 만료) → 선택 범위 리소스의 경로와 상세 링크를 표시합니다. 조직의 멤버 목록은 표시하지 않습니다. 만료된 역할·정책 부여은 기본 집계에서 제외하고 명시적으로 포함할 수 있습니다. 정책 Sync는 선택 정책에 부여된 역할만, 리소스 검토는 선택 리소스를 참조하는 정책만 포함합니다. 변경 검토는 전후 그래프의 경로를 비교해 실제 추가·해제되는 경로와 그 대상만 표시합니다. 경로가 해제되더라도 다른 권한 경로가 남을 수 있으므로 최종 허용/거부 판정을 뜻하지 않습니다.

`authorization/graph`, resource/policy Sync status 및 공통 Sync preview의 graph에 동일한 `serviceAccounts` 필드를 반환해야 합니다. 계정 역할 변경도 인가 revision을 증가시켜 기존 검토 token을 무효화해야 합니다. 필드가 없는 이전 응답은 호환하되 서비스 어카운트 영향도는 0이 아니라 ‘확인할 수 없음’과 `—`로 표시합니다. 빈 배열은 전체 범위를 조회한 결과 대상이 없다는 의미입니다. 잘못된 필드 타입은 응답 검증에서 거부합니다. 계정 목록을 누락/부분 제공하며 완전한 영향도처럼 표시해서는 안 됩니다.

데모 계정 역할 관계은 기존 서비스 어카운트 상세와 동일한 fixture에서 읽습니다. 일반 서비스 어카운트 역할의 직접 편집 UI는 제공하지 않습니다. 실제 운영은 Orion API가 위 데이터를 반환해야 합니다.

조직 멤버 생략은 영향도 화면의 표시 범위에만 적용합니다. 조직 소속, 역할 부여 및 실제 접근 판정은 변경하지 않습니다.

화면의 검토 단계와 용어는 [공통 화면 규칙](screens/00-common.md)을 따른다.
