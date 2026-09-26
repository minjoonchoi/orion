# 도메인 기반 YAML과 권한 UI

현재 관리 화면은 `src/features/definitions`와 `config/definitions/*.yaml`을 사용합니다. 기존 ResourceBundle / PolicyBundle은 신규 정의서가 아닙니다. 이전 모델·파일은 회귀 테스트와 마이그레이션 참고용으로 남겨두며 새 Cloud Config 경로에서는 읽지 않습니다. `npm run validate:definitions`가 CI의 정의서 검증 명령입니다.

## 작성 및 식별

최상위 문서는 workspace / service / domain / policy 중 하나입니다. `---`로 여러 문서를 묶거나 여러 YAML 파일로 분리할 수 있습니다. apiVersion/kind/metadata/spec, 환경·리전·작성자 지정 revision은 넣지 않습니다. 작업 예시 전체는 `config/definitions/platform.yaml`입니다.

- workspace.pages: 페이지 정의 목록. pages.actions에는 `{ref: {domain, action}}` 참조만 작성합니다.
- service.endpoints: 엔드포인트 정의 목록. request/response.fields 맵의 키가 로컬 필드 ID이며 경로와 타입을 소유합니다.
- domain.actions: 키가 로컬 Action ID인 맵. endpoint에는 `{ref: {service, endpoint}}` 한 개만 지정합니다.
- policy.resources: page는 선택적인 단일 `{ref: {workspace, page}}`, actions는 복수 `{ref: {domain, action}, response}`입니다. 별도의 workspace/service/endpoint 권한은 정책에서 허용하지 않습니다.
- 정의 ID는 소문자로 시작하는 영문·숫자·하이픈·밑줄(최대 100자)입니다. 동일 부모 내에서만 고유하며 최상위는 유형 내에서 고유합니다.
- 내부 키는 `pages:workspace/page`, `service-endpoints:service/endpoint`, `actions:domain/action`입니다. `/`와 `:`가 로컬 ID에 허용되지 않으므로 모호하지 않습니다. 링크의 `parent~id`도 같은 식별 제약을 적용합니다. 페이지/엔드포인트의 URL path 및 JSON 필드 path는 식별자로 사용하지 않습니다.
- 필드 ref는 정책의 Action → 엔드포인트 → response.fields 범위에서만 해석합니다. 전역 ID 검색이나 이름으로 추정하는 fallback은 없습니다.

```yaml
policy:
  id: employee-reader
  name: 직원 조회
  effect: allow
  resources:
    page:
      ref: { workspace: hr, page: detail }
    actions:
      - ref: { domain: employee, action: read }
        response:
          fields:
            - ref: { field: id }
            - ref: { field: email }
              masking: { method: email }
```

페이지와 Action은 각각 명시적 권한이며 관계만으로 권한을 상속하지 않습니다. 페이지를 명시한 정책의 Action은 해당 페이지가 사용하는 Action이어야 합니다. 서버 간 연동은 page를 생략합니다. 서비스 어카운트 여부를 page 유무로 제한하지 않습니다. 다른 응답 목적은 다른 Action으로 분리하되 같은 엔드포인트를 참조할 수 있습니다.

## 응답 처리와 정책 합성

