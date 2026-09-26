# 2026-09-26 CI 회귀 검증 정리

## 원인

PR #18과 #19의 최초 Frontend CI는 lint/typecheck/format/unit/build를 통과했으나 E2E에서 각각 13건 실패했다. 플랫폼 개편 전 사용자 상세의 역할 편집기, 이전 표·탭 이름과 이동 경로를 참조하는 테스트가 공통으로 남아 있었다. E2E 실패로 API suite는 실행되지 않았다.

## 변경과 검증 범위

- 최신 역할 상세의 사용자 선택 → 정책 요약 검토 → 추가/해제를 공통 `tests/e2e/role-helpers.ts`로 재사용한다. 멤버십 불변, 다른 플랫폼 역할 보존, 로그아웃 쿠키 제거도 검증한다.
- 플랫폼 역할 표의 검색·플랫폼 필터·정렬·페이지 이동, 관계별 탭 URL, 서비스 어카운트 빈 표의 영역을 정확히 지정한다.
- Sync 충돌은 같은 정의 저장소에 대한 두 브라우저 페이지의 실제 동시 Sync로 검증한다. 아직 별개인 directory 역할 저장소가 definitions revision을 바꾼다고 가정하지 않는다.
- 영향도는 현재 공개된 정책 Sync 화면에서 서비스 어카운트 → 역할 → 정책 → Action 경로, 접기, 조직원 미전개를 검증한다.
- API 모의 서버에 `platform-directory`와 플랫폼 역할 사용자 POST 계약을 추가한다. 성공 후 재조회, 409/403 실패 후 미변경, 조회 권한 거부/잘못된 응답, 지역·언어·세션 전달을 검증한다.
- 조직 부여와 정책 만료 편집의 최신 역할 화면 통합은 미완료다. 오래된 진입점의 E2E를 완료 증거로 사용하지 않는다. 기존 `authorization/model.test.ts`, `subject-impact.test.ts`의 만료/해제/영향 경로 단위 검증은 유지한다.

## 기획 및 공통 UI

기획 변경 없음: USR-02, ROL-01~05, CHG-02~03, COM-04의 최신 동작에 테스트를 맞춘다. 기획서 PR의 GAP-02~04(저장소·영향도·편집기 통합)는 계속 남아 있다. 제품의 공통 BrowseTable, DetailTabs, Dialog는 그대로 사용한다. 테스트 helper만 공통화하며 CI 단계를 제거하거나 skip/timeout 확대로 실패를 숨기지 않는다.

PR #18에서는 결재 목록의 표시 제목에 포함된 `·`가 검색 대상 문자열에서 누락된 실제 오류도 수정했다. 공통 Documents 표에서 제목 생성 함수를 검색과 표시가 함께 재사용한다. 목록 및 템플릿 상세의 결재 탭 모두 동일하게 적용된다. 발급/승인/열람 권한 규칙은 바뀌지 않는다.

## 이 브랜치의 로컬 검증 결과

`npm run check`(lint/typecheck/format 및 단위 69건), production webpack build, 전체 E2E 71건, 전체 API 9건 통과. E2E는 Chromium 2 workers, API는 1 worker로 실행했다. GitHub CI는 푸시 후 별도로 확인한다.

실제 제목 전체 검색 결과: [스크린샷](screenshots/approval-title-search.png).
