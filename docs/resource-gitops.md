# 리소스 GitOps 동기화

## 구현 범위

`/resource-sync`는 Git/Cloud Config 후보와 DB revision을 비교하고, Sync → 영향도 검토 → 최종 적용 → 실행 상태 확인을 제공합니다. 리소스 상세의 직접 수정과 기존 resource 변경 액션은 비활성화했습니다. 역할·정책 부여는 기존 관리 UI를 유지합니다.

현재 repository는 Next.js 프런트엔드입니다. API 모드는 아래 Orion API 계약을 호출하며, Cloud Config Server, Argo 설치·설정, DB importer/트랜잭션은 별도 백엔드 구현이 필요합니다. 예제 모드는 실제 YAML 파일을 파싱해 세션별 메모리 DB에 원자 적용하고 리소스 목록·상세에 투영합니다. 예제 Git commit과 Argo 상태는 시뮬레이션이며 실제 외부 동기화를 주장하지 않습니다.

## YAML 계약

원본: `config/resources/orion-resources.yaml`. `apiVersion: orion.io/v1alpha1`, `kind: ResourceBundle`이며 metadata로 환경/리전을 고정합니다. 고정 ID는 이름·경로 변경에도 유지합니다. 네 kind는 workspaces, pages, services, service-endpoints입니다. pages.parentId는 workspace ID, service-endpoints.parentId는 service ID입니다. 부모 종류를 함께 검사합니다.

각 present 항목은 전체 필드를 포함하며 빈 필드는 빈 문자열로 표현합니다. 필드 오타, 중복 YAML key, 별칭, 중복 kind/ID, 유효하지 않은 경로/메서드, 환경·리전 불일치를 거부합니다. 비밀키·인증 토큰은 정의서에 넣지 않습니다.

이 형식은 **명시적 변경 카탈로그**입니다. 파일에서 빠진 ID는 보존하고 implicit prune하지 않습니다. 삭제는 해당 ID의 `state: absent`로 선언합니다(나머지 필드는 식별/검토용으로 유지). 삭제에 연결 정책이 있으면 만료 여부와 무관하게 차단합니다. 삭제 이후 살아남는 하위 리소스가 부모를 잃어도 차단합니다. 정책 연결을 몰래 삭제하지 않습니다. 새로운 리소스에 역할/정책 권한은 자동 부여되지 않습니다. 변경 없는 항목을 제외한 후보 전체를 하나의 트랜잭션으로 적용하며 부분 선택은 제공하지 않습니다.

## merge와 수동 Sync

1. PR에서 YAML/schema/참조 검증. CI가 같은 파일을 `deploy/resource-catalog/resources.yaml`로 복사하고 동일성 검사 후 merge합니다. 두 사본을 수동으로 따로 편집하지 않습니다.
2. Cloud Config는 merge된 commit SHA의 원본 파일을 준비합니다. Spring Cloud Config를 쓴다면 plain-text endpoint `/{application}/{profile}/{label}/{path}`와 label=불변 commit SHA를 사용합니다. 서버 구현체가 다르더라도 adapter는 동일한 snapshot DTO를 반환합니다. 파일 읽기가 DB 자동 변경으로 이어져서는 안 됩니다.
3. Orion이 현재 환경·리전 DB revision 및 applied commit, 후보 SHA, 원본 바이트 SHA-256, Argo Auto Sync 상태, config 준비 상태를 제공합니다.
4. Preview API가 read/sync 권한, scope, 참조, 삭제 차단, 사용자 영향 경로를 재계산하고 후보·DB·인가 그래프 revision을 고정한 단기 token을 발급합니다.
5. 최종 Sync는 token을 소비해 idempotent run을 생성합니다. 실행자는 검토한 SHA를 명시하여 Argo sync를 요청합니다. 최신 main을 무조건 적용하지 않습니다. Argo RBAC/sync window도 준수해야 합니다.
6. Argo가 ConfigMap 다음 Sync hook Job을 실행합니다. importer API는 요청 YAML 해시와 scope에 일치하는 **승인된 미완료 run**을 요구합니다. hook 자체의 서비스 credential은 승인 대체 수단이 아닙니다. importer는 Cloud Config/Git 고정 SHA의 원본을 재조회/검증하고 임의 payload를 신뢰하지 않습니다.
7. DB와 인가 그래프 revision을 다시 검사한 뒤 전체 변경, 적용 commit/digest, 감사 로그를 단일 트랜잭션으로 저장합니다. 성공 receipt를 run에 기록하고 Job 응답을 종료합니다. 동일 run 재실행은 기존 결과를 반환합니다. 승인 없이 Argo UI에서 수동 sync해도 DB는 변경하지 않습니다.
8. UI는 run을 조회합니다. `queued`/`running`은 완료가 아니며 DB receipt가 확인된 `succeeded`만 적용 완료입니다. Argo 실패/timeout은 `failed`, DB 미반영 상태로 노출합니다. DB 성공 후 Argo 상태 갱신 실패는 receipt 우선으로 정합성을 복구합니다.

