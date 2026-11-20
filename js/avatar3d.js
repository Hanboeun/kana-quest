// 입체 캐릭터 (three.js). 도형을 조립해 만들고, 아이템(GQ.avatar.items의 def)대로 갈아입힘.
// 화면에 WebGL은 하나만: 렌더러 하나를 캐릭터 화면에 붙였다 뗐다 하고, 작은 캐릭터는 스냅샷 이미지로.
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

const A = window.GQ.avatar;
const LINE = '#3a2a30';
const def = (id) => (A.item(id) || {}).def || {};
const mat = (c, r = 0.75, extra) => new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: r, metalness: 0 }, extra || {}));
const sph = (r, m, seg = 40) => new THREE.Mesh(new THREE.SphereGeometry(r, seg, seg), m);
const cap = (r, l, m) => new THREE.Mesh(new THREE.CapsuleGeometry(r, l, 12, 24), m);
const cyl = (rt, rb, h, m, seg = 40) => new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m);
const box = (w, h, d, m) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
const ss = (a, b, t) => { const x = Math.min(1, Math.max(0, (t - a) / (b - a))); return x * x * (3 - 2 * x); };
const HS = { x: 1.1, y: 0.88, z: 0.96 };   // 얼굴: 앞뒤 도톰, 위아래 납작
const HEAD_Y = 1.15;
const HEAD_SCALE = 0.93, HEAD_PIVOT = 0.28; // 얼굴 크기, 줄일 때 기준점(턱 밑)

// ---------- 얼굴 그림 (구의 앞쪽 = 가로 1/4 지점) ----------
const faceCache = new Map();
function faceTexture(skin, eyes, eyeColor) {
  const key = skin + eyes + eyeColor;
  if (faceCache.has(key)) return faceCache.get(key);
  const c = document.createElement('canvas'); c.width = 1024; c.height = 512; const x = c.getContext('2d');
  x.fillStyle = skin; x.fillRect(0, 0, 1024, 512);
  const cx = 256, cy = 270, ex = 66;
  x.fillStyle = 'rgba(255,140,160,.45)';
  for (const s of [-1, 1]) { x.beginPath(); x.ellipse(cx + s * 96, cy + 46, 34, 18, 0, 0, 7); x.fill(); }
  x.lineCap = 'round'; x.lineJoin = 'round';
  for (const s of [-1, 1]) {
    const X = cx + s * ex, Y = cy;
    if (eyes === 'smile') { // 웃는 눈 ^^
      x.strokeStyle = LINE; x.lineWidth = 8; x.beginPath(); x.moveTo(X - 24, Y + 8); x.quadraticCurveTo(X, Y - 26, X + 24, Y + 8); x.stroke();
    } else {
      const big = eyes === 'sparkle' ? 1.15 : 1;
      x.fillStyle = '#ffffff'; x.beginPath(); x.ellipse(X, Y, 33 * big, 41 * big, 0, 0, 7); x.fill();
      x.lineWidth = 4.5; x.strokeStyle = LINE; x.stroke();
      if (eyes === 'star') { // 별 모양 눈동자
        x.fillStyle = eyeColor; x.beginPath();
        for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 11 : 26; x.lineTo(X + Math.cos(a) * r, Y + 5 + Math.sin(a) * r); }
        x.closePath(); x.fill();
      } else {
        x.fillStyle = eyeColor; x.beginPath(); x.ellipse(X - s * 3, Y + 5, 23 * big, 31 * big, 0, 0, 7); x.fill();
        x.fillStyle = '#1f1622'; x.beginPath(); x.ellipse(X - s * 3, Y + 8, 12 * big, 17 * big, 0, 0, 7); x.fill();
      }
      x.fillStyle = '#ffffff'; x.beginPath(); x.arc(X - s * 3 + 8, Y - 8, 8 * big, 0, 7); x.fill();
      x.beginPath(); x.arc(X - s * 3 - 7, Y + 18, 3.5 * big, 0, 7); x.fill();
      if (eyes === 'sparkle') { x.beginPath(); x.arc(X - s * 3 + 12, Y + 12, 4, 0, 7); x.fill(); }
      if (eyes === 'sleepy') { // 졸린 눈: 위쪽을 눈꺼풀로 덮음
        x.fillStyle = skin; x.fillRect(X - 40, Y - 50, 80, 46);
        x.strokeStyle = LINE; x.lineWidth = 6; x.beginPath(); x.moveTo(X - 32, Y - 4); x.quadraticCurveTo(X, Y + 4, X + 32, Y - 4); x.stroke();
      }
    }
    x.strokeStyle = 'rgba(80,50,40,.85)'; x.lineWidth = 7;
    x.beginPath(); x.moveTo(X - 12, Y - 58); x.quadraticCurveTo(X, Y - 64, X + 12, Y - 58); x.stroke();
  }
  x.fillStyle = 'rgba(200,110,100,.55)'; x.beginPath(); x.ellipse(cx, cy + 34, 7, 5, 0, 0, 7); x.fill();
  x.strokeStyle = '#7a3442'; x.lineWidth = 5;
  x.beginPath(); x.moveTo(cx - 16, cy + 58); x.quadraticCurveTo(cx, cy + 72, cx + 16, cy + 58); x.stroke();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  faceCache.set(key, t); return t;
}

