    (() => {
      'use strict';
      const byId = id => document.getElementById(id);
      const episodes = byId('episodes');
      const names = ['L0 · 실행', 'L1 · 결정', 'L2 · 숙련', 'L3 · 숙고'];
      const descriptions = [
        '정형 입력과 고정 매핑의 검증이 완료됐다. 판단은 코드로 처리하고, 계약 밖 입력에는 상위 이관을 반환한다.',
        '입력 상태와 가능한 행동이 좁혀졌다. Jev식 정책이 허용된 폴더 또는 상위 이관 중 하나를 선택한다.',
        '검증된 예시와 절차가 있다. 경량 모델이 문맥을 해석해 정해진 분류 절차의 인자를 채운다.',
        '적용할 경험과 정책이 없다. 고성능 모델이 분류 기준과 검증 가능한 절차를 설계한다.'
      ];
      const judgments = ['L0에서 고정 매핑 적용', 'L1에서 제한된 선택', 'L2에서 문맥 해석과 인자 추출', 'L3에서 새 절차 제안'];
      const learning = ['표본 감사 · 계약 위반 감시 · 버전 유지', '정책의 반례 수집 · 코드화 가능성 평가', '예외 수집 · 제한된 결정 후보 평가', '관측 결과를 기록하고 스킬 후보 생성'];
      const costs = [4, 12, 35, 100];
      function update() {
        const n = Number(episodes.value);
        const validated = byId('validated').checked;
        const novel = byId('novel').checked;
        const drift = byId('drift').checked;
        const sensitive = byId('sensitive').checked;
        let level = n >= 300 ? 0 : n >= 120 ? 1 : n >= 30 ? 2 : 3;
        let reason = descriptions[level];
        const exceptions = [];
        if (novel) exceptions.push('기존 작업군 밖의 새로운 조건');
        if (drift) exceptions.push('환경·입력 버전 불일치');
        if (!validated && n >= 30) exceptions.push('후보의 독립 검증 미통과');
        if (exceptions.length) {
          level = 3;
          reason = exceptions.join(' · ') + '. 빠른 경로를 적용할 근거가 부족하므로 L3에서 검토한다.';
        }
        if (sensitive) {
          level = 3;
          reason += ' 기존 권한 밖의 전송 요청은 상위 검토 후에도 승인 전까지 실행할 수 없다.';
        }
        byId('episode-value').textContent = n + '건';
        byId('selected-title').textContent = names[level];
        byId('selected-title').dataset.layer = String(level);
        byId('selected-desc').textContent = reason;
        document.querySelectorAll('[data-count]').forEach(button => button.setAttribute('aria-pressed', String(Number(button.dataset.count) === n)));
        document.querySelectorAll('[data-level]').forEach(node => {
          const active = Number(node.dataset.level) === level;
          node.classList.toggle('on', active);
          if (active) node.setAttribute('aria-current', 'true'); else node.removeAttribute('aria-current');
        });
        const inputReasons = [];
        if (novel) inputReasons.push('새 작업 조건');
        if (drift) inputReasons.push('환경 버전 변경');
        if (sensitive) inputReasons.push('권한 밖 전송 요청');
        byId('trace-input').textContent = inputReasons.length ? inputReasons.join(' · ') : (n >= 30 && validated ? '알려진 작업군 · 입력 계약 충족' : '알려진 형식 · 검증된 분류 정책 없음');
        byId('trace-judge').textContent = sensitive ? 'L3 검토 · 실행 권한 별도 확인' : judgments[level];
        byId('trace-output').textContent = sensitive ? '실행 보류 · 사용자 승인 필요' : '계획·권한·사후 조건 확인 후 L0 실행기로 로컬 분류';
        byId('trace-learn').textContent = sensitive ? '전송 성공으로 기록하지 않음 · 검토 상태 보존' : drift ? '기존 스킬 격리 · 변경된 환경에서 재검증' : learning[level];
        byId('cost-value').textContent = costs[level] + ' / 기준 100';
        byId('cost-fill').style.width = costs[level] + '%';
        byId('cost-meter').setAttribute('aria-valuenow', String(costs[level]));
        byId('cost-meter').setAttribute('aria-valuetext', '설명용 가상 상대 비용 ' + costs[level] + ', 기준 100');
      }
      episodes.addEventListener('input', update);
      ['validated', 'novel', 'drift', 'sensitive'].forEach(id => byId(id).addEventListener('change', update));
      document.querySelectorAll('[data-count]').forEach(button => button.addEventListener('click', () => { episodes.value = button.dataset.count; update(); }));
      if ('IntersectionObserver' in window) {
        const observer = new IntersectionObserver(entries => {
          for (const entry of entries) {
            if (!entry.isIntersecting) continue;
            document.querySelectorAll('.sidenav a').forEach(link => link.classList.toggle('active', link.hash === '#' + entry.target.id));
          }
        }, { rootMargin: '-90px 0px -65% 0px' });
        document.querySelectorAll('.section').forEach(section => observer.observe(section));
      }
      update();
    })();
