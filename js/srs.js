// 간격 반복 (SM-2를 단순화)
(function () {
  const DAY = 86400000, TEN_MIN = 600000;
  function newCard() { return { ease: 2.5, interval: 0, due: 0, reps: 0, lapses: 0, seen: false }; }
  function grade(card, result, now) {
    const c = Object.assign({}, card, { seen: true });
    if (result === 'wrong') {
      c.ease = Math.max(1.3, Math.round((c.ease - 0.2) * 100) / 100);
      c.interval = 0; c.reps = 0; c.lapses += 1; c.due = now + TEN_MIN;
      return c;
    }
    if (result === 'slow') {
      c.interval = Math.max(1, c.interval * 1.2);
    } else {
      c.interval = c.reps === 0 ? 1 : c.reps === 1 ? 3 : c.interval * c.ease;
    }
    c.reps += 1;
    c.due = now + Math.round(c.interval * DAY);
    return c;
  }
  function dueItems(cards, now, limit) {
    return Object.keys(cards)
      .filter(k => cards[k].seen && cards[k].due <= now)
      .sort((a, b) => cards[a].due - cards[b].due)
      .slice(0, limit);
  }
  GQ.srs = { newCard, grade, dueItems };
})();