// ---------- 얼굴 모양: 아래 볼~턱이 앞·옆으로 통통하게 나온 구 ----------
let headGeo = null;
function headGeometry() {
  if (headGeo) return headGeo;
  const geo = new THREE.SphereGeometry(1, 96, 72);
  const p = geo.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    // 아래 절반을 '둥근 ㄴ자'로: 옆에서 보면 얼굴 앞은 곧게 내려오고 턱 밑은 평평, 모서리만 둥글게.
    // 원(n=2) 대신 둥근 네모(n=3.2) 단면으로 바꿔 아래쪽 모서리를 채움
    if (v.y < 0) {
      const rh = Math.hypot(v.x, v.z), ay = -v.y, n = 3.8;
      const t = 1 / Math.pow(Math.pow(rh, n) + Math.pow(ay, n), 1 / n);
      const w = ss(0, -0.25, v.y) * ss(-0.3, 0.45, v.z);   // 아래쪽 + 앞·옆만 (뒤통수는 그대로)
      const k = 1 + (t - 1) * w;
      p.setXYZ(i, v.x * k, v.y * k, v.z * k);
    }
  }
  geo.computeVertexNormals();
  return (headGeo = geo);
}

// ---------- 머리카락 조각 (두께 있는 덩어리에서 얼굴 자리를 파냄) ----------
const hairGeoCache = new Map();
function hairGeometry(cut) {
  if (hairGeoCache.has(cut)) return hairGeoCache.get(cut);
  const geo = new THREE.SphereGeometry(1, 160, 120);
  const p = geo.attributes.position, v = new THREE.Vector3();
  const tied = cut === 'tied';
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i).normalize();
    const ang = Math.atan2(v.x, v.z), a = Math.abs(ang);
    const fringe = 0.3 + 0.012 * Math.cos(v.x * 14);
    const front = 1 - ss(1.0, 1.3, a);
    const sideW = 1 - front;
    let face = front * (1 - ss(fringe - 0.12, fringe + 0.03, v.y));
    if (tied) { // 묶은 머리: 앞머리 끝 → 귀까지 대각선 → 귀 뒤로
      const side = ss(0.75, 1.5, a), down = ss(1.5, 2.15, a);
      const lineY = fringe + (-0.08 - fringe) * side + (-0.7 + 0.08) * down;
      face = (1 - ss(lineY - 0.1, lineY + 0.03, v.y)) * (1 - ss(2.0, 2.3, a));
    }
    let r = 1.08 + 0.05 * ss(0.2, 0.95, v.y);
    r += 0.008 * Math.sin(ang * 16) * ss(0.55, 0.95, v.y);
    r += 0.035 * front * ss(fringe + 0.16, fringe, v.y) * (1 - face);
    if (tied) r -= 0.04 * sideW * ss(0.4, -0.3, v.y);
    const below = Math.max(0, 0.15 - v.y);
    let py = (v.y - below * (tied || cut === 'short' ? 0 : 0.6) * sideW) * r;
    let px = v.x * r, pz = v.z * r;
    const h = Math.hypot(px, pz);
    if (h > 0.001 && !tied && cut !== 'short') { const w = ss(0.15, -0.6, v.y), want = Math.max(h, 1.0 * w + h * (1 - w)); const k = 1 + (want / h - 1) * sideW; px *= k; pz *= k; }
    const hem = cut === 'short' ? -0.2 : tied ? -0.62 : -1.0;
    if (py < hem) { const t = Math.min(1, (hem - py) / 0.25); py = hem - 0.03 * t; px *= 1 - 0.12 * t; pz *= 1 - 0.12 * t; }
    if (face > 0) { px += (v.x * 0.86 - px) * face; py += (v.y * 0.86 - py) * face; pz += (v.z * 0.86 - pz) * face; }
    p.setXYZ(i, px, py, pz);
  }
  geo.computeVertexNormals();
  hairGeoCache.set(cut, geo); return geo;
}

