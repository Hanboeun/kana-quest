// 한국 시간(UTC+9, 서머타임 없음) 기준 날짜·주 계산
(function () {
  const H9 = 9 * 3600 * 1000, DAY = 86400 * 1000;
  const iso = (ms) => new Date(ms).toISOString().slice(0, 10);
  function dayKey(ms) { return iso(ms + H9); }
  function weekStartShifted(ms) {
    const s = ms + H9;
    const dayStart = Math.floor(s / DAY) * DAY;
    const dow = new Date(dayStart).getUTCDay(); // 0=일
    return dayStart - ((dow + 6) % 7) * DAY;
  }
  function weekKey(ms) { return iso(weekStartShifted(ms)); }
  function weekStart(ms) { return weekStartShifted(ms) - H9; }
  function weekEnd(ms) { return weekStartShifted(ms) + 7 * DAY - H9; }
  function keyToMs(key) { return Date.parse(key + 'T00:00:00Z') - H9; } // 그 날 0시 KST
  function dayDiff(a, b) { return Math.round((Date.parse(b) - Date.parse(a)) / DAY); }
  function addDays(key, n) { return iso(Date.parse(key) + n * DAY); }
  GQ.time = { DAY, dayKey, weekKey, weekStart, weekEnd, keyToMs, dayDiff, addDays };
})();
