// 문제 세트 만들기와 채점, 끝났을 때 상태 반영
(function () {
  const D = () => GQ.data;
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const pick = (arr, r) => arr[Math.floor(r() * arr.length)];

  function groupById(id) { return D().groups.find(g => g.id === id); }
  function availableGroupIds(state, extra) {
    const s = new Set(state.unlocked); if (extra) s.add(extra); return s;
  }
  function availableWords(state, gid) {
    const av = availableGroupIds(state, gid);
    return D().words.filter(w => w.requires.length && w.requires.every(g => av.has(g)));
  }

  // 오답 보기: 헷갈리는 짝 우선, 같은 발음은 제외
  function kanaChoices(item, field, state, r) {
    const av = availableGroupIds(state, item.group);
    let pool = D().kana.filter(k => k.quiz && k.script === item.script && k.romaji !== item.romaji);
    const near = pool.filter(k => av.has(k.group));
    if (near.length >= 6) pool = near;
    const partners = D().confusables.filter(p => p.includes(item.id)).map(p => p[0] === item.id ? p[1] : p[0])
      .map(id => D().byId.get(id)).filter(k => k && k.romaji !== item.romaji);
    const chosen = [];
    const seen = new Set([item[field]]);
    const add = (k) => { if (k && !seen.has(k[field])) { seen.add(k[field]); chosen.push(k[field]); } };
    if (partners.length) add(pick(partners, r));
    for (const k of GQ.rand.shuffle(pool, r)) { if (chosen.length >= 3) break; add(k); }
    return GQ.rand.shuffle([item[field]].concat(chosen), r);
  }
  function wordChoices(word, words, r) {
    const seen = new Set([word.romaji]), out = [word.romaji];
    let pool = words.filter(w => w.script === word.script);
    if (pool.length < 6) pool = D().words.filter(w => w.script === word.script);
    for (const w of GQ.rand.shuffle(pool, r)) { if (out.length >= 4) break; if (!seen.has(w.romaji)) { seen.add(w.romaji); out.push(w.romaji); } }
    return GQ.rand.shuffle(out, r);
  }

  function makeQ(kind, item, state, r) {
    if (kind === 'intro') return { kind, itemId: item.id, prompt: item.char, answer: item.char };
    if (kind === 'read') return { kind, itemId: item.id, prompt: item.char, choices: kanaChoices(item, 'romaji', state, r), answer: item.romaji };
    if (kind === 'listen') return { kind, itemId: item.id, prompt: item.char, choices: kanaChoices(item, 'char', state, r), answer: item.char };
    if (kind === 'speak') return { kind, itemId: item.id, prompt: item.char, answer: item.char, accept: [item.char, item.romaji] };
    if (kind === 'write') return { kind, itemId: item.id, prompt: item.romaji, answer: item.char, trace: !(state.cards[item.id] && state.cards[item.id].reps >= 2) };
    throw new Error('kind ' + kind);
  }
  function makeWordQ(word, words, r) {
    return { kind: 'word', itemId: word.id, prompt: word.text, meaning: word.meaning, choices: wordChoices(word, words, r), answer: word.romaji };
  }
  const canWrite = (k) => k.write && GQ.strokes && GQ.strokes[k.char];
  function weightedKind(weights, r) {
    const ks = Object.keys(weights).filter(k => weights[k] > 0);
    let t = ks.reduce((s, k) => s + weights[k], 0), x = r() * t;
    for (const k of ks) { x -= weights[k]; if (x <= 0) return k; }
    return ks[ks.length - 1];
  }

  function buildLesson(state, gid, caps, r) {
    const g = groupById(gid); const items = g.items.map(id => D().byId.get(id));
    const out = [];
    for (const it of items) if (!state.seenIntro.includes(it.id) && (it.quiz || canWrite(it))) out.push(makeQ('intro', it, state, r));
    const quiz = items.filter(k => k.quiz);
    const words = availableWords(state, gid);
    const groupWords = words.filter(w => w.requires.includes(gid));
    const graded = [];
    if (!quiz.length) { // 작은 っ 같은 특수 그룹: 단어 위주
      const ws = GQ.rand.shuffle(groupWords.length ? groupWords : words, r);
      for (let i = 0; i < 10 && ws.length; i++) graded.push(makeWordQ(ws[i % ws.length], words, r));
      for (const it of items) if (canWrite(it)) graded.push(makeQ('write', it, state, r));
      return out.concat(GQ.rand.shuffle(graded, r));
    }
    const N = Math.max(10, Math.min(18, quiz.length * 3));
    for (const it of quiz) graded.push(makeQ('read', it, state, r));
    let guard = 0;
    while (graded.length < N && guard++ < 200) {
      const it = pick(quiz, r);
      const w = { read: 0.4, listen: caps.tts ? 0.2 : 0, write: canWrite(it) ? 0.2 : 0, speak: caps.asr ? 0.1 : 0, word: groupWords.length ? 0.1 : 0 };
      const kind = weightedKind(w, r);
      graded.push(kind === 'word' ? makeWordQ(pick(groupWords, r), words, r) : makeQ(kind, it, state, r));
    }
    return out.concat(GQ.rand.shuffle(graded, r));
  }

  function buildReview(state, now, caps, r) {
    const due = GQ.srs.dueItems(state.cards, now, 20);
    let ids = due.slice();
    if (ids.length < 8) {
      const weak = Object.keys(state.cards).filter(k => state.cards[k].seen && !ids.includes(k))
        .sort((a, b) => state.cards[a].ease - state.cards[b].ease || state.cards[b].lapses - state.cards[a].lapses);
      ids = ids.concat(weak.slice(0, 8 - ids.length));
    }
    const words = availableWords(state);
    const out = [];
    for (const id of ids) {
      if (id[0] === 'w') { const w = D().words.find(x => x.id === id); if (w) out.push(makeWordQ(w, words, r)); continue; }
      const it = D().byId.get(id); if (!it || !it.quiz) continue;
      const kind = weightedKind({ read: 0.5, listen: caps.tts ? 0.2 : 0, write: canWrite(it) ? 0.15 : 0, speak: caps.asr ? 0.15 : 0 }, r);
      out.push(makeQ(kind, it, state, r));
    }
    return out;
  }

  function buildBoss(state, gid, caps, r) {
    const g = groupById(gid); const quiz = g.items.map(id => D().byId.get(id)).filter(k => k.quiz);
    let out = [];
    if (!quiz.length) {
      const words = availableWords(state, gid), gw = words.filter(w => w.requires.includes(gid));
      const ws = GQ.rand.shuffle(gw.length ? gw : words, r);
      for (let i = 0; i < 8 && ws.length; i++) out.push(Object.assign(makeWordQ(ws[i % ws.length], words, r), { timeLimit: 8000 }));
      return out;
    }
    for (const it of quiz) {
      out.push(makeQ('read', it, state, r));
      out.push(makeQ(caps.tts ? 'listen' : 'read', it, state, r));
    }
    return GQ.rand.shuffle(out, r).map(q => Object.assign(q, { timeLimit: 5000 }));
  }
  function buildFinal(state, r) {
    const pool = GQ.rand.shuffle(D().kana.filter(k => k.quiz), r).slice(0, 40);
    return pool.map(it => Object.assign(makeQ('read', it, state, r), { timeLimit: 5000 }));
  }

  function build(state, opts, caps, r) {
    r = r || Math.random;
    if (opts.mode === 'lesson') return buildLesson(state, opts.groupId, caps, r);
    if (opts.mode === 'review') return buildReview(state, opts.now || Date.now(), caps, r);
    if (opts.mode === 'boss') return buildBoss(state, opts.groupId, caps, r);
    if (opts.mode === 'final') return buildFinal(state, r);
    throw new Error('mode');
  }

  function check(q, answer, ms) {
    const correct = answer === q.answer && !(q.timeLimit && ms > q.timeLimit);
    return { correct, result: !correct ? 'wrong' : ms > 3000 ? 'slow' : 'good', fast: correct && ms <= 1500 };
  }

  const BOSS_RATIO = 0.8, FINAL_RATIO = 0.9, FINAL_AVG_MS = 2000;
  function finish(state, mode, groupId, answers, now) {
    let s = clone(state);
    const graded = answers.filter(a => a.q.kind !== 'intro');
    const per = {};
    for (const a of graded) {
      const res = a.correct ? (a.result === 'slow' ? 'slow' : 'good') : 'wrong';
      const prev = per[a.q.itemId];
      per[a.q.itemId] = prev === 'wrong' || res === 'wrong' ? 'wrong' : prev === 'slow' || res === 'slow' ? 'slow' : 'good';
    }
    for (const id of Object.keys(per)) s.cards[id] = GQ.srs.grade(s.cards[id] || GQ.srs.newCard(), per[id], now);

    const total = graded.length, correct = graded.filter(a => a.correct).length;
    const fast = graded.filter(a => a.correct && a.ms <= 1500).length;
    const avgMs = total ? graded.reduce((t, a) => t + a.ms, 0) / total : 0;
    let xp = correct * GQ.quests.XP.correct + fast * GQ.quests.XP.fast;
    const summary = { mode, groupId, total, correct, avgMs, cleared: null, unlocked: null, rewards: [], completed: [], milestone: null };

    if ((mode === 'lesson' || mode === 'review') && total) xp += GQ.quests.XP.lesson;
    if (mode === 'lesson') {
      s.groupLessons[groupId] = (s.groupLessons[groupId] || 0) + 1;
      const g = groupById(groupId);
      for (const id of g.items) if (!s.seenIntro.includes(id)) s.seenIntro.push(id);
    }
    if (mode === 'boss') {
      summary.cleared = total > 0 && correct / total >= BOSS_RATIO;
      if (summary.cleared) {
        xp += GQ.quests.XP.boss;
        if (!s.bossCleared.includes(groupId)) s.bossCleared.push(groupId);
        const g = groupById(groupId), next = D().groups.find(x => x.order === g.order + 1);
        if (next && !s.unlocked.includes(next.id)) { s.unlocked.push(next.id); summary.unlocked = next.id; }
      }
    }
    if (mode === 'final') {
      summary.cleared = total > 0 && correct / total >= FINAL_RATIO && avgMs <= FINAL_AVG_MS;
      const rec = { ratio: total ? correct / total : 0, avgMs };
      if (!s.finalBoss.best || rec.ratio > s.finalBoss.best.ratio || (rec.ratio === s.finalBoss.best.ratio && avgMs < s.finalBoss.best.avgMs)) s.finalBoss.best = rec;
      if (summary.cleared) {
        xp += GQ.quests.XP.boss;
        if (!s.finalBoss.cleared) {
          s.finalBoss.cleared = true;
          for (let i = 0; i < 2; i++) { const id = GQ.quests.pickReward(s, 'final' + i); if (id) { s.owned.push(id); summary.rewards.push(id); } }
        }
      }
    }
    s = GQ.quests.addXp(s, xp, now);
    summary.xp = xp;
    const events = [{ type: 'xp', n: xp }];
    if (mode === 'review') events.push({ type: 'review', n: total });
    const nSpeak = graded.filter(a => a.q.kind === 'speak').length, nWrite = graded.filter(a => a.q.kind === 'write').length;
    if (nSpeak) events.push({ type: 'speak', n: nSpeak });
    if (nWrite) events.push({ type: 'write', n: nWrite });
    if (mode === 'lesson') events.push({ type: 'lesson', n: 1 });
    if (mode === 'lesson' && total && correct === total) events.push({ type: 'perfect', n: 1 });
    for (const e of events) { const r = GQ.quests.track(s, e, now); s = r.state; summary.completed.push(...r.completed); }
    const st = GQ.quests.touchStreak(s, now); s = st.state;
    summary.milestone = st.milestone; if (st.reward) summary.rewards.push(st.reward);
    s.stats.answered += total; s.stats.correct += correct; s.stats.speak += nSpeak; s.stats.write += nWrite;
    return { state: s, summary };
  }

  function bossReady(state, gid) { return (state.groupLessons[gid] || 0) >= 1; }
  function finalReady(state) { return D().groups.every(g => state.bossCleared.includes(g.id)); }
  GQ.lesson = { build, check, finish, bossReady, finalReady, availableWords, BOSS_RATIO, FINAL_RATIO, FINAL_AVG_MS };
})();
