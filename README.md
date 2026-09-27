# Orion

사내 백오피스 제품의 통합 인증·인가 플랫폼을 위한 Next.js 기반 프론트엔드입니다.

## 화면 기획과 작업 규칙

전체 메뉴·하위 화면·모달의 최신 기획은 [화면 기획서](docs/screens/README.md)를 참고하세요. 구현 상태와 미완료 항목도 함께 관리합니다. 모든 수정 시 기획서 동시 갱신과 공통 컴포넌트 재사용·추출 원칙은 [AGENTS.md](AGENTS.md)에 정의합니다.

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

| 명령어           | 용도                            |
| ---------------- | ------------------------------- |
| `npm run dev`    | 개발 서버                       |
| `npm run check`  | ESLint, 타입, 포맷, 단위 테스트 |
| `npm run build`  | 프로덕션 빌드                   |
| `npm start`      | 빌드한 앱 실행                  |
| `npm run format` | 코드 포맷 정리                  |

## 구성

- `src/app`: App Router 페이지, 레이아웃, 로딩·오류·404 처리
- `src/components/layout`: 공통 내비게이션과 레이아웃 구성요소
- `src/components/ui`: 여러 기능에서 사용하는 UI
- `src/config`: 메뉴 등 애플리케이션 설정
- `src/features`: 기능별 API, 타입, 컴포넌트의 확장 지점
- `src/lib/api`: 공통 HTTP 클라이언트

Next.js App Router, React, TypeScript strict, CSS, ESLint, Prettier를 사용합니다. 의존성은 package-lock.json으로 고정합니다. Server Component를 기본으로 사용하고 브라우저 상호작용이 있는 구성요소만 Client Component로 작성합니다.

## 현재 범위

5개 그룹, 12개 메뉴에서 플랫폼·사용자·조직·서비스 어카운트, 역할, YAML 리소스 정의, API 키와 결재를 관리합니다. 결재 템플릿은 결재 메뉴의 탭으로 제공합니다. 플랫폼 멤버 추가·사용자 역할 부여, 정의 변경 검토·동기화, 템플릿 편집·결재 작성·승인과 키 후속 처리의 UI·모델·API 어댑터가 있습니다.

역할의 조직·정책 편집 통합과 실제 Okta 인증·서버 인가·영속 저장·AWS Secret 실행은 완료되지 않았습니다. 상세 범위는 [화면 기획서](docs/screens/README.md)와 [미완료 목록](docs/screens/15-gaps-and-decisions.md)을 확인하세요. 예제 모드의 처리 결과는 운영 연동 완료를 뜻하지 않습니다.

## API 연결

조회 화면은 서버의 repository → 검증된 API 응답 계층을 사용합니다. `ORION_DATA_SOURCE=demo`에서는 예제 데이터를, `api`에서는 실제 서버 응답만 사용합니다. 프로덕션 기본값은 `api`이며 설정 누락과 API 오류를 예제 데이터로 대체하지 않습니다.

`.env.example`의 `ORION_ENVIRONMENT`, `ORION_REGION`, `ORION_API_ENDPOINTS_JSON` 또는 `ORION_API_BASE_URL`을 런타임에 설정합니다. 같은 빌드를 여러 리전에 배포할 수 있습니다. [API 계약과 배포 설정](docs/api-deployment.md)을 참고하세요.

한국어·영어는 로그인/상단 언어 선택으로 전환합니다. 선택 쿠키 → 브라우저 언어 → `ORION_DEFAULT_LOCALE` 순서로 결정합니다. API 데이터 원문은 유지하고 UI 문구와 날짜 형식을 번역합니다. 시간대는 `ORION_TIME_ZONE`으로 지정합니다.

## 문서와 검증

[문서 안내](docs/README.md)에서 화면 명세, 도메인·API 계약, UI 가이드와 과거 검증 기록을 찾을 수 있습니다. 로그인 설정은 [인증 안내](docs/login.md), YAML 작성·동기화 계약은 [정의 관리](docs/definition-management.md)를 참고하세요.

- 코드·단위 검사: `npm run check`
- 정의서 검사: `npm run validate:definitions`
- 브라우저 검사: `npm run build`, `npx playwright install chromium`, `npm run test:e2e`
- 모의 API 검사: `npm run test:api`
- 단일 HTML과 저장된 스크린샷: [데모 안내](docs/demo/README.md), `npm run demo:check`

검사 명령을 안내하는 것이 현재 버전의 실행·통과 기록을 뜻하지는 않습니다. `/components`는 공통 UI 검토용이며 실제 사용자 데이터를 저장하지 않습니다.
