# 스크린샷 저장 형식 개선

제품 UI/기획 변경 없음. API 전송 한도에 맞춰 ZIP을 7,500,000바이트 단위로 무손실 분할 보관한다. 임시 GitHub Actions나 추가 쓰기 권한을 사용하지 않는다.

- 제품/승인 HTML은 기존 파일과 바이트 단위 동일하다.
- ZIP 원본·PNG 원본·manifest의 HTML/PNG/ZIP 해시는 보존했다.
- 캡처 스크립트에 복원 진입이 추가되어 manifest의 capture 해시만 갱신했다. 새 화면을 촬영한 것으로 기록하지 않는다.
- 순차 part 이름·결합 ZIP SHA-256·추출 PNG 해시를 검사한다. 누락/손상은 캐시가 있어도 실패하며 구형 단일 ZIP도 읽는다.
- round-trip, 누락 part, 손상 part, 구형 ZIP 호환 검사 통과.
- 새로운 worktree에서 저장된 PNG 복원 및 npm run demo:check 통과(232개 화면).
- 검토 문서: docs/screens/00-common.md. 화면 구조·기능은 동일하며 추가 시안 승인 대상이 아닌 캡처 저장 도구 유지보수다.
