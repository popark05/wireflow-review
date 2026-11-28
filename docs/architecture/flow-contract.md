# Flow Model 계약 v1

Wireflow Review가 승인한 Flow를 다른 저장소에 공개하는 계약입니다. 스키마: [`contracts/flow-model.v1.schema.json`](../../contracts/flow-model.v1.schema.json).

## 데이터 흐름 방향

```
reverse-screen ──(import: 발견된 화면/전이 ID 참조)──▶ wireflow-review ──(export: 승인된 Flow 스냅샷)──▶ qa-platform
```

- **Wireflow Review가 Flow 검토·승인의 기준 시스템(system of record)입니다.** "Verified ≠ Approved" 원칙에 따라, Reverse Screen이 런타임 증거로 *검증한* 전이도 사람이 이 저장소에서 *승인*해야 공개됩니다.
- **Reverse Screen → Wireflow Review**: `POST /v1/flows/import` 본문의 노드·엣지에 `discoveryRef`를 넣어 Discovery Event의 `screen_id`, `state_id`, `transition_id`, `session_id`를 그대로 참조합니다. 현재 Reverse Screen에는 Flow를 내보내는 API가 없으므로, 이 계약은 향후 Reverse Screen exporter가 맞춰야 할 입력 형식입니다.
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

- `origin`: `product_requirement` | `ai_suggestion` | `open_question`. import 시 생략하면 `product_requirement`로 저장합니다. QA Platform은 `open_question` 요소로부터 실행 가능한 테스트를 바로 생성하지 않아야 합니다.
- `kind` (엣지만): `primary` | `back` | `cancel` | `retry` | `empty` | `failure`. import 시 생략하면 `primary`입니다. 대체 경로 리뷰 커버리지에 사용합니다.

## 불변성과 버전

- `(flowId, flowVersion)` 쌍으로 식별되는 스냅샷은 불변입니다. 소비자는 Test Case 출처(provenance)에 이 쌍을 기록해야 합니다.
- 현재 구현은 Flow 수정 API가 없어 `flowVersion`이 항상 1입니다. 버전 생성(QA Platform의 `expectedVersion` 방식)은 후속 작업입니다.
- 노드의 `metadata`는 Wireflow Review 내부 전용이며 공개하지 않습니다.

## 계약 변경 규칙

- 선택 필드 추가는 minor(`1.x`), 필드 삭제·의미 변경·필수화는 major(`2.0`)입니다.
- 스키마는 `additionalProperties: false`이므로, 소비자는 자신이 지원하는 `contractVersion`만 받아들여야 합니다.

## 아직 정하지 않은 것

- 태스크 단위 화면 그룹(`tasks`) 표현 — v1.1 후보
- 인증: QA Platform의 서비스 토큰/JWT 방식과 맞출지
- 영속화: 현재 in-memory 전용
