# 관리서비스와 엔드포인트

서비스는 전사 조직이 관리하며 플랫폼에 종속되지 않는다. service.yaml은 기본 정보/관리 조직, endpoints/*.yaml은 service ID와 endpoint 목록을 가진다. 동일 서비스의 여러 파일을 합쳐 식별·참조를 검증한다.

## SVC-01/02 목록·상세

/services에서 신규 YAML 정의와 기존 카탈로그를 탐색한다. /services/{id} 신규 상세는 기본 정보/관리 조직, 엔드포인트 → 관계 → 동기화 이력 → YAML을 제공한다. 서비스의 관리 조직은 scope를 적용받는 호출자 조직과 다르다.

## END-02 상세 /service-endpoints/{service}~{endpoint}

원본 요청/응답 명세를 분리하고 필드명·location/path·타입·required·privacy·공통 masking 참조를 표시한다. 같은 API를 사용하는 Action을 탐색하여 업무별 차이를 확인한다. 단일 서비스 내 snake_case 또는 camelCase를 유지하고 서비스 간 자동 변환하지 않는다.

## MASK-01/02 /masking-rules[/{id}]

공통 규칙 목록/가상 입력 처리 결과/참조 필드와 규칙 상세를 제공한다. email/partial/redact와 옵션을 정의하고 민감정보 로그는 항상 보호한다. 반환 unmask는 로그 마스킹을 해제하지 않는다. 실제 개인정보를 테스트 입력으로 유도하지 않는다.

신규 UI/핵심 파서 구현됨. 운영 API·Gateway 실행기는 미완료. 기존 API 엔드포인트 경로는 호환성을 유지한다. 파일 분리/이동은 식별자를 바꾸지 않으며 적용/이력은 정의 단위다.
