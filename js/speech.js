// 듣기(음성 합성)와 말하기(음성 인식). 인식이 안 되는 기기에서는 화면이 스스로 채점하는 방식으로 바뀜.
(function () {
  function capsOf(win) {
    return {
      tts: !!(win.speechSynthesis && win.SpeechSynthesisUtterance),
      asr: !!(win.SpeechRecognition || win.webkitSpeechRecognition),
    };
  }
  const toHira = (s) => s.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
  const norm = (s) => toHira(String(s || '').normalize('NFKC').toLowerCase().replace(/[\s。、，．,.!?！？・「」『』"'~〜]/g, ''));
  function matchHeard(heard, expected) {
    const h = norm(heard); if (!h) return false;
    return expected.some(e => { const x = norm(e); return x && (h === x || h.includes(x)); });
  }

  let voice = null, dictation = null, asrBroken = false, preferred = '';
  // 저장한 목소리 > 고음질(premium) > 향상된(enhanced) > 그 밖의 일본어 목소리
  function chooseVoice(vs, pref) {
    const ja = vs.filter(v => /^ja/i.test(v.lang));
    if (!ja.length) return null;
    if (pref) { const p = ja.find(v => v.voiceURI === pref); if (p) return p; }
    const score = (v) => (/premium/i.test(v.voiceURI + v.name) ? 3 : /enhanced|향상/i.test(v.voiceURI + v.name) ? 2 : /Kyoko|O-ren|Otoya|Google/i.test(v.name) ? 1 : 0);
    return ja.slice().sort((a, b) => score(b) - score(a))[0];
  }
  function pickVoice() {
    if (!window.speechSynthesis) return;
    voice = chooseVoice(speechSynthesis.getVoices() || [], preferred);
  }
  function setPreferred(uri) { preferred = uri || ''; pickVoice(); }
  async function init() {
    if (window.speechSynthesis) { pickVoice(); speechSynthesis.onvoiceschanged = pickVoice; }
    try { if (window.claude && window.claude.use) dictation = await window.claude.use('dictation'); } catch (e) { dictation = null; }
    return caps();
  }
  // asr: 실제 음성 인식이 될 가능성이 있는지. 안 되면 화면이 스스로 채점 모드로.
  function caps() {
    const c = capsOf(window);
    return { tts: c.tts, asr: !asrBroken && (!!dictation || c.asr) };
  }
  function unlock() {
    try { // 아이폰은 첫 터치 때 오디오를 깨워둬야 나중에 자동 재생이 됨
      const ctx = audioCtx();
      if (ctx) { if (ctx.state === 'suspended') ctx.resume(); const b = ctx.createBuffer(1, 1, 22050); const s = ctx.createBufferSource(); s.buffer = b; s.connect(ctx.destination); s.start(0); }
    } catch (e) {}
    try { if (window.speechSynthesis) { const u = new SpeechSynthesisUtterance(' '); u.volume = 0; speechSynthesis.speak(u); } } catch (e) {}
  }
  // 글자 하나는 아이폰 음성이 너무 짧게 끊어 읽어서, 모음을 늘이고(あ→あー) 천천히 읽게 함
  function spoken(text) {
    const single = !!(GQ.data && GQ.data.byChar.has(text)) && !/[ーっッ]$/.test(text);
    return single ? { text: text + 'ー', rate: 0.7 } : { text, rate: 0.85 };
  }
  // ---- 사람 목소리 녹음 (Lingua Libre, 화자 Fukujinzuke, CC BY 4.0) ----
  let clips = new Set(GQ.audioKeys || []);
  const SAME = { di: 'ji', du: 'zu' }; // ぢ·づ는 じ·ず와 같은 소리
  function setClips(keys) { clips = new Set(keys || []); }
  function clipKeys() { return [...clips]; }
  function clipFor(text) {
    const k = GQ.data && GQ.data.byChar.get(text);
    if (!k) return null;
    let key = k.id.slice(2);
    if (key[0] === 'x') return null;
    if (!clips.has(key) && SAME[key]) key = SAME[key];
    return clips.has(key) ? 'audio/' + key + '.wav' : null;
  }
  let actx = null, curSrc = null;
  const bufs = new Map();
  function audioCtx() {
    if (!actx) { const C = window.AudioContext || window.webkitAudioContext; if (!C) return null; try { actx = new C(); } catch (e) { return null; } }
    return actx;
  }
  function loadClip(url) {
    if (bufs.has(url)) return bufs.get(url);
    const ctx = audioCtx(); if (!ctx) return Promise.reject(new Error('no audio'));
    const p = fetch(url).then(r => { if (!r.ok) throw new Error('http ' + r.status); return r.arrayBuffer(); })
      .then(ab => new Promise((res, rej) => ctx.decodeAudioData(ab, res, rej)));
    bufs.set(url, p); p.catch(() => bufs.delete(url));
    return p;
  }
  // 단어: 글자별 녹음을 이어 붙이는 계획. 녹음 없는 글자가 하나라도 있으면 null(기계 음성)
  function keyOf(k) { let key = k.id.slice(2); if (!clips.has(key) && SAME[key]) key = SAME[key]; return key; }
  function wordPlan(text) {
    const toks = GQ.data && GQ.data.tokenize(text);
    if (!toks || toks.length < 2) return null;
    const plan = []; let lastKey = null;
    for (const k of toks) {
      if (k.id.endsWith('xtsu')) { plan.push({ pause: 0.12 }); continue; }
      let key;
      if (k.id === 'k-xlong') { const m = lastKey && lastKey.match(/[aiueo]$/); if (!m) return null; key = m[0]; }
      else { if (k.id.slice(2)[0] === 'x') return null; key = keyOf(k); }
      if (!clips.has(key)) return null;
      plan.push({ clip: 'audio/' + key + '.wav' }); lastKey = key;
    }
    return plan;
  }
  function playPlan(plan) {
    const ctx = audioCtx(); if (!ctx) return Promise.reject(new Error('no audio'));
    if (ctx.state === 'suspended') ctx.resume();
    return Promise.all(plan.map(p => p.clip ? loadClip(p.clip) : null)).then(bufsArr => new Promise(res => {
      if (curSrc) { try { curSrc.stop(); } catch (e) {} }
      let t = ctx.currentTime + 0.03, last = null;
      plan.forEach((p, i) => {
        if (p.pause) { t += p.pause; return; }
        const buf = bufsArr[i]; prepBuf(buf);
        const g = ctx.createGain(); g.gain.value = buf.__gain; g.connect(ctx.destination);
        const s = ctx.createBufferSource(); s.buffer = buf; s.connect(g);
        const dur = buf.__trim.end - buf.__trim.start;
        s.start(t, buf.__trim.start, dur); last = s;
        t += Math.max(0.12, dur - 0.06); // 살짝 겹쳐서 덜 끊기게
      });
      curSrc = last;
      setTimeout(res, (t - ctx.currentTime) * 1000 + 300);
    }));
  }
  function prepBuf(buf) {
    if (buf.__gain === undefined) { const d = buf.getChannelData(0); let mx = 0; for (let i = 0; i < d.length; i++) { const v = d[i] < 0 ? -d[i] : d[i]; if (v > mx) mx = v; } buf.__gain = mx > 0.01 ? Math.min(4, 0.8 / mx) : 1; }
    if (!buf.__trim) buf.__trim = trimBounds(buf.getChannelData(0), buf.sampleRate);
  }
  // 녹음 앞뒤의 조용한 부분을 잘라 바로 들리게 (시작 20ms 전, 끝 50ms 뒤까지)
  function trimBounds(d, sr) {
    let mx = 0; for (let i = 0; i < d.length; i++) { const v = d[i] < 0 ? -d[i] : d[i]; if (v > mx) mx = v; }
    const total = d.length / sr;
    if (mx < 0.005) return { start: 0, end: total };
    const th = mx * 0.06;
    let a = 0; while (a < d.length && Math.abs(d[a]) < th) a++;
    let b = d.length - 1; while (b > a && Math.abs(d[b]) < th) b--;
    return { start: Math.max(0, a / sr - 0.02), end: Math.min(total, b / sr + 0.05) };
  }
  function preload(texts) {
    for (const t of texts) {
      const c = clipFor(t); if (c) { loadClip(c).catch(() => {}); continue; }
      const p = wordPlan(t); if (p) p.forEach(x => x.clip && loadClip(x.clip).catch(() => {}));
    }
  }
  function playClip(url) {
    const ctx = audioCtx(); if (!ctx) return Promise.reject(new Error('no audio'));
    if (ctx.state === 'suspended') ctx.resume();
    return loadClip(url).then(buf => new Promise(res => {
      if (curSrc) { try { curSrc.stop(); } catch (e) {} }
      // 녹음마다 크기가 달라서 가장 큰 소리를 0.8에 맞춤
      if (buf.__gain === undefined) { const d = buf.getChannelData(0); let mx = 0; for (let i = 0; i < d.length; i++) { const v = d[i] < 0 ? -d[i] : d[i]; if (v > mx) mx = v; } buf.__gain = mx > 0.01 ? Math.min(4, 0.8 / mx) : 1; }
      const g = ctx.createGain(); g.gain.value = buf.__gain; g.connect(ctx.destination);
      if (!buf.__trim) buf.__trim = trimBounds(buf.getChannelData(0), buf.sampleRate);
      const t = buf.__trim;
      const s = ctx.createBufferSource(); s.buffer = buf; s.connect(g);
      s.onended = () => res(); s.start(0, t.start, t.end - t.start); curSrc = s;
      setTimeout(res, (t.end - t.start) * 1000 + 500);
    }));
  }

  let pendingT = null;
  // opts.delay: 화면이 바뀌자마자 나오지 않도록 자동 재생은 잠깐 기다렸다가
  function say(text, opts) {
    opts = opts || {};
    clearTimeout(pendingT);
    return new Promise((resolve) => {
      const go = () => {
        if (!window.speechSynthesis) return resolve();
        try {
          // 아이폰에서 cancel 직후 speak가 씹히는 경우가 있어, 재생 중일 때만 멈춤
          if (speechSynthesis.speaking || speechSynthesis.pending) speechSynthesis.cancel();
          const sp = opts.raw ? { text, rate: 1 } : spoken(text);
          const u = new SpeechSynthesisUtterance(sp.text);
          const v = opts.voiceName ? (speechSynthesis.getVoices() || []).find(x => x.name === opts.voiceName) : voice;
          u.lang = 'ja-JP'; if (v) u.voice = v; u.rate = opts.rate || sp.rate;
          window.__gqU = u; // 재생 중 가비지 수집 방지
          const t = setTimeout(resolve, 5000);
          u.onend = u.onerror = () => { clearTimeout(t); resolve(); };
          speechSynthesis.speak(u);
        } catch (e) { resolve(); }
      };
      // 녹음이 있는 글자는 사람 목소리로, 실패하면 기계 음성으로
      const human = !opts.raw && !opts.voiceName;
      const clip = human && clipFor(text);
      const plan = human && !clip && wordPlan(text);
      const play = !clip && !plan ? go : () => {
        try { if (window.speechSynthesis && (speechSynthesis.speaking || speechSynthesis.pending)) speechSynthesis.cancel(); } catch (e) {}
        (clip ? playClip(clip) : playPlan(plan)).then(() => resolve(), () => go());
      };
      if (opts.delay) pendingT = setTimeout(play, opts.delay); else play();
    });
  }
  // 반드시 버튼 클릭 안에서 바로 호출 (await 없이)
  function listen(accept, onPartial) {
    return new Promise((resolve) => {
      let heard = '', settled = false;
      const done = (h, err) => { if (settled) return; settled = true; resolve({ heard: h, ok: matchHeard(h, accept), error: err || null }); };
      const timer = setTimeout(() => stop(), 5000);
      let stop = () => done(heard);
      if (dictation) {
        const offs = [];
        offs.push(dictation.onPartial(({ text }) => { onPartial && onPartial(text); if (matchHeard(text, accept)) { heard = text; dictation.stop().catch(() => {}); } }));
        offs.push(dictation.onFinal(({ text }) => { heard += text; }));
        offs.push(dictation.onState(({ state, reason }) => {
          if (state === 'idle') { clearTimeout(timer); offs.forEach(f => f()); if (reason === 'not_granted' || reason === 'unavailable') asrBroken = true; done(heard, reason && reason !== 'stopped' && reason !== 'viewer_stopped' ? reason : null); }
        }));
        stop = () => dictation.stop().catch(() => done(heard));
        dictation.start({ language: 'ja' }).catch((e) => { clearTimeout(timer); offs.forEach(f => f()); if (e && (e.code === 'not_granted' || e.code === 'unavailable')) asrBroken = true; done('', (e && e.code) || 'error'); });
        return;
      }
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SR) { clearTimeout(timer); asrBroken = true; return done('', 'unavailable'); }
      try {
        const rec = new SR();
        rec.lang = 'ja-JP'; rec.interimResults = true; rec.maxAlternatives = 5; rec.continuous = false;
        rec.onresult = (ev) => {
          const alts = [];
          for (let i = 0; i < ev.results.length; i++) for (let j = 0; j < ev.results[i].length; j++) alts.push(ev.results[i][j].transcript);
          const hit = alts.find(a => matchHeard(a, accept));
          heard = hit || alts[0] || '';
          onPartial && onPartial(heard);
          if (hit) rec.stop();
        };
        rec.onerror = (ev) => { if (ev.error === 'not-allowed' || ev.error === 'service-not-allowed') asrBroken = true; clearTimeout(timer); done(heard, ev.error); };
        rec.onend = () => { clearTimeout(timer); done(heard); };
        stop = () => { try { rec.stop(); } catch (e) { done(heard); } };
        rec.start();
      } catch (e) { clearTimeout(timer); asrBroken = true; done('', 'error'); }
    });
  }
  // 진단: 아이폰에서 소리가 어디서 막히는지 화면에 보여주기 위한 것 (버튼 클릭 안에서 호출)
  // 녹음 재생 단계별 진단 (버튼 클릭 안에서 호출)
  function diagnoseClip(onLine) {
    const out = (s) => onLine(s);
    const url = clipFor('あ');
    out('녹음 개수: ' + clips.size + ' / あ 녹음 경로: ' + (url || '없음'));
    const ctx = audioCtx();
    out('AudioContext: ' + (ctx ? '있음, 상태=' + ctx.state + ', ' + ctx.sampleRate + 'Hz' : '없음'));
    if (!url || !ctx) return;
    if (ctx.state === 'suspended') ctx.resume().then(() => out('resume 후 상태=' + ctx.state), (e) => out('resume 실패: ' + e));
    fetch(url).then(r => { out('파일 받기: ' + r.status + ' ' + (r.headers.get('content-type') || '')); return r.arrayBuffer(); })
      .then(ab => { out('파일 크기: ' + ab.byteLength + ' bytes'); return new Promise((res, rej) => ctx.decodeAudioData(ab, res, (e) => rej(e || new Error('decode 실패')))); })
      .then(buf => { out('해독 성공: ' + buf.duration.toFixed(2) + '초'); bufs.set(url, Promise.resolve(buf)); return playClip(url); })
      .then(() => out('재생 끝 (상태=' + ctx.state + ')'))
      .catch(e => out('실패: ' + (e && (e.message || e.name) || e)));
  }
  function diagnose(onLine) {
    const out = (s) => onLine(s);
    const ss = window.speechSynthesis;
    out('speechSynthesis: ' + (ss ? '있음' : '없음') + ' / Utterance: ' + (window.SpeechSynthesisUtterance ? '있음' : '없음'));
    out('창 안(iframe): ' + (window.top !== window ? '예' : '아니오') + ' / 화면: ' + (document.hidden ? '숨김' : '보임'));
    if (!ss) return;
    const vs = ss.getVoices() || [];
    const ja = vs.filter(v => /^ja/i.test(v.lang));
    out('목소리: 전체 ' + vs.length + '개, 일본어 ' + ja.length + '개');
    ja.forEach(v => out(' - ' + v.name + ' | ' + v.voiceURI + (v.localService ? '' : ' (온라인)')));
    out('선택된 목소리: ' + (voice ? voice.name + ' | ' + voice.voiceURI : '없음(기본값 사용)'));
    out('재생 전 상태: speaking=' + ss.speaking + ', pending=' + ss.pending + ', paused=' + ss.paused);
    try {
      const u = new SpeechSynthesisUtterance('あいうえお');
      u.lang = 'ja-JP'; if (voice) u.voice = voice;
      window.__gqDiagU = u; // 가비지 수집 방지
      const t0 = performance.now(), ms = () => Math.round(performance.now() - t0) + 'ms';
      u.onstart = () => out('시작됨 ' + ms());
      u.onend = () => out('끝남 ' + ms());
      u.onerror = (e) => out('오류: ' + (e.error || e.type) + ' ' + ms());
      ss.speak(u);
      out('speak() 호출함 (cancel 없이)');
      setTimeout(() => out('3초 뒤 상태: speaking=' + ss.speaking + ', pending=' + ss.pending), 3000);
    } catch (e) { out('예외: ' + e.message); }
  }
  function voices() { return window.speechSynthesis ? (speechSynthesis.getVoices() || []) : []; }
  GQ.speech = { wordPlan, trimBounds, diagnoseClip, setClips, clipKeys, clipFor, preload, chooseVoice, setPreferred, spoken, diagnose, voices, currentVoice: () => voice, capsOf, matchHeard, init, caps, unlock, say, listen, isBroken: () => asrBroken };
})();
