# 화면 공통 데이터·권한 정의

## 객체와 소유 범위

| 객체                | 식별/소유                                    | 역할                                                      |
| ------------------- | -------------------------------------------- | --------------------------------------------------------- |
| 사용자              | 전역 ID                                      | 닉네임·이메일·재직 상태, 플랫폼 역할 수신자               |
| 플랫폼              | 플랫폼 ID                                    | OIDC 인증 문맥, 멤버십·워크스페이스·역할 범위             |
| 플랫폼 멤버         | 플랫폼 + 멤버 ID / 플랫폼 + 사용자 중복 불가 | 가입·활성 상태. 역할 ID를 별도로 보유하지 않음            |
| 조직                | 전역 카탈로그                                | 소속, 조직장/상위 조직, 서비스 관리, 결재선·열람자        |
| 서비스 어카운트     | 전역 ID                                      | 서버 통신 주체, Orion 역할 수신자                         |
| 역할                | 플랫폼 소속                                  | 정책 묶음을 사용자·조직 또는 Orion 서비스 어카운트에 부여 |
| 역할-정책 관계      | 역할 + 정책                                  | 만료 시각을 보유. 정책 자체의 만료가 아님                 |
| workspace/page      | workspace + page                             | UI 공간과 화면·사용 Action 참조                           |
| service/endpoint    | service + endpoint                           | HTTP 명세 및 request/response field 정의                  |
| domain/Action       | domain + Action                              | 단일 endpoint를 사용하는 업무 행위                        |
| YAML 정책           | policy ID                                    | optional page, 명시적 Action과 응답 규칙                  |
| 결재 관리 정책·역할 | API 키 관리 ID에 종속                        | 승인된 endpoint 범위와 서비스 어카운트 부여               |
| 결재 템플릿         | template ID + version                        | 유형·필드·결재선·후속 처리 계약                           |
| 결재                | document ID                                  | 요청 당시 템플릿·입력·라인·담당 조직 스냅샷과 처리 이력   |
| 열람자              | document + kind(user/organization) + ID      | 단일 문서 조회 권한 원천                                  |
| API 키 관리 항목    | account + service의 안정된 관리 ID           | 저장 위치·정책/역할 재사용, 발급/교체/폐기 이력           |
| 키 버전             | 관리 ID + version                            | 성공 hash와 근거 결재·실행 결과. 원문 보관 안 함          |

역할은 현 스키마에서 전역 roleId와 platformId를 함께 사용한다. 로컬 YAML ID의 중복 허용 규칙을 모든 운영 테이블의 ID에 무조건 적용하지 않는다.

## 인증과 인가 책임

사용자 UI 요청: OIDC/Orion 세션 확인 → 현재 플랫폼의 활성 멤버십 → 해당 사용자의 현재 플랫폼 역할 → 유효 정책 평가. 사용자가 다른 플랫폼에 보유한 역할은 섞지 않는다. 조직을 통한 역할 합성은 플랫폼 멤버십 조건과 함께 서버에서 확정한다.

서비스 어카운트 요청: API 키 인증 → 계정/키 활성 및 서비스 범위 → Orion 역할·정책 → 허용 endpoint/응답 범위. 서비스 어카운트에 플랫폼 멤버십을 생성하지 않는다.

결재 조회: 현재 사용자의 user ref 또는 현재 소속 organization ref가 열람자에 존재하는지만 확인. 승인·합의는 현재 단계의 대상, 열람자 추가는 결재선 참가자, 후속 키 처리는 승인 완료와 지정 관리서비스 팀 자격으로 별도 검사한다.

메뉴 권한명과 API scope 문자열은 아직 확정되지 않았으므로 임의의 운영 permission 이름을 새로 명세하지 않는다. UI의 숨김·비활성만으로 서버 권한 검사를 대체하지 않는다.

## YAML 구조와 참조

