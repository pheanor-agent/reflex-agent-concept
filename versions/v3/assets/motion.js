(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const NS = 'http://www.w3.org/2000/svg';
  const svg = (tag, attrs = {}, parent) => {
    const n = document.createElementNS(NS, tag);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  };
  const el = (tag, cls, html, parent) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html !== undefined) n.innerHTML = html;
    if (parent) parent.appendChild(n);
    return n;
  };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const ease = t => 1 - Math.pow(1 - t, 3);
  const C = { l3: '#ff8a5c', l2: '#e9c46a', l1: '#8fb3ff', l0: '#7fd8b0', mint: '#7fd8b0', red: '#ff6b6b', gold: '#e9c46a', line: '#2a423a', dim: '#64786f' };
  const LC = [C.l0, C.l1, C.l2, C.l3];

  /* run callback when element enters view (once or each time) */
  function onView(node, fn, { once = true, margin = '0px 0px -15% 0px', leave } = {}) {
    if (!node) return;
    const io = new IntersectionObserver(es => es.forEach(e => {
      if (e.isIntersecting) { fn(); if (once) io.disconnect(); }
      else if (leave) leave();
    }), { rootMargin: margin });
    io.observe(node);
  }

  /* ── chrome: top bar, progress fallback, reveal fallback ── */
  const top = $('topbar');
  const prog = document.querySelector('.progress');
  const cssScroll = CSS.supports('animation-timeline: scroll()');
  addEventListener('scroll', () => {
    top.classList.toggle('solid', scrollY > 40);
    if (!cssScroll) prog.style.setProperty('--p', scrollY / Math.max(1, document.documentElement.scrollHeight - innerHeight));
  }, { passive: true });
  if (!CSS.supports('animation-timeline: view()')) {
    const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -8% 0px' });
    document.querySelectorAll('.rv').forEach(n => io.observe(n));
  }

  /* ── hero: kinetic headline ── */
  (function split() {
    const h = $('heroTitle'); let i = 0;
    const walk = node => [...node.childNodes].forEach(c => {
      if (c.nodeType === 3) {
        const frag = document.createDocumentFragment();
        c.textContent.split(/(\s+)/).forEach(t => {
          if (!t) return;
          if (/^\s+$/.test(t)) { frag.appendChild(document.createTextNode(t)); return; }
          const s = el('span', 'w', ''); s.textContent = t; s.style.setProperty('--i', i++); frag.appendChild(s);
        });
        c.replaceWith(frag);
      } else walk(c);
    });
    walk(h);
  })();

  /* ── hero: connectome canvas — long deliberate path vs short reflex path ── */
  (function connectome() {
    const cv = $('connectome'); const ctx = cv.getContext('2d');
    let W, H, dpr, nodes, edges, paths, mode = 0, pulse = null, sparks = [], mouse = { x: -999, y: -999 }, visible = true, t0 = performance.now();
    const bandY = k => H * (0.80 - k * 0.19); // k=0 → L0 (bottom) … k=3 → L3 (top)
    function build() {
      dpr = Math.min(devicePixelRatio || 1, 2);
      W = cv.clientWidth; H = cv.clientHeight;
      cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const per = Math.round(clamp(W / 38, 12, 34));
      let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
      nodes = [];
      for (let k = 0; k < 4; k++) for (let i = 0; i < per; i++) {
        nodes.push({ x: W * (0.06 + 0.88 * (i + rnd() * 0.8) / per), y: bandY(k) + (rnd() - 0.5) * H * 0.11, k, r: 1.4 + rnd() * 1.8, ph: rnd() * 6.28, glow: 0 });
      }
      const IN = { x: W * 0.03, y: H * 0.62, k: -1, r: 4, ph: 0, glow: 0 }, OUT = { x: W * 0.97, y: H * 0.62, k: -1, r: 4, ph: 0, glow: 0 };
      nodes.push(IN, OUT);
      edges = [];
      nodes.forEach((a, ai) => {
        const near = nodes.map((b, bi) => ({ bi, d: Math.hypot(a.x - b.x, (a.y - b.y) * 1.3) })).filter(o => o.bi !== ai).sort((p, q) => p.d - q.d).slice(0, 3);
        near.forEach(o => { if (ai < o.bi) edges.push([ai, o.bi]); });
      });
      const pick = (fx, k) => {
        let best = 0, bd = 1e9;
        nodes.forEach((n, i) => { if (n.k === k) { const d = Math.abs(n.x - W * fx); if (d < bd) { bd = d; best = i; } } });
        return best;
      };
      const iIN = nodes.length - 2, iOUT = nodes.length - 1;
      const long = [iIN, pick(.14, 1), pick(.24, 2), pick(.36, 3), pick(.5, 3), pick(.64, 3), pick(.76, 2), pick(.86, 1), iOUT];
      const short = [iIN, pick(.33, 0), pick(.66, 0), iOUT];
      paths = [long, short];
      paths.forEach(p => p.forEach((n, i) => { if (i) edges.push([p[i - 1], n, true]); }));
    }
    function startPulse() {
      const p = paths[mode];
      const segs = []; let total = 0;
      for (let i = 1; i < p.length; i++) { const a = nodes[p[i - 1]], b = nodes[p[i]]; const d = Math.hypot(a.x - b.x, a.y - b.y); segs.push({ a, b, d, s: total }); total += d; }
      pulse = { segs, total, t: performance.now(), dur: total / (mode ? 0.62 : 0.42), trail: [] };
      const hm = $('heroMode'), hh = $('heroHops');
      if (hm) hm.innerHTML = mode ? '경로 · <b class="fast">L0 반사</b>' : '경로 · <b>L3 숙고</b>';
      if (hh) hh.textContent = `신호가 지나는 연결 ${p.length - 1}`;
    }
    function frame(now) {
      if (!visible) return requestAnimationFrame(frame);
      ctx.clearRect(0, 0, W, H);
      const t = (now - t0) / 1000;
      // strata labels
      ctx.font = '11px ui-monospace, monospace'; ctx.textAlign = 'right';
      ['L0 실행', 'L1 결정', 'L2 숙련', 'L3 숙고'].forEach((s, k) => { ctx.fillStyle = LC[k] + '55'; ctx.fillText(s, W - 14, bandY(k) - H * 0.07); });
      // edges
      edges.forEach(([a, b, onPath]) => {
        const A = nodes[a], B = nodes[b];
        ctx.strokeStyle = onPath ? 'rgba(127,216,176,.10)' : 'rgba(80,120,105,.16)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(A.x, A.y); ctx.lineTo(B.x, B.y); ctx.stroke();
      });
      // ambient sparks along random edges
      if (!RM && Math.random() < 0.18) { const e = edges[(Math.random() * edges.length) | 0]; sparks.push({ e, t: 0 }); }
      sparks = sparks.filter(s => (s.t += 0.025) < 1);
      sparks.forEach(s => {
        const A = nodes[s.e[0]], B = nodes[s.e[1]]; const x = A.x + (B.x - A.x) * s.t, y = A.y + (B.y - A.y) * s.t;
        ctx.fillStyle = `rgba(143,179,255,${0.5 * Math.sin(s.t * Math.PI)})`; ctx.beginPath(); ctx.arc(x, y, 1.6, 0, 7); ctx.fill();
      });
      // pulse along chosen path
      if (pulse) {
        const f = clamp((now - pulse.t) / pulse.dur, 0, 1), dist = f * pulse.total;
        const seg = pulse.segs.find(s => dist <= s.s + s.d) || pulse.segs[pulse.segs.length - 1];
        const u = clamp((dist - seg.s) / seg.d, 0, 1); const x = seg.a.x + (seg.b.x - seg.a.x) * u, y = seg.a.y + (seg.b.y - seg.a.y) * u;
        pulse.segs.forEach(s => { if (s.s < dist) { ctx.strokeStyle = mode ? 'rgba(127,216,176,.55)' : 'rgba(255,138,92,.5)'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(s.a.x, s.a.y); const uu = clamp((dist - s.s) / s.d, 0, 1); ctx.lineTo(s.a.x + (s.b.x - s.a.x) * uu, s.a.y + (s.b.y - s.a.y) * uu); ctx.stroke(); s.a.glow = 1; } });
        pulse.trail.push({ x, y }); if (pulse.trail.length > 18) pulse.trail.shift();
        pulse.trail.forEach((p, i) => { ctx.fillStyle = (mode ? 'rgba(127,216,176,' : 'rgba(255,138,92,') + (i / 18) * 0.5 + ')'; ctx.beginPath(); ctx.arc(p.x, p.y, 1 + i / 6, 0, 7); ctx.fill(); });
        const g = ctx.createRadialGradient(x, y, 0, x, y, 22); g.addColorStop(0, mode ? 'rgba(127,216,176,.9)' : 'rgba(255,138,92,.9)'); g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 22, 0, 7); ctx.fill();
        if (f >= 1 && now - pulse.t > pulse.dur + 1100) { mode = 1 - mode; nodes.forEach(n => n.glow = 0); startPulse(); }
      }
      // nodes
      nodes.forEach(n => {
        const md = Math.hypot(n.x - mouse.x, n.y - mouse.y), near = md < 120 ? 1 - md / 120 : 0;
        n.glow *= 0.985;
        const a = 0.35 + 0.25 * Math.sin(t * 1.4 + n.ph) + near * 0.5 + n.glow * 0.6;
        ctx.fillStyle = n.k < 0 ? C.gold : LC[n.k]; ctx.globalAlpha = clamp(a, 0.12, 1);
        ctx.beginPath(); ctx.arc(n.x, n.y, n.r + near * 2 + n.glow * 1.5, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
      });
      ctx.fillStyle = C.gold; ctx.font = '11px ui-monospace, monospace'; ctx.textAlign = 'left';
      const IN = nodes[nodes.length - 2], OUT = nodes[nodes.length - 1];
      ctx.fillText('요청', IN.x - 4, IN.y + 20); ctx.textAlign = 'right'; ctx.fillText('결과', OUT.x + 4, OUT.y + 20);
      if (!RM) requestAnimationFrame(frame);
    }
    build(); startPulse();
    if (RM) { pulse.t = performance.now() - pulse.dur; frame(performance.now()); }
    else requestAnimationFrame(frame);
    let rt; addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { build(); startPulse(); if (RM) frame(performance.now()); }, 150); });
    cv.parentElement.addEventListener('pointermove', e => { const r = cv.getBoundingClientRect(); mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top; });
    new IntersectionObserver(es => { visible = es[0].isIntersecting; }).observe(cv);
  })();

  /* ── 01: v2 vs v3 pairs with View Transitions ── */
  (function pairs() {
    const rows = [
      ['계층', '작업 성격에 따라 L3–L0 중 하나를 고른다', '열한 개 의미 단위마다 L3–L0를 따로 고른다', 'interpret · plan_consistency · retrieve · read_knowledge · route · execute · verify · recover · extract · evaluate · select'],
      ['공통 실행기', '모든 계층이 같은 권한·예산·도구 계약을 쓴다', '호스트가 키·전송·예산·정지를 소유하고 모든 계층이 같은 효과 통로를 지난다', 'L3 네이티브는 Run마다 격리된 bubblewrap 방에서 실행'],
      ['경험 저장소', '입력·판단·행동·결과를 연결해 기록한다', '세션·Goal·Run 원장과 체크포인트·영수증이 SQLite 한 곳에 남는다', '두 번째 효과 원장을 만들지 않는다'],
      ['검증', '모델의 자기평가를 성공 라벨로 쓰지 않는다', '모델의 완료 문구는 unverified, 성공은 호스트의 독립 판정이 정한다', '파일 조건 · 해시 · 원 요청 시험의 실행 영수증'],
      ['경로 전환', '독립 평가와 그림자 실행 뒤 제한 적용', '후보 → 그림자 → 봉인 평가 → 명시 채택 → 묶음 전체 복귀', '실행·검증 후보는 짝으로만 채택'],
      ['구조 진화', '모듈 경계와 연결을 변형해 선별한다', '전체 구조 묶음을 admission에 고정하고 원자적으로 교체한다', '큰 구조 탐색은 근거가 쌓일 때까지 보류'],
      ['첫 실험', '로컬 문서 분류·복사', '통계·문서·코드·후속 업무를 실제 모델과 바닐라 대조군으로 시험', '실패 원본을 보존한 채 다음 버전 설계에 사용'],
    ];
    const box = $('pairs');
    const render = m => {
      box.dataset.mode = m; box.innerHTML = '';
      rows.forEach((r, i) => {
        const p = el('div', 'pair', '', box); p.style.viewTransitionName = 'pair' + i;
        el('div', 'k', r[0], p);
        const v = el('div', 'v', '', p); v.textContent = m === 'v2' ? r[1] : r[2];
        if (m === 'v3') { const s = el('small', '', '', v); s.textContent = r[3]; }
      });
    };
    render('v3');
    document.querySelectorAll('#shift .toggle button').forEach(b => b.addEventListener('click', () => {
      const m = b.dataset.mode; if (box.dataset.mode === m) return;
      document.querySelectorAll('#shift .toggle button').forEach(x => x.setAttribute('aria-pressed', x === b));
      if (document.startViewTransition && !RM) document.startViewTransition(() => render(m)); else render(m);
    }));
  })();

  /* ── 02: controller orbit ── */
  (function orbit() {
    const owns = [
      ['키', '키와 전송', '실제 provider 키와 HTTPS 전송은 호스트에만 있다. 실행 방에는 Run 전용 capability만 간다.'],
      ['예', '예산', '모든 호출 시도는 보내기 전에 원자적으로 차감한다. 오류·취소도 환불하지 않는다.'],
      ['원', '원장', '세션·Goal·Run과 체크포인트가 SQLite에 남는다. 모델이 고칠 수 없는 곳이다.'],
      ['정', '정지와 만료', '“그만해”와 절대 만료 시각은 모델 응답 뒤에도, 효과 직전에도 다시 확인한다.'],
      ['효', '효과 통로', '파일 쓰기·실행은 허용된 통로로만 일어나고 의도와 영수증이 남는다.'],
      ['판', '판정', '성공 여부는 결과를 만든 모델이 아닌 독립 검증이 정한다.'],
    ];
    const list = $('ownlist'), ring = $('orbitRing'), props = $('orbitProps'), mg = $('orbitModels');
    const items = owns.map((o, i) => {
      const d = el('div', 'own rv', '', list); d.style.setProperty('--d', i);
      el('div', 'ic', o[0], d); const tx = el('div', '', '', d); el('h3', '', o[1], tx); el('p', '', o[2], tx);
      const a = -Math.PI / 2 + i * Math.PI / 3, x = 260 + 150 * Math.cos(a), y = 260 + 150 * Math.sin(a);
      const g = svg('g', {}, ring);
      const c = svg('circle', { cx: x, cy: y, r: 26, fill: '#101d1a', stroke: '#3a5a50', 'stroke-width': 1.5 }, g);
      const t = svg('text', { x, y: y + 5, 'text-anchor': 'middle', class: 'svg-title' }, g); t.textContent = o[0];
      return { d, c, x, y };
    });
    if (!CSS.supports('animation-timeline: view()')) items.forEach(it => onView(it.d, () => it.d.classList.add('in')));
    const models = ['고성능 모델', '저비용 모델', '로컬 모델'].map((name, i) => {
      const g = svg('g', {}, mg);
      svg('circle', { r: 20, fill: '#2a1d16', stroke: C.l3, 'stroke-width': 1.5 }, g);
      const t = svg('text', { y: 38, 'text-anchor': 'middle', class: 'svg-label' }, g); t.textContent = name;
      return { g, a0: i * 2.094 };
    });
    let cur = 0, active = false, t0 = performance.now(), flights = [];
    onView($('court'), () => active = true, { once: false, leave: () => active = false, margin: '0px' });
    function highlight(i) { items.forEach((it, j) => { it.d.classList.toggle('on', i === j); it.c.setAttribute('stroke', i === j ? C.mint : '#3a5a50'); }); }
    function tick(now) {
      const t = (now - t0) / 1000;
      models.forEach(m => { const a = m.a0 + t * 0.12; m.x = 260 + 222 * Math.cos(a); m.y = 260 + 222 * Math.sin(a); m.g.setAttribute('transform', `translate(${m.x.toFixed(1)},${m.y.toFixed(1)})`); });
      if (active && !RM && (!flights.length || now - flights[flights.length - 1].t > 1500)) {
        const m = models[(Math.random() * 3) | 0], gate = items[cur];
        const dot = svg('circle', { r: 6, fill: C.l3 }, props);
        flights.push({ dot, m, gate, t: now, ok: Math.random() > 0.3, gi: cur });
        cur = (cur + 1) % items.length;
      }
      flights = flights.filter(f => {
        const p = (now - f.t) / 1300;
        if (p < 0.5) { const u = ease(p * 2); f.dot.setAttribute('cx', f.m.x + (f.gate.x - f.m.x) * u); f.dot.setAttribute('cy', f.m.y + (f.gate.y - f.m.y) * u); }
        else if (p < 1) { const u = ease((p - .5) * 2); f.dot.setAttribute('cx', f.gate.x + (260 - f.gate.x) * u); f.dot.setAttribute('cy', f.gate.y + (260 - f.gate.y) * u); if (!f.lit) { f.lit = 1; highlight(f.gi); } }
        else if (p < 1.6) { const u = (p - 1) / .6; f.dot.setAttribute('r', 6 + u * 60); f.dot.setAttribute('fill', 'none'); f.dot.setAttribute('stroke', f.ok ? C.mint : C.red); f.dot.setAttribute('stroke-width', 2); f.dot.setAttribute('opacity', 1 - u); }
        else { f.dot.remove(); return false; }
        return true;
      });
      requestAnimationFrame(tick);
    }
    highlight(0); requestAnimationFrame(tick);
  })();

  /* ── 03: sticky journey (scroll-linked packet + lit track) ── */
  (function journey() {
    const labels = [['대화', 'ChatService'], ['고정', 'admission'], ['의도 계약', 'intent'], ['계층 선택', 'route · select'], ['격리 실행', 'native · budget'], ['독립 검증', 'acceptance'], ['체크포인트', 'Goal'], ['경험', 'episode']];
    const pts = labels.map((_, i) => ({ x: i % 2 ? 300 : 160, y: 50 + i * 77 }));
    let d = `M${pts[0].x} ${pts[0].y}`;
    for (let i = 1; i < pts.length; i++) { const a = pts[i - 1], b = pts[i], my = (a.y + b.y) / 2; d += ` C${a.x} ${my} ${b.x} ${my} ${b.x} ${b.y}`; }
    const track = $('jTrack'), lit = $('jLit'), pkt = $('jPacket'), ng = $('jNodes');
    track.setAttribute('d', d); lit.setAttribute('d', d);
    const L = track.getTotalLength();
    // cumulative length at each node
    const at = pts.map((p, i) => { if (!i) return 0; let lo = 0, hi = L; for (let k = 0; k < 30; k++) { const m = (lo + hi) / 2; track.getPointAtLength(m).y < p.y ? lo = m : hi = m; } return (lo + hi) / 2; });
    lit.style.strokeDasharray = L; lit.style.strokeDashoffset = L;
    const nodes = labels.map((lb, i) => {
      const g = svg('g', { class: 'node' }, ng); const p = pts[i], right = i % 2;
      svg('circle', { cx: p.x, cy: p.y, r: 22, class: 'node-ring' }, g);
      const n = svg('text', { x: p.x, y: p.y + 4, 'text-anchor': 'middle', class: 'svg-label' }, g); n.textContent = String(i + 1).padStart(2, '0');
      const t = svg('text', { x: right ? p.x + 36 : p.x - 36, y: p.y - 2, 'text-anchor': right ? 'start' : 'end', class: 'svg-title' }, g); t.textContent = lb[0];
      const s = svg('text', { x: right ? p.x + 36 : p.x - 36, y: p.y + 16, 'text-anchor': right ? 'start' : 'end', class: 'svg-label' }, g); s.textContent = lb[1];
      return g;
    });
    const steps = [...document.querySelectorAll('#steps .step')];
    function update() {
      const mid = innerHeight * (innerWidth < 960 ? 0.74 : 0.5);
      const cs = steps.map(s => { const r = s.getBoundingClientRect(); return r.top + r.height / 2; });
      let idx = 0; for (let i = 0; i < cs.length; i++) if (cs[i] <= mid) idx = i;
      let frac = 0; if (idx < cs.length - 1) frac = clamp((mid - cs[idx]) / (cs[idx + 1] - cs[idx]), 0, 1);
      if (cs[0] > mid) frac = 0;
      const len = idx < at.length - 1 ? at[idx] + (at[idx + 1] - at[idx]) * frac : at[at.length - 1];
      lit.style.strokeDashoffset = L - len;
      const p = track.getPointAtLength(len); pkt.setAttribute('cx', p.x); pkt.setAttribute('cy', p.y);
      const near = frac > 0.5 && idx < steps.length - 1 ? idx + 1 : idx;
      steps.forEach((s, i) => s.classList.toggle('active', i === near));
      nodes.forEach((g, i) => { g.classList.toggle('on', i === near); g.classList.toggle('done', i < near); });
      pkt.setAttribute('fill', LC[3 - Math.min(3, Math.floor(len / L * 4))]);
    }
    addEventListener('scroll', () => requestAnimationFrame(update), { passive: true }); update();
  })();

  /* ── 04: sandbox simulator ── */
  (function sandbox() {
    const MAX = 24; let left = MAX, n = 0, touched = false;
    const log = $('sbLog'), bn = $('budgetN'), bar = $('budgetBar'), agent = $('agentDot');
    const say = (cls, txt) => { const d = el('div', cls, '', null); d.textContent = txt; log.prepend(d); while (log.children.length > 9) log.lastChild.remove(); };
    const move = (x, y) => { if (RM) return; agent.animate([{ transform: 'translate(0,0)' }, { transform: `translate(${x}px,${y}px)` }, { transform: 'translate(0,0)' }], { duration: 900, easing: 'cubic-bezier(.2,.8,.2,1)' }); };
    const flash = id => { const g = $(id); g.animate([{ opacity: .25 }, { opacity: 1 }, { opacity: 1 }, { opacity: .25 }], { duration: 1200 }); };
    const render = () => { bn.textContent = `${left} / ${MAX}`; bar.style.width = (left / MAX * 100) + '%'; };
    const acts = {
      call() {
        move(0, 80);
        if (left <= 0) { say('no', '예산 소진 → 새 호출 거절, Goal 정지'); return; }
        left--; n++; render();
        const r = Math.random();
        if (r < .2) say('warn', `#${n} 예약 → 전송 → 오류 · 환불 없음`);
        else say('ok', `#${n} 예약(선차감) → 전송 → 응답 · 완료 문구는 unverified`);
      },
      net() { move(150, -40); flash('netX'); say('no', '차단 · 네트워크 namespace 밖으로 나갈 수 없음'); },
      peek() { move(-170, -10); flash('peekX'); say('no', '없음 · 이전 Run 디렉터리는 이 방에 마운트되지 않음'); },
      write() { move(-70, -110); say('ok', '/work/report.md 기록 → 호스트가 해시로 따로 검증'); },
    };
    document.querySelectorAll('#sbButtons button').forEach(b => b.addEventListener('click', () => { touched = true; acts[b.dataset.act](); }));
    render();
    const seq = ['write', 'call', 'net', 'call', 'peek', 'call']; let k = 0, timer = null;
    onView($('sandbox'), () => { if (RM || timer) return; timer = setInterval(() => { if (touched) { clearInterval(timer); return; } acts[seq[k++ % seq.length]](); if (left < 6) { left = MAX; render(); } }, 1700); }, { margin: '0px' });
  })();

  /* ── 05: durable goal crash & resume ── */
  (function durable() {
    const box = $('cps'), runner = $('runner'), crash = $('crash');
    const N = 5, xs = [...Array(N)].map((_, i) => 8 + i * (84 / (N - 1)));
    const cps = xs.map((x, i) => { const c = el('div', 'cp', `${i + 1}`, box); c.style.left = x + '%'; const l = el('label', '', `단계 ${i + 1}`, c); l.style.left = '-14px'; return c; });
    const states = [...document.querySelectorAll('#dstate span')];
    const st = s => states.forEach(x => x.classList.toggle('on', x.dataset.s === s));
    const wait = ms => new Promise(r => setTimeout(r, ms));
    const go = async (from, to, ms) => { if (RM) { runner.style.left = xs[to] + '%'; return; } await runner.animate([{ left: xs[from] + '%' }, { left: xs[to] + '%' }], { duration: ms, easing: 'ease-in-out', fill: 'forwards' }).finished; runner.style.left = xs[to] + '%'; };
    let running = false;
    async function loop() {
      if (running) return; running = true;
      while (true) {
        cps.forEach(c => c.classList.remove('v')); runner.style.left = xs[0] + '%'; runner.style.opacity = 1; st('running');
        await wait(500);
        for (let i = 0; i < 2; i++) { await go(i, i + 1, 900); cps[i].classList.add('v'); }
        await go(2, 2, 10); await wait(500);
        crash.classList.remove('show'); void crash.offsetWidth; crash.classList.add('show'); runner.style.opacity = .15; st('lost');
        await wait(1400); st('recheck');
        for (let i = 0; i < 2; i++) { cps[i].animate([{ transform: 'scale(1)' }, { transform: 'scale(1.35)' }, { transform: 'scale(1)' }], { duration: 450 }); await wait(500); }
        st('continue'); runner.style.opacity = 1; await wait(300);
        for (let i = 2; i < N; i++) { await go(i, Math.min(i + 1, N - 1), 800); cps[i].classList.add('v'); }
        st('succeeded'); await wait(2600);
        if (RM) break;
      }
    }
    onView($('durableBox'), loop);
  })();

  /* ── 06: semantic unit matrix scrubber ── */
  (function matrix() {
    const units = [['interpret', '요청 해석', 90], ['plan_consistency', '계획 정합', 70], ['retrieve', '검색', 45], ['read_knowledge', '지식 읽기', 60], ['route', '경로 선택', 35], ['execute', '실행', 40], ['verify', '검증', 25], ['recover', '복구', 80], ['extract', '경험 추출', 50], ['evaluate', '평가', 95], ['select', '후보 선택', 30]];
    const m = $('matrix');
    ['의미 단위', 'L3 숙고', 'L2 숙련', 'L1 결정', 'L0 실행'].forEach((h, i) => { const d = el('div', 'h', h, m); d.setAttribute('role', 'columnheader'); if (!i) d.style.textAlign = 'left'; });
    const cells = units.map(u => { const name = el('div', 'u', `${u[1]} <span class="mono small">${u[0]}</span>`, m); name.title = u[0]; name.setAttribute('role', 'rowheader'); return [0, 1, 2, 3].map(k => { const c = el('div', 'c', '', m); c.style.setProperty('--lc', LC[3 - k]); c.setAttribute('role', 'cell'); return c; }); });
    const costs = [100, 35, 12, 4];
    const cl = $('costline'); const bars = units.map(() => el('i', '', '', cl));
    const inp = $('exp'), out = $('expOut');
    const level = (e, hard) => { const s = e / Math.max(1, 100 - hard * 0.7); return s < .35 ? 3 : s < .65 ? 2 : s < .95 ? 1 : 0; }; // hard units descend slower; evaluate stays high
    function set(e) {
      let sum = 0;
      units.forEach((u, i) => {
        let lv = level(e, u[2]); if (u[0] === 'evaluate' || u[0] === 'interpret') lv = Math.max(lv, 2);
        cells[i].forEach((c, k) => c.classList.toggle('on', k === 3 - lv));
        bars[i].style.height = (costs[3 - lv]) * 0.6 + 'px'; sum += costs[3 - lv];
      });
      out.textContent = `${e} · ${e < 15 ? '처음 보는 일' : e < 60 ? '익숙해지는 중' : '숙련된 일'} · 상대 비용 ${Math.round(sum / 11)}`;
    }
    let touched = false;
    inp.addEventListener('input', () => { touched = true; set(+inp.value); });
    set(0);
    onView(m, () => {
      if (RM) { inp.value = 70; set(70); return; }
      const t0 = performance.now();
      const step = now => { if (touched) return; const f = clamp((now - t0) / 4200, 0, 1), v = Math.round(ease(f) * 85); inp.value = v; set(v); if (f < 1) requestAnimationFrame(step); };
      requestAnimationFrame(step);
    });
  })();

  /* ── 07: promotion lifecycle ── */
  (function lifecycle() {
    const g = $('lifeG'), chip = $('lifeChip');
    const st = [['경험', 'episode', 20], ['후보', '양성 사례 2 · 출처', 175], ['그림자', 'shadow 비교', 330], ['짝 구성', '실행 + 검증', 485], ['봉인 평가', 'sealed final', 640], ['명시 채택', 'adopt', 795], ['활성', 'active bundle', 950]];
    const W = 130, Y = 70, Hh = 62;
    const boxes = st.map(s => { const b = svg('g', { class: 'st' }, g); svg('rect', { x: s[2], y: Y, width: W, height: Hh, rx: 12 }, b); const t = svg('text', { x: s[2] + W / 2, y: Y + 28, 'text-anchor': 'middle', class: 'svg-title' }, b); t.textContent = s[0]; const u = svg('text', { x: s[2] + W / 2, y: Y + 47, 'text-anchor': 'middle', class: 'svg-label' }, b); u.textContent = s[1]; return b; });
    for (let i = 1; i < st.length; i++) svg('path', { class: 'ln', d: `M${st[i - 1][2] + W} ${Y + Hh / 2} L${st[i][2] - 4} ${Y + Hh / 2}` }, g);
    const q = svg('g', { class: 'st' }, g); svg('rect', { x: 330, y: 210, width: 440, height: 54, rx: 12 }, q);
    const qt = svg('text', { x: 550, y: 242, 'text-anchor': 'middle', class: 'svg-title' }, q); qt.textContent = '격리 · 반례로 기록 · 이전 묶음 유지';
    svg('path', { class: 'ln ret', d: `M${330 + W / 2} ${Y + Hh} L${330 + W / 2} 206` }, g);
    svg('path', { class: 'ln ret', d: `M${640 + W / 2} ${Y + Hh} L${640 + W / 2} 206` }, g);
    svg('path', { class: 'ln ret', d: `M${950 + W / 2} ${Y + Hh} C${950 + W / 2} 240 ${830} 237 ${774} 237` }, g);
    const rb = svg('text', { x: 1015, y: 196, 'text-anchor': 'middle', class: 'svg-label' }, g); rb.textContent = '회귀 감지 → 묶음 전체 복귀';
    const cx = i => st[i][2] + W / 2, cy = Y + Hh / 2;
    const wait = ms => new Promise(r => setTimeout(r, ms));
    const moveTo = (x, y, ms = 650) => RM ? (chip.setAttribute('cx', x), chip.setAttribute('cy', y), Promise.resolve()) : new Promise(res => {
      const x0 = +chip.getAttribute('cx') || x, y0 = +chip.getAttribute('cy') || y, t0 = performance.now();
      const f = now => { const u = ease(clamp((now - t0) / ms, 0, 1)); chip.setAttribute('cx', x0 + (x - x0) * u); chip.setAttribute('cy', y0 + (y - y0) * u); u < 1 ? requestAnimationFrame(f) : res(); };
      requestAnimationFrame(f);
    });
    const mark = (i, cls) => { boxes.forEach(b => b.classList.remove('on')); if (i >= 0) boxes[i].classList.add(cls); };
    const scripts = [{ fail: 2 }, { fail: -1, rollback: false }, { fail: 4 }, { fail: -1, rollback: true }];
    let started = false;
    onView($('lifeSvg'), async () => {
      if (started) return; started = true; let r = 0;
      while (true) {
        const s = scripts[r++ % scripts.length];
        boxes.forEach(b => b.classList.remove('on', 'ok', 'bad')); q.classList.remove('bad');
        chip.setAttribute('fill', C.gold); chip.setAttribute('cx', cx(0)); chip.setAttribute('cy', cy);
        for (let i = 0; i < st.length; i++) {
          await moveTo(cx(i), cy); mark(i, 'on'); await wait(380);
          if (i === s.fail) { boxes[i].classList.add('bad'); chip.setAttribute('fill', C.red); await moveTo(cx(i), 237); q.classList.add('bad'); await wait(1300); break; }
          boxes[i].classList.add('ok');
        }
        if (s.fail === -1) {
          chip.setAttribute('fill', C.mint); await wait(1100);
          if (s.rollback) { boxes[6].classList.add('bad'); chip.setAttribute('fill', C.red); await moveTo(774, 237, 900); q.classList.add('bad'); await wait(1300); }
        }
        if (RM) break;
        await wait(500);
      }
    });
  })();

  /* ── 09: timeline + counters ── */
  (function timeline() {
    const ev = [
      ['a1', '10.07', '자연어에서 구조화된 계획으로', '오프라인 문법과 도구 없는 planner로 첫 Run을 만들었다.'],
      ['a2', '10.07', '불변 계획과 잠금', '계획 상태를 불변 포인터로 고정하고 잠금 전후 스키마를 맞췄다.'],
      ['a3', '10.07', '실제 모델 연결', '호환 API 워커와 격리 Python 샌드박스, 지식 도구를 붙였다.'],
      ['a4', '10.08', '끊겨도 이어지는 Goal', '체크포인트와 재시작 검증, 자연어 대화 서비스를 더했다.', 1],
      ['b1–b3', '10.08', '대화·예약·복구', '중복 억제, 예약 다리, 효과가 불확실한 Run의 정리 경로.'],
      ['b4', '10.08', '격리된 방', 'bubblewrap 네이티브 실행, 선차감 예산, 모델 없는 예약 실행.', 1],
      ['b5', '10.08', '배우기 시작하다', 'Goal 기반 경험과 L2/L1/L0 후보, 구조 묶음의 생애주기.', 1],
      ['b6–b8', '10.09', '의미 단위와 근거', '단위별 추적, 독립 검증기, 의도·근거 계약, 비밀 없는 모델 명세.'],
      ['b9–b10', '10.09', '첫 실제 비교', '일반 교훈과 11 단위 연결. 실제 모델 비교의 실패를 그대로 기록했다.'],
      ['b11–b12', '10.09', '출처 있는 입력', '입력 승인, 공유 예산, 프로젝트 실행 통로와 신뢰된 학습 검증.'],
      ['b13', '10.10', '처음부터 끝까지', '의도→실행→출처 있는 학습을 잇고, 32개 배정 실제 시험을 기록했다.', 1],
      ['b14', '10.10', '실패가 설계가 되다', 'b13의 빈틈을 메운 의무 전달·원본 완독·실행/검증 짝 학습.', 1],
      ['b14+', '10.14', '관측 장치', '그림자 예측, 문맥 기록, 사례 검색, 봉인 영수증 재대조.'],
    ];
    const tr = $('tlTrack');
    ev.forEach(e => { const d = el('div', 'ev' + (e[4] ? ' big' : ''), '', tr); el('div', 'vn', `${e[0]} <span class="small">· ${e[1]}</span>`, d); el('h3', '', e[2], d); el('p', '', e[3], d); });
    const tl = $('tl');
    // vertical wheel → horizontal when hovering the track (only if it can scroll further)
    tl.addEventListener('wheel', e => { if (Math.abs(e.deltaY) < Math.abs(e.deltaX)) return; const max = tl.scrollWidth - tl.clientWidth; if ((e.deltaY > 0 && tl.scrollLeft < max - 2) || (e.deltaY < 0 && tl.scrollLeft > 2)) { tl.scrollLeft += e.deltaY; e.preventDefault(); } }, { passive: false });
    document.querySelectorAll('[data-count]').forEach(n => onView(n, () => {
      const to = +n.dataset.count, t0 = performance.now(), fmt = v => v.toLocaleString('ko-KR');
      if (RM) { n.textContent = fmt(to); return; }
      const f = now => { const u = ease(clamp((now - t0) / 1600, 0, 1)); n.textContent = fmt(Math.round(to * u)); if (u < 1) requestAnimationFrame(f); };
      requestAnimationFrame(f);
    }));
  })();

  /* ── 10: scoreboard ── */
  onView($('score'), () => {
    const bars = [...document.querySelectorAll('#score .bar i')]; const total = bars.reduce((s, b) => s + +b.dataset.w, 0);
    bars.forEach((b, i) => setTimeout(() => b.style.width = (+b.dataset.w / total * 100) + '%', RM ? 0 : i * 220));
  });

  /* ── closing: particles converge into “R” ── */
  (function closing() {
    const cv = $('closingCanvas'), ctx = cv.getContext('2d'); let W, H, pts = [], on = false, t0 = 0;
    function build() {
      const dpr = Math.min(devicePixelRatio || 1, 2); W = cv.clientWidth; H = cv.clientHeight; cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const off = document.createElement('canvas'); off.width = W; off.height = H; const o = off.getContext('2d');
      const size = Math.min(H * 0.95, W * 0.6); o.font = `900 ${size}px Georgia, serif`; o.textAlign = 'center'; o.textBaseline = 'middle'; o.fillText('R', W / 2, H / 2);
      const data = o.getImageData(0, 0, W, H).data, gap = Math.max(7, Math.round(size / 55)); pts = [];
      for (let y = 0; y < H; y += gap) for (let x = 0; x < W; x += gap) if (data[(y * W + x) * 4 + 3] > 128) pts.push({ tx: x, ty: y, x: Math.random() * W, y: Math.random() * H, d: Math.random() * 0.6, c: LC[(Math.random() * 4) | 0] });
    }
    function draw(now) {
      ctx.clearRect(0, 0, W, H);
      const f = RM ? 1 : clamp((now - t0) / 2600, 0, 1);
      pts.forEach(p => { const u = ease(clamp((f - p.d * 0.5) / 0.7, 0, 1)); const x = p.x + (p.tx - p.x) * u, y = p.y + (p.ty - p.y) * u; ctx.fillStyle = p.c; ctx.globalAlpha = 0.14 + 0.26 * u; ctx.beginPath(); ctx.arc(x, y, 1.6, 0, 7); ctx.fill(); });
      ctx.globalAlpha = 1;
      if (on && f < 1) requestAnimationFrame(draw);
    }
    build();
    onView(cv.parentElement, () => { on = true; t0 = performance.now(); requestAnimationFrame(draw); }, { once: false, leave: () => on = false, margin: '0px' });
    let rt; addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { build(); draw(performance.now() + 1e5); }, 200); });
  })();
})();
