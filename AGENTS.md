# Orion 작업 규칙

이 파일은 저장소 전체에 적용한다. 최신 사용자 요구를 기준으로 코드, 화면 기획서, API 계약이 서로 일치하도록 작업한다.

## 1. 모든 수정에서 화면 기획서를 함께 최신화

- 작업 시작 시 `docs/screens/README.md`와 관련 메뉴 기획서를 읽고 영향받는 화면 ID를 식별한다. 공통 동작이면 `00-common.md`, 데이터/권한이면 `14-data-and-permissions.md`도 확인한다.
- UI, 업무 규칙, 권한, 상태, 입력/검증, 데이터/API, 경로, 문구 의미가 바뀌면 **같은 변경/PR 안에서** 관련 기획서를 갱신한다. 기능 구현 후 문서 업데이트를 후속 작업으로 미루지 않는다.
- 목록·상세·탭·모달/검토 단계별로 표시 데이터, 행동, 이동, 오류/빈 상태, 권한과 수용 기준을 최신 상태로 유지한다. 신규 메뉴/경로는 목차와 경로 검수표에도 등록한다.
- 구현 상태(M/후속 PR/목표), 기준 commit/PR, 미완료 목록을 실제와 맞춘다. 데모와 API 어댑터 구현을 실제 서버 인증·인가·영속 저장·AWS 적용 완료로 기록하지 않는다.
- 리팩터링/테스트/의존성 변경처럼 사용자 동작이 같아도 관련 기획서를 검토한다. 동작 변경이 없으면 불필요한 요구 변경을 만들지 말고 PR에 검토한 문서와 ‘기획 변경 없음’ 사유를 명시한다.
- 기존 문서와 충돌하는 부분은 최신 합의로 수정하거나 이전 구현 참고 자료임을 표시한다. 전체 화면 코드를 문서에 복제하지 말고 화면 ID, 규칙, 소스 경로로 추적 가능하게 한다.

## 기획서·실제 구현·통합 HTML 동시 최신화

- 기획서의 UI/UX·기능·업무 규칙을 변경할 때는 같은 작업과 PR에서 실제 코드를 구현하고 `docs/demo/orion.html`도 재생성한다. 문서만 바꾸거나 HTML만 별도로 수정하여 동작을 다르게 만들지 않는다.
- 통합 HTML은 실제 `src/app` 페이지, 공통 컴포넌트, 스타일, 업무 모델/명령을 재사용하는 `npm run demo:build`로 생성한다. 화면 JSX·CSS·검증·권한 로직을 HTML 전용으로 복제하지 않는다. `tools/demo`에는 브라우저 라우팅·세션·파일/외부 연동 대체 계층만 둔다.
- 모든 기획서 최신화 이후 `npm run demo:build`와 `npm run demo:check`를 실행하고 생성 HTML을 함께 커밋한다. 코드·기획서·AGENTS·빌드 입력의 해시와 재생성 결과를 검사하여 누락을 CI에서 차단한다. 생성 HTML은 수동 편집하지 않는다.
- 신규 경로는 자동 수집되지만 실제 화면과 HTML 양쪽에서 메뉴·관계 이동·탭·검색·선택·작성·검토·제출을 확인한다. 변경된 주요 흐름의 동작과 UI가 일치하는지 테스트하고 실제 앱과 HTML 스크린샷을 확인한다.
- 제품 화면에는 데모 사용자 선택, 모의 실행 버튼, 예제/데모 배너를 넣지 않는다. 로그인 사용자는 서버 세션에서 결정하고 테스트 사용자는 테스트 픽스처로 주입한다. 운영 코드에 테스트용 사용자 전환 엔드포인트를 추가하지 않는다.
- HTML은 저장소의 비식별 샘플 데이터만 사용하고 외부 네트워크를 호출하지 않는다. 실제 Okta 인증, Orion 서버 인가·영속 저장, AWS Secret 저장은 HTML에서 실행하지 않으며 이 경계는 `docs/demo/README.md`와 결과 전달에 명시한다.
- 미구현 서버 기능을 HTML에서 성공한 운영 기능으로 표시하지 않는다. 요구를 끝낼 수 없는 제약은 기획서와 PR에 명확히 남기고 완료로 보고하지 않는다.

