// 콤보: 연속 정답 수, 보너스 XP, 이펙트 단계
(function () {
  // 재출제(이미 틀렸던 문제 다시 풀기)는 콤보에 영향 없음
  function next(combo, correct, isRetry) { if (isRetry) return combo; return correct ? combo + 1 : 0; }
  function bonus(c) { return c >= 20 ? 10 : c >= 10 ? 6 : c >= 5 ? 4 : c >= 3 ? 2 : 0; }
  function tier(c) { return c >= 20 ? 4 : c >= 10 ? 3 : c >= 5 ? 2 : c >= 3 ? 1 : 0; }
  GQ.combo = { next, bonus, tier };
})();
