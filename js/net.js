// 친구 리그 저장소 (Firebase: 익명 로그인 + Firestore). 리그 화면이나 레슨이 끝날 때만 불러옴.
// 저장 구조: rooms/{코드} = {owner, createdAt}, rooms/{코드}/members/{uid} = {name, look, tier, weekKey, weekXp, updatedAt}
(function () {
  const V = '10.12.2';
  const ROOM_MAX = 30;
  let readyP = null;
  function load(src) {
    return new Promise((res, rej) => {
      if (document.querySelector('script[src="' + src + '"]')) return res();
      const s = document.createElement('script'); s.src = src; s.onload = () => res(); s.onerror = () => rej(new Error('load ' + src));
      document.head.appendChild(s);
    });
  }
  function ready() {
    if (readyP) return readyP;
    readyP = (async () => {
      if (!GQ.firebaseConfig) throw new Error('설정이 없어요');
      const base = 'https://www.gstatic.com/firebasejs/' + V + '/';
      await load(base + 'firebase-app-compat.js');
      await Promise.all([load(base + 'firebase-auth-compat.js'), load(base + 'firebase-firestore-compat.js')]);
      if (!firebase.apps.length) firebase.initializeApp(GQ.firebaseConfig);
      const auth = firebase.auth();
      const user = await new Promise((res, rej) => {
        const off = auth.onAuthStateChanged(u => { if (u) { off(); res(u); } });
        if (!auth.currentUser) auth.signInAnonymously().catch(e => { off(); rej(e); });
      });
      return { db: firebase.firestore(), uid: user.uid };
    })().catch(e => { readyP = null; throw e; });
    return readyP;
  }
  const roomRef = (db, code) => db.collection('rooms').doc(code);
  async function createRoom() {
    const { db, uid } = await ready();
    for (let i = 0; i < 6; i++) {
      const code = GQ.league.makeCode();
      const ref = roomRef(db, code);
      if ((await ref.get()).exists) continue;
      await ref.set({ owner: uid, createdAt: Date.now() });
      return code;
    }
    throw new Error('방 코드를 만들지 못했어요. 다시 해주세요');
  }
  // 들어가기 전 확인: 있는 방인지, 자리가 있는지
  async function checkRoom(code) {
    const { db, uid } = await ready();
    if (!(await roomRef(db, code).get()).exists) return { ok: false, reason: '없는 코드예요. 코드를 다시 확인해 주세요' };
    const ms = await roomRef(db, code).collection('members').get();
    const already = ms.docs.some(d => d.id === uid);
    if (!already && ms.size >= ROOM_MAX) return { ok: false, reason: '방이 꽉 찼어요 (최대 ' + ROOM_MAX + '명)' };
    return { ok: true };
  }
  // 내 기록 올리기 (규칙이 허용하는 칸만)
  async function pushMe(code, me) {
    const { db, uid } = await ready();
    await roomRef(db, code).collection('members').doc(uid).set({
      name: String(me.name || '나').slice(0, 12), look: me.look || {}, tier: me.tier | 0,
      weekKey: me.weekKey, weekXp: Math.max(0, Math.min(30000, me.weekXp | 0)), updatedAt: Date.now(),
    });
    return uid;
  }
  async function fetchMembers(code) {
    const { db, uid } = await ready();
    const qs = await roomRef(db, code).collection('members').get();
    return { uid, members: qs.docs.map(d => Object.assign({ id: d.id }, d.data())) };
  }
  async function leave(code) {
    const { db, uid } = await ready();
    await roomRef(db, code).collection('members').doc(uid).delete();
  }
  GQ.net = { ready, createRoom, checkRoom, pushMe, fetchMembers, leave, ROOM_MAX };
})();
