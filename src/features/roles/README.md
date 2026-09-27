# 역할 기능 위치

이 디렉터리는 초기 자리표시자다. 역할 종류에 따라 구현 책임이 나뉜다.

- 플랫폼 역할 조회·사용자 부여: [platforms](../platforms)
- 결재 관리 전용 역할 조회: [approval-workflow](../approval-workflow)
- 기존 권한 그래프·영향도·관계 변경 모델: [authorization](../authorization)
- 화면별 구현 상태와 조직·정책 편집 통합 과제: [역할 명세](../../../docs/screens/05-roles.md)

기존 모델의 변경 기능을 현재 화면에서도 제공하는 것으로 간주하지 않는다.
