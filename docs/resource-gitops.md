# 리소스 GitOps 동기화

> 이전 Bundle 계약의 기록입니다. 현재 UI와 YAML 계약은 [도메인 기반 정의 관리](definition-management.md)를 사용합니다.

## 구현 범위

`/resources`는 synced revision과 Git 정의서의 Out of sync 변경을 비교하고, Sync 대상 확인 → 변경·영향도 검토 → 최종 적용 → 실행 상태 확인을 제공합니다. `/policies/sync`는 같은 수동 동기화 흐름으로 정책의 리소스 접근 범위와 전처리·후처리 handler 변경을 관리합니다. 각 Sync는 이력으로 남고, 이전 revision으로 rollback할 수 있습니다. 리소스 상세의 직접 수정과 기존 resource 변경 액션은 비활성화했습니다. 역할·정책 부여는 기존 관리 UI를 유지합니다.

현재 repository는 Next.js 프런트엔드입니다. API 모드는 아래 Orion API 계약을 호출하며, config source 조회, Orion 동기화 실행기/DB 트랜잭션은 별도 백엔드 구현이 필요합니다. 예제 모드는 실제 YAML 파일을 파싱해 세션별 메모리 데이터에 원자 적용하고 목록·상세에 투영합니다. 예제 Git commit과 config 준비 상태는 시뮬레이션이며 실제 외부 동기화를 주장하지 않습니다.

## YAML 계약

원본: `config/resources/orion-resources.yaml`. `apiVersion: orion.io/v1alpha1`, `kind: ResourceBundle`이며 metadata로 환경/리전을 고정합니다. 고정 ID는 이름·경로 변경에도 유지합니다. 네 kind는 workspaces, pages, services, service-endpoints입니다. pages.parentId는 workspace ID, service-endpoints.parentId는 service ID입니다. 부모 종류를 함께 검사합니다.

각 present 항목은 전체 필드를 포함하며 빈 필드는 빈 문자열로 표현합니다. 필드 오타, 중복 YAML key, 별칭, 중복 kind/ID, 유효하지 않은 경로/메서드, 환경·리전 불일치를 거부합니다. 비밀키·인증 토큰은 정의서에 넣지 않습니다.

이 형식은 **명시적 변경 카탈로그**입니다. 파일에서 빠진 ID는 보존하고 implicit prune하지 않습니다. 삭제는 해당 ID의 `state: absent`로 선언합니다(나머지 필드는 식별/검토용으로 유지). 삭제에 정책이 있으면 만료 여부와 무관하게 차단합니다. 삭제 이후 살아남는 하위 리소스가 부모를 잃어도 차단합니다. 정책 부여을 몰래 삭제하지 않습니다. 새로운 리소스에 역할/정책 권한은 자동 부여되지 않습니다. 목록에서 선택한 리소스 또는 상세의 단일 리소스와 필요한 상위 리소스만 한 트랜잭션으로 적용합니다. 전체 변경 Sync는 모든 변경을 명시적으로 선택하는 별도 진입점입니다.

정책 원본: `config/policies/orion-policies.yaml`. `apiVersion: orion.io/v1alpha1`, `kind: PolicyBundle`이며 각 정책은 버전, allow/deny 효과, 리소스, 전처리·후처리 processor를 함께 선언합니다. 여기서 패키지는 정책과 분리된 엔티티가 아니라 정책을 Git/Cloud Config로 묶어 배포·검토하는 형식입니다. processor는 실행 코드가 아니라 Orion API가 사전에 등록한 `handler` 식별자와 설정입니다. 운영 서버는 handler allowlist, handler별 config schema, 실행 순서, 실패 정책을 최종 검증해야 합니다.

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

정책 파일에서 빠진 ID는 보존하고 implicit prune하지 않습니다. 삭제는 `state: absent`로만 선언합니다. 역할에 포함된 정책 삭제는 차단합니다. 존재하지 않는 리소스 참조도 차단합니다. 정책 추가는 역할 부여를 자동 생성하지 않습니다.

## merge와 수동 Sync

