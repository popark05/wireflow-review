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
초기 API(in-memory)가 구현되어 있습니다. Wireflow 그래프를 가져와 검증하고, 리뷰 제출과 승인/변경 요청을 기록하며, 승인된 Flow를 `flow-model` v1 계약으로 내보냅니다.

- 계약: [`contracts/flow-model.v1.schema.json`](contracts/flow-model.v1.schema.json)
- 설계 결정: [`docs/architecture/flow-contract.md`](docs/architecture/flow-contract.md)

| Method | Path | 용도 |
|---|---|---|
| POST | `/v1/flows/import` | Flow 그래프 가져오기 (`origin`, `kind`, `discoveryRef` 선택) |
| GET | `/v1/flows/{flowId}` | 현재 Flow 조회 |
| POST | `/v1/flows/{flowId}/submissions` | 리뷰 제출 |
| POST | `/v1/flows/{flowId}/reviews` | 승인 또는 변경 요청 |
| GET | `/v1/flows/{flowId}/export` | 승인된 Flow 내보내기 (`flow-model` v1) |

```bash
npm install
npm run typecheck && npm test && npm run build
npm run dev   # 기본 포트 3002
```

## 라이선스
외부 공개 및 배포 전에 결정합니다.