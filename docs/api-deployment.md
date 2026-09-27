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

## 기능별 계약

| 데이터/명령                        | 계약                                          |
| ---------------------------------- | --------------------------------------------- |
| 카탈로그 및 레거시 메타데이터 조회 | [카탈로그 API](catalog-api.md)                |
| 플랫폼·사용자 역할·멤버십          | [플랫폼 directory](platform-membership-ui.md) |
| 권한 그래프·영향도                 | [권한 그래프](authorization-management.md)    |
| YAML 정의·검토·적용·평가           | [정의 관리](definition-management.md)         |
| 결재·템플릿·API 키 수명주기        | [결재 workflow](approval-key-workflow.md)     |
| 로그인·로그아웃                    | [인증 계약](login.md)                         |

UI와 API 어댑터가 요구하는 계약이며 실제 운영 백엔드와의 연동 완료를 의미하지 않는다. 각 read model의 통합 여부는 [미완료 목록](screens/15-gaps-and-decisions.md)을 따른다.

## 인증 배포

로그인 버튼은 해당 배포의 `loginUrl`로 문서 이동합니다. Orion API가 Okta OIDC 요청을 시작해야 합니다. 세션 전달을 사용하는 배포는 UI 서버가 읽을 수 있는 HttpOnly 세션 쿠키를 발급해야 합니다(동일 사이트 역방향 프록시 또는 적절한 쿠키 도메인 설계). API 호스트 전용 쿠키는 UI 서버가 읽을 수 없습니다. 쿠키/CSRF/CORS 정책, OIDC state/nonce와 모든 권한 판정은 백엔드에서 검증합니다.

## i18n

`src/i18n/en.json`이 한국어 원문 키에 대한 영어 카탈로그입니다. 한국어는 원문 키를 사용합니다. `useI18n().t()`(클라이언트), `getT()`(서버)로 새 문구를 렌더링합니다. enum/ID/URL은 번역하지 않습니다. 사용자 입력이나 API의 이름·설명은 원문을 유지합니다. 언어 쿠키 `orion-locale`이 없으면 Accept-Language 우선순위와 배포 기본값을 사용합니다. 전환 시 현재 URL을 새로 로드해 서버 문구와 metadata, html lang까지 일치시킵니다. 날짜는 언어와 배포 시간대를 사용합니다.

## 검증

`npm run check`, `npm run build`, `npm run test:e2e -- --workers=2`, `npm run test:api`. E2E는 명시적으로 demo 모드를 사용합니다. 배포 설정과 HTTP/응답 스키마는 단위 테스트, 언어 전환과 모든 리소스 화면은 브라우저 테스트로 검증합니다. `test:api`는 두 리전의 모의 HTTP API와 같은 Next 빌드를 실행해 실제 요청·렌더링·관계 이동·오류 경로를 검증합니다. 프로덕션 API 스모크 테스트는 백엔드 URL과 세션 구성이 확정된 후 별도로 수행합니다.
