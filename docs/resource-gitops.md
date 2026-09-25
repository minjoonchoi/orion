# 리소스 GitOps 동기화

## 구현 범위

`/resources`는 synced revision과 Git 정의서의 Out of sync 변경을 비교하고, Sync → 변경 내용 검토 → 최종 적용 → 실행 상태 확인을 제공합니다. `/policies/sync`는 같은 수동 동기화 흐름으로 정책의 리소스 접근 범위와 전처리·후처리 handler 변경을 관리합니다. 각 Sync는 이력으로 남고, 이전 revision으로 rollback할 수 있습니다. 리소스 상세의 직접 수정과 기존 resource 변경 액션은 비활성화했습니다. 역할·정책 부여는 기존 관리 UI를 유지합니다.

현재 repository는 Next.js 프런트엔드입니다. API 모드는 아래 Orion API 계약을 호출하며, config source 조회, Orion 동기화 실행기/DB 트랜잭션은 별도 백엔드 구현이 필요합니다. 예제 모드는 실제 YAML 파일을 파싱해 세션별 메모리 데이터에 원자 적용하고 목록·상세에 투영합니다. 예제 Git commit과 config 준비 상태는 시뮬레이션이며 실제 외부 동기화를 주장하지 않습니다.

## YAML 계약

원본: `config/resources/orion-resources.yaml`. `apiVersion: orion.io/v1alpha1`, `kind: ResourceBundle`이며 metadata로 환경/리전을 고정합니다. 고정 ID는 이름·경로 변경에도 유지합니다. 네 kind는 workspaces, pages, services, service-endpoints입니다. pages.parentId는 workspace ID, service-endpoints.parentId는 service ID입니다. 부모 종류를 함께 검사합니다.

각 present 항목은 전체 필드를 포함하며 빈 필드는 빈 문자열로 표현합니다. 필드 오타, 중복 YAML key, 별칭, 중복 kind/ID, 유효하지 않은 경로/메서드, 환경·리전 불일치를 거부합니다. 비밀키·인증 토큰은 정의서에 넣지 않습니다.

이 형식은 **명시적 변경 카탈로그**입니다. 파일에서 빠진 ID는 보존하고 implicit prune하지 않습니다. 삭제는 해당 ID의 `state: absent`로 선언합니다(나머지 필드는 식별/검토용으로 유지). 삭제에 연결 정책이 있으면 만료 여부와 무관하게 차단합니다. 삭제 이후 살아남는 하위 리소스가 부모를 잃어도 차단합니다. 정책 연결을 몰래 삭제하지 않습니다. 새로운 리소스에 역할/정책 권한은 자동 부여되지 않습니다. 변경 없는 항목을 제외한 Out of sync 정의 전체를 하나의 트랜잭션으로 적용하며 부분 선택은 제공하지 않습니다.

정책 원본: `config/policies/orion-policies.yaml`. `apiVersion: orion.io/v1alpha1`, `kind: PolicyBundle`이며 각 정책은 버전, allow/deny 효과, 연결 리소스, 전처리·후처리 processor를 함께 선언합니다. 여기서 패키지는 정책과 분리된 엔티티가 아니라 정책을 Git/Cloud Config로 묶어 배포·검토하는 형식입니다. processor는 실행 코드가 아니라 Orion API가 사전에 등록한 `handler` 식별자와 설정입니다. 운영 서버는 handler allowlist, handler별 config schema, 실행 순서, 실패 정책을 최종 검증해야 합니다.

```yaml
apiVersion: orion.io/v1alpha1
kind: PolicyBundle
metadata:
  name: orion-backoffice-policies
  environment: development
  region: ap-northeast-2
spec:
  policies:
    - id: policy-platform
      state: present
      version: 2026.09.24
      effect: allow
      resources:
        - kind: service-endpoints
          id: ep-roles
      processors:
        pre:
          - endpointId: ep-roles
            target: request.query
            handler: request.set-fields
            mode: required
            config:
              fields:
                tenantId: { source: identity.claims.tenant_id }
        post:
          - endpointId: ep-roles
            target: response.body
            handler: response.remove-fields
            mode: required
            config:
              fields: ["/internalNotes"]
```

정책 파일에서 빠진 ID는 보존하고 implicit prune하지 않습니다. 삭제는 `state: absent`로만 선언합니다. 역할에 연결된 정책 삭제는 차단합니다. 존재하지 않는 리소스 참조도 차단합니다. 정책 추가는 역할 부여를 자동 생성하지 않습니다.

## merge와 수동 Sync

