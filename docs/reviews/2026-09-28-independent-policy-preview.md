# 독립 정책·서비스 어카운트 직접 부여 시안 검증

기준 제품: ff29045. 사용자 요청: 2026-09-28 10:41 KST, 검토하고 화면 변경까지 진행. 현재 상태는 HTML 검토이며 제품 적용이나 새 시안 승인으로 기록하지 않는다.

## 구현 범위

prototype/overrides의 독립 policies/platforms YAML, policy parser·참조 검증, 대상 종류별 부여와 만료, 직접 실행/화면별 실행, 권한 합산·거부·유지 계산. 정책 메뉴/목록/상세, 검토용 영업 역할 2개, 서비스 어카운트 직접 부여 탭, 접근 확인, 관련 도메인 정책, 사용자 업무 권한, Sync 부여 영향과 Gateway 호출 계약. 기존 키/결재 역할은 이관 대상으로 보존했다.

## 검증 결과

- 오버레이 전체 TypeScript 검사 통과.
- 오버레이 소스 ESLint 통과.
- scripts/policy-draft-tests.mjs: 12개 정책 검증 통과.
- scripts/policy-draft-browser.mjs: 정책 탐색, 중복 허용 유지, 검토/적용, 서비스 어카운트 대상 필터, 주입 속성 누락 차단, 한/영 모바일 가로 넘침, 심각/치명적 axe 접근성 위반 없음, 런타임 오류 없음.
- npm run demo:preview: 53개 경로를 포함하는 HTML, 화면 상태 222개 저장.
- node scripts/demo-screens.mjs --preview --check 통과.
- git diff --check 통과. 제품 src/config/docs/screens 변경 없음.

HTML SHA-256: 42b0bcb834bcc98ab5c7a9b65558881f838eeaa6135e003b552a519997959c2b
기획: prototype/overrides/docs/screens/19-independent-policies.md
화면: docs/demo/preview.html, docs/demo/preview-screenshots/screens.zip, docs/demo/policy-review/manifest.json

## 한계와 후속 작업

신규 부여 상태는 메모리이며 새로고침 시 초기화된다. 일부 기존 역할은 이전 계약을 유지하고 신규 예제 역할로 분리해 검토한다. 사용자 샘플 역할 연결은 고정이며 조직 역할 합성과 운영 멤버십은 미통합이다. API 모드에서는 새 정책 부여를 서버 저장하지 않는다. 실제 DB/Gateway 권한 강제·변환, API 키/결재의 자동 이관, 전체 사용자 영향 집계는 미완료다. 페이지 자체 또는 워크스페이스 전체의 독립 allow/deny는 이 시안의 문법에 포함되지 않는다.

AGENTS.md의 HTML 우선 검토 규칙에 따라 새 시안 확정 후 제품 적용·동등성 검사·PR을 진행한다. 이전 PR 게시 시도는 이번 시안 승인으로 사용하지 않는다.

## 다중 선택 행 클릭 보완

공통 selectableRowProps는 기존 체크박스 클릭으로 위임한다. DataTable selection, 엔드포인트 선택(공통 selection으로 전환), 정의·리소스 목록과 신규 GitOps 변경 표에 적용했다. 링크/버튼/입력/라벨/편집 영역, 텍스트 드래그, 비활성 체크박스는 행 선택을 변경하지 않는다. 키보드는 기존 체크박스 Tab/Space를 유지한다.

오버레이 TypeScript·ESLint 통과. scripts/row-selection-browser.mjs에서 행 선택/해제, 체크박스 단일 토글, 헤더 부분 선택, Space, 비활성 행, 텍스트 선택, 링크 이동, 네이티브 Sync 표, 비선택 표를 검증했다. HTML과 222개 상태 캡처를 재생성했다. 현재 검토 해시는 docs/demo/workflow.json과 policy-review/manifest.json을 따른다.

## 액션 비교·운영 메뉴·간격 보완

- 액션에 endpoint 전체 필드와 적용 후 요청/응답 비교, 가상 JSON 형태, 주입/제외/마스킹/unmask 및 로그 규칙을 표시했다.
- API 키 목록을 ID 기준으로 통합하고 이관 전용 영역을 제거했다. 기존 상세 경로와 미확인 메타정보 구분은 유지한다.
- 정책 목록에서 API 키 결재 관리 정책 영역을 제거하고 접근 확인 그룹을 설정·운영으로 정리했다.
- 26개 펼침 영역에 공통 본문 배치를 적용했다. 카드 내부 field-gap과 외부 section-gap을 구분하고 나란한 비교 영역 정렬을 보정했다.
- 권한 신청은 결재 기반 일원화 계약을 기획서에 반영했다. 실제 결재 문서 생성·승인 후 부여 연동은 이번 UI 보완에서 구현하지 않았으며 신청 화면에 명시했다.

TypeScript/ESLint 통과. action-layout-browser: 요청 주입/제외, 응답 마스킹/unmask, 로그 보호 표시, 키 통합 목록, 정책 영역 제거, 설정·운영 메뉴, 데스크톱/모바일 24px 간격과 가로 넘침 검사 통과. 기존 정책·행 선택 브라우저 시나리오 재검증 통과. 최종 223개 상태 캡처와 해시 무결성 통과. 새 시안 HTML SHA-256: 66346b18d974f66b06cf4f44f33a27609fac46bf7aa537f920496b726f27fdd3. 실제 서버 API 호출 결과가 아닌 YAML 정의 기반 예시다.
