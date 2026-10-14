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
      if (hm) hm.innerHTML = mode ? '경로 · <b class="fast">반사</b>' : '경로 · <b>깊은 생각</b>';
      if (hh) hh.textContent = `신호가 지나는 연결 ${p.length - 1}`;
    }
    function frame(now) {
      if (!visible) return requestAnimationFrame(frame);
      ctx.clearRect(0, 0, W, H);
      const t = (now - t0) / 1000;
      // strata labels
      ctx.font = '11px ui-monospace, monospace'; ctx.textAlign = 'right';
      ['코드로 바로 실행', '정해진 선택', '작은 모델', '큰 모델 · 깊은 생각'].forEach((s, k) => { ctx.fillStyle = LC[k] + '55'; ctx.fillText(s, W - 14, bandY(k) - H * 0.07); });
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

  /* ── 02: controller orbit ── */
  (function orbit() {
    const owns = [
      ['예산', '쓸 수 있는 예산', '모델을 몇 번 부를지 호스트가 미리 정하고 셉니다. 다 쓰면 멈춥니다.'],
      ['범위', '손댈 수 있는 범위', '모델은 정해진 작업 공간 안에서만 일합니다. 다른 파일이나 외부로는 나가지 못합니다.'],
      ['판정', '끝났는지의 판단', '모델이 끝났다고 해도 그대로 믿지 않습니다. 결과를 따로 확인한 뒤에 성공으로 기록합니다.'],
    ];
    const list = $('ownlist'), ring = $('orbitRing'), props = $('orbitProps'), mg = $('orbitModels');
    const items = owns.map((o, i) => {
      const d = el('div', 'own rv', '', list); d.style.setProperty('--d', i);
      el('div', 'ic', o[0].slice(0,1), d); const tx = el('div', '', '', d); el('h3', '', o[1], tx); el('p', '', o[2], tx);
      const a = -Math.PI / 2 + i * 2 * Math.PI / 3, x = 260 + 150 * Math.cos(a), y = 260 + 150 * Math.sin(a);
      const g = svg('g', {}, ring);
      const c = svg('circle', { cx: x, cy: y, r: 32, fill: '#101d1a', stroke: '#3a5a50', 'stroke-width': 1.5 }, g);
      const t = svg('text', { x, y: y + 5, 'text-anchor': 'middle', class: 'svg-title' }, g); t.textContent = o[0];
      return { d, c, x, y };
    });
    if (!CSS.supports('animation-timeline: view()')) items.forEach(it => onView(it.d, () => it.d.classList.add('in')));
    const models = ['큰 모델', '작은 모델', '코드'].map((name, i) => {
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

  /* ── 06: semantic unit matrix scrubber ── */
  (function matrix() {
    const units = [['understand', '요청 이해하기', 90], ['find', '자료 찾기', 45], ['act', '작업 실행하기', 30], ['check', '결과 확인하기', 15]];
    const m = $('matrix');
    ['판단', '큰 모델', '작은 모델', '선택표', '코드'].forEach((h, i) => { const d = el('div', 'h', h, m); d.setAttribute('role', 'columnheader'); if (!i) d.style.textAlign = 'left'; });
    const cells = units.map(u => { const name = el('div', 'u', u[1], m); name.setAttribute('role', 'rowheader'); return [0, 1, 2, 3].map(k => { const c = el('div', 'c', '', m); c.style.setProperty('--lc', LC[3 - k]); c.setAttribute('role', 'cell'); return c; }); });
        const inp = $('exp'), out = $('expOut');
    const level = (e, hard) => { const s = e / Math.max(1, 100 - hard * 0.7); return s < .35 ? 3 : s < .65 ? 2 : s < .95 ? 1 : 0; }; // hard units descend slower; evaluate stays high
    function set(e) {
      units.forEach((u, i) => {
        let lv = level(e, u[2]); if (u[0] === 'understand') lv = Math.max(lv, 2);
        cells[i].forEach((c, k) => c.classList.toggle('on', k === 3 - lv));
      });
      out.textContent = e < 15 ? '처음 하는 일' : e < 60 ? '익숙해지는 중' : '여러 번 해 본 일';
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

  /* ── 04: learn carefully ── */
  (function lifecycle() {
    const g = $('lifeG'), chip = $('lifeChip');
    const st = [['경험', '반복된 일의 기록', 30], ['후보', '찾아낸 지름길', 250], ['따로 시험', '실제 일과 분리', 470], ['채택', '다음 일부터 사용', 690]];
    const W = 180, Y = 50, Hh = 70;
    const boxes = st.map(s => { const b = svg('g', { class: 'st' }, g); svg('rect', { x: s[2], y: Y, width: W, height: Hh, rx: 14 }, b); const t = svg('text', { x: s[2] + W / 2, y: Y + 32, 'text-anchor': 'middle', class: 'svg-title' }, b); t.textContent = s[0]; const u = svg('text', { x: s[2] + W / 2, y: Y + 52, 'text-anchor': 'middle', class: 'svg-label' }, b); u.textContent = s[1]; return b; });
    for (let i = 1; i < st.length; i++) svg('path', { class: 'ln', d: `M${st[i - 1][2] + W} ${Y + Hh / 2} L${st[i][2] - 4} ${Y + Hh / 2}` }, g);
    const q = svg('g', { class: 'st' }, g); svg('rect', { x: 360, y: 180, width: 220, height: 54, rx: 12 }, q);
    const qt = svg('text', { x: 470, y: 212, 'text-anchor': 'middle', class: 'svg-title' }, q); qt.textContent = '이전 방법 유지 · 되돌림';
    svg('path', { class: 'ln ret', d: `M${470 + W / 2 - 90} ${Y + Hh} L${470 + W / 2 - 90} 176` }, g);
    svg('path', { class: 'ln ret', d: `M${690 + W / 2} ${Y + Hh} C${690 + W / 2} 207 640 207 584 207` }, g);
    const lb = svg('text', { x: 780, y: 170, 'text-anchor': 'middle', class: 'svg-label' }, g); lb.textContent = '문제 발견 시';
    const cx = i => st[i][2] + W / 2, cy = Y + Hh / 2;
    const wait = ms => new Promise(r => setTimeout(r, ms));
    const moveTo = (x, y, ms = 700) => RM ? (chip.setAttribute('cx', x), chip.setAttribute('cy', y), Promise.resolve()) : new Promise(res => {
      const x0 = +chip.getAttribute('cx') || x, y0 = +chip.getAttribute('cy') || y, t0 = performance.now();
      const f = now => { const u = ease(clamp((now - t0) / ms, 0, 1)); chip.setAttribute('cx', x0 + (x - x0) * u); chip.setAttribute('cy', y0 + (y - y0) * u); u < 1 ? requestAnimationFrame(f) : res(); };
      requestAnimationFrame(f);
    });
    const scripts = [{ fail: false }, { fail: true }, { fail: false, back: true }];
    let started = false;
    onView($('lifeSvg'), async () => {
      if (started) return; started = true; let r = 0;
      while (true) {
        const s = scripts[r++ % scripts.length];
        boxes.forEach(b => b.classList.remove('on', 'ok', 'bad')); q.classList.remove('bad');
        chip.setAttribute('fill', C.gold); chip.setAttribute('cx', cx(0)); chip.setAttribute('cy', cy);
        let failed = false;
        for (let i = 0; i < st.length; i++) {
          await moveTo(cx(i), cy); boxes[i].classList.add('on'); await wait(450);
          if (i === 2 && s.fail) { boxes[i].classList.add('bad'); chip.setAttribute('fill', C.red); await moveTo(470, 207); q.classList.add('bad'); await wait(1500); failed = true; break; }
          boxes[i].classList.remove('on'); boxes[i].classList.add('ok');
        }
        if (!failed) {
          chip.setAttribute('fill', C.mint); await wait(1200);
          if (s.back) { boxes[3].classList.add('bad'); chip.setAttribute('fill', C.red); await moveTo(584, 207, 900); q.classList.add('bad'); await wait(1500); }
        }
        if (RM) break;
        await wait(600);
      }
    });
  })();

  /* ── 01: same request, five times ── */
  (function lanes() {
    const flat = [100, 100, 100, 100, 100], reflex = [100, 55, 30, 12, 8];
    const col = v => v > 70 ? C.l3 : v > 40 ? C.l2 : v > 20 ? C.l1 : C.l0;
    const tracks = [...document.querySelectorAll('#lanes .lane-track')];
    const bars = tracks.map(t => (t.dataset.kind === 'flat' ? flat : reflex).map(v => { const c = el('div', 'lane-cell', '', t); const b = el('i', '', '', c); b.style.background = col(v); b.dataset.v = v; return b; }));
    const play = () => {
      bars.forEach(row => row.forEach(b => { b.style.transition = 'none'; b.style.width = '0'; }));
      void document.body.offsetWidth;
      bars.forEach(row => row.forEach((b, i) => { b.style.transition = RM ? 'none' : `width .9s cubic-bezier(.2,.8,.2,1) ${i * 0.45}s`; b.style.width = b.dataset.v + '%'; }));
    };
    onView($('lanes'), play);
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