function stripeTexture(base, stripe) {
  const c = document.createElement('canvas'); c.width = 8; c.height = 64; const x = c.getContext('2d');
  x.fillStyle = base; x.fillRect(0, 0, 8, 64); x.fillStyle = stripe;
  for (let y = 0; y < 64; y += 16) x.fillRect(0, y, 8, 7);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1, 3); return t;
}
function dotTexture(base) {
  const c = document.createElement('canvas'); c.width = 64; c.height = 64; const x = c.getContext('2d');
  x.fillStyle = base; x.fillRect(0, 0, 64, 64); x.fillStyle = 'rgba(255,255,255,.9)';
  for (const [a, b] of [[12, 14], [44, 22], [26, 46], [56, 54]]) { x.beginPath(); x.arc(a, b, 5, 0, 7); x.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(4, 3); return t;
}

// ---------- 캐릭터 조립 ----------
function buildCharacter(look) {
  const g = new THREE.Group();
  const skinC = def(look.skin).color || '#ffd9c2';
  const skin = mat(skinC, 0.9);
  const hairC = def(look.hairColor).color || '#6a4330';
  const hair = mat(hairC, 0.6, { side: THREE.DoubleSide });
  // 머리
  const head = new THREE.Mesh(headGeometry(), new THREE.MeshStandardMaterial({ map: faceTexture(skinC, def(look.eyes).kind || 'basic', def(look.eyeColor).color || '#6b4a32'), roughness: 0.9 }));
  const hg = new THREE.Group(); // 머리·머리카락·모자·머리 장식
  head.scale.set(HS.x, HS.y, HS.z); head.position.y = HEAD_Y; hg.add(head);
  const hd = def(look.hair);
  const hm = new THREE.Mesh(hairGeometry(hd.cut || 'bob'), hair); hm.position.y = HEAD_Y; hm.scale.set(HS.x, HS.y, HS.z); hg.add(hm);
  addHairExtra(hg, hd.extra, hair);
  // 몸
  const td = def(look.top), bd = def(look.bottom);
  const topMat = td.stripe ? new THREE.MeshStandardMaterial({ map: stripeTexture(td.color, td.stripe), roughness: 0.9 })
    : td.dots ? new THREE.MeshStandardMaterial({ map: dotTexture(td.color), roughness: 0.9 }) : mat(td.color || '#ffffff', 0.9);
  const neck = cap(0.12, 0.08, skin); neck.position.y = 0.12; g.add(neck);
  const body = cap(0.36, 0.38, topMat); body.position.y = -0.3; body.scale.set(1.05, 1, 0.78); g.add(body);
  for (const s of [-1, 1]) {
    const a = 0.26, sx = s * 0.3, dx = s * Math.sin(a), dy = -Math.cos(a);
    const sh = sph(0.135, topMat); sh.position.set(sx, 0, 0); sh.scale.set(1, 0.9, 0.85); g.add(sh);
    const arm = cap(0.11, 0.36, topMat); arm.position.set(sx + dx * 0.26, dy * 0.26, 0.01); arm.rotation.z = s * a; g.add(arm);
    const hand = sph(0.1, skin); hand.position.set(sx + dx * 0.56, dy * 0.56, 0.03); g.add(hand);
  }
  addTopDetail(g, td);
  const robe = td.kind === 'robe';
  if (!robe) addBottom(g, bd); else { const r = cyl(0.38, 0.52, 0.85, topMat, 48); r.position.y = -0.86; r.scale.z = 0.85; g.add(r); }
  // 다리·신발
  const longCover = robe || bd.kind === 'long' || bd.kind === 'pants';
  for (const s of [-1, 1]) {
    const leg = cap(0.1, 0.32, bd.kind === 'pants' ? mat(bd.color, 0.85) : skin); leg.position.set(s * 0.16, -1.02, 0); if (!longCover || bd.kind === 'pants') g.add(leg);
    addShoe(g, def(look.shoes), s);
  }
  if (look.hat) addHat(hg, def(look.hat));
  if (look.acc) addAcc(def(look.acc).kind === 'norigae' ? g : hg, def(look.acc));
  // 머리 묶음을 목(턱 밑) 기준으로 살짝 작게
  hg.scale.setScalar(HEAD_SCALE); hg.position.y = HEAD_PIVOT * (1 - HEAD_SCALE); g.add(hg);
  // 바닥 그림자
  const sh = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 1.9), new THREE.MeshBasicMaterial({ map: shadowTex(), transparent: true, depthWrite: false }));
  sh.rotation.x = -Math.PI / 2; sh.position.y = -1.39; g.add(sh);
  return g;
}
function addHairExtra(g, extra, hair) {
  if (extra === 'braid') for (const side of [-1, 1]) {
    const start = new THREE.Vector3(side * 0.98, 0.72, -0.12);
    for (let i = 0; i < 7; i++) { const t = i / 6, b = sph(0.14 - i * 0.008, hair); b.position.set(start.x + side * 0.06 * t, start.y - i * 0.17, start.z + 0.18 * t); b.scale.set(0.95, 0.8, 0.95); b.rotation.z = (i % 2 ? 0.5 : -0.5) * side; g.add(b); }
    const tie = sph(0.065, mat('#e8556d', 0.5)); tie.position.set(start.x + side * 0.06, start.y - 1.12, start.z + 0.19); g.add(tie);
  }
  if (extra === 'twin') for (const side of [-1, 1]) {
    const t = cap(0.2, 0.5, hair); t.position.set(side * 1.15, 1.25, -0.25); t.rotation.z = side * 0.55; t.rotation.x = 0.15; g.add(t);
    const tie = sph(0.08, mat('#e8556d', 0.5)); tie.position.set(side * 0.98, 1.55, -0.2); g.add(tie);
  }
  if (extra === 'pony') {
    const t = cap(0.2, 0.62, hair); t.position.set(0, 1.0, -1.05); t.rotation.x = -0.35; g.add(t);
    const tie = sph(0.09, mat('#e8556d', 0.5)); tie.position.set(0, 1.42, -0.92); g.add(tie);
  }
  if (extra === 'bun') {
    const b = sph(0.36, hair); b.position.set(0, 2.08, -0.35); g.add(b);
    const tie = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.05, 12, 32), mat('#e8556d', 0.5)); tie.position.set(0, 1.85, -0.3); tie.rotation.x = Math.PI / 2 - 0.35; g.add(tie);
  }
}
function addTopDetail(g, d) {
  if (d.kind === 'jeogori') {
    const collar = box(0.1, 0.32, 0.04, mat('#ffffff', 0.8)); collar.position.set(0.06, -0.08, 0.28); collar.rotation.z = -0.5; g.add(collar);
    for (const s of [-1, 1]) { const t = cap(0.035, 0.28, mat(d.tie, 0.6)); t.position.set(s * 0.05, -0.32, 0.29); t.rotation.z = s * 0.25; g.add(t); }
    const knot = sph(0.06, mat(d.tie, 0.6)); knot.position.set(0, -0.15, 0.3); g.add(knot);
  }
  if (d.kind === 'robe' && d.obi) { const ob = cap(0.37, 0.04, mat(d.obi, 0.7)); ob.rotation.z = Math.PI / 2; ob.scale.set(0.45, 1.06, 0.82); ob.position.y = -0.4; g.add(ob); }
  if (d.kind === 'hoodie') {
    const hood = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.11, 16, 32), mat(d.color, 0.9)); hood.position.set(0, 0.12, -0.12); hood.rotation.x = Math.PI / 2 + 0.4; g.add(hood);
    const pocket = box(0.36, 0.14, 0.04, mat(d.color, 0.95)); pocket.position.set(0, -0.52, 0.27); g.add(pocket);
  }
  if (d.kind === 'sailor') {
    const back = box(0.62, 0.28, 0.04, mat(d.collar, 0.8)); back.position.set(0, -0.02, -0.29); g.add(back);
    for (const s of [-1, 1]) { const f = box(0.1, 0.34, 0.03, mat(d.collar, 0.8)); f.position.set(s * 0.1, -0.1, 0.28); f.rotation.z = s * 0.45; g.add(f); }
    const scarf = sph(0.07, mat('#e8556d', 0.6)); scarf.position.set(0, -0.25, 0.3); g.add(scarf);
  }
}
function addBottom(g, d) {
  const m = mat(d.color || '#6f95cf', 0.85);
  if (d.kind === 'skirt') { const s = cyl(0.38, 0.52, 0.34, m, 48); s.position.y = -0.72; s.scale.z = 0.85; g.add(s); return; }
  if (d.kind === 'long') { const s = cyl(0.38, 0.6, 0.78, m, 48); s.position.y = -0.9; s.scale.z = 0.86; g.add(s); return; }
  // 반바지: 허리부터 엉덩이까지 한 덩어리 + 허벅지 중간까지 오는 다리통 (가운데 빈틈 없게)
  const hip = cyl(0.37, 0.39, 0.3, m); hip.position.y = -0.7; hip.scale.z = 0.8; g.add(hip);
  const seat = sph(0.38, m); seat.scale.set(1.0, 0.45, 0.8); seat.position.y = -0.84; g.add(seat);
  for (const s of [-1, 1]) { const l = cyl(0.18, 0.17, 0.26, m, 24); l.position.set(s * 0.16, -0.95, 0); l.scale.z = 0.95; g.add(l); }
  if (d.kind === 'overall') {
    const bib = box(0.36, 0.3, 0.05, m); bib.position.set(0, -0.36, 0.27); g.add(bib);
    for (const s of [-1, 1]) { const st = box(0.06, 0.4, 0.04, m); st.position.set(s * 0.15, -0.08, 0.27); g.add(st); const bt = sph(0.03, mat('#ffd45c', 0.4)); bt.position.set(s * 0.15, -0.24, 0.3); g.add(bt); }
  }
}
function addShoe(g, d, s) {
  const m = mat(d.color || '#ffffff', 0.55);
  if (d.kind === 'geta') {
    const base = box(0.22, 0.07, 0.36, m); base.position.set(s * 0.17, -1.37, 0.05); g.add(base);
    const strap = box(0.16, 0.03, 0.04, mat('#d6336c', 0.5)); strap.position.set(s * 0.17, -1.31, 0.1); g.add(strap); return;
  }
  if (d.kind === 'boots') { const b = cyl(0.13, 0.14, 0.32, m, 24); b.position.set(s * 0.16, -1.18, 0); g.add(b); }
  const shoe = sph(0.15, m); shoe.scale.set(1, d.kind === 'flat' ? 0.45 : 0.65, 1.35); shoe.position.set(s * 0.17, d.kind === 'flat' ? -1.33 : -1.3, 0.06); g.add(shoe);
}
function addHat(g, d) {
  if (d.kind === 'straw') {
    const tilt = -0.12;
    const brim = cyl(1.45, 1.45, 0.06, mat('#f1d07a', 0.9), 48); brim.position.y = 1.9; brim.rotation.x = tilt; g.add(brim);
    const crown = cyl(0.72, 0.8, 0.5, mat('#f4d784', 0.9)); crown.position.y = 2.12; crown.rotation.x = tilt; g.add(crown);
    const band = cyl(0.81, 0.81, 0.13, mat('#e8556d', 0.7)); band.position.y = 1.95; band.rotation.x = tilt; g.add(band);
  }
  if (d.kind === 'hachimaki') {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1, 0.07, 12, 64), mat('#ffffff', 0.8)); ring.position.y = 1.55; ring.rotation.x = Math.PI / 2; ring.scale.set(HS.x * 1.1, HS.z * 1.1, 1); g.add(ring);
    const sun = new THREE.Mesh(new THREE.CircleGeometry(0.11, 24), mat('#d6336c', 0.6)); sun.position.set(0, 1.56, HS.z * 1.1 + 0.075); g.add(sun);
  }
  if (d.kind === 'catband') {
    const band = new THREE.Mesh(new THREE.TorusGeometry(1.08, 0.04, 8, 48, Math.PI), mat('#444', 0.6)); band.position.y = HEAD_Y + 0.05; band.scale.set(HS.x, HS.y * 1.12, 1); g.add(band);
    for (const s of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.38, 4), mat('#444', 0.6)); ear.position.set(s * 0.62, 2.12, 0.05); ear.rotation.z = -s * 0.35; g.add(ear);
      const inner = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.22, 4), mat('#f4a6b8', 0.6)); inner.position.set(s * 0.6, 2.08, 0.15); inner.rotation.z = -s * 0.35; g.add(inner);
    }
  }
  if (d.kind === 'beret') {
    const b = sph(0.95, mat(d.color, 0.85)); b.scale.set(1.12, 0.32, 1.02); b.position.set(0.08, 2.05, -0.05); b.rotation.z = -0.22; g.add(b);
    const stem = cap(0.04, 0.06, mat(d.color, 0.85)); stem.position.set(0.02, 2.37, -0.05); g.add(stem);
  }
  if (d.kind === 'gat') {
    const black = mat('#1b1b1f', 0.5, { transparent: true, opacity: 0.88 });
    const brim = cyl(1.65, 1.65, 0.03, black, 48); brim.position.y = 1.98; g.add(brim);
    const crown = cyl(0.52, 0.6, 0.62, black); crown.position.y = 2.3; g.add(crown);
  }
  if (d.kind === 'beanie') {
    const cap1 = new THREE.Mesh(new THREE.SphereGeometry(1.14, 48, 32, 0, Math.PI * 2, 0, Math.PI * 0.42), mat(d.color, 0.95)); cap1.position.y = HEAD_Y; cap1.scale.set(HS.x, HS.y, HS.z); g.add(cap1);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.09, 12, 64), mat(d.color, 0.95)); rim.position.y = HEAD_Y + HS.y * 0.84; rim.rotation.x = Math.PI / 2; rim.scale.set(HS.x * 0.62, HS.z * 0.62, 1); g.add(rim);
    const pom = sph(0.2, mat('#ffffff', 1)); pom.position.y = HEAD_Y + HS.y * 1.28; g.add(pom);
  }
}
function addAcc(g, d) {
  if (d.kind === 'flower') {
    for (let i = 0; i < 5; i++) { const p = sph(0.11, mat('#ff8fb1', 0.6)); const a = i / 5 * Math.PI * 2; p.position.set(0.82 + Math.cos(a) * 0.12, 1.68 + Math.sin(a) * 0.12, 0.55); g.add(p); }
    const c = sph(0.07, mat('#ffd84a', 0.5)); c.position.set(0.82, 1.68, 0.62); g.add(c);
  }
  if (d.kind === 'foxmask') {
    const m = new THREE.Group(); m.position.set(0.98, 1.5, 0.3); m.rotation.set(0, 1.0, -0.25);
    const face = sph(0.3, mat('#ffffff', 0.7)); face.scale.set(1, 1.1, 0.45); m.add(face);
    for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.22, 4), mat('#ffffff', 0.7)); e.position.set(s * 0.17, 0.33, 0); m.add(e); const mk = sph(0.04, mat('#e8590c', 0.5)); mk.scale.set(1.8, 0.6, 0.6); mk.position.set(s * 0.11, 0.05, 0.13); m.add(mk); }
    g.add(m);
  }
  if (d.kind === 'glasses') {
    const fm = mat('#5a3b2c', 0.4);
    for (const s of [-1, 1]) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.025, 10, 32), fm); r.position.set(s * 0.37, 1.12, HS.z + 0.04); g.add(r); }
    const br = cyl(0.018, 0.018, 0.28, fm, 8); br.rotation.z = Math.PI / 2; br.position.set(0, 1.16, HS.z + 0.06); g.add(br);
  }
  if (d.kind === 'ribbon') {
    const m = mat(d.color, 0.6), r = new THREE.Group(); r.position.set(0.55, 2.0, 0.2); r.rotation.z = -0.3;
    for (const s of [-1, 1]) { const w = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.32, 16), m); w.rotation.z = s * Math.PI / 2; w.position.x = s * 0.17; r.add(w); }
    r.add(sph(0.08, m)); g.add(r);
  }
  if (d.kind === 'norigae') {
    const knot = sph(0.07, mat('#e03a5f', 0.5)); knot.position.set(0.24, -0.45, 0.29); g.add(knot);
    const tas = cyl(0.04, 0.07, 0.3, mat('#e03a5f', 0.8), 12); tas.position.set(0.24, -0.66, 0.3); g.add(tas);
    const bead = sph(0.05, mat('#3fbf9f', 0.3)); bead.position.set(0.24, -0.52, 0.32); g.add(bead);
  }
}
let shadowT = null;
function shadowTex() {
  if (shadowT) return shadowT;
  const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
  const gr = x.createRadialGradient(64, 64, 4, 64, 64, 62); gr.addColorStop(0, 'rgba(60,40,80,.35)'); gr.addColorStop(1, 'rgba(60,40,80,0)');
  x.fillStyle = gr; x.fillRect(0, 0, 128, 128); return (shadowT = new THREE.CanvasTexture(c));
}
const bgCache = new Map();
function bgTexture(id) {
  if (bgCache.has(id)) return bgCache.get(id);
  const d = def(id), c = document.createElement('canvas'); c.width = 256; c.height = 256; const x = c.getContext('2d');
  const gr = x.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, d.sky || '#bfe3ff'); gr.addColorStop(0.62, d.mid || '#dfe7ff'); gr.addColorStop(0.63, d.ground || '#a8dc8c'); gr.addColorStop(1, d.ground || '#8fcf74');
  x.fillStyle = gr; x.fillRect(0, 0, 256, 256);
  if (d.mountain) { x.fillStyle = '#7d8fb8'; x.beginPath(); x.moveTo(40, 160); x.lineTo(128, 70); x.lineTo(216, 160); x.fill(); x.fillStyle = '#fff'; x.beginPath(); x.moveTo(108, 90); x.lineTo(128, 70); x.lineTo(148, 90); x.lineTo(138, 96); x.lineTo(128, 88); x.lineTo(118, 96); x.fill(); }
  if (d.stars) { x.fillStyle = '#fff'; for (let i = 0; i < 30; i++) { x.globalAlpha = 0.4 + Math.random() * 0.6; x.fillRect(Math.random() * 256, Math.random() * 140, 2, 2); } x.globalAlpha = 1; x.fillStyle = '#ffe066'; x.beginPath(); x.arc(200, 40, 14, 0, 7); x.fill(); }
  if (d.petals) { x.fillStyle = '#f7a1c4'; for (let i = 0; i < 26; i++) { x.beginPath(); x.ellipse(Math.random() * 256, Math.random() * 240, 4, 2.5, Math.random() * 3, 0, 7); x.fill(); } }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; bgCache.set(id, t); return t;
}

