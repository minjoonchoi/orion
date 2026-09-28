# 독립 정책과 직접 부여 — 제품 UI

상태: 제품 UI 구현됨. 운영 API/DB/Gateway 통합 미완료. 독립 정책과 직접 부여의 현행 계약은 이 문서를 기준으로 한다.

## 소유와 파일

- organizations.yaml: 전사 조직. 플랫폼에 종속되지 않는다.
- masking-rules.yaml: 공통 민감정보 마스킹 메서드·옵션.
- platforms/{id}/platform.yaml: 플랫폼 메타정보. workspace YAML은 플랫폼을 참조한다.
- services/{id}/service.yaml: 관리 조직·서비스 메타정보. endpoints/*.yaml은 N개 파일로 분리 가능.
- domains/{id}.yaml: 한 파일에 도메인 scope와 actions. policies는 제거한다.
- policies/*.yaml: 독립 정책 ID. assignable_to는 role 또는 service_account. effect는 allow/deny.
- 역할·정책 부여, 사용자·조직 역할 부여는 UI/DB 관리이며 YAML 제외.

기존 YAML 필드명/조직·scope 구조를 불필요하게 변경하지 않는다. 이 시안은 기존 singular service/domain/workspace 문서와 독립 policies/platforms 맵을 해석한다. service slug는 현 id와 같으며 Gateway의 경로 접두에 사용한다. 계약 키 표기법과 API 필드 표기법은 별개다. API 요청·응답 필드는 YAML에 적힌 이름을 그대로 유지한다.

```yaml
policies:
  employee-api-reader:
    name: 직원 API 조회
    assignable_to: service_account
    effect: allow
    actions:
      - employee.read-service-employees
  employee-page-reader:
    name: 직원 화면 조회
    assignable_to: role
    effect: allow
    workspaces:
      sales-platform.sales-console:
        pages:
          regional-employees:
            actions:
              - employee.read-regional-employees
```

## 평가

정책 부여 대상 종류와 실행 조건을 혼동하지 않는다. role 정책은 역할에, service_account 정책은 계정에 직접 부여한다. 서비스 어카운트 정책의 workspace/page 구성은 검증 오류다. 역할과 정책의 플랫폼 범위가 불일치하면 부여하지 않는다. 만료는 정책이 아닌 부여 관계에 저장한다.

최상위 actions는 페이지와 무관한 실행 권한이며 화면 접근을 부여하지 않는다. 중첩 actions는 플랫폼/workspace/page/action의 완전한 연결이다. 여러 정책의 허용은 합집합이며 정책을 상속하지 않는다. 다른 페이지에서 얻은 액션과 화면 권한을 조합해 새 연결을 만들지 않는다. 최상위 deny는 해당 인증 범위의 같은 action 전체를 차단하고 중첩 deny는 같은 연결만 차단한다. 액션만 전달되면 남은 유효 연결 하나 이상으로 실행 여부를 평가한다. 실제 어떤 페이지를 열었는지 증명하는 것은 아니다.

현재 시안은 액션이 포함된 페이지 연결을 구현한다. 워크스페이스 전체 또는 액션 없는 페이지 자체의 allow/deny 문법은 아직 지원하지 않으며 빈 구성은 오류 처리한다. 이 범위의 확장은 별도 검토한다.

## Gateway 호출

`POST /gateway/services/employee-api/employees/search`와 `Orion-Action: employee.read-regional-employees`를 함께 전달한다. 인증 정보 외에 임의의 내부 URL/메서드를 전달하지 않는다. 서버는 호출된 서비스/메서드/path와 Action의 엔드포인트 참조를 대조한다. 플랫폼은 검증된 사용자 인증 컨텍스트에서 결정한다. 서비스 어카운트는 사용자 플랫폼 멤버십을 생성하지 않고 계정·키 활성, 서비스 범위, 직접 정책을 확인한다.

요청 허용 목록 적용 → scope와 subject 값 주입 → 내부 호출 → 응답 허용 목록/마스킹 순이다. 서로 다른 액션의 req/res를 합치지 않는다. 필수 주입 속성 또는 조직 코드가 없으면 호출을 거부한다. 서비스용 예제 액션은 사람 이메일을 요구하지 않는다. 응답 unmask는 로그 보호를 해제하지 않는다. 이 시안에는 실제 호출·변환 서버가 없다.

## 화면과 수용 기준

POL-V2-LIST: 독립 정책 목록. 부여 대상 필터, effect, 페이지·액션 수와 부여 대상 수. 권한 수신 사용자 수로 오해하지 않는다.
POL-V2-PAGE / POL-V2-DIRECT: 정책 상세에서 직접 실행/화면별 실행/부여 현황/YAML 탐색. Git 정의를 여기서 직접 편집하지 않는다.
ROL-V2-POLICIES: 역할용 정책만 선택. 추가/해제/만료 → 검토 → 적용. 추가/제거/유지 권한을 집합 비교하고 중복 허용 유지·명시 거부·만료를 반영한다.
SA-V2-POLICIES: 계정에 직접 정책 부여. 필요한 subject 속성이 없는 정책은 적용 전 오류. 기존 역할·키는 별도 이관 탭에서 조회하며 자동 전환하지 않는다.
CHK-V2: 역할 또는 계정을 선택하고 액션 실행 권한과 호출 계약 확인. 실제 멤버십·키 상태 검증 완료로 표시하지 않는다.
기존 사용자 상세/내 접근 권한: 정책 기준 업무 권한을 표시하되 플랫폼 멤버십 미검증을 명시. 샘플 사용자-역할 연결은 usr-001→영업 관리자, usr-002→영업 담당자다.
YAML-DOMAIN: 정책 소유 탭을 관련 정책 참조 탭으로 변경. Action/Scope는 도메인 소유 유지.
YAML-05: 정책에 연결된 역할과 직접 계정의 영향 추가. 권한 유지와 데이터 범위 유지가 같지 않음을 안내. scope·필드·unmask diff도 검토한다.

## 이관 및 한계

기존 API 키 결재가 전용 역할/정책을 생성한다. 이를 삭제·직접 정책으로 자동 변환하지 않는다. 현재 키 상세와 결재 동작은 보존하고 이관 대상으로 명시한다. 운영 이관은 계정+정책+만료 관계와 키 서비스 제한 및 명시 거부를 전후 비교해야 한다. 신규 부여를 기존 키 권한과 자동 합산하지 않는다.

상태는 ConsoleLayout 내 메모리에서 유지되고 새로고침하면 초기화된다. 사용자/조직 전체 영향, 기존 결재 기반 정책 마이그레이션, 운영 서비스 어카운트 속성/조직 컨텍스트, API 권한 강제, 서버 revision/감사 로그/영속 저장은 미완료다. API 모드에는 샘플 신규 부여를 표시하지 않는다.

UI는 BrowseTable/DetailTabs/Button/Dialog/Badge와 공통 간격 토큰을 재사용한다. 선택/검토/적용, 잘못된 부여 대상, source 누락, 모바일 넘침과 저장 화면을 검증한다.

## 엔드포인트·액션 비교 및 API 키 목록

Action 상세는 요청/응답 각각 엔드포인트의 전체 필드를 기준으로 원본 타입·위치·필수 여부와 액션의 전달/주입/제외/마스킹/unmask, 로그 보호를 비교한다. 원본과 적용 후 JSON 형태를 같은 위치에 나란히 표시하며 모바일은 세로 배치한다. 모든 값은 가상 예시이고 scope/subject 값은 실제 호출자가 아닌 표현용 placeholder다. 실제 API를 호출하지 않는다. 제외 필드도 표에서 숨기지 않아 업무별 차이를 확인할 수 있다.

API 키 목록은 기존 카탈로그와 결재 발급 기록을 ID 기준으로 합쳐 한 표에서 조회한다. 같은 ID에는 결재 관리 레코드를 우선한다. 키 데이터·상세 경로를 보존하고 이관 안내를 제품 목록의 별도 영역으로 노출하지 않는다. 버전 등 제공되지 않은 값은 기록 없음으로 표시하며 만들어 채우지 않는다. 과거 결재의 열람 근거가 없는 기록은 기존 상세의 안전한 조회 범위를 유지한다. 데이터베이스 이관 완료를 의미하지 않는다.