## 2. 모든 변경에서 공통 컴포넌트 우선

- 새 JSX/CSS/동작을 작성하기 전에 `src/components/ui`, `src/components/layout`, `src/features/identity` 및 유사 기능 화면을 검색한다.
- 목록은 `BrowseTable`/`DataTable`/공통 검색·필터·Pagination, 상세는 `DetailTabs`/`Details`, 작업은 `Button`/`Dialog`, 상태는 `Badge`/공통 오류·빈 상태를 우선 재사용한다.
- 기존 컴포넌트로 처리할 수 있으면 variant/props/슬롯 등 최소 확장으로 해결한다. 같은 테이블, 모달 단계, 상태 판정, validation, API 처리 코드를 화면마다 복사하지 않는다.
- 두 개 이상 화면에서 반복되거나 이번 작업에서 반복될 것이 명확한 UI/상호작용은 **새 공통 컴포넌트 또는 공통 훅/모델로 추출**한다. 전역 표현 컴포넌트는 `src/components`, 업무 전용 공유 컴포넌트는 해당 feature의 공통 영역에 둔다.
- 공통 컴포넌트는 이름, props, 상태/접근성 책임과 실제 사용처를 명확히 한다. 단일 특수 화면 때문에 거대한 범용 컴포넌트나 사용하지 않는 추상화를 만들지 않는다.
- 기존 패턴을 재사용하지 않는 경우 기술적/업무적 이유를 PR에 남긴다. 신규 공통 컴포넌트를 만들었다면 사용 가이드 또는 해당 공통 화면 기획에 반영한다.
- 한글/영문 UI, 키보드 조작, 입력 label, 포커스 복귀, 오류/로딩/빈 상태, 모바일 넘침은 재사용 컴포넌트에서도 유지한다. 서버 권한 검증을 클라이언트 컴포넌트로 대체하지 않는다.

## 3. 검증과 결과 전달

- 바뀐 업무 규칙의 경계와 실패 사례를 검증한다. 공통 컴포넌트를 수정하면 실제 소비 화면에 미치는 영향을 확인한다. 의미 없는 구현 복제 테스트나 관련 없는 반복 검증은 추가하지 않는다.
- UI를 변경한 작업은 실제 실행 화면을 캡처하고 사용자에게 스크린샷으로 결과를 보여준다. 생성형 목업이나 이전 화면을 변경 결과처럼 제시하지 않는다.
- 문서만 바뀐 작업은 링크/화면 ID/경로·구현 상태의 일관성을 검사하고 문서와 PR을 제공한다. UI 변경이 없는데 새 UI 결과를 만들어 제시하지 않는다.
- PR에는 문제와 변경 동작, 영향 화면 ID/기획서, 재사용·신규 공통 컴포넌트, 실행한 검증, UI 변경 시 스크린샷, 남은 서버 의존/제약을 기록한다.
- 실제로 실행하지 않은 검사나 미완료 기능을 완료로 기재하지 않는다. 인증 데이터·API 키 원문·실사용 Secret을 스크린샷/문서/로그에 포함하지 않는다.

## 작업 완료 확인

- [ ] 관련 화면 기획서와 현재 구현 상태를 검토·갱신했다.
- [ ] 기존 공통 컴포넌트를 조사해 재사용했으며 필요한 반복 패턴은 공통화했다.
- [ ] 화면·API·권한·오류 상태와 문서가 일치한다.
- [ ] 변경 범위에 맞는 검증을 수행했고 UI 변경이면 실제 스크린샷을 제공했다.
- [ ] 실제 구현과 동일한 통합 HTML을 재생성하고 `demo:check` 및 주요 동작 비교를 통과했다.
- [ ] PR에 문서·컴포넌트·검증·HTML·미완료 사항을 설명했다.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
