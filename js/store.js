// 상태 저장. 백엔드 여러 개(아티팩트 db, 브라우저 저장소)에 같이 저장하고, 불러올 땐 처음으로 값이 있는 곳을 씀.
(function () {
  function defaultState() {
    return {
      version: 1,
      cards: {},
      xp: { total: 0, byDay: {} },
      league: { tier: 0, weekKey: null, seed: Math.floor(Math.random() * 1e9) },
      streak: { count: 0, lastDay: null, best: 0 },
      quests: { dayKey: null, list: [] },
      unlocked: [GQ.data.groups[0].id],
      seenIntro: [],
      groupLessons: {},
      bossCleared: [],
      finalBoss: { cleared: false, best: null },
      owned: [],
      equipped: { hat: null, outfit: null, item: null, bg: null },
      settings: { hangul: false, sound: true, voiceURI: '', joinKana: false, voice: 'nanami', nickname: '' },
      stats: { answered: 0, correct: 0, speak: 0, write: 0, bestCombo: 0 },
      chests: { count: 0, log: [] },
      avatar: { look: GQ.avatar ? GQ.avatar.defaultLook() : {}, owned: GQ.avatar ? GQ.avatar.STARTER.slice() : [] },
      migratedAvatar: false,
      room: null, // 친구 리그 방 {code, name, tier, lastSeen}
      pendingResult: null,
    };
  }
  const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
  function merge(def, raw) {
    if (!isObj(raw)) return def;
    const out = {};
    for (const k of Object.keys(def)) {
      const d = def[k], r = raw[k];
      if (r === undefined) out[k] = d;
      else if (isObj(d) && Object.keys(d).length && isObj(r)) out[k] = merge(d, r);
      else if (Array.isArray(d)) out[k] = Array.isArray(r) ? r : d;
      else if (isObj(d)) out[k] = isObj(r) ? r : d;
      else out[k] = (d === null || typeof r === typeof d) ? r : d;
    }
    return out;
  }
  function normalize(raw) {
    if (typeof raw === 'string') { try { raw = JSON.parse(raw); } catch (e) { raw = null; } }
    const st = merge(defaultState(), raw);
    st.version = 1;
    if (!st.unlocked.length) st.unlocked = [GQ.data.groups[0].id];
    return st;
  }
  function createStore(backends) {
    let chain = Promise.resolve();
    return {
      async load() {
        for (const b of backends) {
          try {
            const v = await b.get();
            if (v !== null && v !== undefined && v !== '') return normalize(v);
          } catch (e) { /* 다음 백엔드 */ }
        }
        return defaultState();
      },
      save(state) {
        const snap = JSON.parse(JSON.stringify(state));
        chain = chain.then(() => Promise.allSettled(backends.map(b => Promise.resolve().then(() => b.set(snap)))));
        return chain;
      },
    };
  }
  function localBackend(key) {
    return {
      get: async () => { try { return localStorage.getItem(key); } catch (e) { return null; } },
      set: async (o) => { try { localStorage.setItem(key, JSON.stringify(o)); } catch (e) {} },
    };
  }
  // 아티팩트 db: data/users/<id>/state (본인만 읽고 쓰는 영역)
  function dbBackend() {
    let refP = null;
    const ref = () => refP || (refP = (async () => {
      if (!window.claude || !window.claude.use) return null;
      const [db, user] = await Promise.all([window.claude.use('db'), window.claude.use('user')]);
      if (!db || !user) return null;
      const id = await user.id();
      return id ? db.doc('data/users/' + id + '/state') : null;
    })().catch(() => null));
    return {
      get: async () => {
        const r = await ref(); if (!r) return null;
        const snap = await Promise.race([r.get(), new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 10000))]);
        return snap.exists ? (snap.data() || {}).json || null : null;
      },
      set: async (o) => { const r = await ref(); if (r) await r.set({ json: JSON.stringify(o), at: Date.now() }); },
    };
  }
  // 기록 옮기기: 다른 곳(예: GitHub Pages 앱)으로 복사·붙여넣기 할 수 있는 글자 코드
  function exportCode(state) {
    const bytes = new TextEncoder().encode(JSON.stringify(state));
    let bin = ''; for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return 'GQ1:' + btoa(bin);
  }
  function importCode(code) {
    const c = String(code || '').trim();
    if (!c.startsWith('GQ1:')) throw new Error('일본어 초급반 기록 코드가 아니에요');
    let obj;
    try {
      const bin = atob(c.slice(4)); const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      obj = JSON.parse(new TextDecoder().decode(bytes));
    } catch (e) { throw new Error('코드가 잘렸거나 깨졌어요'); }
    if (!isObj(obj) || !isObj(obj.xp)) throw new Error('기록 내용이 비어 있어요');
    return normalize(obj);
  }
  // 서버에 더 새 버전이 있으면 새로고침 (같은 버전으로는 한 번만 시도해서 무한 반복 방지)
  function needsReload(remote, local, triedFor) {
    const r = parseInt(remote, 10), l = parseInt(local, 10);
    if (!r || !l) return false;
    return r > l && String(remote) !== String(triedFor);
  }
  GQ.store = { needsReload, exportCode, importCode, defaultState, normalize, createStore, localBackend, dbBackend };
})();