리소스 관리는 `/resources` 단일 목록으로 제공합니다. Synced 리소스와 추가·수정·삭제 예정 항목을 함께 표시하고 유형·동기화 상태·변경 유형으로 필터링합니다. 별도 변경 탭 없이 목록의 diff 링크에서 변경 내용을 펼치며 Sync 검토에는 전체 변경 전후 값과 영향도를 함께 표시합니다. 필터는 조회 범위만 바꾸며 Sync는 환경·리전 전체 변경을 적용합니다. 기존 `/resource-sync`는 `/resources`로 이동합니다.

전처리·후처리는 정책이 허용하는 `service-endpoints`에만 적용합니다. 각 processor는 `endpointId`를 지정하며 해당 ID가 같은 정책의 리소스에 연결되어 있어야 합니다. 서비스에 연결했다고 하위 엔드포인트에 자동 적용하지 않습니다. 워크스페이스·페이지·서비스는 접근 권한만 평가합니다. deny 정책에는 processor를 선언할 수 없습니다.

`pre`의 target은 `request.query` 또는 `request.body`이며 호출 전 파라미터·본문 필드를 변경합니다. `post`는 `response.body`만 지원하며 호출 후 응답 필드 변경·제거·필터링을 수행합니다. 각 배열 순서대로 실행합니다. 처리가 필요 없으면 pre/post를 빈 배열로 선언합니다. 예제 handler와 config는 API 계약 초안이며 실제 HTTP 변환 실행기는 이 웹 앱에 포함되지 않습니다. 서버는 handler별 설정, 필드 경로, 사용자 입력과 신뢰된 identity 값의 구분을 검증해야 하고, required 처리 실패 시 원본 요청·응답을 그대로 통과시키지 않아야 합니다.

1. PR에서 원본 `config/resources/orion-resources.yaml`의 스키마와 참조를 검증하고 merge합니다. 별도 배포용 YAML 사본은 만들지 않습니다.
2. Config source가 merge된 commit의 정의서를 준비합니다. 이 단계는 synced revision을 변경하지 않습니다.
3. Orion API가 환경·리전별 synced revision, synced commit, Out of sync commit, 원본 SHA-256, config 준비 상태를 반환합니다.
4. Preview API는 권한·참조·삭제 차단·영향도를 재계산하고 사용자, scope, Out of sync commit/digest, synced/인가 revision에 묶인 단기 검토 token을 발급합니다.
5. 사용자가 Out of sync 변경 내용을 검토한 뒤 최종 Sync를 누르면 Orion API가 token과 idempotencyKey로 실행을 생성합니다. Orion 동기화 실행기는 검토한 commit의 정의서를 config source에서 조회하고 digest·scope·권한을 재검증합니다. 브라우저가 보낸 YAML이나 최신 브랜치 HEAD를 임의 적용하지 않습니다.
6. synced/인가 revision을 다시 검사한 뒤 변경 내용, 적용 commit/digest, 감사 로그, 성공 결과를 하나의 DB 트랜잭션으로 저장합니다. scope별 동시 실행은 하나만 허용하고 동일 요청은 기존 결과를 반환합니다.
7. UI는 Orion 실행 상태를 조회합니다. queued/running은 완료가 아니며 synced revision 갱신이 확인된 succeeded만 완료입니다. 실패 시 failed와 원인을 반환하고, 응답 유실 시 저장된 실행 결과를 조회해 복구합니다.
8. Rollback은 이력의 특정 succeeded run을 대상으로 새 실행을 생성합니다. rollback은 과거 데이터를 몰래 덮어쓰지 않고, 선택한 snapshot을 새 synced revision으로 적용한 별도 run으로 기록합니다.

**동기화 실행 주체는 Orion입니다.** 외부 배포 도구, Kubernetes ConfigMap, hook Job은 필요하지 않습니다. merge/config 갱신은 Out of sync 변경 준비까지만 수행하며 synced revision 변경은 반드시 Orion UI의 명시적 Sync와 서버 검증을 거칩니다.

## API 계약

모든 응답 `{data: ...}`. 기존 서버 런타임 환경/리전 API base URL, locale, 지정 세션 쿠키 전달을 재사용합니다. 브라우저가 Cloud Config credential/host를 받지 않습니다.

