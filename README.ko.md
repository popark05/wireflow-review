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

## 현재 구현 상태
- Wireflow 가져오기, 조회, 제출, 리뷰를 위한 Fastify API
- Node/Edge 식별자 및 그래프 참조 검증
- 로컬 개발 및 테스트용 In-memory Repository
- `DATABASE_URL` 설정 시 PostgreSQL 영속성 지원
- 불변 Revision 스냅샷, `expectedVersion` 기반 낙관적 동시성 제어, Revision 조회 API
- `/editor`에서 사용할 수 있는 브라우저 기반 시각적 Wireflow 편집기: 노드 이동·편집, Screen/Decision/External 단계 추가, 전이 연결, Flow 및 Revision 저장

Revision API:
- `POST /v1/flows/:flowId/revisions`: 다음 버전을 생성합니다. 요청에 `expectedVersion`, `title`, `nodes`, `edges` 및 선택적 `description`을 전달합니다.
- `GET /v1/flows/:flowId/revisions`: Revision 목록과 스냅샷을 조회합니다.
- `GET /v1/flows/:flowId/revisions/:version`: 특정 버전의 불변 스냅샷을 조회합니다.
- 새 Revision 생성 시 리뷰 상태는 `draft`로 초기화됩니다. 리뷰 진행 중이거나 `expectedVersion`이 현재 버전과 다르면 생성하지 않습니다.

PostgreSQL은 `wireflow_revisions` 테이블에 스냅샷을 저장하며 `(flow_id, version)`에 유일성 제약을 적용합니다. 기존 데이터는 서버 시작 시 현재 문서를 최초 조회 가능한 Revision으로 백필합니다. Revision 테이블 도입 이전의 과거 버전까지 복원할 수는 없습니다.

편집기 1차 버전에서는 Flow ID로 기존 Flow를 열고, 그래프를 구성·배치한 뒤 불변 Revision으로 저장할 수 있습니다. Reverse Screen 가져오기/비교 연동은 아직 구현되지 않았습니다.

## 라이선스
외부 공개 및 배포 전에 결정합니다.
