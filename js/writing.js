// 획순 보기와 손가락 쓰기 채점. 좌표계는 KanjiVG와 같은 109 x 109.
(function () {
  const SIZE = 109, N = 16;
  let svgHost = null;
  const cache = new Map();
  function pathEl(d) {
    if (!svgHost) {
      svgHost = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svgHost.setAttribute('width', '0'); svgHost.setAttribute('height', '0');
      svgHost.style.position = 'absolute'; svgHost.style.left = '-9999px';
      document.body.appendChild(svgHost);
    }
    const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    p.setAttribute('d', d); svgHost.appendChild(p);
    return p;
  }
  function sample(d, n) {
    n = n || N;
    const key = d + '|' + n;
    if (cache.has(key)) return cache.get(key);
    const p = pathEl(d), len = p.getTotalLength(), out = [];
    for (let i = 0; i < n; i++) { const pt = p.getPointAtLength(len * i / (n - 1)); out.push({ x: pt.x, y: pt.y }); }
    p.remove(); cache.set(key, out);
    return out;
  }
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  function resample(pts, n) {
    let total = 0; for (let i = 1; i < pts.length; i++) total += dist(pts[i - 1], pts[i]);
    if (total === 0) return null;
    const step = total / (n - 1), out = [pts[0]];
    let acc = 0, prev = pts[0];
    for (let i = 1; i < pts.length && out.length < n; i++) {
      let cur = pts[i], seg = dist(prev, cur);
      while (acc + seg >= step && out.length < n) {
        const t = (step - acc) / seg;
        const np = { x: prev.x + t * (cur.x - prev.x), y: prev.y + t * (cur.y - prev.y) };
        out.push(np); prev = np; seg = dist(prev, cur); acc = 0;
      }
      acc += seg; prev = cur;
    }
    while (out.length < n) out.push(pts[pts.length - 1]);
    return out;
  }
  function gradeStroke(userPts, refD) {
    if (!userPts || userPts.length < 3) return { ok: false, score: 0 };
    const u = resample(userPts, N); if (!u) return { ok: false, score: 0 };
    const r = sample(refD, N);
    let len = 0; for (let i = 1; i < u.length; i++) len += dist(u[i - 1], u[i]);
    let rlen = 0; for (let i = 1; i < r.length; i++) rlen += dist(r[i - 1], r[i]);
    if (len < Math.min(8, rlen * 0.3)) return { ok: false, score: 0 };
    // 손가락으로 대충 써도 되게: 위치는 넉넉히(중심이 32 안), 크기는 맞춰서 모양과 방향만 봄
    const cen = (ps) => ({ x: ps.reduce((s, p) => s + p.x, 0) / ps.length, y: ps.reduce((s, p) => s + p.y, 0) / ps.length });
    const cu = cen(u), cr = cen(r);
    const posOff = dist(cu, cr);
    const ratio = len / rlen;
    if (ratio < 0.35 || ratio > 3) return { ok: false, score: 0 };
    const k = rlen / len; // 사용자 획을 정답 크기로
    let shape = 0;
    for (let i = 0; i < N; i++) shape += dist({ x: (u[i].x - cu.x) * k, y: (u[i].y - cu.y) * k }, { x: r[i].x - cr.x, y: r[i].y - cr.y });
    shape /= N;
    const rv = { x: r[N - 1].x - r[0].x, y: r[N - 1].y - r[0].y }, uv = { x: u[N - 1].x - u[0].x, y: u[N - 1].y - u[0].y };
    let angleOk = true;
    if (Math.hypot(rv.x, rv.y) > 15 && Math.hypot(uv.x, uv.y) > 5) {
      const cos = (rv.x * uv.x + rv.y * uv.y) / (Math.hypot(rv.x, rv.y) * Math.hypot(uv.x, uv.y));
      angleOk = cos >= Math.cos(70 * Math.PI / 180);
    }
    const ok = posOff <= 32 && shape <= 15 && angleOk;
    return { ok, score: Math.max(0, Math.min(1, 1 - shape / 25)), posOff, shape };
  }
  // idx번째 획으로 채점하되, 생김새가 비슷한 다른 획(き의 두 가로획 등) 자리에 더 가까우면 순서가 틀린 것으로 봄
  function gradeAt(userPts, ds, idx) {
    const g = gradeStroke(userPts, ds[idx]);
    if (!g.ok) return g;
    for (let j = 0; j < ds.length; j++) {
      if (j === idx) continue;
      const o = gradeStroke(userPts, ds[j]);
      if (o.ok && o.posOff + 2 < g.posOff) return { ok: false, score: g.score, wrongOrder: j };
    }
    return g;
  }
  function gradeChar(strokes, refDs) {
    if (strokes.length !== refDs.length) return { ok: false, per: [] };
    const per = refDs.map((d, i) => gradeAt(strokes[i], refDs, i));
    return { ok: per.every(p => p.ok), per };
  }

  // 획순 애니메이션: 한 획씩 그려지고 시작점에 번호
  function animate(container, char, opts) {
    opts = opts || {};
    const ds = (GQ.strokes || {})[char]; container.innerHTML = '';
    if (!ds) { container.textContent = char; return () => {}; }
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 109 109'); svg.setAttribute('class', 'stroke-anim');
    const ghost = document.createElementNS(NS, 'g'); ghost.setAttribute('class', 'ghost');
    const ink = document.createElementNS(NS, 'g'); ink.setAttribute('class', 'ink');
    const nums = document.createElementNS(NS, 'g'); nums.setAttribute('class', 'nums');
    svg.append(ghost, ink, nums); container.appendChild(svg);
    const paths = ds.map((d, i) => {
      const g = document.createElementNS(NS, 'path'); g.setAttribute('d', d); ghost.appendChild(g);
      const p = document.createElementNS(NS, 'path'); p.setAttribute('d', d); ink.appendChild(p);
      const L = p.getTotalLength(); p.style.strokeDasharray = L; p.style.strokeDashoffset = L;
      const st = p.getPointAtLength(0);
      const t = document.createElementNS(NS, 'text'); t.setAttribute('x', st.x - 6); t.setAttribute('y', st.y - 3); t.textContent = i + 1;
      t.style.opacity = 0; nums.appendChild(t);
      return { p, L, t };
    });
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let stopped = false, timers = [];
    function run() {
      paths.forEach(({ p, L, t }) => { p.style.transition = 'none'; p.style.strokeDashoffset = reduce ? 0 : L; t.style.opacity = reduce ? 1 : 0; });
      if (reduce) return;
      let at = 200;
      paths.forEach(({ p, L, t }) => {
        const dur = Math.max(350, L * 9);
        timers.push(setTimeout(() => { if (stopped) return; t.style.opacity = 1; p.style.transition = `stroke-dashoffset ${dur}ms ease-in-out`; p.style.strokeDashoffset = 0; }, at));
        at += dur + 180;
      });
      if (opts.loop) timers.push(setTimeout(() => { if (!stopped) run(); }, at + 1400));
    }
    run();
    return () => { stopped = true; timers.forEach(clearTimeout); };
  }

  // 손가락 쓰기 패드
  function Pad(canvas, char, opts) {
    const ds = GQ.strokes[char], ctx = canvas.getContext('2d');
    const css = getComputedStyle(document.documentElement);
    const color = (n, f) => (css.getPropertyValue(n) || '').trim() || f;
    let strokeIdx = 0, current = null, mistakes = 0, failsHere = 0, done = false, hint = -1;
    const finished = [];
    function fit() {
      const r = canvas.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
      canvas.width = r.width * dpr; canvas.height = r.height * dpr;
      ctx.setTransform(dpr * r.width / SIZE, 0, 0, dpr * r.height / SIZE, 0, 0);
      draw();
    }
    function strokePath(d, w, c) { ctx.lineWidth = w; ctx.strokeStyle = c; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke(new Path2D(d)); }
    function draw() {
      ctx.clearRect(0, 0, SIZE, SIZE);
      ctx.strokeStyle = color('--grid', '#ddd'); ctx.lineWidth = 0.5; ctx.setLineDash([2, 2]);
      ctx.beginPath(); ctx.moveTo(54.5, 4); ctx.lineTo(54.5, 105); ctx.moveTo(4, 54.5); ctx.lineTo(105, 54.5); ctx.stroke(); ctx.setLineDash([]);
      if (opts.mode === 'trace') ds.forEach(d => strokePath(d, 6, color('--ghost', '#e6e6e6')));
      if (hint >= 0) strokePath(ds[hint], 6, color('--hint', '#f5c26b'));
      finished.forEach(d => strokePath(d, 5, color('--ink', '#222')));
      if (current && current.length > 1) {
        ctx.beginPath(); ctx.moveTo(current[0].x, current[0].y);
        for (const p of current) ctx.lineTo(p.x, p.y);
        ctx.lineWidth = 5; ctx.strokeStyle = color('--ink', '#222'); ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke();
      }
    }
    function pos(e) { const r = canvas.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width * SIZE, y: (e.clientY - r.top) / r.height * SIZE }; }
    function down(e) { if (done) return; e.preventDefault(); canvas.setPointerCapture(e.pointerId); current = [pos(e)]; }
    function move(e) { if (!current) return; e.preventDefault(); current.push(pos(e)); draw(); }
    function up(e) {
      if (!current) return; e.preventDefault();
      const pts = current; current = null;
      if (pts.length < 3) { draw(); return; } // 살짝 닿은 건 무시
      const g = gradeAt(pts, ds, strokeIdx);
      if (g.ok) {
        finished.push(ds[strokeIdx]); strokeIdx++; failsHere = 0; hint = -1;
        opts.onStroke && opts.onStroke(strokeIdx - 1, true);
        if (strokeIdx >= ds.length) { done = true; draw(); opts.onDone && opts.onDone({ ok: mistakes === 0, mistakes }); return; }
      } else {
        mistakes++; failsHere++;
        if (failsHere >= 2) hint = strokeIdx;
        opts.onStroke && opts.onStroke(strokeIdx, false);
      }
      draw();
    }
    canvas.addEventListener('pointerdown', down);
    canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', () => { current = null; draw(); });
    canvas.style.touchAction = 'none';
    fit();
    return { redraw: fit, showHint() { hint = strokeIdx; draw(); }, get strokes() { return ds.length; }, get index() { return strokeIdx; } };
  }

  GQ.writing = { sample, gradeStroke, gradeAt, gradeChar, animate, Pad };
})();