Argo Application 템플릿은 `automated.enabled: false`입니다. ApplicationSet 관리 시 해당 template에서도 비활성화해야 합니다. 이 저장소의 manifests는 **통합용 템플릿**이며 repo/project/namespace/internal URL/Secret/image digest를 운영값으로 고정한 후 적용해야 합니다. Cloud Config 동기화와 Kubernetes sync, DB import는 서로 다른 단계입니다. 앱의 refresh나 config webhook으로 DB에 자동 적용하지 않습니다.

## API 계약

모든 응답 `{data: ...}`. 기존 서버 런타임 환경/리전 API base URL, locale, 지정 세션 쿠키 전달을 재사용합니다. 브라우저가 Cloud Config·Argo credential/host를 받지 않습니다.

- `GET resource-sync/status`: `Snapshot` (`src/features/resource-sync/model.ts`). graph.resources의 parentId는 페이지/엔드포인트에서 필수. dbRevision은 graph.revision과 같아야 합니다. yaml은 scope에 해당하는 완전한 후보 파일, digest는 실제 파일 바이트 SHA-256, commit은 merge 확인된 SHA. API는 권한 밖 사용자/정책 데이터를 노출하지 않아야 합니다. 불완전한 graph를 잘라 반환하지 말고 요청을 거부하거나 완전한 서버 계산 영향도를 제공해야 합니다.
- `POST resource-sync/previews`: `{commit,digest,expectedDbRevision}` → `{token,expiresAt,snapshot}`. 서버는 클라이언트 diff/영향도를 신뢰하지 않고 다시 검증합니다. token은 사용자·환경·리전·원본 SHA·digest·DB/인가 revision·만료·삭제 계획을 바인딩합니다. 기본 5분. 후보/인가/DB 변경 시 409.
- `POST resource-sync/runs`: `{previewToken,idempotencyKey}` → `{id,status,phase,message,commit,dbRevision}`. status: queued/running/succeeded/failed. 동일 key와 요청은 기존 run 반환. 미리보기 유효성/권한/수동 정책을 최종 재검사합니다.
- `GET resource-sync/runs/{id}`: 동일 run DTO. 소유 사용자/권한 및 scope 검사. UI polling은 2초, 실패는 재시도 안내, 새로고침으로 status 확인 가능.
- `POST internal/resource-sync/import`: Argo hook 전용. 서비스 인증 + pending approval + 서버 원본·digest·scope 검증 + revision CAS + DB 트랜잭션. 공개 사용자 엔드포인트가 아닙니다.

401 재로그인, 403 권한 없음, 409 충돌/재검토, 422 정의서/참조 검증 실패. 클라이언트 성공 응답은 Argo 성공만으로 만들어서는 안 됩니다. 취소/롤백은 새 YAML commit에 대한 동일 검토 흐름을 사용합니다. 후보 변경 중 실행은 allow하지 않고 scope별 동시 run 하나만 허용합니다.

## 검증/제약

모델 단위 테스트: YAML 오류, 명시적 삭제, 부모/정책 차단, 원자 적용. 브라우저 테스트: diff, 검토 확인, 적용 완료, DB revision/목록 갱신. 실서버 E2E는 API·Cloud Config·Argo·DB가 준비된 배포에서 추가해야 합니다. DB business constraints(다른 테이블 FK, 라우팅 충돌, 중복 경로 등)는 importer의 최종 검증 책임입니다.

공식 자료:

- https://argo-cd.readthedocs.io/en/stable/user-guide/auto_sync/
- https://docs.spring.io/spring-cloud-config/reference/server/serving-plain-text.html
- https://docs.spring.io/spring-cloud-config/reference/server/environment-repository/git-backend.html

## 통합 리소스 관리

`/resources`에서 현재 DB 리소스와 변경 사항 탭을 제공합니다. type 쿼리로 유형을 필터링하고 resource 쿼리로 특정 diff에 접근합니다. 기존 유형별 목록 주소는 필터로 이동하며 상세 주소는 유지합니다. 필터는 조회 전용으로 Sync는 후보 전체를 적용합니다.

`GET resource-sync/runs` → `{data: Run[]}`는 현재 배포 환경·리전에서 조회 권한이 있는 실행을 최신순으로 반환합니다. Run에는 선택적 ISO `completedAt`을 추가했습니다. API 서버는 scope와 권한을 검증해야 하며 이력은 영속 저장해야 합니다. 예제 이력은 세션 메모리에서만 유지됩니다. 상세 화면의 commit은 개별 리소스 최종 수정 commit이 아닌 배포 기준 버전입니다. API가 완료 시간을 반환하지 않으면 추측하지 않고 생략합니다.