리소스 관리는 `/resources` 단일 목록으로 제공합니다. Synced 리소스와 추가·수정·삭제 예정 항목을 함께 표시하고 유형·동기화 상태·변경 유형으로 필터링합니다. 별도 변경 탭 없이 목록의 diff 링크에서 변경 내용을 펼치며 Sync 검토에는 포함된 대상의 변경 전후 값과 영향도를 함께 표시합니다. 필터는 조회 범위만 바꿉니다. 선택은 필터를 넘어 유지되며 선택 리소스 Sync와 전체 변경 Sync를 구분합니다. 기존 `/resource-sync`는 `/resources`로 이동합니다.

전처리·후처리는 정책이 허용하는 `service-endpoints`에만 적용합니다. 각 processor는 `endpointId`를 지정하며 해당 ID가 같은 정책의 리소스에 관계되어 있어야 합니다. 서비스에 관계했다고 하위 엔드포인트에 자동 적용하지 않습니다. 워크스페이스·페이지·서비스는 접근 권한만 평가합니다. deny 정책에는 processor를 선언할 수 없습니다.

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

## 기존 조회·이력 API 계약

모든 응답 `{data: ...}`. 기존 서버 런타임 환경/리전 API base URL, locale, 지정 세션 쿠키 전달을 재사용합니다. 브라우저가 Cloud Config credential/host를 받지 않습니다.

- `GET resource-sync/status`: `Snapshot` (`src/features/resource-sync/model.ts`). graph.resources의 parentId는 페이지/엔드포인트에서 필수. dbRevision은 synced revision과 같아야 합니다. yaml은 scope에 해당하는 완전한 Out of sync 파일, digest는 실제 파일 바이트 SHA-256, commit은 merge 확인된 SHA. API는 권한 밖 사용자/정책 데이터를 노출하지 않아야 합니다. 불완전한 graph를 잘라 반환하지 말고 요청을 거부하거나 완전한 서버 계산 영향도를 제공해야 합니다.
- (이전 전체 동기화 계약, 공통 UI에서 사용하지 않음) `POST resource-sync/previews`: `{commit,digest,expectedDbRevision}` → `{token,expiresAt,snapshot}`. 서버는 클라이언트 diff/영향도를 신뢰하지 않고 다시 검증합니다. token은 사용자·환경·리전·원본 SHA·digest·synced/인가 revision·만료·삭제 계획을 바인딩합니다. 기본 5분. Out of sync commit/인가/synced revision 변경 시 409.
- (이전 전체 동기화 계약, 공통 UI에서 사용하지 않음) `POST resource-sync/runs`: `{previewToken,idempotencyKey}` → `{id,status,phase,message,commit,dbRevision}`. status: queued/running/succeeded/failed. 동일 key와 요청은 기존 run 반환. 미리보기 유효성/권한/수동 정책을 최종 재검사합니다.
- `GET resource-sync/runs/{id}`: 동일 run DTO. 소유 사용자/권한 및 scope 검사. UI polling은 2초, 실패는 재시도 안내, 새로고침으로 status 확인 가능.
- `GET resource-sync/runs?kind={kind}&resourceId={id}`: 해당 리소스의 이력을 최신순으로 반환합니다. 각 Run의 `resources`는 `{kind,id,before: Item|null,after: Item|null}[]`입니다. 생성 이전/삭제 이후는 null입니다. 조회한 리소스의 기록이 없는 응답은 UI가 거부하며 전체 실행을 그 리소스의 이력으로 추측하지 않습니다. 환경·리전 및 리소스 조회 권한은 서버가 검사합니다.
- `POST resource-sync/resources/{kind}/{id}/rollbacks`: `{runId,kind,resourceId,expectedDbRevision,idempotencyKey}` → run DTO. 성공한 이력에서 **해당 리소스만** 복원합니다. 기존 전체 롤백 API로 대체 호출하지 않습니다. 현재 인가/동기화 revision 불일치는 409, 부모/정책 참조가 끊기는 복원은 차단합니다. 사용자·조직·역할 부여·정책·다른 리소스는 유지합니다. 동일 키 요청은 동일 결과를 반환해야 하며, 서버는 대상 run과 리소스의 관계 및 수정 권한을 재검증합니다. 응답 run에 `resources`, `rollbackOf`, `targetRevision`을 포함합니다. queued/running은 완료가 아니며 실행 상태 조회 후 성공을 표시합니다.

