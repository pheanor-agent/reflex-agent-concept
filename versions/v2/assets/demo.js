(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const make = (tag, text, cls) => {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (cls) node.className = cls;
    return node;
  };
  const levelNames = ['L0 · 실행', 'L1 · 결정', 'L2 · 숙련', 'L3 · 숙고'];
  const actions = ['고정 분류 코드 적용', '허용 폴더 중 비용 폴더 선택', '등록된 절차로 금액·문서 유형 해석', '분류 기준과 검증 절차 검토'];
  const costs = [4, 12, 35, 100];
  let count = 0, lastLevel = 3, runNumber = 0;
  const inputs = {
    standard: '영수증 / 12,000원', novel: '등록되지 않은 외국어 서식',
    drift: '영수증 / 서식 v2', sensitive: '영수증 / 외부 전송 요구'
  };
  function behaviorState() {
    const condition = $('task-condition').value;
    let level = count >= 300 ? 0 : count >= 120 ? 1 : count >= 30 ? 2 : 3;
    let reason = [
      '표준 입력과 고정 매핑이 검증됐다. 문서 유형을 코드로 바로 분류한다.',
      '상태와 선택지가 검증됐다. 비용·계약·기타 중 한 폴더를 결정한다.',
      '반복 예시와 절차가 검증됐다. 표현을 해석하고 절차에 인자를 채운다.',
      '등록된 경험이 부족하다. 분류 기준과 성공 조건을 먼저 검토한다.'
    ][level];
    if (! $('validated').checked && count >= 30) {
      level = 3; reason = '후보의 독립 검증이 완료되지 않았다. 경험 수가 많아도 L3 검토를 거친다.';
    }
    if (condition === 'novel') { level = 3; reason = '처음 보는 서식은 기존 스킬의 적용 범위 밖이다. L3에서 새 해석 절차를 검토한다.'; }
    if (condition === 'drift') { level = 3; reason = '등록된 v1과 입력 v2가 다르다. 기존 스킬을 격리하고 L3에서 재검증한다.'; }
    if (condition === 'sensitive') { level = 3; reason = '외부 전송 권한이 없다. L3 검토로 이관하고 전송 실행은 보류한다.'; }
    return { level, reason, condition };
  }
  function updateBehavior(cause = '현재 설정') {
    const { level, reason, condition } = behaviorState();
    $('behavior-delta').textContent = `${cause} · ${level === lastLevel ? '판단 계층 유지' : `${levelNames[lastLevel]} → ${levelNames[level]}`}`;
    $('selected-title').textContent = levelNames[level];
    $('selected-desc').textContent = reason;
    $('sample-input').textContent = inputs[condition];
    $('cost-value').textContent = `${costs[level]} / L3 기준 100`;
    document.querySelectorAll('[data-count]').forEach(b => b.setAttribute('aria-pressed', String(Number(b.dataset.count) === count)));
    lastLevel = level;
  }
  document.querySelectorAll('[data-count]').forEach(b => b.addEventListener('click', () => {
    count = Number(b.dataset.count); updateBehavior(`성공 경험 ${count}건 선택`);
  }));
  $('task-condition').addEventListener('change', () => updateBehavior('입력 조건 변경'));
  $('validated').addEventListener('change', () => updateBehavior($('validated').checked ? '독립 검증 통과' : '독립 검증 보류'));
  $('run-sample').addEventListener('click', () => {
    const { level, condition } = behaviorState();
    runNumber += 1;
    const success = condition === 'standard';
    const result = success ? '비용/영수증.txt · 분류 결과와 정답 일치' : condition === 'sensitive' ? '외부 전송 보류 · 허용되지 않은 효과' : condition === 'drift' ? '서식 재검증 요청 · 기존 스킬 격리' : '새 해석 절차 요청 · 기존 스킬 적용 중단';
    const path = `입력 → 문서 모듈 ${levelNames[level]} → ${success ? 'L0 분류 실행 → 독립 정답 검증' : '검토 큐'}`;
    $('run-output').classList.toggle('warning', !success);
    $('run-output').replaceChildren(make('b', `#${runNumber} ${success ? '처리 성공' : '검토 / 보류'}`), make('p', result), make('p', path, 'small'), make('p', success ? `판단: ${actions[level]} · 학습 기록: 성공 증거 1건 생성` : '학습 기록: 예외 1건 생성 · 성공 사례에 포함하지 않음', 'small'));
    $('run-history').prepend(make('li', `#${runNumber} · ${levelNames[level]} · ${result}`));
    if ($('run-history').children.length > 5) $('run-history').lastElementChild.remove();
  });

  // Three bounded modules. Their knowledge is private; exchanges use structured fields.
  const domains = ['document', 'image', 'schedule'];
  const domainNames = {document: '문서', image: '이미지', schedule: '일정'};
  const structureNames = {dense: '전부 공유', isolated: '완전 격리', bridge: '조건부 연결'};
  const modules = {
    document: {knowledge: ['문서 유형 → 폴더 매핑'], execute: data => data.kind === 'receipt' && Number.isFinite(data.amount) ? `비용 폴더 / ${data.amount.toLocaleString('ko-KR')}원 영수증` : null},
    image: {knowledge: ['샘플 이미지의 OCR 필드'], execute: data => data.imageId === 'receipt-01' ? {kind: 'receipt', amount: 12000} : null},
    schedule: {knowledge: ['샘플 회의의 시간 필드'], execute: data => data.meetingId === 'meeting-01' ? '10월 1일 14:00' : null}
  };
  const fixtures = {
    document: {required: ['document'], payload: {kind:'receipt',amount:12000}, expected: '비용 폴더 / 12,000원 영수증'},
    image: {required: ['image'], payload: {imageId:'receipt-01'}, expected: {kind:'receipt',amount:12000}},
    schedule: {required: ['schedule'], payload: {meetingId:'meeting-01'}, expected: '10월 1일 14:00'},
    combined: {required: ['image','document'], payload: {imageId:'receipt-01'}, expected: '비용 폴더 / 12,000원 영수증'}
  };
  function storedEdges(structure) {
    return structure === 'dense' ? [['document','image'], ['image','schedule'], ['document','schedule']] : structure === 'bridge' ? [['image','document']] : [];
  }
  function openEdges(structure, task) {
    return structure === 'bridge' && task !== 'combined' ? [] : storedEdges(structure);
  }
  function linked(edges, a, b) { return edges.some(e => e.includes(a) && e.includes(b)); }
  function executeTask(structure, task) {
    const fixture = fixtures[task], edges = openEdges(structure, task);
    const active = structure === 'dense' ? [...domains] : [...fixture.required];
    let output = modules[fixture.required[0]].execute(fixture.payload);
    let missing = false;
    if (task === 'combined') {
      if (linked(edges, 'image', 'document')) output = modules.document.execute(output);
      else { missing = true; output = null; active.splice(active.indexOf('document'), 1); }
    }
    const pass = JSON.stringify(output) === JSON.stringify(fixture.expected);
    const exposure = active.filter(d => !fixture.required.includes(d));
    return { pass, output, missing, active, edges, exposure, path: missing ? ['image'] : fixture.required };
  }
  let structure = 'dense', lastAdopted = 'dense', generation = 1, evaluationCount = 0;
  function drawGraph(result) {
    const NS = 'http://www.w3.org/2000/svg';
    const svgElement = (name, attrs) => { const el = document.createElementNS(NS, name); Object.entries(attrs).forEach(([key,value])=>el.setAttribute(key,value)); return el; };
    const x = {document:110, image:300, schedule:490};
    $('graph-edges').replaceChildren(); $('graph-nodes').replaceChildren();
    const stored = storedEdges(structure);
    for (const [a,b] of stored) {
      const isOpen = linked(result.edges,a,b);
      const start=Math.min(x[a],x[b]), end=Math.max(x[a],x[b]);
      const outer=end-start>200;
      $('graph-edges').append(svgElement('path', {
        d: outer ? `M${start},98 Q300,158 ${end},98` : `M${start},48 Q${(start+end)/2},3 ${end},48`,
        fill:'none', stroke: isOpen ? '#9dccac' : '#82958a', 'stroke-width': isOpen ? 3 : 1.5,
        'stroke-dasharray':isOpen ? '' : '5 5'
      }));
    }
    for (const d of domains) {
      const active = result.active.includes(d);
      const group = svgElement('g', {});
      group.append(svgElement('rect',{x:x[d]-76,y:45,width:152,height:57,rx:12,fill:active?'#dfeadd':'#304d42',stroke:active?'#dfeadd':'#82958a'}));
      const text=svgElement('text',{x:x[d],y:70,'text-anchor':'middle',fill:active?'#233d36':'#c5d3cb','font-size':16,'font-weight':650}); text.textContent=domainNames[d]+' 모듈'; group.append(text);
      const sub=svgElement('text',{x:x[d],y:89,'text-anchor':'middle',fill:active?'#486453':'#b0c1b7','font-size':11}); sub.textContent=active?'활성':'대기'; group.append(sub);
      $('graph-nodes').append(group);
    }
    $('mobile-graph').replaceChildren(...domains.map(d => { const node = make('div', undefined, result.active.includes(d) ? 'active' : 'idle'); node.append(make('b', domainNames[d]), make('span', result.active.includes(d) ? '활성' : '대기')); return node; }));
    $('mobile-links').textContent = '열린 연결: ' + (result.edges.length ? result.edges.map(e => e.map(d=>domainNames[d]).join(' ↔ ')).join(' · ') : '없음');
    $('graph-title').textContent = `${structureNames[structure]} 구조 · 활성 모듈 ${result.active.map(d=>domainNames[d]).join(', ')} · 열린 연결 ${result.edges.length}개`;
  }
  function updateGraph(cause = '현재 구조') {
    const task=$('graph-task').value, result=executeTask(structure,task);
    $('graph-delta').textContent=`${cause} · ${structureNames[structure]}`;
    $('graph-status').textContent=result.pass ? `성공 · ${typeof result.output==='object' ? '영수증 / 12,000원 추출' : result.output}` : '실패 · 이미지 → 문서 연결 없음';
    $('graph-reason').textContent=result.missing ? '이미지 모듈은 금액을 추출했지만 문서 모듈에 전달할 경로가 없다. 복합 작업의 정답과 일치하지 않아 실패로 기록한다. 운영 시에는 중개기 검토로 이관한다.' : structure==='dense' ? `정답은 얻었다. 모든 영역이 입력을 공유하여 ${result.exposure.length}개 무관한 영역도 활성화됐다.` : structure==='isolated' ? '독립된 작업이라 한 모듈만으로 해결했다. 다른 영역의 지식과 메시지는 접근하지 않았다.' : task==='combined' ? '복합 입력에서 이미지 → 문서 연결을 열어 추출 필드만 전달했다. 일정 지식은 격리된 채 유지된다.' : '단일 작업에서는 영역 간 연결이 닫힌다. 해당 모듈의 지식과 스킬만 사용했다.';
    $('graph-path').textContent=result.path.map(d=>domainNames[d]).join(' → ') + (result.missing?' → 검토 큐':' → 공통 검증·실행');
    $('graph-exposure').textContent=result.exposure.length ? result.exposure.map(d=>domainNames[d]).join(' · ') : '없음';
    $('structure-lab').classList.toggle('graph-failed',!result.pass);
    document.querySelectorAll('[data-structure]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.structure===structure)));
    drawGraph(result);
  }
  document.querySelectorAll('[data-structure]').forEach(b=>b.addEventListener('click',()=>{ structure=b.dataset.structure; updateGraph('구조 변경'); }));
  $('graph-task').addEventListener('change',()=>updateGraph('입력 변경'));
  $('eval-environment').addEventListener('change',()=>{
    $('evolution-result').replaceChildren(make('p','평가 환경이 변경되었습니다. 후보 평가를 실행하면 새 환경의 정답·비용으로 구조를 다시 선별합니다.','small'));
  });
  $('evaluate-graphs').addEventListener('click',()=>{
    const profile=$('eval-environment').value;
    const tasks=profile==='local' ? ['document','image','schedule'] : ['document','image','schedule','combined'];
    const rows=['dense','isolated','bridge'].map(candidate=>{
      const results=tasks.map(task=>executeTask(candidate,task));
      const passed=results.filter(r=>r.pass).length;
      const exposure=results.reduce((n,r)=>n+r.exposure.length,0), links=storedEdges(candidate).length;
      return {candidate,passed,total:tasks.length,exposure,links,score:exposure+links};
    });
    const eligible=rows.filter(r=>r.passed===r.total).sort((a,b)=>a.score-b.score);
    const winner=eligible[0]; evaluationCount++;
    const parent=lastAdopted;
    if (winner.candidate!==lastAdopted) { generation++; lastAdopted=winner.candidate; }
    structure=winner.candidate; updateGraph('평가 결과 적용');
    const summary=make('div',undefined,'selection-summary');
    summary.append(make('b',`평가 #${evaluationCount} · 구조 세대 ${generation} · ${structureNames[winner.candidate]} 채택`));
    summary.append(make('p',`계보: ${structureNames[parent]} → ${structureNames[winner.candidate]}. ${winner.total}건 모두 통과한 후보 중 연결 수 + 불필요 공유 합계가 ${winner.score}로 가장 낮다.`));
    const table=make('table',undefined,'evaluation-table');
    const caption=make('caption',profile==='local'?'독립 업무 평가 · 단일 작업 3건':'복합 업무 평가 · 단일 3건 + 복합 1건'); table.append(caption);
    const head=make('thead'), hr=make('tr');
    ['후보','정답 통과','연결','공유','선별'].forEach(title=>{const th=make('th',title); th.scope='col';hr.append(th);});head.append(hr);table.append(head);
    const body=make('tbody');
    for (const row of rows) {
      const tr=make('tr'); if(row.candidate===winner.candidate)tr.className='winner';
      const label=row.passed<row.total ? '품질 미달' : row.candidate===winner.candidate ? '채택' : '보관';
      [structureNames[row.candidate],`${row.passed}/${row.total}`,String(row.links),String(row.exposure),label].forEach(value=>tr.append(make('td',value))); body.append(tr);
    }
    table.append(body);
    $('evolution-result').replaceChildren(summary,table,make('p',profile==='local'?'독립 업무에서는 완전 격리가 가장 간단하다. 복합 업무가 추가되면 필요한 연결을 가진 후보를 다시 평가해야 한다.':'완전 격리는 복합 작업을 실패해 탈락했다. 조건부 연결은 필요한 협업을 유지하면서 무관한 공유를 줄였다.','small'));
  });
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) if (entry.isIntersecting) document.querySelectorAll('.sidenav a').forEach(link=>link.classList.toggle('active',link.hash==='#'+entry.target.id));
    }, {rootMargin:'-90px 0px -65% 0px'});
    document.querySelectorAll('.section').forEach(section=>observer.observe(section));
  }
  updateBehavior(); updateGraph();
})();
