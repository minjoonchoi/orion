# 리소스 카탈로그 어댑터

이 디렉터리는 서비스·엔드포인트·워크스페이스·페이지의 기존 카탈로그 타입, fixtures, 조회 repository와 호환 화면을 보유한다. `repository.ts`는 배포 모드에 따라 API 또는 데모 카탈로그를 읽는다.

현재 YAML 정의 화면과 변경 관리(`/resources`)는 [definitions](../definitions)가 소유한다. 새 정의의 참조·동기화·이력 규칙은 [정의 관리 계약](../../../docs/definition-management.md)을 따른다. 이전 Bundle 모델은 [레거시 계약](../../../docs/archive/resource-bundle-contract.md)의 호환 범위로 구분한다.

새 정의 관리 기능을 이 카탈로그에 중복 구현하거나 이전 fixture를 운영 단일 원천으로 사용하지 않는다.
