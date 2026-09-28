# YAML 계약 제품 UI 반영 검증

사용자 반영 지시: 2026-09-28 00:16:59 KST, “이제 yaml 문서화와 제품 반영 작업해”. 기준 검토본 d7c8577. 이후 메뉴·페이지 합의를 제품 UI에 반영했다.

## 반영 범위

정식 YAML 계약 문서와 예제 파일, 전사 조직/조직 관리서비스/도메인 scope·Action·정책/플랫폼 workspace·page 참조, privacy·공통 마스킹·subject.email 규약을 반영했다. 메뉴 6그룹·14항목, 도메인 Action 첫 탭과 정책/엔드포인트/페이지에서의 탐색, 신규 마스킹·Sync 페이지를 추가했다. 서버의 config/contract-v2 YAML 읽기와 초기 정규화 검증을 연결했다. 기존 정의/API/역할 부여/결재 정책 경로는 보존했다.

## 검증

- npm run check: lint/typecheck/format 및 단위 81건 통과.
- npm run build: 프로덕션 빌드 통과.
- npm run test:e2e -- --workers=2: 120건 통과. Next와 승인 HTML 시각 비교 35개 상태 및 신규 탐색/Sync 유지 동작 포함.
- npm run test:api: 기존 API 회귀 12건 통과.
- npm run validate:definitions: 이전 37개 + 신규 17개 정의 통과.
- npm run demo:check: 소스/승인 HTML 일치 및 201개 저장 캡처 무결성 통과.
- 신규 도메인 화면의 모바일 접근성·문서 넘침 검사 통과.

## 적용 근거

workflow status: applied. 승인 HTML SHA-256: 3071091932f9eff588dfc4240252add7e81c6f09b14aa88e209ed9ce3d3e4aa6. 승인과 제품 HTML은 동일하다. 기록: docs/demo/workflow.json. 이미지: docs/demo/screenshots/manifest.json 및 screens.zip.

## 운영 범위

신규 Sync는 메모리 어댑터이며 메뉴 이동 동안 유지되고 새로고침 시 초기화된다. 운영 Git 수집/DB 저장/원자성/서버 권한 검증/Gateway 실행·반영은 미완료다. 신규 정책과 기존 플랫폼 역할 부여 통합 및 구형 YAML 자동 이관은 수행하지 않았다. API 모드의 신규 화면은 연동 필요 상태이며 기존 API 화면은 유지된다. 역할/사용자 영향 데이터를 연결하지 않은 상태에서 0명이나 최종 운영 판정으로 표시하지 않는다.
