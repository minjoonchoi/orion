# Orion

사내 백오피스 제품의 통합 인증·인가 플랫폼을 위한 Next.js 기반 프론트엔드입니다.

## 시작하기

Node.js 24와 npm을 사용합니다.

```sh
nvm use
npm ci
cp .env.example .env.local
npm run dev
```

http://localhost:3000 에서 확인합니다. 초기 화면은 백엔드 없이 실행됩니다.

## 명령어

| 명령어           | 용도                                      |
| ---------------- | ----------------------------------------- |
| `npm run dev`    | 개발 서버                                 |
| `npm run check`  | ESLint, 타입, 포맷, API 클라이언트 테스트 |
| `npm run build`  | 프로덕션 빌드                             |
| `npm start`      | 빌드한 앱 실행                            |
| `npm run format` | 코드 포맷 정리                            |

## 구성

- `src/app`: App Router 페이지, 레이아웃, 로딩·오류·404 처리
- `src/components/layout`: 공통 내비게이션과 레이아웃 구성요소
- `src/components/ui`: 여러 기능에서 사용하는 UI
- `src/config`: 메뉴 등 애플리케이션 설정
- `src/features`: 기능별 API, 타입, 컴포넌트의 확장 지점
- `src/lib/api`: 공통 HTTP 클라이언트

Next.js App Router, React, TypeScript strict, CSS, ESLint, Prettier를 사용합니다. 의존성은 package-lock.json으로 고정합니다. Server Component를 기본으로 사용하고 브라우저 상호작용이 있는 구성요소만 Client Component로 작성합니다.

## 초기 범위

LSB는 사용자·조직, 역할·정책, 리소스, API 접근, 결재의 5개 그룹과 12개 목록 메뉴로 구성합니다. [메뉴 경로와 구현 범위](docs/navigation.md)를 참고하세요. 사용자·조직, 역할·정책, 리소스, API 접근, 결재 그룹은 예제 데이터 기반 목록·상세 조회를 제공합니다. API 키 상세에서는 결재 이력도 조회합니다. 서버 CRUD와 실제 권한 판정은 포함하지 않습니다. `/login`에서 Orion API를 통한 Okta 로그인 시작 화면을 제공합니다. `/components`에는 메모리 예제로 동작하는 공통 컴포넌트 확인 화면이 있습니다.

## API 연결

조회 화면은 서버의 repository → 검증된 API 응답 계층을 사용합니다. `ORION_DATA_SOURCE=demo`에서는 예제 데이터를, `api`에서는 실제 서버 응답만 사용합니다. 프로덕션 기본값은 `api`이며 설정 누락과 API 오류를 예제 데이터로 대체하지 않습니다.

`.env.example`의 `ORION_ENVIRONMENT`, `ORION_REGION`, `ORION_API_ENDPOINTS_JSON` 또는 `ORION_API_BASE_URL`을 런타임에 설정합니다. 같은 빌드를 여러 리전에 배포할 수 있습니다. [API 계약과 배포 설정](docs/api-deployment.md)을 참고하세요.

한국어·영어는 로그인/상단 언어 선택으로 전환합니다. 선택 쿠키 → 브라우저 언어 → `ORION_DEFAULT_LOCALE` 순서로 결정합니다. API 데이터 원문은 유지하고 UI 문구와 날짜 형식을 번역합니다. 시간대는 `ORION_TIME_ZONE`으로 지정합니다.

## 다음 구현 단계

1. 인증 제공자, 세션 및 CSRF 정책 확정
2. 사용자·역할·리소스·권한 API 계약 확정
3. 기능별 조회/변경 UI 및 응답 검증 구현
4. 실제 권한 정책을 반영한 통합 테스트

## 백오피스 컴포넌트

[조사 결과와 사용 가이드](docs/backoffice-components.md)를 참고하세요. `/components`에서 목록·폼·모달·알림·권한 매트릭스를 확인할 수 있습니다. 브라우저 테스트는 `npm run build`, `npx playwright install chromium`, `npm run test:e2e` 순서로 실행합니다.

## 로그인 화면

`/login`에서 독립된 로그인 UI를 확인합니다. 서버 환경변수 `ORION_AUTH_LOGIN_URL`에 Okta로 리다이렉트하는 실제 Orion API의 절대 URL을 설정하세요. [로그인 API 계약과 설정](docs/login.md)을 참고하세요.