정책 동기화는 같은 응답 구조와 revision/token 규칙을 사용하되 API 경로만 `policy-sync/*`입니다.

- `GET policy-sync/status`: `Snapshot` (`src/features/policy-sync/model.ts`). yaml은 scope에 해당하는 완전한 Out of sync `PolicyBundle` 정의입니다.
- (이전 독립 동기화 계약, 공통 UI에서 사용하지 않음) `POST policy-sync/previews`: `{commit,digest,expectedDbRevision}` → `{token,expiresAt,snapshot}`.
- (이전 독립 동기화 계약, 공통 UI에서 사용하지 않음) `POST policy-sync/runs`: `{previewToken,idempotencyKey}` → run DTO.
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

영향도 조회는 단일 리소스 또는 선택한 리소스 집합 기준이다. 행/상세의 `영향도 보기`는 그 리소스만, 목록 체크박스의 `선택 리소스 영향도 보기`는 선택한 리소스만 포함한다. 모달에서 전체 선택과 개별 리소스를 전환할 수 있고 정책·역할·조직·사용자를 각각 중복 제거하여 집계한다. 조회를 열 때 기존 `GET resource-sync/status`로 최신 snapshot을 가져오며 환경·리전·revision을 명시한다. 선택 ID는 `selected=kind:id` 반복 쿼리로 보존한다. 선택은 읽기 전용 영향도 조회와 선택 리소스 Sync의 범위에 사용된다. 각 행은 해당 항목의 동기화를 열며, 여러 항목을 함께 적용하려면 체크박스로 명시적으로 선택한다.

`/resources`는 ‘변경 관리’이며 정책과 리소스의 Synced / Out of sync 상태를 한 목록으로 제공합니다. type 쿼리는 정책(policies)과 접근 대상 네 유형을 지원합니다. resource 및 diffType 쿼리로 유형+ID별 diff에 접근합니다. `/workspaces`, `/pages`, `/services`, `/service-endpoints`는 현재 적용된 목록을 조회하는 독립 탐색 화면입니다. `/policies/sync`와 `/policy-sync`는 변경 관리의 정책 필터로 이동합니다. 필터는 조회 전용이며 Sync 범위는 명시적으로 선택한 대상에 의해 결정됩니다.

동기화 이력은 별도 메뉴 없이 목록의 각 리소스 `이력 보기`와 상세 화면 `동기화 이력`에서 엽니다. 목록의 `history=kind:id` 쿼리를 새로고침해도 동일 이력을 열고 다른 필터를 유지합니다. 기존 `/resource-sync/history`는 `/resources`로 이동합니다. YAML에 명시된 삭제 완료 항목도 목록에 남아 삭제 기록을 조회할 수 있습니다.

이력에는 실제 변경된 리소스만 기록합니다. 각 revision을 펼쳐 변경 전후를 확인하고, 과거 revision을 선택하면 현재 정의와 복원할 정의의 diff 및 현재 정책·역할·사용자 영향도를 검토한 뒤 확인하고 롤백합니다. 현재와 동일한 정의는 롤백할 수 없습니다. 최초 Sync 직전 상태는 `phase: baseline`인 기준 기록으로 보존하며 실행/완료 시간을 만들어 내지 않습니다. baseline은 해당 리소스가 존재하지 않았던 상태도 보존합니다.

Run에는 선택적 ISO `completedAt`, `rollbackOf`, `targetRevision`, `resources`를 포함합니다. 개별 이력 응답에서는 `resources`가 필수입니다. API 서버는 이력과 rollback 대상 snapshot을 영속 저장해야 합니다. 예제 이력은 세션 메모리에서만 유지됩니다. 상세 화면에는 해당 리소스의 최근 적용 commit/revision을 표시하며 이력이 없을 때는 환경 기준 revision임을 명시합니다. 리소스 단위 롤백은 마지막 전체 Sync commit을 덮어쓰지 않습니다. API가 완료 시간을 반환하지 않으면 추측하지 않고 생략합니다.

Snapshot에서 외부 자동 동기화 상태 필드(autoSync)를 제거했습니다. Orion의 리소스 반영은 수동 Sync만 지원하며 Cloud Config 준비 상태만 실행 전 검사합니다.

## 공통 Sync 계획 API

