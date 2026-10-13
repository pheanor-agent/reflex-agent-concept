# REFLEX v2 연구와 설계 연결

확인일: 2026-09-30. v2의 설계 중심은 기능별 전문화, 조건부 통합, 연결 비용, 환경에 따른 구조 후보의 선별이다.

## 기능별 회로와 통합 경로

[Lesser et al., Synaptic architecture of leg and wing premotor control networks in Drosophila, Nature 2024](https://www.nature.com/articles/s41586-024-07600-z)는 초파리 다리와 날개의 전운동 회로를 분석했다. 관련된 기능의 근육을 제어하는 모듈이 있으며 두 운동계의 세부 연결 방식은 다르다. 다리 회로에서는 전운동 뉴런의 시냅스 가중치가 표적 운동 뉴런 크기에 비례하는 특징을 보였다.

설계 적용: 문서·이미지·일정 등 작업 기능별로 지식과 스킬을 모은다. 모듈의 계약과 내부 처리 방식을 작업 특성에 맞게 정한다. 검사 항목은 작업군 내부의 일관성과 다른 작업군 규칙의 간섭이다.

[Lin et al., Network statistics of the whole-brain connectome of Drosophila, Nature 2024](https://www.nature.com/articles/s41586-024-07968-y)는 희소한 뇌 연결에서 rich-club 조직, 지역별 연결과 통합·전파 역할의 후보를 분석했다. 다수의 뉴런이 하나의 연결 성분 안에 있고 뉴런 사이에 여러 경로가 존재한다.

설계 적용: 전문 영역 사이의 통합 중개기, 복구 경로, 결과 관측 경로를 유지한다. 연결 수 감소는 비용 목표이고, 복합 목표의 해결과 복구는 품질 제약으로 둔다.

## 연결 비용과 변화하는 목표

[Clune, Mouret & Lipson, The evolutionary origins of modularity, Proceedings of the Royal Society B 2013](https://arxiv.org/abs/1207.2743)는 계산 진화에서 성능과 연결 비용을 함께 선별하는 조건을 성능만 선별하는 조건과 비교했다. 연결 비용이 포함된 조건에서 모듈적인 구조와 새 과제로의 적응 이점이 나타났다.

설계 적용: 모델 호출 비용뿐 아니라 통신·검색 범위·검증·복구·유지 비용을 평가한다. 연결 개수는 대리 지표로 쓰고 실제 메시지·토큰·지연도 측정한다. 작업군별 품질 하한을 통과한 후보에서 비용을 비교한다.

[Kashtan & Alon, Spontaneous evolution of modularity and network motifs, PNAS 2005](https://www.weizmann.ac.il/mcb/alon/sites/mcb.UriAlon/files/spontaneousevolutionofmodularityandnetworkmotifs_0.pdf)는 하위 목표 조합이 반복적으로 바뀌는 계산 진화 환경에서 모듈성과 반복적인 네트워크 형태의 출현을 연구했다.

설계 적용: 문서 분류·금액 추출·기한 추출을 고정된 단일 과제로만 평가하지 않고 새 조합을 평가에 포함한다. 후보 생성에 없던 조합을 따로 남겨 구조의 전이 성능을 확인한다. 새 목표가 기존 하위 목표로 분해되지 않는 경우도 별도 검사한다.

## 에이전트 그래프의 최적화와 탐색

[Zhuge et al., GPTSwarm: Language Agents as Optimizable Graphs, ICML 2024](https://proceedings.mlr.press/v235/zhuge24a.html)는 언어 에이전트를 처리 노드와 정보 흐름의 그래프로 표현하고 노드와 연결을 최적화한다.

설계 적용: 그래프를 버전 관리되는 구조 계약으로 저장한다. 지식 범위·발동 조건·메시지 형식까지 포함해 실행을 재현한다. 스킬 개선과 연결 변경의 효과를 분리해 비교한다.

[Zhang et al., Cut the Crap: An Economical Communication Pipeline for LLM-based Multi-Agent Systems, 2024 사전공개](https://arxiv.org/abs/2410.02506)의 AgentPrune은 공간·시간상의 에이전트 통신 연결을 가지치기해 불필요한 메시지 전달을 줄이는 방법을 평가한다.

설계 적용: 정보 전달의 기여를 측정하고 반복·무관한 메시지를 줄이는 후보를 만든다. 서로 다른 과제의 드문 협업 경로를 삭제하기 전 별도 평가한다. 실제 비용 절감량은 REFLEX의 작업과 메시지 길이에서 측정한다.

[Hu, Lu & Clune, Automated Design of Agentic Systems, 2024 사전공개](https://arxiv.org/abs/2408.08435)는 Meta Agent Search로 에이전트 설계 코드를 생성하고 평가 결과와 함께 축적하며 새 설계를 탐색한다.

설계 적용: 부모 구조·변형 연산·독립 평가·후속 버전을 연결한다. 하나의 최종 구조만 남기는 대신 비용·품질·환경 적응의 장점이 다른 후보를 보관한다. 반복적인 평가 선별에 따른 과적합을 확인하기 위해 최종 테스트를 따로 둔다.

## 통합 설계와 확인할 가설

REFLEX는 위 연구들을 연결해 지식 접근 범위·스킬 경계·서브에이전트 역할·연결 발동 조건을 하나의 구조 후보로 표현한다. 학습은 모듈 내부의 행동을 개선하고 구조 진화는 이런 경계와 연결을 선별한다.

| 설계 가설 | 비교 | 확인할 결과 |
| --- | --- | --- |
| 영역별 지식 격리가 간섭을 줄인다 | 전체 공유 vs 영역별 범위 | 무관한 규칙에 의한 오류, 검색·전달량 |
| 조건부 연결이 통합과 비용을 함께 개선한다 | 완전 격리 vs 고정 연결 vs 조건부 연결 | 복합 목표 성공률, 통신·검증 비용 |
| 구조 선별이 새 환경에 유리하다 | 동일한 정적 구조 vs 후보 선별 | 새 조합·희귀 작업 품질, 탐색 비용 회수 |
| 행동 학습과 구조 진화가 함께 유효하다 | 구조 고정/진화 × 스킬 고정/학습 | 두 축의 개별 효과와 결합 효과 |

계층 학습과 국소 제어의 기존 문헌은 [컨셉 문서의 출처 1–5](../index.html#sources)에 유지한다. 실행 계약과 평가·복귀 절차는 [시스템 설계](architecture.md), 실험 순서는 [로드맵](roadmap.md)에 정리한다.
