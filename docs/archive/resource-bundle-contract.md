# ResourceBundle / PolicyBundle 호환 계약

이 문서는 `resource-sync`, `policy-sync`, `sync-workflow`에 남아 있는 이전 모델의 호환·이관 참고 자료다. 현재 제품 화면과 신규 YAML/API 구현은 [정의 관리](../definition-management.md)를 따른다. 이전 계약에 맞춘 백엔드가 실제 배포되어 있다는 뜻은 아니다.

## YAML 계약

원본: `config/resources/orion-resources.yaml`. `apiVersion: orion.io/v1alpha1`, `kind: ResourceBundle`이며 metadata로 환경/리전을 고정합니다. 고정 ID는 이름·경로 변경에도 유지합니다. 네 kind는 workspaces, pages, services, service-endpoints입니다. pages.parentId는 workspace ID, service-endpoints.parentId는 service ID입니다. 부모 종류를 함께 검사합니다.

각 present 항목은 전체 필드를 포함하며 빈 필드는 빈 문자열로 표현합니다. 필드 오타, 중복 YAML key, 별칭, 중복 kind/ID, 유효하지 않은 경로/메서드, 환경·리전 불일치를 거부합니다. 비밀키·인증 토큰은 정의서에 넣지 않습니다.

이 형식은 **명시적 변경 카탈로그**입니다. 파일에서 빠진 ID는 보존하고 implicit prune하지 않습니다. 삭제는 해당 ID의 `state: absent`로 선언합니다(나머지 필드는 식별/검토용으로 유지). 삭제에 정책이 있으면 만료 여부와 무관하게 차단합니다. 삭제 이후 살아남는 하위 리소스가 부모를 잃어도 차단합니다. 정책 부여을 몰래 삭제하지 않습니다. 새로운 리소스에 역할/정책 권한은 자동 부여되지 않습니다.

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

## Processor 계약

전처리·후처리는 정책이 허용하는 `service-endpoints`에만 적용합니다. 각 processor는 `endpointId`를 지정하며 해당 ID가 같은 정책의 리소스에 관계되어 있어야 합니다. 서비스에 관계했다고 하위 엔드포인트에 자동 적용하지 않습니다. 워크스페이스·페이지·서비스는 접근 권한만 평가합니다. deny 정책에는 processor를 선언할 수 없습니다.

`pre`의 target은 `request.query` 또는 `request.body`이며 호출 전 파라미터·본문 필드를 변경합니다. `post`는 `response.body`만 지원하며 호출 후 응답 필드 변경·제거·필터링을 수행합니다. 각 배열 순서대로 실행합니다. 처리가 필요 없으면 pre/post를 빈 배열로 선언합니다. 예제 handler와 config는 API 계약 초안이며 실제 HTTP 변환 실행기는 이 웹 앱에 포함되지 않습니다. 서버는 handler별 설정, 필드 경로, 사용자 입력과 신뢰된 identity 값의 구분을 검증해야 하고, required 처리 실패 시 원본 요청·응답을 그대로 통과시키지 않아야 합니다.

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

## 결합 Sync 계획 계약

- 첫 단계 조회는 `GET resource-sync/status`와 정책 선택 시 `GET policy-sync/status`를 사용합니다. 두 snapshot의 환경·리전·revision과 리소스 상태는 일치해야 합니다.
- `POST sync-plans/previews`: `{selection,revision,resourceCommit,resourceDigest,policyCommit,policyDigest}`. `selection`은 `{mode:"resources",resources:[{kind,id}],policyIds:[]}` 또는 `{mode:"policies",resources:[{kind,id}],policyIds:[id]}`입니다. 정책 모드의 resources는 빈 배열 또는 함께 선택한 접근 대상 목록입니다. API 서버도 혼합 선택을 허용하고 직접 선택+정책 부여+필수 상위의 합집합을 단일 검토 token/revision으로 검증·적용해야 합니다. 명시적으로 선택한 대상의 포함 사유를 우선하며 중복 적용하지 않습니다. 정책이 없으면 policy commit/digest는 빈 문자열입니다. 응답은 `{data:{token,expiresAt,context:{selection,resource:ResourceSnapshot,policy:PolicySnapshot|null}}}`입니다.
- 서버는 선택 범위와 의존성 포함 범위를 재계산하고 모든 대상의 권한을 검증합니다. token에는 사용자, 환경·리전, 전체 인가 revision, 두 source의 commit/digest, 정확한 대상 및 의존성을 바인딩합니다. UI도 응답 scope, revision, 원본 SHA-256, 만료를 확인합니다. 선택은 종류+ID로 정규화합니다. resources 모드에 policyIds를 넣거나 policies 모드에서 policyIds를 비운 요청은 거부합니다. policies 모드의 resources는 함께 선택할 접근 대상을 허용합니다.
- `POST sync-plans/runs`: `{previewToken,idempotencyKey}` → `{data:ResourceRun}`. **정책과 연관 리소스 전체를 하나의 트랜잭션으로 적용**하고 revision을 한 번 증가시킵니다. 재검증 실패 시 전부 거부합니다. 같은 key의 재시도는 기존 실행을 반환합니다. 이전 전체 Sync API로 대체하지 않습니다.
- `GET sync-plans/runs/{id}`: 같은 DTO로 진행 상황을 반환합니다. queued/running 동안 재적용과 닫기를 잠그며 2초 간격으로 상태를 조회합니다. succeeded만 완료로 표시합니다. 실패 시 새 검토를 시작합니다.
- 리소스별 이력은 실제 변경된 리소스의 before/after를 같은 실행 ID로 기록합니다. 정책 이력에는 `policyIds`와 실제 변경된 `resourceRefs`를 포함합니다. 정책 이력 롤백은 그 범위의 정의만 복원하고 나머지 리소스·정책·현재 부여는 보존하며 최종 참조를 함께 검증합니다. 기존 scope 없는 정책 실행만 이전 전체 정책 복원 의미를 유지합니다.

부분 적용 이후 `appliedCommit`을 전체 config의 적용 완료로 갱신하지 않습니다. 개별 상태는 정의 diff로 판정하고 해당 리소스의 실제 commit/revision은 리소스 이력에서 확인합니다. 검토 이후 source 또는 인가 revision이 바뀌면 409로 다시 검토해야 합니다. 현재 데모는 세션 메모리에서 단일 compare-and-swap을 검증하며 영구 저장·감사·분산 잠금은 Orion API 구현 범위입니다.

## 이관 시 확인

- 이전 전역 리소스 ID는 현재 부모 범위 복합 ID와 명시적으로 매핑한다. 이름이나 URL로 추측하지 않는다.
- Bundle의 환경·리전·commit/digest와 현재 definitions의 배포·sourceRevision은 별도 계약이다. 필드를 그대로 복사하여 호환된다고 가정하지 않는다.
- 이전 policy processor를 Action 필드·마스킹 계약으로 자동 변환하지 않는다. 기존 처리 규칙 보존 여부를 확인한다.
- 이전 정책 실행 단위 롤백과 현재 항목별 복원을 구분한다. 부여 보존·참조 무결성·동시 변경 검증을 유지한다.
- 파서·계획 모델의 회귀 테스트는 이전 데이터 해석의 근거이며 현재 업무 화면이나 운영 동기화 완료의 근거가 아니다.
