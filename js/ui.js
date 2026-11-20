// 화면
(function () {
  const D = GQ.data;
  const SCRIPT_BASE = document.currentScript && document.currentScript.src;
  const APP_VERSION = '28';
  const app = document.getElementById('app');
  let state = null, store = null, caps = { tts: false, asr: false }, tab = 'home', toastT = null, mascotN = 0;
  const now = () => Date.now();
  const esc = (s) => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const group = (id) => D.groups.find(g => g.id === id);
  const save = () => store.save(state);

  const ICON = {
    home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M3 11 12 4l9 7v9h-6v-6H9v6H3z"/></svg>',
    league: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M7 6H4v1a3 3 0 0 0 3 3M17 6h3v1a3 3 0 0 1-3 3M12 14v4M8 20h8"/></svg>',
    me: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="13" r="7"/><circle cx="9.5" cy="12" r=".8" fill="currentColor"/><circle cx="14.5" cy="12" r=".8" fill="currentColor"/><path d="M6 8 5 3l4 3M18 8l1-5-4 3"/></svg>',
    opts: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/></svg>',
    flame: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2c1 4 6 6 6 12a6 6 0 0 1-12 0c0-3 2-5 3-6 0 2 1 3 2 3-1-4 0-7 1-9z"/></svg>',
    bolt: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M13 2 4 14h6l-1 8 9-12h-6z"/></svg>',
    cup: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 3h12v6a6 6 0 0 1-12 0zM10 16h4v3h3v2H7v-2h3z"/></svg>',
    sound: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"><path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/><path d="M16 9a4 4 0 0 1 0 6M19 6a8 8 0 0 1 0 12"/></svg>',
    mic: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="9" y="3" width="6" height="11" rx="3" fill="currentColor"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>',
    x: '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>',
    chest: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M3 10h18v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z" fill="#c9792f"/><path d="M3 10a9 5 0 0 1 18 0z" fill="#e0943f"/><rect x="3" y="9.4" width="18" height="2" fill="#f5c542"/><rect x="10.5" y="9" width="3" height="5" rx="1" fill="#f5c542"/></svg>',
  };

  // ---------- 입체 캐릭터 (avatar3d.js를 필요할 때 불러옴) ----------
  let av3d = null, av3dP = null, avHandle = null, avSel = 'hair';
  function loadAvatar3d() {
    if (av3dP) return av3dP;
    const url = new URL('avatar3d.js?v=' + APP_VERSION, SCRIPT_BASE || location.href).href;
    av3dP = import(url).then(m => (av3d = m)).catch(() => { av3dP = null; return null; });
    return av3dP;
  }
  // 화면의 <img data-avatar>에 내 캐릭터 그림(스냅샷)을 채움
  function fillAvatars(root) {
    const imgs = (root || document).querySelectorAll('img[data-avatar]');
    if (!imgs.length) return;
    loadAvatar3d().then(m => {
      if (!m) return;
      imgs.forEach(img => { try { const look = img.dataset.look ? JSON.parse(img.dataset.look) : state.avatar.look; img.src = m.snapshot(look, +img.dataset.size || 128); img.hidden = false; } catch (e) {} });
    });
  }
  const avatarImg = (size, look) => `<img data-avatar data-size="${size * 2}" ${look ? `data-look='${esc(JSON.stringify(look))}'` : ''} alt="내 캐릭터" width="${size}" height="${size}" hidden>`;

  // ---------- 공통 ----------
  function toast(msg) {
    let t = document.querySelector('.toast'); if (!t) { t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
    t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, 2600);
  }
  function sheet(html, onMount) {
    const bg = document.createElement('div'); bg.className = 'sheet-bg';
    bg.innerHTML = `<div class="sheet" role="dialog" aria-modal="true">${html}</div>`;
    const close = () => { bg.remove(); if (bg._stop) bg._stop(); GQ.speech.stop(); };
    bg.addEventListener('click', e => { if (e.target === bg || e.target.closest('[data-close]')) close(); });
    document.body.appendChild(bg);
    onMount && onMount(bg.firstElementChild, close, bg);
    return close;
  }
  const pron = (k) => k.romaji + (state.settings.hangul ? ` <small>${esc(k.hangul)}</small>` : '');
  const AUTO_DELAY = 250;
  // auto: 화면이 바뀌면서 저절로 나오는 소리 (잠깐 쉬었다가)
  function sayIf(text, auto) { if (state.settings.sound && caps.tts) return GQ.speech.say(text, auto ? { delay: AUTO_DELAY } : {}); return Promise.resolve(); }

  function refreshDaily() {
    const r = GQ.league.settle(state, now()); state = r.state;
    state = GQ.quests.ensureDaily(state, now());
  }

  // ---------- 틀 ----------
  function render() {
    if (av3d) av3d.unmount(); avHandle = null; // 화면이 바뀌면 3D는 떼어서 멈춤
    if (tab === 'home') renderHome();
    else if (tab === 'league') renderLeague();
    else if (tab === 'me') renderMe();
    else renderOpts();
    if (state.pendingResult) showWeekResult();
    fillAvatars(app);
  }
  function shell(inner) {
    const tabs = [['home', '홈'], ['league', '리그'], ['me', '캐릭터'], ['opts', '설정']];
    app.innerHTML = `<main>${inner}</main><div class="tabbar"><nav aria-label="메뉴">${tabs.map(([k, l]) =>
      `<button data-tab="${k}" ${tab === k ? 'aria-current="page"' : ''}>${ICON[k]}<span>${l}</span></button>`).join('')}</nav></div>`;
    app.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { GQ.speech.stop(); tab = b.dataset.tab; refreshDaily(); render(); window.scrollTo(0, 0); });
  }
  function statusChips() {
    const st = GQ.quests.currentStreak(state, now());
    const today = state.xp.byDay[GQ.time.dayKey(now())] || 0;
    const lg = D.leagues[state.league.tier];
    const me = GQ.league.standings(state, now()).find(r => r.isMe);
    return `<div class="status">
      <span class="chip streak" title="연속 학습일">${ICON.flame}${st}일</span>
      <span class="chip xp" title="오늘 XP">${ICON.bolt}${today} XP</span>
      <span class="chip lg" title="이번 주 리그">${ICON.cup}${lg.ko} ${me.rank}위</span></div>`;
  }

  // ---------- 홈 ----------
  function currentGroup() {
    return D.groups.filter(g => state.unlocked.includes(g.id) && !state.bossCleared.includes(g.id)).sort((a, b) => a.order - b.order)[0] || null;
  }
  function renderHome() {
    const t = now();
    const due = GQ.srs.dueItems(state.cards, t, 999).length;
    const seen = Object.values(state.cards).filter(c => c.seen).length;
    const cur = currentGroup();
    let hero;
    if (cur) {
      const ready = GQ.lesson.bossReady(state, cur.id);
      const sample = cur.items.slice(0, 5).map(id => D.byId.get(id).char).join('');
      hero = `<section class="card hero"><p class="sub">${ready ? '레슨 완료! 보스를 깨면 다음 행이 열려요' : (state.groupLessons[cur.id] ? '한 번 더 연습하거나 보스에 도전해요' : '새 글자를 배워요')}</p>
        <div class="big">${esc(sample)}</div>
        <div class="actions">${ready ? `<button class="btn ghost" data-go="lesson:${cur.id}" style="background:transparent;color:inherit;border-color:currentColor;box-shadow:none">레슨 다시</button><button class="btn" data-go="boss:${cur.id}">보스 도전</button>`
          : `<button class="btn" data-go="lesson:${cur.id}" style="grid-column:1/-1">레슨 시작 · ${esc(cur.title)}</button>`}</div></section>`;
    } else if (GQ.lesson.finalReady(state)) {
      hero = `<section class="card hero"><p class="sub">모든 행을 깼어요</p><div class="big">最終</div><button class="btn wide" data-go="final">최종 보스 「영어 표기 끄기」</button></section>`;
    } else hero = '';
    const qs = state.quests.list.map(q => `<div class="quest"><span class="t">${esc(q.title)}</span>${q.done ? '<span class="stamp" aria-label="완료">済</span>' : `<span class="qcount">${q.progress}/${q.target}</span>`}
      ${q.done ? '' : `<div class="bar"><i style="width:${Math.round(q.progress / q.target * 100)}%"></i></div>`}</div>`).join('');
    const chestCta = state.chests.count ? `<button class="card chest-cta" id="homeChest"><span class="chest-mini">${ICON.chest}</span><span><b>보물상자 ${state.chests.count}개</b><br><span class="sub">눌러서 열면 꾸미기 아이템이 나와요</span></span><span class="badge-n">${state.chests.count}</span></button>` : '';
    shell(`${statusChips()}${chestCta}${hero}
      <section class="card"><div class="row"><div><h2>오늘 복습</h2><p class="sub">${due ? `기억이 흐려질 때가 된 글자 ${due}개` : seen ? '지금은 복습할 때가 된 글자가 없어요. 약한 글자로 연습할 수 있어요' : '레슨을 하면 복습할 글자가 쌓여요'}</p></div>
        <button class="btn ${due ? 'gold' : 'ghost'} small" data-go="review" ${seen ? '' : 'disabled'}>복습하기</button></div></section>
      <section class="card"><div class="row"><h2>하루 퀘스트</h2><span class="sub">하나 깰 때마다 조각 하나</span></div><div class="quests">${qs}</div></section>
      ${mapHtml()}`);
    bindGo(app);
    app.querySelectorAll('[data-group]').forEach(b => b.onclick = () => openGroup(b.dataset.group));
    const hc = app.querySelector('#homeChest'); if (hc) hc.onclick = openChest;
  }
  function mapHtml() {
    const sec = (script, title, ja) => {
      const gs = D.groups.filter(g => g.script === script);
      const done = gs.filter(g => state.bossCleared.includes(g.id)).length;
      return `<h3><span class="kana">${ja}</span>${title} · ${done}/${gs.length}</h3><div class="nodes">${gs.map(g => {
        const un = state.unlocked.includes(g.id), cl = state.bossCleared.includes(g.id), isCur = un && !cl;
        const n = state.groupLessons[g.id] || 0;
        const label = cl ? '클리어' : !un ? '잠김' : n ? `레슨 ${n}번` : '시작 전';
        return `<button class="node ${cl ? 'done' : isCur ? 'cur' : 'lock'}" data-group="${g.id}"><span class="kana">${esc(g.title)}</span><small>${label}</small></button>`;
      }).join('')}</div>`;
    };
    const total = D.groups.length, cleared = D.groups.filter(g => state.bossCleared.includes(g.id)).length;
    const ready = GQ.lesson.finalReady(state);
    const fb = state.finalBoss;
    return `<section class="map" aria-label="학습 지도">${sec('hira', '히라가나', 'ひらがな')}${sec('kata', '카타카나', 'カタカナ')}
      <section class="card final ${ready ? 'ready' : ''}"><div class="row"><div><h2>최종 보스 「영어 표기 끄기」</h2>
        <p class="sub">${fb.cleared ? '클리어! 듀오링고에서 영어 표기를 꺼도 돼요' : ready ? '가나 40자를 정답률 90%, 평균 2초 안에 읽으면 클리어' : `모든 행 보스를 깨면 열려요 (${cleared}/${total})`}</p>
        ${fb.best ? `<p class="sub">최고 기록: 정답률 ${Math.round(fb.best.ratio * 100)}% · 평균 ${(fb.best.avgMs / 1000).toFixed(1)}초</p>` : ''}</div>
        ${ready ? '<button class="btn small" data-go="final">도전</button>' : ''}</div></section>
      <h3><span class="kana">漢字</span>한자</h3><section class="card node lock" style="text-align:left"><p class="sub">가나를 다 끝내면 열리는 다음 단계예요. 준비 중이에요.</p></section></section>`;
  }
  function bindGo(root) {
    root.querySelectorAll('[data-go]').forEach(b => b.onclick = () => {
      const [mode, gid] = b.dataset.go.split(':');
      document.querySelectorAll('.sheet-bg').forEach(s => s.remove());
      startSession(mode, gid || null);
    });
  }
  function openGroup(gid) {
    const g = group(gid), un = state.unlocked.includes(gid), cl = state.bossCleared.includes(gid);
    const items = g.items.map(id => D.byId.get(id));
    const writable = items.filter(k => GQ.strokes[k.char]);
    const ready = GQ.lesson.bossReady(state, gid);
    sheet(`<div class="row"><h2 class="kana">${esc(g.title)}</h2><button class="x" data-close aria-label="닫기">${ICON.x}</button></div>
      <div class="cell" id="gcell"></div>
      <div class="info"><span class="r" id="gr"></span><span class="h" id="gh"></span></div>
      <div class="charset">${items.map((k, i) => `<button class="kana" data-k="${k.id}" aria-pressed="${i === 0}">${esc(k.char)}</button>`).join('')}</div>
      ${un ? `<div class="actions"><button class="btn ${ready ? 'ghost' : ''}" data-go="lesson:${gid}">레슨 ${state.groupLessons[gid] ? '다시' : '시작'}</button>
        <button class="btn ${cl ? 'ghost' : ''}" data-go="boss:${gid}" ${ready ? '' : 'disabled'}>${cl ? '보스 다시' : '보스 도전'}</button></div>
        ${ready ? '' : '<p class="sub" style="text-align:center">레슨을 한 번 끝내면 보스에 도전할 수 있어요</p>'}`
        : '<p class="sub" style="text-align:center">앞 행 보스를 깨면 열려요. 글자 모양은 미리 볼 수 있어요.</p>'}`,
    (el, close, bg) => {
      let stop = () => {};
      const show = (k) => {
        stop();
        el.querySelectorAll('[data-k]').forEach(b => b.setAttribute('aria-pressed', b.dataset.k === k.id));
        const cell = el.querySelector('#gcell');
        if (GQ.strokes[k.char]) stop = GQ.writing.animate(cell, k.char, { loop: true });
        else { cell.innerHTML = `<span class="glyph kana">${esc(k.char)}</span>`; stop = () => {}; }
        el.querySelector('#gr').textContent = k.quiz ? k.romaji : k.romaji;
        el.querySelector('#gh').textContent = k.hangul;
        sayIf(k.char);
      };
      el.querySelectorAll('[data-k]').forEach(b => b.onclick = () => show(D.byId.get(b.dataset.k)));
      bg._stop = () => stop();
      const first = writable[0] || items[0];
      // 첫 글자는 소리 없이
      const keep = state.settings.sound; state.settings.sound = false; show(first); state.settings.sound = keep;
      bindGo(el);
    });
  }

  // ---------- 문제 화면 ----------
  function startSession(mode, gid) {
    const t0 = now();
    const qs = GQ.lesson.build(state, { mode, groupId: gid, now: t0 }, { tts: caps.tts, asr: true }, Math.random);
    if (!qs.length) { toast('복습할 글자가 아직 없어요. 레슨부터 해봐요'); return; }
    const isBoss = mode === 'boss' || mode === 'final';
    GQ.speech.preload(qs.map(q => { const k = D.byId.get(q.itemId); return k ? k.char : q.kind === 'word' ? q.prompt : ''; }));
    const queue = qs.slice(), answers = [];
    let i = 0, stopAnim = () => {}, timer = null, combo = 0, maxCombo = 0;
    const root = document.createElement('div'); root.className = 'session';
    document.body.appendChild(root);
    document.body.style.overflow = 'hidden';
    const label = mode === 'lesson' ? `레슨 · ${group(gid).title}` : mode === 'review' ? '복습' : mode === 'boss' ? `보스 · ${group(gid).title}` : '최종 보스';

    function quit() { stopAnim(); clearInterval(timer); GQ.speech.stop(); root.remove(); document.body.style.overflow = ''; render(); }
    function frame(body, foot) {
      const done = i, total = queue.length;
      root.innerHTML = `<div class="s-top"><button class="x" aria-label="그만하기">${ICON.x}</button><div class="bar"><i style="width:${Math.round(done / total * 100)}%"></i></div><span class="combo" id="combo" aria-live="polite"></span></div>
        ${isBoss ? '<div class="timer"><i></i></div>' : '<div></div>'}
        <div class="s-body"><span class="badge ${isBoss ? 'boss' : ''}">${esc(label)}</span>${body}</div><div class="s-foot">${foot || ''}</div>`;
      root.querySelector('.x').onclick = () => confirmQuit();
      paintCombo('');
    }
    // 콤보 배지: 2콤보부터 보이고 3·5·10·20에서 단계가 올라감. pop=방금 늘었음, break=방금 끊김
    function paintCombo(fx, broken) {
      const el = root.querySelector('#combo'); if (!el) return;
      const n = fx === 'break' ? broken : combo;
      if (n < 2) { el.className = 'combo'; el.textContent = ''; return; }
      el.textContent = n + ' 콤보';
      el.className = 'combo t' + GQ.combo.tier(n) + (fx ? ' ' + fx : '');
      if (fx === 'break') setTimeout(() => { if (el.isConnected) { el.className = 'combo'; el.textContent = ''; } }, 650);
    }
    function confirmQuit() {
      if (!answers.length) return quit();
      sheet(`<h2>그만할까요?</h2><p class="sub">지금 그만두면 이번 기록과 XP는 저장되지 않아요.</p>
        <div class="actions"><button class="btn ghost" data-close>계속하기</button><button class="btn bad" id="leave">그만하기</button></div>`,
        (el, close) => { el.querySelector('#leave').onclick = () => { close(); quit(); }; });
    }

    function next() {
      stopAnim(); clearInterval(timer); GQ.speech.stop(); // 앞 화면 소리는 모두 끊기
      if (i >= queue.length) return finishSession();
      const q = queue[i];
      ({ intro: showIntro, read: showChoice, word: showChoice, listen: showChoice, speak: showSpeak, write: showWrite })[q.kind](q);
    }
    function startTimer(q, onTimeout) {
      if (!q.timeLimit) return;
      const bar = root.querySelector('.timer i'), st = performance.now();
      timer = setInterval(() => {
        const left = 1 - (performance.now() - st) / q.timeLimit;
        if (bar) bar.style.width = Math.max(0, left * 100) + '%';
        if (left <= 0) { clearInterval(timer); onTimeout(); }
      }, 50);
    }
    function record(q, correct, ms, result, extra) {
      clearInterval(timer);
      const before = combo;
      combo = GQ.combo.next(combo, correct, !!q._retry);
      maxCombo = Math.max(maxCombo, combo);
      const comboBonus = correct && !q._retry ? GQ.combo.bonus(combo) : 0;
      if (!q._retry) answers.push({ q, correct, ms, result, combo, comboBonus });
      if (!correct && !isBoss && !q._retry && q.kind !== 'speak') queue.push(Object.assign({}, q, { _retry: true }));
      if (combo > before) paintCombo('pop'); else if (combo === 0 && before >= 2) paintCombo('break', before);
      feedback(q, correct, ms, Object.assign({ comboBonus }, extra || {}));
    }
    function feedback(q, correct, ms, extra) {
      const foot = root.querySelector('.s-foot');
      const k = D.byId.get(q.itemId);
      const fast = correct && ms <= 1500 && !['speak', 'write'].includes(q.kind);
      const plus = correct && !q._retry ? `+${10 + (fast ? 5 : 0) + (extra.comboBonus || 0)} XP${fast ? ' · 빨라요' : ''}${extra.comboBonus ? ` · ${combo}콤보 +${extra.comboBonus}` : ''}` : '';
      let detail = '';
      if (q.kind === 'word') detail = `${esc(q.prompt)} = ${esc(q.answer)} · ${esc(q.meaning)}`;
      else if (k) detail = `${esc(k.char)} = ${esc(k.romaji)}${state.settings.hangul || !correct ? ` (${esc(k.hangul)})` : ''}`;
      if (extra.note) detail = extra.note + (detail ? ' · ' + detail : '');
      foot.className = 's-foot ' + (correct ? 'ok' : 'bad');
      foot.innerHTML = `<div class="fb">${correct ? (q._retry ? '이번엔 맞았어요' : '정답!') : '아쉬워요'}<span class="plus">${plus}</span></div>
        ${detail ? `<div class="fb-sub kana" style="font-weight:500">${detail}</div>` : ''}<button class="btn wide ${correct ? 'ok' : 'bad'}" id="cont">계속</button>`;
      const b = foot.querySelector('#cont'); b.onclick = () => { i++; next(); }; b.focus();
      if (q.kind === 'word') sayIf(q.prompt, true); else if (k && (!correct || q.kind === 'read')) sayIf(k.char, true);
    }

    function showIntro(q) {
      const k = D.byId.get(q.itemId);
      frame(`<p class="ask">새 글자<small>획순을 보고 소리를 들어보세요</small></p><div class="cell" id="cell"></div>
        <div class="info"><span class="r">${k.quiz ? esc(k.romaji) : esc(k.char)}</span><span class="h">${esc(k.hangul)}${k.id.endsWith('xtsu') ? ' · 다음 자음을 한 번 더 (きって = kitte)' : ''}</span></div>
        ${caps.tts ? `<button class="btn ghost" id="hear">${ICON.sound.replace('<svg', '<svg width="22" height="22"')} 소리 듣기</button>` : ''}`,
        `<button class="btn wide" id="ok">알겠어요</button>`);
      const cell = root.querySelector('#cell');
      if (GQ.strokes[k.char]) stopAnim = GQ.writing.animate(cell, k.char, { loop: true });
      else cell.innerHTML = `<span class="glyph kana">${esc(k.char)}</span>`;
      const hear = root.querySelector('#hear'); if (hear) hear.onclick = () => GQ.speech.say(k.char);
      if (k.quiz) sayIf(k.char, true);
      root.querySelector('#ok').onclick = () => { i++; next(); };
    }

    function showChoice(q) {
      const isListen = q.kind === 'listen', isWord = q.kind === 'word';
      const head = isListen ? `<p class="ask">들리는 글자를 고르세요</p><button class="speaker" id="play" aria-label="다시 듣기">${ICON.sound}</button>`
        : `<p class="ask">${isWord ? '이 단어는 어떻게 읽을까요?' : '어떻게 읽을까요?'}${q._retry ? '<small>아까 틀린 문제예요</small>' : ''}</p>
           <div class="cell ${isWord ? 'wide' : ''}"><span class="glyph kana ${isWord ? 'word' : ''}">${esc(q.prompt)}</span></div>`;
      const label = (c) => {
        if (isListen) return esc(c);
        if (isWord || !state.settings.hangul) return esc(c);
        const k = D.kana.find(x => x.romaji === c && x.script === D.byId.get(q.itemId).script) || D.kana.find(x => x.romaji === c);
        return esc(c) + (k ? `<small>${esc(k.hangul)}</small>` : '');
      };
      frame(`${head}<div class="choices">${q.choices.map(c => `<button class="choice ${isListen ? 'kana' : ''}" data-c="${esc(c)}">${label(c)}</button>`).join('')}</div>`);
      const st = performance.now();
      if (isListen) { root.querySelector('#play').onclick = () => GQ.speech.say(q.prompt); GQ.speech.say(q.prompt, { delay: AUTO_DELAY }); }
      const btns = [...root.querySelectorAll('.choice')];
      const answer = (val, ms) => {
        btns.forEach(b => { b.disabled = true; if (b.dataset.c === q.answer) b.classList.add('ok'); });
        const r = GQ.lesson.check(q, val, ms);
        const chosen = btns.find(b => b.dataset.c === val); if (chosen && !r.correct) chosen.classList.add('bad');
        record(q, r.correct, ms, r.result, val === null ? { note: '시간이 끝났어요' } : {});
      };
      btns.forEach(b => b.onclick = () => answer(b.dataset.c, performance.now() - st));
      startTimer(q, () => answer(null, q.timeLimit + 1));
    }

    function showSpeak(q) {
      const k = D.byId.get(q.itemId);
      const real = GQ.speech.caps().asr;
      const glyph = `<div class="cell"><span class="glyph kana">${esc(q.prompt)}</span></div>`;
      if (real) {
        frame(`<p class="ask">소리 내어 읽어보세요<small>버튼을 누르고 말하면 들어요</small></p>${glyph}<div class="heard" id="heard"></div>
          <button class="speaker mic" id="mic" aria-label="말하기 시작">${ICON.mic}</button>`,
          `<button class="btn ghost wide" id="self">마이크 없이 하기</button>`);
        const mic = root.querySelector('#mic'), heard = root.querySelector('#heard');
        let tries = 0, busy = false;
        mic.onclick = () => {
          if (busy) return; busy = true; heard.textContent = '마이크 준비 중…';
          GQ.speech.listen(q.accept, (t) => { heard.textContent = t; }, () => { mic.classList.add('on'); heard.textContent = '지금 말하세요!'; }).then(res => {
            busy = false; mic.classList.remove('on');
            if (res.error && (res.error === 'not_granted' || res.error === 'unavailable' || res.error === 'not-allowed' || res.error === 'service-not-allowed' || res.error === 'error')) {
              toast('이 기기에서는 마이크를 쓸 수 없어서 스스로 채점으로 바꿨어요'); return selfCheck(q, k);
            }
            if (res.ok) return record(q, true, 0, 'good', { note: `「${res.heard}」로 들렸어요` });
            tries++;
            heard.textContent = res.heard ? `「${res.heard}」로 들렸어요. 다시 해볼까요?` : '잘 안 들렸어요. 다시 해볼까요?';
            if (tries >= 2) record(q, false, 0, 'wrong', { note: res.heard ? `「${res.heard}」로 들렸어요` : '' });
          });
        };
        root.querySelector('#self').onclick = () => selfCheck(q, k);
      } else selfCheck(q, k);
    }
    function selfCheck(q, k) {
      frame(`<p class="ask">소리 내어 읽어보세요<small>읽은 다음 정답을 확인하고 스스로 채점해요</small></p>
        <div class="cell"><span class="glyph kana">${esc(q.prompt)}</span></div><div class="info" id="reveal" hidden><span class="r">${esc(k.romaji)}</span><span class="h">${esc(k.hangul)}</span></div>`,
        `<button class="btn wide" id="show">${caps.tts ? '정답 듣기' : '정답 보기'}</button>`);
      root.querySelector('#show').onclick = () => {
        root.querySelector('#reveal').hidden = false;
        sayIf(k.char);
        const foot = root.querySelector('.s-foot');
        foot.innerHTML = `<div class="actions"><button class="btn bad" id="no">다르게 읽었어요</button><button class="btn ok" id="yes">맞게 읽었어요</button></div>`;
        foot.querySelector('#yes').onclick = () => record(q, true, 0, 'good');
        foot.querySelector('#no').onclick = () => record(q, false, 0, 'wrong');
      };
    }

    function showWrite(q) {
      const k = D.byId.get(q.itemId);
      frame(`<p class="ask">「${esc(k.romaji)}」${state.settings.hangul ? ` (${esc(k.hangul)})` : ''}를 써보세요<small>${q.trace ? '흐린 글자를 순서대로 따라 쓰세요' : '획순대로 혼자 써보세요'} · ${GQ.strokes[k.char].length}획</small></p>
        <div class="cell"><canvas id="pad" aria-label="손가락으로 쓰는 칸"></canvas></div><div class="heard" id="wmsg"></div>`,
        `<div class="actions"><button class="btn ghost" id="hint">힌트</button><button class="btn ghost" id="anim">획순 보기</button></div>`);
      const msg = root.querySelector('#wmsg');
      let hints = 0;
      const pad = GQ.writing.Pad(root.querySelector('#pad'), k.char, {
        mode: q.trace ? 'trace' : 'free',
        onStroke: (idx, ok) => { msg.textContent = ok ? `${idx + 1}획 좋아요` : `${idx + 1}번째 획을 다시 써보세요 (시작점과 방향 확인)`; },
        onDone: ({ mistakes }) => {
          const total = mistakes + hints;
          record(q, total <= 2, 0, total === 0 ? 'good' : 'slow', { note: total === 0 ? '완벽해요' : `실수 ${total}번` });
        },
      });
      root.querySelector('#hint').onclick = () => { hints++; pad.showHint(); };
      root.querySelector('#anim').onclick = () => {
        hints++;
        sheet(`<div class="row"><h2 class="kana">${esc(k.char)} 획순</h2><button class="x" data-close aria-label="닫기">${ICON.x}</button></div><div class="cell" id="ac"></div><button class="btn wide" data-close>다시 써볼게요</button>`,
          (el, close, bg) => { bg._stop = GQ.writing.animate(el.querySelector('#ac'), k.char, { loop: true }); });
      };
    }

    function finishSession() {
      const res = GQ.lesson.finish(state, mode, gid, answers, now());
      state = res.state; save();
      showResult(res.summary);
    }
    function showResult(s) {
      const pct = s.total ? Math.round(s.correct / s.total * 100) : 0;
      let headline = '수고했어요';
      let extra = '';
      if (mode === 'boss') headline = s.cleared ? '보스 클리어!' : '아깝다! 80%를 넘으면 클리어예요';
      if (mode === 'final') {
        headline = s.cleared ? '최종 보스 클리어!' : '조금만 더! 정답률 90%, 평균 2초가 기준이에요';
        if (s.cleared) extra = `<p class="celebrate">이제 듀오링고에서 영어 표기를 꺼도 돼요</p><p class="sub">듀오링고 설정에서 발음 표기(로마자)를 끄고 일본어 글자만 보고 풀어보세요.</p>`;
      }
      if (s.unlocked) extra += `<p class="sub"><b class="kana">${esc(group(s.unlocked).title)}</b>이(가) 열렸어요</p>`;
      const chestsGot = s.rewards.filter(x => x === 'chest').length + s.completed.length;
      const quests = s.completed.map(q => `<div class="reward"><span class="stamp">済</span><span>퀘스트 완료 · ${esc(q.title)}<br><small class="sub">+30 XP · 보물상자 1개</small></span></div>`).join('');
      const rw = chestsGot ? `<div class="reward chest-got"><span class="chest-mini">${ICON.chest}</span><span>보물상자 <b>${chestsGot}개</b>를 받았어요</span><button class="btn small gold" id="openNow">지금 열기</button></div>` : '';
      const ms = s.milestone ? `<div class="reward"><span class="chip streak">${ICON.flame}${s.milestone}일</span><span>연속 학습 ${s.milestone}일 달성!</span></div>` : '';
      stopAnim(); clearInterval(timer);
      root.innerHTML = `<div></div><div></div><div class="s-body"><section class="card result">
        <p class="sub">${esc(label)}</p><h1>${headline}</h1><div class="xp">+${s.xp}</div><p class="sub" style="margin-top:-6px">XP</p>
        <div class="statgrid"><div class="stat"><b>${s.correct}/${s.total}</b><span>맞힘</span></div><div class="stat"><b>${pct}%</b><span>정답률</span></div><div class="stat"><b>${(s.avgMs / 1000).toFixed(1)}초</b><span>평균 시간</span></div></div>
        ${s.maxCombo >= 2 ? `<div class="combo-result"><span class="combo t${GQ.combo.tier(s.maxCombo)}">최고 ${s.maxCombo} 콤보</span>${s.comboXp ? `<span class="sub">콤보 보너스 +${s.comboXp} XP</span>` : ''}${s.maxCombo >= state.stats.bestCombo && s.maxCombo >= 5 ? '<span class="sub">내 최고 기록!</span>' : ''}</div>` : ''}
        ${extra}${ms}${quests}${rw}</section></div>
        <div class="s-foot"><button class="btn wide" id="done">확인</button></div>`;
      root.querySelector('#done').onclick = quit;
      const on = root.querySelector('#openNow'); if (on) on.onclick = () => { quit(); openChest(); };
    }
    next();
  }

  // ---------- 주간 결과 ----------
  function showWeekResult() {
    const r = state.pendingResult; if (!r || document.querySelector('.sheet-bg.week')) return;
    const from = D.leagues[r.fromTier], to = D.leagues[r.toTier];
    const title = r.outcome === 'up' ? `${to.ko} 리그로 승급!` : r.outcome === 'down' ? `${to.ko} 리그로 내려갔어요` : `${to.ko} 리그 유지`;
    const rw = r.rewards.filter(x => x === 'chest').length ? `<div class="reward chest-got"><span class="chest-mini">${ICON.chest}</span><span>승급 보상 · <b>보물상자 1개</b></span></div>` : '';
    sheet(`<p class="sub">지난주 리그 결과 (${esc(r.weekKey)} 주)</p><h2>${title}</h2>
      <div class="lg-head"><div class="tier-badge" style="background:${to.color}">${esc(to.ja)}</div>
      <div><b>${r.rank}위</b> · ${r.xp} XP<br><span class="sub">${esc(from.ko)} → ${esc(to.ko)}</span></div></div>${rw}
      <p class="sub">${r.outcome === 'down' ? '이번 주에 7위 안에 들면 다시 올라가요.' : '새 주가 시작됐어요. 순위표가 새로 짜였어요.'}</p>
      <button class="btn wide" data-close>확인</button>`, (el, close, bg) => {
      bg.classList.add('week');
      el.querySelector('[data-close]').addEventListener('click', () => { state.pendingResult = null; save(); });
      bg.addEventListener('click', e => { if (e.target === bg) { state.pendingResult = null; save(); } });
    });
  }

  // ---------- 리그 ----------
  function renderLeague() {
    const t = now(), lg = D.leagues[state.league.tier];
    const rows = GQ.league.standings(state, t);
    const left = GQ.time.weekEnd(t) - t, dd = Math.floor(left / 86400000), hh = Math.floor(left % 86400000 / 3600000);
    const list = rows.map(r => {
      const zone = r.rank === GQ.league.UP && state.league.tier < 9 ? '<div class="zone up">▲ 승급선 · 여기까지 다음 리그로</div>' :
        r.rank === GQ.league.SIZE - GQ.league.DOWN && state.league.tier > 0 ? '<div class="zone down">▼ 강등선 · 아래는 이전 리그로</div>' : '';
      const cls = (r.rank <= GQ.league.UP && state.league.tier < 9 ? 'top ' : '') + (r.rank > GQ.league.SIZE - GQ.league.DOWN && state.league.tier > 0 ? 'low ' : '') + (r.isMe ? 'me' : '');
      const av = r.isMe ? `<span class="av me-av" style="background:var(--ai-soft)">${avatarImg(34)}<b>나</b></span>` : `<span class="av" style="background:${r.color}">${esc(r.name[0])}</span>`;
      return `<div class="srow ${cls}"><span class="rk">${r.rank}</span>${av}<span class="nm">${esc(r.name)}</span><b>${r.xp} XP</b></div>${zone}`;
    }).join('');
    shell(`${statusChips()}
      <section class="card"><div class="lg-head"><div class="tier-badge" style="background:${lg.color}">${esc(lg.ja)}</div>
        <div><h1>${esc(lg.ko)} 리그</h1><p class="sub">${dd}일 ${hh}시간 남음 · 상위 ${GQ.league.UP}명 승급, 하위 ${GQ.league.DOWN}명 강등</p></div></div>
        <div class="tiers" aria-label="리그 단계 ${state.league.tier + 1}/10">${D.leagues.map((l, i) => `<i class="${i <= state.league.tier ? 'on' : ''}" title="${esc(l.ko)}"></i>`).join('')}</div></section>
      <section class="card standings">${list}</section>`);
  }

  // ---------- 캐릭터 ----------
  function renderMe() {
    const A = GQ.avatar;
    const chestItems = A.items.filter(i => !A.STARTER.includes(i.id));
    const got = chestItems.filter(i => state.avatar.owned.includes(i.id)).length;
    shell(`<section class="card avatar-card"><div class="stage" id="stage"><div class="stage-msg">캐릭터 불러오는 중…</div></div>
        <p class="sub" style="text-align:center">손가락으로 좌우로 밀면 돌아가요 · 모은 아이템 ${got}/${chestItems.length}</p>
        ${state.chests.count ? `<button class="btn gold wide" id="openChest">${ICON.chest} 보물상자 ${state.chests.count}개 열기</button>` : '<p class="sub" style="text-align:center">퀘스트·리그 승급·연속 학습으로 보물상자를 받아요</p>'}</section>
      <section class="card"><div class="slot-tabs" role="tablist">${A.SLOTS.map(s => `<button role="tab" data-slot="${s}" aria-selected="${s === avSel}">${A.SLOT_NAMES[s]}</button>`).join('')}</div>
        <div class="pieces" id="items"></div></section>`);
    paintItems();
    app.querySelectorAll('[data-slot]').forEach(b => b.onclick = () => { avSel = b.dataset.slot; app.querySelectorAll('[data-slot]').forEach(x => x.setAttribute('aria-selected', x === b)); paintItems(); });
    const oc = app.querySelector('#openChest'); if (oc) oc.onclick = openChest;
    const stage = app.querySelector('#stage');
    loadAvatar3d().then(m => {
      if (tab !== 'me' || !stage.isConnected) return;
      if (!m) { stage.innerHTML = '<div class="stage-msg">3D 캐릭터를 불러오지 못했어요.<br>인터넷 연결을 확인하고 다시 열어주세요.</div>'; return; }
      try { stage.innerHTML = ''; avHandle = m.mount(stage, state.avatar.look); }
      catch (e) { stage.innerHTML = '<div class="stage-msg">이 기기에서는 3D 캐릭터를 보여줄 수 없어요. 옷은 아래에서 고를 수 있어요.</div>'; }
    });
  }
  function paintItems() {
    const A = GQ.avatar, box = app.querySelector('#items'); if (!box) return;
    const all = A.items.filter(i => i.slot === avSel);
    const own = all.filter(i => state.avatar.owned.includes(i.id)), locked = all.length - own.length;
    const cur = state.avatar.look[avSel];
    const swatch = (it) => it.def.color ? `<span class="swatch" style="background:${it.def.color}"></span>` : it.def.sky ? `<span class="swatch" style="background:linear-gradient(${it.def.sky},${it.def.ground})"></span>` : `<span class="swatch ink">${esc(it.name[0])}</span>`;
    box.innerHTML = (A.OPTIONAL.has(avSel) ? `<button class="piece" data-item="" aria-pressed="${!cur}"><span class="swatch ink">✕</span>없음</button>` : '') +
      own.map(it => `<button class="piece" data-item="${it.id}" aria-pressed="${cur === it.id}">${swatch(it)}${esc(it.name)}</button>`).join('') +
      Array.from({ length: locked }, () => '<div class="piece locked"><span class="q">?</span>상자에서</div>').join('');
    box.querySelectorAll('[data-item]').forEach(b => b.onclick = () => {
      state.avatar.look[avSel] = b.dataset.item || null; save();
      if (avHandle) avHandle.update(state.avatar.look);
      paintItems();
    });
  }

  // ---------- 보물상자 열기 ----------
  // 색종이: 가운데서 사방으로 터져 떨어짐 (조각마다 방향·색·회전이 다름)
  function burstConfetti(box) {
    if (!box || (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches)) return;
    const colors = ['#ff4f8b', '#ffd23f', '#4fd1c5', '#6b5bff', '#ff8a3d', '#ffffff', '#7ee081'];
    let html = '';
    for (let i = 0; i < 70; i++) {
      const a = Math.random() * Math.PI * 2, d = 140 + Math.random() * 260;
      const x = Math.cos(a) * d, y = Math.sin(a) * d - 120, rot = (Math.random() * 1080 - 540) | 0;
      const w = 6 + Math.random() * 8, h = Math.random() < 0.3 ? w : w * 0.45, delay = (Math.random() * 120) | 0;
      html += `<i style="--x:${x | 0}px;--y:${y | 0}px;--r:${rot}deg;width:${w | 0}px;height:${h | 0}px;background:${colors[i % colors.length]};animation-delay:${delay}ms;border-radius:${Math.random() < 0.3 ? '50%' : '2px'}"></i>`;
    }
    box.innerHTML = html;
  }
  function openChest() {
    if (!state.chests.count) return;
    const bg = document.createElement('div'); bg.className = 'chest-bg';
    bg.innerHTML = `<div class="chest-rays" aria-hidden="true"></div><div class="chest-flash" aria-hidden="true"></div><div class="confetti" aria-hidden="true"></div>
      <div class="chest-stage"><div class="chest" id="chest" role="button" tabindex="0" aria-label="보물상자 열기"><div class="lid"></div><div class="base"><i></i></div><div class="glow"></div></div>
      <p class="chest-hint">눌러서 열기 · 남은 상자 ${state.chests.count}개</p><div class="chest-prize" id="prize" hidden></div></div>`;
    document.body.appendChild(bg);
    loadAvatar3d();
    const chest = bg.querySelector('#chest'), prize = bg.querySelector('#prize'), hint = bg.querySelector('.chest-hint');
    let opened = false;
    const close = () => { bg.remove(); render(); };
    const go = () => {
      if (opened) return; opened = true;
      chest.classList.add('shake'); hint.textContent = '두근두근…'; bg.classList.add('charging');
      setTimeout(() => {
        chest.classList.remove('shake'); chest.classList.add('open');
        bg.classList.remove('charging'); bg.classList.add('burst'); // 번쩍 + 빛줄기 + 화면 흔들림
        burstConfetti(bg.querySelector('.confetti'));
        const r = GQ.chest.open(state, Math.random, now()); state = r.state; save();
        hint.hidden = true; prize.hidden = false;
        const more = state.chests.count;
        if (r.item) {
          const A = GQ.avatar, tryLook = Object.assign({}, state.avatar.look, { [r.item.slot]: r.item.id });
          prize.innerHTML = `<p class="sub">${esc(A.SLOT_NAMES[r.item.slot])}</p><h2>${esc(r.item.name)}</h2>
            <div class="prize-pic">${avatarImg(150, tryLook)}</div>
            <div class="actions"><button class="btn ghost" id="later">나중에</button><button class="btn" id="wear">입어보기</button></div>
            ${more ? `<button class="btn gold wide" id="again">상자 하나 더 열기 (${more})</button>` : ''}`;
          fillAvatars(prize);
          prize.querySelector('#wear').onclick = () => { state.avatar.look[r.item.slot] = r.item.id; save(); if (avHandle && tab === 'me') avHandle.update(state.avatar.look); avSel = r.item.slot; tab = 'me'; close(); };
        } else {
          prize.innerHTML = `<h2>모든 아이템을 모았어요!</h2><p class="sub">대신 XP ${r.xp}를 받았어요</p><div class="actions one"><button class="btn" id="later">확인</button></div>
            ${more ? `<button class="btn gold wide" id="again">상자 하나 더 열기 (${more})</button>` : ''}`;
        }
        prize.querySelector('#later').onclick = close;
        const ag = prize.querySelector('#again'); if (ag) ag.onclick = () => { bg.remove(); openChest(); };
      }, 750);
    };
    chest.onclick = go; chest.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') go(); };
  }

  // ---------- 설정 ----------
  function voiceQuality(v) {
    const s = v.voiceURI + ' ' + v.name;
    return /premium/i.test(s) ? '고음질' : /enhanced|향상/i.test(s) ? '향상된 음질' : /compact/i.test(s) ? '기본 음질' : '';
  }
  function voicePicker() {
    const ja = GQ.speech.voices().filter(v => /^ja/i.test(v.lang));
    if (!ja.length) return '';
    const cur = GQ.speech.currentVoice();
    return `<section class="card"><h2>단어 읽는 목소리</h2><p class="sub">글자 하나는 사람 목소리 녹음으로 나와요. 여기서는 ねこ 같은 단어를 읽는 기계 음성을 골라요.</p>
      <div class="pieces" style="grid-template-columns:1fr 1fr">${ja.map(v => `<button class="piece" data-vuri="${esc(v.voiceURI)}" aria-pressed="${!!cur && cur.voiceURI === v.voiceURI}" style="font-size:14px;padding:10px">
        <b>${esc(v.name)}</b><span class="sub">${voiceQuality(v) || esc(v.lang)}</span></button>`).join('')}</div>
      <p class="fine">아이폰 설정 → 손쉬운 사용 → 읽기 및 말하기 → 음성 → 일본어에서 '향상된 음질'이나 '고음질' 목소리를 내려받으면 여기에 나타날 수 있어요.</p></section>`;
  }
  function renderOpts() {
    const sw = (k, label, sub) => `<div class="setting"><div><b>${label}</b>${sub ? `<br><span class="sub">${sub}</span>` : ''}</div>
      <button class="switch" role="switch" aria-checked="${state.settings[k]}" aria-label="${label}" data-s="${k}"></button></div>`;
    const c = GQ.speech.caps();
    shell(`<h1>설정</h1><p class="sub">앱 버전 ${APP_VERSION}</p>
      <section class="card">${sw('hangul', '한글 발음 같이 보기', '로마자 옆에 한글 발음을 보여줘요')}${sw('sound', '소리', '문제를 풀 때 일본어 발음을 들려줘요')}
        ${sw('joinKana', '녹음 없는 단어는 글자 녹음 이어 붙이기', '대부분의 단어는 사람이 단어째 녹음한 소리로 나와요. 녹음이 없는 단어만, 켜면 글자 녹음을 이어 붙이고 끄면 기계 음성으로 읽어요')}
        <button class="btn ghost small" id="trywords">단어 소리 들어보기 (いえ · ねこ · ありがとう)</button></section>
      ${voicePicker()}
      <section class="card"><h2>이 기기에서</h2>
        <div class="setting"><span>듣기 (일본어 음성)</span><b>${caps.tts ? '사용 가능' : '사용 불가'}</b></div>
        <div class="setting"><span>말하기 채점</span><b>${c.asr ? '음성 인식' : '스스로 채점'}</b></div>
        <p class="fine">음성 인식을 못 쓰는 기기에서는 소리 내어 읽고 정답을 들은 다음 스스로 채점해요.</p>
        <button class="btn ghost small" id="diag">소리 테스트</button><pre id="diagout" class="fine" style="white-space:pre-wrap;margin:0" hidden></pre></section>
      <section class="card"><h2>기록 옮기기</h2><p class="sub">다른 곳에서 열 때(새 앱 주소, 다른 휴대폰) 지금까지의 XP·리그·복습·조각을 그대로 가져가요.</p>
        <div class="actions"><button class="btn ghost small" id="exp">기록 복사하기</button><button class="btn ghost small" id="imp">기록 붙여넣기</button></div>
        <div id="movebox" hidden style="display:grid;gap:8px"></div></section>
      <section class="card"><h2>기록</h2><p class="sub">지금까지 XP ${state.xp.total} · 푼 문제 ${state.stats.answered}개 · 최고 연속 ${state.streak.best || 0}일</p>
        <div id="reset"><button class="btn ghost small" id="r1">기록 처음부터 다시</button></div></section>
      <section class="card"><h2>도움말</h2><p class="sub">· 레슨을 한 번 끝내면 그 행의 보스에 도전할 수 있고, 보스를 깨면 다음 행이 열려요.<br>· 리그는 매주 월요일 0시(한국 시간)에 새로 시작해요.<br>· 틀린 글자는 10분 뒤, 맞힌 글자는 1일, 3일, 7일… 간격으로 복습에 나와요.</p>
        <p class="fine">획순 데이터: <a href="https://kanjivg.tagaini.net/" target="_blank" rel="noopener">KanjiVG</a> (© Ulrich Apel, CC BY-SA 3.0)</p>
        <p class="fine">글자 발음 녹음: Fukujinzuke, <a href="https://lingualibre.org/" target="_blank" rel="noopener">Lingua Libre</a> / Wikimedia Commons (<a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener">CC BY 4.0</a>). 앱에 맞게 그대로 사용. 단어 발음은 기기의 음성 합성.</p></section>`);
    app.querySelectorAll('[data-vuri]').forEach(b => b.onclick = () => {
      state.settings.voiceURI = b.dataset.vuri; GQ.speech.setPreferred(b.dataset.vuri); save();
      GQ.speech.say('あいうえお。ねこ', { raw: true, rate: 0.8 });
      app.querySelectorAll('[data-vuri]').forEach(x => x.setAttribute('aria-pressed', x === b));
    });
    app.querySelectorAll('[data-s]').forEach(b => b.onclick = () => {
      state.settings[b.dataset.s] = !state.settings[b.dataset.s];
      GQ.speech.setJoin(state.settings.joinKana); save(); renderOpts();
    });
    app.querySelector('#trywords').onclick = async () => {
      for (const w of ['いえ', 'ねこ', 'ありがとう']) { await GQ.speech.say(w); await new Promise(r => setTimeout(r, 350)); }
    };
    app.querySelector('#diag').onclick = () => {
      const pre = app.querySelector('#diagout'); pre.hidden = false; pre.textContent = '[사람 목소리 녹음]\n';
      GQ.speech.diagnoseClip((line) => { pre.textContent += line + '\n'; });
      setTimeout(() => { pre.textContent += '\n[기계 음성]\n'; GQ.speech.diagnose((line) => { pre.textContent += line + '\n'; }); }, 2500);
    };
    const box = app.querySelector('#movebox');
    app.querySelector('#exp').onclick = () => {
      const code = GQ.store.exportCode(state);
      box.hidden = false;
      box.innerHTML = `<textarea id="code" readonly rows="3" style="width:100%;font:12px monospace;border-radius:10px;padding:8px;border:1px solid var(--line);background:var(--paper);color:var(--ink)">${esc(code)}</textarea>
        <p class="sub" id="cmsg">복사하는 중…</p>`;
      const ta = box.querySelector('#code'), msg = box.querySelector('#cmsg');
      const fallback = () => { ta.focus(); ta.select(); msg.textContent = '위 글자를 길게 눌러 전체 선택 → 복사하세요.'; };
      try { navigator.clipboard.writeText(code).then(() => { msg.textContent = '복사했어요. 새 앱의 설정 → 기록 붙여넣기에 붙여넣으세요.'; }, fallback); } catch (e) { fallback(); }
    };
    app.querySelector('#imp').onclick = () => {
      box.hidden = false;
      box.innerHTML = `<textarea id="paste" rows="3" placeholder="GQ1: 로 시작하는 기록 코드를 붙여넣으세요" style="width:100%;font:12px monospace;border-radius:10px;padding:8px;border:1px solid var(--line);background:var(--paper);color:var(--ink)"></textarea>
        <p class="sub" id="pmsg">붙여넣으면 지금 이 기기의 기록은 붙여넣은 기록으로 바뀌어요.</p>
        <button class="btn small" id="doimp">이 기록으로 바꾸기</button>`;
      box.querySelector('#doimp').onclick = () => {
        try {
          const next = GQ.store.importCode(box.querySelector('#paste').value);
          state = next; refreshDaily(); save(); toast(`기록을 가져왔어요 (XP ${state.xp.total})`); renderOpts();
        } catch (e) { box.querySelector('#pmsg').textContent = e.message + '. 코드를 처음부터 끝까지 다시 복사해 주세요.'; }
      };
    };
    app.querySelector('#r1').onclick = () => {
      const box = app.querySelector('#reset');
      box.innerHTML = `<p class="sub" style="color:var(--bad)">XP, 리그, 조각, 복습 기록이 모두 지워지고 되돌릴 수 없어요.</p><div class="actions"><button class="btn ghost small" id="rc">취소</button><button class="btn bad small" id="rd">모두 지우기</button></div>`;
      box.querySelector('#rc').onclick = renderOpts;
      box.querySelector('#rd').onclick = () => { state = GQ.store.defaultState(); refreshDaily(); save(); tab = 'home'; render(); toast('처음부터 다시 시작해요'); };
    };
  }

  // ---------- 새 버전 확인 (GitHub Pages에서만) ----------
  function checkUpdate() {
    if (window.claude || location.protocol !== 'https:') return;
    fetch('version.json?t=' + Date.now(), { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(j => {
      if (!j) return;
      let tried = null; try { tried = sessionStorage.getItem('gq_reload_for'); } catch (e) {}
      if (GQ.store.needsReload(j.v, APP_VERSION, tried)) {
        if (document.querySelector('.session')) { toast('새 버전이 있어요. 레슨을 끝내면 바뀌어요'); return; }
        try { sessionStorage.setItem('gq_reload_for', j.v); } catch (e) {}
        location.reload();
      }
    }).catch(() => {});
  }

  // ---------- 카타카나만 반듯한 글꼴로 ----------
  // 화면에 새로 그려진 글자 중 카타카나 덩어리를 <span class="kt">로 감쌈 (히라가나·한국어는 그대로)
  function wrapKata(root) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: (n) => (/[ァ-ヺー-ヾ]/.test(n.nodeValue) && n.parentNode && !n.parentNode.closest('.kt, textarea, script, style, svg'))
        ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT,
    });
    const nodes = []; while (walker.nextNode()) nodes.push(walker.currentNode);
    for (const n of nodes) {
      const frag = document.createDocumentFragment();
      for (const p of D.splitKata(n.nodeValue)) {
        if (p.kata) { const s = document.createElement('span'); s.className = 'kt'; s.textContent = p.t; frag.appendChild(s); }
        else frag.appendChild(document.createTextNode(p.t));
      }
      n.parentNode.replaceChild(frag, n);
    }
  }
  new MutationObserver((muts) => {
    for (const m of muts) for (const n of m.addedNodes) {
      if (n.nodeType === 1 && !n.classList.contains('kt')) wrapKata(n);
      else if (n.nodeType === 3 && n.parentNode && !n.parentNode.closest('.kt')) wrapKata(n.parentNode);
    }
  }).observe(document.body, { childList: true, subtree: true });

  // ---------- 시작 ----------
  async function boot() {
    store = GQ.store.createStore([GQ.store.dbBackend(), GQ.store.localBackend('gq_state_v1')]);
    caps = GQ.speech.capsOf(window);
    state = await store.load();
    state = GQ.chest.migrate(state, now()); // 예전 조각 → 상자, 캐릭터 데이터 정리
    GQ.speech.setPreferred(state.settings.voiceURI);
    GQ.speech.setJoin(state.settings.joinKana);
    refreshDaily(); save();
    render();
    document.addEventListener('pointerdown', () => GQ.speech.unlock(), { once: true });
    GQ.speech.init().then(c => { caps = c; });
    setInterval(() => { if (!document.querySelector('.session') && !document.querySelector('.sheet-bg') && tab === 'league') render(); }, 60000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden && !document.querySelector('.session')) { refreshDaily(); save(); render(); checkUpdate(); } });
    checkUpdate();
  }
  GQ.ui = { boot, get state() { return state; } };
  boot();
})();
