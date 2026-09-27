# 카탈로그 조회 API

이 문서는 `src/lib/api/contracts.ts`와 카탈로그 repository의 조회 계약입니다. 조직·서비스 어카운트 및 레거시 메타데이터 조회에 사용합니다. 플랫폼 directory, definitions, approval-workflow의 전용 계약을 대체하지 않습니다. 실제 Orion 백엔드와의 연동/인증 검증은 아직 수행하지 않았습니다. 백엔드 계약이 다르면 `contracts.ts`와 각 repository의 매핑을 수정합니다.

| 리소스               | 상세 `data` 구조                                            |
| -------------------- | ----------------------------------------------------------- |
| `users`              | `{user, organizations, roles}`                              |
| `organizations`      | `{organization, members, serviceAccounts, services, roles}` |
| `roles`              | `{role, users, organizations, policies}`                    |
| `policies`           | `{policy, services, endpoints, workspaces}`                 |
| `services`           | `{service, endpoints}`                                      |
| `service-endpoints`  | endpoint row                                                |
| `workspaces`         | `{workspace, pages}`                                        |
| `pages`              | page row                                                    |
| `api-keys`           | `{key, approvals}`                                          |
| `approval-templates` | template row                                                |
| `approvals`          | approval row                                                |
| `service-accounts`   | `{account, roles, keys}`                                    |

- `GET {baseUrl}/{resource}?limit=100[&cursor=...]`: `{ "data": [...], "pagination": { "nextCursor": null } }`. 마지막 페이지까지 `nextCursor`를 반환합니다. 상세 배열·count·참조 이름도 API가 제공합니다.
- `GET {baseUrl}/{resource}/{id}`: `{ "data": ... }`. 존재하지 않는 레코드는 HTTP 404.
- `GET {baseUrl}/{resource}/{id}/relationships`: `{ "data": [{ "title": "사용자", "rows": [{ "id": "u-1", "name": "Example", "href": "/users/u-1" }] }] }`. title은 `Accept-Language`에 맞춘 문구 또는 지원되는 한국어 UI 키를 반환합니다. 링크는 지원 리소스의 로컬 상세 경로만 허용됩니다.
- 전체 필드·enum·nullable 정의: [contracts.ts](../src/lib/api/contracts.ts). 날짜는 시간대가 포함된 ISO timestamp. 식별자는 관계 링크에서 영문/숫자/`_`/`-`를 지원합니다.
- 스키마는 필수 필드·타입·enum을 검사하고, 정의하지 않은 필드(키 원문 등)는 클라이언트로 전달하지 않습니다. 키는 `displayHint`만 받습니다.
- `Accept-Language: ko|en`, `X-Orion-Region`을 전송합니다. 지정한 세션 쿠키 하나만 전달하며 전체 쿠키/임의 요청 헤더는 전달하지 않습니다. 리다이렉트는 따라가지 않습니다.
- 401은 로그인 화면, 403은 공통 접근 거부 화면으로 이동합니다. 5xx, 타임아웃, 잘못된 JSON/스키마는 일반 오류 화면으로 전달됩니다. 상세 404는 해당 리소스의 not-found UI입니다. 서버 오류 본문은 노출하지 않습니다.

현재 목록은 최대 100페이지의 커서 응답을 모아 기존 검색·필터·정렬·페이지 UI에 공급합니다. 대규모 데이터에서는 서버 검색/정렬/필터 계약과 URL 상태를 관계해야 합니다. 무한 커서 반복과 페이지 상한 초과는 실패합니다. 이 계약은 조회 DTO 범위입니다. 변경 명령은 기능별 계약을 사용하며 Okta 콜백과 최종 인가는 서버 책임입니다.

배포·세션 전달 설정은 [API 배포](api-deployment.md), 현재 화면별 데이터 원천은 [데이터·권한 정의](screens/14-data-and-permissions.md)를 확인하세요.
