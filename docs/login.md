# Orion 로그인·로그아웃 계약

`/login`은 콘솔 메뉴와 분리된 사내 통합 인증·인가 플랫폼의 로그인 화면입니다. 화면 스타일과 구성은 [공통 화면 명세](screens/00-common.md)를 따릅니다.

## 실행 설정

```sh
# .env.local 또는 Next.js 서버 실행 환경에 실제 Orion API 주소 설정
ORION_AUTH_LOGIN_URL=https://orion-api.example.com/auth/login
```

위 경로는 형식 예시입니다. **실제 백엔드 엔드포인트로 교체해야 합니다.** 서버 실행 시 읽으므로 URL만 변경할 때 프론트엔드를 다시 빌드할 필요는 없습니다. 배포 시 HTTPS를 사용합니다. 환경변수에는 비밀키나 토큰을 넣지 않습니다. 링크 주소는 브라우저에 공개됩니다.

## API 계약

1. 사용자가 `Okta로 로그인`을 누르면 브라우저가 설정된 Orion API에 GET 문서 탐색 요청을 보냅니다.
2. Orion API는 OIDC 요청을 준비하고 `302/303 Location: <Okta 인증 URL>`로 응답합니다.
3. 브라우저가 Okta 화면으로 이동합니다. 콜백 검증과 세션 발급은 Orion API가 처리합니다.

일반 링크로 이동하므로 JavaScript가 없어도 동작합니다. fetch로 302를 따라가는 방식은 페이지를 이동시키지 않으므로 사용하지 않습니다. 로그인 UI는 GET 리다이렉트 응답을 전제로 하며 POST 또는 JSON 인증 URL 응답 방식은 별도 연동이 필요합니다.

## 책임 범위

- 프론트엔드: 로그인 화면, 설정된 API로 문서 이동, 설정 누락/잘못된 URL일 때 비활성 상태.
- Orion API: Okta 설정, state/nonce 및 필요한 PKCE 처리, 콜백·토큰 검증, 세션 쿠키, 인증 후 도착 위치 검증.
- 브라우저에서 OIDC 요청 파라미터나 토큰을 생성·보관하지 않습니다. 로그인 query parameter를 다음 이동 주소로 사용하지 않습니다.
- `/login` 추가 자체가 콘솔 인증 가드는 아닙니다. 운영 세션 조회·플랫폼별 인증 가드는 서버 통합 과제입니다. 로그아웃 UI와 서버 액션 계약은 아래에 정의합니다.
- 설정이 없으면 임의 엔드포인트로 요청하지 않고 로그인 불가 안내를 표시합니다.

## 권한 오류와 로그아웃

일반 조회의 API 403은 공통 `/forbidden` 화면으로 이동하고, 401은 `/login`으로 이동합니다. `/forbidden`은 리다이렉트된 UI 경로이며 HTTP 상태 403 자체를 반환하는 엔드포인트는 아닙니다. 실험적 Next authInterrupts는 사용하지 않습니다. 편집 데이터 조회·저장 중 403은 동일한 AccessDenied 컴포넌트를 표시하고 편집 폼을 숨깁니다. 오류 본문/민감한 진단 정보는 브라우저에 노출하지 않습니다.

상단 로그아웃은 서버 액션에서 `POST {baseUrl}/auth/logout`을 호출합니다. 백엔드는 Orion 세션을 무효화하고 204 또는 `{"status":"signed_out"}`을 반환해야 합니다. 401은 이미 종료된 세션으로 처리합니다. 성공 후 UI 호스트의 지정된 세션 쿠키와 예제 세션을 지우고 `/login`으로 문서 이동합니다. 실패 시 로그아웃 완료로 표시하지 않고 세션을 유지하며 재시도를 제공합니다. 언어 선택은 유지됩니다.

Okta 전역 SSO 세션 종료가 필요하면 백엔드에 별도 RP-initiated logout 계약을 추가해야 합니다. 현재 기능은 Orion 세션 종료입니다. Domain 쿠키를 발급하는 배포에서는 백엔드 세션 무효화가 필수이며, 쿠키 Domain/Path 정리도 배포의 인증 프록시와 일치시켜야 합니다.

## 검증

`npm run check`, `npm run build`, `npm run test:e2e`로 확인합니다. E2E에서는 설정된 Orion API와 IdP를 가로채는 모의 응답으로 GET → 302 → IdP 문서 이동을 검증하며 실제 Okta 계정에 접속하지 않습니다. 실제 로그인 완료는 백엔드와 Okta 설정 후 별도 확인해야 합니다.

참고: [Okta의 서버 웹 앱 리다이렉트 로그인 안내](https://developer.okta.com/docs/guides/sign-into-web-app-redirect/main/).