- allow Action에는 response.fields, response.unmask, response.body: none 중 적어도 하나를 명시해야 합니다. 설정 생략은 전체 필드 허용이 아닙니다.
- `fields: []`는 호출은 허용하지만 반환 필드가 없는 경우입니다. `body: none`은 명시적인 body 미반환 계약입니다. body와 fields/unmask를 동시에 선언할 수 없습니다.
- `unmask: [{ref: {field: email}}]`만 있는 항목은 호출·필드 반환 권한을 추가하지 않습니다. 다른 유효 allow의 필드 반환 권한이 있어야 해제가 의미를 가집니다.
- deny는 Action 호출 자체를 거부하며 response 설정을 가질 수 없습니다.
- 동일 Action 범위의 유효 정책만 합성합니다. deny 우선, allow 필드 합집합, 마스킹 우선, 명시적 unmask 해제 순서입니다. masking 생략은 해제 권한이 아닙니다.
- 지원 마스킹 계약: email, keep-last(count: 0..100, replacement 한 글자), redact. 문자열 필드만 허용합니다. keep-last끼리는 더 작은 count를 적용합니다. redact는 다른 방식보다 제한적으로 취급합니다. 비교할 수 없는 방식 또는 replacement 충돌은 해제 권한이 없으면 fail-closed로 판정합니다.
- 권한 평가 UI는 `/definitions/evaluations`를 호출합니다. 예제 모드에서는 동일한 모델의 합성 결과를 계산하며 실제 upstream 호출/필드 변환은 실행하지 않습니다. 운영 요청 인증, 최종 인가, 원본 응답에서의 projection/masking, 감사를 API에서 구현해야 합니다. 브라우저가 반환 데이터를 필터링하는 보안 모델이 아닙니다.
- 조직 영향은 조직 자체로 표시하고 조직 경유 사용자를 펼치지 않습니다. 예제 평가도 사용자 직접 부여/조직 직접 부여/서비스 어카운트 역할 기준이며 조직 멤버십 상속을 포함한 운영 최종 평가는 API 책임입니다.

기존 임의 request preprocessor는 이 계약에서 자동 이관하지 않습니다. Action request 필드 선택은 제거되었으며, 요청 명세는 엔드포인트에서 검증합니다. 테넌트 주입 등 요청 전처리는 별도 실행 계약 확정 후 추가해야 합니다. 기존 정의를 조용히 변환하여 처리 규칙을 유실시키지 않습니다.

## 동기화와 롤백

중첩 YAML은 파싱 후 개별 리소스 정의로 정규화됩니다. 부모의 children 자체는 부모의 diff에 포함하지 않으며, 자식은 독립적인 key/revision으로 관리합니다. 누락된 항목은 보존합니다. 삭제는 전체 식별 정보와 `state: absent`를 유지해 명시합니다.

- 상세 및 목록 선택은 같은 2단계 검토(대상 → YAML diff/영향도)를 사용합니다.
- 선택 대상이 참조하는 정책→페이지/Action→엔드포인트→부모 정의를 재귀적으로 포함합니다. 형제 리소스는 자동 포함하지 않습니다. 정책에 없는 Action 권한을 생성하지 않습니다.
- 적용 후 전체 참조 그래프를 검증합니다. 참조 중인 필드 삭제, 페이지/Action 불일치, 존재하지 않는 참조, 부여 중인 정책 삭제는 차단합니다. 관련 정책을 함께 선택하여 참조를 해소할 수 있습니다.
- plan은 before/after 정의, 정확한 변경 키, snapshot revision, source revision, 만료 시간을 고정합니다. 적용 시 권한/버전/소스/만료를 다시 검증하고 정책과 의존 리소스를 원자 적용해야 합니다.
- 변경된 항목에만 공통 execution ID와 개별 이력을 기록합니다. 이전 revision 복원도 해당 항목 한 개를 새 revision으로 적용하고 나머지 정의와 부여는 유지합니다. 복원이 깨뜨리는 현재 참조는 차단합니다.
- 영향도는 변경된 단일/복수 key의 before/after 양쪽 의존 정책을 탐색합니다. 직접 사용자·조직·서비스 어카운트와 역할→정책→Action→엔드포인트 경로, 반환 필드·마스킹 변경 요약을 제공합니다. 이름 등 메타데이터 변경도 관계상 영향으로 표시하므로 실제 접근 변화와 동일한 의미는 아닙니다.

## API 계약

기존 region/environment별 deployment 선택과 locale, 허용된 세션 쿠키 전달을 그대로 사용합니다. YAML에는 배포 대상이 없지만 status 응답에는 서버가 선택한 environment/region을 포함하며 프런트엔드는 현재 배포 설정과 일치하는지 검사합니다. API 모드에서 예제 데이터로 fallback하지 않습니다.

모든 성공 응답은 `{data: ...}`입니다.

