// 입체 캐릭터 꾸미기 아이템. def는 avatar3d.js가 모양을 만들 때 쓰는 값.
(function () {
  const SLOTS = ['skin', 'eyes', 'eyeColor', 'hair', 'hairColor', 'hat', 'top', 'bottom', 'shoes', 'acc', 'bg'];
  const SLOT_NAMES = { skin: '피부', eyes: '눈 모양', eyeColor: '눈동자', hair: '헤어', hairColor: '머리색', hat: '모자', top: '상의', bottom: '하의', shoes: '신발', acc: '액세서리', bg: '배경' };
  const I = (id, slot, name, def) => ({ id, slot, name, def: def || {} });
  const items = [
    // 피부 (처음부터 3가지)
    I('skin-light', 'skin', '밝은 피부', { color: '#ffd9c2' }),
    I('skin-mid', 'skin', '중간 피부', { color: '#f3c29c' }),
    I('skin-tan', 'skin', '구릿빛 피부', { color: '#d69c72' }),
    // 눈 모양
    I('eyes-basic', 'eyes', '기본 눈', { kind: 'basic' }),
    I('eyes-smile', 'eyes', '웃는 눈', { kind: 'smile' }),
    I('eyes-sleepy', 'eyes', '졸린 눈', { kind: 'sleepy' }),
    I('eyes-star', 'eyes', '별 눈', { kind: 'star' }),
    I('eyes-sparkle', 'eyes', '반짝 큰 눈', { kind: 'sparkle' }),
    // 눈동자 색
    I('eye-brown', 'eyeColor', '갈색 눈동자', { color: '#6b4a32' }),
    I('eye-blue', 'eyeColor', '파란 눈동자', { color: '#4a7fc1' }),
    I('eye-green', 'eyeColor', '초록 눈동자', { color: '#3f8f5a' }),
    I('eye-purple', 'eyeColor', '보라 눈동자', { color: '#8a5cc7' }),
    I('eye-black', 'eyeColor', '까만 눈동자', { color: '#2a2230' }),
    // 헤어스타일 (cut: 머리 덩어리 모양, extra: 덧붙이는 부분)
    I('hair-bob', 'hair', '일자 단발', { cut: 'bob' }),
    I('hair-braid', 'hair', '땋은 머리', { cut: 'tied', extra: 'braid' }),
    I('hair-twin', 'hair', '양갈래', { cut: 'tied', extra: 'twin' }),
    I('hair-pony', 'hair', '포니테일', { cut: 'tied', extra: 'pony' }),
    I('hair-bun', 'hair', '똥머리', { cut: 'tied', extra: 'bun' }),
    I('hair-short', 'hair', '짧은 머리', { cut: 'short' }),
    // 머리색
    I('hc-brown', 'hairColor', '갈색 머리', { color: '#6a4330' }),
    I('hc-black', 'hairColor', '까만 머리', { color: '#2b2230' }),
    I('hc-red', 'hairColor', '빨간 머리', { color: '#b8502a' }),
    I('hc-blonde', 'hairColor', '금발', { color: '#e0b860' }),
    I('hc-pink', 'hairColor', '분홍 머리', { color: '#f08fb0' }),
    I('hc-ash', 'hairColor', '애쉬 그레이', { color: '#9a9aa6' }),
    // 모자
    // 모자 4 + 머리띠 3
    I('hat-straw', 'hat', '밀짚모자', { kind: 'straw' }),
    I('hat-beret', 'hat', '베레모', { kind: 'beret', color: '#c0392b' }),
    I('hat-cap', 'hat', '캡모자', { kind: 'cap', color: '#3f63d6' }),
    I('hat-bucket', 'hat', '버킷햇', { kind: 'bucket', color: '#f0dcb8' }),
    I('hat-catband', 'hat', '고양이 귀 머리띠', { kind: 'catband', color: '#3a3a44' }),
    I('hat-ribbonband', 'hat', '리본 머리띠', { kind: 'ribbonband', color: '#e8556d' }),
    I('hat-flowerband', 'hat', '꽃 머리띠', { kind: 'flowerband', color: '#7fbf6a' }),
    // 상의
    I('top-tee', 'top', '흰 티셔츠', { kind: 'tee', color: '#f6f3ea' }),
    I('top-hanbok', 'top', '한복 저고리', { kind: 'jeogori', color: '#ffc2d3', tie: '#e0436b' }),
    I('top-yukata', 'top', '유카타', { kind: 'robe', color: '#3c5f9e', obi: '#ffcf4a', dots: true }),
    I('top-hoodie', 'top', '노란 후드티', { kind: 'hoodie', color: '#ffd45c' }),
    I('top-sailor', 'top', '세일러 칼라', { kind: 'sailor', color: '#ffffff', collar: '#2f4a8a' }),
    I('top-stripe', 'top', '줄무늬 티', { kind: 'tee', color: '#ffffff', stripe: '#e8556d' }),
    // 하의
    I('bot-shorts', 'bottom', '청반바지', { kind: 'shorts', color: '#6f95cf' }),
    I('bot-skirt', 'bottom', '체크 치마', { kind: 'skirt', color: '#c0504d' }),
    I('bot-chima', 'bottom', '한복 치마', { kind: 'long', color: '#3e5bab' }),
    I('bot-overall', 'bottom', '멜빵바지', { kind: 'overall', color: '#7aa7d9' }),
    I('bot-pants', 'bottom', '긴 바지', { kind: 'pants', color: '#55606e' }),
    // 신발
    I('shoe-sneaker', 'shoes', '흰 운동화', { kind: 'sneaker', color: '#ffffff' }),
    I('shoe-kkotsin', 'shoes', '꽃신', { kind: 'flat', color: '#ff8fb1' }),
    I('shoe-geta', 'shoes', '게타', { kind: 'geta', color: '#b07a4a' }),
    I('shoe-boots', 'shoes', '노란 장화', { kind: 'boots', color: '#ffcf3a' }),
    I('shoe-loafer', 'shoes', '갈색 로퍼', { kind: 'flat', color: '#7a4a2e' }),
    // 액세서리
    I('acc-flower', 'acc', '꽃핀', { kind: 'flower' }),
    I('acc-foxmask', 'acc', '여우 가면', { kind: 'foxmask' }),
    I('acc-glasses', 'acc', '동그란 안경', { kind: 'glasses' }),
    I('acc-ribbon', 'acc', '큰 리본', { kind: 'ribbon', color: '#e8556d' }),
    I('acc-norigae', 'acc', '노리개', { kind: 'norigae' }),
    // 배경
    I('bg-sky', 'bg', '맑은 하늘', { sky: '#bfe3ff', mid: '#dfe7ff', ground: '#a8dc8c' }),
    I('bg-sakura', 'bg', '벚꽃길', { sky: '#ffe1ec', mid: '#ffeef4', ground: '#b9e2a0', petals: true }),
    I('bg-fuji', 'bg', '후지산', { sky: '#cfe8ff', mid: '#eaf4ff', ground: '#9fd08a', mountain: true }),
    I('bg-hanok', 'bg', '한옥 마을', { sky: '#fff1d6', mid: '#fff7e8', ground: '#c9b18a' }),
    I('bg-beach', 'bg', '바닷가', { sky: '#bdeaff', mid: '#8fd3f0', ground: '#f3dfae' }),
    I('bg-night', 'bg', '밤하늘', { sky: '#1f2a4d', mid: '#33406b', ground: '#3d6b4a', stars: true }),
  ];
  const STARTER = ['skin-light', 'skin-mid', 'skin-tan', 'eyes-basic', 'eye-brown', 'hair-bob', 'hc-brown', 'top-tee', 'bot-shorts', 'shoe-sneaker', 'bg-sky'];
  const OPTIONAL = new Set(['hat', 'acc']); // 비워둘 수 있는 칸
  const byId = new Map(items.map(i => [i.id, i]));
  function defaultLook() {
    return { skin: 'skin-light', eyes: 'eyes-basic', eyeColor: 'eye-brown', hair: 'hair-bob', hairColor: 'hc-brown',
      hat: null, top: 'top-tee', bottom: 'bot-shorts', shoes: 'shoe-sneaker', acc: null, bg: 'bg-sky' };
  }
  function sanitize(look, owned) {
    const d = defaultLook(), out = {}, have = new Set(owned || []);
    for (const s of SLOTS) {
      const v = look && look[s];
      const it = v && byId.get(v);
      out[s] = it && it.slot === s && have.has(v) ? v : (OPTIONAL.has(s) && v === null ? null : d[s]);
    }
    return out;
  }
  function unowned(owned) { const have = new Set(owned || []); return items.filter(i => !have.has(i.id) && !STARTER.includes(i.id)); }
  function item(id) { return byId.get(id) || null; }
  // 없앤 아이템 → 대신 줄 아이템 (가지고 있던 사람은 바꿔서 받음)
  const RENAMED = { 'hat-gat': 'hat-cap', 'hat-beanie': 'hat-bucket', 'hat-hachimaki': 'hat-ribbonband' };
  GQ.avatar = { RENAMED, SLOTS, SLOT_NAMES, items, STARTER, OPTIONAL, defaultLook, sanitize, unowned, item };
})();
