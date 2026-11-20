// XP, 하루 퀘스트, 연속 학습일, 보상 조각
(function () {
  const XP = { correct: 10, fast: 5, lesson: 20, boss: 50, quest: 30 };
  const POOL = {
    xp: { title: (t) => `XP ${t} 모으기`, targets: [50, 80, 120] },
    review: { title: (t) => `복습 ${t}문제 풀기`, targets: [10, 15, 20] },
    speak: { title: (t) => `소리 내어 읽기 ${t}번`, targets: [5, 8, 10] },
    write: { title: (t) => `글자 ${t}개 쓰기`, targets: [3, 5, 8] },
    lesson: { title: (t) => `레슨 ${t}개 끝내기`, targets: [1, 2] },
    perfect: { title: () => '레슨 하나 틀리지 않고 끝내기', targets: [1] },
    combo: { title: () => '한 번에 10콤보 달성', targets: [1] },
  };
  const POOL_TYPES = Object.keys(POOL);
  const clone = (o) => JSON.parse(JSON.stringify(o));

  function pickReward(state, salt) {
    const left = GQ.data.cosmetics.filter(c => !state.owned.includes(c.id));
    if (!left.length) return null;
    const r = GQ.rand.rng(state.league.seed + '|reward|' + salt + '|' + state.owned.length);
    return left[Math.floor(r() * left.length)].id;
  }
  function addXp(state, amount, now) {
    const s = clone(state), k = GQ.time.dayKey(now);
    s.xp.total += amount;
    s.xp.byDay[k] = (s.xp.byDay[k] || 0) + amount;
    return s;
  }
  function ensureDaily(state, now) {
    const k = GQ.time.dayKey(now);
    if (state.quests.dayKey === k && state.quests.list.length) return state;
    const s = clone(state);
    const r = GQ.rand.rng(s.league.seed + '|q|' + k);
    const types = GQ.rand.shuffle(Object.keys(POOL), r).slice(0, 3);
    s.quests = {
      dayKey: k,
      list: types.map(t => {
        const target = POOL[t].targets[Math.floor(r() * POOL[t].targets.length)];
        return { id: k + '-' + t, type: t, title: POOL[t].title(target), target, progress: 0, done: false };
      }),
    };
    return s;
  }
  function track(state, event, now) {
    let s = ensureDaily(state, now);
    s = clone(s);
    const completed = [];
    for (const q of s.quests.list) {
      if (q.done || q.type !== event.type) continue;
      q.progress = Math.min(q.target, q.progress + (event.n == null ? 1 : event.n));
      if (q.progress >= q.target) {
        q.done = true;
        q.reward = 'chest'; // 보상은 보물상자
        completed.push(q);
      }
    }
    if (completed.length) s = GQ.chest.grant(s, 'quest', completed.length, now);
    for (let i = 0; i < completed.length; i++) s = addXp(s, XP.quest, now);
    return { state: s, completed };
  }
  const MILESTONES = [3, 7, 14, 30, 50, 100, 200, 365];
  function touchStreak(state, now) {
    let s = clone(state); const today = GQ.time.dayKey(now);
    if (s.streak.lastDay === today) return { state: s, milestone: null, reward: null };
    s.streak.count = s.streak.lastDay && GQ.time.dayDiff(s.streak.lastDay, today) === 1 ? s.streak.count + 1 : 1;
    s.streak.lastDay = today;
    s.streak.best = Math.max(s.streak.best || 0, s.streak.count);
    let milestone = null, reward = null;
    if (MILESTONES.includes(s.streak.count)) {
      milestone = s.streak.count;
      s = GQ.chest.grant(s, 'streak', 1, now); reward = 'chest';
    }
    return { state: s, milestone, reward };
  }
  function currentStreak(state, now) {
    if (!state.streak.lastDay) return 0;
    return GQ.time.dayDiff(state.streak.lastDay, GQ.time.dayKey(now)) <= 1 ? state.streak.count : 0;
  }
  GQ.quests = { POOL_TYPES, XP, pickReward, addXp, ensureDaily, track, touchStreak, currentStreak };
})();
