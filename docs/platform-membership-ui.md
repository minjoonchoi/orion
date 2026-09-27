# 플랫폼, 사용자와 멤버십

사용자는 전역 카탈로그이며 플랫폼 역할은 사용자에게 부여한다.
멤버십은 플랫폼 가입과 활성/중지 상태만 보유한다. 역할 ID를 보유하지 않는다.
사용자가 여러 플랫폼에 가입해도 각 플랫폼의 역할은 독립적으로 관리한다.
멤버십 생성 전에도 사용자 역할을 준비할 수 있으나, 활성 멤버십 없이는 로그인할 수 없다.

서비스 어카운트는 전역 서버 통신 주체다. API 키로 인증하며 Orion 플랫폼 역할만 부여한다.
Orion 멤버십을 생성하지 않는다. 조직 역할은 해당 플랫폼의 활성 멤버에게 적용하는 전제로 표시한다.

## 화면 명세

화면 구성·작업 진입·수용 기준은 [플랫폼](screens/01-platforms.md), [사용자](screens/02-users.md), [역할](screens/05-roles.md)을 따른다. 이 문서는 멤버십·역할의 데이터 관계와 API 계약을 관리한다.

## API 계약

기존 환경/리전 API transport를 사용한다.
GET /platform-directory → {data: Directory}
POST /platforms/{platformId}/roles/{roleId}/users
POST /platforms/{platformId}/members
요청: {userIds: string[], operation: "add" | "remove", expectedRevision: number}
멤버 API는 add만 지원한다. 배치 변경은 서버에서 원자적으로 처리해야 한다.
응답: {data: Directory}
Directory 스키마는 src/features/platforms/model.ts에 정의한다.
사용자 역할은 userRoles[{userId,platformId,roleIds}], 멤버십은 members에 분리한다.
백엔드는 호출자 권한, 동일 플랫폼 역할 여부, revision 충돌을 원자적으로 검증해야 한다.
API 오류 시 성공으로 표시하지 않는다.

## 구현 범위 및 통합

현재 UI와 API 어댑터, 데모 세션별 역할 변경을 구현했다.
플랫폼 OIDC 설정은 조회 화면이며 실제 Okta 등록/콜백 및 로그인 게이트 구현은 백엔드 책임이다.
기존 authorization/definitions 평가·영향도 데모 모델은 아직 별도 모델이다.
백엔드 연동 시 플랫폼 사용자 역할을 단일 원천으로 통합하고, 기존 전역 역할 API를
플랫폼 범위로 이관해야 한다. 새 UI의 역할 변경을 기존 영향도 평가 엔진에 적용했다고
간주해서는 안 된다. 인증 설정의 example.okta.com은 데모 값이다.
