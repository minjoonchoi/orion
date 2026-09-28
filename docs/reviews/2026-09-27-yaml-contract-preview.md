# YAML 계약 UI 검토본

상태: HTML 검토 단계. 사용자 확정 전이며 제품 적용/PR 없음.

- 스펙: prototype/overrides/docs/screens/18-yaml-gitops-contract.md
- 실행 예제: prototype/overrides/config/contract-v2/
- 진입: preview.html의 변경 관리 → 정의와 실행 계약 (/definition-contract)
- 검토 소스: prototype/overrides/src/features/definition-contract/
- 새 화면: YAML-01~06, Action/Scope/Masking/Sync/검토/결과/전체 정의 7개 기본 상태. manifest에는 기존 및 상세 상태를 포함한 163개 캡처.

검증: 모델 테스트 11건 통과. 시안 소스를 덮어쓴 임시 작업 공간의 TypeScript 검사 통과. 신규 소스/검증 스크립트 ESLint 경고 0. 실제 HTML에서 Action 선택, Sync 취소, 확인 전 적용 비활성, 코드 전후 비교, 적용 후 조회/이력 갱신과 Gateway 대기, 잘못된 이메일 가림, 한영 모바일 넘침을 확인했다. 상세 실행 기록과 HTML 해시는 docs/demo/contract-review/validation.json. screenshot manifest 무결성 확인 통과.

범위: 새 계약을 검토할 통합 화면을 기존 정의 화면에서 연결했다. 기존 메뉴·API·권한 모델 전체 이관은 하지 않았다. UI Sync는 메모리 snapshot을 변경하며 운영 DB에 쓰지 않는다. Gateway 상태의 실제 조회/배포, Git 수집, 운영 스키마 전체 검증, 역할·사용자 영향 조회는 후속 구현이다. 역할/사용자 영향은 확인 불가로 표시하고 0으로 집계하지 않는다. 리뷰에서 사용한 모든 데이터와 이메일은 합성 예제다.

기존 적용 완료 override는 이전 git 이력에 남아 있으며 새 proposal 시작 시 정리했다. approved.html과 제품 src/config/docs/screens는 변경하지 않았다.
