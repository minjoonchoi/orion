# API 데이터와 글로벌 배포

## 런타임 설정

서버 컴포넌트가 repository를 호출하고, 서버 전용 어댑터가 선택된 API에 요청합니다. API URL과 인증 설정은 브라우저 번들에 포함되지 않습니다. 모든 경로는 동적 렌더링하며 GET 응답은 `no-store`입니다. 같은 빌드 산출물에 배포별 환경변수를 주입합니다.

| 변수                       | 의미 / 기본값                                                      |
| -------------------------- | ------------------------------------------------------------------ |
| `ORION_DATA_SOURCE`        | `demo` 또는 `api`; 프로덕션 기본 `api`, 개발 기본 `demo`           |
| `ORION_ENVIRONMENT`        | `production`, `staging` 등 환경 키                                 |
| `ORION_REGION`             | 배포 리전 키; 기본 `local`                                         |
| `ORION_API_ENDPOINTS_JSON` | `{환경:{리전:{baseUrl,loginUrl}}}`                                 |
| `ORION_API_BASE_URL`       | 매핑보다 우선하는 API base URL (예: `https://api.example.test/v1`) |
| `ORION_AUTH_LOGIN_URL`     | 매핑보다 우선하는 Orion OIDC 시작 URL                              |
| `ORION_SESSION_COOKIE`     | API에 전달할 세션 쿠키 이름; 기본 전달 안 함                       |
| `ORION_API_TIMEOUT_MS`     | 100–60000ms, 기본 10000ms                                          |
| `ORION_DEFAULT_LOCALE`     | `ko` 또는 `en`, 기본 `ko`                                          |
| `ORION_TIME_ZONE`          | IANA 시간대, 기본 `Asia/Seoul`                                     |

`.env.example`에 한국·미국 리전과 staging 예제가 있습니다. 미등록 환경/리전으로 API 호스트를 찾지 못하면 실패합니다. API 모드에서는 fixture로 대체하지 않습니다. Production URL은 HTTPS여야 합니다. 호스트·리전은 요청 파라미터로 변경할 수 없습니다.

## 조회 계약 (백엔드 합의 필요)

이 문서는 현재 UI가 요구하는 **제안 DTO 계약**입니다. 실제 Orion 백엔드와의 연동/인증 검증은 아직 수행하지 않았습니다. 백엔드 계약이 다르면 `contracts.ts`와 각 repository의 매핑을 수정합니다.

| 리소스               | 상세 `data` 구조                                            |
| -------------------- | ----------------------------------------------------------- |
| `users`              | `{user, organizations, roles}`                              |
| `organizations`      | `{organization, members, serviceAccounts, services, roles}` |
| `roles`              | `{role, users, organizations, policies}`                    |
| `policies`           | `{policy, services, endpoints, workspaces}`                 |
| `services`           | `{service, endpoints}`                                      |
| `service-endpoints`  | endpoint row                                                |
| `workspaces`         | `{workspace, pages}`                                        |
| `pages`              | page row                                                    |
| `api-keys`           | `{key, approvals}`                                          |
| `approval-templates` | template row                                                |
| `approvals`          | approval row                                                |
| `service-accounts`   | `{account, roles, keys}`                                    |

- `GET {baseUrl}/{resource}?limit=100[&cursor=...]`: `{ "data": [...], "pagination": { "nextCursor": null } }`. 마지막 페이지까지 `nextCursor`를 반환합니다. 상세 배열·count·참조 이름도 API가 제공합니다.
- `GET {baseUrl}/{resource}/{id}`: `{ "data": ... }`. 존재하지 않는 레코드는 HTTP 404.
- `GET {baseUrl}/{resource}/{id}/relationships`: `{ "data": [{ "title": "연결 사용자", "rows": [{ "id": "u-1", "name": "Example", "href": "/users/u-1" }] }] }`. title은 `Accept-Language`에 맞춘 문구 또는 지원되는 한국어 UI 키를 반환합니다. 링크는 지원 리소스의 로컬 상세 경로만 허용됩니다.
- 전체 필드·enum·nullable 정의: `src/lib/api/contracts.ts`. 날짜는 시간대가 포함된 ISO timestamp. 식별자는 관계 링크에서 영문/숫자/`_`/`-`를 지원합니다.
- 스키마는 필수 필드·타입·enum을 검사하고, 정의하지 않은 필드(키 원문 등)는 클라이언트로 전달하지 않습니다. 키는 `displayHint`만 받습니다.
- `Accept-Language: ko|en`, `X-Orion-Region`을 전송합니다. 지정한 세션 쿠키 하나만 전달하며 전체 쿠키/임의 요청 헤더는 전달하지 않습니다. 리다이렉트는 따라가지 않습니다.
- 401은 로그인 화면, 403은 공통 접근 거부 화면으로 이동합니다. 5xx, 타임아웃, 잘못된 JSON/스키마는 일반 오류 화면으로 전달됩니다. 상세 404는 해당 리소스의 not-found UI입니다. 서버 오류 본문은 노출하지 않습니다.

현재 목록은 최대 100페이지의 커서 응답을 모아 기존 검색·필터·정렬·페이지 UI에 공급합니다. 대규모 데이터에서는 서버 검색/정렬/필터 계약과 URL 상태를 연결해야 합니다. 무한 커서 반복과 페이지 상한 초과는 실패합니다. CRUD, Okta 콜백 처리, 실제 권한 판정은 백엔드 작업 범위이며 현재 화면은 조회 기능입니다.

## 인증 배포

로그인 버튼은 해당 배포의 `loginUrl`로 문서 이동합니다. Orion API가 Okta OIDC 요청을 시작해야 합니다. 세션 전달을 사용하는 배포는 UI 서버가 읽을 수 있는 HttpOnly 세션 쿠키를 발급해야 합니다(동일 사이트 역방향 프록시 또는 적절한 쿠키 도메인 설계). API 호스트 전용 쿠키는 UI 서버가 읽을 수 없습니다. 쿠키/CSRF/CORS 정책, OIDC state/nonce와 모든 권한 판정은 백엔드에서 검증합니다.

## i18n

`src/i18n/en.json`이 한국어 원문 키에 대한 영어 카탈로그입니다. 한국어는 원문 키를 사용합니다. `useI18n().t()`(클라이언트), `getT()`(서버)로 새 문구를 렌더링합니다. enum/ID/URL은 번역하지 않습니다. 사용자 입력이나 API의 이름·설명은 원문을 유지합니다. 언어 쿠키 `orion-locale`이 없으면 Accept-Language 우선순위와 배포 기본값을 사용합니다. 전환 시 현재 URL을 새로 로드해 서버 문구와 metadata, html lang까지 일치시킵니다. 날짜는 언어와 배포 시간대를 사용합니다.

## 검증

`npm run check`, `npm run build`, `npm run test:e2e -- --workers=2`, `npm run test:api`. E2E는 명시적으로 demo 모드를 사용합니다. 배포 설정과 HTTP/응답 스키마는 단위 테스트, 언어 전환과 모든 리소스 화면은 브라우저 테스트로 검증합니다. `test:api`는 두 리전의 모의 HTTP API와 같은 Next 빌드를 실행해 실제 요청·렌더링·관계 이동·오류 경로를 검증합니다. 프로덕션 API 스모크 테스트는 백엔드 URL과 세션 구성이 확정된 후 별도로 수행합니다.

역할·정책·리소스 편집 및 로그아웃 API는 [권한 편집 계약](authorization-management.md)을 참고하세요.
