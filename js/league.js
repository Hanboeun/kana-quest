// 가상 플레이어 주간 리그. 모든 값은 (시드, 주, 플레이어 번호, 날짜)로 정해져서 앱을 닫아둬도 자연스럽게 흘러감.
(function () {
  const SIZE = 30, UP = 7, DOWN = 5, TIERS = 10;
  const STYLES = {
    steady: [1, 1, 1, 1, 1, 1, 1],
    weekend: [0.3, 0.3, 0.3, 0.3, 0.6, 2.2, 2.2],
    early: [2, 1.8, 1.2, 0.6, 0.3, 0.2, 0.2],
    clutch: [0.6, 0.6, 0.6, 0.6, 0.6, 0.8, 3],
    idle: [0.05, 0.05, 0.05, 0.05, 0.05, 0.05, 0.05],
  };
  const STYLE_MIX = [].concat(Array(8).fill('steady'), Array(6).fill('weekend'), Array(6).fill('early'), Array(5).fill('clutch'), Array(4).fill('idle'));
  const COLORS = ['#e8590c', '#1c7ed6', '#2f9e44', '#ae3ec9', '#f08c00', '#0c8599', '#d6336c', '#5c7cfa', '#74b816', '#c2255c'];

  function members(tier, weekKey, seed, count) {
    const r = GQ.rand.rng(seed + '|m|' + weekKey + '|' + tier);
    const names = GQ.rand.shuffle(GQ.data.botNames, r).slice(0, count == null ? SIZE - 1 : count);
    const styles = GQ.rand.shuffle(STYLE_MIX, r);
    return names.map((name, i) => ({
      id: 'b' + i, name, style: styles[i], color: COLORS[Math.floor(r() * COLORS.length)],
      power: 0.5 + r() * 1.1, key: seed + '|' + weekKey + '|' + tier + '|' + i,
    }));
  }
  function dayXp(m, tier, d) {
    const r = GQ.rand.rng(m.key + '|d' + d);
    const skip = m.style !== 'steady' && r() < 0.15;
    if (skip) return 0;
    const base = 20 * Math.pow(1.3, tier);
    return Math.round(base * STYLES[m.style][d] * m.power * (0.6 + r() * 0.8));
  }
  function botXp(m, tier, weekKey, now) {
    const start = GQ.time.keyToMs(weekKey);
    let xp = 0;
    for (let d = 0; d < 7; d++) {
      const f = (now - (start + d * GQ.time.DAY)) / GQ.time.DAY;
      if (f <= 0) break;
      // 하루 중 진행은 오전엔 느리고 저녁에 빠르게
      const p = Math.min(1, f);
      xp += Math.floor(dayXp(m, tier, d) * (p * p * (3 - 2 * p)));
    }
    return xp;
  }
  function myWeekXp(state, weekKey) {
    let s = 0;
    for (let d = 0; d < 7; d++) s += state.xp.byDay[GQ.time.addDays(weekKey, d)] || 0;
    return s;
  }
  // 친구 리그 방: 마지막으로 받아 둔 방 사람들 기록(그 주 것만)
  function roomRealFor(state, weekKey) {
    const ls = state.room && state.room.lastSeen;
    if (!ls || ls.weekKey !== weekKey || !ls.members) return [];
    return Object.keys(ls.members).map(uid => ({ id: uid, name: ls.members[uid].name || '친구', xp: ls.members[uid].xp || 0, look: ls.members[uid].look || null }));
  }
  // real: 나를 뺀 방 사람들 [{id,name,xp,look}]. 남는 자리는 가상 플레이어로 채움.
  // 방에 있으면 가상 플레이어는 방 코드·방 단계로 정해져서 모두에게 똑같이 보임
  function standingsFor(state, tier, weekKey, now, real) {
    const room = state.room && state.room.code ? state.room : null;
    real = (real || roomRealFor(state, weekKey)).slice(0, SIZE - 1);
    const seed = room ? 'room:' + room.code : state.league.seed;
    const botTier = room && room.tier != null ? room.tier : tier;
    const rows = members(botTier, weekKey, seed, SIZE - 1 - real.length).map(m => ({ id: m.id, name: m.name, color: m.color, xp: botXp(m, botTier, weekKey, now), isMe: false, isBot: true }));
    for (const p of real) rows.push({ id: p.id, name: p.name, xp: p.xp, look: p.look || null, isMe: false, isReal: true });
    rows.push({ id: 'me', name: room && room.name ? room.name : '나', xp: myWeekXp(state, weekKey), isMe: true });
    rows.sort((a, b) => b.xp - a.xp || (a.isMe ? -1 : b.isMe ? 1 : 0));
    rows.forEach((r, i) => { r.rank = i + 1; });
    return rows;
  }
  function standings(state, now, real) {
    const wk = state.league.weekKey || GQ.time.weekKey(now);
    return standingsFor(state, state.league.tier, wk, now, real);
  }
  // 초대 코드: 헷갈리는 글자(0,O,1,I,L) 뺀 6자리
  const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  function makeCode(rng) { let c = ''; for (let i = 0; i < 6; i++) c += CODE_CHARS[Math.floor((rng || Math.random)() * CODE_CHARS.length)]; return c; }
  // 방 단계: 방 사람들 리그 단계의 중간값
  function roomTier(tiers) {
    if (!tiers || !tiers.length) return 0;
    const t = tiers.slice().sort((a, b) => a - b), n = t.length;
    return n % 2 ? t[(n - 1) / 2] : Math.floor((t[n / 2 - 1] + t[n / 2]) / 2);
  }
  function settle(state, now) {
    let s = JSON.parse(JSON.stringify(state));
    const cur = GQ.time.weekKey(now);
    if (!s.league.weekKey) { s.league.weekKey = cur; return { state: s, result: null }; }
    if (s.league.weekKey >= cur) return { state: s, result: null };
    let result = null, wk = s.league.weekKey, guard = 0;
    while (wk < cur && guard < 12) {
      const from = s.league.tier;
      const end = GQ.time.keyToMs(GQ.time.addDays(wk, 7)) - 1;
      const me = standingsFor(s, from, wk, end).find(r => r.isMe);
      let to = from, outcome = 'stay';
      if (me.rank <= UP && from < TIERS - 1) { to = from + 1; outcome = 'up'; }
      else if (me.rank > SIZE - DOWN && from > 0) { to = from - 1; outcome = 'down'; }
      const rewards = [];
      if (outcome === 'up') { s = GQ.chest.grant(s, 'league', 1, end); rewards.push('chest'); }
      s.league.tier = to;
      result = { weekKey: wk, rank: me.rank, xp: me.xp, fromTier: from, toTier: to, outcome, rewards };
      wk = GQ.time.addDays(wk, 7); guard++;
    }
    if (wk < cur) { // 아주 오래 비웠으면 남은 주는 강등만 반영(바닥 0)
      const weeks = Math.round(GQ.time.dayDiff(wk, cur) / 7);
      s.league.tier = Math.max(0, s.league.tier - weeks);
      result.toTier = s.league.tier;
    }
    s.league.weekKey = cur;
    s.pendingResult = result;
    return { state: s, result };
  }
  GQ.league = { SIZE, UP, DOWN, TIERS, members, botXp, standings, settle, myWeekXp, makeCode, roomTier, roomRealFor, CODE_CHARS };
})();
