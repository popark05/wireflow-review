# Flow Model 계약 v1 (현재 1.1)

Wireflow Review가 승인한 Flow를 다른 저장소에 공개하는 계약입니다. 스키마: [`contracts/flow-model.v1.schema.json`](../../contracts/flow-model.v1.schema.json).

## 데이터 흐름 방향

```
reverse-screen ──(import: 발견된 화면/전이 ID 참조)──▶ wireflow-review ──(export: 승인된 Flow 스냅샷)──▶ qa-platform
```

- **Wireflow Review가 Flow 검토·승인의 기준 시스템(system of record)입니다.** "Verified ≠ Approved" 원칙에 따라, Reverse Screen이 런타임 증거로 *검증한* 전이도 사람이 이 저장소에서 *승인*해야 공개됩니다.
- **Reverse Screen → Wireflow Review**: `POST /v1/flows/import` 본문의 노드·엣지에 `discoveryRef`를 넣어 Discovery Event의 `screen_id`, `state_id`, `transition_id`, `session_id`를 그대로 참조합니다. Reverse Screen의 `GET /v1/discovery-sessions/{sessionId}/wireflow-draft`가 이 import 본문을 그대로 만들어 줍니다. 노드 ID는 화면 ID, 엣지 ID는 `transition-<transitionId>`이며, 같은 세션을 다시 내보내도 결과가 같습니다. 가져온 Flow는 `draft` 상태로 시작하므로 사람이 검토하고 승인해야 공개됩니다.

  ```bash
  curl -s $REVERSE_SCREEN/v1/discovery-sessions/$SESSION/wireflow-draft \
    | curl -s -X POST $WIREFLOW/v1/flows/import -H 'content-type: application/json' --data-binary @-
  ```
- **Wireflow Review → QA Platform**: `GET /v1/flows/{flowId}/export`가 `flow-model.v1` 문서를 반환합니다. 승인된 Flow만 공개하며 draft, in_review, changes_requested 상태에서는 `409 flow_not_approved`를 반환합니다.
- 다른 저장소의 데이터베이스는 직접 읽거나 쓰지 않습니다.

## 필드 명명 규칙

계약은 **camelCase**를 사용합니다. 저장소 간 공개 계약 중 유일하게 구현된 `qa-platform/contracts/reverse-screen-evidence-reference.v1`과 같은 규칙이며, `contractVersion`, `sourceSystem` 엔벨로프 필드도 같습니다. Reverse Screen 내부 API와 Discovery Event는 snake_case이므로, 참조를 만들 때 다음과 같이 변환합니다.

| Reverse Screen (Discovery Event) | flow-model v1 (`discoveryRef`) |
|---|---|
| `screen_id` | `screenId` |
| `state_id` | `stateId` |
| `transition_id` | `transitionId` |
| `session_id` | `sessionId` |

ID 값은 변환하지 않고 UUID 그대로 복사합니다. `discoveryRef`에는 ID가 최소 1개 있어야 합니다.

## 리뷰 상태

계약에는 승인된 스냅샷만 실리므로 리뷰 상태 값을 노출하지 않습니다. 승인 근거는 `approval { reviewId, reviewerId, approvedAt }`로 전달합니다. 내부 상태와 ERD 공통 어휘의 대응은 다음과 같습니다.

| Wireflow Review 내부 | ERD 공통 어휘 | QA Platform Test Case |
|---|---|---|
| `draft` | — | `draft` |
| `in_review` | `pending` | `pending_review` |
| `approved` | `approved` | `approved` |
| `changes_requested` | `needs_changes` | (`rejected`로 대체) |

Wireflow Review에는 `rejected`(폐기)가 없습니다. 필요해지면 v1.1에서 추가를 검토합니다.

## 요소 출처(`origin`)와 경로 종류(`kind`)

- `origin`: `product_requirement` | `ai_suggestion` | `open_question` | `discovered`(1.1). import 시 생략하면 `product_requirement`로 저장합니다.
  - `discovered`는 Reverse Screen이 실행 중인 앱에서 관찰한 요소입니다. 새 요구사항이 아니라 "현재 앱이 실제로 이렇게 동작한다"는 사실이며, Reverse Screen의 wireflow-draft는 모든 노드·엣지를 `discovered`로 내보냅니다.
  - QA Platform은 `open_question` 요소로부터 실행 가능한 테스트를 바로 생성하지 않아야 합니다. `discovered`는 승인된 Flow 안에서 테스트 대상입니다.
- `kind` (엣지만): `primary` | `back` | `cancel` | `retry` | `empty` | `failure`. import 시 생략하면 `primary`입니다. 대체 경로 리뷰 커버리지에 사용합니다.

## 불변성과 버전

- `(flowId, flowVersion)` 쌍으로 식별되는 스냅샷은 불변입니다. 소비자는 Test Case 출처(provenance)에 이 쌍을 기록해야 합니다.
- `POST /v1/flows/{flowId}/revisions`로 새 버전을 만들면 `flowVersion`이 1씩 증가하고, 그 버전이 다시 승인되어야 공개됩니다.
- 노드의 `metadata`는 Wireflow Review 내부 전용이며 공개하지 않습니다.

## 계약 변경 규칙

- 선택 필드 추가는 minor(`1.x`), 필드 삭제·의미 변경·필수화는 major(`2.0`)입니다.
- 스키마는 `additionalProperties: false`이므로, 소비자는 자신이 지원하는 `contractVersion`만 받아들여야 합니다.

## 아직 정하지 않은 것

- 태스크 단위 화면 그룹(`tasks`) 표현 — v1.2 후보
- 인증: QA Platform의 서비스 토큰/JWT 방식과 맞출지

## 변경 이력

| 버전 | 변경 |
|---|---|
| 1.0 | 최초 공개 |
| 1.1 | `origin`에 `discovered` 추가. `contractVersion`은 `"1.1"`로 내보내며, 소비자는 1.0과 1.1을 모두 받아야 합니다. 열거형 값 추가이므로 값을 엄격히 검사하는 소비자는 먼저 갱신해야 합니다(QA Platform은 이미 반영). |