최상위 workspace/service/domain/policy 문서를 사용한다. `apiVersion/kind/metadata/spec`, 환경·리전, 사용자가 지정하는 revision은 넣지 않는다. 필드 정의의 소유자는 endpoint다. 부모가 있는 ref는 부모 ID를 반드시 포함한다.

```yaml
workspace:
  id: hr
  name: 인사
  pages:
    - id: detail
      name: 직원 상세
      path: /employees/:id
      actions:
        - ref: { domain: employee, action: read-hr }
---
service:
  id: employee-api
  name: 직원 API
  endpoints:
    - id: detail
      name: 직원 상세 조회
      method: GET
      path: /employees/{id}
      request:
        fields:
          id: { location: path, path: id, type: string, required: true }
      response:
        fields:
          id: { path: /id, type: string }
          email: { path: /email, type: string }
---
domain:
  id: employee
  name: 직원 관리
  actions:
    read-hr:
      name: 인사 조회
      endpoint:
        ref: { service: employee-api, endpoint: detail }
---
policy:
  id: hr-reader
  name: 인사 직원 조회
  effect: allow
  resources:
    page:
      ref: { workspace: hr, page: detail }
    actions:
      - ref: { domain: employee, action: read-hr }
        response:
          fields:
            - ref: { field: id }
            - ref: { field: email }
              masking: { method: email }
```

field ref는 정책의 Action→단일 endpoint→response.fields 문맥에서 해석한다. 전체 endpoint에서 같은 이름의 field를 검색하지 않는다. 같은 endpoint/path를 사용하더라도 다른 domain/Action은 별도 권한이다. 페이지 없이 동작하는 정책은 resources.page를 생략한다.

내부 key 예: `pages:hr/detail`, `service-endpoints:employee-api/detail`, `actions:employee/read-hr`. 상세 URL에서는 `parent~localId`를 사용한다. ID에 separator를 허용하지 않아 충돌을 방지한다. path는 객체 식별자가 아니다. 기존 전역 ID 경로는 명시적 alias만 허용한다.

## 동일 Action의 정책 합성

1. 유효한 역할-정책 관계만 평가하고 만료된 부여는 제외한다.
2. deny가 있으면 Action 호출을 거부한다.
3. allow의 필드 반환 범위를 합집합한다. 설정 누락은 전체 반환이 아니다.
4. 같은 필드에 마스킹이 있으면 마스킹을 우선한다. `redact`가 더 제한적이고 keep-last는 더 작은 count를 따른다.
5. 명시적 unmask가 있는 경우 이미 허용된 필드의 마스킹을 해제할 수 있다. unmask만으로 호출/필드 반환 권한을 추가하지 않는다.
6. 비교할 수 없는 마스킹 충돌은 fail-closed로 표시한다. 다른 Action의 unmask를 가져오지 않는다.

request 필드 선택은 Action에 없다. 임의 요청 전처리/응답 변환 스크립트는 현재 확정된 실행 계약이 아니며 이 문서가 새 기능으로 추가하지 않는다.

## 데이터 전달과 배포

화면은 repository/API 응답으로 구성한다. API host는 런타임 환경·리전 설정으로 결정하고 요청 파라미터로 바꾸지 않는다. locale·설정된 세션 쿠키만 전달하고 API 실패를 데모로 대체하지 않는다. YAML에서 환경/리전을 제거한다는 결정은 글로벌 API 배포 설정까지 제거한다는 뜻이 아니다.

현재 master의 `platform-directory`, `definitions`, 이전 authorization graph와 P18 `approval-workflow`는 서로 다른 read model이다. 이들 사이 운영 단일 원천/권한 평가 통합은 완료되지 않았다. UI에서 보이는 숫자가 운영 전체 권한을 입증하지 않는다. 참조 무결성, 조직 멤버십, revision/CAS, 영속 저장, Secret 쓰기·보상 및 감사는 서버 계약에서 보장한다.