- `GET resource-sync/status`: `Snapshot` (`src/features/resource-sync/model.ts`). graph.resources의 parentId는 페이지/엔드포인트에서 필수. dbRevision은 synced revision과 같아야 합니다. yaml은 scope에 해당하는 완전한 Out of sync 파일, digest는 실제 파일 바이트 SHA-256, commit은 merge 확인된 SHA. API는 권한 밖 사용자/정책 데이터를 노출하지 않아야 합니다. 불완전한 graph를 잘라 반환하지 말고 요청을 거부하거나 완전한 서버 계산 영향도를 제공해야 합니다.
- `POST resource-sync/previews`: `{commit,digest,expectedDbRevision}` → `{token,expiresAt,snapshot}`. 서버는 클라이언트 diff/영향도를 신뢰하지 않고 다시 검증합니다. token은 사용자·환경·리전·원본 SHA·digest·synced/인가 revision·만료·삭제 계획을 바인딩합니다. 기본 5분. Out of sync commit/인가/synced revision 변경 시 409.
- `POST resource-sync/runs`: `{previewToken,idempotencyKey}` → `{id,status,phase,message,commit,dbRevision}`. status: queued/running/succeeded/failed. 동일 key와 요청은 기존 run 반환. 미리보기 유효성/권한/수동 정책을 최종 재검사합니다.
- `GET resource-sync/runs/{id}`: 동일 run DTO. 소유 사용자/권한 및 scope 검사. UI polling은 2초, 실패는 재시도 안내, 새로고침으로 status 확인 가능.
- `POST resource-sync/rollbacks`: `{runId,idempotencyKey}` → run DTO. 성공한 이력만 대상으로 하며, 선택한 이력의 snapshot을 새 synced revision으로 적용합니다. 응답 run에는 `rollbackOf`, `targetRevision`을 포함할 수 있습니다.

정책 동기화는 같은 응답 구조와 revision/token 규칙을 사용하되 API 경로만 `policy-sync/*`입니다.

- `GET policy-sync/status`: `Snapshot` (`src/features/policy-sync/model.ts`). yaml은 scope에 해당하는 완전한 Out of sync `PolicyBundle` 정의입니다.
- `POST policy-sync/previews`: `{commit,digest,expectedDbRevision}` → `{token,expiresAt,snapshot}`.
- `POST policy-sync/runs`: `{previewToken,idempotencyKey}` → run DTO.
- `GET policy-sync/runs/{id}` 및 `GET policy-sync/runs`: 실행 상세와 이력.
- `POST policy-sync/rollbacks`: `{runId,idempotencyKey}` → run DTO.

정책 sync 실행기는 적용 직전 role binding, resource reference, handler allowlist, processor config schema, synced revision을 다시 검증해야 합니다. 전처리·후처리 변경이 런타임 정책 평가에 반영되는 시점은 run 성공 DB transaction과 같은 audit record로 남겨야 합니다.

401 재로그인, 403 권한 없음, 409 충돌/재검토, 422 정의서/참조 검증 실패. 성공 응답은 synced revision 갱신이 확인된 경우에만 반환합니다. 취소는 새 YAML commit에 대한 동일 검토 흐름을 사용하고, rollback은 저장된 이력 snapshot을 대상으로 새 run을 생성합니다. Out of sync 변경 중 실행은 allow하지 않고 scope별 동시 run 하나만 허용합니다.

## 검증/제약

모델 단위 테스트: YAML 오류, 명시적 삭제, 부모/정책 차단, 원자 적용. 브라우저 테스트: diff, 검토 확인, 적용 완료, synced revision/목록 갱신. 실서버 E2E는 Orion API·config source·DB가 준비된 배포에서 추가해야 합니다. DB business constraints(다른 테이블 FK, 라우팅 충돌, 중복 경로 등)는 Orion 동기화 실행기의 최종 검증 책임입니다.

공식 자료:

- https://docs.spring.io/spring-cloud-config/reference/server/serving-plain-text.html
- https://docs.spring.io/spring-cloud-config/reference/server/environment-repository/git-backend.html

## 통합 리소스 관리

`/resources`에서 synced 리소스와 Out of sync 변경 사항 탭을 제공합니다. type 쿼리로 유형을 필터링하고 resource 쿼리로 특정 diff에 접근합니다. 기존 유형별 목록 주소는 필터로 이동하며 상세 주소는 유지합니다. 필터는 조회 전용으로 Sync는 Out of sync 변경 전체를 적용합니다.

`GET resource-sync/runs` → `{data: Run[]}`는 현재 배포 환경·리전에서 조회 권한이 있는 실행을 최신순으로 반환합니다. Run에는 선택적 ISO `completedAt`, `rollbackOf`, `targetRevision`을 추가했습니다. API 서버는 scope와 권한을 검증해야 하며 이력과 rollback 대상 snapshot은 영속 저장해야 합니다. 예제 이력은 세션 메모리에서만 유지됩니다. 상세 화면의 commit은 개별 리소스 최종 수정 commit이 아닌 synced 기준 버전입니다. API가 완료 시간을 반환하지 않으면 추측하지 않고 생략합니다.

Snapshot에서 외부 자동 동기화 상태 필드(autoSync)를 제거했습니다. Orion의 리소스 반영은 수동 Sync만 지원하며 Cloud Config 준비 상태만 실행 전 검사합니다.