// ---------- 무대 (렌더러 하나) ----------
let renderer = null, scene, camera, current = null, mountedEl = null, raf = 0, rotY = 0, drag = null, lastLookKey = '';
function ensure() {
  if (renderer) return;
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping || THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15;
  scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight('#fff8f0', '#f0d6c4', 1.7));
  const key = new THREE.DirectionalLight('#fff4e8', 2.2); key.position.set(2.5, 4, 5); scene.add(key);
  const rim = new THREE.DirectionalLight('#cfe0ff', 0.8); rim.position.set(-4, 2, -3); scene.add(rim);
  camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50); camera.position.set(0, 1.4, 10.4); camera.lookAt(0, 0.35, 0);
  const el = renderer.domElement; el.style.touchAction = 'pan-y'; el.style.display = 'block'; el.style.width = '100%'; el.style.height = '100%';
  el.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, r: rotY }; el.setPointerCapture(e.pointerId); });
  el.addEventListener('pointermove', (e) => { if (drag) rotY = drag.r + (e.clientX - drag.x) * 0.012; });
  el.addEventListener('pointerup', () => { drag = null; });
  el.addEventListener('pointercancel', () => { drag = null; });
}
// 각도를 바로 바꿔 한 번 그림 (확인용)
export function setAngle(r) { rotY = r; if (current) { current.rotation.y = r; if (mountedEl) renderer.render(scene, camera); } }
function disposeGroup(g) { g.traverse(o => { if (o.geometry && o.geometry !== headGeo && !hairGeoCacheHas(o.geometry)) o.geometry.dispose(); if (o.material && !o.material.map) o.material.dispose(); }); }
function hairGeoCacheHas(geo) { for (const v of hairGeoCache.values()) if (v === geo) return true; return false; }
function setLook(look) {
  const key = JSON.stringify(look);
  if (key === lastLookKey && current) return;
  if (current) { scene.remove(current); disposeGroup(current); }
  current = buildCharacter(look); current.rotation.y = rotY; scene.add(current);
  scene.background = bgTexture(look.bg || 'bg-sky');
  lastLookKey = key;
}
function frameLoop(t) {
  raf = requestAnimationFrame(frameLoop);
  if (!current || !mountedEl) return;
  const s = t / 1000;
  current.position.y = Math.abs(Math.sin(s * 2.2)) * 0.06;           // 통통
  current.scale.set(1 + Math.sin(s * 4.4) * 0.008, 1 - Math.sin(s * 4.4) * 0.008, 1);
  current.rotation.y += (rotY - current.rotation.y) * 0.25;
  renderer.render(scene, camera);
}
function fit() {
  if (!mountedEl) return;
  const r = mountedEl.getBoundingClientRect(), w = Math.max(1, r.width), h = Math.max(1, r.height);
  renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
}
export function mount(el, look) {
  ensure(); unmount(); rotY = 0; // 처음엔 정면
  mountedEl = el; el.appendChild(renderer.domElement); fit(); setLook(look);
  renderer.render(scene, camera); // 애니메이션이 돌기 전에도 바로 한 번 그림
  window.addEventListener('resize', fit);
  raf = requestAnimationFrame(frameLoop);
  return { update: (lk) => { setLook(lk); renderer.render(scene, camera); }, dispose: unmount };
}
export function unmount() {
  cancelAnimationFrame(raf); raf = 0; window.removeEventListener('resize', fit);
  if (renderer && renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
  mountedEl = null;
}
const snapCache = new Map();
// 작은 캐릭터 그림: 같은 렌더러로 정면 상반신을 그려 이미지 주소로
export function snapshot(look, size = 160) {
  ensure();
  const key = JSON.stringify(look) + size;
  if (snapCache.has(key)) return snapCache.get(key);
  const wasMounted = mountedEl, prevKey = lastLookKey, prevRot = rotY;
  rotY = 0; setLook(look); current.rotation.y = rotY; current.position.y = 0; current.scale.set(1, 1, 1);
  renderer.setSize(size, size, false);
  const cam = camera.clone(); cam.aspect = 1; cam.fov = 26; cam.position.set(0, 1.25, 7.2); cam.lookAt(0, 0.85, 0); cam.updateProjectionMatrix();
  renderer.render(scene, cam);
  const url = renderer.domElement.toDataURL('image/png');
  snapCache.set(key, url);
  rotY = prevRot;
  if (wasMounted) { lastLookKey = ''; fit(); setLook(JSON.parse(prevKey || '{}')); }
  return url;
}
export const ready = true;