상세 단일 리소스·목록 선택 리소스·정책 Sync는 `src/features/sync-workflow`의 같은 2단계 대화상자와 실행 API를 사용합니다. 첫 단계는 선택 대상, 정책 리소스, 필수 상위 리소스와 포함 사유를 보여줍니다. 변경 없는 대상과 Git 정의가 없어 현재 상태를 유지하는 대상도 명시합니다. 두 번째 단계에서 서버의 검토 token에 묶인 변경 전후와 영향도를 확인하고 최종 적용합니다. 두 독립 실행을 순차 호출하지 않습니다.

정책 기준 Sync는 선택한 정책의 적용 후 리소스를 포함하고 페이지/엔드포인트의 상위 workspace/service를 재귀 포함합니다. 정책에서 제거한 참조와 삭제 정책의 이전 참조는 자동 Sync 대상에 넣지 않습니다. 이 정의 변경은 정책 diff에서 검토합니다. 필수 참조를 만들거나 변경하는 리소스와 정책을 함께 검증하므로 아직 존재하지 않는 신규 리소스도 같은 계획으로 생성할 수 있습니다. 필수 참조가 정의서와 현재 상태 모두에 없거나 삭제 후 참조가 끊기면 전체 계획을 차단합니다.

정책 영향도는 선택 정책 → 부여된 역할 → 직접 사용자·조직 → 조직 멤버로 표시하고 중복 ID를 제외합니다. 만료된 부여는 부여 경로에서 표시하며 실제 접근 판정과 구분합니다. 함께 변경되는 리소스가 다른 정책에도 사용되면 ‘리소스 변경의 추가 영향’에서 그 관계를 확인합니다. 역할·사용자·조직 부여는 Sync로 변경하지 않습니다.

- 첫 단계 조회는 `GET resource-sync/status`와 정책 선택 시 `GET policy-sync/status`를 사용합니다. 두 snapshot의 환경·리전·revision과 리소스 상태는 일치해야 합니다.
- `POST sync-plans/previews`: `{selection,revision,resourceCommit,resourceDigest,policyCommit,policyDigest}`. `selection`은 `{mode:"resources",resources:[{kind,id}],policyIds:[]}` 또는 `{mode:"policies",resources:[{kind,id}],policyIds:[id]}`입니다. 정책 모드의 resources는 빈 배열 또는 함께 선택한 접근 대상 목록입니다. API 서버도 혼합 선택을 허용하고 직접 선택+정책 부여+필수 상위의 합집합을 단일 검토 token/revision으로 검증·적용해야 합니다. 명시적으로 선택한 대상의 포함 사유를 우선하며 중복 적용하지 않습니다. 정책이 없으면 policy commit/digest는 빈 문자열입니다. 응답은 `{data:{token,expiresAt,context:{selection,resource:ResourceSnapshot,policy:PolicySnapshot|null}}}`입니다.
- 서버는 선택 범위와 의존성 포함 범위를 재계산하고 모든 대상의 권한을 검증합니다. token에는 사용자, 환경·리전, 전체 인가 revision, 두 source의 commit/digest, 정확한 대상 및 의존성을 바인딩합니다. UI도 응답 scope, revision, 원본 SHA-256, 만료를 확인합니다. 선택은 종류+ID로 정규화합니다. resources 모드에 policyIds를 넣거나 policies 모드에서 policyIds를 비운 요청은 거부합니다. policies 모드의 resources는 함께 선택할 접근 대상을 허용합니다.
- `POST sync-plans/runs`: `{previewToken,idempotencyKey}` → `{data:ResourceRun}`. **정책과 연관 리소스 전체를 하나의 트랜잭션으로 적용**하고 revision을 한 번 증가시킵니다. 재검증 실패 시 전부 거부합니다. 같은 key의 재시도는 기존 실행을 반환합니다. 이전 전체 Sync API로 대체하지 않습니다.
- `GET sync-plans/runs/{id}`: 같은 DTO로 진행 상황을 반환합니다. queued/running 동안 재적용과 닫기를 잠그며 2초 간격으로 상태를 조회합니다. succeeded만 완료로 표시합니다. 실패 시 새 검토를 시작합니다.
- 리소스별 이력은 실제 변경된 리소스의 before/after를 같은 실행 ID로 기록합니다. 정책 이력에는 `policyIds`와 실제 변경된 `resourceRefs`를 포함합니다. 정책 이력 롤백은 그 범위의 정의만 복원하고 나머지 리소스·정책·현재 부여는 보존하며 최종 참조를 함께 검증합니다. 기존 scope 없는 정책 실행만 이전 전체 정책 복원 의미를 유지합니다.

