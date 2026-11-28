# Wireflow Review

Wireflow Review는 시각 디자인을 확정하기 전에 애플리케이션의 정보 구조(IA)와 사용자 태스크 흐름을 검토하는 기획 단계 도구입니다.

기획 메모와 기존 화면을 바탕으로 간단한 목업 화면 및 화면 간 전이(Transition)를 생성하고, 사용자가 실제 태스크를 수행하는 경로를 클릭하며 누락되거나 모호한 단계를 확인할 수 있도록 합니다.

## 핵심 기능
- 사용자 태스크별 화면 그룹 구성 및 전체 경로 강조
- 뒤로 가기, 취소, 재시도, 빈 결과, 실패 경로 검토
- 제품 요구사항, AI 제안, 미결정 질문 구분
- Reverse Screen에서 가져올 수 있는 구조화된 Flow 산출물 제공

## 다른 저장소와의 역할 분리
| 저장소 | 책임 |
|---|---|
| [reverse-screen](https://github.com/popark05/reverse-screen) | 실행 중인 앱에서 화면·상태·요소·전이를 탐색하고 수집 |
| [qa-platform](https://github.com/popark05/qa-platform) | QA 테스트 케이스 관리, 실행 및 결과 리포팅 |

Wireflow Review는 기획 및 흐름 검토 도구입니다. 런타임 탐색 세션이나 QA 테스트 실행 데이터는 소유하지 않습니다.

## 원본 프로젝트
기존 XU Wireflow Review 스킬 및 릴리스 자료는 [JeongK7998/wireflow-review](https://github.com/JeongK7998/wireflow-review)에서 확인할 수 있습니다. 이 저장소는 popark05 도구 체인의 독립 개발 저장소이며, 원본 소스와 릴리스 파일 전체를 복제한 상태는 아닙니다.

## 진행 상태
Wireflow 그래프를 가져와 검증하고, 불변 Revision을 남기고, 리뷰 제출과 승인/변경 요청을 기록하며, 승인된 Flow를 `flow-model` 계약(1.1)으로 내보내는 API가 구현되어 있습니다.

- 계약: [`contracts/flow-model.v1.schema.json`](contracts/flow-model.v1.schema.json)
- 설계 결정: [`docs/architecture/flow-contract.md`](docs/architecture/flow-contract.md)
- 저장소: 기본은 in-memory이며, `DATABASE_URL`을 설정하면 PostgreSQL을 사용합니다(시작 시 테이블과 인덱스 생성).

| Method | Path | 용도 |
|---|---|---|
| POST | `/v1/flows/import` | Flow 그래프 가져오기 (`origin`, `kind`, `discoveryRef` 선택) |
| GET | `/v1/flows/{flowId}` | 현재 Flow 조회 |
| POST | `/v1/flows/{flowId}/revisions` | 다음 Revision 생성 (`expectedVersion`, `title`, `nodes`, `edges`, 선택 `description`) |
| GET | `/v1/flows/{flowId}/revisions` | 불변 Revision 스냅샷 목록 |
| GET | `/v1/flows/{flowId}/revisions/{version}` | 특정 버전 스냅샷 조회 |
| POST | `/v1/flows/{flowId}/submissions` | 리뷰 제출 |
| POST | `/v1/flows/{flowId}/reviews` | 승인 또는 변경 요청 (현재 버전에 귀속) |
| GET | `/v1/flows/{flowId}/export` | 승인된 현재 버전 내보내기 (`flow-model`) |

새 Revision을 만들면 리뷰 상태가 `draft`로 초기화되며, 리뷰 진행 중이거나 `expectedVersion`이 현재 버전과 다르면 생성하지 않습니다. export는 현재 버전에 대한 승인만 공개하므로 새 Revision은 다시 승인되기 전까지 내보내지 않습니다. PostgreSQL은 `wireflow_revisions` 테이블에 `(flow_id, version)` 유일성 제약으로 스냅샷을 저장하며, 기존 데이터는 시작 시 현재 문서를 최초 Revision으로 백필합니다(테이블 도입 이전 버전은 복원 불가).

```bash
npm install
npm run typecheck && npm test && npm run build
npm run dev   # 기본 포트 3002
```

`/editor`에서 브라우저 기반 시각 편집기를 제공합니다. Flow ID로 열고, 화면·분기·외부 단계를 추가하고, 드래그로 배치(위치는 노드 metadata에 저장)하며, 라벨과 트리거로 연결한 뒤 저장합니다. 처음 저장하면 import, 이후 저장은 불변 Revision을 만듭니다. 가져온 노드의 Reverse Screen 참조와 origin은 읽기 전용으로 표시합니다.

## 라이선스
외부 공개 및 배포 전에 결정합니다.
