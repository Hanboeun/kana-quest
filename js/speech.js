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
  // 아이폰 무음 스위치를 켜도 소리가 나게: "음악 앱처럼 재생"으로 알림 (iOS 17 이상 Safari)
  function playbackSession(nav) {
    try { if (nav && nav.audioSession) { nav.audioSession.type = 'playback'; return true; } } catch (e) {}
    return false;
  }
  // 예전 iOS용: 소리 없는 오디오를 계속 틀어두면 웹 소리가 '미디어 재생'으로 바뀌어 무음 모드에서도 들림
  let silentEl = null;
  function silentLoop() {
    if (silentEl) return;
    try {
      const sr = 8000, n = sr / 2, buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf);
      const w = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
      w(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); w(8, 'WAVEfmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
      v.setUint32(24, sr, true); v.setUint32(28, sr * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, n * 2, true);
      silentEl = new Audio(URL.createObjectURL(new Blob([buf], { type: 'audio/wav' })));
      silentEl.loop = true; silentEl.setAttribute('playsinline', '');
      const p = silentEl.play(); if (p && p.catch) p.catch(() => { silentEl = null; });
    } catch (e) { silentEl = null; }
  }
  playbackSession(typeof navigator !== 'undefined' ? navigator : null);
  function unlock() {
    if (!playbackSession(navigator) && /iPhone|iPad|iPod/.test(navigator.userAgent)) silentLoop();
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
  let actx = null;
  const bufs = new Map();
  function audioCtx() {
    if (!actx) { const C = window.AudioContext || window.webkitAudioContext; if (!C) return null; try { actx = new C(); } catch (e) { return null; } }
    return actx;
  }
  function loadClip(url) {
    const ctx = audioCtx(); if (!ctx) return Promise.reject(new Error('no audio'));
    if (GQ.speech && GQ.speech._testBuffer) { const b = ctx.createBuffer(1, 8000, 16000); b.getChannelData(0).fill(0.2); return Promise.resolve(b); }
    if (bufs.has(url)) return bufs.get(url);
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
  // 지금 울리거나 예약된 소리 전부 (화면을 넘기면 한꺼번에 멈춤)
  const active = new Set();
  let token = 0;
  // 소리를 0에서 갑자기 켜거나 뚝 끊으면 스피커에서 "치직" 잡음이 나서, 항상 짧게 페이드
  const STOP_FADE = 0.02;
  function envelopeFor(dur, joined) {
    let fadeIn = joined ? 0.025 : 0.01, fadeOut = joined ? 0.08 : 0.03;
    const room = Math.max(0, dur);
    if (fadeIn + fadeOut > room) { const k = room / (fadeIn + fadeOut); fadeIn *= k; fadeOut *= k; }
    return { fadeIn, fadeOut };
  }
  function startSource(ctx, buf, when, offset, dur, joined) {
    prepBuf(buf);
    when = Math.max(when, ctx.currentTime + 0.005);
    const g = ctx.createGain(); g.connect(ctx.destination);
    const peak = buf.__gain, env = envelopeFor(dur, joined);
    g.gain.setValueAtTime(0, when);
    g.gain.linearRampToValueAtTime(peak, when + env.fadeIn);
    g.gain.setValueAtTime(peak, when + dur - env.fadeOut);
    g.gain.linearRampToValueAtTime(0, when + dur);
    const s = ctx.createBufferSource(); s.buffer = buf; s.connect(g);
    s.__g = g;
    s.onended = () => active.delete(s);
    active.add(s);
    s.start(when, offset, dur);
    return s;
  }
  function stop() {
    token++;
    clearTimeout(pendingT);
    const ctx = actx;
    active.forEach(s => {
      try {
        if (ctx && s.__g) { // 뚝 끊지 않고 0.02초 동안 줄인 뒤 멈춤
          const now = ctx.currentTime, gn = s.__g.gain;
          gn.cancelScheduledValues(now); gn.setValueAtTime(gn.value, now); gn.linearRampToValueAtTime(0, now + STOP_FADE);
          s.stop(now + STOP_FADE + 0.01);
        } else s.stop();
      } catch (e) {}
    });
    active.clear();
    try { if (window.speechSynthesis && (speechSynthesis.speaking || speechSynthesis.pending)) speechSynthesis.cancel(); } catch (e) {}
  }
  function playPlan(plan) {
    const ctx = audioCtx(); if (!ctx) return Promise.reject(new Error('no audio'));
    if (ctx.state === 'suspended') ctx.resume();
    const my = token;
    return Promise.all(plan.map(p => p.clip ? loadClip(p.clip) : null)).then(bufsArr => new Promise(res => {
      if (my !== token) return res(); // 그사이 화면이 넘어감
      let t = ctx.currentTime + 0.03;
      plan.forEach((p, i) => {
        if (p.pause) { t += p.pause; return; }
        const buf = bufsArr[i]; prepBuf(buf);
        const dur = buf.__trim.end - buf.__trim.start;
        startSource(ctx, buf, t, buf.__trim.start, dur, true);
        t += Math.max(0.14, dur - 0.1); // 앞 글자가 줄어드는 동안 다음 글자가 겹쳐 들어옴
      });
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
      const s = sourceFor(t);
      if (s.url) loadClip(s.url).catch(() => {});
      else if (s.plan) s.plan.forEach(x => x.clip && loadClip(x.clip).catch(() => {}));
    }
  }
  function playClip(url) {
    const ctx = audioCtx(); if (!ctx) return Promise.reject(new Error('no audio'));
    if (ctx.state === 'suspended') ctx.resume();
    const my = token;
    return loadClip(url).then(buf => new Promise(res => {
      if (my !== token) return res();
      prepBuf(buf); // 녹음마다 크기가 달라서 가장 큰 소리를 0.8에 맞춤
      const t = buf.__trim;
      const s = startSource(ctx, buf, 0, t.start, t.end - t.start, false);
      const prevEnd = s.onended; s.onended = () => { prevEnd(); res(); };
      setTimeout(res, (t.end - t.start) * 1000 + 500);
    }));
  }

  let pendingT = null, join = false;
  // 녹음 없는 단어를 글자 녹음 이어 붙이기로 읽을지 (기본: 끔 → 기계 음성)
  function setJoin(v) { join = !!v; }
  // 단어 통째 녹음 (같은 화자 Fukujinzuke)
  let wordClips = new Set(GQ.wordAudio || []);
  function setWordClips(list) { wordClips = new Set(list || []); }
  function wordClipKeys() { return [...wordClips]; }
  function sourceFor(text) {
    const k = clipFor(text); if (k) return { type: 'kana', url: k };
    if (wordClips.has(text)) return { type: 'word', url: 'audio/w/' + encodeURIComponent(text) + '.mp3' };
    if (join) { const p = wordPlan(text); if (p) return { type: 'join', plan: p }; }
    return { type: 'tts' };
  }
  // opts.delay: 화면이 바뀌자마자 나오지 않도록 자동 재생은 잠깐 기다렸다가
  function say(text, opts) {
    opts = opts || {};
    stop(); // 새 소리는 앞 소리를 모두 끊고 시작
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
      const src = (opts.raw || opts.voiceName) ? { type: 'tts' } : sourceFor(text);
      const play = src.type === 'tts' ? go : () => {
        (src.type === 'join' ? playPlan(src.plan) : playClip(src.url)).then(() => resolve(), () => go());
      };
      if (opts.delay) pendingT = setTimeout(play, opts.delay); else play();
    });
  }
  // 반드시 버튼 클릭 안에서 바로 호출 (await 없이)
  // onReady: 아이폰이 실제로 듣기 시작한 순간 (그때 "지금 말하세요" 표시)
  function listen(accept, onPartial, onReady) {
    return new Promise((resolve) => {
      let heard = '', settled = false;
      const done = (h, err) => { if (settled) return; settled = true; resolve({ heard: h, ok: matchHeard(h, accept), error: err || null }); };
      const timer = setTimeout(() => stop(), 5000);
      let stop = () => done(heard);
      if (dictation) {
        const offs = [];
        offs.push(dictation.onPartial(({ text }) => { onPartial && onPartial(text); if (matchHeard(text, accept)) { heard = text; clearTimeout(timer); dictation.stop().catch(() => {}); done(text); } }));
        offs.push(dictation.onFinal(({ text }) => { heard += text; }));
        offs.push(dictation.onState(({ state, reason }) => {
          if (state === 'listening') onReady && onReady();
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
          // 알아들은 순간 바로 채점 (아이폰이 듣기를 끝낼 때까지 기다리지 않음)
          if (hit) { clearTimeout(timer); try { rec.stop(); } catch (e) {} done(hit); }
        };
        let readyFired = false;
        const ready = () => { if (!readyFired) { readyFired = true; onReady && onReady(); } };
        rec.onaudiostart = ready;
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
  GQ.speech = { envelopeFor, STOP_FADE, playbackSession, setJoin, setWordClips, wordClipKeys, sourceFor, stop, _activeCount: () => active.size, wordPlan, trimBounds, diagnoseClip, setClips, clipKeys, clipFor, preload, chooseVoice, setPreferred, spoken, diagnose, voices, currentVoice: () => voice, capsOf, matchHeard, init, caps, unlock, say, listen, isBroken: () => asrBroken };
})();
