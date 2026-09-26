# 백오피스 컴포넌트 조사 및 구현

조사일: 2026-09-23. 대상: Orion 서버 리소스 접근 권한 관리 프론트엔드.

## 조사에서 얻은 기준

| 출처                                                                                    | 확인한 패턴                                                               | Orion 적용                                                                         |
| --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| [IBM Carbon: Data table](https://carbondesignsystem.com/components/data-table/usage/)   | 검색·필터 도구 모음, 정렬, 페이지 이동, 행 선택과 일괄 작업을 목록에 결합 | 제어형 DataTable, TableToolbar, Pagination. 페이지 단위 전체 선택과 일부 선택 상태 |
| [Atlassian: Components](https://atlassian.design/components)                            | 목록·폼·상태 피드백·내비게이션을 재사용 가능한 컴포넌트로 분리            | 입력 필드, 버튼, 배지, 알림, 탭, 경로 탐색                                         |
| [Radix: Dialog](https://www.radix-ui.com/primitives/docs/components/dialog)             | 모달의 포커스 제한, Escape, 트리거로 포커스 복귀                          | 같은 Dialog 기반으로 모달과 우측 Drawer 제공                                       |
| [Radix: Alert Dialog](https://www.radix-ui.com/primitives/docs/components/alert-dialog) | 중요한 작업에 명시적 확인과 취소 제공                                     | 삭제 확인창. 취소에 초기 포커스, 성공 후 호출부가 닫힘 제어                        |
| [Radix: Introduction](https://www.radix-ui.com/primitives/docs/overview/introduction)   | 스타일과 동작을 분리하는 접근성 기반 primitive                            | 오버레이·메뉴·탭·토스트는 Radix, 폼은 네이티브 HTML 기반                           |

원본 제품 디자인을 복제하지 않고 상호작용 패턴을 참고했습니다. 권한 매트릭스는 Orion의 역할–리소스–작업 관계에 맞춘 별도 구성입니다.

## 구현 목록

모든 공통 컴포넌트는 `src/components/ui`에 위치합니다.

| 영역     | 컴포넌트                            | 지원 범위                                                        |
| -------- | ----------------------------------- | ---------------------------------------------------------------- |
| 작업     | Button                              | primary / secondary / ghost / danger, 크기, 로딩, 비활성         |
| 입력     | Field, Input, Textarea, Select      | label 관계, 도움말, 오류 설명, 필수·비활성 상태                  |
| 선택     | Checkbox, Switch                    | 선택, 일부 선택, 읽기 전용 UI를 위한 비활성                      |
| 목록     | DataTable, TableToolbar, Pagination | 정렬 콜백, 페이지별 행 선택, 검색·필터 조합, 페이지 크기 변경    |
| 상태     | Badge, Alert, Skeleton, EmptyState  | 텍스트를 동반한 상태 색상, 오류/재시도, 로딩·빈 결과             |
| 탐색     | PageHeading, Breadcrumbs, Tabs      | 페이지 액션, 현재 위치, 키보드 탭 이동                           |
| 오버레이 | Dialog, ConfirmDialog, ActionMenu   | 모달·Drawer, 파괴적 작업 확인, 행별 작업 메뉴                    |
| 알림     | ToastProvider, useToast             | 일시적 알림, 닫기, 최대 4개 표시                                 |
| 권한     | PermissionMatrix                    | 행·열 전체 선택, 일부 선택, 지원하지 않는 작업 제외, 비활성 모드 |

## 확인 화면

`/components`에서 동작을 확인합니다. 사용자를 검색·추가·삭제하거나 상태를 변경할 수 있지만 **메모리 예제이며 서버에 요청하지 않습니다.** 화면 내 탭 이동 시 상태는 유지되고 새로고침/페이지 이탈 시 초기화됩니다. 실제 사용자/역할 관리 페이지는 기존 준비 중 상태입니다.

## 사용 규칙

### 폼

```tsx
<Field label="역할 이름" hint="업무에 맞는 이름" error={errors.name} required>
  {(props) => <Input {...props} name="name" />}
</Field>
```

Field의 속성을 반드시 입력 요소에 전달합니다. 오류는 색상뿐 아니라 텍스트와 `aria-describedby`로 관계합니다. 일반적인 required/email 검사는 네이티브 폼 검증을 사용하고 업무 규칙은 호출부에서 추가합니다. Select는 네이티브 단일 선택입니다.

### 테이블과 페이지 이동

DataTable은 표시할 **현재 페이지의 rows**를 받습니다. 정렬·검색·필터·페이지 상태를 내부에서 처리하지 않아 서버 페이지네이션으로 교체할 수 있습니다.

- `columns`: 고유 key, header, render, sortable.
- `getRowId`: 페이지와 정렬에 관계없이 안정적인 ID를 반환합니다.
- `sort`, `onSortChange`: 오름차순 → 내림차순 → 미정렬. 호출부가 실제 데이터를 정렬하거나 API에 전달합니다.
- `selection.ids`, `onChange`, `label`, `canSelect`: 선택 상태, 접근성 이름, 선택 제한.
- 전체 선택은 전달한 rows 중 선택 가능한 항목에만 적용하고 다른 페이지의 선택을 보존합니다.
- 예제에서는 검색·필터 변경 시 선택을 초기화합니다. 실제 제품에서도 숨은 대상을 실수로 변경하지 않도록 정책을 명시하세요.
- `loading`, `error`, `onRetry`: 로딩·오류·재시도. 이 상태에서는 행 작업을 표시하지 않습니다.
- Pagination은 1부터 시작하는 page, 양수 pageSize, 0 이상의 total을 받습니다. 현재 page가 범위를 벗어나면 호출부에서 보정합니다. pageSize는 5/10/20/50입니다.

검색과 필터는 TableToolbar에 Field/Input/Select를 조합합니다. 대량 목록에는 서버 페이지네이션을 사용하고 조회 취소/이전 응답 무시는 기능별 데이터 계층에서 처리합니다.

### 모달과 중요한 변경

Dialog는 trigger/open/onOpenChange/title/description을 받습니다. `variant="drawer"`로 우측 패널을 사용합니다. 외부 클릭은 편집 내용 손실을 막기 위해 닫지 않으며 Escape/닫기/취소를 제공합니다. `busy`는 처리 중 닫힘을 막습니다.

ConfirmDialog는 onConfirm 호출 후 **자동으로 닫지 않습니다.** 호출부에서 비동기 작업 상태를 `pending`으로 전달하고 성공 시 open=false, 실패 시 error를 전달합니다. 취소/닫기는 pending 동안 막힙니다. 실패 메시지에 민감한 서버 응답을 그대로 표시하지 않습니다. 삭제 후 원래 트리거가 사라지거나 비활성화된다면 `returnFocusRef`로 검색 필드 같은 다음 작업 위치를 지정합니다.

토스트는 짧은 성공 피드백용입니다. 사용자가 대응해야 하는 오류는 Alert 또는 Field에 지속 표시합니다. ToastProvider 아래에서 useToast를 호출합니다.

### 권한 매트릭스

리소스와 작업에는 고유 ID를 사용합니다. 각 resource.actions에는 지원 가능한 action ID만 넣습니다. 선택 값은 `permissionKey(resourceId, actionId)`로 생성한 문자열 Set입니다. 서버 전송 모델과 구분하고 어댑터에서 변환합니다. 화면에서 체크할 수 없는 항목을 백엔드가 허용한다는 뜻이 아닙니다. 서버는 대상 리소스, 수행자와 모든 변경 권한을 다시 검증해야 합니다.

### 스타일과 접근성

색상과 경계선은 CSS 변수로 관리하고 공통 스타일은 `styles.css`에 둡니다. 기존 사이드바 nav 스타일을 범위 지정해 페이지네이션/경로 탐색과 충돌하지 않게 했습니다. 포커스 표시, reduced-motion, 한국어 label, aria-sort, 모달 title/description을 제공합니다. 모바일에서는 테이블 내부만 가로 스크롤됩니다.

브라우저 자동 접근성 검사는 수동 스크린리더 점검을 대체하지 않습니다. 실제 기능 관계 시 새로운 라벨·오류 메시지·권한 상태도 확인해야 합니다.

## 검증 방법

```sh
npm ci
npm run check
npm run build
npx playwright install chromium
npm run test:e2e
```

Playwright는 빌드 결과를 3100 포트에서 실행합니다. 테스트 범위는 검색·선택·정렬·페이지 이동, 폼 검증, 삭제 확인, 키보드 메뉴/탭/모달, 권한 일부 선택/읽기 전용, 모바일 오버플로, axe WCAG A/AA입니다.

## 후속으로 미룬 컴포넌트

| 컴포넌트                         | 도입 시점                              |
| -------------------------------- | -------------------------------------- |
| 검색형 Combobox / 다중 선택      | 대량 사용자·역할 검색 API 계약 확정 후 |
| 날짜 범위 필터                   | 감사 로그 시간대·검색 API 확정 후      |
| 리소스 Tree / 조직 Tree          | 실제 계층 구조 확정 후                 |
| 대용량 가상화 테이블 / 컬럼 설정 | 데이터량과 사용자 작업 흐름 확인 후    |
| 차트·파일 업로드·리치 텍스트     | 해당 기능 요구사항 발생 시             |

초기 단계에는 표준 HTML 테이블로 구성하고, 열 고정·다중 정렬·가상화 요구가 생기면 TanStack Table 등의 도입을 별도 검토합니다.
