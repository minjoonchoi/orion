# 사용자 기능 위치

이 디렉터리는 초기 자리표시자이며 사용자 구현을 소유하지 않는다.

- 사용자 목록·상세 UI: [identity/screens.tsx](../identity/screens.tsx)
- 플랫폼 멤버십·사용자 역할: [platforms](../platforms)
- 카탈로그 조회 어댑터: [identity/repository.ts](../identity/repository.ts)
- 화면 요구: [사용자 명세](../../../docs/screens/02-users.md)

사용자 기능 변경은 위 구현에 반영하고 이 폴더에 별도 API·모델을 중복 생성하지 않는다.