부분 적용 이후 `appliedCommit`을 전체 config의 적용 완료로 갱신하지 않습니다. 개별 상태는 정의 diff로 판정하고 해당 리소스의 실제 commit/revision은 리소스 이력에서 확인합니다. 검토 이후 source 또는 인가 revision이 바뀌면 409로 다시 검토해야 합니다. 현재 데모는 세션 메모리에서 단일 compare-and-swap을 검증하며 영구 저장·감사·분산 잠금은 Orion API 구현 범위입니다.

### 영향받는 대상 우선 표시

공통 검토의 첫 영향 화면은 사용자·조직·서비스 어카운트별 중복 없는 목록입니다. 대상별로 역할과 정책 요약을 먼저 표시하고 펼치면 직접 부여된 역할 → 정책 → 리소스 경로를 확인합니다. 조직은 별도 대상이며 멤버 사용자로 확장하지 않습니다. 리소스 검토의 단일/다중 선택 범위는 유지하며 정책 Sync는 선택 정책의 역할 관계로만 집계합니다. 서비스 어카운트 역할은 graph.serviceAccounts의 명시적 roleIds를 사용하고 조직 소속으로 추정하지 않습니다. Graph 확장 및 누락 응답 의미는 `docs/authorization-management.md`를 따릅니다.

### 정책을 포함한 변경 관리

LSB의 리소스 그룹은 워크스페이스·페이지·서비스·엔드포인트, 정책, 변경 관리 순서입니다. 역할은 권한 관리 그룹에 둡니다. 정책은 배포/변경 관리 유형이며 정책에 관계할 접근 대상의 ResourceKind는 기존 네 종류를 유지합니다.

변경 관리는 resource-sync/status와 policy-sync/status를 모두 읽고 환경·리전·revision 일치를 확인합니다. 정책과 리소스의 source commit은 각각 표시합니다. 환경 전체 동기화 버튼은 제공하지 않습니다. 각 행의 동기화 또는 명시적으로 선택한 항목만 검토합니다. 리소스 단독 diff의 차단 사유로 정책을 포함한 합동 적용을 미리 차단하지 않으며 공통 preview에서 최종 결합 상태의 참조를 검증합니다.

정책 행의 이력은 `history=policies:id`로 조회하며 run.policyIds에 해당 ID가 있는 실행만 표시합니다. policyIds가 없는 이전 전역 실행은 정책별 이력에서 제외하고 안내합니다. 기존 정책 rollback API는 실행 단위이므로 함께 적용한 정책·리소스 범위를 명시하고 그 실행 범위를 복원합니다. 개별 정책만 복원하는 API로 오인해서는 안 됩니다. 리소스별 이력과 단일 리소스 롤백은 기존 계약을 유지합니다.

### 항목 단위 동기화 진입

동기화의 관리 단위는 종류+ID로 식별하는 리소스 또는 정책입니다. 변경 관리의 각 행에서 상태·diff·이력을 확인하고 해당 항목의 동기화 검토를 엽니다. diff 모달과 리소스 상세에서도 동일한 단일 항목 흐름을 사용합니다. 여러 항목 선택은 이 단위들의 합집합이며 환경 전체 배포로 확대하지 않습니다. 정책의 리소스와 필수 상위 포함 규칙은 유지하고 검토 대상 표에 사유를 표시합니다.

변경 관리 상단은 전체 항목 수와 항목별 Synced/Out of sync 건수만 요약합니다. 환경 공통 revision/commit을 개별 항목의 적용 버전처럼 표시하지 않습니다. 리소스 상세는 해당 항목의 실제 적용 이력을 표시하며 이력이 없으면 없음으로 안내합니다. 서버의 공통 revision은 동시 변경 충돌을 검증하는 snapshot 기준으로 유지합니다. 이번 UI 변경은 기존 preview·apply API나 정책 실행 단위 rollback 계약을 변경하지 않습니다.
