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
      const hm = $('heroMode'), hh = null;
      if (hm) hm.innerHTML = mode ? '경로 · <b class="fast">바로 처리</b>' : '경로 · <b>깊은 생각</b>';
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

  /* ── scroll scenes: sticky stage, progress p∈[0,1] drives visual + one caption ── */
  const seg = (p, a, b) => clamp((p - a) / (b - a), 0, 1);
  const T = (parent, x, y, str, cls = 'vt', anchor = 'middle') => { const t = svg('text', { x, y, class: cls, 'text-anchor': anchor }, parent); t.textContent = str; return t; };
  const op = (n, v) => n.setAttribute('opacity', v.toFixed(3));
  const VIS = {};

  /* 01 같은 요청, 다섯 번 */
  VIS['s-repeat'] = (() => {
    const v = $('v-repeat');
    const card = svg('g', {}, v);
    svg('rect', { x: 20, y: 20, width: 260, height: 56, rx: 14, fill: '#1a2e28', stroke: C.gold }, card);
    T(card, 150, 57, '“보고서 정리해 줘”', 'vt');
    const X = i => 250 + i * 150, W = 130;
    const heads = [0, 1, 2, 3, 4].map(i => T(v, X(i) + W / 2, 125, `${i + 1}회차`, 'vl'));
    const lane = (y, name, widths, cols, labels) => {
      const g = svg('g', {}, v); T(g, 225, y + 32, name, 'vt', 'end');
      const bars = widths.map((w, i) => {
        svg('rect', { x: X(i), y, width: W, height: 48, rx: 10, fill: '#14241f' }, g);
        const b = svg('rect', { x: X(i), y, width: 0, height: 48, rx: 10, fill: cols[i] }, g);
        const l = labels ? T(g, X(i) + W / 2, y + 80, labels[i], 'vl') : null;
        return { b, w, l };
      });
      return { g, bars };
    };
    const now = lane(150, '지금', [W, W, W, W, W], [C.l3, C.l3, C.l3, C.l3, C.l3], ['큰 모델', '큰 모델', '큰 모델', '큰 모델', '큰 모델']);
    const rx = lane(300, 'REFLEX', [W, 74, 40, 16, 12], [C.l3, C.l2, C.l1, C.l0, C.l0], ['큰 모델', '작은 모델', '선택표', '코드', '코드']);
    T(rx.g, 225, 352, '', 'vl', 'end');
    const ring = svg('circle', { r: 14, fill: 'none', stroke: C.l3, 'stroke-width': 3 }, v);
    const note = T(v, 500, 470, '개념 그림 · 막대 길이 = 한 번 처리에 드는 시간과 비용', 'vs');
    return (p, t) => {
      op(card, seg(p, 0, .06));
      heads.forEach((h, i) => op(h, seg(p, .04 + i * .07, .08 + i * .07)));
      let live = null;
      now.bars.forEach((o, i) => { const k = seg(p, .1 + i * .07, .16 + i * .07); o.b.setAttribute('width', (o.w * ease(k)).toFixed(1)); op(o.l, k); if (k > 0 && k < 1) live = [X(i) + o.w * k, 174]; });
      op(now.g, 1 - .55 * seg(p, .58, .64));
      op(rx.g, seg(p, .58, .63));
      rx.bars.forEach((o, i) => { const k = seg(p, .63 + i * .06, .68 + i * .06); o.b.setAttribute('width', (o.w * ease(k)).toFixed(1)); op(o.l, k); if (k > 0 && k < 1) live = [X(i) + o.w * k, 324]; });
      if (live) { ring.setAttribute('cx', live[0]); ring.setAttribute('cy', live[1]); ring.setAttribute('r', 12 + 6 * Math.sin(t / 120)); op(ring, .9); } else op(ring, 0);
      op(note, seg(p, .1, .15));
    };
  })();

  /* 02 네 단계로 내려가기 */
  VIS['s-steps'] = (() => {
    const v = $('v-steps');
    const bands = [['큰 모델', '깊이 생각', C.l3], ['작은 모델', '익숙한 해석', C.l2], ['선택표', '정해진 고르기', C.l1], ['코드', '바로 실행', C.l0]];
    const BY = k => 20 + k * 112, BX = k => 20 + k * 46;
    const bg = bands.map((b, k) => {
      const g = svg('g', {}, v);
      svg('rect', { x: BX(k), y: BY(k), width: 980 - BX(k), height: 96, rx: 16, fill: '#101d1a', stroke: b[2], 'stroke-opacity': .55 }, g);
      T(g, BX(k) + 26, BY(k) + 44, b[0], 'vt', 'start').setAttribute('fill', b[2]);
      T(g, BX(k) + 26, BY(k) + 74, b[1], 'vl', 'start');
      return g;
    });
    const toks = [['요청 이해', 1, 1], ['자료 찾기', 3, 0], ['실행', 2, .55], ['결과 확인', 3, .8]].map((d, i) => {
      const g = svg('g', {}, v);
      const c = svg('circle', { r: 30, fill: C.l3 }, g);
      const halo = svg('circle', { r: 30, fill: 'none', stroke: C.l3, 'stroke-width': 2 }, g);
      const l = T(g, 0, 58, d[0], 'vl');
      return { g, c, halo, l, x: 470 + i * 140, final: d[1], speed: d[2], main: i === 1 };
    });
    const colAt = lv => [C.l3, C.l2, C.l1, C.l0][Math.round(lv)];
    return (p, t) => {
      bg.forEach((g, k) => { const a = seg(p, .02 + k * .05, .08 + k * .05); op(g, a); g.setAttribute('transform', `translate(${(1 - ease(a)) * 40},0)`); });
      toks.forEach(o => {
        const a = seg(p, .26, .34); op(o.g, a);
        let lv = 0;
        if (o.main) lv = 3 * ease(seg(p, .52, .72));
        else if (o.speed > 0) lv = o.final * ease(seg(p, .76, .76 + .22 * o.speed));
        else lv = o.final * ease(seg(p, .52, .72));
        const y = BY(lv) + 48;
        o.g.setAttribute('transform', `translate(${o.x},${y.toFixed(1)})`);
        o.c.setAttribute('fill', colAt(lv)); o.halo.setAttribute('stroke', colAt(lv));
        const think = lv < .5 ? 1 : 0;
        o.halo.setAttribute('r', 30 + think * (8 + 6 * Math.sin(t / 160 + o.x)));
        op(o.halo, think * .7);
        if (!o.main && p < .76) op(o.g, a * (p > .5 ? .35 : 1));
      });
    };
  })();

  /* 03 호스트가 쥐는 세 가지 */
  VIS['s-host'] = (() => {
    const v = $('v-host');
    const model = svg('g', { transform: 'translate(130,250)' }, v);
    const mPulse = svg('circle', { r: 58, fill: 'none', stroke: C.l3, 'stroke-width': 2 }, model);
    svg('circle', { r: 52, fill: '#2a1d16', stroke: C.l3, 'stroke-width': 2 }, model); T(model, 0, 9, '모델', 'vt');
    const flow = svg('path', { d: 'M190 250 L400 250', stroke: C.gold, 'stroke-width': 3, 'stroke-dasharray': '8 10', fill: 'none' }, v);
    const flowL = T(v, 295, 232, '일 수행', 'vl');
    const host = svg('g', { transform: 'translate(490,250)' }, v);
    svg('circle', { r: 84, fill: '#14241f', stroke: C.mint, 'stroke-width': 2.5 }, host); T(host, 0, 2, '호스트', 'vt');
    const tags = ['예산', '범위', '확인'].map((s, i) => { const a = [-2.3, -0.84, 1.57][i], g = svg('g', { transform: `translate(${(490 + 132 * Math.cos(a)).toFixed(1)},${(250 + 132 * Math.sin(a)).toFixed(1)})` }, v); svg('rect', { x: -40, y: -20, width: 80, height: 40, rx: 20, fill: '#101d1a', stroke: C.line }, g); const tx = T(g, 0, 8, s, 'vl'); return { g, tx, r: g.firstChild }; });
    // budget pips
    const bud = svg('g', {}, v); const pips = [...Array(10)].map((_, i) => svg('rect', { x: 340 + i * 31, y: 40, width: 24, height: 24, rx: 6, fill: C.gold }, bud));
    const budL = T(bud, 490, 100, '', 'vl');
    // scope box
    const scope = svg('g', {}, v);
    svg('rect', { x: 690, y: 130, width: 280, height: 240, rx: 18, fill: 'none', stroke: C.mint, 'stroke-width': 2, 'stroke-dasharray': '10 8' }, scope);
    T(scope, 830, 405, '일할 수 있는 범위', 'vl');
    const wall = svg('line', { x1: 970, y1: 150, x2: 970, y2: 350, stroke: C.red, 'stroke-width': 5 }, scope);
    const dot = svg('circle', { r: 14, fill: C.l3 }, scope);
    // check
    const chk = svg('g', {}, v);
    const bub = svg('g', { transform: 'translate(130,150)' }, chk); svg('rect', { x: -70, y: -26, width: 140, height: 44, rx: 22, fill: '#2a1d16', stroke: C.l3 }, bub); T(bub, 0, 4, '다 했어요', 'vl');
    const look = svg('path', { d: 'M690 250 L578 250', stroke: C.mint, 'stroke-width': 3, fill: 'none' }, chk);
    const mark = svg('path', { d: 'M474 284 l11 11 l22 -24', stroke: C.mint, 'stroke-width': 7, fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, chk);
    const mL = T(chk, 490, 450, '결과를 확인한 뒤에 성공으로 기록', 'vl');
    return (p, t) => {
      op(model, seg(p, 0, .05)); mPulse.setAttribute('r', 56 + 6 * Math.sin(t / 200));
      op(flow, seg(p, .04, .1)); op(flowL, seg(p, .04, .1)); flow.setAttribute('stroke-dashoffset', (-t / 25).toFixed(1));
      op(host, seg(p, .06, .14));
      const beats = [[.2, .45], [.45, .7], [.7, 1.01]];
      tags.forEach((o, i) => { op(o.g, seg(p, .08, .14)); const on = p >= beats[i][0]; o.r.setAttribute('stroke', on ? C.mint : C.line); o.r.setAttribute('fill', on ? '#173229' : '#101d1a'); });
      op(bud, seg(p, .2, .24));
      const used = Math.floor(seg(p, .25, .42) * 10);
      pips.forEach((r, i) => { r.setAttribute('fill', i < 10 - used ? C.gold : '#2a423a'); });
      budL.textContent = used >= 10 ? '다 쓰면 멈춤' : `남은 예산 ${10 - used}`; budL.setAttribute('fill', used >= 10 ? C.red : C.gold);
      op(scope, seg(p, .45, .5));
      const ph = (t / 1400) % 2, u = ph < 1 ? ph : 2 - ph, x = 712 + u * 244;
      dot.setAttribute('cx', x.toFixed(1)); dot.setAttribute('cy', (250 + 60 * Math.sin(t / 500)).toFixed(1));
      op(wall, p > .45 && u > .93 ? 1 : .15);
      op(chk, seg(p, .7, .74));
      op(look, seg(p, .76, .8)); op(mark, seg(p, .82, .86)); op(mL, seg(p, .82, .86));
    };
  })();

  /* 04 시험하고, 통과하면 쓰고, 문제가 보이면 되돌리기 */
  VIS['s-adopt'] = (() => {
    const v = $('v-adopt');
    const B = [['경험', 40], ['지름길 후보', 285], ['따로 시험', 530], ['사용', 775]], Y = 120, W = 185, H = 86;
    const lab = svg('g', {}, v);
    svg('rect', { x: 505, y: 90, width: 235, height: 146, rx: 20, fill: 'rgba(143,179,255,.06)', stroke: C.l1, 'stroke-dasharray': '8 8' }, lab);
    T(lab, 622, 80, '실제 일과 분리된 곳', 'vl');
    const boxes = B.map(b => { const g = svg('g', {}, v); const r = svg('rect', { x: b[1], y: Y, width: W, height: H, rx: 16, fill: '#101d1a', stroke: C.line, 'stroke-width': 2 }, g); T(g, b[1] + W / 2, Y + 52, b[0], 'vt'); return { g, r }; });
    const arrows = [0, 1, 2].map(i => svg('path', { d: `M${B[i][1] + W + 6} ${Y + H / 2} L${B[i + 1][1] - 8} ${Y + H / 2}`, stroke: C.line_2 || '#3a5a50', 'stroke-width': 3, fill: 'none', 'marker-end': 'url(#ah)' }, v));
    const defs = svg('defs', {}, v); const mk = svg('marker', { id: 'ah', viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 6, markerHeight: 6, orient: 'auto' }, defs); svg('path', { d: 'M0 0L10 5L0 10z', fill: '#3a5a50' }, mk);
    const back = svg('g', {}, v);
    const bb = svg('rect', { x: 285, y: 330, width: 260, height: 80, rx: 16, fill: '#101d1a', stroke: C.line, 'stroke-width': 2 }, back); T(back, 415, 378, '이전 방법으로', 'vt');
    const ret = svg('path', { d: `M${775 + W / 2} ${Y + H} C${775 + W / 2} 370 700 370 548 370`, stroke: C.red, 'stroke-width': 3, 'stroke-dasharray': '8 8', fill: 'none' }, v);
    const pass = T(v, 622, 270, '통과', 'vt'); pass.setAttribute('fill', C.mint);
    const chip = svg('circle', { r: 16, fill: C.gold }, v);
    const P = i => [B[i][1] + W / 2, Y + H / 2 - 0];
    const lerp = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
    const retPt = k => { const L = ret.getTotalLength(); const q = ret.getPointAtLength(L * k); return [q.x, q.y]; };
    return (p, t) => {
      boxes.forEach((o, i) => op(o.g, seg(p, i * .05, .05 + i * .05)));
      arrows.forEach((a, i) => op(a, seg(p, .05 + i * .05, .1 + i * .05)));
      op(lab, seg(p, .22, .28)); op(back, seg(p, .66, .7)); op(ret, seg(p, .66, .7));
      let pos, col = C.gold, at = -1;
      if (p < .22) { pos = lerp(P(0), P(1), ease(seg(p, .08, .2))); at = p > .2 ? 1 : 0; }
      else if (p < .45) { pos = lerp(P(1), P(2), ease(seg(p, .24, .34))); at = 2; pos[1] += p > .34 ? 6 * Math.sin(t / 90) : 0; }
      else if (p < .65) { pos = lerp(P(2), P(3), ease(seg(p, .47, .58))); col = p > .5 ? C.mint : C.gold; at = p > .58 ? 3 : 2; }
      else { const k = ease(seg(p, .72, .9)); col = p > .7 ? C.red : C.mint; pos = k > 0 ? retPt(k) : P(3); if (k >= 1) { col = C.mint; } at = k >= 1 ? 9 : 3; }
      chip.setAttribute('cx', pos[0].toFixed(1)); chip.setAttribute('cy', pos[1].toFixed(1)); chip.setAttribute('fill', col);
      op(pass, seg(p, .5, .54) * (1 - seg(p, .66, .7)));
      boxes.forEach((o, i) => o.r.setAttribute('stroke', i === at ? (at === 3 && p > .7 ? C.red : C.mint) : C.line));
      bb.setAttribute('stroke', at === 9 ? C.mint : C.line);
    };
  })();

  /* 05 지금 어디까지 */
  VIS['s-now'] = (() => {
    const v = $('v-now');
    const parts = [[10, C.mint, '통과'], [12, C.red, '실패'], [9, C.gold, '사전 조건에서 막힘'], [1, C.dim, '확인 못 함']];
    let x = 80; const bars = parts.map(pt => { const w = 840 * pt[0] / 32; const r = svg('rect', { x, y: 60, width: 0, height: 64, fill: pt[1] }, v); const l = T(v, x + w / 2, 102, String(pt[0]), 'vt'); l.setAttribute('fill', '#08110e'); const o = { r, l, x, w }; x += w; return o; });
    const leg = T(v, 500, 160, '통과 10 · 실패 12 · 사전 조건에서 막힘 9 · 확인 못 함 1', 'vl');
    const cards = [['통제하는 바탕', '동작 확인', C.mint, .36], ['단순 업무', '바로 처리 확인', C.mint, .5], ['빨라지는가', '측정 예정', C.gold, .66]].map((c, i) => {
      const g = svg('g', { transform: `translate(${80 + i * 290},230)` }, v); g.dataset.x = 80 + i * 290;
      svg('rect', { width: 260, height: 150, rx: 18, fill: '#101d1a', stroke: c[2], 'stroke-width': 2 }, g);
      T(g, 130, 62, c[0], 'vt'); const s = T(g, 130, 108, c[1], 'vl'); s.setAttribute('fill', c[2]);
      return { g, at: c[3], wait: i === 2 };
    });
    return (p, t) => {
      bars.forEach((o, i) => { const k = ease(seg(p, .02 + i * .06, .12 + i * .06)); o.r.setAttribute('width', (o.w * k).toFixed(1)); op(o.l, k > .9 ? 1 : 0); });
      op(leg, seg(p, .25, .3));
      cards.forEach(c => { const a = seg(p, c.at, c.at + .06); op(c.g, c.wait ? a * (.75 + .25 * Math.sin(t / 300)) : a); c.g.setAttribute('transform', `translate(${c.g.dataset.x},${(230 + (1 - ease(a)) * 30).toFixed(1)})`); });
    };
  })();

  /* 06 다음 단계 */
  VIS['s-next'] = (() => {
    const v = $('v-next');
    const N = [[170, '믿을 수 있는 바탕', C.mint], [500, '실제 업무 비교', C.gold], [830, '운영 전환', C.l1]];
    const line = svg('path', { d: 'M170 210 L830 210', stroke: '#3a5a50', 'stroke-width': 4, fill: 'none' }, v);
    const lit = svg('path', { d: 'M170 210 L830 210', stroke: C.mint, 'stroke-width': 4, fill: 'none', 'stroke-dasharray': 660, 'stroke-dashoffset': 660 }, v);
    const nodes = N.map((n, i) => { const g = svg('g', { transform: `translate(${n[0]},210)` }, v); const halo = svg('circle', { r: 64, fill: 'none', stroke: n[2], 'stroke-width': 2 }, g); const c = svg('circle', { r: 50, fill: '#101d1a', stroke: n[2], 'stroke-width': 3 }, g); T(g, 0, 12, String(i + 1), 'vt'); T(g, 0, 110, n[1], 'vt'); return { g, halo, c }; });
    const nowT = T(v, 500, 120, '지금 여기', 'vl'); nowT.setAttribute('fill', C.gold);
    return (p, t) => {
      op(line, seg(p, 0, .05));
      lit.setAttribute('stroke-dashoffset', (660 - 660 * ease(seg(p, .05, .9))).toFixed(1));
      nodes.forEach((o, i) => { const a = seg(p, i * .33, i * .33 + .08); op(o.g, .25 + .75 * a); op(o.halo, i === 1 && a > 0 ? .4 + .4 * Math.sin(t / 250) : 0); o.c.setAttribute('fill', a > .5 && i < 2 ? '#173229' : '#101d1a'); });
      op(nowT, seg(p, .33, .4));
    };
  })();

  (function scenes() {
    document.querySelectorAll('.cap').forEach(c => { c.innerHTML = `<span>${c.innerHTML}</span>`; });
    const list = [...document.querySelectorAll('.scene')].map(sc => ({ sc, caps: [...sc.querySelectorAll('.cap')], fn: VIS[sc.id] }));
    const dots = $('dots');
    list.forEach(o => { const a = el('a', '', '', dots); a.href = '#' + o.sc.id; a.title = o.sc.dataset.label; a.setAttribute('aria-label', o.sc.dataset.label); o.dot = a; });
    function frame(t) {
      list.forEach(o => {
        const r = o.sc.getBoundingClientRect();
        const p = clamp(-r.top / Math.max(1, r.height - innerHeight), 0, 1);
        const vis = r.bottom > 0 && r.top < innerHeight;
        o.dot.classList.toggle('on', r.top <= innerHeight * .5 && r.bottom > innerHeight * .5);
        o.dot.style.setProperty('--p', p);
        if (!vis) return;
        o.caps.forEach(c => c.classList.toggle('on', p >= +c.dataset.from && p < +c.dataset.to));
        o.fn(p, RM ? 0 : t);
      });
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  })();

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
