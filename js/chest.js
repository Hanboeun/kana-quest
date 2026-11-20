// 보물상자: 보상은 상자로 쌓이고, 열면 아직 없는 꾸미기 아이템 하나 (다 모았으면 XP 50)
(function () {
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const ALL_OWNED_XP = 50;
  function grant(state, source, n, now) {
    const s = clone(state); n = n == null ? 1 : n; now = now || Date.now();
    s.chests.count += n;
    for (let i = 0; i < n; i++) s.chests.log.push({ source, at: now });
    if (s.chests.log.length > 50) s.chests.log = s.chests.log.slice(-50);
    return s;
  }
  function open(state, rng, now) {
    if (!state.chests || state.chests.count <= 0) return { state, item: null, xp: 0 };
    let s = clone(state); s.chests.count -= 1;
    const left = GQ.avatar.unowned(s.avatar.owned);
    if (!left.length) { s = GQ.quests.addXp(s, ALL_OWNED_XP, now || Date.now()); return { state: s, item: null, xp: ALL_OWNED_XP }; }
    const item = left[Math.floor((rng || Math.random)() * left.length)];
    s.avatar.owned.push(item.id);
    return { state: s, item, xp: 0 };
  }
  // 예전 2D 조각은 개수만큼 상자로 한 번만 바꿔주고, 캐릭터 데이터는 항상 정리
  function migrate(state, now) {
    let s = clone(state);
    if (!s.migratedAvatar) {
      const old = (s.owned || []).length;
      if (old) s = grant(s, 'old-pieces', old, now);
      s.migratedAvatar = true;
    }
    const known = new Set(GQ.avatar.items.map(i => i.id));
    const extra = (s.avatar.owned || []).filter(id => known.has(id) && !GQ.avatar.STARTER.includes(id));
    s.avatar.owned = GQ.avatar.STARTER.concat([...new Set(extra)]);
    s.avatar.look = GQ.avatar.sanitize(s.avatar.look, s.avatar.owned);
    return s;
  }
  GQ.chest = { grant, open, migrate, ALL_OWNED_XP };
})();