| 경로                             | 요청 / 응답                                                                                |
| -------------------------------- | ------------------------------------------------------------------------------------------ |
| GET `/definitions/status`        | Snapshot: revision, sourceRevision, environment, region, applied, desired, history, graph  |
| POST `/definitions/previews`     | `{selected: key[], expectedRevision, sourceRevision, restore?: {key, revision}}` → Preview |
| POST `/definitions/applications` | `{token}` → 적용 완료 Snapshot                                                             |
| POST `/definitions/evaluations`  | `{subject:{type,id}, action:{ref:{domain,action}}}` → `{allowed,reason,rows,conflicts}`    |

Entity: `{key,kind,id,parent,name,definition,refs,absent}`. definition은 정규화된 단일 항목 YAML 객체입니다. 응답의 Entity는 원본 definition과 parent에서 다시 검증·정규화하며 key 일치를 확인합니다. kind는 workspaces/pages/services/service-endpoints/domains/actions/policies입니다.

Preview: `{token,expiresAt,revision,sourceRevision,plan:{keys,selected,before,after,changes,blockers}}`. changes는 key별 before/after에서 프런트엔드가 재계산합니다. 임의 선택 밖 변경이 plan.keys에 없는 경우 거부합니다. 서버는 호출자가 선택한 범위와 필요한 참조만 포함하는지, 변경 권한을 갖는지 검증해야 합니다.

History: `{key,revision,at,actor,execution,source,definition}`. 삭제 버전은 definition:null입니다. 삭제된 항목 이력은 status에 보존해야 합니다.

Evaluation row: `{field,definition:{path,type},mode:plain|masked|unmask|excluded|conflict,rule?,policies:string[]}`. 클라이언트가 지정한 조회 대상 평가 권한을 서버에서 검증하고, 실제 API 호출 인가는 검증된 호출자 기준으로 별도 수행해야 합니다.

403/401/409와 만료·차단 응답을 처리합니다. 운영 영구 저장·Cloud Config 수집·인가 및 upstream 실행기는 이 프런트엔드 저장소 외부 구현입니다. 데모는 세션 메모리 저장이며, 새 정의 화면 최초 진입 시 기존 demo graph의 리소스·정책 카탈로그를 새 예제로 교체하고 없는 정책의 예제 부여를 제거합니다. 운영 데이터의 자동 마이그레이션은 수행하지 않습니다.

## 화면과 검증

메뉴: 워크스페이스 / 서비스 / 업무 도메인 / 정책 / 변경 관리. 페이지·엔드포인트·Action은 부모 상세에서 탐색하고 기존 목록 URL과 복합 ID 상세 URL도 제공합니다. 상세 탭은 정보·관계·항목별 이력·YAML이며 Action에는 권한 평가를 추가합니다.

재현: `scripts/definitions-screens.mjs`. 모델 검증: `src/features/definitions/model.test.ts`. 통합 검증: `tests/e2e/definitions.spec.ts`.

기존 예제 서비스·워크스페이스 카탈로그는 `existing-catalog.yaml`로 옮겨 기존 조직 화면의 리소스 링크를 유지합니다. 예전 전역 페이지·엔드포인트 ID 링크는 데모의 명시적 alias 표로만 복합 ID 경로에 리다이렉트합니다. 임의의 로컬 ID에 대한 전역 검색 fallback은 없습니다.

기존 권한 그래프는 domains/actions 유형과 복합 자식 ID(`parent~id`)를 지원해야 합니다. 역할 부여 검토에는 정책의 명시적 페이지·Action 참조가 표시되며 해당 정의 상세로 이동할 수 있습니다. 운영 API는 동일한 식별 규칙으로 graph와 definitions 응답을 제공해야 합니다.

UI 전환에 따라 이전 Bundle 및 리소스별 탭에 종속되었던 E2E를 새 정의서/화면 계약으로 교체했습니다. 단일·복수 선택, 조회 필터 유지, YAML/영향도 전환, 필수 참조 포함, 부분 적용, 항목별 복원, 동시 부여 변경 충돌, 직접 대상 영향·서비스 어카운트 경로, 역할 부여·만료, 한/영 모바일 접근성을 검증합니다. 이전 Bundle 파서 단위 테스트는 마이그레이션 참고 모델의 회귀 검증으로 유지합니다.
