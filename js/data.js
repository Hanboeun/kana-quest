// 글자표, 단어, 헷갈리는 글자, 리그, 가상 플레이어 이름, 캐릭터 조각
(function () {
  const toKata = (s) => s.replace(/[ぁ-ゖ]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0x60));

  // [그룹키, 세트, 제목, 히라가나 글자들(공백 구분), 로마자, 한글, id키(생략 시 로마자)]
  const ROWS = [
    ['a', 'basic', 'あ행', 'あ い う え お', 'a i u e o', '아 이 우 에 오'],
    ['ka', 'basic', 'か행', 'か き く け こ', 'ka ki ku ke ko', '카 키 쿠 케 코'],
    ['sa', 'basic', 'さ행', 'さ し す せ そ', 'sa shi su se so', '사 시 스 세 소'],
    ['ta', 'basic', 'た행', 'た ち つ て と', 'ta chi tsu te to', '타 치 츠 테 토'],
    ['na', 'basic', 'な행', 'な に ぬ ね の', 'na ni nu ne no', '나 니 누 네 노'],
    ['ha', 'basic', 'は행', 'は ひ ふ へ ほ', 'ha hi fu he ho', '하 히 후 헤 호'],
    ['ma', 'basic', 'ま행', 'ま み む め も', 'ma mi mu me mo', '마 미 무 메 모'],
    ['ya', 'basic', 'や행', 'や ゆ よ', 'ya yu yo', '야 유 요'],
    ['ra', 'basic', 'ら행', 'ら り る れ ろ', 'ra ri ru re ro', '라 리 루 레 로'],
    ['wa', 'basic', 'わ·を·ん', 'わ を ん', 'wa wo n', '와 오 응'],
    ['ga', 'dakuten', 'が행', 'が ぎ ぐ げ ご', 'ga gi gu ge go', '가 기 구 게 고'],
    ['za', 'dakuten', 'ざ행', 'ざ じ ず ぜ ぞ', 'za ji zu ze zo', '자 지 즈 제 조'],
    ['da', 'dakuten', 'だ행', 'だ ぢ づ で ど', 'da ji zu de do', '다 지 즈 데 도', 'da di du de do'],
    ['ba', 'dakuten', 'ば행', 'ば び ぶ べ ぼ', 'ba bi bu be bo', '바 비 부 베 보'],
    ['pa', 'dakuten', 'ぱ행', 'ぱ ぴ ぷ ぺ ぽ', 'pa pi pu pe po', '파 피 푸 페 포'],
    ['yoon1', 'yoon', 'きゃ·しゃ·ちゃ·にゃ', 'きゃ きゅ きょ しゃ しゅ しょ ちゃ ちゅ ちょ にゃ にゅ にょ',
      'kya kyu kyo sha shu sho cha chu cho nya nyu nyo', '캬 큐 쿄 샤 슈 쇼 차 추 초 냐 뉴 뇨'],
    ['yoon2', 'yoon', 'ひゃ·みゃ·りゃ', 'ひゃ ひゅ ひょ みゃ みゅ みょ りゃ りゅ りょ',
      'hya hyu hyo mya myu myo rya ryu ryo', '햐 휴 효 먀 뮤 묘 랴 류 료'],
    ['yoon3', 'yoon', 'ぎゃ·じゃ·びゃ·ぴゃ', 'ぎゃ ぎゅ ぎょ じゃ じゅ じょ びゃ びゅ びょ ぴゃ ぴゅ ぴょ',
      'gya gyu gyo ja ju jo bya byu byo pya pyu pyo', '갸 규 교 자 주 조 뱌 뷰 뵤 퍄 퓨 표'],
  ];

  const kana = [], groups = [];
  let order = 0;
  for (const script of ['hira', 'kata']) {
    const p = script === 'hira' ? 'h' : 'k';
    for (const [gk, set, title, chars, roms, hans, keys] of ROWS) {
      const cs = chars.split(' '), rs = roms.split(' '), hs = hans.split(' ');
      const ks = (keys || roms).split(' ');
      const gid = p + '-' + gk;
      const items = cs.map((c, i) => {
        const it = { id: p + '-' + ks[i], char: script === 'hira' ? c : toKata(c), romaji: rs[i], hangul: hs[i],
          script, set, group: gid, quiz: true, write: c.length === 1 };
        kana.push(it); return it.id;
      });
      groups.push({ id: gid, script, set, title: script === 'hira' ? title : toKata(title), items, order: order++ });
    }
    // 특수: 작은 っ, (카타카나) 장음 ー, 외래어 조합
    const extra = [{ id: p + '-xtsu', char: script === 'hira' ? 'っ' : 'ッ', romaji: '(겹자음)', hangul: 'ㅅ받침', quiz: false, write: true }];
    if (script === 'kata') {
      extra.push({ id: 'k-xlong', char: 'ー', romaji: '(장음)', hangul: '길게', quiz: false, write: false });
      const F = [['ファ', 'fa', '파', 'xfa'], ['フィ', 'fi', '피', 'xfi'], ['フェ', 'fe', '페', 'xfe'], ['フォ', 'fo', '포', 'xfo'],
        ['ティ', 'ti', '티', 'xti'], ['ディ', 'di', '디', 'xdi'], ['ウィ', 'wi', '위', 'xwi'], ['ウェ', 'we', '웨', 'xwe'],
        ['シェ', 'she', '셰', 'xshe'], ['ジェ', 'je', '제', 'xje'], ['チェ', 'che', '체', 'xche']];
      for (const [c, r, h, k] of F) extra.push({ id: 'k-' + k, char: c, romaji: r, hangul: h, quiz: true, write: false });
    }
    const gid = p + '-extra';
    for (const e of extra) kana.push(Object.assign({ script, set: 'extra', group: gid }, e));
    groups.push({ id: gid, script, set: 'extra', title: script === 'hira' ? '작은 っ' : 'ッ·ー·외래어', items: extra.map(e => e.id), order: order++ });
  }

  const byChar = new Map(kana.map(k => [k.char, k]));
  const byId = new Map(kana.map(k => [k.id, k]));

  function tokenize(text) {
    const out = [];
    for (let i = 0; i < text.length;) {
      const two = text.slice(i, i + 2);
      if (two.length === 2 && byChar.has(two)) { out.push(byChar.get(two)); i += 2; continue; }
      const one = byChar.get(text[i]);
      if (!one) return null;
      out.push(one); i += 1;
    }
    return out;
  }
  function romajiOf(text) {
    const t = tokenize(text); if (!t) return '';
    let s = '';
    for (let i = 0; i < t.length; i++) {
      const k = t[i];
      if (k.id.endsWith('xtsu')) {
        const nx = t[i + 1]; if (nx) s += nx.romaji.startsWith('ch') ? 't' : nx.romaji[0];
      } else if (k.id === 'k-xlong') {
        const m = s.match(/[aeiou](?=[^aeiou]*$)/); s += m ? m[0] : '';
      } else s += k.romaji;
    }
    return s;
  }

  const W = (list) => list.trim().split('\n').map(l => { const [text, meaning] = l.trim().split(/\s+/); return { text, meaning }; });
  const rawWords = W(`
    ねこ 고양이
    いぬ 개
    すし 초밥
    みず 물
    おちゃ 차
    ごはん 밥
    さかな 생선
    とり 새
    くるま 자동차
    でんしゃ 전철
    がっこう 학교
    せんせい 선생님
    ともだち 친구
    ありがとう 고마워요
    こんにちは 안녕하세요
    さようなら 잘가요
    おはよう 좋은아침
    はい 네
    いいえ 아니요
    あか 빨강
    あお 파랑
    しろ 하양
    くろ 검정
    やま 산
    かわ 강
    うみ 바다
    そら 하늘
    はな 꽃
    あし 다리
    くち 입
    みみ 귀
    あたま 머리
    ひと 사람
    おとこ 남자
    おんな 여자
    こども 아이
    いえ 집
    へや 방
    つくえ 책상
    いす 의자
    ほん 책
    かばん 가방
    とけい 시계
    くつ 신발
    ふく 옷
    でんわ 전화
    えき 역
    みせ 가게
    ぎんこう 은행
    たまご 달걀
    にく 고기
    やさい 채소
    りんご 사과
    みかん 귤
    すいか 수박
    おかね 돈
    きょう 오늘
    あした 내일
    きのう 어제
    いま 지금
    あさ 아침
    ひる 낮
    よる 밤
    ゆき 눈(날씨)
    あめ 비
    かぜ 바람
    おいしい 맛있다
    たかい 비싸다
    やすい 싸다
    おおきい 크다
    ちいさい 작다
    あつい 덥다
    さむい 춥다
    たのしい 즐겁다
    いく 가다
    くる 오다
    たべる 먹다
    のむ 마시다
    みる 보다
    よむ 읽다
    かく 쓰다
    はなす 말하다
    きく 듣다
    ねる 자다
    おきる 일어나다
    しゅくだい 숙제
    りょこう 여행
    きっぷ 표
    ちょっと 조금
    しゃしん 사진
    じゅぎょう 수업
    びょういん 병원
    にほん 일본
    かんこく 한국
    わたし 나
    あなた 당신
    なまえ 이름
    ひゃく 백
    まど 창문
    ぶた 돼지
    えんぴつ 연필
    はし 젓가락
    ふね 배
    ひこうき 비행기
    うた 노래
    き 나무
    め 눈(얼굴)
    て 손
    ぞう 코끼리
    ざっし 잡지
    きって 우표
    いっしょ 함께
    みっつ 셋
    まっすぐ 똑바로
    コーヒー 커피
    テレビ 텔레비전
    パン 빵
    ピザ 피자
    ケーキ 케이크
    アイス 아이스크림
    ジュース 주스
    ミルク 우유
    バス 버스
    タクシー 택시
    ホテル 호텔
    レストラン 레스토랑
    カメラ 카메라
    パソコン 컴퓨터
    ゲーム 게임
    アニメ 애니메이션
    メール 메일
    ノート 공책
    ペン 펜
    テスト 시험
    スマホ 스마트폰
    ラーメン 라멘
    カレー 카레
    サラダ 샐러드
    トマト 토마토
    バナナ 바나나
    メロン 멜론
    チーズ 치즈
    ワイン 와인
    ビール 맥주
    ドア 문
    トイレ 화장실
    シャツ 셔츠
    スカート 치마
    ズボン 바지
    ニュース 뉴스
    ピアノ 피아노
    ギター 기타
    サッカー 축구
    テニス 테니스
    プール 수영장
    デパート 백화점
    スーパー 슈퍼
    コンビニ 편의점
    アメリカ 미국
    フランス 프랑스
    イタリア 이탈리아
    ドイツ 독일
    ソウル 서울
    コップ 컵
    ナイフ 나이프
    フォーク 포크
    スプーン 숟가락
    ソファ 소파
    パーティー 파티
    チケット 티켓
    メニュー 메뉴
    チョコ 초콜릿
  `);
  const words = rawWords.map((w, i) => {
    const t = tokenize(w.text) || [];
    return { id: 'w' + i, text: w.text, meaning: w.meaning, romaji: romajiOf(w.text),
      items: t.map(k => k.id), requires: [...new Set(t.map(k => k.group))],
      script: t.length && t.every(k => k.script === 'kata') ? 'kata' : 'hira' };
  });

  const confusables = [
    ['h-nu', 'h-me'], ['h-ne', 'h-re'], ['h-re', 'h-wa'], ['h-ne', 'h-wa'], ['h-ru', 'h-ro'], ['h-sa', 'h-chi'],
    ['h-ki', 'h-sa'], ['h-ha', 'h-ho'], ['h-i', 'h-ri'], ['h-ko', 'h-ni'], ['h-a', 'h-o'], ['h-nu', 'h-ne'],
    ['h-ma', 'h-ho'], ['h-so', 'h-ro'], ['h-shi', 'h-tsu'],
    ['k-shi', 'k-tsu'], ['k-so', 'k-n'], ['k-ku', 'k-ke'], ['k-u', 'k-wa'], ['k-ko', 'k-yu'], ['k-chi', 'k-te'],
    ['k-a', 'k-ma'], ['k-su', 'k-nu'], ['k-fu', 'k-wa'], ['k-ko', 'k-ro'], ['k-na', 'k-me'], ['k-no', 'k-me'],
    ['k-shi', 'k-n'], ['k-so', 'k-tsu'], ['k-ta', 'k-ku'], ['k-ra', 'k-wo'],
  ];

  const leagues = [
    { id: 'tane', ja: 'たね', ko: '씨앗', color: '#8a9a5b' },
    { id: 'me', ja: 'め', ko: '새싹', color: '#5fa35a' },
    { id: 'take', ja: 'たけ', ko: '대나무', color: '#3f8f6b' },
    { id: 'ume', ja: 'うめ', ko: '매화', color: '#d0587e' },
    { id: 'momo', ja: 'もも', ko: '복숭아', color: '#e8826b' },
    { id: 'sakura', ja: 'さくら', ko: '벚꽃', color: '#e56b9a' },
    { id: 'momiji', ja: 'もみじ', ko: '단풍', color: '#d2512f' },
    { id: 'tsuki', ja: 'つき', ko: '달', color: '#c9a227' },
    { id: 'hoshi', ja: 'ほし', ko: '별', color: '#5b6fd6' },
    { id: 'fuji', ja: 'ふじ', ko: '후지산', color: '#7b4fc9' },
  ];

  const botNames = ('하루 민지 Yuki 지수 Sora 라멘왕 초밥러버 도쿄가자 Kenji 다람쥐 새벽공부 JLPT도전 오사카여행 벚꽃엔딩 ' +
    '곰돌이 Mika 준호 서연 Taro 망고 고구마 히라가나장인 Aoi 은비 카타카나요정 Ren 하늘 단비 Hina 우동한그릇 ' +
    '도윤 나나 Riku 오니기리 콩떡 수빈 Mei 교토산책 예린 Sho 말차라떼 하준 별사탕 Kaito 유나 찹쌀떡 Emi ' +
    '시호 타코야키 지호 Nao 모모 연우 Yuto 소바 다은 Koji 푸딩 서준 Rina 참깨 하린 Daiki').split(' ');

  // 캐릭터 조각: 120x120 좌표계. 몸통은 ui.js에서 그림(중심 60,70 반지름 34)
  const cosmetics = [
    { id: 'hat-band', slot: 'hat', name: '머리띠', svg: '<path d="M30 52 Q60 40 90 52 L90 60 Q60 48 30 60Z" fill="#fff" stroke="#c33" stroke-width="2"/><circle cx="60" cy="47" r="5" fill="#c33"/><path d="M88 54 l12 -6 l-3 10z" fill="#fff" stroke="#c33" stroke-width="2"/>' },
    { id: 'hat-straw', slot: 'hat', name: '밀짚모자', svg: '<ellipse cx="60" cy="44" rx="40" ry="9" fill="#e7c36a"/><path d="M40 44 Q42 22 60 22 Q78 22 80 44Z" fill="#efd27f"/><rect x="40" y="38" width="40" height="6" fill="#c0392b"/>' },
    { id: 'hat-crown', slot: 'hat', name: '왕관', svg: '<path d="M40 44 L44 24 L52 36 L60 20 L68 36 L76 24 L80 44Z" fill="#f2c230" stroke="#b8860b" stroke-width="2"/><circle cx="60" cy="36" r="3" fill="#d6336c"/>' },
    { id: 'hat-cat', slot: 'hat', name: '고양이 귀', svg: '<path d="M34 48 L38 22 L54 40Z" fill="#555"/><path d="M86 48 L82 22 L66 40Z" fill="#555"/><path d="M39 42 L41 30 L49 39Z" fill="#f4a6b8"/><path d="M81 42 L79 30 L71 39Z" fill="#f4a6b8"/>' },
    { id: 'hat-fox', slot: 'hat', name: '여우 가면', svg: '<g transform="rotate(-18 82 44)"><path d="M70 40 L74 26 L80 36 L86 36 L92 26 L96 40 Q96 56 83 58 Q70 56 70 40Z" fill="#fff" stroke="#999" stroke-width="1.5"/><path d="M76 44 l5 2 M86 46 l5 -2" stroke="#c33" stroke-width="2"/></g>' },
    { id: 'hat-sakura', slot: 'hat', name: '벚꽃 핀', svg: '<g transform="translate(78 44)"><circle r="4" cx="0" cy="-6" fill="#f7a1c4"/><circle r="4" cx="6" cy="-2" fill="#f7a1c4"/><circle r="4" cx="4" cy="5" fill="#f7a1c4"/><circle r="4" cx="-4" cy="5" fill="#f7a1c4"/><circle r="4" cx="-6" cy="-2" fill="#f7a1c4"/><circle r="2.5" fill="#f9d54a"/></g>' },
    { id: 'out-yukata', slot: 'outfit', name: '파란 유카타', svg: '<path d="M30 80 Q60 112 90 80 L92 98 Q60 112 28 98Z" fill="#3c6fb0"/><path d="M48 80 L60 96 L72 80" stroke="#fff" stroke-width="3" fill="none"/><rect x="34" y="92" width="52" height="5" fill="#f2c230"/>' },
    { id: 'out-happi', slot: 'outfit', name: '축제 핫피', svg: '<path d="M30 82 Q60 112 90 82 L92 98 Q60 112 28 98Z" fill="#d9480f"/><path d="M52 84 L52 104 M68 84 L68 104" stroke="#fff" stroke-width="3"/>' },
    { id: 'out-ribbon', slot: 'outfit', name: '교복 리본', svg: '<path d="M60 84 L46 76 L46 92Z M60 84 L74 76 L74 92Z" fill="#c2255c"/><circle cx="60" cy="84" r="4" fill="#a61e4d"/>' },
    { id: 'out-cape', slot: 'outfit', name: '빨간 망토', svg: '<path d="M30 70 Q60 80 90 70 L98 106 Q60 96 22 106Z" fill="#c92a2a" opacity=".9"/>' },
    { id: 'out-scarf', slot: 'outfit', name: '목도리', svg: '<path d="M32 80 Q60 92 88 80 L88 88 Q60 100 32 88Z" fill="#2f9e44"/><rect x="70" y="86" width="9" height="20" rx="2" fill="#2f9e44"/>' },
    { id: 'item-fan', slot: 'item', name: '부채', svg: '<g transform="translate(96 74) rotate(20)"><line x1="0" y1="0" x2="0" y2="16" stroke="#8b5a2b" stroke-width="3"/><circle cx="0" cy="-8" r="11" fill="#f08c00"/><circle cx="0" cy="-8" r="5" fill="#fff"/></g>' },
    { id: 'item-umbrella', slot: 'item', name: '우산', svg: '<g transform="translate(100 60)"><path d="M-16 0 Q0 -22 16 0Z" fill="#7048e8"/><line x1="0" y1="0" x2="0" y2="26" stroke="#555" stroke-width="2"/></g>' },
    { id: 'item-onigiri', slot: 'item', name: '주먹밥', svg: '<g transform="translate(98 88)"><path d="M0 -12 L12 8 L-12 8Z" fill="#fff" stroke="#bbb" stroke-linejoin="round" stroke-width="3"/><rect x="-6" y="1" width="12" height="7" fill="#2b2b2b"/></g>' },
    { id: 'item-brush', slot: 'item', name: '붓', svg: '<g transform="translate(98 70) rotate(25)"><rect x="-2" y="-14" width="4" height="26" fill="#a0522d"/><path d="M-3 12 Q0 24 3 12Z" fill="#222"/></g>' },
    { id: 'item-lantern', slot: 'item', name: '초롱', svg: '<g transform="translate(100 78)"><ellipse rx="10" ry="13" fill="#e03131"/><rect x="-6" y="-15" width="12" height="3" fill="#222"/><rect x="-6" y="12" width="12" height="3" fill="#222"/></g>' },
    { id: 'bg-fuji', slot: 'bg', name: '후지산', svg: '<rect width="120" height="120" fill="#cfe8ff"/><path d="M0 110 L50 46 L60 40 L70 46 L120 110Z" fill="#6c7fa8"/><path d="M50 46 L60 40 L70 46 L66 54 L60 50 L54 54Z" fill="#fff"/><circle cx="96" cy="26" r="9" fill="#ff8787"/>' },
    { id: 'bg-sakura', slot: 'bg', name: '벚꽃길', svg: '<rect width="120" height="120" fill="#ffe3ec"/><g fill="#f7a1c4"><circle cx="14" cy="18" r="5"/><circle cx="104" cy="30" r="6"/><circle cx="24" cy="96" r="4"/><circle cx="96" cy="100" r="5"/><circle cx="60" cy="12" r="3"/></g>' },
    { id: 'bg-night', slot: 'bg', name: '밤하늘', svg: '<rect width="120" height="120" fill="#1f2a4d"/><circle cx="92" cy="24" r="10" fill="#ffe066"/><circle cx="96" cy="21" r="9" fill="#1f2a4d"/><g fill="#fff"><circle cx="20" cy="20" r="1.5"/><circle cx="40" cy="34" r="1"/><circle cx="104" cy="56" r="1.5"/><circle cx="14" cy="70" r="1"/></g>' },
    { id: 'bg-torii', slot: 'bg', name: '신사 도리이', svg: '<rect width="120" height="120" fill="#fff4e6"/><g fill="#e8590c"><rect x="8" y="16" width="104" height="7" rx="2"/><rect x="16" y="28" width="88" height="5"/><rect x="22" y="16" width="7" height="104"/><rect x="91" y="16" width="7" height="104"/></g>' },
    { id: 'bg-sea', slot: 'bg', name: '바다', svg: '<rect width="120" height="120" fill="#d0ebff"/><path d="M0 92 Q15 84 30 92 T60 92 T90 92 T120 92 V120 H0Z" fill="#339af0"/><path d="M0 104 Q15 96 30 104 T60 104 T90 104 T120 104 V120 H0Z" fill="#1c7ed6"/>' },
  ];

  // 결정적 난수: 같은 문자열이면 항상 같은 수열
  function hash(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function rng(seedStr) {
    let a = hash(String(seedStr));
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function shuffle(arr, r) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }
  GQ.rand = { hash, rng, shuffle };

  GQ.data = { kana, groups, byId, byChar, tokenize, romajiOf, words, confusables, leagues, botNames, cosmetics, toKata };
})();
