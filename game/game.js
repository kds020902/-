// 폐허의 거점 — 게임 로직 (4단계: 하이드아웃 시설, 제작, 생산)
(function () {
  'use strict';

  const D = window.GAME_DATA;
  const C = D.config;
  const DB = C.debuffs;
  const BUFFS = C.buffs;
  const CB = C.combat;
  const ITEMS = D.items;
  const LOCS = D.locations;
  const LOC = Object.fromEntries(LOCS.map((l) => [l.id, l]));
  const ENEMIES = D.enemies;
  const EVENTS = Object.fromEntries(D.events.map((e) => [e.id, e]));
  const SK = D.skills;
  const ST = D.story;
  const SKILL_KEYS = Object.keys(SK.list);
  const FRAG = Object.fromEntries(ST.fragments.map((f) => [f.id, f]));
  const FAC = D.facilities;
  const FAC_ORDER = D.facilityOrder;
  const RECIPE = Object.fromEntries(D.recipes.map((r) => [r.id, r]));
  const EX = D.exercise;
  const SAVE_VERSION = 7;
  const EQ = C.equip;
  const HIDE = C.hide;
  const CH_INDEX = Object.fromEntries(D.story.chapters.map((c, i) => [c.id, i]));
  const THREAD = Object.fromEntries(D.story.threads.map((t) => [t.id, t]));
  // 인연: 기록 속 사람들. 단계마다 사건처럼 선택지를 고른다
  const BONDS = ST.bonds;
  const BOND = Object.fromEntries(BONDS.map((b) => [b.id, b]));
  const BGROUP = ST.bondGroups;
  // 거주민 · 엔딩 · 탈출 · 고물상 설정 (data.js story)
  const RES_CFG = ST.residents || { rooms: [], list: {} };
  const LB = C.lab || null;
  const BK = C.bike || { speedMult: 0.5, tank: 12, perFuel: 6, startFuel: 3, noiseMult: 1.5 };
  const RES = RES_CFG.list;
  const END = ST.endings || { list: {}, fallenKills: 3 };
  const ESC = ST.escape || { radioKeys: [], clues: [] };
  const CROW = ST.crow || {};
  for (const b of BONDS) b.steps.forEach((st, i) => { EVENTS[`q:${b.id}:${i}`] = { id: `q:${b.id}:${i}`, title: `${b.who} · ${st.title}`, text: [st.text], choices: st.choices, bond: b.id }; });
  // 연구소 전용방: 방마다 사건 하나 ('굳게 닫힌 문이다.' 버튼으로 연다). 카드키 · 빠루(함정) · 그냥 두기
  const ROOMS = Object.fromEntries(((LB && LB.rooms) || []).map((r) => [r.id, r]));
  const RTYPE = (LB && LB.roomTypes) || {};
  for (const r of Object.values(ROOMS)) {
    const T = RTYPE[r.type], AL = LB.alarm;
    EVENTS[`room:${r.id}`] = { id: `room:${r.id}`, title: `굳게 닫힌 문 · ${r.name}`, text: [r.door], room: r.id, choices: [
      { label: `${T.color} 카드키를 댄다`, sub: `${LB.roomMinutes}분 · 필요: ${ITEMS[T.card].name}`, requires: [T.card], roomCard: true, outcome: { time: LB.roomMinutes, roomOpen: true } },
      // 함정: 여느 잠긴 문처럼 보이지만 열리지 않고 경보가 울린다
      { label: '빠루로 강제로 연다', sub: `${AL.minutes}분 · 필요: 빠루 · 스테미너 ${AL.stamina}`, requires: ['crowbar'], outcome: { time: AL.minutes, stamina: AL.stamina, roomAlarm: true } },
      { label: '그냥 둔다', sub: '문은 그대로 남는다', outcome: { log: '문을 한 번 올려다보고 돌아섰다.' } },
    ] };
  }
  const LOCAL_KEY = 'ruin-hideout.save.v1';
  const LOG_MAX = 150;
  const HIDEOUT_DESC = '도시 외곽의 낡은 지하 창고. 철문을 걸어 잠그면 그나마 숨을 돌릴 수 있다.';
  const DEBUFF_KEYS = ['bleed', 'infection', 'fracture', 'fear', 'poison', 'nightmare'];
  const EQ_CATS = ['weapon', 'armor', 'bag', 'gear'];

  // 지도 좌표: 거점이 (0,0), 거리 단위는 "걸어서 걸리는 분"
  const POS = { hideout: { x: 0, y: 0 } };
  LOCS.forEach((l) => {
    const a = (l.angle * Math.PI) / 180;
    POS[l.id] = { x: l.dist * Math.cos(a), y: -l.dist * Math.sin(a) };
  });
  // 연구소(lab) 층은 그 게임의 문(G.labDoor) 아래에 있다: 문까지 + 지하로 내려가는 시간
  const isLab = (id) => !!(LOC[id] && LOC[id].lab);
  const OUT_LOCS = LOCS.filter((l) => !l.hidden);
  const labDepth = (id) => (C.lab.inMinutes || 20) + ((LOC[id].floor || 1) - 1) * (C.lab.floorMinutes || 15);
  const distMin = (a, b) => {
    const la = isLab(a), lb = isLab(b);
    if (la && lb) return Math.abs(LOC[a].floor - LOC[b].floor) * (C.lab.floorMinutes || 15);
    const pa = la ? POS[G.labDoor] : POS[a], pb = lb ? POS[G.labDoor] : POS[b];
    return Math.hypot(pa.x - pb.x, pa.y - pb.y) + (la ? labDepth(a) : 0) + (lb ? labDepth(b) : 0);
  };

  // ---------- 작은 도구들 ----------
  const $ = (sel) => document.querySelector(sel);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const chance = (p) => Math.random() < p;
  const randInt = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmtKg = (w) => (Math.round(w * 10) / 10).toFixed(1);
  const pct = (v) => Math.round(v * 100);
  const signed = (v) => `${v > 0 ? '+' : ''}${v}`;
  function weightedPick(entries) {
    const total = entries.reduce((s, e) => s + e.w, 0);
    if (total <= 0) return null;
    let x = Math.random() * total;
    for (const e of entries) { x -= e.w; if (x <= 0) return e; }
    return entries[entries.length - 1];
  }
  function fmtDur(min) {
    min = Math.round(min);
    const h = Math.floor(min / 60), m = min % 60;
    if (!h) return `${m}분`;
    if (!m) return `${h}시간`;
    return `${h}시간 ${m}분`;
  }
  function fmtLeft(min) {
    if (min >= 2880) return `${Math.ceil(min / 1440)}일`;
    if (min >= 60) return `${Math.ceil(min / 60)}시간`;
    return `${Math.max(1, Math.ceil(min))}분`;
  }
  function jong(word) {
    const s = String(word);
    const ch = s.charCodeAt(s.length - 1);
    if (ch < 0xac00 || ch > 0xd7a3) return -1;
    return (ch - 0xac00) % 28;
  }
  const eul = (w) => w + (jong(w) > 0 ? '을' : '를');
  const iga = (w) => w + (jong(w) > 0 ? '이' : '가');
  const eun = (w) => w + (jong(w) > 0 ? '은' : '는');
  const gwa = (w) => w + (jong(w) > 0 ? '과' : '와');
  const ro = (w) => w + (jong(w) > 0 && jong(w) !== 8 ? '으로' : '로');
  const fill = (t, place) => String(t).replace(/\{place\}/g, place);

  const dayOf = (t) => Math.floor(t / 1440) + 1;
  const hourOf = (t) => Math.floor((t % 1440) / 60);
  const isNight = (t) => { const h = hourOf(t); return h >= C.night.start || h < C.night.end; };
  const clockStr = (t) => {
    const m = ((t % 1440) + 1440) % 1440;
    return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  };

  const CAT_ORDER = { weapon: 0, armor: 1, bag: 2, gear: 2.2, case: 2.5, ammo: 3, mod: 3.5, food: 4, drink: 5, med: 6, material: 7, junk: 8, quest: 9 };
  const USE_VERB = { food: '먹었다', drink: '마셨다', med: '사용했다' };
  const USE_LABEL = { food: '먹기', drink: '마시기', med: '사용' };
  const useLabel = (it) => (it.inj ? '주사' : USE_LABEL[it.cat]);
  const useVerb = (it) => (it.inj ? '주사했다' : USE_VERB[it.cat]);
  const EQUIP_LABEL = { weapon: '들기', armor: '입기', bag: '메기', gear: '착용' };
  const GEAR_SLOT = { radio: '무전기', ear: '귀' };

  const NEED_STATES = {
    hunger: [[0, '배부름'], [30, '보통'], [60, '배고픔'], [85, '굶주림'], [100, '아사 직전']],
    thirst: [[0, '충분함'], [30, '보통'], [60, '목마름'], [85, '심한 갈증'], [100, '탈수']],
    fatigue: [[0, '개운함'], [30, '보통'], [60, '피곤함'], [80, '녹초'], [100, '한계']],
  };
  const NEED_WARN = {
    hunger: [null, null, '배가 고프다.', '배가 너무 고파 손이 떨린다.', '굶주림에 몸이 버티지 못한다. (HP 감소)'],
    thirst: [null, null, '목이 마르다.', '목이 타들어 간다.', '탈수 증상이 시작됐다. (HP 감소)'],
    fatigue: [null, null, '몸이 무겁다. 쉬어야 한다.', '너무 지쳤다. 움직임이 느려진다. (행동시간 증가)', '한계다. 이대로는 쓰러진다. (HP 감소)'],
  };
  const DEATH_TEXT = {
    weight: '무거운 짐을 짊어진 채 쓰러졌다',
    bleed: '피를 너무 많이 흘려 쓰러졌다',
    infection: '감염을 이겨내지 못하고 쓰러졌다',
    thirst: '탈수로 쓰러졌다',
    hunger: '굶주림 끝에 쓰러졌다',
    poison: '식중독으로 탈진해 쓰러졌다',
    fatigue: '극도의 피로로 쓰러졌다',
  };
  function needState(kind, v) {
    const arr = NEED_STATES[kind];
    let i = 0;
    for (let k = 0; k < arr.length; k++) if (v >= arr[k][0]) i = k;
    return i;
  }

  // ---------- 상태 ----------
  let G = null;
  const ui = { screen: 'title', tab: 'scene', titleView: 'main', menuView: null, sel: null, exportCode: '', showHides: false, recordView: 'people', craftQty: {}, invView: 'inv', facView: null, skillView: null, pack: null, stashCat: 'all', invCat: 'all', sortBy: 'rarity', recipeSort: 'rarity' };

  function newState() {
    return {
      v: SAVE_VERSION,
      time: C.startMinute,
      loc: 'hideout',
      player: {
        hp: C.hp.base, stamina: C.stamina.max, hunger: 20, thirst: 20, fatigue: 10,
        inv: { ...D.start.inv }, bag: D.start.bag, weaponsL: [], weaponS: null, armors: [], debuffs: {}, buffs: {},
        // 장착한 총에 단 부착물: modsL은 큰 무기 칸과 같은 순서, modsS는 작은 무기 칸 ({칸: 부착물})
        modsL: [], modsS: {},
        // 들고 다니는 케이스 [{ id, items }] · 잠근 물건 {id: true} ('전부 창고에 넣기'에서 빠진다)
        cases: [], locked: {},
        // 기어 칸: 무전기, 귀(헤드셋·이어폰)
        radio: null, ear: null,
      },
      // 총마다 마지막으로 쓰던 부착물 구성. 총을 다시 들면 가진 부착물로 그대로 다시 단다
      gunBuild: {},
      stash: { ...D.start.stash },
      stashCases: [],
      locs: Object.fromEntries(LOCS.map((l) => [l.id, { spots: l.spots, ground: {}, visited: false, hides: makeHides(l), groundLost: null }])),
      lastRefillDay: 1,
      lastTheftDay: 1,
      recordNew: false,
      log: [],
      recent: [],
      stats: { deaths: 0, searches: 0, kills: 0, npcKills: 0 },
      skills: Object.fromEntries(SKILL_KEYS.map((k) => [k, { lv: 0, xp: 0, today: 0 }])),
      skillDay: 1,
      skillNew: false,
      flags: {},
      fragments: [],
      radioHeard: [],
      radioDay: 0,
      caches: [],
      seenAmbient: [],
      bonds: {},
      // 거점에 들인 사람들 {인연 id: { since, food, water, hungry }} · 의뢰인 거래 사용 기록 · 고물상 오늘의 물건 · 한지수의 오늘 소식 · 본 엔딩
      residents: {},
      // 오토바이: { fuel: 남은 시간, on: 타고 다니는지 }
      bike: null,
      // 연구소로 가는 길: 모은 쪽지, 연속으로 못 찾은 횟수(쪽지·파편), 이번 게임의 문 위치, 지금 카드를 쓴 횟수
      labNotes: [], labDry: 0, labFragDry: 0, labDoor: LB ? pick(LB.doorLocs) : null, cardWear: 0,
      // 전용방: 발견한 문(버튼) · 방마다 {clear: 다시 잠기는 때, lock: 봉쇄가 풀리는 때} · 카드 종류별 지금 카드를 쓴 횟수 · 모은 단서 · 단서를 연속으로 못 찾은 횟수 · 경보 {loc, until}
      labDoors: [], labRooms: {}, roomWear: {}, labClues: {}, clueDry: 0, labAlarm: null,
      // 김정우의 연구 일지 · 핵심 데이터를 연속으로 못 찾은 횟수
      jwJournal: [], coreDry: 0,
      shopUsed: {},
      crowStock: null,
      tip: null,
      endings: [],
      hideout: newHideout(),
      pending: null,
      dead: false,
      deathCause: null,
    };
  }

  // 숨길 곳: 털릴 확률(하루 단위)과 숨기는 시간은 게임마다 무작위
  function makeHides(l) {
    return l.hides.map(() => ({
      items: {},
      risk: Math.round((HIDE.riskMin + Math.random() * (HIDE.riskMax - HIDE.riskMin) + l.danger * HIDE.riskPerDanger) * 100) / 100,
      time: Math.max(5, Math.round(randInt(HIDE.timeMin, HIDE.timeMax) / 5) * 5),
      known: false,
      lost: null,
    }));
  }
  function cleanHides(old, l) {
    if (!Array.isArray(old) || old.length !== l.hides.length) return makeHides(l);
    return old.map((h) => ({
      items: cleanItems(h && h.items),
      risk: clamp(+(h && h.risk) || HIDE.riskMin, 0, 1),
      time: Math.max(5, Math.round(+(h && h.time) || HIDE.timeMin)),
      known: !!(h && h.known),
      lost: h && h.lost ? { items: cleanItems(h.lost.items), seen: !!h.lost.seen } : null,
    }));
  }

  function newHideout() {
    // readyXp: 다 만든 것을 받을 때 주는 지능 경험치 (시설별)
    return { fac: Object.fromEntries(FAC_ORDER.map((id) => [id, 0])), build: null, crafts: {}, queue: {}, ready: {}, readyXp: {}, fuel: 0, genOn: true, water: { stored: 0, prog: 0 } };
  }
  function cleanHideout(h) {
    const out = newHideout();
    if (!h || typeof h !== 'object') return out;
    for (const id of FAC_ORDER) out.fac[id] = clamp(Math.floor(+(h.fac && h.fac[id]) || 0), 0, FAC[id].levels.length);
    if (h.build && FAC[h.build.id] && h.build.to === out.fac[h.build.id] + 1) out.build = { id: h.build.id, to: h.build.to, left: Math.max(0, +h.build.left || 0) };
    // 예전 세이브의 제작은 경험치를 미리 받았으므로 xp가 없다
    for (const fid in h.crafts || {}) { const c = h.crafts[fid]; if (FAC[fid] && c && RECIPE[c.recipe]) out.crafts[fid] = { recipe: c.recipe, left: Math.max(0, +c.left || 0), count: Math.max(1, Math.floor(+c.count || 1)), ...(c.elec ? { elec: true } : {}), ...(+c.xp > 0 ? { xp: +c.xp } : {}) }; }
    for (const fid in h.queue || {}) {
      if (!FAC[fid] || !Array.isArray(h.queue[fid])) continue;
      const q = h.queue[fid].filter((x) => x && RECIPE[x.recipe] && RECIPE[x.recipe].at === fid).slice(0, C.craftQueue || 3)
        .map((x) => ({ recipe: x.recipe, count: Math.max(1, Math.floor(+x.count || 1)), paid: cleanItems(x.paid), ...(+x.xp > 0 ? { xp: +x.xp } : {}), ...(x.elec ? { elec: true } : {}) }));
      if (q.length) out.queue[fid] = q;
    }
    for (const fid in h.ready || {}) if (FAC[fid]) { const m = cleanItems(h.ready[fid]); if (Object.keys(m).length) out.ready[fid] = m; }
    for (const fid in h.readyXp || {}) if (out.ready[fid] && +h.readyXp[fid] > 0) out.readyXp[fid] = +h.readyXp[fid];
    out.fuel = Math.max(0, +h.fuel || 0);
    out.genOn = h.genOn !== false;
    if (h.water) out.water = { stored: Math.max(0, Math.floor(+h.water.stored || 0)), prog: Math.max(0, +h.water.prog || 0) };
    return out;
  }

  function cleanItems(m) {
    const out = {};
    if (m && typeof m === 'object') for (const id in m) if (ITEMS[id] && m[id] > 0) out[id] = Math.floor(m[id]);
    return out;
  }
  function cleanCases(list) {
    return (Array.isArray(list) ? list : []).filter((c) => c && ITEMS[c.id] && ITEMS[c.id].case)
      .map((c) => { const items = cleanItems(c.items); for (const id in items) if (!caseFits(c.id, id)) delete items[id]; return { id: c.id, items }; });
  }
  // 그 총의 칸에 맞는 부착물만 남긴다
  function cleanMods(gid, m) {
    const out = {};
    if (!m || typeof m !== 'object' || !ITEMS[gid] || !ITEMS[gid].slots) return out;
    for (const slot of ITEMS[gid].slots) if (modFits(m[slot], gid, slot)) out[slot] = m[slot];
    return out;
  }
  function cleanDebuffs(d) {
    const out = {};
    if (!d || typeof d !== 'object') return out;
    for (const k of ['bleed', 'fracture', 'fear', 'poison', 'nightmare']) if (d[k] && d[k].left > 0) out[k] = { left: +d[k].left };
    if (d.infection && d.infection.sev > 0) out.infection = { sev: Math.min(100, +d.infection.sev) };
    return out;
  }
  function cleanPending(pd) {
    if (!pd || typeof pd !== 'object' || !pd.ctx) return null;
    if (pd.ctx.type === 'travel' && !(pd.ctx.dest === 'hideout' || LOC[pd.ctx.dest])) return null;
    if (pd.kind === 'combat' && ENEMIES[pd.enemy]) return pd;
    if (pd.kind === 'event' && EVENTS[pd.id] && EVENTS[pd.id].trade) {
      // 예전 세이브의 거래 하나(offer)는 목록 하나로 바꾼다
      const list = Array.isArray(pd.offers) ? pd.offers : [pd.offer];
      pd.offers = [...new Set(list.filter((i) => Number.isInteger(i) && D.trades[i]))];
      delete pd.offer;
      return pd.offers.length ? pd : null;
    }
    if (pd.kind === 'event' && EVENTS[pd.id]) return pd;
    return null;
  }

  // 예전 세이브나 다음 단계 세이브를 현재 데이터에 맞춘다
  function migrate(s) {
    const fresh = newState();
    const oldVersion = s.v || 1;
    const st = { ...fresh, ...s };
    delete st.mode; // 1단계 초기의 "시작할 때 고른 죽음 방식"은 더 이상 쓰지 않는다
    st.player = { ...fresh.player, ...(s.player || {}) };
    st.player.inv = cleanItems(st.player.inv);
    // 7단계 전 세이브: 무기 1칸·방어구 1칸 -> 큰 무기 2칸 + 작은 무기 1칸, 옷 3겹
    const pl = s.player || {};
    const isW = (id, size) => id && ITEMS[id] && ITEMS[id].cat === 'weapon' && (ITEMS[id].size || 'large') === size;
    const isA = (id) => id && ITEMS[id] && ITEMS[id].cat === 'armor';
    st.player.weaponsL = (Array.isArray(pl.weaponsL) ? pl.weaponsL : []).filter((id) => isW(id, 'large')).slice(0, EQ.large);
    st.player.weaponS = isW(pl.weaponS, 'small') ? pl.weaponS : null;
    st.player.armors = (Array.isArray(pl.armors) ? pl.armors : []).filter(isA).slice(0, EQ.layers);
    if (isW(pl.weapon, 'small') && !st.player.weaponS) st.player.weaponS = pl.weapon;
    else if (isW(pl.weapon, 'large') && st.player.weaponsL.length < EQ.large) st.player.weaponsL.push(pl.weapon);
    if (isA(pl.armor) && st.player.armors.length < EQ.layers) st.player.armors.push(pl.armor);
    delete st.player.weapon;
    delete st.player.armor;
    if (st.player.bag && (!ITEMS[st.player.bag] || ITEMS[st.player.bag].cat !== 'bag')) st.player.bag = null;
    for (const k of ['radio', 'ear']) if (st.player[k] && !(ITEMS[st.player[k]] && ITEMS[st.player[k]].gear === k)) st.player[k] = null;
    st.player.modsL = st.player.weaponsL.map((gid, i) => cleanMods(gid, Array.isArray(pl.modsL) ? pl.modsL[i] : null));
    st.player.modsS = st.player.weaponS ? cleanMods(st.player.weaponS, pl.modsS) : {};
    st.gunBuild = {};
    for (const gid in s.gunBuild || {}) if (ITEMS[gid] && ITEMS[gid].slots) { const b = cleanMods(gid, s.gunBuild[gid]); if (Object.keys(b).length) st.gunBuild[gid] = b; }
    st.player.debuffs = cleanDebuffs(st.player.debuffs);
    const buffs = {};
    for (const id in st.player.buffs || {}) {
      const b = st.player.buffs[id];
      if (BUFFS[id] && b.left > 0) buffs[id] = { left: +b.left, ...(Number.isFinite(+b.crash) && b.crash != null ? { crash: Math.max(0, +b.crash) } : {}) };
    }
    st.player.buffs = buffs;
    st.stash = cleanItems(s.stash);
    st.player.cases = cleanCases(pl.cases);
    st.bike = s.bike && typeof s.bike === 'object' ? { fuel: clamp(+s.bike.fuel || 0, 0, BK.tank), on: !!s.bike.on } : null;
    if (LB) {
      st.labNotes = (Array.isArray(s.labNotes) ? s.labNotes : []).filter((id, i, a) => LB.notes.some((n) => n.id === id) && a.indexOf(id) === i);
      for (const k of ['labDry', 'labFragDry', 'cardWear', 'coreDry']) st[k] = Math.max(0, Math.floor(+s[k] || 0));
      st.jwJournal = (Array.isArray(s.jwJournal) ? s.jwJournal : []).filter((id, i, a) => (LB.journal || []).some((j) => j.id === id) && a.indexOf(id) === i);
      st.labDoor = LB.doorLocs.includes(s.labDoor) ? s.labDoor : fresh.labDoor;
      st.labDoors = (Array.isArray(s.labDoors) ? s.labDoors : []).filter((id, i, a) => ROOMS[id] && a.indexOf(id) === i);
      st.labRooms = {};
      for (const id in s.labRooms || {}) if (ROOMS[id]) st.labRooms[id] = { clear: +s.labRooms[id].clear || 0, lock: +s.labRooms[id].lock || 0 };
      st.roomWear = {};
      st.labClues = {};
      for (const t in RTYPE) {
        st.roomWear[t] = clamp(Math.floor(+(s.roomWear || {})[t] || 0), 0, LB.roomCardUses - 1);
        st.labClues[t] = clamp(Math.floor(+(s.labClues || {})[t] || 0), 0, LB.clueNeed);
      }
      st.clueDry = Math.max(0, Math.floor(+s.clueDry || 0));
      st.labAlarm = s.labAlarm && LOC[s.labAlarm.loc] ? { loc: s.labAlarm.loc, until: +s.labAlarm.until || 0 } : null;
    }
    st.stashCases = cleanCases(s.stashCases);
    st.player.locked = {};
    for (const id in pl.locked || {}) if (ITEMS[id] && pl.locked[id]) st.player.locked[id] = true;
    st.stats = { ...fresh.stats, ...(s.stats || {}) };
    st.locs = {};
    for (const l of LOCS) {
      const old = (s.locs && s.locs[l.id]) || {};
      const loc = { ...fresh.locs[l.id], ...old, ground: cleanItems(old.ground), hides: cleanHides(old.hides, l), groundLost: old.groundLost ? cleanItems(old.groundLost) : null };
      // 2단계: 수색 구역이 5배가 됐다
      if (oldVersion < 2 && typeof old.spots === 'number') loc.spots = old.spots * 5;
      loc.spots = clamp(loc.spots, 0, l.spots);
      st.locs[l.id] = loc;
    }
    if (st.loc !== 'hideout' && !LOC[st.loc]) st.loc = 'hideout';
    st.log = Array.isArray(s.log) ? s.log.slice(-LOG_MAX) : [];
    st.recent = Array.isArray(s.recent) ? s.recent : [];
    st.pending = cleanPending(s.pending);
    st.skills = {};
    for (const k of SKILL_KEYS) {
      const o = (s.skills && s.skills[k]) || {};
      st.skills[k] = { lv: clamp(Math.floor(+o.lv || 0), 0, SK.max), xp: Math.max(0, +o.xp || 0), today: Math.max(0, +o.today || 0) };
    }
    st.flags = s.flags && typeof s.flags === 'object' ? { ...s.flags } : {};
    st.fragments = Array.isArray(s.fragments) ? s.fragments.filter((id) => FRAG[id]) : [];
    // 들은 방송은 '채널:일차'(무전은 '채널:p번호')로 기억한다. 예전 세이브는 채널마다 마지막으로 들은 날만 있었다
    const rh = s.radioHeard;
    st.radioHeard = Array.isArray(rh) ? rh.filter((k) => typeof k === 'string')
      : rh && typeof rh === 'object' ? Object.entries(rh).filter(([, d]) => +d > 0).map(([c, d]) => `${c}:${Math.floor(+d)}`) : [];
    st.radioDay = Math.max(0, Math.floor(+s.radioDay || 0));
    st.caches = (Array.isArray(s.caches) ? s.caches : []).map((c) => {
      if (c && FRAG[c.id] && FRAG[c.id].cache) return { id: c.id, loc: FRAG[c.id].cache.loc, place: FRAG[c.id].cache.place, items: cleanItems(c.items) };
      if (c && typeof c.id === 'string' && (c.id.startsWith('q:') || /^supply_\d+$/.test(c.id)) && LOC[c.loc] && typeof c.place === 'string') return { id: c.id, loc: c.loc, place: c.place, items: cleanItems(c.items) };
      return null;
    }).filter(Boolean);
    st.bonds = {};
    for (const b of BONDS) {
      const o = s.bonds && s.bonds[b.id];
      if (!o) continue;
      const prog = {};
      for (const k in o.prog || {}) if (+o.prog[k] > 0) prog[k] = Math.floor(+o.prog[k]);
      st.bonds[b.id] = { step: clamp(Math.floor(+o.step || 0), 0, b.steps.length - 1), at: Math.max(0, Math.floor(+o.at || 0)), done: !!o.done, prog, ...(o.dead ? { dead: true } : {}), ...(o.hostile ? { hostile: true } : {}) };
    }
    st.residents = {};
    for (const id in s.residents || {}) {
      const r = s.residents[id];
      if (RES[id] && r && st.bonds[id] && !st.bonds[id].dead) st.residents[id] = { since: Math.max(1, Math.floor(+r.since || 1)), food: Math.max(0, Math.floor(+r.food || 0)), water: Math.max(0, Math.floor(+r.water || 0)), hungry: Math.max(0, Math.floor(+r.hungry || 0)), ...(r.out ? { out: true } : {}) };
    }
    if (st.bonds.jungwoo && st.bonds.jungwoo.done && !st.residents.jungwoo && !st.flags['q:jungwoo_home'] && !st.flags['q:jungwoo_left']) st.flags['q:jungwoo_left'] = 1;
    st.shopUsed = {};
    for (const id in s.shopUsed || {}) { const u = s.shopUsed[id]; if (BOND[id] && u && Array.isArray(u.used)) st.shopUsed[id] = { day: Math.floor(+u.day || 0), used: u.used.filter(Number.isInteger) }; }
    st.crowStock = s.crowStock && Array.isArray(s.crowStock.idx) ? { day: Math.floor(+s.crowStock.day || 0), lv: Math.floor(+s.crowStock.lv || 0), idx: s.crowStock.idx.filter((i) => BOND.crow && BOND.crow.shop[i]) } : null;
    st.tip = s.tip && LOC[s.tip.loc] ? { day: Math.floor(+s.tip.day || 0), loc: s.tip.loc } : null;
    st.endings = Array.isArray(s.endings) ? s.endings.filter((e) => END.list[e]) : [];
    st.seenAmbient = Array.isArray(s.seenAmbient) ? s.seenAmbient.filter((k) => typeof k === 'string').slice(-300) : [];
    st.hideout = cleanHideout(s.hideout);
    if (!s.lastTheftDay) st.lastTheftDay = dayOf(st.time);
    st.dead = !!s.dead; // 쓰러진 채 저장됐다면 다시 열었을 때 선택지를 띄운다
    st.deathCause = st.dead ? s.deathCause || '쓰러졌다' : null;
    st.v = SAVE_VERSION;
    return st;
  }

  // ---------- 계산 ----------
  const P = () => G.player;
  const lvl = (k) => G.skills[k].lv;
  // 엘리트 스킬: 최대 레벨에 닿으면 열린다 (타르코프식)
  const elite = (k) => G.skills[k].lv >= SK.max;
  // 깊은 잠의 흔적: 깊은 잠을 잘 때마다 한 겹씩 쌓이는 영구 버프
  const DSR = (ST.deepSleep && ST.deepSleep.reward) || null;
  const dsStacks = () => (DSR ? Math.min(G.stats.deepSleeps || 0, DSR.maxStacks) : 0);
  const facLv = (id) => G.hideout.fac[id] || 0;
  const facCfg = (id) => (facLv(id) ? FAC[id].levels[facLv(id) - 1] : null);
  const stashCap = () => C.stashSlots + (facCfg('stash') ? facCfg('stash').slots : 0);
  // 발전기 7레벨은 낮에 태양광으로 돌아가 연료가 닳지 않는다
  const solarNow = () => { const g = facCfg('generator'); return !!(g && g.solar && !isNight(G.time)); };
  const isPowered = () => facLv('generator') > 0 && G.hideout.genOn && (G.hideout.fuel > 0 || solarNow());
  // 시설 레벨이 오르면 그 시설에서 만드는 시간이 줄어든다
  const facSpeed = (fid) => ((facCfg(fid) && facCfg(fid).speed) || 1) * (fid === 'kitchen' && resActive('dohyun') ? RES.dohyun.kitchen : 1) * (fid === 'medbay' && resActive('jungwoo') ? 1 / (RES.jungwoo.medSpeed || 1) : 1);
  const bedFatigueMult = () => (facCfg('bed') ? facCfg('bed').fatigueMult : 1) * (resActive('family') ? RES.family.sleepMult || 1 : 1);
  const homeHpBonus = (sleeping) => (G.loc !== 'hideout' ? 0 : (facCfg('medbay') ? facCfg('medbay').hp : 0) + (sleeping && facCfg('bed') ? facCfg('bed').hp : 0) + (resActive('clinic') ? RES.clinic.hp : 0));
  const countHave = (id) => (G.stash[id] || 0) + (P().inv[id] || 0);
  // 대체 재료까지 합친 개수 (예: 끓인 물 대신 생수)
  const SUBS = C.substitutes || {};
  const countAny = (id) => countHave(id) + (SUBS[id] || []).reduce((sum, x) => sum + countHave(x), 0);
  const haveAll = (list) => list.every(([id, n]) => countAny(id) >= n);
  const reqMet = (req) => Object.entries(req || {}).every(([f, lv]) => facLv(f) >= lv);
  const SL = SK.list;
  const strengthCarry = () => Math.floor(lvl('strength') / SL.strength.carryEvery) * SL.strength.carryKg;
  // 악몽의 후유증이 있으면 최대 HP·스테미너가 줄어든다
  const nightmareOn = () => !!(G && G.player.debuffs.nightmare);
  const maxHp = () => Math.round((C.hp.base + lvl('vitality') * SL.vitality.hpPerLv + (DSR ? dsStacks() * DSR.hpPerStack : 0)) * (nightmareOn() ? DB.nightmare.hpMult : 1));
  // 지구력: LV당 최대 스테미너 +staminaPerLv
  const maxStamina = () => Math.round(C.stamina.max * (1 + lvl('endurance') * SL.endurance.staminaPerLv) * (nightmareOn() ? DB.nightmare.staminaMult : 1));
  const bagBonus = () => (P().bag ? ITEMS[P().bag].bag : 0);
  const carryLimit = () => C.baseCarry + bagBonus() + strengthCarry() + buffSum('carry');
  function mapWeight(m) { let w = 0; for (const id in m) w += ITEMS[id].w * m[id]; return w; }
  const weaponIds = () => [...P().weaponsL, ...(P().weaponS ? [P().weaponS] : [])];
  // ---------- 총기 부착물 ----------
  const GM_SLOTS = { sight: '조준경', muzzle: '총구', mag: '탄창', rail: '레일', stock: '개머리판' };
  const modFits = (mid, gid, slot) => {
    const m = ITEMS[mid], g = ITEMS[gid];
    return !!(m && m.cat === 'mod' && m.slot === slot && m.fits.includes(gid) && g && (g.slots || []).includes(slot));
  };
  // 장착 칸 열쇠: 'L0', 'L1', 'S'
  const gunKeys = () => [...P().weaponsL.map((_, i) => `L${i}`), ...(P().weaponS ? ['S'] : [])];
  const gunAt = (key) => (key === 'S' ? P().weaponS : P().weaponsL[+key.slice(1)]);
  const modsAt = (key) => (key === 'S' ? P().modsS : (P().modsL || [])[+key.slice(1)]) || {};
  // 칸 순서대로 (조준경 → 총구 → 탄창 → 레일 → 개머리판)
  const modIds = (m) => Object.keys(GM_SLOTS).map((k) => m && m[k]).filter((x) => x && ITEMS[x]);
  const modSum = (m, k) => modIds(m).reduce((a, x) => a + (ITEMS[x][k] || 0), 0);
  // 그 총에 달린 부착물 (같은 총을 둘 들었으면 더 좋은 쪽)
  function modsOf(gid) {
    let best = {};
    for (const k of gunKeys()) if (gunAt(k) === gid && modSum(modsAt(k), 'win') >= modSum(best, 'win')) best = modsAt(k);
    return best;
  }
  const modsWeight = () => [...(P().modsL || []), P().modsS].reduce((a, m) => a + modIds(m).reduce((b, x) => b + ITEMS[x].w, 0), 0);
  const equippedIds = () => [...weaponIds(), ...P().armors, ...(P().bag ? [P().bag] : []), ...(P().radio ? [P().radio] : []), ...(P().ear ? [P().ear] : [])];
  // 기어 효과
  const radioCfg = () => (G && P().radio ? ITEMS[P().radio].radio : null);
  const earCfg = () => (G && P().ear ? ITEMS[P().ear].ear : null);
  const radioEncMult = () => (radioCfg() ? radioCfg().enc || 1 : 1);
  const earRestMult = () => (earCfg() ? earCfg().rest || 1 : 1);
  const equippedWeight = () => equippedIds().reduce((sum, id) => sum + ITEMS[id].w, 0) + modsWeight();
  // 옷 껴입기: 두께 합이 기준을 넘은 만큼 둔해진다
  const thickness = () => P().armors.reduce((sum, id) => sum + (ITEMS[id].thick || 1), 0);
  const thickOver = () => Math.max(0, thickness() - EQ.freeThickness);
  // 짐 무게 (주사기 효과로 가볍게 느낄 수 있다: weightMult)
  const weightEff = () => buffMult('weightMult');
  const carried = () => (mapWeight(P().inv) + equippedWeight() + caseWeight(P().cases)) * weightEff();
  function tierIndex() {
    const r = carried() / carryLimit();
    for (let i = 0; i < C.overweight.length; i++) if (r <= C.overweight[i].upTo + 1e-9) return i;
    return C.overweight.length - 1;
  }
  const tier = () => C.overweight[tierIndex()];
  const has = (k) => !!P().debuffs[k];
  function timeMult() {
    let m = tier().timeMult;
    if (P().stamina <= 0 && !elite('endurance')) m *= C.stamina.exhaustedTimeMult;
    if (P().fatigue >= C.fatigueSlowAt) m *= C.fatigueTimeMult;
    if (has('fracture') && !numb()) m *= DB.fracture.timeMult;
    m *= 1 + thickOver() * EQ.perTime;
    return m;
  }
  const walkMinutes = (dest) => Math.max(5, Math.round(distMin(G.loc, dest) * timeMult() * (1 - lvl('endurance') * SL.endurance.travelPerLv)));
  // 오토바이: 켜 두고 연료가 넉넉하면 짐 무게·부상과 상관없이 빨리 간다
  const bikeMinutes = (dest) => Math.max(5, Math.round(distMin(G.loc, dest) * BK.speedMult));
  const rideOk = (dest) => !!(G && G.bike && G.bike.on && !isLab(dest) && !isLab(G.loc) && G.bike.fuel + 1e-9 >= bikeMinutes(dest) / 60);
  const travelMinutes = (dest) => (rideOk(dest) ? bikeMinutes(dest) : walkMinutes(dest));
  const searchMinutes = () => Math.max(5, Math.round(C.searchMinutes * timeMult() * (has('fear') ? DB.fear.searchMult : 1) * buffMult('searchMult') * (1 - lvl('focus') * SL.focus.searchPerLv)));
  const placeName = (id) => (id === 'hideout' ? '거점' : LOC[id].name);
  const dangerOf = (id) => (id === 'hideout' ? 0 : LOC[id].danger);
  // 여러 겹이면 한 겹마다 남은 피해를 그 비율만큼 더 줄인다
  const armorDef = () => 1 - P().armors.reduce((m, id) => m * (1 - ITEMS[id].def), 1);
  const armorDbf = () => 1 - P().armors.reduce((m, id) => m * (1 - ITEMS[id].dbf), 1);
  const debuffChanceMult = () => 1 - lvl('resolve') * SL.resolve.chancePerLv;
  const debuffDurationMult = () => 1 - lvl('resolve') * SL.resolve.durationPerLv;
  const dodgeChance = () => CB.baseDodge + lvl('endurance') * SL.endurance.dodgePerLv;
  const rareMult = () => 1 + lvl('focus') * SL.focus.rarePerLv;
  const drainMult = () => 1 - lvl('metabolism') * SL.metabolism.drainPerLv;
  const foodMult = () => 1 + lvl('metabolism') * SL.metabolism.foodPerLv + (G.loc === 'hideout' && facCfg('kitchen') ? facCfg('kitchen').food || 0 : 0) + (G.loc === 'hideout' && resActive('dohyun') ? RES.dohyun.food : 0);
  // 진통 주사(모르핀 등): 골절과 부상의 불이익을 느끼지 못한다
  const numb = () => !!G && buffSum('painkill') > 0;
  const buffMult = (field) => Object.keys(P().buffs).reduce((m, id) => m * (BUFFS[id][field] != null ? BUFFS[id][field] : 1), 1);
  function buffSum(field) { return G ? Object.keys(P().buffs).reduce((a, id) => a + (BUFFS[id][field] || 0), 0) : 0; }
  // 근접 싸움: 맨손, 근접 무기, 탄약 없는 총(휘두르기)
  const isMelee = (w) => !w || !ITEMS[w].ammo || !(P().inv[ITEMS[w].ammo] > 0);
  const darkAt = (loc) => !!G && (isNight(G.time) || (isLab(loc) && !qflag('lab_power')));
  // 연구소에서 나가는 길에 만난 싸움은 바깥(낮이면 밝다)에서 벌어진다
  const roadOut = () => { const c = G.pending && G.pending.ctx; return !!(c && c.type === 'travel' && !isLab(c.dest)); };
  const inDark = () => !!G && (isNight(G.time) || (isLab(G.loc) && !qflag('lab_power') && !roadOut()));
  const searchEncounterChance = (danger, loc) => Math.min(0.95, CB.encounter[danger] * (darkAt(loc || G.loc) ? CB.nightEncounterMult : 1));
  const hasItem = (id) => (P().inv[id] || 0) > 0 || equippedIds().includes(id);
  const isUsable = (it) => !!(it.use || it.treat);
  // 쓰면 해가 될 수 있는 아이템: 식중독 확률이 기준 이상이거나, 효과가 끝날 때 반동이 있는 것
  function itemRisks(it) {
    const out = [];
    const u = it.use || {};
    if (u.poison && u.poison >= C.riskPoisonAt && !(G && elite('metabolism'))) out.push(`식중독에 걸릴 확률 ${Math.round(u.poison * (G ? debuffChanceMult() : 1) * 100)}%${it.cook ? ` (거점에서 ${cookVerb(it)[1]} 안전)` : ''}`);
    if (it.buff && BUFFS[it.buff[0]].endFatigue) out.push(`${BUFFS[it.buff[0]].name} 효과가 끝나면 피로 +${BUFFS[it.buff[0]].endFatigue} (이어 쓰면 쓴 만큼 쌓인다)`);
    return out;
  }
  const isRisky = (it) => itemRisks(it).length > 0;
  // 익히기: 마실 것은 끓이고, 먹을 것은 굽는다 [버튼, '~면', 결과 동사]
  const cookVerb = (it) => (it.cat === 'drink' ? ['끓이기', '끓이면', '끓였다'] : ['익히기', '익히면', '익혔다']);
  // 위험한 아이템은 빨간 줄에 확률을 따로 보여 주므로 회색 설명에서는 뺀다
  const useText = (it) => fxText(isRisky(it) ? { ...it.use, poison: 0 } : it.use);

  function addTo(m, id, n) {
    m[id] = (m[id] || 0) + n;
    if (m[id] <= 0) delete m[id];
  }
  function stashSlots(m = G.stash) { let s = m === G.stash ? G.stashCases.length : 0; for (const id in m) s += Math.ceil(m[id] / ITEMS[id].stack); return s; }
  function stashFit(id, want) {
    const cur = G.stash[id] || 0, stack = ITEMS[id].stack;
    const free = Math.max(0, stashCap() - stashSlots());
    const room = Math.ceil(cur / stack) * stack - cur + free * stack;
    return clamp(want, 0, room);
  }
  function carryFit(id, want) {
    const cap = carryLimit() * C.pickupHardCap - carried();
    return clamp(Math.floor((cap + 1e-6) / (ITEMS[id].w * weightEff())), 0, want);
  }
  function fxText(u) {
    const parts = [];
    if (u.hp) parts.push(`HP ${signed(u.hp)}`);
    if (u.stamina) parts.push(`스테미너 ${signed(u.stamina)}`);
    if (u.hunger) parts.push(`배고픔 ${signed(u.hunger)}`);
    if (u.thirst) parts.push(`갈증 ${signed(u.thirst)}`);
    if (u.fatigue) parts.push(`피로 ${signed(u.fatigue)}`);
    if (u.poison && !(G && elite('metabolism'))) parts.push(`식중독 위험 ${Math.round(u.poison * (G ? debuffChanceMult() : 1) * 100)}%`);
    return parts.join(' · ');
  }
  function treatText(t) {
    return Object.keys(t).map((k) => (k === 'infection' ? `감염 -${t[k]}` : `${DB[k].name} 치료`)).join(' · ');
  }
  const itemsText = (list) => list.map(([id, n]) => `${ITEMS[id].name} ${n}`).join(', ');
  function sortedIds(m) {
    return Object.keys(m).sort((a, b) => {
      const A = ITEMS[a], B = ITEMS[b];
      return (CAT_ORDER[A.cat] - CAT_ORDER[B.cat]) || (B.r - A.r) || A.name.localeCompare(B.name, 'ko');
    });
  }
  // 레어도순: 등급이 높은 것부터, 같은 등급은 종류·이름순
  const byRarity = (ids) => [...ids].sort((a, b) => (ITEMS[b].r - ITEMS[a].r) || (CAT_ORDER[ITEMS[a].cat] - CAT_ORDER[ITEMS[b].cat]) || ITEMS[a].name.localeCompare(ITEMS[b].name, 'ko'));
  const sortToggle = (act, cur, opts) => `<div class="row-btns seg sort-seg" role="group" aria-label="정렬">${opts.map(([k, name]) => btn(name, act, k, '', cur === k ? 'primary' : '')).join('')}</div>`;

  // ---------- 기록 ----------
  // 전투 중에 남긴 기록은 c: 'fight' (생존 일지 필터용)
  let logCat = null;
  function log(text, k = 'info') {
    const e = { t: G.time, text, k, ...(logCat || (G.pending && G.pending.kind === 'combat') ? { c: logCat || 'fight' } : {}) };
    G.log.push(e);
    if (G.log.length > LOG_MAX) G.log.splice(0, G.log.length - LOG_MAX);
    G.recent.push(e);
  }
  // 체력 엘리트(질긴 목숨): 하루 한 번 쓰러지지 않고 HP 1로 버틴다
  function lastStand() {
    if (!elite('vitality') || G.flags.lastStand === dayOf(G.time)) return false;
    G.flags.lastStand = dayOf(G.time);
    P().hp = 1;
    log(`[${SL.vitality.elite.name}] 눈앞이 하얘졌다가 돌아왔다. 아직 쓰러질 때가 아니다. (HP 1 · 오늘은 더 버틸 수 없다)`, 'level');
    return true;
  }
  function hurt(amount, cause) {
    const p = P();
    p.hp = clamp(p.hp - amount, 0, maxHp());
    if (p.hp <= 0 && !G.dead && !lastStand()) { G.dead = true; G.deathCause = cause; G.deathKind = 'hurt'; }
    if (!G.dead) gainXp('vitality', amount * SK.xp.hpLost);
  }
  function storyOnce(flag, text) {
    if (G.flags[flag]) return;
    G.flags[flag] = true;
    log(text, 'story');
  }

  // ---------- 스킬 ----------
  const xpNeed = (lv) => SK.xpBase + SK.xpPerLevel * lv;
  function skillEffect(k, lv = lvl(k)) {
    const c = SL[k];
    if (k === 'strength') return `근접 승률 +${lv * c.meleePerLv}% · 중량 한계 +${Math.floor(lv / c.carryEvery) * c.carryKg}kg`;
    if (k === 'endurance') return `최대 스테미너 +${Math.round(lv * c.staminaPerLv * 100)}% · 회피 ${(CB.baseDodge + lv * c.dodgePerLv).toFixed(1)}% · 이동시간 -${(lv * c.travelPerLv * 100).toFixed(1)}%`;
    if (k === 'vitality') return `최대 HP +${lv * c.hpPerLv}`;
    if (k === 'focus') return `수색시간 -${Math.round(lv * c.searchPerLv * 100)}% · 좋은 물건 +${Math.round(lv * c.rarePerLv * 100)}% · 추가 발견 ${(lv * c.extraFindPerLv * 100).toFixed(1)}% · 총 승률 +${Math.round(lv * c.gunPerLv)}%`;
    if (k === 'resolve') return `디버프 확률 -${(lv * c.chancePerLv * 100).toFixed(1)}% · 지속시간 -${Math.round(lv * c.durationPerLv * 100)}%`;
    if (k === 'metabolism') return `배고픔·갈증 소모 -${Math.round(lv * c.drainPerLv * 100)}% · 음식 효과 +${(lv * c.foodPerLv * 100).toFixed(1)}%${C.fullBuff ? ` · 배불리 먹으면 ${BUFFS[C.fullBuff.buff].name} ${fmtDur(Math.round(C.fullBuff.minutes * (1 + lv * C.fullBuff.perLv)))}` : ''}`;
    if (k === 'intellect') return `해체 수량 +${Math.round(lv * c.yieldPerLv * 100)}% · 고급 재료 회수 ${pct(rareSalvage(lv))}% · 제작·해체 시간 -${Math.round(lv * c.craftTimePerLv * 100)}%`;
    return '';
  }
  const efficiency = (today) => (today < SK.dailySoft ? 1 : Math.max(SK.minEfficiency, SK.dailySoft / today));
  function gainXp(k, raw) {
    if (!G || G.dead || !(raw > 0)) return;
    const day = dayOf(G.time);
    if (G.skillDay !== day) { G.skillDay = day; SKILL_KEYS.forEach((x) => { G.skills[x].today = 0; }); }
    const sk = G.skills[k];
    if (sk.lv >= SK.max) return;
    const gym = (k === 'strength' || k === 'endurance') && facCfg('gym') ? facCfg('gym').xpMult : 1;
    const got = raw * efficiency(sk.today) * gym * (1 + (DSR ? dsStacks() * DSR.xpPerStack : 0)) * buffMult('xpMult');
    sk.today += raw;
    sk.xp += got;
    while (sk.lv < SK.max && sk.xp >= xpNeed(sk.lv)) {
      sk.xp -= xpNeed(sk.lv);
      sk.lv += 1;
      if (k === 'vitality') P().hp = clamp(P().hp + SL.vitality.hpPerLv, 0, maxHp());
      const milestone = k === 'strength' && sk.lv % SL.strength.carryEvery === 0 ? ` 중량 한계 +${SL.strength.carryKg}kg!` : '';
      log(`${SL[k].name} LV ${sk.lv}. (${skillEffect(k)})${milestone}`, 'level');
      if (sk.lv >= SK.max && SL[k].elite) {
        log(`엘리트 스킬 · ${SL[k].elite.name}: ${SL[k].elite.desc}`, 'level');
        toast(`${SL[k].name} 엘리트! ${SL[k].elite.name}`);
      }
      G.skillNew = true;
      storyOnce('firstLevel', ST.moments.firstLevel);
    }
    if (sk.lv >= SK.max) sk.xp = 0;
  }

  // ---------- 디버프 ----------
  const debuffImmune = (type) => (type === 'fear' && elite('resolve')) || (type === 'poison' && (elite('metabolism') || buffMult('poisonMult') === 0)) || (type === 'bleed' && buffMult('bleedMult') === 0);
  function applyDebuff(type) {
    if (G.dead || debuffImmune(type)) return;
    const d = P().debuffs, cfg = DB[type];
    gainXp('resolve', SK.xp.debuff);
    if (type === 'infection') {
      if (d.infection) { d.infection.sev = Math.min(100, d.infection.sev + 15); log(cfg.worse, 'bad'); }
      else { d.infection = { sev: cfg.start }; log(cfg.onset, 'bad'); }
      return;
    }
    const left = Math.round(cfg.hours * 60 * debuffDurationMult());
    if (d[type]) { d[type].left = Math.max(d[type].left, left); return; }
    d[type] = { left };
    log(cfg.onset, 'bad');
    storyOnce('firstDebuff', ST.moments.firstDebuff);
  }
  function tryDebuff(type, p) {
    const kind = buffMult({ fear: 'fearMult', infection: 'infectMult', bleed: 'bleedMult', poison: 'poisonMult' }[type] || '-');
    if (p > 0 && chance(p * debuffChanceMult() * buffMult('dbfMult') * kind)) applyDebuff(type);
  }

  // ---------- 시간 흐름 ----------
  // road: 장소를 떠나 길 위에 있는 동안 (떠나온 곳도 지켜 주지 못한다)
  function passTime(minutes, activity, road = false) {
    const p = P(), N = C.needs;
    let stood = false;
    const before = {
      hunger: needState('hunger', p.hunger), thirst: needState('thirst', p.thirst), fatigue: needState('fatigue', p.fatigue),
      stamina: p.stamina, hp: p.hp, inf: p.debuffs.infection ? p.debuffs.infection.sev : 0,
    };
    const exert = activity === 'travel' || activity === 'search' || activity === 'fight';
    const exercising = activity === 'exercise';
    const sleeping = activity === 'sleep';
    const resting = activity === 'rest';
    const home = G.loc === 'hideout';
    const ended = [];
    const bEnded = [];
    const hmsgs = [];
    const startDay = dayOf(G.time);
    let xpCarry = 0, xpWalk = 0, lost = 0;
    let left = Math.max(0, Math.round(minutes));
    while (left > 0) {
      const dt = Math.min(10, left);
      left -= dt;
      const h = dt / 60;
      const tr = tier();
      const d = p.debuffs;
      const rate = sleeping ? N.sleepNeedsRate * (home && facCfg('bed') ? facCfg('bed').drain || 1 : 1) : 1;
      const dm = drainMult();
      p.hunger = clamp(p.hunger + N.hungerPerHour * rate * dm * buffMult('hungerMult') * h, 0, 100);
      p.thirst = clamp(p.thirst + N.thirstPerHour * rate * dm * buffMult('thirstMult') * (d.poison ? DB.poison.thirstMult : 1) * h, 0, 100);
      if (sleeping) p.fatigue = clamp(p.fatigue - N.sleepFatigueRecoverPerHour * (home ? bedFatigueMult() : 1) * h, 0, 100);
      else if (resting) p.fatigue = clamp(p.fatigue - N.restFatigueRecoverPerHour * h, 0, 100);
      else p.fatigue = clamp(p.fatigue + (exercising ? EX.fatiguePerHour : N.fatiguePerHour) * buffMult('fatigueMult') * h, 0, 100);

      const needy = p.hunger >= N.penaltyAt || p.thirst >= N.penaltyAt;
      const recov = (needy ? 0.5 : 1) * (d.poison ? DB.poison.recoverMult : 1) * buffMult('staminaRegenMult');
      const layer = 1 + thickOver() * EQ.perStamina;
      if (exert) p.stamina = clamp(p.stamina - C.stamina.exertPerHour * tr.staminaMult * buffMult('staminaDrainMult') * layer * h, 0, maxStamina());
      else if (exercising) p.stamina = clamp(p.stamina - EX.staminaPerHour * buffMult('staminaDrainMult') * layer * h, 0, maxStamina());
      else if (resting) p.stamina = clamp(p.stamina + C.stamina.restPerHour * recov * h, 0, maxStamina());
      else if (sleeping) p.stamina = clamp(p.stamina + C.stamina.sleepPerHour * recov * h, 0, maxStamina());

      let loss = 0, cause = null;
      const add = (v, c) => {
        if (Number.isNaN(v)) { console.error(`피해 계산이 NaN이다: ${c}`); return; }
        if (v > 0) { loss += v; cause = cause || c; }
      };
      if (exert && tr.hpPerHour && !elite('strength')) add(tr.hpPerHour * h, 'weight');
      if (d.bleed) {
        add(DB.bleed.hpPerHour * h, 'bleed');
        if (!d.infection) tryDebuff('infection', DB.bleed.infectPerHour * h);
        d.bleed.left -= dt;
        if (d.bleed.left <= 0) { delete d.bleed; ended.push('bleed'); }
      }
      if (d.infection) {
        // 의무실 5레벨부터 거점에서 쉬거나 자는 동안 감염이 안 퍼지고, 7레벨이면 낫는다
        const mb = home && (sleeping || resting) ? facCfg('medbay') : null;
        if (mb && mb.infection === 'heal') {
          d.infection.sev -= mb.infHeal * h;
          if (d.infection.sev <= 0) { delete d.infection; hmsgs.push([DB.infection.cured, 'good']); }
        } else if (!(mb && mb.infection === 'hold') && !(home && (sleeping || resting) && resActive('clinic'))) {
          d.infection.sev = Math.min(100, d.infection.sev + DB.infection.growPerHour * debuffDurationMult() * buffMult('infectGrow') * h);
        }
        if (d.infection) {
          const s = d.infection.sev;
          add(infectionHpPerDay(s) / 24 * h, 'infection');
        }
      }
      const starve = elite('metabolism') ? SL.metabolism.elite.starveMult : 1;
      if (p.thirst >= 100) add(N.dehydrateHpPerHour * starve * h, 'thirst');
      if (p.hunger >= 100) add(N.starveHpPerHour * starve * h, 'hunger');
      if (d.poison) {
        add(DB.poison.hpPerHour * h, 'poison');
        d.poison.left -= dt;
        if (d.poison.left <= 0) { delete d.poison; ended.push('poison'); }
      }
      if (p.fatigue >= 100) add(N.exhaustedHpPerHour * h, 'fatigue');
      if (d.fracture) {
        const heal = home && (sleeping || resting) && facLv('medbay') > 0 ? D.medbayFractureMult : 1;
        d.fracture.left -= dt * heal;
        if (d.fracture.left <= 0) { delete d.fracture; ended.push('fracture'); }
      }
      if (d.fear) {
        d.fear.left -= dt * (sleeping ? DB.fear.sleepMult : resting ? DB.fear.restMult : 1);
        if (d.fear.left <= 0) { delete d.fear; ended.push('fear'); }
      }
      if (d.nightmare) {
        d.nightmare.left -= dt;
        if (d.nightmare.left <= 0) { delete d.nightmare; ended.push('nightmare'); }
      }

      if (exert) xpCarry += SK.xp.carryPerHour * h * Math.min(1.5, carried() / carryLimit());
      if (activity === 'travel') xpWalk += SK.xp.travelPerHour * h;
      // HP는 회복에서 피해를 뺀 만큼 바뀐다: 감염·출혈 중에도 의무실·침대·버프 회복이 피해를 상쇄한다
      // (배고픔·갈증이 심하면 쉬어도 회복이 없고, 식중독이면 회복이 절반)
      let regen = buffSum('hpRegen');
      if (!needy && sleeping) regen += C.hp.sleepRegenPerHour + homeHpBonus(true);
      else if (!needy && resting) regen += C.hp.restRegenPerHour + homeHpBonus(false);
      if (d.poison) regen *= DB.poison.recoverMult;
      const net = regen * h - loss;
      if (net < 0) lost += Math.min(-net, p.hp); // 체력 경험치는 실제로 줄어든 HP만큼
      if (net) p.hp = clamp(p.hp + net, 0, maxHp());

      for (const id of Object.keys(p.buffs)) {
        p.buffs[id].left -= dt;
        if (p.buffs[id].left <= 0) {
          const crash = p.buffs[id].crash != null ? p.buffs[id].crash : BUFFS[id].endFatigue || 0;
          delete p.buffs[id];
          bEnded.push([id, crash]);
          if (crash) p.fatigue = clamp(p.fatigue + crash, 0, 100);
        }
      }

      hideoutTick(dt, hmsgs);
      G.time += dt;
      // 질긴 목숨으로 버텼으면 이 행동이 끝날 때까지는 HP 1에서 멈춘다
      if (p.hp <= 0 && (stood || (stood = lastStand()))) p.hp = Math.max(p.hp, 1);
      if (p.hp <= 0) {
        G.dead = true;
        G.deathCause = DEATH_TEXT[cause] || '쓰러졌다';
        G.deathKind = cause;
        break;
      }
    }
    checkRefill();
    checkThefts(road ? null : G.loc);
    if (G.dead) return;
    const today = dayOf(G.time);
    if (today > startDay) log(journal(today), 'story');
    for (let d = startDay + 1; d <= today; d++) residentsDaily();
    for (const [t, k] of hmsgs) log(t, k);
    gainXp('strength', xpCarry);
    gainXp('endurance', xpWalk);
    gainXp('vitality', lost * SK.xp.hpLost);
    for (const k of ended) log(DB[k].ended, 'good');
    for (const [id, crash] of bEnded) log(crash ? `${BUFFS[id].name} 효과가 끝났다. 피로가 한꺼번에 몰려온다. (피로 +${crash})` : `${BUFFS[id].name} 효과가 끝났다.`, crash ? 'warn' : 'info');
    for (const k of ['hunger', 'thirst', 'fatigue']) {
      const s = needState(k, p[k]);
      if (s > before[k] && NEED_WARN[k][s]) log(NEED_WARN[k][s], s >= 4 ? 'bad' : 'warn');
    }
    const inf = p.debuffs.infection ? p.debuffs.infection.sev : 0;
    if (before.inf < 50 && inf >= 50) log(DB.infection.at50, 'bad');
    if (before.inf < 100 && inf >= 100) log(DB.infection.at100, 'bad');
    if (before.stamina > 0 && p.stamina <= 0) log('숨이 턱까지 차오른다. 탈진했다. (행동시간 증가)', 'warn');
    if (before.hp >= 30 && p.hp < 30) log('몸 상태가 좋지 않다. 치료가 필요하다.', 'bad');
  }

  // ---------- 하이드아웃 ----------
  // 공사·제작·정수·연료는 거점을 비워도 시간이 흐르면 진행된다
  function hideoutTick(dt, msgs) {
    const H = G.hideout;
    const powered = isPowered();
    if (powered && H.fuel > 0 && !solarNow()) {
      H.fuel = Math.max(0, H.fuel - dt / 60);
      if (H.fuel <= 0) msgs.push([facCfg('generator').solar ? '거점의 발전기가 연료가 떨어졌다. 날이 밝으면 태양광으로 다시 돌아간다.' : '거점의 발전기가 연료가 떨어져 멈췄다.', 'warn']);
    }
    // 정은희와 아이들이 거들면 공사·제작·정수가 빨라진다
    const sp = resActive('kids') ? RES.kids.speed : 1;
    if (H.build) {
      H.build.left -= dt * sp;
      if (H.build.left <= 0) {
        const { id, to } = H.build;
        H.fac[id] = to;
        H.build = null;
        msgs.push([`${FAC[id].name} ${to}레벨 공사가 끝났다. (${FAC[id].levels[to - 1].effect})`, 'good']);
      }
    }
    for (const fid of Object.keys(H.crafts)) {
      const c = H.crafts[fid], R = RECIPE[c.recipe];
      if ((R.power || c.elec) && !powered) continue;
      c.left -= dt * sp;
      if (c.left <= 0) {
        let extra = 0;
        if (elite('intellect')) for (let i = 0; i < (c.count || 1); i++) if (chance(SL.intellect.elite.chance)) extra += R.out[1];
        const made = R.out[1] * (c.count || 1) + extra;
        H.ready[fid] = H.ready[fid] || {};
        addTo(H.ready[fid], R.out[0], made);
        if (c.xp) { H.readyXp = H.readyXp || {}; H.readyXp[fid] = (H.readyXp[fid] || 0) + c.xp; }
        delete H.crafts[fid];
        msgs.push([`${FAC[fid].name} 제작 완료: ${ITEMS[R.out[0]].name} ×${made}${extra ? ` (${SL.intellect.elite.name}: ${extra}개 더)` : ''}. 거점에서 받을 수 있다.`, 'good']);
        // 대기열의 다음 것을 바로 시작한다
        const q = (H.queue || {})[fid];
        if (q && q.length) {
          const n = q.shift(), NR = RECIPE[n.recipe];
          if (!q.length) delete H.queue[fid];
          H.crafts[fid] = { recipe: n.recipe, left: craftMinutes(NR, n.count), count: n.count, ...(n.xp ? { xp: n.xp } : {}), ...(n.elec ? { elec: true } : {}) };
          msgs.push([`${FAC[fid].name} 대기열: ${ITEMS[NR.out[0]].name} ×${NR.out[1] * n.count} 만들기를 시작했다. (${fmtDur(H.crafts[fid].left)})`, '']);
        }
      }
    }
    const wc = facCfg('water');
    if (wc && powered) {
      if (H.water.stored < wc.max) {
        H.water.prog += dt * sp;
        while (H.water.prog >= wc.every && H.water.stored < wc.max) { H.water.prog -= wc.every; H.water.stored += 1; }
      } else H.water.prog = 0;
    }
  }

  function upgradeBlock(fid) {
    if (G.loc !== 'hideout') return '거점에서만 할 수 있다';
    if (G.pending) return '눈앞의 상황부터 해결해야 한다';
    const lv = facLv(fid);
    if (lv >= FAC[fid].levels.length) return '최고 레벨이다';
    const H = G.hideout;
    if (H.build) return H.build.id === fid ? '공사 중이다' : '다른 공사가 진행 중이다';
    const L = FAC[fid].levels[lv];
    if (!reqMet(L.req)) return '선행 시설이 부족하다';
    if (!haveAll(L.cost)) return '재료가 부족하다';
    return '';
  }
  // 지능이 오를수록 제작·해체가 빨라진다
  const craftTimeMult = () => 1 - lvl('intellect') * SL.intellect.craftTimePerLv;
  const craftMinutes = (R, n) => Math.max(1, Math.round(R.time * n * craftTimeMult() * facSpeed(R.at)));
  // 전기로 할 수 있으면 불 피울 재료(목재)는 쓰지 않는다
  const elecFuel = (R) => !!R.fuel && isPowered();
  // 실제로 드는 재료: 전기로 하면 땔감이 빠지고, 김정우가 거점에 있으면 주사기에 의료 소모품이 덜 든다
  function recipeIn(R) {
    let list = elecFuel(R) ? R.in.filter(([id]) => id !== R.fuel) : R.in;
    if (R.at === 'medbay' && ITEMS[R.out[0]].inj && resActive('jungwoo')) list = list.map(([id, n]) => [id, id === 'medical_supplies' ? Math.max(1, n - (RES.jungwoo.injSave || 0)) : n]);
    return list;
  }
  // 가진 재료로 몇 번 만들 수 있나
  function maxBatch(rid) {
    const R = RECIPE[rid];
    return Math.min(D.craftBatchMax, ...recipeIn(R).map(([id, n]) => Math.floor(countAny(id) / n)));
  }
  const timesIn = (list, k) => list.map(([id, n]) => [id, n * k]);
  // 제작법이 함께 요구하는 다른 시설 레벨 중 모자란 것
  const recipeReqMiss = (R) => Object.entries(R.req || {}).filter(([f, lv]) => facLv(f) < lv).map(([f, lv]) => `${FAC[f].name} LV ${lv}`);
  const recipeReqText = (R) => Object.entries(R.req || {}).map(([f, lv]) => `${FAC[f].name} LV ${lv}`).join(', ');
  function craftBlock(rid, times = 1) {
    const R = RECIPE[rid];
    if (G.loc !== 'hideout') return '거점에서만 할 수 있다';
    if (G.pending) return '눈앞의 상황부터 해결해야 한다';
    if (facLv(R.at) < R.lv) return `${FAC[R.at].name} LV ${R.lv} 필요`;
    const miss = recipeReqMiss(R);
    if (miss.length) return `${miss.join(', ')} 필요`;
    if (R.needRes && !resActive(R.needRes)) return `${iga(RES[R.needRes].name)} 거점에 있어야 한다`;
    if (R.needFlag && !qflag(R.needFlag)) return '김정우의 연구를 끝까지 도와야 한다';
    if (R.needLabNotes && !labNotesDone()) return '연구소 기록 10장을 모두 모아야 한다';
    if (R.needClue && !cluesDone(R.needClue)) return `연구소에서 ${RTYPE[R.needClue].name} 단서 ${LB.clueNeed}장을 모아야 한다`;
    if (G.hideout.crafts[R.at] && queueLen(R.at) >= QMAX()) return `대기열이 가득 찼다 (${QMAX()}개)`;
    if (R.power && !isPowered()) return '전력이 필요하다';
    if (!haveAll(timesIn(recipeIn(R), times))) return '재료가 부족하다';
    return '';
  }
  // 창고에 있는 것부터 쓰고, 모자라면 소지품에서 쓴다 (장착한 장비는 쓰지 않는다). 실제로 쓴 것을 돌려준다
  function consumeItems(list) {
    const used = {};
    for (const [id, n] of list) {
      let left = n;
      for (const x of [id, ...(SUBS[id] || [])]) {
        for (const m of [G.stash, P().inv]) {
          const k = Math.min(left, m[x] || 0);
          if (k > 0) { addTo(m, x, -k); addTo(used, x, k); left -= k; }
        }
        if (left <= 0) break;
      }
    }
    return used;
  }
  // 제작 대기열: 만드는 중일 때 다음 것을 예약한다 (재료는 미리 챙긴다, 빼면 돌려받는다)
  const QMAX = () => C.craftQueue || 3;
  const queueLen = (fid) => ((G.hideout.queue || {})[fid] || []).length;
  function unqueue(fid, i) {
    const q = (G.hideout.queue || {})[fid];
    if (!G || G.loc !== 'hideout' || !q || !q[+i]) return;
    mutate(() => {
      const [x] = q.splice(+i, 1);
      if (!q.length) delete G.hideout.queue[fid];
      const spill = storeOrCarry(x.paid);
      if (x.paid.core_data) delete G.flags['q:core_used'];
      log(`${FAC[fid].name} 대기열에서 ${ITEMS[RECIPE[x.recipe].out[0]].name} 만들기를 뺐다. 재료를 돌려받았다: ${listText(x.paid)}${spill ? ' (창고가 차서 일부는 소지품으로)' : ''}`);
    });
  }
  function upgrade(fid) {
    const why = upgradeBlock(fid);
    if (why) return toast(why);
    run(() => {
      const lv = facLv(fid), L = FAC[fid].levels[lv];
      consumeItems(L.cost);
      G.hideout.build = { id: fid, to: lv + 1, left: L.time };
      log(`${FAC[fid].name} ${lv + 1}레벨 공사를 시작했다. ${fmtDur(L.time)} 뒤에 끝난다. 자리를 비워도 공사는 계속된다.`);
    });
  }
  function craft(rid, times = 1) {
    times = Math.max(1, Math.floor(times) || 1);
    const why = craftBlock(rid, times);
    if (why) return toast(why);
    run(() => {
      const R = RECIPE[rid], elec = elecFuel(R), mins = craftMinutes(R, times);
      const paid = consumeItems(timesIn(recipeIn(R), times));
      if (R.in.some(([id]) => id === 'core_data')) setQFlag('core_used');
      if (G.hideout.crafts[R.at]) {
        const Q = G.hideout.queue = G.hideout.queue || {};
        const q = Q[R.at] = Q[R.at] || [];
        q.push({ recipe: rid, count: times, paid, xp: SK.xp.craft * times, ...(elec ? { elec: true } : {}) });
        log(`${FAC[R.at].name} 대기열에 넣었다: ${ITEMS[R.out[0]].name} ×${R.out[1] * times} (${q.length}/${QMAX()}). 재료는 미리 챙겨 두었다. 앞의 제작이 끝나면 바로 시작한다.`);
        return;
      }
      // 지능 경험치는 다 만든 것을 받을 때 준다
      G.hideout.crafts[R.at] = { recipe: rid, left: mins, count: times, xp: SK.xp.craft * times, ...(elec ? { elec: true } : {}) };
      const what = `${ITEMS[R.out[0]].name} ×${R.out[1] * times}`;
      log(`${FAC[R.at].name}에서 ${what} 만들기를 시작했다.${times > 1 ? ` (${times}번 한꺼번에)` : ''}${elec ? ` 전기로 해서 ${eun(ITEMS[R.fuel].name)} 쓰지 않았다.` : ''} (${fmtDur(mins)})`);
    });
  }
  function storeOrCarry(found) {
    let spill = false;
    for (const id of Object.keys(found)) {
      const k = stashFit(id, found[id]);
      if (k > 0) addTo(G.stash, id, k);
      if (found[id] - k > 0) { addTo(P().inv, id, found[id] - k); spill = true; }
    }
    return spill;
  }
  function collect(fid) {
    const m = G.hideout.ready[fid];
    if (G.loc !== 'hideout' || !m) return;
    run(() => {
      const list = sortedIds(m).map((id) => `${ITEMS[id].name} ×${m[id]}`).join(', ');
      const spill = storeOrCarry(m);
      delete G.hideout.ready[fid];
      const RX = G.hideout.readyXp || {};
      const xp = RX[fid] || 0;
      delete RX[fid];
      gainXp('intellect', xp);
      log(`${FAC[fid].name}에서 완성품을 받았다: ${list}${spill ? ' (창고가 차서 일부는 소지품으로)' : ''}`, 'good');
    });
  }
  function collectWater() {
    const W = G.hideout.water;
    if (G.loc !== 'hideout' || !W.stored) return;
    run(() => {
      const n = W.stored;
      W.stored = 0;
      const spill = storeOrCarry({ water_bottle: n });
      log(`정수기에서 생수 ${n}병을 받았다.${spill ? ' 창고가 차서 일부는 소지품으로 옮겼다.' : ''}`, 'good');
    });
  }
  function addFuel() {
    const gc = facCfg('generator');
    if (G.loc !== 'hideout' || !gc) return;
    if (countHave('fuel') < 1) return toast('연료통이 없다.');
    if (G.hideout.fuel >= gc.tank - 0.01) return toast('연료가 가득 찼다.');
    run(() => {
      consumeItems([['fuel', 1]]);
      G.hideout.fuel = Math.min(gc.tank, G.hideout.fuel + gc.fuelHours);
      log(`발전기에 연료를 채웠다. (${Math.floor(G.hideout.fuel)}시간 분량)`, 'good');
    });
  }
  function toggleGen() {
    if (G.loc !== 'hideout' || !facLv('generator')) return;
    run(() => {
      G.hideout.genOn = !G.hideout.genOn;
      log(G.hideout.genOn ? '발전기를 켰다. 낮은 엔진 소리가 창고를 채운다.' : '발전기를 껐다. 연료를 아낀다.');
    });
  }
  // 거점에서 식중독 위험 음식을 목재로 한 번에 익힌다 (조리대가 있으면 빠르다, 전기가 있으면 목재 없이)
  function cookCount(id) { return (G.stash[id] || 0) + (P().inv[id] || 0); }
  // 익히기·끓이기 버튼은 조리대 제작법을 바로 시작하는 지름길이다. 재료·시간·작업 줄이 조리대와 같다
  // 그 음식을 익히는 조리대 제작법 (재료가 그 음식과 땔감뿐인 것)
  const cookRecipes = (id) => D.recipes.filter((R) => R.at === 'kitchen' && R.out[0] === ITEMS[id].cook[0]
    && R.in.some(([x]) => x === id) && R.in.every(([x]) => x === id || x === R.fuel || (ITEMS[id].cookWith || []).includes(x)));
  // 지금 쓸 수 있는 것 중 한 개당 땔감이 적고, 그다음 한 개당 시간이 짧은 것
  function bestCookRecipe(id) {
    const per = (R) => {
      const k = R.in.find(([x]) => x === id)[1];
      return [recipeIn(R).filter(([x]) => x !== id).reduce((a, [, n]) => a + n, 0) / k, R.time / k];
    };
    const ok = cookRecipes(id).filter((R) => R.lv <= facLv('kitchen') && (!R.power || isPowered()));
    ok.sort((a, b) => { const A = per(a), B = per(b); return A[0] - B[0] || A[1] - B[1]; });
    return ok[0] || null;
  }
  function askCook(id) {
    const it = ITEMS[id];
    if (!G || !it || !it.cook) return;
    if (G.loc !== 'hideout') return toast('거점에서만 익힐 수 있다.');
    if (G.pending) return toast('눈앞의 상황부터 해결해야 한다.');
    if (!facLv('kitchen')) return toast('조리대가 있어야 익힐 수 있다. 시설 탭에서 조리대를 짓자.');
    const R = bestCookRecipe(id);
    if (!R) return toast('지금 조리대로는 할 수 없다.');
    if (G.hideout.crafts.kitchen) return toast('조리대가 다른 걸 만드는 중이다. 끝나고 받은 뒤에 하자.');
    const times = maxBatch(R.id);
    const v = cookVerb(it), verb = v[0] === '끓이기' ? '끓인다' : '익힌다';
    if (!times) return toast(`재료가 모자라다: ${itemsText(recipeIn(R))} 필요`);
    const k = R.in.find(([x]) => x === id)[1], used = k * times, have = cookCount(id);
    const mins = craftMinutes(R, times), out = ITEMS[R.out[0]];
    showModal({
      title: `${it.name} ${used}개를 ${v[0] === '끓이기' ? '끓일까' : '익힐까'}?`,
      body: [
        `조리대 제작법 그대로 한다: ${itemsText(recipeIn(R))} → ${out.name} ${R.out[1]}${times > 1 ? ` (${times}번)` : ''}`,
        ['쓰는 것', `${itemsText(timesIn(recipeIn(R), times))}${elecFuel(R) ? ` · 전기로 해서 ${eun(ITEMS[R.fuel].name)} 쓰지 않는다` : ''}`],
        ['결과', `${out.name} ×${R.out[1] * times} · ${fmtDur(mins)} 뒤 조리대에서 받는다. 그동안 다른 일을 해도 된다.`],
        ...(used < have ? [`${have}개 중 ${used}개만 ${verb}. (${times >= D.craftBatchMax ? `한 번에 ${D.craftBatchMax}번까지` : '재료가 모자라다'})`] : []),
      ],
      buttons: [{ label: '그만둔다' }, { label: `조리대에 올린다 · ${fmtDur(mins)}`, primary: true, onClick: () => craft(R.id, times) }],
    });
  }

  function exercise() {
    const gc = facCfg('gym');
    if (!G || G.loc !== 'hideout' || !gc) return;
    if (P().stamina < EX.minStamina) return toast(`스테미너가 ${EX.minStamina} 이상 있어야 운동할 수 있다.`);
    run(() => {
      passTime(EX.minutes, 'exercise');
      if (G.dead) return;
      log(`땀이 흠뻑 날 때까지 몸을 단련했다. (${fmtDur(EX.minutes)})`);
      gainXp('strength', EX.xp * gc.exercise);
      gainXp('endurance', EX.xp * gc.exercise);
      if (gc.vitality) gainXp('vitality', EX.xp * gc.exercise);
    });
  }

  // ---------- 숨기기와 도둑 ----------
  // 날이 바뀔 때마다 숨긴 곳마다 털릴지 판정한다. 플레이어가 지금 있는 곳은 털리지 않는다 (길 위에 있으면 어디도 지켜 주지 못한다)
  function checkThefts(here = G.loc) {
    const day = dayOf(G.time);
    if (!G.lastTheftDay) G.lastTheftDay = day;
    while (G.lastTheftDay < day) {
      G.lastTheftDay += 1;
      for (const l of LOCS) {
        if (l.id === here) continue;
        const st = G.locs[l.id];
        for (const h of st.hides) {
          if (!Object.keys(h.items).length || !chance(h.risk)) continue;
          const lost = h.lost && !h.lost.seen ? h.lost.items : {};
          for (const id in h.items) addTo(lost, id, h.items[id]);
          h.lost = { items: lost, seen: false };
          h.items = {};
          h.known = true;
        }
        if (Object.keys(st.ground).length && chance(HIDE.groundTheft)) {
          st.groundLost = st.groundLost || {};
          for (const id in st.ground) addTo(st.groundLost, id, st.ground[id]);
          st.ground = {};
        }
      }
    }
  }
  const listText = (m) => sortedIds(m).map((id) => `${ITEMS[id].name} ×${m[id]}`).join(', ');
  // 다시 와 봐야 털린 걸 안다
  function reportThefts(locId) {
    const st = G.locs[locId];
    st.hides.forEach((h, i) => {
      if (!h.lost || h.lost.seen) return;
      log(`${LOC[locId].hides[i]}에 숨겨 둔 물건이 사라졌다: ${listText(h.lost.items)}. 누군가 털어 갔다. (이곳은 하루 ${pct(h.risk)}% 확률로 털린다)`, 'bad');
      h.lost.seen = true;
    });
    if (st.groundLost) {
      log(`그냥 두고 간 물건이 사라졌다: ${listText(st.groundLost)}`, 'warn');
      st.groundLost = null;
    }
  }
  // 여러 종류를 한꺼번에 옮기면 종류마다 시간이 늘어난다
  const kindsMult = (kinds) => Math.min(HIDE.kindCap, 1 + HIDE.perKind * Math.max(0, kinds - 1));
  const hideTime = (h, kinds = 1) => Math.max(5, Math.round(h.time * kindsMult(kinds) * timeMult()));
  const retrieveTime = (h, kinds = 1) => Math.max(5, Math.round(h.time * HIDE.retrieveMult * kindsMult(kinds) * timeMult()));
  const invKinds = () => Object.keys(P().inv).length;
  // 숨기고 꺼내는 동안에도 쉬는 것처럼 들킬 수 있다 (걸린 시간만큼)
  function lurkEncounter(mins) {
    const L = LOC[G.loc];
    if (chance(Math.min(1, encChance(G.loc) * CB.restMult * earRestMult() * mins / C.restMinutes))) startCombat(pickEnemy(L.danger, L.id), { type: 'rest', danger: L.danger });
  }
  function doHide(idx, src, id, n) {
    if (!G || G.loc === 'hideout') return;
    const st = G.locs[G.loc], h = st.hides[idx];
    if (!h) return;
    run(() => {
      const mins = hideTime(h, src === 'all' ? invKinds() : 1);
      passTime(mins, 'search');
      if (G.dead) return;
      const moved = {};
      if (src === 'all') {
        for (const k of Object.keys(P().inv)) addTo(moved, k, P().inv[k]);
        P().inv = {};
      } else {
        const m = src === 'ground' ? st.ground : P().inv;
        const have = m[id] || 0;
        const k = n === 'all' ? have : Math.min(1, have);
        if (k) { addTo(m, id, -k); addTo(moved, id, k); }
      }
      if (!Object.keys(moved).length) { log('숨길 물건이 없었다.'); return; }
      for (const k in moved) addTo(h.items, k, moved[k]);
      log(`${LOC[G.loc].hides[idx]}에 숨겼다: ${listText(moved)} (${fmtDur(mins)})`);
      lurkEncounter(mins);
    });
  }
  function doRetrieve(idx, id) {
    if (!G || G.loc === 'hideout') return;
    const st = G.locs[G.loc], h = st.hides[idx];
    if (!h || !Object.keys(h.items).length) return;
    run(() => {
      const ids = id === 'all' ? sortedIds(h.items) : [id];
      const mins = retrieveTime(h, ids.length);
      passTime(mins, 'search');
      if (G.dead) return;
      const taken = {};
      let left = false;
      for (const k of ids) {
        const q = carryFit(k, h.items[k] || 0);
        if (q > 0) { addTo(h.items, k, -q); addTo(P().inv, k, q); addTo(taken, k, q); }
        if (h.items[k]) left = true;
      }
      if (!Object.keys(taken).length) log('짐이 너무 무거워 아무것도 꺼내지 못했다.', 'warn');
      else log(`${LOC[G.loc].hides[idx]}에서 꺼냈다: ${listText(taken)}${left ? ' (다 들 수 없어 일부는 남겨 뒀다)' : ''} (${fmtDur(mins)})`);
      lurkEncounter(mins);
    });
  }
  function askHide(id, src) {
    if (!G || G.loc === 'hideout' || !ITEMS[id]) return;
    if (G.pending) return toast('눈앞의 상황부터 해결해야 한다.');
    const m = src === 'ground' ? G.locs[G.loc].ground : P().inv;
    const have = m[id] || 0;
    if (!have) return;
    if (have === 1) return pickSpot(src, id, '1');
    showModal({
      title: `${ITEMS[id].name}, 몇 개를 숨길까?`,
      body: [`${src === 'ground' ? '바닥에' : '소지품에'} ${have}개 있다.`],
      buttons: [{ label: '그만둔다' }, { label: '1개', onClick: () => pickSpot(src, id, '1') }, { label: `전부 (${have}개)`, primary: true, onClick: () => pickSpot(src, id, 'all') }],
    });
  }
  function pickSpotAll(i) {
    if (!G || G.loc === 'hideout' || !Object.keys(P().inv).length) return;
    const h = G.locs[G.loc].hides[i];
    showModal({
      title: `가진 것을 전부 ${LOC[G.loc].hides[i]}에 숨길까?`,
      body: [`소지품: ${listText(P().inv)}`, `${fmtDur(hideTime(h, invKinds()))} 걸린다 (종류가 많을수록 오래 걸린다). 장착한 장비는 그대로 둔다. 그동안 들킬 수도 있다.`],
      buttons: [{ label: '그만둔다' }, { label: '숨긴다', primary: true, onClick: () => doHide(i, 'all') }],
    });
  }
  function pickSpot(src, id, n) {
    const st = G.locs[G.loc];
    const what = src === 'all' ? '가진 것을 전부' : `${ITEMS[id].name} ${n === 'all' ? '전부를' : '1개를'}`;
    showModal({
      title: `${what} 어디에 숨길까?`,
      body: ['숨기는 데 걸리는 시간은 곳마다 다르다. 얼마나 잘 털리는 곳인지는 털려 봐야 안다.'],
      stack: true,
      buttons: [
        ...st.hides.map((h, i) => ({
          label: `${LOC[G.loc].hides[i]} · ${fmtDur(hideTime(h, src === 'all' ? invKinds() : 1))}${h.known ? ` · 털릴 확률 하루 ${pct(h.risk)}%` : ''}`,
          onClick: () => doHide(i, src, id, n),
        })),
        { label: '그만둔다' },
      ],
    });
  }

  function journal(day) {
    return ST.days[day] || pick(ST.dayPool).replace('{day}', day);
  }

  function checkRefill() {
    const day = dayOf(G.time);
    let any = false;
    while (day - G.lastRefillDay >= C.refill.everyDays) {
      G.lastRefillDay += C.refill.everyDays;
      for (const l of LOCS) {
        const st = G.locs[l.id];
        const was = st.spots;
        st.spots = Math.min(l.spots, st.spots + Math.ceil(l.spots * C.refill.ratio));
        if (st.spots > was) any = true;
      }
    }
    if (any) log('며칠 사이 도시 곳곳에 새로 드러난 물건이 생겼다. 털었던 지역 일부를 다시 뒤질 수 있다.');
  }

  // ---------- 행동 틀 ----------
  function run(fn, opts = {}) {
    if (!G || G.dead) return;
    if (G.pending && !opts.allowPending) { toast('눈앞의 상황부터 해결해야 한다.'); return; }
    const hadPending = !!G.pending;
    if (!opts.keepRecent) G.recent = [];
    const prevCat = logCat;
    if (G.pending && G.pending.kind === 'combat') logCat = 'fight';
    fn();
    logCat = prevCat;
    if (!G.dead) checkBonds();
    if (!G.dead && !G.pending) autoEat();
    if (G.dead) {
      G.pending = null;
      log(`${G.deathCause}.`, 'bad');
      persist(); // 쓰러진 상태로 저장해서 새로고침으로 죽음을 피할 수 없게 한다
      render();
      showDeathChoice();
      return;
    }
    if (G.loc !== 'hideout' && isNight(G.time)) storyOnce('firstNight', ST.moments.firstNight);
    // 새 위기는 어느 탭에서 시작했든 현장 화면에서 보여 준다 (지도에서 출발했다가 길에서 만나는 경우 등)
    if (G.pending && !hadPending) ui.tab = 'scene';
    persist();
    render();
    flushEnding();
    flushStarve();
    if (G.pending && !hadPending) scrollToEncounter();
    else if (opts.top) window.scrollTo(0, 0);
  }
  function mutate(fn) {
    if (!G || G.dead) return;
    if (G.pending) { toast('눈앞의 상황부터 해결해야 한다.'); return; }
    fn();
    persist();
    render();
  }

  // ---------- 물건 얻기 ----------
  function rollFinds(pool, danger, n) {
    const fac = D.dangers[danger].rarity;
    const night = isNight(G.time);
    const entries = pool
      .map(([id, w, a = 1, b = a]) => ({ id, a, b, w: w * (fac[ITEMS[id].r] || 0) * (ITEMS[id].r > 0 ? rareMult() * (night ? CB.nightLootMult : 1) : 1) }))
      .filter((e) => e.w > 0);
    const out = {};
    for (let i = 0; i < n; i++) {
      const e = weightedPick(entries);
      if (e) addTo(out, e.id, randInt(e.a, e.b));
    }
    return out;
  }
  function searchLoot(L) {
    if (!elite('focus') && chance(L.emptyChance)) return {};
    const extra = (chance(lvl('focus') * SL.focus.extraFindPerLv) ? 1 : 0) + (G.tip && G.tip.day === dayOf(G.time) && G.tip.loc === L.id ? 1 : 0);
    return rollFinds(L.loot, L.danger, randInt(L.finds[0], L.finds[1]) + extra);
  }
  // 얻은 물건을 둘 곳: 이동 중이면 짊어지고(넘치면 버림), 거점이면 창고, 그 밖엔 그 장소 바닥
  function stow(found, ctx) {
    const ids = sortedIds(found);
    if (!ids.length) return;
    const list = ids.map((id) => `${ITEMS[id].name} ×${found[id]}`).join(', ');
    if (ctx && ctx.type === 'travel') {
      let lost = false;
      for (const id of ids) {
        const k = carryFit(id, found[id]);
        if (k > 0) addTo(P().inv, id, k);
        if (k < found[id]) lost = true;
      }
      log(`얻었다: ${list}${lost ? '. 다 들 수 없어 일부는 두고 왔다.' : ''}`, 'good');
    } else if (G.loc === 'hideout') {
      let spill = false;
      for (const id of ids) {
        const k = stashFit(id, found[id]);
        if (k > 0) addTo(G.stash, id, k);
        if (found[id] - k > 0) { addTo(P().inv, id, found[id] - k); spill = true; }
      }
      log(`얻었다: ${list}${spill ? ' (창고가 차서 일부는 소지품으로)' : ''}`, 'good');
    } else {
      for (const id of ids) addTo(G.locs[G.loc].ground, id, found[id]);
      log(`찾았다: ${list}`, 'good');
    }
  }
  function lootPool(ctx) {
    return ctx.type === 'travel' || G.loc === 'hideout' ? D.roadLoot : LOC[G.loc].loot;
  }

  // ---------- 이동 · 수색 · 휴식 ----------
  function arrive(ctx) {
    const dest = ctx.dest;
    const mins = G.time - ctx.t0;
    G.loc = dest;
    if (dest === 'hideout') {
      log(`거점으로 돌아와 철문을 걸어 잠갔다. (${fmtDur(mins)} 걸림)`, 'good');
    } else {
      const st = G.locs[dest];
      log(`${LOC[dest].name}에 도착했다. (${fmtDur(mins)} 걸림)`);
      if (!st.visited) { st.visited = true; log(LOC[dest].desc); }
      reportThefts(dest);
      if (st.spots <= 0) log('이곳은 이미 다 뒤졌다.', 'warn');
    }
    ui.tab = 'scene';
    ui.sel = null;
    ui.showHides = false;
  }
  function finishCtx(ctx) {
    if (ctx.type === 'travel') arrive(ctx);
  }

  // 연구소로 갈 수 있나: 문을 찾았고, 밖에서 들어가면 출입 카드를 들고 있어야 하고, B3는 전기가 있어야 한다
  const labShown = (l) => isLab(l.id) && qflag('lab_door') && (l.floor === 1 || isLab(G.loc) || G.locs[l.id].visited);
  function labBlock(dest) {
    if (!isLab(dest)) return '';
    if (!qflag('lab_door')) return '연구소로 가는 문을 아직 못 찾았다';
    if (LOC[dest].floor >= 3 && !qflag('lab_power')) return '화물 승강기가 멈춰 있다. B1 발전실에 전기를 넣어야 한다';
    if (!isLab(G.loc) && !(P().inv.lab_card > 0)) return '온실 출입 카드를 들고 있어야 한다';
    return '';
  }
  // 출입 카드는 cardUses번 쓰면 닳는다
  function useLabCard() {
    G.cardWear += 1;
    const left = C.lab.cardUses - G.cardWear;
    if (left <= 0) {
      addTo(P().inv, 'lab_card', -1);
      G.cardWear = 0;
      log('카드를 대자 리더기가 한참 깜빡이다 겨우 초록불을 켰다. 카드가 두 동강 났다. 이 카드는 끝이다.', 'warn');
    } else log(`카드 리더기에 초록불이 들어왔다. (이 카드 남은 사용 ${left}/${C.lab.cardUses})`);
  }

  // ---------- 연구소 전용방 ----------
  // 연 방은 clear 때까지 비어 있다가 다시 잠긴다 · 빠루 경보 뒤에는 lock 때까지 카드로도 안 열린다
  const roomReady = (id) => !G.labRooms[id] || G.time >= (G.labRooms[id].clear || 0);
  const roomLocked = (id) => !!G.labRooms[id] && G.time < (G.labRooms[id].lock || 0);
  const cluesDone = (t) => (G.labClues[t] || 0) >= LB.clueNeed;
  const alarmOn = (loc) => !!(G.labAlarm && G.labAlarm.loc === loc && G.time < G.labAlarm.until);
  const cardLeft = (t) => LB.roomCardUses - (G.roomWear[t] || 0);
  // 수색하다 아직 안 연 방의 문을 찾는다 (한 층에 roomMax개까지)
  function roomRoll() {
    if (!LB || !LB.rooms || !isLab(G.loc)) return;
    if (G.labDoors.filter((id) => ROOMS[id].loc === G.loc).length >= LB.roomMax || !chance(LB.roomChance)) return;
    const can = LB.rooms.filter((r) => r.loc === G.loc && !G.labDoors.includes(r.id) && roomReady(r.id));
    if (!can.length) return;
    const r = pick(can);
    G.labDoors.push(r.id);
    log(`복도 안쪽에서 문패가 붙은 문을 찾았다. "${r.name}". ${RTYPE[r.type].color} 카드 리더기가 깜빡인다. (현장의 '굳게 닫힌 문이다.')`, 'good');
  }
  // 아직 못 모은 종류의 단서 하나. 다 모았으면 false
  function giveClue() {
    const left = Object.keys(RTYPE).filter((t) => !cluesDone(t));
    if (!left.length) return false;
    const t = pick(left), T = RTYPE[t], c = LB.clues[t][G.labClues[t] || 0];
    G.labClues[t] = (G.labClues[t] || 0) + 1;
    G.recordNew = true;
    log(`[${T.name} 단서 ${G.labClues[t]}/${LB.clueNeed}] ${c.title}. ${c.text}`, 'story');
    const R = D.recipes.find((x) => x.out[0] === T.card);
    if (cluesDone(t)) log(`이제 ${T.color} ${T.name} 카드키를 만들 수 있다. (${FAC[R.at].name} ${R.lv}레벨${R.power ? ' · 전력' : ''})`, 'good');
    return true;
  }
  function labClueRoll() {
    if (!LB || !LB.clues || !isLab(G.loc) || Object.keys(RTYPE).every(cluesDone)) return;
    if (chance(LB.clueChance) || G.clueDry + 1 >= LB.cluePity) { G.clueDry = 0; giveClue(); } else G.clueDry += 1;
  }
  // '굳게 닫힌 문이다.': 그 방의 사건을 띄운다
  function openLabDoor(id) {
    if (!G || !ROOMS[id] || !G.labDoors.includes(id) || ROOMS[id].loc !== G.loc) return;
    run(() => {
      const r = ROOMS[id];
      let text = r.door;
      if (roomLocked(id)) text += ` 리더기에 빨간 불이 고정돼 있다. 경보 뒤로 잠금 장치가 봉쇄됐다. (${fmtLeft(G.labRooms[id].lock - G.time)} 뒤 풀림)`;
      log(text, 'event');
      G.pending = { kind: 'event', id: `room:${id}`, text, ctx: { type: 'search', danger: LOC[G.loc].danger, room: id } };
    });
  }
  // 카드키로 연다: 카드가 닳고, 방 종류의 물건이 바닥에 놓인다
  function openRoom(ctx) {
    const r = ROOMS[ctx.room], T = RTYPE[r.type];
    G.roomWear[r.type] = (G.roomWear[r.type] || 0) + 1;
    if (G.roomWear[r.type] >= LB.roomCardUses) {
      G.roomWear[r.type] = 0;
      addTo(P().inv, T.card, -1);
      log(`리더기가 한참 깜빡이다 겨우 초록불을 켰다. ${T.color} 카드키의 칩이 닳았다. 이 카드는 끝이다.`, 'warn');
    } else log(`리더기에 초록불이 들어왔다. 잠금이 풀리는 소리. (${T.color} 카드 남은 사용 ${cardLeft(r.type)}/${LB.roomCardUses})`);
    log(r.open, 'good');
    const found = rollFinds([...LB.roomPools[r.type], ...(r.extra || [])], LOC[G.loc].danger, randInt(LB.roomFinds[0], LB.roomFinds[1]));
    if (Object.keys(found).length) stow(found, ctx);
    else log(pick(D.emptyLines));
    G.labDoors = G.labDoors.filter((x) => x !== r.id);
    G.labRooms[r.id] = { clear: G.time + LB.roomRelockDays * 1440, lock: 0 };
    G.stats.rooms = (G.stats.rooms || 0) + 1;
  }
  // 빠루: 열리지 않는다. 경보가 울리고 문은 봉쇄되고, 그 층에 놈들이 몰린다
  function roomAlarm(ctx, o) {
    const r = ROOMS[ctx.room], AL = LB.alarm, p = P();
    if (o.stamina) p.stamina = clamp(p.stamina + o.stamina, 0, maxStamina());
    G.labRooms[r.id] = { clear: (G.labRooms[r.id] && G.labRooms[r.id].clear) || 0, lock: G.time + AL.lockHours * 60 };
    G.labAlarm = { loc: G.loc, until: G.time + AL.hours * 60 };
    log('빠루를 문틈에 끼우고 힘을 주는 순간, 천장의 경광등이 돌기 시작했다. 문은 꿈쩍도 하지 않는다. 귀를 찢는 경보음이 층 전체에 울린다.', 'bad');
    log(`(${r.name} 잠금 장치 봉쇄 ${AL.lockHours}시간 · 이 층 경보 ${AL.hours}시간: 마주칠 확률 ×${AL.encMult})`, 'warn');
    if (chance(AL.combat)) startCombat(pick(AL.foes), ctx, { intro: '경보를 듣고 무언가 복도 끝에서 달려온다!', canFlee: true });
    else log('경보음이 놈들을 부르기 전에 서둘러 문 앞을 벗어났다.');
  }
  function travel(dest) {
    if (!G || dest === G.loc || (dest !== 'hideout' && !LOC[dest])) return;
    const why = labBlock(dest);
    if (why) return toast(why);
    run(() => {
      if (isLab(dest) && !isLab(G.loc)) useLabCard();
      const ride = rideOk(dest);
      const mins = travelMinutes(dest);
      // 연구소를 오가는 길은 바깥 길(연구소 문이 있는 곳)이다. 연구소 층 사이만 안이다
      const inside = isLab(G.loc) && isLab(dest);
      const from = inside || !isLab(G.loc) ? G.loc : G.labDoor, to = inside || !isLab(dest) ? dest : G.labDoor;
      const danger = Math.max(dangerOf(from), dangerOf(to));
      const ctx = { type: 'travel', dest, danger, t0: G.time };
      if (ride) {
        G.bike.fuel = Math.max(0, G.bike.fuel - mins / 60);
        log(`오토바이를 몰았다. (연료 ${G.bike.fuel.toFixed(1)}시간 남음 · 엔진 소리에 놈들이 돌아본다)`);
      } else {
        if (tierIndex() > 0) storyOnce('firstOverweight', ST.moments.firstOverweight);
        if (tier().hpPerHour) log('짐이 너무 무겁다. 한 걸음 한 걸음이 고통스럽다. (HP 감소)', 'warn');
      }
      passTime(mins, ride ? 'ride' : 'travel', true);
      if (G.dead) return;
      const hours = mins / 60;
      let pEnc = 1 - Math.pow(1 - CB.travelPerHour[danger], hours);
      if (isNight(G.time)) pEnc *= CB.nightEncounterMult;
      if (ride) pEnc = Math.min(0.95, pEnc * BK.noiseMult);
      pEnc *= radioEncMult();
      if (chance(pEnc)) { startCombat(pickEnemy(danger, dangerOf(to) >= dangerOf(from) && to !== 'hideout' ? to : null), ctx); return; }
      const ec = C.eventChance;
      if (!inside && chance(clamp(ec.travelPerHour * hours, ec.travelMin, ec.travelMax))) {
        const ev = rollEvent('travel', danger);
        if (ev) { startEvent(ev, ctx); if (G.pending || G.dead) return; }
      }
      arrive(ctx);
    }, { top: true });
  }

  // 그 장소의 아직 못 찾은 기록 중 가장 이른 장의 것
  function nextFragmentAt(loc) {
    return ST.fragments.filter((f) => f.loc === loc && !G.fragments.includes(f.id)).sort((a, b) => CH_INDEX[a.ch] - CH_INDEX[b.ch])[0] || null;
  }
  function foundFragment(f) {
    G.fragments.push(f.id);
    G.recordNew = true;
    const ch = ST.chapters[CH_INDEX[f.ch]];
    const th = THREAD[f.th];
    log(`[기록 ${G.fragments.length}/${ST.fragments.length} · ${th.name} · ${ch.title}] ${f.title}. ${f.text}`, 'story');
    const mine = ST.fragments.filter((x) => x.th === f.th);
    if (mine.every((x) => G.fragments.includes(x.id))) log(`${th.name}의 메모를 처음부터 끝까지 모두 모았다. '기록' 탭에서 이어 읽을 수 있다.`, 'story');
    if (G.fragments.length === ST.fragments.length) log(ST.allFragments, 'story');
    if (f.cache && !G.caches.some((c) => c.id === f.id)) {
      G.caches.push({ id: f.id, loc: f.cache.loc, place: f.cache.place, items: { ...f.cache.items } });
      log(`메모에 적힌 곳을 기억해 두었다: ${LOC[f.cache.loc].name}, ${f.cache.place}.`, 'good');
    }
  }

  // 수색하다 보면 가끔 그 장소에 남은 흔적이 눈에 들어온다 (처음 보는 것부터)
  function ambientLine(L) {
    if (!L.ambient || !L.ambient.length || !chance(ST.ambientChance)) return;
    const keys = L.ambient.map((_, i) => `${L.id}:${i}`);
    const unseen = keys.filter((k) => !G.seenAmbient.includes(k));
    const k = pick(unseen.length ? unseen : keys);
    if (!G.seenAmbient.includes(k)) G.seenAmbient.push(k);
    log(L.ambient[+k.split(':')[1]], 'story');
  }

  // 메모에 적힌 은닉처: 그 장소에 가서 뒤지면 적힌 물건이 발밑에 놓인다
  function openCache(id) {
    if (!G) return;
    const c = G.caches.find((x) => x.id === id);
    if (!c || c.loc !== G.loc) return;
    run(() => {
      passTime(ST.cacheMinutes, 'search');
      if (G.dead) return;
      const st = G.locs[G.loc];
      for (const k in c.items) addTo(st.ground, k, c.items[k]);
      G.caches = G.caches.filter((x) => x.id !== id);
      log(`${eul(c.place)} 뒤졌다. 메모에 적힌 그대로였다: ${listText(c.items)} (${fmtDur(ST.cacheMinutes)})`, 'good');
      storyOnce('firstCache', ST.moments.firstCache);
    });
  }

  // ---------- 인연: 기록 속 사람들을 만나 돕는다 ----------
  const bondDoneText = (b) => { const alt = (b.doneIf || []).find(([f]) => qflag(f)); return alt ? alt[1] : b.done; };
  function bondUnlocked(b) {
    if (b.minDay && dayOf(G.time) < b.minDay) return false;
    return b.unlock.some((u) => {
      const i = u.indexOf(':'), k = u.slice(0, i), v = u.slice(i + 1);
      return k === 'frag' ? G.fragments.includes(v) : k === 'radio' ? G.radioHeard.includes(v) : k === 'flag' ? qflag(v) : k === 'visit' ? !!(G.locs[v] && G.locs[v].visited) : false;
    });
  }
  const bondWhere = (step) => `${placeName(step.loc)}${step.hours ? ` · ${step.hours[0]}~${step.hours[1]}시` : ''}`;
  // 새로 알게 된 사람을 기록에 올린다 (행동이 끝날 때마다 확인)
  function checkBonds() {
    for (const b of BONDS) {
      if (G.bonds[b.id] || !bondUnlocked(b)) continue;
      G.bonds[b.id] = { step: 0, at: dayOf(G.time), done: false };
      G.recordNew = true;
      log(`[인연] ${b.who}: ${b.steps[0].hint} (${bondWhere(b.steps[0])})`, 'good');
    }
  }
  const bondStep = (b) => { const st = G.bonds[b.id]; return st && !st.done && !st.dead && !st.hostile ? b.steps[st.step] : null; };
  // 지금 여기서 만날 수 있으면 '', 아니면 이유
  function bondBlock(b) {
    const st = G.bonds[b.id], step = bondStep(b);
    if (!step || step.loc !== G.loc) return '여기 없다';
    if (dayOf(G.time) < st.at + (step.wait || 0)) return '아직 때가 아니다. 내일 다시 오자';
    if (b.id === 'crow' && dayOf(G.time) < (G.flags.crowFrom || 0)) return '내일부터 찾아온다';
    if (step.hours) {
      const h = hourOf(G.time);
      if (h < step.hours[0] || h >= step.hours[1]) return `${step.hours[0]}시~${step.hours[1]}시에 만날 수 있다`;
    }
    return '';
  }
  function openBondStep(b) {
    const i = G.bonds[b.id].step, step = b.steps[i];
    log(step.text, 'story');
    G.pending = { kind: 'event', id: `q:${b.id}:${i}`, text: step.text, ctx: { type: 'bond', danger: dangerOf(G.loc), bond: b.id, step: i } };
  }
  function meetBond(id) {
    const b = BOND[id];
    if (!G || !b || !G.bonds[b.id]) return;
    const why = bondBlock(b);
    if (why) return toast(why);
    run(() => openBondStep(b));
  }
  function advanceBond(id, step, how, chain) {
    const b = BOND[id], st = G.bonds[id];
    if (!st || st.done || st.step !== step) return;
    G.recordNew = true;
    if (how === 'done' || step + 1 >= b.steps.length) {
      st.done = true;
      log(`[인연] ${b.who}: ${bondDoneText(b)}`, 'good');
      return;
    }
    st.step = step + 1;
    st.at = dayOf(G.time);
    st.prog = {};
    if (chain && !bondBlock(b)) openBondStep(b);
    else log(`[인연] ${b.who}: ${b.steps[st.step].hint} (${bondWhere(b.steps[st.step])})`, 'good');
  }
  function addCache(id, cache) {
    if (G.caches.some((c) => c.id === id)) return;
    G.caches.push({ id, loc: cache.loc, place: cache.place, items: { ...cache.items } });
    log(`메모에 적힌 곳을 기억해 두었다: ${LOC[cache.loc].name}, ${cache.place}.`, 'good');
  }
  function bondBtns() {
    return BONDS.filter((b) => { const st = bondStep(b); return st && st.loc === G.loc; }).map((b) => {
      const why = bondBlock(b);
      return actBtn(b.who, why || `${bondStep(b).title} · 만나러 간다`, 'meet', b.id, why ? '' : 'on', !!why);
    }).join('');
  }
  // 이서윤의 진료소: 하루 한 번 무료로 치료
  function clinicVisit() {
    if (!G || !qflag('clinic') || !bondLive('clinic')) return;
    if (G.loc !== (G.residents.clinic ? 'hideout' : 'mart') || (G.residents.clinic && !resActive('clinic'))) return;
    if (G.flags.clinicDay === dayOf(G.time)) return toast('오늘은 이미 치료받았다. 내일 다시 오자.');
    const today = dayOf(G.time); // 치료가 끝나 자정을 넘겨도 찾아간 날로 센다
    run(() => {
      passTime(60, 'rest');
      if (G.dead) return;
      const p = P();
      p.hp = maxHp();
      for (const k of ['bleed', 'fracture', 'infection', 'poison']) delete p.debuffs[k];
      G.flags.clinicDay = today;
      log('이서윤이 상처를 꼼꼼히 소독하고 꿰맸다. "또 다치면 또 와요. 안 다치면 더 좋고요." (HP 회복 · 출혈, 골절, 감염, 식중독 치료)', 'good');
    });
  }

  // ---------- 의뢰: 인연 단계의 목표 (타르코프식) ----------
  // 단계에 obj가 있으면 목표를 채운 뒤에 보고할 수 있다 (보고 선택지는 obj: true)
  // 목표: kill(적 처치, loc·enemy로 좁힘) · search(그 장소 수색 n번) · find(그 장소 수색 중 확률 p로 찾기)
  //       place(그 장소에서 시간을 들여 하기, need 물건) · days(단계 시작 뒤 n일) · cond(조건 test)
  const bondLive = (id) => !!(G.bonds[id] && !G.bonds[id].dead && !G.bonds[id].hostile);
  // 조건: flag:플래그 · radio:키|키 · frag:기록 · fragAll · res:거주민 · fac:시설:레벨
  function testCond(t) {
    const i = t.indexOf(':'), k = i < 0 ? t : t.slice(0, i), v = i < 0 ? '' : t.slice(i + 1);
    if (k === 'flag') return qflag(v);
    if (k === 'radio') return v.split('|').some((x) => G.radioHeard.includes(x));
    if (k === 'frag') return G.fragments.includes(v);
    if (k === 'fragAll') return G.fragments.length >= ST.fragments.length;
    if (k === 'res') return !!G.residents[v];
    if (k === 'fac') { const [f, lv] = v.split(':'); return facLv(f) >= +lv; }
    return false;
  }
  const objNeed = (o) => o.n || 1;
  const objCount = (b, i) => ((G.bonds[b.id].prog || {})[i] || 0);
  function objMet(b, i) {
    const o = bondStep(b).obj[i], st = G.bonds[b.id];
    if (o.t === 'cond') return testCond(o.test);
    if (o.t === 'days') return dayOf(G.time) - st.at >= o.n;
    return objCount(b, i) >= objNeed(o);
  }
  const objAll = (b) => { const s = bondStep(b); return !s || !s.obj || s.obj.every((_, i) => objMet(b, i)); };
  function objLine(b, i) {
    const o = bondStep(b).obj[i];
    const prog = o.t === 'cond' ? '' : o.t === 'days' ? ` ${clamp(dayOf(G.time) - G.bonds[b.id].at, 0, o.n)}/${o.n}일`
      : objNeed(o) > 1 ? ` ${Math.min(objCount(b, i), objNeed(o))}/${objNeed(o)}` : '';
    return { text: `${o.label}${prog}`, met: objMet(b, i) };
  }
  function objListHtml(b) {
    const s = bondStep(b);
    if (!s || !s.obj) return '';
    return `<ul class="objs">${s.obj.map((_, i) => { const l = objLine(b, i); return `<li class="${l.met ? 'met' : ''}">${l.met ? '✓' : '·'} ${esc(l.text)}</li>`; }).join('')}</ul>`;
  }
  function countObj(b, i, o) {
    const st = G.bonds[b.id];
    st.prog = st.prog || {};
    st.prog[i] = (st.prog[i] || 0) + 1;
    if (o.flag) setQFlag(o.flag);
    G.recordNew = true;
    log(`[의뢰] ${b.who}: ${o.label}${objNeed(o) > 1 ? ` ${Math.min(st.prog[i], objNeed(o))}/${objNeed(o)}` : ' 완료'}`, 'good');
    if (objAll(b)) log(`[의뢰] ${b.who}: 목표를 모두 채웠다. ${bondWhere(bondStep(b))}에서 보고하자.`, 'good');
  }
  // 행동이 끝날 때 의뢰 목표를 센다 (kill · search · find)
  function questEvent(kind, info) {
    for (const b of BONDS) {
      if (!bondLive(b.id)) continue;
      const step = bondStep(b);
      if (!step || !step.obj) continue;
      step.obj.forEach((o, i) => {
        if (o.t !== kind || objMet(b, i)) return;
        if (o.loc && o.loc !== info.loc) return;
        if (kind === 'kill' && (ENEMIES[info.enemy].npc || (o.enemy && ![].concat(o.enemy).includes(info.enemy)))) return;
        if (kind === 'find' && !chance(o.p)) return;
        if (o.text) log(o.text, 'story');
        countObj(b, i, o);
      });
    }
  }
  // 그 장소에서 할 수 있는 의뢰 일 (place)
  function placeTargets() {
    const out = [];
    for (const b of BONDS) {
      const step = bondLive(b.id) && bondStep(b);
      if (!step || !step.obj) continue;
      step.obj.forEach((o, i) => { if (o.t === 'place' && o.loc === G.loc && !objMet(b, i)) out.push({ b, o, i }); });
    }
    return out;
  }
  function placeBtns() {
    return placeTargets().map(({ b, o, i }) => {
      const ok = !o.need || o.need.every(([k, n]) => needCount(k) >= n);
      const need = o.need ? ` · ${o.need.map(([k, n]) => `${needName(k)} ${needCount(k)}/${n}`).join(', ')}` : '';
      return actBtn(`의뢰 · ${o.label}`, `${b.who} · ${fmtDur(o.minutes || 20)}${need}`, 'qplace', `${b.id}:${i}`, ok ? 'on' : '', !ok);
    }).join('');
  }
  function doPlace(key) {
    const [id, si] = String(key).split(':');
    const t = G && placeTargets().find((x) => x.b.id === id && x.i === +si);
    if (!t) return;
    const { b, o, i } = t;
    if (o.need && !o.need.every(([k, n]) => needCount(k) >= n)) return toast('필요한 물건이 없다.');
    run(() => {
      const mins = Math.max(5, Math.round((o.minutes || 20) * timeMult()));
      passTime(mins, 'search');
      if (G.dead) return;
      if (o.need) giveNeed(o.need);
      if (o.text) log(`${o.text} (${fmtDur(mins)})`, 'story');
      countObj(b, i, o);
      lurkEncounter(mins);
    });
  }

  // ---------- 어두운 선택: 인연을 해친다 ----------
  function killNpc(id) {
    const st = G.bonds[id];
    if (!st || st.dead) return;
    st.dead = true;
    G.recordNew = true;
    delete G.residents[id];
    G.stats.npcKills = (G.stats.npcKills || 0) + 1;
    setQFlag(`killed_${id}`);
    log(`[인연] ${BOND[id].who}: 내 손으로 끝냈다. (사람을 해친 수 ${G.stats.npcKills})`, 'bad');
    if (G.stats.npcKills >= (END.fallenKills || 3)) queueEnding('fallen');
  }

  // ---------- 오토바이 ----------
  function giveBike() {
    if (G.bike) return;
    G.bike = { fuel: BK.startFuel, on: true };
    log(`오토바이를 얻었다. 지도에서 타고 다니기를 켜고 끌 수 있다. 연료 ${BK.startFuel}시간 · 연료통 1개 = ${BK.perFuel}시간 · 이동 시간 ×${BK.speedMult}`, 'good');
  }
  const fuelHave = () => (P().inv.fuel || 0) + (G.loc === 'hideout' ? G.stash.fuel || 0 : 0);
  function bikeFuel() {
    if (!G || !G.bike) return;
    if (!fuelHave()) return toast(G.loc === 'hideout' ? '연료통이 없다.' : '들고 있는 연료통이 없다.');
    if (G.bike.fuel >= BK.tank - 0.05) return toast('탱크가 가득 찼다.');
    mutate(() => {
      if (G.loc === 'hideout') consumeItems([['fuel', 1]]); else addTo(P().inv, 'fuel', -1);
      G.bike.fuel = Math.min(BK.tank, G.bike.fuel + BK.perFuel);
      log(`오토바이에 연료를 넣었다. (${G.bike.fuel.toFixed(1)}/${BK.tank}시간)`, 'good');
    });
  }
  function bikeToggle() {
    if (!G || !G.bike) return;
    G.bike.on = !G.bike.on;
    persist();
    render();
  }
  function bikeSection() {
    if (!G.bike) return '';
    const B = G.bike;
    return `<div class="bike-row"><div><b>오토바이</b> <span class="note">연료 ${B.fuel.toFixed(1)}/${BK.tank}시간 · 이동 시간 ×${BK.speedMult} · 길에서 만날 확률 ×${BK.noiseMult}</span></div>
      <div class="row-btns">${btn(B.on ? '타고 다니기: 켜짐' : '타고 다니기: 꺼짐', 'bikeToggle', '', '', B.on ? 'primary' : '')}${btn(`연료 넣기 · 연료통 ${fuelHave()}`, 'bikeFuel', '', '', '', !fuelHave() || B.fuel >= BK.tank - 0.05)}</div></div>`;
  }

  // ---------- 거주민: 거점에 들인 사람들 ----------
  // 무리마다 침실의 방 하나 (with가 있으면 그 사람의 방을 같이 쓴다). 먹을 것·물은 직접 골라서 준다. 모자라면 도움이 멈추고, 며칠 굶으면 떠난다
  const capacity = () => (RES_CFG.rooms || [])[facLv('bed') - 1] || 0;
  const usedSlots = () => Object.keys(G.residents || {}).filter((id) => RES[id] && !RES[id].with).length;
  const resActive = (id) => !!(G && G.residents && G.residents[id] && !G.residents[id].hungry && bondLive(id));
  function inviteBlock(id) {
    const R = RES[id];
    if (!R) return '함께 지낼 수 없다';
    if (G.residents[id]) return '이미 거점에 있다';
    if ((G.stats.npcKills || 0) > 0) return '사람을 해쳤다는 소문 때문에 따라오지 않는다';
    if (R.with) { if (!G.residents[R.with]) return `${iga(RES[R.with].name)} 먼저 거점에 있어야 한다`; }
    else if (usedSlots() + 1 > capacity()) return `침실에 빈 방이 없다 (방 ${usedSlots()}/${capacity()}개)`;
    return '';
  }
  function moveIn(id) {
    const R = RES[id];
    G.residents[id] = { since: dayOf(G.time), food: R.eat * 2, water: R.drink * 2, hungry: 0 };
    G.recordNew = true;
    setQFlag(`res_${id}`);
    log(`[거주민] ${R.name}: 거점으로 옮겨 왔다. 이틀 치 먹을 것과 물은 챙겨 왔다. (${R.buff})`, 'good');
  }
  // 날이 바뀔 때마다: 먹고 마시고, 도움을 준다
  // 날이 바뀔 때 하루치를 먹는다. 먹고 나서 내일 먹을 것·물이 떨어졌으면 그날 알림이 뜨고,
  // 다음 자정까지 받지 못하면 떠난다 (예전 세이브에서 이미 굶던 사람도 알림을 받은 것으로 친다)
  function residentsDaily() {
    const starving = [], autoFed = {};
    const topUp = (id) => { if (!autoFeedOn()) return; const u = feedPlan(1, [G.stash], false, id).used; for (const k in u) addTo(autoFed, k, u[k]); };
    for (const id of Object.keys(G.residents)) {
      const r = G.residents[id], R = RES[id];
      if (!r) continue;
      if (!(r.food >= R.eat && r.water >= R.drink)) topUp(id);
      if (r.food >= R.eat && r.water >= R.drink) {
        r.food -= R.eat; r.water -= R.drink;
        r.hungry = 0;
        topUp(id);
        r.out = r.food < R.eat || r.water < R.drink;
        if (r.out) starving.push(R.name);
        continue;
      }
      if (!r.out && !r.hungry) {
        r.out = true;
        starving.push(R.name);
        continue;
      }
      delete G.residents[id];
      setQFlag(`left_${id}`);
      G.flags[`leftWhy:${id}`] = 'hunger';
      log(`[거주민] ${R.name}: 먹을 것과 물이 떨어진 뒤 하루 동안 받지 못해 거점을 떠났다. ${ro(LOC[R.home].name)} 돌아갔다. 그곳에서 다시 데려올 수 있다.`, 'bad');
      // 방을 같이 쓰던 사람도 따라 나간다
      for (const o of Object.keys(G.residents)) {
        if (RES[o] && RES[o].with === id) { delete G.residents[o]; setQFlag(`left_${o}`); G.flags[`leftWhy:${o}`] = `with:${id}`; log(`[거주민] ${RES[o].name}: ${eul(R.name)} 따라 거점을 떠났다.`, 'bad'); }
      }
    }
    if (Object.keys(autoFed).length) log(`[거주민] 자동 배식: 창고에서 ${listText(autoFed)}를 꺼내 나눠 줬다.`);
    if (starving.length) {
      log(`[거주민] 공동체 중 누군가 굶주리고 있습니다: ${starving.join(', ')}. 먹을 것과 물이 떨어졌다. 자정이 지나기 전에 나눠 주지 않으면 거점을 떠난다.`, 'bad');
      starveAlert = { day: dayOf(G.time), names: [...new Set([...(starveAlert ? starveAlert.names : []), ...starving])] };
    }
    if (resActive('dj')) {
      G.tip = { day: dayOf(G.time), loc: pick(OUT_LOCS).id };
      log(`[거주민] 한지수: "오늘 들어온 소식이에요. ${LOC[G.tip.loc].name}에 물건이 꽤 남아 있대요." (오늘 그곳 수색 때 하나 더)`, 'good');
    }
    if (resActive('dohyun')) {
      const found = rollFinds(D.roadLoot, 1, randInt(1, 2)), got = {};
      for (const k in found) { const n = stashFit(k, found[k]); if (n > 0) { addTo(G.stash, k, n); addTo(got, k, n); } }
      if (Object.keys(got).length) log(`[거주민] 김도현이 밤새 주변을 뒤져 가져왔다: ${listText(got)} (창고)`, 'good');
    }
  }
  function residentsSection() {
    const ids = Object.keys(G.residents);
    const away = awayPeople();
    const gone = away.filter((a) => a.left), waiting = away.filter((a) => notMovedIn(a.id));
    const goneNote = (gone.length ? `<p class="note bad-text">거점을 떠난 사람: ${gone.map((a) => `${esc(a.name)}(${esc(a.where)}에서 다시 데려올 수 있다)`).join(', ')}</p>` : '')
      + (waiting.length ? `<p class="note">의뢰는 끝났지만 아직 거점에 오지 않은 사람: ${waiting.map((a) => `${esc(a.name)}(${esc(a.where)}에서 데려올 수 있다)`).join(', ')}</p>` : '');
    if (!ids.length) return goneNote ? `<section class="section"><div class="section-head"><h2>거주민</h2><span class="meta">침실 방 0/${capacity()}개</span></div>${goneNote}</section>` : '';
    const rows = ids.map((id) => {
      const r = G.residents[id], R = RES[id];
      const fd = Math.floor(r.food / R.eat), wd = Math.floor(r.water / R.drink);
      const left = Math.min(fd, wd);
      const state = left < 1 ? `<span class="chip bad">굶주림${r.out || r.hungry ? ' · 자정에 떠난다' : ''}</span>` : left < 2 ? '<span class="chip warn">내일부터 굶는다</span>' : '<span class="chip ok">든든함</span>';
      return `<li class="item"><div class="item-main"><div class="item-name"><span class="rdot good-dot"></span>${esc(R.name)} ${state}</div>
        <div class="item-meta">먹을 것 ${fd}일치 · 물 ${wd}일치 (하루 ${R.eat}개·${R.drink}개) · ${esc(R.buff)}</div></div>
        <div class="item-btns">${btn('음식 주기', 'feedRes', id, 'food', fd < 2 ? 'primary' : '')}${btn('물 주기', 'feedRes', id, 'water', wd < 2 ? 'primary' : '')}</div></li>`;
    }).join('');
    const home = G.loc === 'hideout';
    const af = C.autoFeed;
    const tools = `<div class="row-btns">${btn('모두에게 나눠 주기', 'feedAll', '', '', 'primary', !home)}${autoFeedOk() ? btn(autoFeedOn() ? '자동 배식 켜짐' : '자동 배식 꺼짐', 'toggleAutoFeed', '', '', autoFeedOn() ? 'on' : '') : ''}</div>
      <p class="note">${autoFeedOk() ? (autoFeedOn() ? '자동 배식: 날이 바뀔 때 하루치가 모자라면 창고에서 꺼내 먹는다.' : '자동 배식이 꺼져 있다.') : af ? `${esc(FAC[af.fac].name)} LV ${af.lv}부터 자동 배식(창고에서 알아서 꺼내 먹기)을 켤 수 있다.` : ''}</p>`;
    return `<section class="section" id="residents"><div class="section-head"><h2>거주민</h2><span class="meta">침실 방 ${usedSlots()}/${capacity()}개 · 직접 먹을 것과 물을 나눠 준다</span></div>${tools}<ul class="items">${rows}</ul>${goneNote}</section>`;
  }
  // 거주민이 가진 먹을 것·물로 버틸 날수 (적은 쪽)
  const resDays = (id) => { const r = G.residents[id], R = RES[id]; return Math.min(Math.floor(r.food / R.eat), Math.floor(r.water / R.drink)); };
  // 나눠 줄 것 고르기: 식중독 위험 없는 것 → 흔한 것 → 앞의 곳(창고) 먼저. 잠근 소지품은 쓰지 않는다
  function feedPool(cat, srcs) {
    const out = [];
    for (const m of srcs) for (const id of Object.keys(m)) if (ITEMS[id] && ITEMS[id].cat === cat && m[id] > 0 && !(m === P().inv && P().locked[id])) out.push({ id, m });
    return out.sort((a, b) => (isRisky(ITEMS[a.id]) - isRisky(ITEMS[b.id])) || (ITEMS[a.id].r - ITEMS[b.id].r) || (srcs.indexOf(a.m) - srcs.indexOf(b.m)));
  }
  // 모두(또는 한 사람)가 days일치를 갖도록 하루치씩 돌아가며 고르게 나눠 준다. dry면 계산만
  function feedPlan(days, srcs, dry, only) {
    const pools = { food: feedPool('food', srcs), water: feedPool('drink', srcs) };
    const left = new Map([...pools.food, ...pools.water].map((x) => [x, x.m[x.id]]));
    const ids = (only ? [only] : Object.keys(G.residents)).filter((id) => G.residents[id]);
    const have = Object.fromEntries(ids.map((id) => [id, { food: G.residents[id].food, water: G.residents[id].water }]));
    const used = {};
    let short = false;
    for (let d = 1; d <= days; d++) for (const id of ids) {
      const R = RES[id];
      for (const [kind, per] of [['food', R.eat], ['water', R.drink]]) {
        while (have[id][kind] < per * d) {
          const x = pools[kind].find((y) => left.get(y) > 0);
          if (!x) { short = true; break; }
          left.set(x, left.get(x) - 1);
          have[id][kind] += 1;
          used[x.id] = (used[x.id] || 0) + 1;
          if (!dry) addTo(x.m, x.id, -1);
        }
      }
    }
    if (!dry) for (const id of ids) Object.assign(G.residents[id], have[id]);
    return { used, short, n: Object.values(used).reduce((a, b) => a + b, 0) };
  }
  function feedAll() {
    if (!G || G.loc !== 'hideout' || !Object.keys(G.residents).length) return;
    if (G.pending) return toast('눈앞의 상황부터 해결해야 한다.');
    const srcs = [G.stash, P().inv];
    const opts = [1, 3, 7].map((days) => ({ days, plan: feedPlan(days, srcs, true) }));
    showModal({
      title: '모두에게 나눠 주기',
      body: ['거주민 모두가 정한 날수만큼 먹을 것과 물을 갖도록 고르게 나눠 준다. 식중독 위험이 없는 것, 흔한 것부터 창고에서 먼저 꺼낸다. 잠근 소지품은 쓰지 않는다.',
        ['지금', Object.keys(G.residents).map((id) => `${RES[id].name} ${resDays(id)}일치`).join(', ')]],
      stack: true,
      buttons: [...opts.map(({ days, plan }) => ({ label: `${days}일치까지 채우기 · ${plan.n ? listText(plan.used) : '더 줄 필요 없다'}${plan.short ? ' (모자람)' : ''}`, primary: days === 3, onClick: () => feedAllDo(days) })), { label: '그만둔다' }],
    });
  }
  function feedAllDo(days) {
    if (!G || G.loc !== 'hideout') return;
    mutate(() => {
      const r = feedPlan(days, [G.stash, P().inv], false);
      if (r.n) log(`[거주민] 모두에게 ${days}일치까지 나눠 줬다: ${listText(r.used)}${r.short ? ' (모자라서 다 채우지 못했다)' : ''}`, r.short ? 'warn' : 'good');
      else toast('이미 다들 넉넉하다.');
    });
  }
  // 자동 배식 (조리대 레벨부터): 날이 바뀔 때 하루치가 모자라면 창고에서 꺼내 먹는다
  const autoFeedOk = () => !!C.autoFeed && facLv(C.autoFeed.fac) >= C.autoFeed.lv;
  const autoFeedOn = () => autoFeedOk() && !G.flags.autoFeedOff;
  // 줄 음식·물 고르기 (창고 먼저, 그다음 소지품)
  function feedRes(id, kind) {
    const R = RES[id];
    if (!G || !G.residents[id] || G.loc !== 'hideout') return;
    const cat = kind === 'water' ? 'drink' : 'food';
    const ids = [...new Set([...Object.keys(G.stash), ...Object.keys(P().inv)])].filter((x) => ITEMS[x].cat === cat && countHave(x) > 0).sort((a, b) => ITEMS[a].r - ITEMS[b].r);
    if (!ids.length) return toast(kind === 'water' ? '줄 마실 것이 없다.' : '줄 먹을 것이 없다.');
    const r = G.residents[id];
    showModal({
      title: `${R.name}에게 ${kind === 'water' ? '물' : '먹을 것'}을`,
      body: [`하나에 하루치 1개분. 지금 ${kind === 'water' ? `물 ${Math.floor(r.water / R.drink)}일치` : `먹을 것 ${Math.floor(r.food / R.eat)}일치`} (하루 ${kind === 'water' ? R.drink : R.eat}개)`],
      stack: true,
      buttons: [...ids.map((x) => ({ label: `${ITEMS[x].name} · ${countHave(x)}개 있음`, onClick: () => giveRes(id, kind, x) })), { label: '그만둔다' }],
    });
  }
  function giveRes(id, kind, item) {
    if (!G.residents[id] || !(countHave(item) > 0)) return;
    mutate(() => {
      consumeItems([[item, 1]]);
      G.residents[id][kind === 'water' ? 'water' : 'food'] += 1;
      toast(`${RES[id].name}에게 ${eul(ITEMS[item].name)} 주었다.`);
    });
    feedRes(id, kind);
  }
  // 굶어서 떠난 거주민을 다시 데려온다 (그 사람이 돌아간 곳에서, 하루치 먹을 것·물을 건네고)
  // 의뢰는 끝났는데 거점에 들어온 적이 없는 사람: 예전 버전에서 끝낸 의뢰 (그때는 끝나도 옮겨 오지 않았다).
  // 지금은 의뢰 끝이 곧 거점으로 옮겨 오는 것이라, 그곳에서 데려올 수 있게 한다 (방을 같이 쓰는 사람은 함께 오는 사람을 따라온다)
  const INVITE_BONDS = new Set(BONDS.filter((b) => b.steps.some((st) => (st.choices || []).some((c) => c.outcome && c.outcome.invite === b.id))).map((b) => b.id));
  const notMovedIn = (id) => !!(RES[id] && !RES[id].with && INVITE_BONDS.has(id) && G.bonds[id] && G.bonds[id].done && bondLive(id) && !G.residents[id] && !qflag(`left_${id}`));
  function reinviteTargets() {
    return Object.keys(RES).filter((id) => G.loc === RES[id].home && !G.residents[id] && ((qflag(`left_${id}`) && bondLive(id) && G.bonds[id].done) || notMovedIn(id)));
  }
  function reinviteBtns() {
    return reinviteTargets().map((id) => {
      const R = RES[id], why = inviteBlock(id);
      if (notMovedIn(id)) return actBtn(`${R.name} 거점으로 데려오기`, why || `의뢰는 끝났지만 아직 거점에 오지 않았다 · 방 1개 · 30분`, 'reinvite', id, why ? '' : 'on', !!why);
      const food = needCount('@food'), water = needCount('@water');
      const ok = !why && food >= R.eat && water >= R.drink;
      return actBtn(`${R.name} 다시 데려오기`, why || `먹을 것 ${food}/${R.eat} · 물 ${water}/${R.drink}을 건네고`, 'reinvite', id, ok ? 'on' : '', !ok);
    }).join('');
  }
  function reinvite(id) {
    if (!reinviteTargets().includes(id) || inviteBlock(id)) return;
    const R = RES[id], fresh = notMovedIn(id);
    if (!fresh && (needCount('@food') < R.eat || needCount('@water') < R.drink)) return toast('먹을 것과 물이 모자라다.');
    run(() => {
      if (!fresh) giveNeed([['@food', R.eat], ['@water', R.drink]]);
      passTime(30, 'idle');
      if (G.dead) return;
      // 처음 옮겨 오면 의뢰 끝에서 옮겨 올 때와 같은 표시를 남긴다 (예: 한지수의 방송이 거점에서 나온다)
      if (fresh) for (const st of BOND[id].steps) for (const c of st.choices || []) if (c.outcome && c.outcome.invite === id && c.outcome.flag) setQFlag(c.outcome.flag);
      delete G.flags[`q:left_${id}`];
      delete G.flags[`leftWhy:${id}`];
      moveIn(id);
    });
  }

  // ---------- 의뢰인과 거래 (신뢰가 쌓일수록 늘어난다) ----------
  // bond.shop = [{ at, give, get }]: at = 그 단계에 이르렀거나 지났으면 (완료면 단계 수). 같은 거래는 하루 한 번
  // bond.stock이 있으면 날마다 그만큼만 무작위로 내놓는다 (까마귀)
  const trustOf = (b) => { const st = G.bonds[b.id]; return st ? (st.done ? b.steps.length : st.step) : -1; };
  // 그 사람을 지금 여기서 만날 수 있나 (거래용): 거주민이면 거점, 완료했으면 home, 아니면 지금 단계의 장소
  function npcWhere(b) {
    const st = G.bonds[b.id];
    if (!bondLive(b.id)) return null;
    if (G.residents && G.residents[b.id]) return 'hideout';
    if (st.done) return b.leaves ? null : b.home;
    return b.steps[st.step].loc;
  }
  function npcHere(b) {
    if (npcWhere(b) !== G.loc) return false;
    const h = b.hours;
    if (h && !(G.residents && G.residents[b.id])) { const hr = hourOf(G.time); if (hr < h[0] || hr >= h[1]) return false; }
    if (b.id === 'crow' && dayOf(G.time) < (G.flags.crowFrom || 0)) return false;
    return true;
  }
  function shopOffers(b) {
    if (!b.shop) return [];
    const lv = trustOf(b);
    let list = b.shop.map((o, i) => ({ ...o, i })).filter((o) => lv >= (o.at || 0) && (!o.flag || qflag(o.flag)));
    // 플래그로 열린 거래(인식표)는 날마다 고르는 물건과 따로 늘 내놓는다
    const fixed = list.filter((o) => o.flag);
    list = list.filter((o) => !o.flag);
    if (b.stock) {
      const day = dayOf(G.time);
      // 날이 바뀌거나 신뢰가 올라 고를 수 있는 물건이 늘면 다시 고른다
      if (!G.crowStock || G.crowStock.day !== day || G.crowStock.lv !== lv) {
        const pool = list.map((o) => o.i), idx = [];
        while (idx.length < b.stock && pool.length) idx.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
        G.crowStock = { day, lv, idx };
      }
      list = list.filter((o) => G.crowStock.idx.includes(o.i));
    }
    return [...list, ...fixed];
  }
  // 오늘 그 거래를 몇 번 했나 · 하루에 몇 번 할 수 있나 · 신뢰가 높을수록 주는 물건이 줄어든다
  const BT = C.bondTrade || { perLv: 0, maxTimes: 1, discountPerLv: 0, minMult: 1 };
  const shopCount = (b, i) => { const u = G.shopUsed[b.id]; return u && u.day === dayOf(G.time) ? u.used.filter((x) => x === i).length : 0; };
  // fixed: 신뢰가 쌓여도 하루 한 번, 할인 없이 (까마귀의 인식표 거래)
  const shopTimes = (b, o) => (o.fixed ? 1 : Math.min(BT.maxTimes, 1 + Math.max(0, trustOf(b) - (o.at || 0)) * BT.perLv));
  const shopUsedToday = (b, i) => shopCount(b, i) >= shopTimes(b, b.shop[i]);
  const shopMult = (b, o) => (o.fixed ? 1 : Math.max(BT.minMult, 1 - BT.discountPerLv * Math.max(0, trustOf(b) - (o.at || 0))));
  const shopGive = (b, o) => o.give.map(([id, n]) => [id, Math.max(1, Math.round(n * shopMult(b, o)))]);
  // 거래를 열 때 한마디 (까마귀는 가끔 소문을 흘린다)
  // 조건이 붙은 문장: 그냥 문자열이거나 { text, if, unless, res(거주민이 있을 때), noRes(없을 때) }
  const lineOk = (x) => typeof x === 'string' || ((!x.if || allFlags(x.if)) && (!x.unless || !anyFlag(x.unless)) && (!x.res || !!G.residents[x.res]) && (!x.noRes || !G.residents[x.noRes]));
  const lineText = (x) => (typeof x === 'string' ? x : x.text);
  function shopLine(b) {
    const rumors = (b.rumors || []).filter(lineOk);
    if (rumors.length && chance(b.rumorChance || 0)) return `[소문] "${pick(rumors).text}"`;
    const talk = (b.talk || []).filter(lineOk);
    return talk.length ? `"${lineText(pick(talk))}"` : '';
  }
  const haveForTrade = (give) => give.every(([id, n]) => (G.loc === 'hideout' ? countHave(id) : P().inv[id] || 0) >= n);
  // ---------- 물물교환: 지금 여기서 거래할 수 있는 사람을 한 창에 모은다 (사람은 탭으로 고른다) ----------
  const tradersHere = () => BONDS.filter((b) => b.shop && npcHere(b) && shopOffers(b).length);
  const shopLeft = (b) => shopOffers(b).reduce((a, o) => a + Math.max(0, shopTimes(b, o) - shopCount(b, o.i)), 0);
  function shopBtns() {
    const list = tradersHere();
    if (!list.length) return '';
    const left = list.reduce((a, b) => a + shopLeft(b), 0);
    return actBtn('물물교환', `${list.map((b) => b.who).join(' · ')} · 오늘 ${left}개 남음`, 'shop', '', left ? 'on' : '', false);
  }
  let shopTab = null; // 마지막으로 본 탭
  function openShop(id, line) {
    if (!G) return;
    const list = tradersHere();
    if (!list.length) { if (modalOpen() && $('#trade-win')) { $('#modal').hidden = true; $('#modal').innerHTML = ''; } return; }
    if (G.pending) return toast('눈앞의 상황부터 해결해야 한다.');
    const b = list.find((x) => x.id === id) || list.find((x) => x.id === shopTab) || list[0];
    shopTab = b.id;
    let say = line != null ? line : shopLine(b);
    // 정체를 밝히는 순간 (까마귀: 인식표를 처음 들고 오면)
    if (line == null && b.reveal && !qflag(b.reveal.flag) && countHave(b.reveal.need) > 0) {
      setQFlag(b.reveal.flag);
      G.recordNew = true;
      say = `[정체] ${b.reveal.text}`;
      persist();
    }
    const offers = shopOffers(b);
    const next = (b.shop || []).map((o) => o.at || 0).filter((a) => a > trustOf(b)).sort((x, y) => x - y)[0];
    if (say && line == null) log(`${b.who}: ${say}`, say.startsWith('[소문]') ? 'story' : '');
    const info = `신뢰 ${Math.max(0, trustOf(b))}/${b.steps.length}. 신뢰가 쌓일수록 같은 거래를 하루에 여러 번 할 수 있고, 예전부터 하던 거래는 값이 싸진다.${next != null ? ' 의뢰를 더 들어주면 거래가 늘어난다.' : ''}${G.loc === 'hideout' ? ' 창고에 있는 것도 쓴다.' : ''}`;
    const rows = offers.map((o) => {
      const give = shopGive(b, o), times = shopTimes(b, o), used = shopUsedToday(b, o.i), ok = !used && haveForTrade(give);
      const cheap = shopMult(b, o) < 1 && give.some(([, n], k) => n < o.give[k][1]);
      return { o, ok, used, label: `${itemsText(o.get)}개 받기 · ${itemsText(give)}개 주기${cheap ? ' (단골 할인)' : ''} · 오늘 ${shopCount(b, o.i)}/${times}${used ? ' · 오늘은 끝' : ok ? '' : ' · 부족하다'}` };
    });
    const tabs = list.length < 2 ? '' : `<div class="row-btns seg trade-tabs" role="tablist" aria-label="거래할 사람">${list.map((t) => `<button type="button" class="btn ${t === b ? 'primary' : ''}" role="tab" aria-selected="${t === b}" data-mt="${t.id}">${esc(t.who)} <span class="trade-n">${shopLeft(t)}</span></button>`).join('')}</div>`;
    const m = $('#modal');
    m.innerHTML = `<div class="modal" id="trade-win" role="dialog" aria-modal="true" aria-labelledby="m-title">
      <h2 id="m-title">물물교환</h2>
      ${tabs}
      <div class="m-body"><p><b>${esc(gwa(b.who))} 거래</b></p>${say ? `<p>${esc(say)}</p>` : ''}<p class="note">${esc(info)}</p></div>
      <div class="row-btns stack">${rows.map((r) => `<button type="button" class="btn ${r.ok ? 'primary' : ''}" data-mo="${r.o.i}">${esc(r.label)}</button>`).join('')}<button type="button" class="btn" data-mi="close">그만둔다</button></div>
    </div>`;
    m.hidden = false;
    m.onclick = (e) => {
      const t = e.target.closest('[data-mt]'), o = e.target.closest('[data-mo]');
      if (t) return openShop(t.dataset.mt);
      if (o) {
        const r = rows.find((x) => x.o.i === +o.dataset.mo);
        if (!r) return;
        if (r.ok) return buyOffer(b.id, r.o.i, say);
        toast(r.used ? '오늘은 더 바꿀 수 없다.' : '바꿀 물건이 부족하다.');
        return;
      }
      if (e.target === m || e.target.closest('[data-mi="close"]')) { m.hidden = true; m.innerHTML = ''; }
    };
    const first = m.querySelector('[data-mt].primary') || m.querySelector('.btn');
    if (first) first.focus();
  }
  function buyOffer(id, i, line) {
    const b = BOND[id], o = b.shop[i];
    if (!npcHere(b) || shopUsedToday(b, i) || !shopOffers(b).some((x) => x.i === i)) return;
    const give = shopGive(b, o);
    if (!haveForTrade(give)) return;
    mutate(() => {
      if (G.loc === 'hideout') consumeItems(give);
      else for (const [x, n] of give) addTo(P().inv, x, -n);
      const day = dayOf(G.time);
      const u = G.shopUsed[id] && G.shopUsed[id].day === day ? G.shopUsed[id] : (G.shopUsed[id] = { day, used: [] });
      u.used.push(i);
      stow(Object.fromEntries(o.get), { type: 'search' });
      log(`${gwa(b.who)} 거래했다: ${itemsText(give)} → ${itemsText(o.get)}`, 'good');
    });
    openShop(id, line || '');
  }

  // ---------- 연구소 '온실'로 가는 길 ----------
  const labNoteText = (n) => (n.id === 'lab9' ? LB.doorHint[G.labDoor] : n.text);
  const labNotesDone = () => !!LB && G.labNotes.length >= LB.notes.length;
  // 세상에 하나뿐인 물건이 어딘가에 남아 있나 (소지품, 창고, 케이스, 바닥, 숨긴 곳)
  function ownsAnywhere(id) {
    if ((P().inv[id] || 0) + (G.stash[id] || 0) > 0) return true;
    if ([...P().cases, ...G.stashCases].some((c) => c.items[id])) return true;
    return Object.values(G.locs).some((st) => (st.ground[id] || 0) > 0 || st.hides.some((h) => (h.items[id] || 0) > 0));
  }
  function labRoll(found) {
    if (!LB) return;
    if (isLab(G.loc)) {
      // B3 서버실: 핵심 연구 데이터 (전기가 있어야)
      if (G.loc === 'lab3' && qflag('lab_power') && !qflag('core_used') && !ownsAnywhere('core_data')) {
        if (chance(LB.coreChance) || G.coreDry + 1 >= LB.corePity) {
          G.coreDry = 0;
          addTo(found, 'core_data', 1);
          G.recordNew = true;
          log('전기가 들어온 서버 랙 하나에서 초록 불이 깜빡인다. "LS-7 원본 배양 기록 · 백업 디스크". 세상에 하나뿐인 데이터다. 무엇에 쓸지는 하나만 고를 수 있다.', 'story');
        } else G.coreDry += 1;
      }
      // 김정우의 연구 일지
      const page = (LB.journal || []).find((j) => j.floor === LOC[G.loc].floor && !G.jwJournal.includes(j.id));
      if (page && chance(LB.journalChance)) {
        G.jwJournal.push(page.id);
        G.recordNew = true;
        log(`[김정우의 연구 일지 ${G.jwJournal.length}/${LB.journal.length}] ${page.title}. ${page.text}`, 'story');
      }
      roomRoll();
      labClueRoll();
    }
    // 군사기지: 쪽지 (pity번 연속으로 못 찾으면 다음엔 반드시)
    if (G.loc === 'base' && !labNotesDone()) {
      if (chance(LB.noteChance) || G.labDry + 1 >= LB.notePity) {
        G.labDry = 0;
        const n = LB.notes[G.labNotes.length];
        G.labNotes.push(n.id);
        G.recordNew = true;
        log(`[연구소 기록 ${G.labNotes.length}/${LB.notes.length}] ${n.title}. ${labNoteText(n)}`, 'story');
        if (labNotesDone()) log('연구소 기록을 모두 모았다. 거점 사람들에게 보여 주며 물어보자. (거점 현장 화면)', 'good');
      } else G.labDry += 1;
    }
    if (!qflag('lab_answer')) return;
    // 병원·군사기지: 키카드 파편
    if (LB.fragLocs.includes(G.loc)) {
      if (chance(LB.fragChance) || G.labFragDry + 1 >= LB.fragPity) {
        G.labFragDry = 0;
        addTo(found, 'keycard_frag', 1);
        log('쓰러진 연구원의 목에서 부서진 보안 카드 조각을 떼어 냈다. (키카드 파편)', 'story');
      } else G.labFragDry += 1;
    }
    // 이번 게임의 문
    if (G.loc === G.labDoor && !qflag('lab_door') && chance(LB.doorChance)) {
      setQFlag('lab_door');
      G.recordNew = true;
      log(LB.doorFind[G.loc], 'story');
      log(`연구소로 가는 문을 찾았다. 온실 출입 카드를 들고 있으면 ${LOC[G.loc].name}에서 내려갈 수 있다.`, 'good');
    }
  }
  // 거점에서 사람들에게 묻기 (답을 아는 사람이 없으면 까마귀가 값을 받고 알려 준다)
  function labAskBtn() {
    if (!LB || G.loc !== 'hideout' || !labNotesDone() || qflag('lab_answer')) return '';
    return actBtn('연구소 기록을 보여 주며 묻기', '거점 사람들에게 · 30분', 'labAsk', '', 'on');
  }
  function labAsk() {
    if (!G || G.loc !== 'hideout' || !labNotesDone() || qflag('lab_answer')) return;
    const A = LB.ask;
    let body = [];
    let crowOk = false, soloOk = false;
    run(() => {
      passTime(30, 'idle');
      if (G.dead) return;
      for (const id of Object.keys(G.residents)) if (A.lines[id] && bondLive(id)) body.push([RES[id].name, A.lines[id]]);
      if (G.residents[A.answer] && bondLive(A.answer)) {
        body.push([RES[A.answer].name, A.answerText]);
        setQFlag('lab_answer');
        G.recordNew = true;
        log(`[연구소] ${RES[A.answer].name}: ${A.answerText}`, 'story');
        log('병원과 군사기지를 수색하다 보면 키카드 파편이 나온다. 넷을 모아 작업대(5레벨, 전력)에서 출입 카드를 만들자.', 'good');
      } else {
        body.push('아무도 확실히 아는 사람이 없다.');
        // 까마귀마저 없으면 오래 걸려도 혼자 기록을 맞춰 본다 (길이 막히지 않게)
        soloOk = !!G.bonds.crow && !bondLive('crow');
        crowOk = bondLive('crow') && npcHere(BOND.crow);
        body.push(crowOk ? '까마귀라면 뭔가 알고 있을지도 모른다. 값은 받겠지만.'
          : soloOk ? '물어볼 사람이 없다. 오래 걸리더라도 혼자 기록을 맞춰 보는 수밖에 없다.'
          : qflag('crow_mark') ? '까마귀라면 알지도 모른다. 까마귀가 오는 낮에 다시 물어보자.'
          : '고물상 까마귀라면 알지도 모른다. 아직은 까마귀와 연이 닿지 않았다.');
      }
    });
    if (!body.length || !G || G.dead) return;
    const price = A.crowPrice;
    showModal({
      title: '연구소 기록에 대해 묻다',
      body,
      stack: true,
      buttons: [
        ...(crowOk ? [{ label: `까마귀에게 값을 치르고 묻는다 · ${itemsText(price)}`, primary: true, onClick: labAskCrow }] : []),
        ...(soloOk ? [{ label: `혼자 기록을 맞춰 본다 · ${fmtDur(A.soloMinutes)}`, primary: true, onClick: labSolo }] : []),
        { label: '닫는다', primary: !crowOk && !soloOk },
      ],
    });
  }
  function labAskCrow() {
    if (!G || qflag('lab_answer') || !npcHere(BOND.crow) || !bondLive('crow')) return;
    if (!haveAll(LB.ask.crowPrice)) return toast(`값이 모자라다: ${itemsText(LB.ask.crowPrice)}`);
    mutate(() => {
      consumeItems(LB.ask.crowPrice);
      setQFlag('lab_answer');
      G.recordNew = true;
      log(`[연구소] 까마귀: ${LB.ask.crowText}`, 'story');
      log('병원과 군사기지를 수색하다 보면 키카드 파편이 나온다. 넷을 모아 작업대(5레벨, 전력)에서 출입 카드를 만들자.', 'good');
    });
    showModal({ title: '까마귀의 이야기', body: [LB.ask.crowText], buttons: [{ label: '닫는다', primary: true }] });
  }
  function labSolo() {
    if (!G || G.loc !== 'hideout' || !labNotesDone() || qflag('lab_answer') || !G.bonds.crow || bondLive('crow')) return;
    run(() => {
      passTime(LB.ask.soloMinutes, 'idle');
      if (G.dead) return;
      setQFlag('lab_answer');
      G.recordNew = true;
      log(`[연구소] ${LB.ask.soloText}`, 'story');
      log('병원과 군사기지를 수색하다 보면 키카드 파편이 나온다. 넷을 모아 작업대(5레벨, 전력)에서 출입 카드를 만들자.', 'good');
    });
  }
  // 기록 탭: 연구소로 가는 길
  function labRecords() {
    const n = G.labNotes.length, total = LB.notes.length;
    const frags = countHave('keycard_frag'), cards = countHave('lab_card');
    const step = (done, label, sub) => `<li class="${done ? 'met' : ''}">${done ? '✓ ' : '· '}${esc(label)}${sub ? ` <span class="note">${esc(sub)}</span>` : ''}</li>`;
    const steps = [
      step(n >= total, `군사기지에서 연구소 기록 모으기 ${n}/${total}`, n >= total ? '' : '기지를 수색하다 보면 나온다'),
      step(qflag('lab_answer'), '거점 사람들에게 묻기', qflag('lab_answer') ? '' : n >= total ? '거점 현장 화면에서' : '기록을 다 모은 뒤'),
      step(cards > 0 || G.cardWear > 0 || frags >= LB.fragNeed, `키카드 파편 ${Math.min(frags, LB.fragNeed)}/${LB.fragNeed}`, qflag('lab_answer') ? '병원·군사기지 수색 중' : ''),
      step(cards > 0, `온실 출입 카드 ${cards}장`, cards ? `지금 카드 남은 사용 ${LB.cardUses - G.cardWear}/${LB.cardUses}` : '작업대 5레벨 · 전력'),
      step(qflag('lab_door'), qflag('lab_door') ? `연구소로 가는 문: ${LOC[G.labDoor].name}` : '연구소로 가는 문 찾기', qflag('lab_door') ? '' : G.labNotes.includes('lab9') ? '비상 통로 안내 쪽지에 적힌 곳' : ''),
      step(qflag('lab_power'), 'B1 발전실에 전기 넣기', qflag('lab_power') ? '' : `연료통 ${C.lab.powerFuel}개 · 불이 켜지고 B3로 내려갈 수 있다`),
      step(qflag('core_used') || ownsAnywhere('core_data'), qflag('core_used') ? '핵심 연구 데이터 · 이미 썼다' : '핵심 연구 데이터', qflag('core_used') || ownsAnywhere('core_data') ? '' : 'B3 서버실에서, 전기를 살린 뒤'),
    ];
    const pages = (LB.journal || []).filter((j) => G.jwJournal.includes(j.id));
    const notes = LB.notes.filter((x) => G.labNotes.includes(x.id)).map((x, i) => `<li class="frag"><span class="frag-title">${i + 1}. ${esc(x.title)}</span><p class="frag-text">${esc(labNoteText(x))}</p></li>`).join('');
    return `<section class="section"><div class="section-head"><h2>연구소로 가는 길</h2><span class="meta">${esc(LB.name)}</span></div>
      <ul class="objs lab-steps">${steps.join('')}</ul>
      ${notes ? `<ul class="frags">${notes}</ul>` : '<p class="empty">아직 연구소 기록이 없다.</p>'}
      ${(qflag('core_used') || ownsAnywhere('core_data')) && !qflag('core_used') ? '<p class="note">핵심 데이터의 쓸 곳은 하나만 고를 수 있다: 한지수에게 넘겨 방송하거나(진실), PMC에게 넘겨 헬기를 타거나(거래), 김정우와 치료제를 만든다(의무실 7레벨).</p>' : ''}
      ${roomRecords()}
      ${pages.length ? `<div class="section-head"><h2>김정우의 연구 일지</h2><span class="meta">${pages.length}/${LB.journal.length}</span></div><ul class="frags">${pages.map((j) => `<li class="frag"><span class="frag-title">${esc(j.title)}</span><p class="frag-text">${esc(j.text)}</p></li>`).join('')}</ul>` : ''}</section>`;
  }

  // 기록 탭: 전용방 카드키와 단서
  function roomRecords() {
    if (!LB.rooms || (!isLab(G.loc) && !Object.values(G.labClues).some((n) => n > 0) && !G.labDoors.length && !Object.keys(G.labRooms).length)) return '';
    const rows = Object.entries(RTYPE).map(([t, T]) => {
      const n = G.labClues[t] || 0, have = countHave(T.card);
      const rooms = LB.rooms.filter((r) => r.type === t).map((r) => r.name).join('·');
      const sub = `${rooms} · 단서 ${n}/${LB.clueNeed}${cluesDone(t) ? ' · 작업대에서 만들 수 있다' : ''}${have ? ` · 가진 카드 ${have}장 (지금 카드 남은 사용 ${cardLeft(t)}/${LB.roomCardUses})` : ''}`;
      return `<li class="${have ? 'met' : ''}">${have ? '✓ ' : '· '}${esc(`${T.color} ${T.name} 카드키`)} <span class="note">${esc(sub)}</span></li>`;
    }).join('');
    const clues = Object.entries(RTYPE).flatMap(([t, T]) => LB.clues[t].slice(0, G.labClues[t] || 0).map((c, i) => `<li class="frag"><span class="frag-title">${esc(`${T.name} 단서 ${i + 1}`)} · ${esc(c.title)}</span><p class="frag-text">${esc(c.text)}</p></li>`)).join('');
    const doors = G.labDoors.map((id) => `${ROOMS[id].name}(${LOC[ROOMS[id].loc].name.split(' · ')[0]})`).join(', ');
    return `<div class="section-head"><h2>전용방과 카드키</h2><span class="meta">연 방 ${G.stats.rooms || 0}번</span></div>
      <p class="note">연구소를 수색하다 보면 잠긴 전용방을 찾는다. 방 종류에 맞는 카드키로만 열린다. 단서를 ${LB.clueNeed}장 모으면 그 카드키를 작업대에서 만들 수 있다.${doors ? ` 찾아 둔 문: ${esc(doors)}` : ''}</p>
      <ul class="objs lab-steps">${rows}</ul>
      ${clues ? `<ul class="frags">${clues}</ul>` : ''}`;
  }

  function useCoreData(from) {
    if (from === 'inv') addTo(P().inv, 'core_data', -1); else consumeItems([['core_data', 1]]);
    setQFlag('core_used');
  }
  function truthEnding() {
    if (!G || G.loc !== 'hideout' || !G.residents.dj || !bondLive('dj') || countHave('core_data') < 1 || qflag('core_used') || G.pending) return;
    confirmBox('진실', '핵심 데이터를 한지수에게 넘겨 세상에 알린다. 데이터는 하나뿐이라 거래나 치료제에는 더 쓸 수 없다. 엔딩을 본 뒤 계속하거나 새로 시작할 수 있다.', '넘긴다', () => {
      useCoreData('any');
      log('한지수에게 핵심 연구 데이터를 넘겼다.', 'story');
      showEnding('truth');
    });
  }
  function dealEnding() {
    const pd = G && G.pending, E = pd && pd.kind === 'combat' && ENEMIES[pd.enemy];
    if (!E || !E.pmc || !(P().inv.core_data > 0) || qflag('core_used')) return;
    confirmBox('거래', '핵심 데이터를 PMC에게 넘기고 그들의 헬기로 혼자 떠난다. 아무도 데려가지 못한다. 엔딩을 본 뒤 계속하거나 새로 시작할 수 있다.', '넘긴다', () => {
      G.pending = null;
      useCoreData('inv');
      log('PMC에게 핵심 연구 데이터를 넘겼다.', 'story');
      showEnding('deal');
    });
  }
  function sealLab() {
    if (!G || G.loc !== 'lab3' || !qflag('lab_power') || G.pending) return;
    if (!C.lab.sealNeed.every(([id, n]) => (P().inv[id] || 0) >= n)) return toast(`필요하다: ${itemsText(C.lab.sealNeed)}`);
    confirmBox('온실을 봉인한다', '발전기를 과부하시키고 화약으로 서버실과 시료실을 무너뜨린다. 승강기는 위로 가지 않는다. 엔딩을 본 뒤 새로 시작하거나, 악몽에서 깨어나 계속할 수 있다.', '봉인한다', () => {
      for (const [id, n] of C.lab.sealNeed) addTo(P().inv, id, -n);
      showEnding('seal');
    });
  }
  function subjectEnding() {
    if (!G || G.loc !== 'lab3' || !qflag('lab_power') || G.pending) return;
    confirmBox('LS-7 원본', '시료실에 남은 LS-7 원본을 내 몸에 주사한다. 되돌릴 수 없다. 엔딩을 본 뒤 새로 시작하거나, 악몽에서 깨어나 계속할 수 있다.', '주사한다', () => showEnding('subject'));
  }
  function labPower() {
    if (!G || G.loc !== 'lab1' || qflag('lab_power')) return;
    if ((P().inv.fuel || 0) < C.lab.powerFuel) return toast(`연료통 ${C.lab.powerFuel}개가 필요하다.`);
    run(() => {
      passTime(30, 'idle');
      if (G.dead) return;
      addTo(P().inv, 'fuel', -C.lab.powerFuel);
      setQFlag('lab_power');
      G.recordNew = true;
      log('발전기가 기침하듯 몇 번 털털거리다 돌기 시작했다. 복도 형광등이 하나씩 켜진다. 저 아래에서 화물 승강기가 움직이는 소리가 난다.', 'good');
    });
  }

  // ---------- 고물상 까마귀: 쪽지 3장을 모아 철문에 표식을 그리면 날마다 찾아온다 ----------
  const crowNotes = () => G.flags.crowNotes || 0;
  function crowNoteRoll() {
    if (qflag('crow_mark') || crowNotes() >= 3 || !chance(CROW.noteChance || 0)) return null;
    G.flags.crowNotes = crowNotes() + 1;
    log(CROW.notes[crowNotes() - 1], 'story');
    return 'crow_note';
  }
  function crowMarkBtn() {
    if (qflag('crow_mark') || G.loc !== 'hideout' || countHave('crow_note') < 3) return '';
    return actBtn('철문에 까마귀 표식 그리기', `쪽지 3장대로 · ${fmtDur(CROW.markMinutes || 20)}`, 'crowMark', '', 'on');
  }
  function crowMark() {
    if (!G || qflag('crow_mark') || G.loc !== 'hideout' || countHave('crow_note') < 3) return;
    run(() => {
      passTime(CROW.markMinutes || 20, 'idle');
      if (G.dead) return;
      consumeItems([['crow_note', 3]]);
      setQFlag('crow_mark');
      G.flags.crowFrom = dayOf(G.time) + 1;
      log(CROW.markText, 'story');
    });
  }

  // ---------- 탈출: 병원·군사기지·라디오의 단서를 모으면 남부 사령부와 교신할 수 있다 ----------
  const clueRadio = () => ESC.radioKeys.some((k) => G.radioHeard.includes(k));
  const clueList = () => [{ name: ESC.radioName, got: clueRadio() }, ...ESC.clues.map((c) => ({ name: c.name, got: qflag(c.flag) }))];
  const cluesAll = () => clueList().every((c) => c.got);
  function clueRoll() {
    if (!clueRadio()) return;
    for (const c of ESC.clues) {
      if (G.loc !== c.loc || qflag(c.flag) || !chance(ESC.findChance)) continue;
      setQFlag(c.flag);
      log(c.text, 'story');
      log(`[탈출 단서] ${eul(c.name)} 손에 넣었다. (${clueList().filter((x) => x.got).length}/${clueList().length})`, 'good');
    }
  }
  function escapeBtns() {
    if (G.loc !== 'hideout') return '';
    if (qflag('escape_ready')) return !escapeOpen() ? '' : actBtn('탈출', '남부 사령부의 수송에 합류할지 정한다', 'escape', '', 'on');
    if (cluesAll()) return actBtn('남부 사령부와 교신', `${fmtDur(ESC.contactMinutes)} · 탈출 단서 ${clueList().length}/${clueList().length}`, 'contact', '', 'on');
    return '';
  }
  function contactCommand() {
    if (!G || G.loc !== 'hideout' || !cluesAll() || qflag('escape_ready')) return;
    run(() => {
      passTime(ESC.contactMinutes, 'idle');
      if (G.dead) return;
      setQFlag('escape_ready');
      G.recordNew = true;
      log(ESC.contactText, 'story');
    });
  }
  const residentNames = () => Object.keys(G.residents).map((id) => RES[id].name);
  // 거점(철문 집)을 떠난 까닭. 지금 거점에 있거나 떠난 적이 없으면 ''
  function leftReason(id) {
    const R = RES[id];
    if (!R || G.residents[id] || !qflag(`left_${id}`)) return '';
    const day = G.flags[`q:left_${id}`], when = typeof day === 'number' ? `${day}일차` : '';
    // 예전 세이브에는 까닭이 없다: 같은 날 함께 방을 쓰던 사람이 떠났으면 따라간 것
    const why = G.flags[`leftWhy:${id}`] || (R.with && G.flags[`q:left_${R.with}`] === day ? `with:${R.with}` : 'hunger');
    const home = LOC[R.home] ? LOC[R.home].name : '원래 있던 곳';
    if (why.startsWith('with:')) {
      const host = RES[why.slice(5)];
      return `${when ? `${when}, ` : ''}${host ? eul(host.name) : '함께 지내던 사람을'} 따라 거점을 떠났다. ${home}에서 ${host ? eul(host.name) : '그들을'} 먼저 다시 데려오면 함께 올 수 있다.`;
    }
    return `${when ? `${when}, ` : ''}먹을 것과 물이 떨어진 뒤 하루 동안 받지 못해 ${ro(home)} 돌아갔다. ${home}에서 다시 데려올 수 있다.`;
  }
  // 만난 적 있는데 지금 거점에 없는 사람: 탈출 때 같이 못 간다. 까닭과 다시 데려오는 길
  function awayPeople() {
    const out = [];
    for (const id of Object.keys(RES)) {
      const R = RES[id], b = BOND[id], st = G.bonds[id];
      if (G.residents[id] || !b || !st || !bondLive(id) || (id === 'jungwoo' && qflag('jungwoo_left'))) continue;
      const left = qflag(`left_${id}`);
      if (st.done && !left && !notMovedIn(id)) continue;
      const loc = left ? R.home : (bondStep(b) && bondStep(b).loc) || b.home || R.home;
      const where = LOC[loc] ? LOC[loc].name : '거점 밖';
      const kills = (G.stats.npcKills || 0) > 0;
      const now = left ? `먹을 것과 물이 떨어져 ${ro(where)} 돌아갔다` : st.done ? `의뢰는 끝났지만 아직 ${where}에 있다` : `아직 ${where}에 있다`;
      const how = kills ? '사람을 해쳤다는 소문 때문에 따라오지 않는다' : left ? '그곳에서 다시 데려오면 함께 간다' : st.done ? '그곳에서 거점으로 데려오면 함께 간다' : '의뢰를 마치고 거점으로 데려와야 함께 간다';
      out.push({ id, name: R.name, left, where, text: `${now}. ${how}` });
    }
    return out;
  }
  function askEscape() {
    if (!G || G.loc !== 'hideout' || !escapeOpen()) return;
    if (G.pending) return toast('눈앞의 상황부터 해결해야 한다.');
    const names = residentNames();
    const away = awayPeople();
    const mc = G.hideout.crafts.medbay;
    const cureNote = cureOk() ? '치료제 시제품을 가지고 김정우와 함께 떠난다.'
      : cureHeld() ? '치료제 시제품이 있지만, 김정우가 없으면 남쪽에서 치료제를 완성할 사람이 없다.'
      : mc && mc.recipe === 'r_cure' ? '의무실에서 치료제를 합성하는 중이다. 지금 떠나면 두고 가야 한다.' : '';
    showModal({
      title: '떠날까, 남을까',
      body: [ESC.decideText, ['함께 갈 사람', names.length ? names.join(', ') : '없다. 거점에서 함께 지내는 사람만 같이 갈 수 있다.'],
        ...away.map((a) => [`못 데려가는 사람 · ${a.name}`, a.text]), ...(cureNote ? [cureNote] : []), '어느 쪽을 골라도 엔딩을 본 뒤 계속하거나 새로 시작할 수 있다. 남으면 나중에 마음을 바꿔 떠날 수도 있다.'],
      buttons: [{ label: '아직 정하지 않는다' }, { label: '남는다', onClick: () => escapeChoice(false) }, { label: '떠난다', primary: true, onClick: () => escapeChoice(true) }],
    });
  }
  const saviorOk = () => BONDS.every((b) => G.bonds[b.id] && G.bonds[b.id].done && bondLive(b.id)) && (END.saviorResidents || []).every((id) => G.residents[id]);
  // 치료제 시제품 (의무실에서 아직 안 꺼낸 것까지) · 남쪽에서 완성할 김정우가 함께 가야 치료제 엔딩
  const cureHeld = () => countHave('cure_proto') > 0 || ((G.hideout.ready.medbay || {}).cure_proto || 0) > 0;
  const cureOk = () => cureHeld() && !!G.residents.jungwoo;
  // 남기로 했으면 나중에 다시 정할 수 있다. 떠난 뒤에도 치료제를 들고 다시 떠날 수 있다
  const escapeOpen = () => qflag('escape_ready') && (!qflag('escape_done') || (cureOk() && !G.endings.includes('cure')));
  function escapeChoice(leave) {
    if (!G || !escapeOpen()) return;
    if (leave) setQFlag('escape_done');
    setQFlag(leave ? 'escaped' : 'stayed');
    persist();
    showEnding(leave ? (cureOk() ? 'cure' : saviorOk() ? 'savior' : 'departed') : 'survivor');
  }

  // ---------- 엔딩 ----------
  const ENDING_KEY = 'ruin-hideout.endings.v1';
  const endingRecords = () => { try { return JSON.parse(localStorage.getItem(ENDING_KEY) || '{}') || {}; } catch (e) { return {}; } };
  function recordEnding(id) {
    const rec = endingRecords();
    if (!rec[id]) rec[id] = Date.now();
    try { localStorage.setItem(ENDING_KEY, JSON.stringify(rec)); } catch (e) { /* 저장소 막힘 */ }
  }
  let endingQueue = null;
  function queueEnding(id) { endingQueue = id; }
  // 굶주림 알림: 거주민의 먹을 것·물이 떨어진 날 한 번 띄운다 (다른 창이 떠 있으면 다음 행동 뒤로 미룬다)
  let starveAlert = null;
  function flushStarve() {
    if (!starveAlert || !G || G.dead || modalOpen()) return;
    const a = starveAlert;
    starveAlert = null;
    const still = a.names.filter((n) => Object.keys(G.residents).some((id) => RES[id].name === n && G.residents[id].out));
    if (!still.length) return;
    const home = G.loc === 'hideout';
    showModal({
      title: '굶주림',
      body: ['공동체 중 누군가 굶주리고 있습니다.', ['먹을 것·물이 떨어진 사람', still.join(', ')], `자정이 지나기 전에 ${home ? '거주민 목록에서' : '거점에 돌아가'} 먹을 것과 물을 나눠 주지 않으면 거점을 떠난다.`],
      buttons: home ? [{ label: '확인' }, { label: '거주민 보기', primary: true, onClick: () => { ui.tab = 'scene'; render(); scrollToEncounter('residents'); } }] : [{ label: '확인', primary: true }],
    });
  }
  function flushEnding() {
    if (!endingQueue || !G) return;
    const id = endingQueue;
    endingQueue = null;
    showEnding(id);
  }
  const DREAM_ENDINGS = ['turned', 'seal', 'subject'];
  const DREAM_CAUSE = { seal: '무너지는 온실에 남았다', subject: 'LS-7 원본을 스스로 맞았다' };
  function showEnding(id) {
    const E = END.list[id];
    if (!E || !G) return;
    // 몸을 잃는 엔딩은 저장하기 전에 쓰러진 것으로 해 둔다 (새로고침으로 피할 수 없게)
    if (DREAM_CAUSE[id] && !G.dead) { G.dead = true; G.deathCause = DREAM_CAUSE[id]; G.deathKind = id; G.pending = null; }
    recordEnding(id);
    if (!G.endings.includes(id)) G.endings.push(id);
    persist();
    // 이미 본문에 나오는 사람은 '함께' 목록에서 뺀다 (예: 진실 엔딩의 한지수)
    const names = Object.keys(G.residents).filter((rid) => !(E.skipRes || []).includes(rid)).map((rid) => RES[rid].name);
    const body = E.paragraphs.filter(lineOk).map(lineText);
    if (E.withPeople && names.length) body.push(E.withPeople.replace('{names}', names.join(', ')));
    else if (E.alone && !names.length) body.push(E.alone);
    body.push(...(E.after || []));
    if (E.journalAfter && LB && (LB.journal || []).every((j) => G.jwJournal.includes(j.id))) body.push(E.journalAfter);
    if (E.fallenAfter && (G.stats.npcKills || 0) >= (END.fallenKills || 3)) body.push(E.fallenAfter);
    body.push(`${dayOf(G.time)}일차 · 수색 ${G.stats.searches}번 · 쓰러뜨린 적 ${G.stats.kills} · 해친 사람 ${G.stats.npcKills || 0} · 모은 기록 ${G.fragments.length}/${ST.fragments.length} · 의뢰 ${BONDS.filter((b) => G.bonds[b.id] && G.bonds[b.id].done).length}/${BONDS.length}`);
    showModal({
      title: `엔딩 · ${E.title}`,
      body,
      buttons: [
        { label: '새 게임', onClick: () => startNew() },
        { label: DREAM_ENDINGS.includes(id) ? '계속하기 (악몽에서 깨어나기)' : '계속하기', primary: true, onClick: () => {
          if (!DREAM_ENDINGS.includes(id)) return render();
          // 몸을 잃는 엔딩은 계속하면 악몽에서 깨어난다 (쓰러진 것과 같다)
          wakeFromNightmare();
        } },
      ],
    });
  }

  // 옥상의 아이들이 학교에서 망을 봐 준다
  // 총소리가 난 곳은 한동안 더 잘 마주친다
  const noisy = (locId) => (G.locs[locId].noise || 0) > G.time;
  const encChance = (locId) => Math.min(0.95, searchEncounterChance(LOC[locId].danger, locId) * radioEncMult() * (LOC[locId].nightMult && isNight(G.time) ? LOC[locId].nightMult : 1) * (locId === 'school' && qflag('kids_fed') && bondLive('kids') && !G.residents.kids ? 0.5 : 1) * (noisy(locId) ? CB.noiseMult : 1) * (LB && alarmOn(locId) ? LB.alarm.encMult : 1));

  // ---------- 라디오 ----------
  // 채널마다 날짜별 방송이 있다. 끊기는 채널도, 다시 살아나는 채널도 있다.
  // 듣지 못하고 지나간 방송은 나중에 라디오를 켤 때 무작위로 '지난 방송'으로 다시 나온다
  // 방송 키: 날짜 방송은 '채널:일차', 반응 방송은 '채널:r:플래그', 무전은 '채널:p번호'
  // 같은 날 조건만 다른 방송은 한 자리를 나눠 쓴다: 그날 실제로 나간 쪽 하나만 있다
  const rKey = (ch, b) => (b.react ? `${ch.id}:r:${b.react}` : `${ch.id}:${b.day}`);
  const heardB = (ch, b) => G.radioHeard.includes(rKey(ch, b));
  // 그날까지 생긴 플래그인지 (플래그 값은 생긴 날)
  const qflagBy = (name, day) => { const v = G.flags[`q:${name}`]; return !!v && (typeof v !== 'number' || v <= day); };
  // 반응 방송은 지금 조건으로, 날짜 방송은 그 방송이 나간 날의 조건으로 본다
  const condOk = (b) => (b.react
    ? (!b.if || allFlags(b.if)) && (!b.unless || !anyFlag(b.unless))
    : (!b.if || allFlags(b.if, (f) => qflagBy(f, b.day))) && (!b.unless || !anyFlag(b.unless, (f) => qflagBy(f, b.day))));
  // 반응 방송은 플래그가 생긴 다음 날부터 나온다
  const reactDay = (b) => G.flags[`q:${b.react}`] + (b.delay != null ? b.delay : 1);
  const reactsOf = (ch, day) => [...(ch.at || []), ...(ch.react || [])].filter((b) => b.react && qflag(b.react) && condOk(b) && reactDay(b) <= day);
  // 그날 들리는 방송: 날짜 방송과 이미 나온 반응 방송 중 가장 늦은 것
  function currentB(ch, day) {
    let cur = null, curDay = -1;
    for (const b of ch.at || []) {
      if (b.react || b.day > day || !condOk(b)) continue;
      if (b.day >= curDay) { cur = b; curDay = b.day; }
    }
    for (const b of reactsOf(ch, day)) if (reactDay(b) >= curDay) { cur = b; curDay = reactDay(b); }
    return cur;
  }
  const freshB = (ch, b) => !!b && !b.silent && !heardB(ch, b);
  const freshReact = (ch, day) => reactsOf(ch, day).find((b) => !heardB(ch, b)) || null;
  // minor: 이어지는 반복 방송이라 놓쳐도 다시 틀지 않는다
  const missedB = (ch, day) => { const cur = currentB(ch, day); return (ch.at || []).filter((b) => !b.react && b.day <= day && b !== cur && condOk(b) && !b.silent && !b.minor && !heardB(ch, b)); };
  function radioStatus() {
    const day = dayOf(G.time);
    let fresh = false, missed = 0;
    for (const ch of ST.radio.channels) {
      if (ch.deadIf && qflag(ch.deadIf)) continue;
      if (ch.needRadio && !(radioCfg() && radioCfg()[ch.needRadio])) continue;
      if (freshReact(ch, day)) fresh = true;
      if (ch.pool) continue;
      if (freshB(ch, currentB(ch, day))) fresh = true;
      missed += missedB(ch, day).length;
    }
    return { fresh, missed };
  }
  function listenRadio() {
    if (!G || (G.loc !== 'hideout' && !radioCfg())) return;
    let body = null, title = '';
    run(() => {
      passTime(ST.radio.minutes, 'idle');
      if (G.dead) return;
      const day = dayOf(G.time);
      body = [];
      // 거점 밖에서는 들고 있는 무전기로 듣는다. 급조 무전기는 잡음만 들릴 때가 있다
      const away = G.loc !== 'hideout', R = radioCfg();
      if (away && R.static && chance(R.static)) {
        body.push({ head: ITEMS[P().radio].name, text: '지지직… 지지지직… 잡음뿐이다. 안테나를 아무리 돌려도 목소리가 잡히지 않는다.' });
        title = `무전기 · ${day}일차 ${clockStr(G.time)}`;
        return;
      }
      // 보급 방송: 하루 한 번, 보급 상자가 떨어진 곳을 알려 준다
      if (R && R.supply && G.flags.supplyDay !== day) {
        G.flags.supplyDay = day;
        const SD = C.supplyDrop;
        if (SD && chance(SD.chance)) {
          const loc = pick(OUT_LOCS).id, items = {};
          for (const [id, a, b, p] of SD.items) if (chance(p)) addTo(items, id, randInt(a, b));
          if (!Object.keys(items).length) addTo(items, 'water_bottle', 2);
          G.caches.push({ id: `supply_${day}`, loc, place: SD.place, items });
          body.push({ head: '보급 방송', text: `"…구호 물자 투하 좌표를 알린다. ${LOC[loc].name}. 반복한다, ${LOC[loc].name}." 무전이 끊겼다.` });
          log(`[보급 방송] ${LOC[loc].name}에 보급 상자가 떨어졌다. 그곳에 가서 열 수 있다.`, 'good');
        }
      }
      // tag: '새 방송' / '지난 방송 (n일차)' / 없음(무전)
      const hear = (ch, key, tag, text) => {
        body.push({ head: tag ? `${ch.name} · ${tag}` : ch.name, text });
        if (!G.radioHeard.includes(key)) { G.radioHeard.push(key); log(`[라디오 · ${ch.name}${tag && tag !== '새 방송' && tag !== '새 소식' ? ` · ${tag}` : ''}] ${text}`, 'story'); }
      };
      for (const ch of ST.radio.channels) {
        if (ch.needRadio && !(radioCfg() && radioCfg()[ch.needRadio])) continue;
        // 방송하던 사람이 없으면 잡음뿐
        if (ch.deadIf && qflag(ch.deadIf)) { body.push({ head: ch.name, text: ch.deadText }); continue; }
        // 일어난 일에 대한 소식이 가장 먼저
        const r = freshReact(ch, day);
        if (r) { hear(ch, rKey(ch, r), '새 소식', r.text); continue; }
        if (ch.pool) {
          // 무전은 아직 못 들은 것부터 아무거나
          const idx = ch.pool.map((_, i) => i);
          const unheard = idx.filter((i) => !G.radioHeard.includes(`${ch.id}:p${i}`));
          const i = pick(unheard.length ? unheard : idx);
          hear(ch, `${ch.id}:p${i}`, '', ch.pool[i]);
          continue;
        }
        const cur = currentB(ch, day);
        if (freshB(ch, cur)) { hear(ch, rKey(ch, cur), '새 방송', cur.text); continue; }
        const missed = missedB(ch, day);
        if (missed.length) { const b = pick(missed); hear(ch, rKey(ch, b), `지난 방송 (${b.day}일차)`, b.text); continue; }
        if (cur) body.push({ head: ch.name, text: cur.text });
      }
      G.radioDay = day;
      title = `${G.loc === 'hideout' ? '라디오' : '무전기'} · ${day}일차 ${clockStr(G.time)}`;
      // 공포가 가라앉는 건 하루 한 번
      const fear = P().debuffs.fear;
      if (fear && G.flags.radioCalmDay !== day) {
        fear.left = Math.round(fear.left * ST.radio.calmMult);
        G.flags.radioCalmDay = day;
        log('사람 목소리를 들으니 떨림이 조금 가라앉았다.', 'good');
      }
      storyOnce('firstRadio', ST.moments.firstRadio);
    });
    if (body && G && !G.dead) showModal({ title, body, buttons: [{ label: '라디오를 끈다', primary: true }] });
  }
  function radioSub() {
    const r = radioStatus(), t = fmtDur(ST.radio.minutes);
    if (r.fresh) return `새 방송이 있다 · ${t}`;
    if (r.missed) return `놓친 방송 ${r.missed}개 · ${t}`;
    return `새 방송 없음 · ${t}`;
  }

  function completeSearch() {
    const L = LOC[G.loc], st = G.locs[G.loc];
    st.spots = Math.max(0, st.spots - 1);
    G.stats.searches += 1;
    const found = searchLoot(L);
    const note = crowNoteRoll();
    if (note) addTo(found, note, 1);
    labRoll(found);
    // 연구소: 장비를 고스란히 지닌 PMC의 시신
    if (isLab(G.loc) && chance(C.lab.corpseChance)) {
      for (const [id, p, a, b] of C.lab.corpse) if (chance(p)) addTo(found, id, randInt(a, b));
      log('쓰러진 PMC 대원의 시신. 장비가 고스란히 남아 있다. 이걸 다 들고도 여기서 나가지 못했다.', 'story');
    }
    if (!Object.keys(found).length) log(pick(D.emptyLines));
    else stow(found, { type: 'search' });
    questEvent('search', { loc: G.loc });
    questEvent('find', { loc: G.loc });
    clueRoll();
    gainXp('focus', SK.xp.search + Object.keys(found).filter((id) => ITEMS[id].r >= 2).length * SK.xp.rareFind);
    if (isNight(G.time)) gainXp('resolve', SK.xp.nightSearch);
    ambientLine(L);
    const frag = nextFragmentAt(G.loc);
    if (frag && chance(ST.fragmentChance)) foundFragment(frag);
    if (st.spots === 0) log('이곳은 이제 더 뒤질 곳이 없다.', 'warn');
  }

  function search() {
    if (!G || G.loc === 'hideout') return;
    run(() => {
      const L = LOC[G.loc], st = G.locs[G.loc];
      if (st.spots <= 0) { log('더 뒤질 곳이 없다.', 'warn'); return; }
      const mins = searchMinutes();
      log(`${pick(L.flavor)} (${fmtDur(mins)})`);
      passTime(mins, 'search');
      if (G.dead) return;
      const ctx = { type: 'search', danger: L.danger };
      if (chance(encChance(G.loc))) { startCombat(pickEnemy(L.danger, L.id), { ...ctx, completeOnWin: true }); return; }
      completeSearch();
      maybeEvent('search', ctx, C.eventChance.search);
    });
  }

  function rest() {
    run(() => {
      passTime(C.restMinutes, 'rest');
      if (G.dead) return;
      if (G.loc === 'hideout') { log('벽에 기대 한 시간쯤 숨을 골랐다.'); return; }
      log('몸을 숨길 만한 구석에서 한 시간쯤 숨을 골랐다.');
      const L = LOC[G.loc];
      const ctx = { type: 'rest', danger: L.danger };
      if (chance(encChance(G.loc) * CB.restMult * earRestMult())) { startCombat(pickEnemy(L.danger, L.id), ctx); return; }
      maybeEvent('rest', ctx, C.eventChance.rest * earRestMult());
    });
  }

  function sleep() {
    if (!G || G.loc !== 'hideout') return;
    run(() => {
      log('담요를 덮고 눈을 감았다.');
      passTime(C.sleepMinutes, 'sleep');
      if (G.dead) return;
      log(`${clockStr(G.time)}, 눈을 떴다.`, 'good');
      if (((facCfg('bed') && facCfg('bed').calm) || resActive('family')) && P().debuffs.fear) { delete P().debuffs.fear; log(resActive('family') && !(facCfg('bed') && facCfg('bed').calm) ? '아이들 웃음소리를 들으며 잠들었다. 떨림이 가라앉았다.' : '푹 자고 나니 떨림이 가라앉았다.', 'good'); }
      const radio = nextFragmentAt('radio');
      if (radio && chance(ST.radioChance)) {
        log('잠들기 전 라디오 주파수를 돌리다가, 잡음 사이로 목소리를 붙잡았다.', 'story');
        foundFragment(radio);
      }
      maybeEvent('sleep', { type: 'sleep', danger: 0 }, C.eventChance.sleep * earRestMult());
    });
  }

  // ---------- 전투 ----------
  // locId가 있으면 그 장소의 적 구성(foes: 종류별 배율)을 따른다
  function pickEnemy(danger, locId) {
    const foes = (locId && LOC[locId] && LOC[locId].foes) || {};
    // 연구소처럼 적 목록이 따로 있는 곳은 그 목록에서만
    const own = locId && LOC[locId] && LOC[locId].enemies;
    if (own) { const e = weightedPick(Object.entries(own).map(([id, w]) => ({ id, w }))); return e ? e.id : 'infected'; }
    const e = weightedPick(Object.keys(ENEMIES).map((id) => ({ id, w: (ENEMIES[id].weight[danger] || 0) * (foes[id] || 1) * (id === 'raider' && qflag('black_dogs_gone') ? 0.3 : 1) })));
    return e ? e.id : 'infected';
  }
  function ctxPlace(ctx) {
    return ctx.type === 'travel' ? `${ro(placeName(ctx.dest))} 가는 길` : placeName(G.loc);
  }
  function startCombat(enemyId, ctx, opts = {}) {
    const E = ENEMIES[enemyId];
    let canFlee = opts.canFlee != null ? opts.canFlee : chance(E.canFlee);
    let note = null;
    if (!canFlee) note = opts.canFlee === false ? '도망칠 틈이 없다. 싸워야 한다.' : E.noFleeText || '도망치기에는 늦었다. 싸워야 한다.';
    if (canFlee && tierIndex() === 2 && !elite('strength')) { canFlee = false; note = '짐이 너무 무거워 도망칠 수 없다. 싸워야 한다.'; }
    const warned = !!(E.pmc && radioCfg() && radioCfg().pmc);
    if (warned) { canFlee = true; note = '군용 무전기로 놈들의 무전을 엿들었다. 미리 숨을 자리를 봐 두었다.'; }
    const text = opts.intro || fill(pick(E.intro), ctxPlace(ctx));
    logCat = 'fight';
    log(text, 'event');
    logCat = null;
    // 사건이 '도망칠 틈이 없다'고 정한 전투는 기습: 이미 붙어 있어서 원거리 사격이 없다
    const close = opts.canFlee === false || !!opts.close;
    G.pending = { kind: 'combat', enemy: enemyId, canFlee, note, text, ctx, penalty: 0, ...(warned ? { warned: true } : {}), ...(close ? { close: true } : {}), winLoot: opts.winLoot || 0, bonus: opts.bonus || 0, bonusLabel: opts.bonusLabel || '' };
    gainXp('resolve', SK.xp.encounter + Math.round((E.fear || 0) * 10));
  }

  function weaponBonus(w) {
    if (!w) return { label: '맨손', value: 0 };
    const it = ITEMS[w];
    if (it.ammo && !(P().inv[it.ammo] > 0)) return { label: `${it.name} (탄약 없음)`, value: it.noAmmoAtk || 0 };
    return { label: it.name, value: it.atk };
  }
  // 탄약이 있는 총으로, 놈이 아직 붙기 전이면 원거리 사격
  const ranged = (pd, w) => !!pd && !pd.close && !isMelee(w);
  function combatDanger(pd) { return pd.ctx && pd.ctx.danger != null ? pd.ctx.danger : dangerOf(G.loc); }
  // 들고 있는 무기 중 가장 유리한 것 (무기가 없으면 맨손)
  function bestWeapon(pd) {
    const ids = weaponIds();
    if (!ids.length) return null;
    const odds = ids.map((id) => [id, oddsWith(pd, id).total]);
    const top = Math.max(...odds.map(([, o]) => o));
    // 탄약을 안 쓰는 무기가 거의 같으면(상한에 걸린 경우 포함) 그 무기를 먼저 고른다
    const free = odds.filter(([id]) => isMelee(id)).sort((a, b) => b[1] - a[1])[0];
    if (free && free[1] >= top - (pd.close ? CB.ammoSaveMargin : 0)) return free[0];
    return odds.find(([, o]) => o === top)[0];
  }
  function winOdds(pd) { return oddsWith(pd, bestWeapon(pd)); }
  function oddsWith(pd, weapon) {
    const E = ENEMIES[pd.enemy], p = P(), M = CB.mods, d = p.debuffs;
    const danger = combatDanger(pd);
    const rows = [[`위험도 기본 (${D.dangers[danger].name})`, CB.base[danger]]];
    if (E.mod) rows.push([E.name, E.mod]);
    const wb = weaponBonus(weapon);
    rows.push([wb.label, wb.value]);
    if (isMelee(weapon) && lvl('strength') > 0) {
      // 탄약 없는 총은 휘두르기 어색하다: 힘 보너스 절반
      const club = !!(weapon && ITEMS[weapon].ammo);
      rows.push([`힘 LV ${lvl('strength')}${club ? ' (총을 휘두름 · 절반)' : ''}`, Math.round(lvl('strength') * SL.strength.meleePerLv * (club ? CB.clubSkillMult : 1))]);
    }
    if (ranged(pd, weapon)) rows.push(['원거리 사격', CB.rangedWin]);
    if (!isMelee(weapon)) {
      const aim = Math.round(lvl('focus') * SL.focus.gunPerLv);
      if (aim > 0) rows.push([`집중력 LV ${lvl('focus')} (사격)`, aim]);
      // 4. 상대에 따라 잘 듣는 총 (산탄총: 무리·변이 감염자, 기관단총: 무리·들개, 소총: 변이 감염자·약탈자)
      const vs = ITEMS[weapon].vs && ITEMS[weapon].vs[pd.enemy];
      if (vs) rows.push([`${ITEMS[weapon].name} · ${E.name} 상대`, vs]);
      // 부착물: 낮 승률, 밤에는 밤 페널티만큼까지 더, 상대별 보너스
      const m = modsOf(weapon), ids = modIds(m);
      if (ids.length) {
        const win = modSum(m, 'win');
        if (win) rows.push([`부착물 (${ids.map((x) => ITEMS[x].name).join(', ')})`, win]);
        if (inDark()) { const nb = Math.min(modSum(m, 'night'), -CB.nightWin); if (nb > 0) rows.push(['야간 장비', nb]); }
        const mv = ids.reduce((a, x) => a + ((ITEMS[x].vs && ITEMS[x].vs[pd.enemy]) || 0), 0);
        if (mv) rows.push([`부착물 · ${E.name} 상대`, mv]);
      }
    }
    for (const id of Object.keys(p.buffs)) if (BUFFS[id].win) rows.push([BUFFS[id].name, BUFFS[id].win]);
    if (pd.bonus) rows.push([pd.bonusLabel || '도움', pd.bonus]);
    if (earCfg() && earCfg().win) rows.push([ITEMS[P().ear].name, earCfg().win]);
    if (inDark()) rows.push([isNight(G.time) ? '밤' : '정전', CB.nightWin]);
    // 방탄복 입은 적: 근접 무기로는 잘 안 든다
    if (E.armored && isMelee(weapon)) rows.push(['방탄복 (근접 무기)', -E.armored]);
    if (pd.warned) rows.push(['무전으로 미리 알았다', 5]);
    const hpPct = p.hp / maxHp();
    if (hpPct < 0.5 && !numb()) rows.push(['부상', -Math.round((0.5 - hpPct) * 100 * M.hpLowPer)]);
    if (elite('endurance')) { /* 지치지 않는 다리 */ }
    else if (p.stamina <= 0) rows.push(['탈진', M.exhausted]);
    else if (p.stamina < 25) rows.push(['지침', M.tired]);
    if (p.fatigue >= C.fatigueSlowAt) rows.push(['피로', M.fatigue]);
    const ti = tierIndex();
    if (ti === 1) rows.push(['경과적', M.light]);
    if (ti === 2) rows.push(['중과적', M.heavy]);
    if (d.fracture && !numb()) rows.push(['골절', DB.fracture.win]);
    if (d.fear) rows.push(['공포', DB.fear.win]);
    if (d.infection && d.infection.sev >= DB.infection.winAt) rows.push(['감염', DB.infection.win]);
    if (d.poison) rows.push(['식중독', DB.poison.win]);
    if (d.nightmare) rows.push([DB.nightmare.name, DB.nightmare.win]);
    if (thickOver()) rows.push([`껴입음 (두께 ${thickness()})`, -thickOver() * EQ.perWin]);
    if (pd.penalty) rows.push(['도망 실패', pd.penalty]);
    const sum = rows.reduce((s, r) => s + r[1], 0);
    return { total: clamp(Math.round(sum), CB.minWin, CB.maxWin), rows };
  }
  function fleeOdds(pd) {
    const E = ENEMIES[pd.enemy], p = P(), F = CB.fleeMods;
    let v = CB.fleeBase + (E.fleeMod || 0) + (p.stamina - 50) * F.staminaPer;
    if (tierIndex() === 1) v += F.light;
    if (has('fracture') && !numb()) v += DB.fracture.flee;
    if (inDark()) v += F.night;
    if (pd.warned) v += 20;
    v -= thickOver() * EQ.perFlee;
    return clamp(Math.round(v), CB.minWin, 90);
  }
  function sneakOdds(base) {
    const S = CB.sneakMods;
    let v = base;
    const ti = tierIndex();
    if (ti === 1) v += S.light;
    if (ti === 2) v += S.heavy;
    if (has('fracture') && !numb()) v += S.fracture;
    if (inDark()) v += S.night;
    return clamp(Math.round(v), CB.minWin, CB.maxWin);
  }

  function fight(wid) {
    const pd = G && G.pending;
    if (!pd || pd.kind !== 'combat') return;
    const weapon = wid && weaponIds().includes(wid) ? wid : bestWeapon(pd);
    run(() => {
      const E = ENEMIES[pd.enemy], p = P(), ctx = pd.ctx;
      const odds = oddsWith(pd, weapon).total; // 버튼에 보인 확률 그대로 쓴다
      const melee = isMelee(weapon);
      const far = ranged(pd, weapon); // 탄약을 쓰기 전에 정한다 (마지막 탄으로 쏴도 원거리)
      G.pending = null;
      const w = weapon ? ITEMS[weapon] : null;
      let ammoNote = '';
      const gm = w && w.ammo ? modsOf(weapon) : {};
      const shot = w && w.ammo && p.inv[w.ammo] > 0;
      if (shot) {
        const extra = modSum(gm, 'ammo');
        const n = Math.min(p.inv[w.ammo], randInt(w.ammoUse[0] + extra, w.ammoUse[1] + extra));
        addTo(p.inv, w.ammo, -n);
        ammoNote = ` (${ITEMS[w.ammo].name} ${n}발 사용)`;
      }
      p.stamina = clamp(p.stamina - CB.fightStamina, 0, maxStamina());
      passTime(CB.fightMinutes, 'fight', ctx.type === 'travel');
      if (G.dead) return;
      // 총소리: 바깥에서 소음기 없이 쏘면 한동안 그곳에 놈들이 몰려든다
      const loud = shot && G.loc !== 'hideout' && ctx.type !== 'travel' && !modIds(gm).some((x) => ITEMS[x].quiet);
      if (loud) G.locs[G.loc].noise = G.time + CB.noiseMinutes;
      const def = armorDef(), dbf = armorDbf();
      const cause = `${E.name}에게 당해 쓰러졌다`;
      const won = Math.random() * 100 < odds;
      // 원거리 사격이 빗나갔다: 탄약만 쓰고 다치지 않는다. 놈이 붙어서 근접전이 이어진다
      if (far && !won) {
        log(`${pick(['빗나갔다.', '놈이 엄폐물 뒤로 몸을 숨겼다.', '맞혔지만 쓰러지지 않는다.'])} 놈이 순식간에 거리를 좁혀 온다!${ammoNote}`, 'warn');
        gainXp('endurance', SK.xp.fight);
        gainXp('focus', SK.xp.gunLose);
        if (loud) log(`총소리가 울려 퍼졌다. 한동안 이 근처에 놈들이 몰려든다. (조우 확률 ×${CB.noiseMult}, ${fmtDur(CB.noiseMinutes)} · 소음기를 달면 괜찮다)`, 'warn');
        G.pending = { ...pd, close: true, note: '놈이 코앞까지 붙었다. 이제 근접전이다.' };
        return;
      }
      // 경험치는 살아남은 뒤에 오른다
      const learn = () => {
        gainXp('endurance', SK.xp.fight);
        if (melee) gainXp('strength', won ? SK.xp.meleeWin : SK.xp.meleeLose);
        else gainXp('focus', won ? SK.xp.gunWin : SK.xp.gunLose);
      };
      if (won) {
        log(pick(E.win) + ammoNote, 'good');
        G.stats.kills += 1;
        if (!E.npc) questEvent('kill', { enemy: pd.enemy, loc: ctx.type === 'travel' ? null : G.loc });
        storyOnce('firstKill', ST.moments.firstKill);
        if (far) log('멀리서 먼저 쓰러뜨렸다. 놈은 가까이 오지도 못했다.', 'good');
        else if (chance(E.hurtOnWin)) {
          const dmg = Math.max(1, Math.round(randInt(E.winDmg[0], E.winDmg[1]) * (1 - def)));
          log(`싸우다 가벼운 상처를 입었다. (HP -${dmg})`, 'warn');
          hurt(dmg, cause);
          if (G.dead) return;
          tryDebuff('bleed', 0.25 * (1 - dbf));
          if (E.debuffs.some(([t]) => t === 'infection')) tryDebuff('infection', 0.08 * (1 - dbf));
        }
        tryDebuff('fear', E.fear);
        learn();
        if (E.drops) {
          const found = {};
          for (const [id, pr, a, b] of E.drops) if (chance(pr)) addTo(found, id, randInt(a, b));
          if (Object.keys(found).length) stow(found, ctx);
        }
        if (pd.winLoot) {
          const found = rollFinds(lootPool(ctx), combatDanger(pd), pd.winLoot);
          if (Object.keys(found).length) stow(found, ctx);
        }
        if (ctx.completeOnWin && G.loc !== 'hideout') completeSearch();
      } else {
        if (Math.random() * 100 < dodgeChance()) {
          log(`${E.name}에게 밀렸지만 아슬아슬하게 피해 빠져나왔다. 다친 곳은 없다.${ammoNote}`, 'warn');
        } else {
          const dmg = Math.max(1, Math.round(randInt(E.dmg[0], E.dmg[1]) * (1 - def)));
          log(`${pick(E.lose)} (HP -${dmg})${ammoNote}`, 'bad');
          hurt(dmg, cause);
          if (G.dead) return;
          for (const [t, c] of E.debuffs) tryDebuff(t, c * (1 - dbf));
          if (E.steal) stealFrom();
        }
        tryDebuff('fear', Math.min(1, E.fear * 1.5));
        learn();
      }
      if (loud) log(`총소리가 울려 퍼졌다. 한동안 이 근처에 놈들이 몰려든다. (조우 확률 ×${CB.noiseMult}, ${fmtDur(CB.noiseMinutes)} · 소음기를 달면 괜찮다)`, 'warn');
      if (ctx.bond && ctx.choice != null) {
        const ch = BOND[ctx.bond].steps[ctx.step].choices[ctx.choice];
        const o = won ? ch.outcome.win : ch.outcome.lose;
        if (o) applyOutcome(o, ctx, EVENTS[`q:${ctx.bond}:${ctx.step}`]);
      }
      finishCtx(ctx);
    }, { allowPending: true, keepRecent: true, top: pd.ctx.type === 'travel' });
  }

  function stealFrom() {
    const ids = Object.keys(P().inv).filter((id) => !ITEMS[id].keep);
    if (!ids.length) return;
    const taken = [];
    for (let i = 0; i < 2 && ids.length; i++) {
      const id = ids.splice(Math.floor(Math.random() * ids.length), 1)[0];
      const n = Math.min(P().inv[id], randInt(1, 3));
      addTo(P().inv, id, -n);
      taken.push(`${ITEMS[id].name} ${n}개`);
    }
    log(`약탈자가 ${taken.join(', ')}를 빼앗아 갔다.`, 'bad');
  }

  function bribe() {
    const pd = G && G.pending;
    const E = pd && pd.kind === 'combat' && ENEMIES[pd.enemy];
    if (!E || !E.bribe || !E.bribe.every(([id, n]) => (P().inv[id] || 0) >= n)) return;
    run(() => {
      G.pending = null;
      for (const [id, n] of E.bribe) addTo(P().inv, id, -n);
      log(`${itemsText(E.bribe)}개를 바닥에 내려놓고 뒤로 물러섰다. 대원 하나가 드라이브를 집어 들고 무전에 대고 뭐라고 말한다. 총구가 내려갔다. 그들은 나를 지나쳐 갔다.`, 'good');
      if (pd.ctx.type === 'search') log('수색은 포기했다.');
      finishCtx(pd.ctx);
    }, { allowPending: true, keepRecent: true, top: pd.ctx.type === 'travel' });
  }
  function flee() {
    const pd = G && G.pending;
    if (!pd || pd.kind !== 'combat' || !pd.canFlee) return;
    run(() => {
      const odds = fleeOdds(pd);
      const p = P();
      G.pending = null;
      p.stamina = clamp(p.stamina - CB.fleeStamina, 0, maxStamina());
      passTime(CB.fleeMinutes, 'travel', pd.ctx.type === 'travel');
      if (G.dead) return;
      const escaped = Math.random() * 100 < odds;
      gainXp('endurance', escaped ? SK.xp.fleeSuccess : SK.xp.fleeFail);
      if (escaped) {
        log(pick(['있는 힘껏 달려 겨우 따돌렸다.', '골목으로 뛰어들어 숨을 죽였다. 따돌린 것 같다.']), 'good');
        if (pd.ctx.type === 'search') log('수색은 포기했다.');
        finishCtx(pd.ctx);
        return;
      }
      log('도망치려 했지만 따라잡혔다!', 'bad');
      G.pending = { ...pd, canFlee: false, note: '등을 보인 대가다. 이제 싸우는 수밖에 없다.', penalty: CB.fleeFailPenalty };
    }, { allowPending: true, keepRecent: true, top: pd.ctx.type === 'travel' });
  }

  // ---------- 랜덤 이벤트 ----------
  function rollEvent(on, danger) {
    const night = isNight(G.time), outside = G.loc !== 'hideout';
    const pool = D.events
      .filter((e) => e.on.includes(on) && danger >= (e.minDanger || 0) && (e.night === undefined || e.night === night) && (!e.outside || outside) && !(e.noLab && isLab(G.loc)) && (!e.labOnly || isLab(G.loc)))
      .filter((e) => !(e.blockedBy && facLv(e.blockedBy.fac) >= e.blockedBy.lv) && !(e.unlessFlag && qflag(e.unlessFlag)))
      .map((e) => ({ e, w: e.weight * (e.softenedBy && facLv(e.softenedBy.fac) >= e.softenedBy.lv ? e.softenedBy.mult : 1) }));
    const r = weightedPick(pool);
    return r ? r.e : null;
  }
  function maybeEvent(on, ctx, p) {
    if (!chance(p)) return;
    const ev = rollEvent(on, ctx.danger || 0);
    if (ev) startEvent(ev, ctx);
  }
  const canAfford = (give) => give.every(([id, n]) => (P().inv[id] || 0) >= n);
  // 떠돌이 상인의 거래 목록: 생필품 하나, 재료 하나, 나머지는 아무거나. 가끔 하나가 귀한 물건으로 바뀐다
  // 칸마다 70% 확률로 지금 바꿀 수 있는 거래를 먼저 고른다
  function pickOffers() {
    const TR = D.trader || { offers: 3, rareChance: 0 };
    const all = D.trades.map((t, i) => i);
    const of = (kind) => all.filter((i) => (D.trades[i].kind || 'supply') === kind);
    const out = [];
    const take = (pool) => {
      pool = pool.filter((i) => !out.includes(i));
      if (!pool.length) return;
      const ok = pool.filter((i) => canAfford(D.trades[i].give));
      out.push(ok.length && chance(0.7) ? pick(ok) : pick(pool));
    };
    take(of('supply'));
    take(of('material'));
    while (out.length < TR.offers) {
      const before = out.length;
      take([...of('supply'), ...of('material')]);
      if (out.length === before) break;
    }
    if (of('rare').length && chance(TR.rareChance)) { out.pop(); take(of('rare')); }
    return out;
  }
  function startEvent(ev, ctx) {
    const text = fill(pick((ev.textByLoc && ev.textByLoc[G.loc]) || ev.text), ctxPlace(ctx));
    log(text, 'event');
    if (ev.trade) {
      const offers = pickOffers();
      G.pending = { kind: 'event', id: ev.id, text, ctx, offers };
      const rare = offers.find((i) => D.trades[i].kind === 'rare');
      if (ev.rareText && rare != null) {
        const g = D.trades[rare].get[0][0], rt = ev.rareText;
        const line = typeof rt === 'string' ? rt : rt[g] || rt[ITEMS[g].cat];
        if (line) log(line, 'event');
      }
      return;
    }
    if (ev.choices) { G.pending = { kind: 'event', id: ev.id, text, ctx }; return; }
    applyOutcome(ev.outcome || {}, ctx, ev);
  }
  const choiceOk = (ch, ctx) => (!ch.requires || ch.requires.every(hasItem)) && (!ch.roomCard || !(ctx && ctx.room && roomLocked(ctx.room))) && (!ch.need || ch.need.every(([k, n]) => needCount(k) >= n))
    && (!ch.obj || !!(ctx && ctx.bond && objAll(BOND[ctx.bond]))) && (!ch.invite || !inviteBlock(ch.invite));
  // '@그룹'은 그룹 안의 아무 물건이나 (소지품만 센다)
  const needIds = (k) => (k[0] === '@' ? BGROUP[k.slice(1)].ids : [k]);
  const needName = (k) => (k[0] === '@' ? BGROUP[k.slice(1)].name : ITEMS[k].name);
  // 거점에서는 창고에 있는 것도 알아서 쓴다 (창고 먼저, 모자라면 소지품)
  const needSrcs = () => (G.loc === 'hideout' ? [G.stash, P().inv] : [P().inv]);
  const needCount = (k) => needIds(k).reduce((a, id) => a + needSrcs().reduce((sum, m) => sum + (m[id] || 0), 0), 0);
  function giveNeed(need) {
    for (const [k, n] of need) {
      let left = n;
      for (const id of needIds(k)) {
        for (const m of needSrcs()) {
          const q = Math.min(left, m[id] || 0);
          if (q > 0) { addTo(m, id, -q); left -= q; }
        }
        if (left <= 0) break;
      }
    }
  }
  const qflag = (name) => !!(G && G.flags[`q:${name}`]);
  // if·unless에는 플래그 하나나 여러 개를 쓴다: if는 모두 있어야, unless는 하나라도 있으면 안 된다
  const allFlags = (f, test = qflag) => [].concat(f).every((x) => test(x));
  const anyFlag = (f, test = qflag) => [].concat(f).some((x) => test(x));
  function setQFlag(name) { if (!G.flags[`q:${name}`]) G.flags[`q:${name}`] = dayOf(G.time); }
  const choiceShown = (ch) => (!ch.if || allFlags(ch.if)) && (!ch.unless || !anyFlag(ch.unless))
    && (!ch.ifFrag || G.fragments.includes(ch.ifFrag)) && (!ch.ifHeard || ch.ifHeard.some((k) => G.radioHeard.includes(k)));

  function chooseEvent(i, sure) {
    const pd = G && G.pending;
    if (!pd || pd.kind !== 'event') return;
    const ev = EVENTS[pd.id];
    const idx = +i;
    // 거래: a가 목록 번호면 그 거래, 'no'면 거절
    const offer = ev.trade && pd.offers[idx] != null ? D.trades[pd.offers[idx]] : null;
    if (ev.trade) {
      if (offer && !canAfford(offer.give)) return toast('바꿀 물건이 부족하다.');
    } else if (!ev.choices[idx] || !choiceShown(ev.choices[idx]) || !choiceOk(ev.choices[idx], pd.ctx)) {
      return toast(ev.choices[idx] && ev.choices[idx].obj && !objAll(BOND[pd.ctx.bond]) ? '아직 목표를 다 채우지 못했다.' : ev.choices[idx] && ev.choices[idx].invite ? inviteBlock(ev.choices[idx].invite) || '필요한 물건이 없다.' : '필요한 물건이 없다.');
    }
    // 되돌릴 수 없는 선택은 한 번 더 묻는다
    const warn = !ev.trade && ev.choices[idx].warn;
    if (warn && !sure) return confirmBox(warn.title || '되돌릴 수 없는 선택', warn.text, warn.ok || '그래도 고른다', () => chooseEvent(i, true));
    run(() => {
      G.pending = null;
      const ctx = pd.ctx;
      if (ev.trade) {
        if (offer) {
          for (const [id, n] of offer.give) addTo(P().inv, id, -n);
          log(`${itemsText(offer.give)}개를 건넸다.`);
          stow(Object.fromEntries(offer.get), ctx);
          log('"거래 고마워. 몸조심해." 생존자는 수레를 끌고 멀어졌다.');
        } else {
          log('고개를 젓자 생존자는 어깨를 으쓱하고 멀어졌다.');
        }
      } else {
        ctx.choice = idx;
        applyOutcome(ev.choices[idx].outcome, ctx, ev);
      }
      if (!G.pending && !G.dead) finishCtx(ctx);
    }, { allowPending: true, keepRecent: true, top: pd.ctx.type === 'travel' });
  }

  function applyOutcome(o, ctx, ev) {
    if (!o) return;
    const p = P();
    if (o.consume) for (const [id, n] of o.consume) addTo(p.inv, id, -n);
    if (o.give && ev && ctx.choice != null) giveNeed(ev.choices[ctx.choice].need || []);
    if (o.time) {
      passTime(o.time, ctx.type === 'travel' ? 'travel' : 'search', ctx.type === 'travel');
      if (G.dead) return;
    }
    if (o.roomOpen) return openRoom(ctx);
    if (o.roomAlarm) return roomAlarm(ctx, o);
    if (o.roll) {
      const r = Math.random();
      let acc = 0;
      for (const sub of o.roll) { acc += sub.p; if (r < acc) return applyOutcome(sub, ctx, ev); }
      return applyOutcome(o.roll[o.roll.length - 1], ctx, ev);
    }
    if (o.sneak != null) return applyOutcome(Math.random() * 100 < sneakOdds(o.sneak) ? o.success : o.fail, ctx, ev);
    if (o.combat) {
      const id = o.combat === 'random' ? pickEnemy(ctx.danger || 0) : o.combat;
      startCombat(id, ctx, { intro: o.log, canFlee: o.canFlee, winLoot: o.winLoot, bonus: o.bonus, bonusLabel: o.bonusLabel });
      return;
    }
    if (o.log) log(o.log);
    // 연구원의 출입증: 전용방 단서 (다 모았으면 주머니만 턴다)
    if (o.labClue) {
      log('구겨진 종이를 펴 보았다.');
      if (!giveClue()) {
        log('이미 아는 내용이다. 대신 주머니를 털었다.');
        const f = rollFinds(lootPool(ctx), ctx.danger || 0, 1);
        if (Object.keys(f).length) stow(f, ctx);
      }
    }
    const hm = o.heavyMult && tierIndex() === 2 ? o.heavyMult : 1;
    const parts = [];
    let bad = false;
    if (o.hp) {
      let v = Array.isArray(o.hp) ? randInt(o.hp[0], o.hp[1]) : o.hp;
      if (v < 0) { v = Math.round(v * hm); bad = true; }
      parts.push(`HP ${signed(v)}`);
      if (v < 0) hurt(-v, (ev && ev.deathText) || '사고로 쓰러졌다');
      else p.hp = clamp(p.hp + v, 0, maxHp());
    }
    if (o.stamina) { p.stamina = clamp(p.stamina + o.stamina, 0, maxStamina()); parts.push(`스테미너 ${signed(o.stamina)}`); if (o.stamina < 0) bad = true; }
    if (o.fatigue) { p.fatigue = clamp(p.fatigue + o.fatigue, 0, 100); parts.push(`피로 ${signed(o.fatigue)}`); if (o.fatigue > 0) bad = true; }
    if (parts.length) log(`(${parts.join(' · ')})`, bad ? 'warn' : 'good');
    if (G.dead) return;
    if (o.debuffs) for (const [t, c] of o.debuffs) tryDebuff(t, Math.min(1, c * hm));
    if (o.items) {
      const found = {};
      for (const [id, a, b, pr = 1] of o.items) if (chance(pr)) { const n = randInt(a, b); if (n > 0) addTo(found, id, n); }
      if (Object.keys(found).length) stow(found, ctx);
      else if (o.emptyLog) log(o.emptyLog);
    }
    if (o.loot) {
      // lootUp: 더 위험한 곳처럼 좋은 물건이 잘 나온다 (금고 등)
      const found = rollFinds(lootPool(ctx), Math.min(D.dangers.length - 1, (ctx.danger || 0) + (o.lootUp || 0)), o.loot);
      if (Object.keys(found).length) stow(found, ctx);
      else log(pick(D.emptyLines));
    }
    if (o.flag) setQFlag(o.flag);
    // flagBefore: day 전이면 before, day부터 until 전까지는 after, 그 뒤면 later(없으면 아무것도 안 붙는다)
    if (o.flagBefore) {
      const fb = o.flagBefore, d = dayOf(G.time);
      const f = d < fb.day ? fb.before : fb.until == null || d < fb.until ? fb.after : fb.later;
      if (f) setQFlag(f);
    }
    if (o.xp) gainXp(o.xp[0], o.xp[1]);
    if (o.bike) giveBike();
    if (o.npcKill && ctx.bond) killNpc(ctx.bond);
    if (o.npcHostile && ctx.bond && G.bonds[ctx.bond]) { G.bonds[ctx.bond].hostile = true; G.recordNew = true; log(`[인연] ${BOND[ctx.bond].who}: 이제 나를 보면 문을 잠근다. 다시는 만나 주지 않는다.`, 'bad'); }
    if (o.invite && ctx.bond) moveIn(o.invite);
    if (o.cache && ctx.bond) addCache(`q:${ctx.bond}${o.cache.id ? `:${o.cache.id}` : ''}`, o.cache);
    if (o.quest && ctx.bond) advanceBond(ctx.bond, ctx.step, o.quest, o.chain);
    if (o.stashLoseFood) {
      const foods = Object.keys(G.stash).filter((id) => ITEMS[id].cat === 'food');
      if (foods.length) {
        const id = pick(foods);
        addTo(G.stash, id, -1);
        log(`쥐가 ${eul(ITEMS[id].name)} 갉아먹었다. (창고 ${ITEMS[id].name} -1)`, 'warn');
      } else {
        log('다행히 창고에 쥐가 먹을 만한 게 없었다.');
      }
    }
  }

  // ---------- 아이템 사용 ----------
  // 쓸 물건이 있는 곳: 소지품, 창고(거점에서), 케이스('case:inv:0' 들고 있는 첫 케이스, 'case:stash:0' 창고의 첫 케이스)
  function itemSrc(from) {
    const m = /^case:(inv|stash):(\d+)$/.exec(from || '');
    if (m) { const c = caseList(m[1])[+m[2]]; return c && (m[1] === 'inv' || G.loc === 'hideout') ? c.items : null; }
    return from === 'stash' && G.loc === 'hideout' ? G.stash : P().inv;
  }
  // 버프를 건다. 이어서 쓰면 시간은 길어지지 않고(더 긴 쪽), 끝날 때 오는 피로는 쓴 만큼 쌓인다
  const fullBuffMinutes = () => Math.round(C.fullBuff.minutes * (1 + lvl('metabolism') * C.fullBuff.perLv));
  function giveBuff(bid, left) {
    const p = P(), old = p.buffs[bid], end = BUFFS[bid].endFatigue || 0;
    p.buffs[bid] = { left: Math.max(left, old ? old.left : 0), ...(end ? { crash: (old ? (old.crash != null ? old.crash : end) : 0) + end } : {}) };
    log(`${BUFFS[bid].name} ${fmtDur(left)}: ${BUFFS[bid].desc}`, 'good');
  }
  function useItem(id, from) {
    const it = ITEMS[id];
    if (!G || !it || !isUsable(it)) return;
    const src = itemSrc(from);
    if (!src || !src[id]) return;
    const tr = it.treat || {};
    const relevant = Object.keys(tr).some((k) => has(k));
    if (!it.use && !relevant) { toast('지금은 쓸 필요가 없다.'); return; }
    // 들고 다니는 케이스에 든 것은 싸우거나 사건이 벌어진 중에도 바로 꺼내 쓴다 (오래 걸리는 것은 빼고)
    const quick = !!G.pending && /^case:inv:/.test(from || '') && !it.useMinutes;
    if (G.pending && !quick) { toast(/^case:inv:/.test(from || '') ? '오래 걸려서 지금은 쓸 수 없다.' : '눈앞의 상황부터 해결해야 한다. 케이스에 넣어 둔 것은 바로 꺼내 쓸 수 있다.'); return; }
    run(() => applyItem(id, src, quick), quick ? { allowPending: true, keepRecent: true } : {});
  }
  // 자동 먹기: 배고픔·갈증이 기준을 넘으면 흔한 것부터 알아서 먹고 마신다 (식중독 위험·반동이 있는 것, 잠근 것은 빼고)
  const autoEatOn = () => !!(G && G.flags.autoEat);
  function autoEatPick(need) {
    const other = need === 'hunger' ? 'thirst' : 'hunger';
    const srcs = G.loc === 'hideout' ? [G.stash, P().inv] : [P().inv];
    let best = null;
    for (const m of srcs) for (const id of Object.keys(m)) {
      const it = ITEMS[id];
      if (!(m[id] > 0) || !it || !it.use || !(it.use[need] < 0) || !['food', 'drink'].includes(it.cat) || isRisky(it) || (m === P().inv && P().locked[id])) continue;
      const cost = it.r * 10 + ((it.use[other] || 0) > 0 ? 5 : 0) + srcs.indexOf(m);
      if (!best || cost < best.cost) best = { id, m, cost };
    }
    return best;
  }
  function autoEat() {
    if (!G || G.dead || G.pending || !autoEatOn()) return;
    const at = (C.autoEat || {}).at || 70;
    for (const need of ['thirst', 'hunger']) {
      for (let k = 0; k < 3 && P()[need] >= at; k++) {
        const x = autoEatPick(need);
        if (!x) break;
        log(`[자동 먹기] ${need === 'hunger' ? '배고픔' : '갈증'}이 ${at}을 넘었다.`);
        applyItem(x.id, x.m, false);
        if (G.dead || G.pending) return;
      }
    }
  }
  // 아이템 효과 (useItem과 자동 먹기가 함께 쓴다). src에서 하나를 쓴다
  function applyItem(id, src, quick) {
    const it = ITEMS[id], tr = it.treat || {};
    addTo(src, id, -1);
    if (it.leaves) addTo(src === G.stash && stashFit(it.leaves, 1) > 0 ? G.stash : P().inv, it.leaves, 1);
    const p = P(), base = it.use || {};
    const h0 = p.hunger, t0 = p.thirst;
    const eat = it.cat === 'food' || it.cat === 'drink';
    // 신진대사: 음식·음료의 좋은 효과만 늘어난다
    const m = eat ? foodMult() : 1;
    const good = (v, sign) => (v && Math.sign(v) === sign ? Math.round(v * m) : v);
    const u = { hunger: good(base.hunger, -1), thirst: good(base.thirst, -1), fatigue: good(base.fatigue, -1), stamina: good(base.stamina, 1), hp: good(base.hp, 1) };
    if (u.hunger) p.hunger = clamp(p.hunger + u.hunger, 0, 100);
    if (u.thirst) p.thirst = clamp(p.thirst + u.thirst, 0, 100);
    if (u.fatigue) p.fatigue = clamp(p.fatigue + u.fatigue, 0, 100);
    if (u.stamina) p.stamina = clamp(p.stamina + u.stamina, 0, maxStamina());
    if (u.hp) p.hp = clamp(p.hp + u.hp, 0, maxHp());
    const fx = fxText(u);
    log(`${eul(it.name)} ${useVerb(it)}.${fx ? ` (${fx})` : ''}`);
    if (it.buff) giveBuff(it.buff[0], Math.round(it.buff[1] * m));
    // 배고픔과 갈증을 둘 다 거의 다 채우면 든든하다 (신진대사가 오를수록 길다)
    const FB = C.fullBuff;
    if (eat && FB && p.hunger <= FB.at && p.thirst <= FB.at) {
      const mins = fullBuffMinutes();
      if ((p.buffs[FB.buff] ? p.buffs[FB.buff].left : 0) < mins) { log(FB.text, 'good'); giveBuff(FB.buff, mins); }
    }
    // 옵돌보스: 무엇이 걸릴지 모른다
    if (it.random) {
      const X = it.random, pool = [...X.buffs], got = [];
      while (got.length < X.pick && pool.length) got.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
      log(`${it.name}: 몸이 제멋대로 반응한다. (${got.map((b) => BUFFS[b].name).join(', ')})`, 'event');
      for (const b of got) giveBuff(b, X.minutes);
      for (const [t, c] of X.bad || []) if (chance(c)) applyDebuff(t);
    }
    // 신진대사 경험치는 실제로 줄어든 배고픔·갈증만큼 (배부를 때 먹으면 거의 안 오른다)
    const fed = (v0, v1, b) => Math.max(0, Math.min(-(b || 0), v0 - v1));
    if (eat) gainXp('metabolism', (fed(h0, p.hunger, base.hunger) + fed(t0, p.thirst, base.thirst)) * SK.xp.eat);
    for (const k of Object.keys(tr)) {
      const d = p.debuffs;
      if (!d[k]) continue;
      if (k === 'infection') {
        d.infection.sev -= tr.infection;
        if (d.infection.sev <= 0) { delete d.infection; log(DB.infection.cured, 'good'); }
        else log(DB.infection.reduced, 'good');
      } else {
        delete d[k];
        log(DB[k].cured, 'good');
      }
    }
    if (base.poison) tryDebuff('poison', base.poison);
    if (!quick) passTime(it.useMinutes || 5, 'idle');
  }
  // 빈 필터 물병에 물을 채운다 (어디서나). 채울 수 있는 물이 여럿이면 고른다
  const fillFroms = (F) => [].concat(F.from);
  const fillMaps = (src) => [src, P().inv, ...(G.loc === 'hideout' ? [G.stash] : [])];
  const fillHave = (src, w) => fillMaps(src).filter((m, i, a) => a.indexOf(m) === i).reduce((n, m) => n + (m[w] || 0), 0);
  function fillItem(id, from, water) {
    const it = ITEMS[id], F = it && it.fill;
    if (!G || !F) return;
    const src = itemSrc(from);
    if (!src || !src[id]) return;
    const need = F.n || 1;
    const have = fillFroms(F).filter((w) => fillHave(src, w) >= need);
    if (!have.length) return toast(`채울 물이 모자라다 (${fillFroms(F).map((w) => ITEMS[w].name).join('·')} 중 한 가지 ${need}병).`);
    if (!water && have.length > 1) {
      return showModal({
        title: `${ITEMS[id].name}에 무엇을 채울까?`,
        body: [`같은 물 ${need}병을 채운다. 어느 물을 채워도 필터를 거쳐 같은 물이 된다. 빗물도 끓이지 않고 마실 수 있다.`],
        stack: true,
        buttons: [...have.map((w) => ({ label: `${ITEMS[w].name} 채우기 · ${fillHave(src, w)}개 있음`, primary: w === have[0], onClick: () => fillItem(id, from, w) })), { label: '그만둔다' }],
      });
    }
    const w = water && have.includes(water) ? water : have[0];
    run(() => {
      addTo(src, id, -1);
      let left = need;
      for (const m of fillMaps(src).filter((x, i, a) => a.indexOf(x) === i)) { const k = Math.min(left, m[w] || 0); if (k > 0) { addTo(m, w, -k); left -= k; } }
      addTo(src, F.to, 1);
      log(`${ITEMS[id].name}에 ${ITEMS[w].name} ${need}병을 채웠다.${w === 'rain_water' ? ' 필터가 걸러 줘서 끓이지 않아도 된다.' : ''}`);
      passTime(F.minutes || 5, 'idle');
    });
  }

  // ---------- 케이스 ----------
  // 케이스는 손에 들어오면 바로 열어서 쓴다(소지품이면 들고 다니는 케이스, 창고면 창고 케이스).
  // 들고 다니는 케이스 속 물건은 싸우는 중에도 꺼내 쓰고 약탈자에게 빼앗기지 않는다. 창고 케이스는 안에 얼마나 들었든 1칸.
  // 케이스 속 물건은 꺼내야 제작·거래·의뢰에 쓸 수 있다.
  const caseList = (where) => (where === 'stash' ? G.stashCases : P().cases);
  const caseCount = (c) => Object.values(c.items).reduce((a, b) => a + b, 0);
  const caseWeight = (list) => list.reduce((w, c) => w + ITEMS[c.id].w + mapWeight(c.items), 0);
  const caseRoom = (c) => ITEMS[c.id].case.cap - caseCount(c);
  function caseFits(cid, id) {
    const K = ITEMS[cid] && ITEMS[cid].case, it = ITEMS[id];
    if (!K || !it || it.cat === 'case') return false;
    if (K.inj) return !!it.inj;
    return K.cats.includes(it.cat) && it.w <= K.maxW + 1e-9;
  }
  // 무엇이 들어가는지 짧게
  const caseFitText = (cid) => { const K = ITEMS[cid].case; return K.inj ? '주사기만' : `${K.cats.map((c) => CAT_KO[c]).join('·')} (1개 ${K.maxW}kg 이하)`; };
  const CAT_KO = { med: '의약품', drink: '마실 것', material: '재료', mod: '부착물', quest: '중요한 물건' };
  // 그 물건을 넣을 케이스: 전용 케이스부터
  function caseSlotsFor(where, id) {
    return caseList(where).map((c, i) => ({ c, i })).filter(({ c }) => caseFits(c.id, id) && caseRoom(c) > 0)
      .sort((a, b) => (ITEMS[a.c.id].case.inj ? 0 : ITEMS[a.c.id].case.cats.length) - (ITEMS[b.c.id].case.inj ? 0 : ITEMS[b.c.id].case.cats.length));
  }
  function openCases() {
    if (!G.player.cases) return;
    for (const [m, list] of [[P().inv, P().cases], [G.stash, G.stashCases]]) {
      for (const id of Object.keys(m)) {
        if (!ITEMS[id].case) continue;
        for (let k = 0; k < m[id]; k++) list.push({ id, items: {} });
        delete m[id];
      }
    }
  }
  // 소지품·창고의 물건을 케이스에 넣는다 (들어가는 만큼)
  function casePut(id, from) {
    if (!G) return;
    const where = from === 'stash' ? 'stash' : 'inv';
    if (where === 'stash' && G.loc !== 'hideout') return;
    const src = where === 'stash' ? G.stash : P().inv;
    if (!src[id]) return;
    mutate(() => {
      let moved = 0;
      for (const { c } of caseSlotsFor(where, id)) {
        const k = Math.min(src[id] || 0, caseRoom(c));
        if (k > 0) { addTo(src, id, -k); addTo(c.items, id, k); moved += k; }
      }
      if (!moved) toast('넣을 수 있는 케이스가 없다.');
      else if (src[id]) toast(`${moved}개만 넣었다. 케이스가 가득 찼다.`);
    });
  }
  // 케이스에서 꺼낸다 (들고 있는 케이스 → 소지품, 창고 케이스 → 창고)
  function caseTake(a, id) {
    const [where, i] = String(a).split(':'), c = caseList(where)[+i];
    if (!G || !c || !c.items[id] || (where === 'stash' && G.loc !== 'hideout')) return;
    mutate(() => {
      const want = c.items[id];
      const k = where === 'stash' ? stashFit(id, want) : want;
      if (k <= 0) return toast(toastMsg.stash);
      addTo(c.items, id, -k);
      addTo(where === 'stash' ? G.stash : P().inv, id, k);
      if (k < want) toast(`${k}개만 꺼냈다. 창고가 가득 찼다.`);
    });
  }
  // 거점에서 케이스를 통째로 창고에 두거나 챙긴다
  function caseMove(a) {
    const [where, i] = String(a).split(':'), list = caseList(where), c = list[+i];
    if (!G || !c || G.loc !== 'hideout') return;
    mutate(() => {
      if (where === 'inv') {
        if (stashSlots() + 1 > stashCap()) return toast(toastMsg.stash);
        list.splice(+i, 1);
        G.stashCases.push(c);
      } else {
        if (carried() + caseWeight([c]) * weightEff() > carryLimit() * C.pickupHardCap + 1e-6) return toast(toastMsg.carry);
        list.splice(+i, 1);
        P().cases.push(c);
      }
    });
  }
  // 빈 케이스만 버린다
  function caseDrop(a) {
    const [where, i] = String(a).split(':'), list = caseList(where), c = list[+i];
    if (!G || !c || (where === 'stash' && G.loc !== 'hideout')) return;
    if (caseCount(c)) return toast('안에 든 것을 먼저 꺼내야 버릴 수 있다.');
    confirmBox('케이스 버리기', `${eul(ITEMS[c.id].name)} 버린다. 영영 사라진다.`, '버린다', () => mutate(() => { list.splice(+i, 1); }));
  }
  function casesSection(where) {
    const list = caseList(where);
    if (!list.length) return '';
    const atHome = G.loc === 'hideout';
    const rows = list.map((c, i) => {
      const it = ITEMS[c.id], n = caseCount(c), key = `${where}:${i}`;
      const head = `<div class="case-head"><div class="item-name"><span class="rdot r${it.r}"></span><span class="rname r${it.r}">${esc(it.name)}</span><span class="qty">${n}/${it.case.cap}</span></div>
        <div class="item-meta">${esc(caseFitText(c.id))} · ${fmtKg(it.w + mapWeight(c.items))}kg${where === 'stash' ? ' · 창고 1칸' : ''}</div>
        <div class="item-btns">${atHome ? btn(where === 'inv' ? '창고에 두기' : '챙기기', 'caseMove', key) : ''}${n ? '' : btn('버리기', 'caseDrop', key, '', 'ghost discard')}</div></div>`;
      const inner = sortedIds(c.items).map((id) => {
        const x = ITEMS[id];
        const use = isUsable(x) ? btn(useLabel(x), 'caseUse', key, id, isRisky(x) ? 'danger' : 'primary', where === 'stash' && !atHome) : '';
        return itemRow(id, c.items[id], use + btn('꺼내기', 'caseTake', key, id));
      }).join('');
      return `<li class="case-box">${head}${inner ? `<ul class="items">${inner}</ul>` : '<p class="empty">비어 있다.</p>'}</li>`;
    }).join('');
    const note = where === 'inv' ? '들고 다니는 케이스 속 물건은 싸우는 중에도 바로 꺼내 쓰고, 약탈자에게 빼앗기지 않는다. 제작·거래에 쓰려면 꺼내야 한다.' : '창고 케이스는 안에 얼마나 들었든 창고 1칸만 차지한다.';
    return `<section class="section"><div class="section-head"><h2>${where === 'inv' ? '들고 있는 케이스' : '창고 케이스'}</h2><span class="meta">${list.length}개</span></div><ul class="cases">${rows}</ul><p class="note">${note}</p></section>`;
  }
  // 싸우는 중·사건 중에 꺼내 쓸 수 있는 것
  function caseQuickBtns() {
    const out = [];
    P().cases.forEach((c, i) => {
      for (const id of sortedIds(c.items)) {
        const x = ITEMS[id];
        if (isUsable(x) && !x.useMinutes) out.push(btn(`${useLabel(x)} · ${x.name} ×${c.items[id]}`, 'caseUse', `inv:${i}`, id, isRisky(x) ? 'danger' : ''));
      }
    });
    return out.length ? `<div class="case-quick"><span class="fac-next-label">케이스에서 바로 꺼내 쓰기</span><div class="row-btns">${out.join('')}</div></div>` : '';
  }

  // ---------- 아이템 옮기기 (시간 소모 없음) ----------
  const toastMsg = { carry: '더 들 수 없다. 짐이 한계의 1.5배를 넘는다.', stash: '창고가 가득 찼다.' };
  function take(id, n) {
    if (!G || G.loc === 'hideout') return;
    mutate(() => {
      const g = G.locs[G.loc].ground;
      const want = n === 'all' ? g[id] || 0 : Math.min(1, g[id] || 0);
      const k = carryFit(id, want);
      if (k <= 0) return toast(toastMsg.carry);
      addTo(g, id, -k);
      addTo(P().inv, id, k);
      if (k < want) toast(`${k}개만 챙겼다. 더는 들 수 없다.`);
    });
  }
  function takeAll() {
    if (!G || G.loc === 'hideout') return;
    mutate(() => {
      const g = G.locs[G.loc].ground;
      const ids = Object.keys(g).sort((a, b) => (ITEMS[b].r - ITEMS[a].r) || (ITEMS[a].w - ITEMS[b].w));
      let left = false;
      for (const id of ids) {
        const k = carryFit(id, g[id]);
        if (k > 0) { addTo(g, id, -k); addTo(P().inv, id, k); }
        if (g[id]) left = true;
      }
      if (left) toast('다 챙기지 못했다. 더는 들 수 없다.');
    });
  }
  function store(id, n) {
    if (!G || G.loc !== 'hideout') return;
    mutate(() => {
      const have = P().inv[id] || 0;
      const want = n === 'all' ? have : Math.min(1, have);
      const k = stashFit(id, want);
      if (k <= 0) return toast(toastMsg.stash);
      addTo(P().inv, id, -k);
      addTo(G.stash, id, k);
      if (k < want) toast(`${k}개만 넣었다. 창고가 가득 찼다.`);
    });
  }
  function storeAll() {
    if (!G || G.loc !== 'hideout') return;
    mutate(() => {
      let left = false, kept = 0;
      for (const id of Object.keys(P().inv)) {
        if (P().locked[id]) { kept += 1; continue; }
        const k = stashFit(id, P().inv[id]);
        if (k > 0) { addTo(P().inv, id, -k); addTo(G.stash, id, k); }
        if (P().inv[id]) left = true;
      }
      if (left) toast('창고가 가득 차서 일부는 그대로 들고 있다.');
      else if (kept) toast(`잠근 물건 ${kept}종은 그대로 들고 있다.`);
    });
  }
  function toggleLock(id) {
    if (!G || !ITEMS[id]) return;
    const L = P().locked;
    if (L[id]) delete L[id]; else L[id] = true;
    persist();
    render();
  }
  function retrieve(id, n) {
    if (!G || G.loc !== 'hideout') return;
    mutate(() => {
      const have = G.stash[id] || 0;
      const want = n === 'all' ? have : Math.min(1, have);
      const k = carryFit(id, want);
      if (k <= 0) return toast(toastMsg.carry);
      addTo(G.stash, id, -k);
      addTo(P().inv, id, k);
      if (k < want) toast(`${k}개만 꺼냈다. 더는 들 수 없다.`);
    });
  }
  // 버리기: 물건을 영영 없앤다 (바깥에서 '숨기기'를 쓰면 그 장소에 남는다)
  function discard(id, from, n) {
    const src = from === 'stash' && G.loc === 'hideout' ? G.stash : P().inv;
    const have = src[id] || 0;
    const k = n === 'all' ? have : Math.min(1, have);
    if (!k) return;
    run(() => {
      addTo(src, id, -k);
      log(`${from === 'stash' ? '창고에서 ' : ''}${ITEMS[id].name} ${k}개를 버렸다.`);
    });
  }
  function confirmDiscard(id, from) {
    if (!G || !ITEMS[id]) return;
    if (ITEMS[id].keep) return toast('세상에 하나뿐인 것이다. 버릴 수 없다.');
    if (G.pending) return toast('눈앞의 상황부터 해결해야 한다.');
    const src = from === 'stash' && G.loc === 'hideout' ? G.stash : P().inv;
    const have = src[id] || 0;
    if (!have) return;
    const it = ITEMS[id];
    const body = [`${from === 'stash' ? '창고에' : '소지품에'} ${have}개 있다. 개당 ${fmtKg(it.w)}kg.`, '버린 물건은 사라지고 되돌릴 수 없다.'];
    if (from === 'inv' && G.loc !== 'hideout') body.push('나중에 다시 가져가고 싶다면 버리지 말고 "숨기기"를 쓰자. 숨긴 물건은 이 장소에 남는다(털릴 수도 있다).');
    const buttons = [{ label: '그만둔다' }, { label: '1개 버리기', danger: true, onClick: () => discard(id, from, '1') }];
    if (have > 1) buttons.push({ label: `전부 버리기 (${have}개)`, danger: true, onClick: () => discard(id, from, 'all') });
    showModal({ title: `${eul(it.name)} 버릴까?`, body, buttons });
  }

  // 해체: 장비를 재료로 되돌린다. 흔한 재료는 지능만큼 더 나오고(소수점은 확률로),
  // 고급 이상 재료는 개수마다 확률로 건진다. 거점에서는 창고로, 바깥에서는 발밑에 놓인다
  const isRareMat = (id) => ITEMS[id].r >= 1;
  const salvageMult = () => 1 + lvl('intellect') * SL.intellect.yieldPerLv;
  function rareSalvage(lv) { return Math.min(0.95, D.dismantle.rareBase + lv * SL.intellect.rarePerLv); }
  const dismantleMinutes = (n) => Math.max(5, Math.round(D.dismantle.minutes * n * craftTimeMult() * timeMult()));
  function salvageRoll(id, got) {
    const mult = salvageMult(), rare = rareSalvage(lvl('intellect'));
    for (const [m, n] of ITEMS[id].salvage) {
      let k = 0;
      if (isRareMat(m)) { for (let i = 0; i < n; i++) if (chance(rare)) k += 1; }
      else { const x = n * mult; k = Math.floor(x) + (chance(x - Math.floor(x)) ? 1 : 0); }
      if (k) addTo(got, m, k);
    }
  }
  function salvageText(id) {
    const mult = salvageMult(), rare = pct(rareSalvage(lvl('intellect')));
    return ITEMS[id].salvage.map(([m, n]) => {
      if (isRareMat(m)) return `${ITEMS[m].name} ${n}개 (고급 · 개당 ${rare}% 확률)`;
      const lo = Math.floor(n * mult + 1e-9), hi = Math.ceil(n * mult - 1e-9);
      return `${ITEMS[m].name} ${lo === hi ? lo : `${lo}~${hi}`}개`;
    }).join(', ');
  }
  function askDismantle(id, from) {
    const it = ITEMS[id];
    if (!G || !it || !it.salvage) return;
    if (G.pending) return toast('눈앞의 상황부터 해결해야 한다.');
    const src = from === 'stash' && G.loc === 'hideout' ? G.stash : P().inv;
    const have = src[id] || 0;
    if (!have) return;
    const lv = lvl('intellect');
    const body = [
      `뜯어서 재료로 되돌린다. 해체한 ${it.cat === 'bag' ? '가방은' : it.cat === 'armor' ? '옷은' : it.cat === 'weapon' ? '무기는' : '물건은'} 사라진다.`,
      ['나오는 재료', salvageText(id)],
      `지능 LV ${lv}: 수량 +${Math.round((salvageMult() - 1) * 100)}% · 고급 재료 회수 ${pct(rareSalvage(lv))}%`,
    ];
    if (G.loc !== 'hideout') body.push('바깥에서 해체하면 나온 재료는 발밑에 놓인다.');
    const buttons = [{ label: '그만둔다' }, { label: `해체한다 · ${fmtDur(dismantleMinutes(1))}`, primary: true, onClick: () => dismantle(id, from, 1) }];
    if (have > 1) buttons.push({ label: `전부 해체 (${have}개) · ${fmtDur(dismantleMinutes(have))}`, onClick: () => dismantle(id, from, have) });
    showModal({ title: `${eul(it.name)} 해체할까?`, body, buttons });
  }
  function dismantle(id, from, n) {
    const it = ITEMS[id];
    if (!G || !it || !it.salvage) return;
    const src = () => (from === 'stash' && G.loc === 'hideout' ? G.stash : P().inv);
    if (!((src()[id] || 0) >= n)) return;
    run(() => {
      const mins = dismantleMinutes(n);
      passTime(mins, 'idle');
      if (G.dead) return;
      const m = src();
      n = Math.min(n, m[id] || 0);
      if (!n) return;
      addTo(m, id, -n);
      const got = {};
      for (let i = 0; i < n; i++) salvageRoll(id, got);
      gainXp('intellect', SK.xp.dismantle * n);
      let where = '';
      if (G.loc === 'hideout') { if (storeOrCarry(got)) where = ' 창고가 차서 일부는 소지품으로 옮겼다.'; }
      else if (Object.keys(got).length) {
        for (const k in got) addTo(G.locs[G.loc].ground, k, got[k]);
        where = ' 재료는 발밑에 놓았다.';
      }
      const lost = it.salvage.filter(([x]) => isRareMat(x) && !got[x]).map(([x]) => ITEMS[x].name);
      const what = n > 1 ? `${it.name} ${n}개를` : eul(it.name);
      log(`${what} 해체했다: ${Object.keys(got).length ? listText(got) : '건진 게 없다'} (${fmtDur(mins)})${lost.length ? ` 망가져서 못 건졌다: ${lost.join(', ')}.` : ''}${where}`, 'good');
    });
  }

  // 장착: 큰 무기 2칸, 작은 무기 1칸, 옷 3겹, 가방 1개. 칸이 차 있으면 무엇과 바꿀지 묻는다
  const sizeOf = (id) => ITEMS[id].size || 'large';
  function equip(id, from) {
    const it = ITEMS[id];
    if (!G || !it || !EQ_CATS.includes(it.cat)) return;
    if (G.pending) return toast('눈앞의 상황부터 해결해야 한다.');
    const src = from === 'stash' && G.loc === 'hideout' ? G.stash : P().inv;
    if (!src[id]) return;
    const p = P();
    let list = null, max = 1;
    if (it.cat === 'weapon' && sizeOf(id) === 'large') { list = p.weaponsL; max = EQ.large; }
    else if (it.cat === 'armor') { list = p.armors; max = EQ.layers; }
    if (list && list.length >= max) {
      showModal({
        title: '무엇과 바꿀까?',
        body: [it.cat === 'armor' ? `옷은 ${max}겹까지 껴입을 수 있다.` : `큰 무기는 ${max}개까지 들 수 있다.`, `${eul(it.name)} ${it.cat === 'armor' ? '입는' : '드는'} 대신 내려 둘 것을 고르자.`],
        stack: true,
        buttons: [...list.map((old, i) => ({ label: `${ITEMS[old].name} 대신`, onClick: () => doEquip(id, from, i) })), { label: '그만둔다' }],
      });
      return;
    }
    doEquip(id, from, -1);
  }
  function doEquip(id, from, replaceAt) {
    const it = ITEMS[id];
    const src = from === 'stash' && G.loc === 'hideout' ? G.stash : P().inv;
    if (!src[id]) return;
    const overBefore = thickOver();
    let layered = -1;
    mutate(() => {
      const p = P();
      addTo(src, id, -1);
      let old = null, oldMods = null, key = null;
      if (it.cat === 'bag') { old = p.bag; p.bag = id; }
      else if (it.cat === 'gear') { old = p[it.gear]; p[it.gear] = id; }
      else if (it.cat === 'weapon' && sizeOf(id) === 'small') { old = p.weaponS; oldMods = p.modsS; p.weaponS = id; p.modsS = {}; key = 'S'; }
      else {
        const list = it.cat === 'armor' ? p.armors : p.weaponsL;
        if (replaceAt >= 0) { old = list[replaceAt]; list[replaceAt] = id; } else list.push(id);
        if (it.cat === 'weapon') {
          p.modsL = p.modsL || [];
          const i = replaceAt >= 0 ? replaceAt : list.length - 1;
          oldMods = p.modsL[i];
          p.modsL[i] = {};
          key = `L${i}`;
        }
      }
      if (old) addTo(src, old, 1);
      // 내려놓는 총의 부착물은 떼어서 총과 같은 곳에 둔다
      for (const x of modIds(oldMods)) putOne(src, x);
      const re = key && it.slots ? reattach(key) : 0;
      if (it.cat === 'bag') toast(`${eul(it.name)} 멨다. 중량 한계 ${fmtKg(carryLimit())}kg`);
      else if (it.cat === 'gear') toast(`${eul(it.name)} ${it.gear === 'radio' ? '챙겼다' : '꼈다'}. ${gearText(it)}`);
      else if (it.cat === 'armor') {
        if (thickOver() > overBefore) layered = replaceAt >= 0 ? replaceAt : p.armors.length - 1;
        else if (p.armors.length >= 2) toast(`${eul(it.name)} 겹쳐 입었다. 옷 ${p.armors.length}겹 · 받는 피해 -${pct(armorDef())}%${thickOver() ? ' · 껴입어서 둔하다' : ''}`);
        else toast(`${eul(it.name)} 입었다. 받는 피해 -${pct(armorDef())}%`);
      } else toast(`${eul(it.name)} 들었다.${re ? ` 전에 쓰던 부착물 ${re}개를 다시 달았다.` : ''}`);
    });
    if (layered >= 0) showLayered(id, layered);
  }
  // 창고에 자리가 없으면 소지품으로
  function putOne(m, id) {
    if (m === G.stash && stashFit(id, 1) < 1) addTo(P().inv, id, 1);
    else addTo(m, id, 1);
  }
  const modsRef = (key) => {
    const p = P();
    if (key === 'S') return (p.modsS = p.modsS || {});
    p.modsL = p.modsL || [];
    const i = +key.slice(1);
    return (p.modsL[i] = p.modsL[i] || {});
  };
  // 그 총에 마지막으로 쓰던 구성대로, 가진 부착물을 다시 단다 (소지품, 거점이면 창고에서)
  function reattach(key) {
    const gid = gunAt(key), build = G.gunBuild && G.gunBuild[gid];
    if (!build) return 0;
    const m = modsRef(key);
    let n = 0;
    for (const slot of ITEMS[gid].slots) {
      const want = build[slot];
      if (!want || m[slot] || !modFits(want, gid, slot)) continue;
      const src = P().inv[want] > 0 ? P().inv : G.loc === 'hideout' && G.stash[want] > 0 ? G.stash : null;
      if (!src) continue;
      addTo(src, want, -1);
      m[slot] = want;
      n += 1;
    }
    return n;
  }
  // 그 칸에 달 수 있는 부착물 (소지품, 거점이면 창고)
  function modChoices(key, slot) {
    const gid = gunAt(key), cur = modsAt(key)[slot], out = [];
    const srcs = [['inv', P().inv], ...(G.loc === 'hideout' ? [['stash', G.stash]] : [])];
    for (const [from, m] of srcs) for (const id of sortedIds(m)) if (id !== cur && m[id] > 0 && modFits(id, gid, slot) && !out.some((o) => o.id === id)) out.push({ id, from });
    return out;
  }
  const modEffect = (it) => [it.win ? `승률 +${it.win}%` : '', it.night ? `밤 승률 +${it.night}%` : '',
    ...Object.entries(it.vs || {}).map(([e, v]) => `${ENEMIES[e].name} 상대 +${v}%`), it.ammo ? `쏠 때마다 탄약 ${it.ammo}발 더 씀` : '', it.quiet ? '총소리 없음' : ''].filter(Boolean).join(' · ');
  function attachMod(key, slot) {
    if (!G) return;
    if (G.pending) return toast('눈앞의 상황부터 해결해야 한다.');
    const gid = gunAt(key);
    if (!gid || !(ITEMS[gid].slots || []).includes(slot)) return;
    const list = modChoices(key, slot);
    if (!list.length) return toast(`${ITEMS[gid].name}의 ${GM_SLOTS[slot]}에 달 부착물이 없다.`);
    const cur = modsAt(key)[slot];
    showModal({
      title: `${ITEMS[gid].name} · ${GM_SLOTS[slot]}`,
      body: [cur ? `지금: ${ITEMS[cur].name} (${modEffect(ITEMS[cur])}). 바꾸면 떼어 낸 것은 ${G.loc === 'hideout' ? '창고에' : '소지품에'} 둔다.` : '무엇을 달까?'],
      stack: true,
      buttons: [...list.map(({ id, from }) => ({ label: `${ITEMS[id].name} · ${modEffect(ITEMS[id]) || '효과 없음'} · ${from === 'stash' ? '창고' : '소지품'}`, onClick: () => doAttach(key, slot, id, from) })), { label: '그만둔다' }],
    });
  }
  function doAttach(key, slot, mid, from) {
    const gid = gunAt(key);
    const src = from === 'stash' && G.loc === 'hideout' ? G.stash : P().inv;
    if (!gid || !(src[mid] > 0) || !modFits(mid, gid, slot)) return;
    mutate(() => {
      const m = modsRef(key), old = m[slot];
      addTo(src, mid, -1);
      if (old) putOne(G.loc === 'hideout' ? G.stash : P().inv, old);
      m[slot] = mid;
      G.gunBuild = G.gunBuild || {};
      G.gunBuild[gid] = { ...m };
      toast(`${ITEMS[gid].name}에 ${eul(ITEMS[mid].name)} 달았다.`);
    });
  }
  function detachMod(key, slot) {
    const gid = gunAt(key), m = gid ? modsAt(key) : {}, mid = m[slot];
    if (!mid) return;
    mutate(() => {
      const mm = modsRef(key);
      delete mm[slot];
      putOne(G.loc === 'hideout' ? G.stash : P().inv, mid);
      G.gunBuild = G.gunBuild || {};
      G.gunBuild[gid] = { ...mm };
      toast(`${ITEMS[gid].name}에서 ${eul(ITEMS[mid].name)} 뗐다.`);
    });
  }
  // 두께 합이 넘쳐 몸이 둔해졌을 때만 무엇이 나빠지는지 보여 준다
  function showLayered(id, idx) {
    const over = thickOver(), n = P().armors.length;
    showModal({
      title: '너무 껴입었다',
      body: [
        `옷 ${n}겹 · 두께 ${thickness()}. 몸이 둔해졌다.`,
        ['보호', `받는 피해 -${pct(armorDef())}% · 디버프 확률 -${pct(armorDbf())}%`],
        ['둔해짐', `행동시간 +${Math.round(over * EQ.perTime * 100)}% · 스테미너 소모 +${Math.round(over * EQ.perStamina * 100)}% · 승률 -${over * EQ.perWin}% · 도망 확률 -${over * EQ.perFlee}%`],
        `두께 합이 ${EQ.freeThickness} 이하면 둔해지지 않는다. 얇은 옷으로 바꾸거나 한 벌 벗으면 풀린다.`,
      ],
      buttons: [{ label: '그대로 입는다', primary: true }, { label: `${eul(ITEMS[id].name)} 벗는다`, onClick: () => unequip('A', idx) }],
    });
  }
  // 장비 칸의 [착용]/[바꾸기]: 그 칸에 들어갈 물건을 소지품(거점이면 창고까지)에서 골라 바로 넣는다
  const SLOT_FIT = {
    L: (it) => it.cat === 'weapon' && (it.size || 'large') === 'large',
    S: (it) => it.cat === 'weapon' && it.size === 'small',
    A: (it) => it.cat === 'armor',
    bag: (it) => it.cat === 'bag',
    radio: (it) => it.gear === 'radio',
    ear: (it) => it.gear === 'ear',
  };
  function slotChoices(kind) {
    const out = [], seen = new Set();
    const srcs = [['inv', P().inv], ...(G.loc === 'hideout' ? [['stash', G.stash]] : [])];
    for (const [from, m] of srcs) {
      for (const id of Object.keys(m)) {
        if (m[id] > 0 && !seen.has(id) && SLOT_FIT[kind](ITEMS[id])) { seen.add(id); out.push({ id, from }); }
      }
    }
    const power = (it) => it.atk || it.def || it.bag || (it.gear ? it.r : 0) || 0;
    return out.sort((a, b) => power(ITEMS[b.id]) - power(ITEMS[a.id]));
  }
  function choiceLabel({ id, from }) {
    const it = ITEMS[id];
    const stat = it.cat === 'weapon' ? `${atkText(id)}${ammoText(id)}` : it.cat === 'armor' ? `피해 -${pct(it.def)}% · 두께 ${it.thick || 1}` : it.cat === 'gear' ? gearText(it) : `+${it.bag}kg`;
    return `${it.name} · ${stat} · ${fmtKg(it.w)}kg${from === 'stash' ? ' · 창고' : ''}`;
  }
  function pickSlot(kind, idx) {
    if (!G || !SLOT_FIT[kind]) return;
    if (G.pending) return toast('눈앞의 상황부터 해결해야 한다.');
    const list = slotChoices(kind);
    if (!list.length) return toast(G.loc === 'hideout' ? '소지품에도 창고에도 넣을 만한 게 없다.' : '소지품에 넣을 만한 게 없다.');
    const p = P();
    const cur = kind === 'L' ? p.weaponsL[idx] : kind === 'A' ? p.armors[idx] : kind === 'S' ? p.weaponS : GEAR_SLOT[kind] ? p[kind] : p.bag;
    const replaceAt = (kind === 'L' || kind === 'A') && cur ? idx : -1;
    const title = { L: `큰 무기 ${idx + 1}칸에 무엇을 들까?`, S: '작은 무기 칸에 무엇을 들까?', A: `${idx + 1}겹째에 무엇을 입을까?`, bag: '어떤 가방을 멜까?', radio: '어떤 무전기를 챙길까?', ear: '무엇을 귀에 낄까?' }[kind];
    showModal({
      title,
      body: [cur ? `지금: ${ITEMS[cur].name}. 고르면 이것과 바꾼다.` : '좋은 것부터 보여 준다.'],
      stack: true,
      buttons: [...list.map((c, i) => ({ label: choiceLabel(c), primary: i === 0, onClick: () => doEquip(c.id, c.from, replaceAt) })), { label: '그만둔다' }],
    });
  }
  // kind: 'L'(큰 무기), 'S'(작은 무기), 'A'(옷), 'bag'
  function unequip(kind, idx) {
    if (!G) return;
    const p = P();
    let id = null;
    if (kind === 'L') id = p.weaponsL[idx];
    else if (kind === 'A') id = p.armors[idx];
    else if (kind === 'S') id = p.weaponS;
    else if (kind === 'bag') id = p.bag;
    else if (GEAR_SLOT[kind]) id = p[kind];
    if (!id) return;
    mutate(() => {
      let mods = null;
      if (kind === 'L') { p.weaponsL.splice(idx, 1); mods = (p.modsL || []).splice(idx, 1)[0]; }
      else if (kind === 'A') p.armors.splice(idx, 1);
      else if (kind === 'S') { p.weaponS = null; mods = p.modsS; p.modsS = {}; }
      else if (GEAR_SLOT[kind]) p[kind] = null;
      else p.bag = null;
      const to = G.loc === 'hideout' && stashFit(id, 1) === 1 ? G.stash : P().inv;
      addTo(to, id, 1);
      // 부착물도 떼어서 총과 같은 곳에 둔다 (다시 들면 그대로 다시 단다)
      const ms = modIds(mods);
      for (const x of ms) putOne(to, x);
      if (ms.length) toast(`${eul(ITEMS[id].name)} 내려놓았다. 부착물 ${ms.length}개도 떼어 같이 두었다.`);
    });
  }

  // ---------- 깊은 잠: 세미 초기화 ----------
  // 지어 둔 시설(1레벨로)과 스킬(-5)만 남고, 나머지는 새 게임처럼 처음으로 돌아간다
  const DS = ST.deepSleep;
  function askDeepSleep() {
    if (!G || G.dead) return;
    if (G.pending) return toast('눈앞의 상황부터 해결해야 한다.');
    const built = FAC_ORDER.filter((id) => facLv(id) > 0).map((id) => `${FAC[id].name} ${facLv(id)}→${Math.min(facLv(id), DS.facLevel)}`);
    const sks = SKILL_KEYS.filter((k) => G.skills[k].lv > 0).map((k) => `${SL[k].name} ${G.skills[k].lv}→${Math.max(0, G.skills[k].lv - DS.skillLoss)}`);
    showModal({
      title: '깊은 잠에 빠질까?',
      body: [
        DS.ask,
        ['남는 시설', built.length ? built.join(', ') : '지어 둔 시설이 없다'],
        ['남는 스킬', sks.length ? sks.join(', ') : '모두 LV 0이다'],
        ['사라지는 것', '지닌 물건, 장비, 창고, 숨겨 둔 물건, 기록, 인연, 라디오에서 들은 것, 생존 기록. 모두 새 게임처럼 처음으로 돌아간다.'],
        ['날짜', `DAY ${dayOf(G.time)} → DAY 1 아침`],
        ...(DSR ? [['깨어나며 얻는 것', `${dsStacks() < DSR.maxStacks ? `${dsRewardText(dsStacks() + 1)} (영구)` : `${eun(DSR.name)} 이미 가장 짙다 (${dsRewardText(dsStacks())})`} · 창고에 기초 물자: ${itemsText(DSR.kit)}`]] : []),
      ],
      buttons: [{ label: '그만둔다' }, { label: '깊은 잠에 빠진다', danger: true, onClick: deepSleep }],
    });
  }
  const dsRewardText = (n) => `${DSR.name} ${n}/${DSR.maxStacks}: 스킬 경험치 +${Math.round(n * DSR.xpPerStack * 100)}%, 최대 HP +${n * DSR.hpPerStack}`;
  function deepSleep() {
    if (!G || G.dead || G.pending) return;
    const old = G;
    G = newState();
    for (const id of FAC_ORDER) G.hideout.fac[id] = Math.min(old.hideout.fac[id] || 0, DS.facLevel);
    for (const k of SKILL_KEYS) G.skills[k] = { lv: Math.max(0, old.skills[k].lv - DS.skillLoss), xp: 0, today: 0 };
    G.player.hp = maxHp();
    G.player.stamina = maxStamina();
    G.stats.deepSleeps = (old.stats.deepSleeps || 0) + 1;
    // 보상: 흔적이 한 겹 더 쌓이고(최대 HP가 늘었으니 다시 채운다), 창고에 기초 물자
    if (DSR) { G.player.hp = maxHp(); storeOrCarry(Object.fromEntries(DSR.kit)); }
    DS.wake.forEach((t) => log(t, 'story'));
    log(`깊은 잠에서 깨어났다. 오늘이 첫날이다. (시설 ${DS.facLevel}레벨, 스킬 -${DS.skillLoss}만 남았다)`, 'story');
    if (DSR) log(`${DSR.text} [${dsRewardText(dsStacks())} · 창고에 ${itemsText(DSR.kit)}]`, 'good');
    ui.tab = 'scene';
    ui.menuView = null;
    ui.recordView = 'people';
    persist();
    render();
    window.scrollTo(0, 0);
    showModal({ title: DS.title, body: DSR ? [...DS.wake, DSR.text, ['얻은 것', `${dsRewardText(dsStacks())} · 창고에 ${itemsText(DSR.kit)}`]] : DS.wake, buttons: [{ label: DS.button, primary: true }] });
  }

  // ---------- 죽음: 쓰러진 뒤에 고른다 ----------
  const carriedCount = () => Object.values(P().inv).reduce((a, b) => a + b, 0) + P().cases.reduce((a, c) => a + 1 + caseCount(c), 0) + equippedIds().length + [...(P().modsL || []), P().modsS].reduce((a, m) => a + modIds(m).length, 0);

  function showDeathChoice() {
    if (!G || !G.dead) return;
    const lost = carriedCount();
    showModal({
      title: '쓰러졌다',
      body: [
        ST.deathTagline,
        `${dayOf(G.time)}일차 ${clockStr(G.time)}, ${placeName(G.loc)}에서 ${G.deathCause}.`,
        `버틴 시간 ${survivedText()} · 수색 ${G.stats.searches}번 · 쓰러뜨린 적 ${G.stats.kills} · 모은 기록 ${G.fragments.length}/${ST.fragments.length}`,
        '눈앞이 캄캄해진다. 이대로 끝일까, 아니면…',
        ['악몽에서 깨어나기', `${lost ? `지니고 있던 물건 ${lost}개를 모두 잃고 ` : ''}다음 날 아침 거점에서 깨어난다. 거점과 창고는 남는다. 몸의 이상은 사라지지만 ${DB.nightmare.name}(${nightmareText()})이 남는다.`],
        G.deathKind === 'infection' ? ['그들이 되다', '감염에 몸을 내준다. 엔딩을 본 뒤 새로 시작하거나 깨어나 계속할 수 있다.'] : ['운명을 받아들이기', '생존 기록을 여기서 끝낸다. 세이브가 삭제된다.'],
      ],
      buttons: [
        G.deathKind === 'infection' ? { label: '그들이 되다', danger: true, onClick: () => showEnding('turned') } : { label: '운명을 받아들이기', onClick: confirmFate },
        { label: '악몽에서 깨어나기', primary: true, onClick: wakeFromNightmare },
      ],
    });
  }
  // 이번에 깨어나면 붙을 후유증 설명 (이미 있으면 더 길어진다)
  function nightmareText() {
    const NM = DB.nightmare, d = P().debuffs.nightmare;
    const left = Math.min(NM.maxHours * 60, (d ? d.left : 0) + NM.hours * 60);
    return `${fmtLeft(left)} 동안 최대 HP ${Math.round((1 - NM.hpMult) * 100)}%↓, 최대 스테미너 ${Math.round((1 - NM.staminaMult) * 100)}%↓, 승률 ${NM.win}%${d ? ' · 이미 있어서 더 길어진다' : ''}`;
  }
  function survivedText() {
    const m = Math.max(0, G.time - C.startMinute), d = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60);
    return d ? `${d}일 ${h}시간` : `${h}시간`;
  }
  function confirmFate() {
    showModal({
      title: '운명을 받아들일까',
      body: ['세이브가 삭제되고 되돌릴 수 없다.'],
      buttons: [
        { label: '돌아가기', onClick: showDeathChoice },
        { label: '받아들인다', primary: true, onClick: acceptFate },
      ],
    });
  }
  function acceptFate() {
    if (!G || !G.dead) return;
    const day = dayOf(G.time), cause = G.deathCause, s = G.stats, lived = survivedText(), frags = G.fragments.length;
    Store.clearAll();
    G = null;
    ui.screen = 'title';
    ui.titleView = 'main';
    render();
    window.scrollTo(0, 0);
    showModal({
      title: '생존 기록 끝',
      body: [ST.deathTagline, `${day}일차, ${cause}. 버틴 시간 ${lived}.`, `수색 ${s.searches}회 · 쓰러뜨린 적 ${s.kills} · 악몽에서 깨어난 횟수 ${s.deaths}회 · 모은 기록 ${frags}/${ST.fragments.length}`, '세이브는 삭제되었다.'],
      buttons: [{ label: '확인', primary: true }],
    });
  }
  function wakeFromNightmare() {
    if (!G || !G.dead) return;
    const day = dayOf(G.time);
    const p = P();
    const NM = DB.nightmare, nmLeft = p.debuffs.nightmare ? p.debuffs.nightmare.left : 0;
    // 하나뿐인 것(핵심 데이터·치료제 시제품)은 잃지 않고 창고에 돌아와 있다
    const kept = new Set([...Object.keys(p.inv), ...p.cases.flatMap((c) => Object.keys(c.items))].filter((id) => ITEMS[id] && ITEMS[id].keep));
    for (const id of kept) addTo(G.stash, id, (p.inv[id] || 0) + p.cases.reduce((n, c) => n + (c.items[id] || 0), 0));
    p.inv = {};
    p.cases = [];
    p.weaponsL = [];
    p.weaponS = null;
    p.modsL = [];
    p.modsS = {};
    p.armors = [];
    p.bag = null;
    p.radio = null;
    p.ear = null;
    p.debuffs = {};
    p.buffs = {};
    G.stats.deaths += 1;
    const r = C.respawn;
    // 쓰러져 있던 동안에도 거점의 공사·제작·정수기·발전기는 돌아간다
    const hmsgs = [];
    const fromDay = dayOf(G.time);
    const until = day * 1440 + r.hour * 60;
    while (G.time < until) {
      const dt = Math.min(10, until - G.time);
      hideoutTick(dt, hmsgs);
      G.time += dt;
    }
    // 일부러 쓰러져서 병을 고치지 못하게: 디버프는 사라지지만 악몽의 후유증이 붙는다
    p.debuffs.nightmare = { left: Math.min(NM.maxHours * 60, nmLeft + NM.hours * 60) };
    Object.assign(p, { hunger: r.hunger, thirst: r.thirst, fatigue: r.fatigue });
    p.hp = Math.min(r.hp, maxHp());
    p.stamina = Math.min(r.stamina, maxStamina());
    G.loc = 'hideout';
    G.pending = null;
    G.dead = false;
    G.deathCause = null;
    G.deathKind = null;
    ui.sel = null;
    for (let d = fromDay + 1; d <= dayOf(G.time); d++) residentsDaily();
    checkRefill();
    log(journal(dayOf(G.time)), 'story');
    log(`${dayOf(G.time)}일차 아침, 거점에서 식은땀을 흘리며 눈을 떴다. 악몽이었을까. 몸에 지니고 있던 것은 모두 사라졌다.`, 'warn');
    log(`${NM.onset} ${fmtLeft(p.debuffs.nightmare.left)} 동안 최대 HP ×${NM.hpMult}, 최대 스테미너 ×${NM.staminaMult}, 승률 ${NM.win}%.`, 'bad');
    for (const [t, k] of hmsgs) log(t, k);
    storyOnce('firstWake', ST.moments.firstWake);
    ui.tab = 'scene';
    persist();
    render();
    window.scrollTo(0, 0);
  }

  // ---------- 저장 ----------
  const Store = {
    ref: null, checked: false, ready: false, hold: false, gen: 0, remoteSave: null, pending: null, writing: false, timer: 0, retried: false, status: '',
    readLocal() {
      try { const raw = localStorage.getItem(LOCAL_KEY); return raw ? JSON.parse(raw) : null; } catch (e) { return null; }
    },
    writeLocal(save) { try { localStorage.setItem(LOCAL_KEY, JSON.stringify(save)); } catch (e) { /* 저장소 막힘 */ } },
    clearLocal() { try { localStorage.removeItem(LOCAL_KEY); } catch (e) { /* 무시 */ } },
    async init() {
      try {
        const c = window.claude;
        if (!c || typeof c.use !== 'function') return;
        const [db, user] = await Promise.all([c.use('db'), c.use('user')]);
        if (!db || !user) return;
        const uid = await user.id();
        if (!uid) return;
        const ref = db.doc('data/users/' + uid + '/save');
        const snap = await ref.get();
        this.ref = ref;
        if (snap.exists) {
          const d = snap.data();
          if (d && typeof d.json === 'string') {
            try { this.remoteSave = { v: d.v, savedAt: d.savedAt || 0, state: JSON.parse(d.json) }; } catch (e) { /* 손상된 세이브 */ }
          }
        }
      } catch (e) {
        this.ref = null;
      }
    },
    queueRemote(save) {
      if (!this.ref || this.hold) return;
      this.pending = save;
      clearTimeout(this.timer);
      this.timer = setTimeout(() => this.flush(), 1500);
    },
    flushNow() { clearTimeout(this.timer); this.flush(); },
    async flush() {
      if (!this.ref || !this.pending || this.writing) return;
      const save = this.pending, gen = this.gen;
      this.pending = null;
      this.writing = true;
      try {
        await this.ref.set({ v: save.v, savedAt: save.savedAt, json: JSON.stringify(save.state) });
        // 쓰는 사이에 세이브를 지웠다면 방금 쓴 것도 다시 지운다 (지운 세이브가 되살아나지 않게)
        if (gen !== this.gen) { if (this.ref) this.ref.delete().catch(() => {}); return; }
        this.remoteSave = save;
        this.status = 'ok';
        this.retried = false;
      } catch (e) {
        this.status = 'error';
        const code = e && e.code;
        if (code === 'unavailable' && !this.retried) {
          this.retried = true;
          if (!this.pending && gen === this.gen) this.pending = save;
          setTimeout(() => this.flush(), 2500 + Math.random() * 1500);
        } else if (code !== 'resource_exhausted' && code !== 'unavailable') {
          this.ref = null; // 이 화면에서는 계정 저장을 쓸 수 없다
        }
      } finally {
        this.writing = false;
        if (this.pending && this.ref) this.queueRemote(this.pending);
      }
    },
    clearAll() {
      this.gen += 1;
      this.clearLocal();
      this.pending = null;
      clearTimeout(this.timer);
      this.remoteSave = null;
      if (this.ref) this.ref.delete().catch(() => {});
    },
  };

  function makeSave() { return { v: SAVE_VERSION, savedAt: Date.now(), state: G }; }
  // 지금 게임이 이어 온 저장의 시각. 계정 저장이 이보다 새로우면 덮어쓰기 전에 묻는다
  // (계정 저장을 확인하기 전에 시작한 새 게임은 0)
  let baseAt = 0;
  const confirmedAt = () => (Store.ready ? Date.now() : 0);
  function persist() {
    if (!G) return;
    openCases();
    // 카드를 잃었으면 (쓰러짐·약탈·버림) 닳은 정도도 그 카드와 함께 사라진다
    if (G.cardWear && !ownsAnywhere('lab_card')) G.cardWear = 0;
    const save = makeSave();
    Store.writeLocal(save);
    Store.queueRemote(save);
  }
  function validSave(s) { return s && s.state && typeof s.state.time === 'number' && s.state.player; }
  function bestSave() {
    const a = Store.readLocal(), b = Store.remoteSave;
    const okA = validSave(a), okB = validSave(b);
    if (okA && okB) return (b.savedAt || 0) > (a.savedAt || 0) ? b : a;
    return okA ? a : okB ? b : null;
  }

  function encodeSave() {
    const state = { ...G, log: G.log.slice(-20), recent: [] };
    const bytes = new TextEncoder().encode(JSON.stringify({ v: SAVE_VERSION, state }));
    let bin = '';
    bytes.forEach((b) => { bin += String.fromCharCode(b); });
    return 'RH1.' + btoa(bin);
  }
  function decodeSave(code) {
    code = String(code || '').replace(/\s+/g, '');
    if (!code.startsWith('RH1.')) throw new Error('format');
    const bin = atob(code.slice(4));
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    const obj = JSON.parse(new TextDecoder().decode(bytes));
    if (!validSave(obj)) throw new Error('format');
    if (!obj.state.v) obj.state.v = obj.v || 1;
    return migrate(obj.state);
  }

  // ---------- 게임 시작 ----------
  function startNew() {
    G = newState();
    baseAt = confirmedAt();
    ST.prologue.paragraphs.forEach((t) => log(t, 'story'));
    log('창고에 남은 식량은 많지 않다. 지도를 펴고 갈 곳을 정하자.');
    ui.screen = 'game';
    ui.tab = 'scene';
    ui.menuView = null;
    persist();
    render();
    window.scrollTo(0, 0);
    showPrologue();
  }
  function showPrologue() {
    showModal({ title: ST.prologue.title, body: ST.prologue.paragraphs, buttons: [{ label: ST.prologue.button, primary: true }] });
  }
  function continueGame() {
    const s = bestSave();
    if (!s) return;
    G = migrate(s.state);
    baseAt = s.savedAt || 0;
    ui.screen = 'game';
    ui.tab = 'scene';
    ui.menuView = null;
    render();
    window.scrollTo(0, 0);
    showDeathChoice();
  }

  // ---------- 화면 조각 ----------
  function btn(label, act, a = '', b = '', cls = '', disabled = false) {
    return `<button type="button" class="btn ${cls}" data-act="${act}" data-a="${esc(a)}" data-b="${esc(b)}"${disabled ? ' disabled' : ''}>${label}</button>`;
  }
  function actBtn(name, sub, act, a = '', cls = '', disabled = false) {
    return `<button type="button" class="act ${cls}" data-act="${act}" data-a="${esc(a)}"${disabled ? ' disabled' : ''}><span class="a-name">${esc(name)}</span><span class="a-sub">${esc(sub)}</span></button>`;
  }
  // 탭 안의 작은 탭: 길게 내려 보지 않고 눌러서 하나씩 본다
  function subTabs(act, label, list, cur) {
    return `<div class="subtabs" role="tablist" aria-label="${esc(label)}">${list.map((t) => {
      const on = t.id === cur;
      return `<button type="button" role="tab" class="subtab${on ? ' on' : ''}" aria-selected="${on}" data-act="${act}" data-a="${esc(t.id)}"${t.disabled ? ' disabled' : ''}>`
        + `<span class="st-name">${esc(t.name)}</span>`
        + (t.sub ? `<span class="st-sub">${esc(t.sub)}</span>` : '')
        + (t.state ? `<span class="st-state ${t.stateCls || ''}">${esc(t.state)}</span>` : '')
        + (t.bar != null ? `<span class="st-bar" aria-hidden="true"><i style="width:${t.bar.toFixed(1)}%"></i></span>` : '')
        + (t.dot ? `<span class="st-dot" aria-label="${esc(t.dot)}"></span>` : '')
        + '</button>';
    }).join('')}</div>`;
  }
  const dangerChip = (d) => `<span class="chip d${d}">${esc(D.dangers[d].name)}</span>`;

  function itemMeta(id, qty) {
    const it = ITEMS[id];
    let meta = `${fmtKg(it.w)}kg`;
    if (qty > 1) meta += ` (총 ${fmtKg(it.w * qty)}kg)`;
    meta += ` · ${D.rarities[it.r]}`;
    if (it.cat === 'weapon') meta += ` · ${(it.size || 'large') === 'small' ? '작은' : '큰'} 무기 · 승률 +${it.atk}%${it.vs ? ` (${Object.entries(it.vs).map(([e, v]) => `${ENEMIES[e].name} +${v}%`).join(', ')})` : ''}${it.ammo ? ` · ${ITEMS[it.ammo].name} 필요 (없으면 휘둘러 +${it.noAmmoAtk || 0}%)` : ''}${it.slots ? ` · 부착 칸: ${it.slots.map((x) => GM_SLOTS[x]).join('·')}` : ''}`;
    else if (it.cat === 'armor') meta += ` · 받는 피해 -${pct(it.def)}% · 디버프 확률 -${pct(it.dbf)}% · 두께 ${it.thick || 1}`;
    else if (it.cat === 'ammo') meta += ` · ${it.desc}`;
    else if (it.bag) meta += ` · 중량 한계 +${it.bag}kg`;
    else if (it.case) meta += ` · 케이스 · ${caseFitText(id)} ${it.case.cap}개`;
    else if (it.cat === 'gear') meta += ` · 기어(${GEAR_SLOT[it.gear]}) · ${gearText(it)}`;
    else if (it.fill) meta += ` · ${fillFroms(it.fill).map((w) => ITEMS[w].name).join('·')} 중 하나를 ${it.fill.n || 1}병 채우면 ${ITEMS[it.fill.to].name}`;
    else if (isUsable(it)) meta += ' · ' + [it.use && useText(it), it.treat && treatText(it.treat), it.buff && `${BUFFS[it.buff[0]].name} ${fmtDur(it.buff[1])}`].filter(Boolean).join(' · ');
    else if (it.cat === 'material') meta += ' · 시설 재료';
    else if (it.cat === 'quest') meta += ` · 중요한 물건 · ${it.desc}`;
    else if (it.cat === 'mod') meta += ` · 부착물 · ${GM_SLOTS[it.slot]} · ${it.fits.map((g) => ITEMS[g].name).join('·')}${modEffect(it) ? ` · ${modEffect(it)}` : ''} · 장비에서 총에 단다 · 이름을 누르면 맞는 총`;
    else if (it.cat === 'junk') meta += ` · 잡동사니 · 해체하면 ${it.salvage.map(([m]) => ITEMS[m].name).join(', ')}`;
    return meta;
  }
  function itemRow(id, qty, buttons, metaOverride, chips = '') {
    const it = ITEMS[id];
    const risks = itemRisks(it);
    return `<li class="item${risks.length ? ' risky' : ''}" title="${esc(it.desc || '')}">
      <div class="item-main">
        <div class="item-name"><span class="rdot r${it.r}"></span>${hasInfo(it) ? `<button type="button" class="rname r${it.r} name-link" data-act="itemInfo" data-a="${id}" title="${it.cat === 'mod' ? '어느 총에 맞는지 보기' : '효과 보기'}">${esc(it.name)}</button>` : `<span class="rname r${it.r}">${esc(it.name)}</span>`}<span class="qty">×${qty}</span>${risks.length ? '<span class="chip bad">위험</span>' : ''}${chips}</div>
        <div class="item-meta">${esc(metaOverride || itemMeta(id, qty))}</div>
        ${risks.length ? `<div class="item-risk">주의: ${esc(risks.join(' · '))}</div>` : ''}
      </div>
      <div class="item-btns">${buttons}</div>
    </li>`;
  }

  function gauge(label, value, max, color, stateText, stateCls) {
    const p = clamp((value / max) * 100, 0, 100);
    return `<div class="gauge">
      <div class="g-head"><span class="g-label">${esc(label)}</span><span class="g-val">${Math.round(value)}</span></div>
      <div class="g-bar"><div class="g-fill" style="width:${p.toFixed(1)}%;background:${color}"></div></div>
      <div class="g-state ${stateCls}">${esc(stateText)}</div>
    </div>`;
  }
  function needGauge(kind, label, value, color) {
    const s = needState(kind, value);
    return gauge(label, value, 100, color, NEED_STATES[kind][s][1], s >= 3 ? 'bad' : s === 2 ? 'warn' : '');
  }
  function debuffShort(k) {
    const d = P().debuffs[k];
    if (k === 'infection') return `${DB.infection.name} ${Math.round(d.sev)}%`;
    return `${DB[k].name} ${fmtLeft(d.left)}`;
  }

  function renderHud() {
    const p = P();
    const night = isNight(G.time);
    const hpPct = p.hp / maxHp();
    const hpState = hpPct < 0.3 ? ['위독', 'bad'] : hpPct < 0.6 ? ['부상', 'warn'] : ['양호', ''];
    const stState = p.stamina <= 0 ? ['탈진', 'bad'] : p.stamina < 25 ? ['지침', 'warn'] : ['양호', ''];
    const limit = carryLimit(), w = carried(), ti = tierIndex(), tr = C.overweight[ti];
    const span = limit * C.pickupHardCap;
    const fillColor = ti === 0 ? 'var(--ok)' : ti === 1 ? 'var(--warn)' : 'var(--bad)';
    let where;
    if (G.pending && G.pending.ctx.type === 'travel') where = `<span class="label">→ ${esc(placeName(G.pending.ctx.dest))}</span><span class="chip warn">이동 중</span>`;
    else if (G.loc === 'hideout') where = '<span class="label">거점</span>';
    else where = `<span class="label">${esc(LOC[G.loc].name)}</span>${dangerChip(LOC[G.loc].danger)}`;
    const debuffs = DEBUFF_KEYS.filter((k) => p.debuffs[k]);
    const buffIds = Object.keys(p.buffs);
    const rids = Object.keys(G.residents || {});
    const rd = rids.length ? Math.min(...rids.map(resDays)) : null;
    const resChip = rd == null ? '' : `<span class="chip ${rd < 1 ? 'bad' : rd < 2 ? 'warn' : ''}">거주민 식량 ${rd}일치</span>`;
    $('#hud').innerHTML = `
      <div class="hud-top">
        <div class="clock"><span class="day">DAY ${dayOf(G.time)}</span><span class="time">${clockStr(G.time)}</span><span class="chip ${night ? 'night-chip' : 'day-chip'}">${night ? '밤' : '낮'}</span></div>
        <div class="where">${where}</div>
      </div>
      <div class="gauges">
        ${gauge('HP', p.hp, maxHp(), 'var(--hp)', hpState[0], hpState[1])}
        ${gauge('스테미너', p.stamina, maxStamina(), 'var(--stam)', stState[0], stState[1])}
        ${needGauge('hunger', '배고픔', p.hunger, 'var(--hunger)')}
        ${needGauge('thirst', '갈증', p.thirst, 'var(--thirst)')}
        ${needGauge('fatigue', '피로', p.fatigue, 'var(--fatigue)')}
      </div>
      ${debuffs.length || buffIds.length || thickOver() || resChip ? `<div class="debuffs" aria-label="몸 상태">${resChip}${thickOver() ? `<span class="chip warn">껴입음 두께 ${thickness()}</span>` : ''}${buffIds.map((id) => `<span class="chip ok">${esc(BUFFS[id].name)} ${fmtLeft(p.buffs[id].left)}</span>`).join('')}${debuffs.map((k) => `<span class="chip bad">${esc(debuffShort(k))}</span>`).join('')}</div>` : ''}
      <div class="weight">
        <div class="w-head">
          <span><span class="w-label">중량</span> <span class="w-val">${fmtKg(w)} / ${fmtKg(limit)} kg</span></span>
          <span class="chip ${ti === 0 ? 'ok' : ti === 1 ? 'warn' : 'bad'}">${esc(tr.name)}</span>
        </div>
        <div class="w-track" role="img" aria-label="중량 ${fmtKg(w)}kg, 한계 ${fmtKg(limit)}kg">
          <div class="w-fill" style="width:${clamp((w / span) * 100, 0, 100).toFixed(1)}%;background:${fillColor}"></div>
          <div class="w-mark" style="left:${((1 / C.pickupHardCap) * 100).toFixed(2)}%"></div>
          <div class="w-mark" style="left:${((1.25 / C.pickupHardCap) * 100).toFixed(2)}%"></div>
        </div>
      </div>${pinLine()}`;
  }
  // 고정한 의뢰의 다음 할 일 (진행 중인 의뢰만)
  function pinLine() {
    const b = G.flags.pin && BOND[G.flags.pin], step = b && bondStep(b);
    if (!step) return '';
    const objs = step.obj ? step.obj.map((_, i) => objLine(b, i)).filter((l) => !l.met).map((l) => l.text).join(' · ') : '';
    return `<div class="pin-line"><span class="pin-text"><b>${esc(b.who)}</b> · ${esc(step.hint)} <span class="note">(${esc(bondWhere(step))})${objs ? ` · 남은 목표: ${esc(objs)}` : ''}</span></span>${btn('✕', 'pinBond', '', '', 'pin-x')}</div>`;
  }

  const TABS = [['scene', '현장'], ['inv', '짐'], ['map', '지도'], ['fac', '시설'], ['skills', '스킬'], ['records', '기록'], ['menu', '메뉴']];
  function renderTabs() {
    $('#tabs').innerHTML = TABS.map(([id, name]) => {
      let label = esc(name);
      if (id === 'scene' && G.pending) label += '<span class="badge">●</span>';
      if (id === 'skills' && G.skillNew) label += '<span class="badge">▲</span>';
      if (id === 'records' && G.recordNew) label += '<span class="badge">●</span>';
      if (id === 'fac' && (Object.keys(G.hideout.ready).length || G.hideout.water.stored)) label += '<span class="badge">●</span>';
      return `<button type="button" class="tab" role="tab" aria-selected="${ui.tab === id}" data-act="tab" data-a="${id}">${label}</button>`;
    }).join('');
  }

  function recentBox(skipText) {
    const list = (G.recent || []).filter((e) => e.text !== skipText); // 카드에 이미 보이는 문장은 빼고
    if (!list.length) return '';
    return `<div class="recent" aria-live="polite"><span class="label">방금 일어난 일</span>${list.map((e) => `<p class="${e.k}">${esc(e.text)}</p>`).join('')}</div>`;
  }
  function overweightNote() {
    const ti = tierIndex();
    if (!ti) return '';
    const tr = C.overweight[ti];
    let t = `${tr.name} 상태: 행동시간 ×${tr.timeMult}, 스테미너 소모 ×${tr.staminaMult}, 승률 ${ti === 1 ? CB.mods.light : CB.mods.heavy}%`;
    if (tr.hpPerHour) t += elite('strength') ? ` (${SL.strength.elite.name}: HP 피해 없음, 도망 가능)` : `, 이동·수색 중 시간당 HP -${tr.hpPerHour}, 도망 불가`;
    return `<p class="note ${ti === 1 ? 'warn-text' : 'bad-text'}">${esc(t)}</p>`;
  }
  // 생존 일지: 전체 · 이야기 · 전투 · 거주민만 골라 본다
  const LOG_FILTERS = [['all', '전체'], ['story', '이야기'], ['fight', '전투'], ['res', '거주민']];
  const logMatch = (e, f) => f === 'all' || (f === 'story' ? e.k === 'story' : f === 'fight' ? e.c === 'fight' : f === 'res' && /^\[거주민\]/.test(e.text));
  function logSection() {
    const f = LOG_FILTERS.some(([k]) => k === ui.logFilter) ? ui.logFilter : 'all';
    const entries = G.log.filter((e) => logMatch(e, f)).slice(-40).reverse();
    return `<section class="section" id="log">
      <div class="section-head"><h2>생존 일지</h2><span class="meta">최근 ${entries.length}개</span></div>
      <div class="row-btns seg log-filter" role="group" aria-label="생존 일지 거르기">${LOG_FILTERS.map(([k, n]) => btn(n, 'logFilter', k, '', f === k ? 'primary' : '')).join('')}</div>
      ${entries.length ? `<ul class="log">${entries.map((e) => `<li><span class="log-time">${dayOf(e.t)}일 ${clockStr(e.t)}</span><span class="log-text ${e.k}">${esc(e.text)}</span></li>`).join('')}</ul>` : '<p class="empty">해당하는 기록이 없다.</p>'}
    </section>`;
  }
  function autoEatRow() {
    const at = (C.autoEat || {}).at || 70;
    return `<div class="row-btns auto-eat">${btn(autoEatOn() ? '자동 먹기 켜짐' : '자동 먹기 꺼짐', 'toggleAutoEat', '', '', autoEatOn() ? 'on' : '')}<span class="note">켜 두면 배고픔·갈증이 ${at}을 넘을 때 흔한 것부터 알아서 먹고 마신다. 식중독 위험·반동이 있는 것과 잠근 것은 쓰지 않는다.</span></div>`;
  }
  function quickUseSection(title, includeStash) {
    const ids = new Set(Object.keys(P().inv).filter((id) => ITEMS[id].use));
    if (includeStash) Object.keys(G.stash).filter((id) => ITEMS[id].use).forEach((id) => ids.add(id));
    const list = sortedIds(Object.fromEntries([...ids].map((id) => [id, 1])));
    if (!list.length) {
      return `<section class="section"><div class="section-head"><h2>${esc(title)}</h2></div>${autoEatRow()}<p class="empty">먹고 마실 것이 없다.</p></section>`;
    }
    const rows = list.map((id) => {
      const inS = includeStash ? G.stash[id] || 0 : 0, inI = P().inv[id] || 0;
      const from = inS > 0 ? 'stash' : 'inv';
      const it = ITEMS[id];
      const fx = useText(it) + (it.buff ? ` · ${BUFFS[it.buff[0]].name} ${fmtDur(it.buff[1])}` : '');
      const where = includeStash ? `창고 ${inS} · 소지품 ${inI} · ${fx}` : fx;
      const cookBtn = it.cook && includeStash ? btn(cookVerb(it)[0], 'cook', id, '', 'primary') : '';
      return itemRow(id, inS + inI, cookBtn + btn(useLabel(it), 'use', id, from, isRisky(it) ? 'danger' : ''), where);
    }).join('');
    return `<section class="section"><div class="section-head"><h2>${esc(title)}</h2>${includeStash ? '<span class="meta">창고에 있는 것부터 쓴다</span>' : ''}</div>${autoEatRow()}<ul class="items">${rows}</ul></section>`;
  }

  // 디버프 목록과 바로 치료하기
  // 바로 치료에 쓸 물건: 그 증상만 고치는 흔한 것부터 (붕대 → 구급상자 → 수술 키트, 항생제 → 혈청). 같으면 소지품 먼저
  function cureFor(k) {
    const list = [];
    for (const [where, map] of [['inv', P().inv], ['stash', G.loc === 'hideout' ? G.stash : {}]]) {
      for (const id of Object.keys(map)) if (map[id] > 0 && ITEMS[id].treat && ITEMS[id].treat[k]) list.push({ id, where });
    }
    const cost = ({ id, where }) => Object.keys(ITEMS[id].treat).length * 10 + (ITEMS[id].r || 0) * 2 + (where === 'stash' ? 1 : 0);
    list.sort((a, b) => cost(a) - cost(b));
    return list[0] || null;
  }
  // 감염 n%: 하루에 최대 HP의 n%를 잃는다. 감염이 퍼질수록 점점 늘어난다
  // 데이터에 값이 없으면(예전 데이터와 섞인 경우) 기본값 1로 계산한다. 값이 비면 피해가 NaN이 되어 아예 안 들어가기 때문
  const infectionDailyMult = () => (Number.isFinite(DB.infection.dailyHpMult) ? DB.infection.dailyHpMult : 1);
  const infectionHpPerDay = (sev) => maxHp() * (sev / 100) * infectionDailyMult();
  function debuffEffect(k) {
    const d = P().debuffs[k], c = DB[k];
    if (k === 'bleed') return `시간당 HP -${c.hpPerHour} · 방치하면 감염 위험 · ${fmtLeft(d.left)} 뒤 멎음`;
    if (k === 'infection') {
      return `하루 HP -${Math.round(infectionHpPerDay(d.sev))} (최대 HP의 ${Math.round(d.sev * infectionDailyMult())}%) · 시간당 +${c.growPerHour}%씩 퍼진다${d.sev >= c.winAt ? ` · 승률 ${c.win}%` : ''}`;
    }
    if (k === 'fracture') return `행동시간 ×${c.timeMult} · 승률 ${c.win}% · 도망 ${c.flee}% · ${fmtLeft(d.left)} 뒤 회복`;
    if (k === 'fear') return `승률 ${c.win}% · 수색시간 ×${c.searchMult} · ${fmtLeft(d.left)} 남음 (쉬거나 자면 빨리 사라짐)`;
    if (k === 'nightmare') return `최대 HP ×${c.hpMult} · 최대 스테미너 ×${c.staminaMult} · 승률 ${c.win}% · 약으로 못 고친다 · ${fmtLeft(d.left)} 뒤 사라짐`;
    if (k === 'poison') return `시간당 HP -${c.hpPerHour} · 갈증 ×${c.thirstMult} · 회복 절반 · ${fmtLeft(d.left)} 남음`;
    return '';
  }
  function statusSection() {
    const keys = DEBUFF_KEYS.filter((k) => P().debuffs[k]);
    const buffIds = Object.keys(P().buffs);
    if (!keys.length && !buffIds.length) return '';
    const buffRows = buffIds.map((id) => `<li class="item"><div class="item-main"><div class="item-name"><span class="rdot good-dot"></span><span class="good-text">${esc(BUFFS[id].name)} ${fmtLeft(P().buffs[id].left)}</span></div><div class="item-meta">${esc(BUFFS[id].desc)}</div></div></li>`).join('');
    const rows = keys.map((k) => {
      const cure = cureFor(k);
      const cureNames = Object.keys(ITEMS).filter((id) => ITEMS[id].treat && ITEMS[id].treat[k]).map((id) => ITEMS[id].name).join(', ');
      const b = cure && !G.pending ? btn(`${ITEMS[cure.id].name} 쓰기`, 'use', cure.id, cure.where, 'primary')
        : `<span class="note">${cureNames ? `치료: ${esc(cureNames)}${cure ? '' : ' (없음)'}` : '시간이 지나야 낫는다'}</span>`;
      return `<li class="item"><div class="item-main"><div class="item-name"><span class="rdot bad-dot"></span><span class="bad-text">${esc(debuffShort(k))}</span></div><div class="item-meta">${esc(debuffEffect(k))}</div></div><div class="item-btns">${b}</div></li>`;
    }).join('');
    return `<section class="section"><div class="section-head"><h2>몸 상태</h2></div><ul class="items">${buffRows}${rows}</ul></section>`;
  }

  function scrollToEncounter(id = 'encounter') {
    const el = document.getElementById(id);
    const hud = document.getElementById('hud');
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY - (hud ? hud.offsetHeight : 0) - 12;
    window.scrollTo(0, Math.max(0, top));
  }
  const ammoText = (w) => (w && ITEMS[w].ammo ? ` · ${ITEMS[ITEMS[w].ammo].name} ${P().inv[ITEMS[w].ammo] || 0}발` : '');
  // 무기의 승률: 탄약 없는 총은 휘두를 때 값도 같이
  const atkText = (id) => { const it = ITEMS[id]; return it.ammo && !(P().inv[it.ammo] > 0) ? `승률 +${it.atk}% (탄약 없음 · 휘두르면 +${it.noAmmoAtk || 0}%)` : `승률 +${it.atk}%`; };
  function encounterCard() {
    const pd = G.pending;
    if (pd.kind === 'combat') {
      const E = ENEMIES[pd.enemy];
      const odds = winOdds(pd);
      const fl = pd.canFlee ? fleeOdds(pd) : null;
      const tone = odds.total >= 70 ? 'ok' : odds.total >= 40 ? 'warn' : 'bad';
      const armors = P().armors;
      const armor = armors.length ? `${armors.length}겹 · 받는 피해 -${pct(armorDef())}%${thickOver() ? ` · 두께 ${thickness()}로 둔함` : ''}` : '없음';
      const best = bestWeapon(pd);
      const saving = isMelee(best) && weaponIds().some((w) => !isMelee(w) && oddsWith(pd, w).total >= odds.total);
      const fightBtns = (weaponIds().length ? weaponIds() : [null]).map((w) => {
        const o = oddsWith(pd, w).total;
        // 총은 총알이 있는지 없는지만 붙인다
        const gun = w && ITEMS[w].ammo ? (isMelee(w) ? ' · 총알 없음' : ` · 총알 있음${ammoText(w)}`) : '';
        return actBtn(w ? `싸운다 · ${ITEMS[w].name}` : '싸운다 · 맨손', `이길 확률 ${o}%${gun}`, 'fight', w || '', w === best ? 'primary' : '');
      }).join('');
      return `<section class="encounter" id="encounter">
        <div class="enc-head"><span class="enc-kicker">조우</span>${dangerChip(combatDanger(pd))}<span class="chip range-chip">${pd.close ? '근접전' : '거리가 있다'}</span></div>
        <h2 class="enc-title">${esc(E.name)}</h2>
        <p class="enc-text">${esc(pd.text)}</p>
        ${pd.note ? `<p class="enc-note">${esc(pd.note)}</p>` : ''}
        <div class="odds ${tone}"><span class="odds-label">이길 확률</span><span class="odds-num">${odds.total}%</span></div>
        <details class="odds-detail"><summary>확률 계산 보기</summary>
          <dl class="kv">${odds.rows.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${signed(v)}%</dd>`).join('')}<dt>최종</dt><dd>${odds.total}% (${CB.minWin}~${CB.maxWin}% 사이)</dd></dl>
        </details>
        <p class="note">확률은 고른 무기(${esc(best ? ITEMS[best].name : '맨손')}) 기준${saving ? ' · 총과 거의 같아서 탄약을 아끼려고 골랐다' : ''} · 옷 ${esc(armor)}</p>
        <div class="actions">
          ${fightBtns}
          ${pd.canFlee ? actBtn('도망친다', `성공 확률 ${fl}%`, 'flee') : ''}
          ${E.pmc && P().inv.core_data > 0 && !qflag('core_used') ? actBtn('핵심 데이터를 내밀며 거래한다', '그들의 헬기를 탄다 · 엔딩', 'deal', '', 'on') : ''}
          ${E.bribe ? actBtn(`${itemsText(E.bribe)}개를 넘긴다`, E.bribe.every(([id, n]) => (P().inv[id] || 0) >= n) ? '싸우지 않고 지나간다' : '들고 있는 게 없다', 'bribe', '', '', !E.bribe.every(([id, n]) => (P().inv[id] || 0) >= n)) : ''}
        </div>
        ${caseQuickBtns()}
      </section>`;
    }
    const ev = EVENTS[pd.id];
    let buttons;
    if (ev.trade) {
      // 하나만 고를 수 있다. 가진 개수를 같이 보여 준다
      const okIdx = pd.offers.findIndex((t) => canAfford(D.trades[t].give));
      const have = (give) => give.map(([id, n]) => `${ITEMS[id].name} ${P().inv[id] || 0}/${n}`).join(', ');
      buttons = pd.offers.map((t, i) => {
        const o = D.trades[t], ok = canAfford(o.give);
        const tag = o.kind === 'rare' ? '귀한 물건 · ' : o.kind === 'material' ? '재료 · ' : '';
        return actBtn(`${itemsText(o.get)}개 받기`, `${tag}${itemsText(o.give)}개 주기 · 가진 것 ${have(o.give)}${ok ? '' : ' · 부족하다'}`, 'choose', String(i), i === okIdx ? 'primary' : '', !ok);
      }).join('') + actBtn('거절한다', '그냥 지나간다', 'choose', 'no', okIdx < 0 ? 'primary' : '');
    } else {
      const shown = ev.choices.map((ch, i) => [ch, i]).filter(([ch]) => choiceShown(ch));
      // 어두운 선택은 기본 선택이 되지 않는다
      const first = shown.find(([ch]) => choiceOk(ch, pd.ctx) && !ch.dark);
      buttons = shown.map(([ch, i]) => {
        const ok = choiceOk(ch, pd.ctx);
        let sub = ch.sub || '';
        if (ch.outcome && ch.outcome.sneak != null) sub = sub.replace('{sneak}', sneakOdds(ch.outcome.sneak));
        if (ch.roomCard && pd.ctx.room) sub += ` · 지금 카드 남은 사용 ${cardLeft(ROOMS[pd.ctx.room].type)}/${LB.roomCardUses}`;
        if (ch.need) sub = `${sub} · 가진 것${G.loc === 'hideout' ? '(창고 포함)' : ''} ${ch.need.map(([k, n]) => `${needName(k)} ${needCount(k)}/${n}`).join(', ')}`;
        let why = '부족하다';
        if (ch.obj && !objAll(BOND[pd.ctx.bond])) why = '목표를 다 채우지 못했다';
        else if (ch.invite && inviteBlock(ch.invite)) why = inviteBlock(ch.invite);
        else if (ch.roomCard && pd.ctx.room && roomLocked(pd.ctx.room)) why = `봉쇄됐다 · ${fmtLeft(G.labRooms[pd.ctx.room].lock - G.time)} 뒤 풀림`;
        return actBtn(ch.label, ok ? sub : `${sub} · ${why}`, 'choose', String(i), ch.dark ? 'dark' : first && first[1] === i ? 'primary' : '', !ok);
      }).join('');
    }
    const bondB = ev.bond && BOND[ev.bond];
    return `<section class="encounter event" id="encounter">
      <div class="enc-head"><span class="enc-kicker">${ev.bond ? '인연 · 의뢰' : '사건'}</span></div>
      <h2 class="enc-title">${esc(ev.title)}</h2>
      <p class="enc-text">${esc(pd.text)}</p>
      ${bondB && bondStep(bondB) && bondStep(bondB).obj ? `<div class="obj-box"><span class="obj-head">의뢰 목표</span>${objListHtml(bondB)}</div>` : ''}
      <div class="actions">${buttons}</div>
    </section>`;
  }

  function placeHeader() {
    if (G.pending && G.pending.ctx.type === 'travel') {
      const dest = G.pending.ctx.dest;
      return `<section class="place"><div class="place-head"><h1 class="place-name">${esc(ro(placeName(dest)))} 가는 길</h1>${dangerChip(G.pending.ctx.danger)}</div></section>`;
    }
    if (G.loc === 'hideout') {
      const slots = stashSlots();
      return `<section class="place">
        <div class="place-head"><h1 class="place-name">거점</h1>${isNight(G.time) ? '<span class="chip night-chip">밤</span>' : ''}</div>
        <p class="place-desc">${esc(HIDEOUT_DESC)}</p>
        <div class="place-facts"><span>창고 <b>${slots}/${stashCap()}</b>칸</span>${hideoutFacts()}</div>
      </section>`;
    }
    const L = LOC[G.loc], st = G.locs[G.loc];
    return `<section class="place">
      <div class="place-head"><h1 class="place-name">${esc(L.name)}</h1>${dangerChip(L.danger)}${isLab(G.loc) && !qflag('lab_power') ? '<span class="chip night-chip">정전</span>' : isNight(G.time) ? '<span class="chip night-chip">밤</span>' : ''}${LB && alarmOn(G.loc) ? `<span class="chip alarm-chip">경보 ${fmtLeft(G.labAlarm.until - G.time)}</span>` : ''}</div>
      <p class="place-desc">${esc(L.desc)}</p>
      <div class="place-facts"><span>수색 구역 <b>${st.spots}/${L.spots}</b></span><span>수색 중 조우 <b>${pct(encChance(G.loc))}%</b>${noisy(G.loc) ? ` <span class="warn-text">(총소리 · ${fmtLeft(G.locs[G.loc].noise - G.time)})</span>` : ''}</span><span>거점까지 <b>${fmtDur(travelMinutes('hideout'))}</b></span>${fragmentHint(G.loc)}</div>
    </section>`;
  }

  function fragmentHint(loc) {
    const all = ST.fragments.filter((x) => x.loc === loc);
    if (!all.length) return '';
    const left = all.filter((x) => !G.fragments.includes(x.id)).length;
    return left ? `<span>누군가의 기록이 <b>남아 있는 것 같다 (${left})</b></span>` : '<span>이곳의 기록은 <b>다 찾았다</b></span>';
  }

  // ---------- 시설 화면 ----------
  function hideoutFacts() {
    const H = G.hideout, out = [];
    if (H.build) out.push(`<span>공사 중 <b>${esc(FAC[H.build.id].name)} LV ${H.build.to}</b> · ${fmtLeft(H.build.left)} 남음</span>`);
    if (facLv('generator')) out.push(`<span>전력 <b>${isPowered() ? `켜짐 · 연료 ${Math.floor(H.fuel)}시간` : H.fuel > 0 ? '꺼짐' : '연료 없음'}</b></span>`);
    const readyN = Object.keys(H.ready).length + (H.water.stored ? 1 : 0);
    if (readyN) out.push(`<span>받을 물건 <b>${readyN}곳</b></span>`);
    return out.join('');
  }
  function hideoutHint() {
    const H = G.hideout;
    const readyN = Object.keys(H.ready).length + (H.water.stored ? 1 : 0);
    if (readyN) return `받을 물건이 있다`;
    if (H.build) return `공사 중 · ${fmtLeft(H.build.left)} 남음`;
    const can = FAC_ORDER.filter((id) => !upgradeBlock(id)).length;
    return can ? `지금 지을 수 있는 시설 ${can}개` : '재료를 모아 시설을 올리자';
  }
  function costChips(list) {
    return list.map(([id, n]) => {
      const h = countAny(id);
      const name = [id, ...(SUBS[id] || [])].map((x) => ITEMS[x].name).join(' 또는 ');
      return `<span class="cost ${h >= n ? 'ok' : 'lack'}">${esc(name)} ${h}/${n}</span>`;
    }).join('');
  }
  // 치료제처럼 사람·의뢰·기록이 있어야 하는 제작법
  function needChips(R) {
    const out = [];
    if (R.needRes) out.push([resActive(R.needRes), `${RES[R.needRes].name} 거점에`]);
    if (R.needFlag) out.push([qflag(R.needFlag), '김정우의 연구 완료']);
    if (R.needLabNotes) out.push([labNotesDone(), `연구소 기록 ${G.labNotes.length}/${LB.notes.length}`]);
    if (R.needClue) out.push([cluesDone(R.needClue), `${RTYPE[R.needClue].name} 단서 ${G.labClues[R.needClue] || 0}/${LB.clueNeed}`]);
    return out.map(([ok, t]) => `<span class="cost ${ok ? 'ok' : 'lack'}">${esc(t)}</span>`).join('');
  }
  function reqChips(req) {
    return Object.entries(req || {}).map(([f, lv]) => `<span class="cost ${facLv(f) >= lv ? 'ok' : 'lack'}">${esc(FAC[f].name)} LV ${lv}</span>`).join('');
  }
  function powerBox() {
    const H = G.hideout, gc = facCfg('generator');
    if (!gc) return '';
    const state = isPowered() ? [solarNow() ? '켜짐 · 태양광' : '켜짐', 'ok'] : H.fuel > 0 || (gc.solar && H.genOn === false) ? ['꺼짐', 'warn'] : ['연료 없음', 'bad'];
    const home = G.loc === 'hideout';
    return `<div class="fac-box">
      <div class="fac-box-head"><span class="chip ${state[1]}">${state[0]}</span><span class="num">연료 ${Math.floor(H.fuel)} / ${gc.tank}시간</span></div>
      <div class="w-track"><div class="w-fill" style="width:${clamp((H.fuel / gc.tank) * 100, 0, 100).toFixed(1)}%;background:var(--accent)"></div></div>
      <div class="row-btns">
        ${btn(`연료 넣기 (연료통 ${countHave('fuel')}개)`, 'addFuel', '', '', 'primary', !home || countHave('fuel') < 1 || H.fuel >= gc.tank - 0.01)}
        ${btn(H.genOn ? '끄기' : '켜기', 'toggleGen', '', '', '', !home)}
      </div>
      <p class="note">연료통 1개로 ${gc.fuelHours}시간 돌아간다. 켜 두면 쓸 데가 없어도 연료가 닳는다.${gc.solar ? ` 낮(${C.night.end}시~${C.night.start}시)에는 태양광으로 돌아가 연료가 닳지 않는다.${solarNow() && isPowered() ? ' 지금은 태양광으로 돌아가는 중이다.' : ''}` : ''}</p>
    </div>`;
  }
  // 만들 개수는 슬라이더로 정한다 (1 ~ 재료로 만들 수 있는 최대)
  function craftQty(rid) {
    const max = Math.max(1, maxBatch(rid));
    return clamp(Math.floor(ui.craftQty[rid] || 1), 1, max);
  }
  const qtyLabel = (R, n, max) => `×${n} · ${ITEMS[R.out[0]].name} ${R.out[1] * n}개${max >= 2 ? ` (최대 ${max})` : ''}`;
  const craftBtnLabel = (R, n) => `${G.hideout.crafts[R.at] ? '대기열에 넣기' : '만들기'} · ${fmtDur(craftMinutes(R, n))}`;
  function recipeCosts(R, n) {
    if (!R.fuel) return costChips(timesIn(recipeIn(R), n));
    if (elecFuel(R)) return `${costChips(timesIn(recipeIn(R), n))}<span class="cost ok">전기 사용 · ${esc(ITEMS[R.fuel].name)} 필요 없음</span>`;
    return `${costChips(timesIn(R.in, n))}<span class="note">발전기를 켜 두면 ${esc(ITEMS[R.fuel].name)} 없이 만든다</span>`;
  }
  // 모자란 재료와 그것이 잘 나오는 곳 (도감 계산을 처음 한 번만 해 둔다)
  let srcCache = null;
  const pctText = (p) => `${p >= 0.1 ? Math.round(p * 100) : Math.round(p * 1000) / 10}%`;
  function whereFrom(id) {
    if (!srcCache && window.RH_CODEX) { srcCache = {}; for (const it of window.RH_CODEX.compute(D).items) srcCache[it.id] = it.src; }
    const src = (srcCache && srcCache[id]) || [];
    const search = src.filter((x) => x.kind === 'search' && LOC[x.loc] && (!LOC[x.loc].hidden || qflag('lab_door'))).sort((a, b) => b.per - a.per).slice(0, 2);
    if (search.length) return search.map((x) => `${x.locName} ${pctText(x.per)}`).join(' · ');
    const c = src.find((x) => x.kind === 'craft');
    if (c) return `${c.atName} LV ${c.lv}에서 만든다`;
    const sv = src.find((x) => x.kind === 'salvage');
    if (sv) return `${sv.fromName} 해체`;
    const sh = src.find((x) => x.kind === 'shop');
    if (sh) return `${gwa(sh.who)} 거래`;
    if (src.some((x) => x.kind === 'trade')) return '떠돌이 상인';
    const e = src.find((x) => x.kind === 'enemy');
    return e ? `${e.enemyName} 처치` : '';
  }
  // 모자란 재료 창: 무엇이 몇 개 모자란지, 어디서 잘 나오는지
  function missWin(list, title) {
    const miss = list.map(([id, n]) => [id, n - countAny(id)]).filter(([, k]) => k > 0);
    showModal({
      title,
      body: miss.length ? [...miss.map(([id, k]) => [`${ITEMS[id].name} ${k}개`, whereFrom(id) || '아직 나오는 곳을 모른다']), '확률은 그곳을 한 번 수색할 때 나올 확률이다 (집중력 스킬·밤 보너스 전). 자세한 건 화면 맨 아래 \'아이템 확률정보\'에서 본다.'] : ['모자란 재료가 없다.'],
      buttons: [{ label: '닫기', primary: true }],
    });
  }
  function recipeRow(R) {
    const out = ITEMS[R.out[0]];
    const locked = facLv(R.at) < R.lv;
    const max = maxBatch(R.id);
    const n = craftQty(R.id);
    const why = craftBlock(R.id, n);
    const slider = !locked && max >= 2
      ? `<input type="range" class="qty-range" id="qty-${R.id}" data-qty="${R.id}" min="1" max="${max}" step="1" value="${n}" aria-label="${esc(out.name)} 만들 개수">`
      : '';
    return `<li class="item recipe${locked ? ' locked' : ''}">
      <div class="item-main">
        <div class="item-name"><span class="rdot r${out.r}"></span><span class="rname r${out.r}">${esc(out.name)}</span><span class="qty">×${R.out[1]}</span><span class="rgrade r${out.r}">${esc(D.rarities[out.r])}</span>${R.power ? '<span class="chip warn">전력</span>' : ''}</div>
        <div class="costs" id="costs-${R.id}">${locked ? `<span class="note">LV ${R.lv}에서 열린다${R.req ? ` · ${esc(recipeReqText(R))}도 필요` : ''}</span>` : recipeCosts(R, n)}${!locked && R.req ? reqChips(R.req) : ''}${!locked ? needChips(R) : ''}</div>
        ${locked ? '' : `<div class="qty-ctl">${slider}<span class="qty-label" id="qtyl-${R.id}">${esc(qtyLabel(R, n, max))}</span></div>`}
      </div>
      <div class="item-btns">${locked ? '' : `<button type="button" class="btn ${why ? '' : 'primary'}" id="craftbtn-${R.id}" data-act="craft" data-a="${R.id}"${why ? ' disabled' : ''}>${esc(craftBtnLabel(R, n))}</button><button type="button" class="btn miss-btn" id="missbtn-${R.id}" data-act="missRecipe" data-a="${R.id}" data-b="${n}"${why === '재료가 부족하다' ? '' : ' hidden'}>모자란 재료</button>`}</div>
    </li>`;
  }
  // 슬라이더를 끄는 동안 다시 그리지 않고 글자만 바꾼다 (끌기가 끊기지 않게)
  function onQtyInput(el) {
    const rid = el.dataset.qty, R = RECIPE[rid];
    if (!G || !R) return;
    ui.craftQty[rid] = +el.value;
    const n = craftQty(rid), max = maxBatch(rid);
    const why = craftBlock(rid, n);
    const label = document.getElementById('qtyl-' + rid);
    const costs = document.getElementById('costs-' + rid);
    const b = document.getElementById('craftbtn-' + rid);
    if (label) label.textContent = qtyLabel(R, n, max);
    if (costs) costs.innerHTML = recipeCosts(R, n) + (R.req ? reqChips(R.req) : '') + needChips(R);
    const mb = document.getElementById('missbtn-' + rid);
    if (mb) { mb.hidden = why !== '재료가 부족하다'; mb.dataset.b = String(n); }
    if (b) {
      b.textContent = craftBtnLabel(R, n);
      b.disabled = !!why;
      b.classList.toggle('primary', !why);
    }
  }
  function facBlock(fid) {
    const F = FAC[fid], H = G.hideout, lv = facLv(fid), max = F.levels.length;
    const home = G.loc === 'hideout';
    let extra = '';
    if (fid === 'generator') extra = powerBox();
    if (fid === 'water' && lv) {
      const wc = facCfg('water');
      const status = isPowered() ? (H.water.stored >= wc.max ? '가득 찼다' : `다음 생수까지 ${fmtLeft(wc.every - H.water.prog)}`) : '전력이 없어 멈춰 있다';
      extra = `<div class="fac-box"><div class="fac-box-head"><span>생수 <b class="num">${H.water.stored}/${wc.max}</b></span><span class="note">${status}</span></div>
        <div class="row-btns">${btn('받기', 'collectWater', '', '', 'primary', !home || !H.water.stored)}</div></div>`;
    }
    if (fid === 'gym' && lv) {
      extra = `<div class="row-btns">${btn(`운동하기 · ${fmtDur(EX.minutes)}`, 'exercise', '', '', 'primary', !home || P().stamina < EX.minStamina)}<span class="note">스테미너 ${EX.minStamina} 이상 필요 · 힘·지구력 경험치</span></div>`;
    }
    let next = '';
    if (lv < max) {
      const L = F.levels[lv];
      const why = upgradeBlock(fid);
      const building = H.build && H.build.id === fid;
      next = `<div class="fac-next">
        <div class="fac-next-head"><span class="fac-next-label">${lv ? '다음' : '짓기'} · LV ${lv + 1}</span><span class="note">${esc(L.effect)}</span></div>
        <div class="costs">${costChips(L.cost)}${reqChips(L.req)}</div>
        ${building
          ? `<p class="note warn-text">공사 중 · ${fmtLeft(H.build.left)} 남음</p>`
          : `<div class="row-btns">${btn(`${lv ? '업그레이드' : '짓기'} · ${fmtDur(L.time)}`, 'upgrade', fid, '', why ? '' : 'primary', !!why)}${why === '재료가 부족하다' ? btn('모자란 재료', 'missUpgrade', fid, '', 'miss-btn') : ''}${why ? `<span class="note">${esc(why)}</span>` : ''}</div>`}
      </div>`;
    }
    let recipes = D.recipes.filter((r) => r.at === fid);
    if (ui.recipeSort === 'rarity') recipes = [...recipes].sort((a, b) => ((facLv(fid) < a.lv) - (facLv(fid) < b.lv)) || (ITEMS[b.out[0]].r - ITEMS[a.out[0]].r) || (a.lv - b.lv));
    let craftHtml = '';
    if (recipes.length) {
      const c = H.crafts[fid];
      const r = H.ready[fid];
      let status = '';
      if (c) {
        const R = RECIPE[c.recipe];
        status += `<p class="note warn-text">만드는 중: ${esc(ITEMS[R.out[0]].name)} ×${R.out[1] * (c.count || 1)}${(c.count || 1) > 1 ? ` (${c.count}번)` : ''} · ${fmtLeft(c.left)} 남음${(R.power || c.elec) && !isPowered() ? ' (전력이 없어 멈춤)' : ''}</p>`;
      }
      const q = (H.queue || {})[fid] || [];
      if (q.length) {
        status += `<div class="fac-box queue"><span class="note">대기열 ${q.length}/${QMAX()} · 재료는 미리 챙겨 두었다</span><ol>${q.map((x, i) => { const QR = RECIPE[x.recipe]; return `<li><span>${esc(ITEMS[QR.out[0]].name)} ×${QR.out[1] * x.count}${x.count > 1 ? ` (${x.count}번)` : ''}</span>${btn('빼기', 'unqueue', fid, String(i), '', !home)}</li>`; }).join('')}</ol></div>`;
      }
      if (r) {
        status += `<div class="fac-box ready"><span>완성품: ${esc(sortedIds(r).map((id) => `${ITEMS[id].name} ×${r[id]}`).join(', '))}</span>${btn('받기', 'collect', fid, '', 'primary', !home)}</div>`;
      }
      craftHtml = `<div class="fac-craft"><div class="fac-craft-head"><span class="fac-next-label">제작</span>${sortToggle('recipeSort', ui.recipeSort, [['rarity', '레어도순'], ['level', '레벨순']])}</div>${status}<ul class="items">${recipes.map(recipeRow).join('')}</ul></div>`;
    }
    return `<article class="fac" id="fac-${fid}">
      <div class="fac-head"><h3>${esc(F.name)}</h3><span class="fac-lv">LV <b>${lv}</b> / ${max}</span></div>
      <p class="note">${esc(F.desc)}</p>
      <p class="fac-cur">${lv ? esc(F.levels[lv - 1].effect) : '아직 없다.'}</p>
      ${extra}${next}${craftHtml}
    </article>`;
  }
  const facReady = (fid) => !!(G.hideout.ready[fid] || (fid === 'water' && G.hideout.water.stored));
  function renderFacilities() {
    const H = G.hideout, home = G.loc === 'hideout';
    const build = H.build ? `공사 중: ${FAC[H.build.id].name} LV ${H.build.to} · ${fmtLeft(H.build.left)} 남음` : '진행 중인 공사 없음';
    const cur = FAC[ui.facView] ? ui.facView : FAC_ORDER[0];
    const tabs = subTabs('facView', '시설 고르기', FAC_ORDER.map((fid) => {
      const state = facReady(fid) ? ['받을 것 있음', 'ok-text'] : H.build && H.build.id === fid ? ['공사 중', 'warn-text'] : H.crafts[fid] ? [`만드는 중${queueLen(fid) ? ` +${queueLen(fid)}` : ''}`, 'warn-text'] : null;
      return {
        id: fid, name: FAC[fid].name, sub: `LV ${facLv(fid)} / ${FAC[fid].levels.length}`,
        state: state && state[0], stateCls: state && state[1],
        dot: !upgradeBlock(fid) ? '지금 지을 수 있다' : '',
      };
    }), cur);
    return `<section class="section">
      <div class="section-head"><h2>거점 시설</h2><span class="meta">${esc(build)}</span></div>
      ${home ? '<p class="note">재료는 창고에 있는 것부터 쓰고, 모자라면 소지품에서 쓴다. 장착한 장비는 쓰지 않는다. 공사는 한 번에 하나만 할 수 있다.</p>'
        : '<p class="note bad-text">거점에 있을 때만 짓고, 만들고, 받을 수 있다. 공사와 제작은 자리를 비워도 계속된다.</p>'}
      ${tabs}
      <div class="facs">${facBlock(cur)}</div>
    </section>`;
  }

  function hidesSection() {
    const st = G.locs[G.loc];
    const names = LOC[G.loc].hides;
    const hasInv = Object.keys(P().inv).length > 0;
    const rows = st.hides.map((h, i) => {
      const ids = sortedIds(h.items);
      const risk = h.known ? `<span class="chip bad">털린 적 있음 · 하루 ${pct(h.risk)}%</span>` : '<span class="chip muted">털릴 확률 ?</span>';
      const items = ids.map((id) => `<li><span class="rdot r${ITEMS[id].r}"></span><span class="hide-item-name">${esc(ITEMS[id].name)} ×${h.items[id]}</span>${btn('꺼내기', 'unhide', String(i), id)}</li>`).join('');
      const btns = (hasInv ? btn(`가진 것 전부 숨기기 · ${fmtDur(hideTime(h, invKinds()))}`, 'hideAll', String(i)) : '') + (ids.length > 1 ? btn(`모두 꺼내기 · ${fmtDur(retrieveTime(h, ids.length))}`, 'unhide', String(i), 'all') : '');
      return `<li class="hide-spot${ids.length ? ' filled' : ''}">
        <div class="hs-head"><span class="hs-name">${esc(names[i])}</span>${risk}</div>
        <div class="note">숨기기 ${fmtDur(hideTime(h))} · 꺼내기 ${fmtDur(retrieveTime(h))} (한 종류 기준) · 그동안 들킬 수도 있다</div>
        ${ids.length ? `<ul class="hide-items">${items}</ul>` : ''}
        ${btns ? `<div class="row-btns">${btns}</div>` : ''}
      </li>`;
    }).join('');
    return `<section class="section" id="hides">
      <div class="section-head"><h2>숨길 곳</h2><span class="meta">숨긴 물건은 이곳에 남지만, 털릴 수 있다</span></div>
      <ul class="hide-spots">${rows}</ul>
    </section>`;
  }
  // 지도에 보여 줄 '숨겨 둔 물건' 수: 털린 걸 아직 모르면 그대로 있다고 믿는다
  function hiddenKinds(locId) {
    const seen = new Set();
    for (const h of G.locs[locId].hides) {
      Object.keys(h.items).forEach((id) => seen.add(id));
      if (h.lost && !h.lost.seen) Object.keys(h.lost.items).forEach((id) => seen.add(id));
    }
    return seen.size;
  }

  function renderRecords() {
    const total = ST.fragments.length, found = G.fragments.length;
    const has = (f) => G.fragments.includes(f.id);
    const where = (f, got) => (f.loc === 'radio' ? (got ? '거점의 라디오' : '거점에서 잠들기 전, 라디오로') : `${LOC[f.loc].name}${got ? '' : ' 어딘가'}`);
    const chOf = (f) => ST.chapters[CH_INDEX[f.ch]];
    const memo = (f, label) => (has(f)
      ? `<li class="frag"><span class="frag-title">${esc(f.title)}</span><span class="note">${esc(label)} · ${esc(where(f, true))}</span><p class="frag-text">${esc(f.text)}</p></li>`
      : `<li class="frag locked"><span class="frag-title">아직 찾지 못한 메모</span><span class="note">${esc(label)} · ${esc(where(f, false))}</span></li>`);
    let body;
    if (ui.recordView === 'lab' && LB && G.labNotes.length) {
      body = labRecords();
    } else if (ui.recordView === 'bonds') {
      const clues = clueList();
      const recs = endingRecords();
      const endIds = Object.keys(END.list);
      const top = `<div class="bond-top">
        <p class="note"><b>탈출 단서 ${clues.filter((c) => c.got).length}/${clues.length}</b> · ${clues.map((c) => `${c.got ? '✓' : '·'} ${esc(c.name)}`).join(' · ')}${qflag('escape_ready') ? ' · 남부 사령부와 교신했다 (거점에서 탈출을 정할 수 있다)' : cluesAll() ? ' · 거점에서 남부 사령부와 교신할 수 있다' : ''}</p>
        <p class="note"><b>엔딩</b></p>
        <ul class="ending-list">${endIds.map((id) => { const E = END.list[id], seen = recs[id] || G.endings.includes(id); return `<li class="${seen ? 'seen' : ''}">${seen || !E.hidden ? esc(E.title) : '???'}</li>`; }).join('')}</ul>
        ${G.stats.npcKills ? `<p class="note bad-text">해친 사람 ${G.stats.npcKills}명</p>` : ''}
      </div>`;
      body = top + `<ul class="frags bonds">${BONDS.map((b) => {
        const st = G.bonds[b.id];
        if (!st) return `<li class="frag locked"><span class="frag-title">아직 모르는 사람</span><span class="note">${esc(b.lockedHint || `${THREAD[b.th].name}의 기록을 모으거나 라디오를 듣다 보면 알게 된다`)}</span></li>`;
        const step = bondStep(b);
        const past = b.steps.slice(0, st.done ? b.steps.length : st.step).map((x) => x.title).join(' → ');
        const chip = st.dead ? '<span class="chip bad">내가 해쳤다</span>' : st.hostile ? '<span class="chip bad">등을 돌렸다</span>'
          : G.residents[b.id] ? '<span class="chip ok">거점에서 지낸다</span>' : leftReason(b.id) ? '<span class="chip bad">거점을 떠났다</span>' : notMovedIn(b.id) ? '<span class="chip warn">거점에 오지 않았다</span>' : st.done ? '<span class="chip ok">의뢰 완료</span>' : '<span class="chip warn">진행 중</span>';
        const left = st.dead || st.hostile ? '' : leftReason(b.id);
        const home = RES[b.id] && LOC[RES[b.id].home] ? LOC[RES[b.id].home].name : '';
        const info = st.dead || st.hostile ? '' : left ? `<p class="bond-next bad-text"><b>떠난 까닭:</b> ${esc(left)}</p>`
          : notMovedIn(b.id) ? `<p class="bond-next"><b>아직 ${esc(home)}에 있다:</b> 예전 버전에서 끝낸 의뢰라 거점으로 옮겨 오지 않았다. ${esc(home)}에서 '거점으로 데려오기'를 누르면 옮겨 온다.</p>`
          : st.done ? `<p class="frag-text">${esc(bondDoneText(b))}</p>`
          : `<p class="bond-next"><b>다음:</b> ${esc(step.hint)} <span class="note">(${esc(bondWhere(step))})</span></p>${objListHtml(b)}`;
        const pinned = G.flags.pin === b.id;
        const pinBtn = step && !st.dead && !st.hostile ? btn(pinned ? '고정 풀기' : '상단에 고정', 'pinBond', pinned ? '' : b.id, '', pinned ? 'on' : '') : '';
        return `<li class="frag bond"><div class="bond-head"><span class="frag-title">${esc(b.who)}</span>${chip}<span class="note">의뢰 ${Math.min(trustOf(b), b.steps.length)}/${b.steps.length}</span>${pinBtn}</div>
          ${info}
          ${past ? `<span class="note">지나온 일: ${esc(past)}</span>` : ''}</li>`;
      }).join('')}</ul>`;
    } else if (ui.recordView === 'time') {
      body = `<ol class="timeline">${ST.chapters.map((c, idx) => {
        const list = ST.fragments.filter((f) => f.ch === c.id);
        const got = list.filter(has).length;
        return `<li class="chapter${got ? '' : ' empty'}">
          <div class="ch-head"><span class="ch-no">${idx + 1}</span><div class="ch-title"><h3>${esc(c.title)}</h3><span class="note">${esc(c.when)} · ${esc(c.desc)}</span></div><span class="ch-count">${got}/${list.length}</span></div>
          <ul class="frags">${list.map((f) => memo(f, THREAD[f.th].name)).join('')}</ul>
        </li>`;
      }).join('')}</ol>`;
    } else {
      body = `<ol class="timeline threads">${ST.threads.map((t) => {
        const list = ST.fragments.filter((f) => f.th === t.id).sort((a, b) => CH_INDEX[a.ch] - CH_INDEX[b.ch]);
        const got = list.filter(has).length;
        const done = got === list.length;
        return `<li class="chapter${got ? '' : ' empty'}">
          <div class="ch-head"><span class="ch-no">${got}</span><div class="ch-title"><h3>${esc(t.name)}</h3><span class="note">${esc(t.desc)}</span></div><span class="ch-count">${done ? '<span class="chip ok">이야기 완성</span>' : `${got}/${list.length}`}</span></div>
          <ul class="frags">${list.map((f) => memo(f, `${chOf(f).title} (${chOf(f).when})`)).join('')}</ul>
        </li>`;
      }).join('')}</ol>`;
    }
    return `<section class="section">
      <div class="section-head"><h2>기록</h2><span class="meta">${found}/${total} · 장소를 수색하다 보면 찾는다</span>${btn('프롤로그 다시 보기', 'prologue', '', '', 'ghost')}</div>
      <div class="row-btns seg" role="group" aria-label="보기 방식">${btn('인물별', 'recordView', 'people', '', ui.recordView === 'people' ? 'primary' : '')}${btn('시간순', 'recordView', 'time', '', ui.recordView === 'time' ? 'primary' : '')}${btn(`인연·의뢰 ${BONDS.filter((b) => G.bonds[b.id] && G.bonds[b.id].done).length}/${BONDS.length}`, 'recordView', 'bonds', '', ui.recordView === 'bonds' ? 'primary' : '')}${LB && G.labNotes.length ? btn(`연구소 ${G.labNotes.length}/${LB.notes.length}`, 'recordView', 'lab', '', ui.recordView === 'lab' ? 'primary' : '') : ''}</div>
      ${found === total ? `<p class="frag-text">${esc(ST.allFragments)}</p>` : ''}
      ${body}
    </section>`;
  }

  const skillFill = (k) => {
    const sk = G.skills[k];
    return sk.lv >= SK.max ? 100 : clamp((sk.xp / xpNeed(sk.lv)) * 100, 0, 100);
  };
  function renderSkills() {
    const cur = SL[ui.skillView] ? ui.skillView : SKILL_KEYS[0];
    const tabs = subTabs('skillView', '스킬 고르기', SKILL_KEYS.map((k) => ({ id: k, name: SL[k].name, sub: elite(k) ? '엘리트' : `LV ${G.skills[k].lv}`, bar: skillFill(k) })), cur);
    const rows = [cur].map((k) => {
      const sk = G.skills[k], c = SL[k];
      const max = sk.lv >= SK.max;
      const need = xpNeed(sk.lv);
      const fillPct = max ? 100 : clamp((sk.xp / need) * 100, 0, 100);
      const today = G.skillDay === dayOf(G.time) ? sk.today : 0;
      const eff = Math.round(efficiency(today) * 100);
      let next = '';
      if (k === 'strength' && !max) {
        const m = (Math.floor(sk.lv / c.carryEvery) + 1) * c.carryEvery;
        if (m <= SK.max) next = ` · 다음 중량 보너스 LV ${m}`;
      }
      return `<li class="skill">
        <div class="skill-head"><span class="skill-name">${esc(c.name)}</span><span class="skill-lv">LV <b>${sk.lv}</b><span class="of"> / ${SK.max}</span></span></div>
        <div class="xp-bar" role="img" aria-label="${esc(c.name)} 경험치 ${Math.floor(fillPct)}%"><div class="xp-fill" style="width:${fillPct.toFixed(1)}%"></div></div>
        <div class="skill-meta"><span>${max ? '최고 레벨' : `다음 레벨까지 ${Math.max(1, Math.ceil(need - sk.xp))} XP`}</span><span class="${eff < 100 ? 'warn-text' : ''}">오늘 단련 효율 ${eff}%</span></div>
        <p class="skill-effect">${esc(skillEffect(k))}${esc(next)}</p>
        ${c.elite ? `<div class="elite-box${max ? ' on' : ''}"><div class="elite-head"><span class="elite-tag">${max ? '엘리트' : `엘리트 · LV ${SK.max}에 열림`}</span><b>${esc(c.elite.name)}</b></div><p>${esc(c.elite.desc)}</p></div>` : ''}
        <p class="note">${esc(c.train)}</p>
      </li>`;
    }).join('');
    return `<section class="section">
      <div class="section-head"><h2>스킬</h2><span class="meta">행동할수록 오른다 · 최대 LV ${SK.max}</span></div>
      ${tabs}
      <ul class="skills">${rows}</ul>
      ${dsStacks() ? `<p class="note good-text">${esc(dsRewardText(dsStacks()))} (깊은 잠 ${G.stats.deepSleeps}회)</p>` : ''}
      <p class="note">같은 날 한 스킬을 많이 단련할수록 효율이 떨어지고, 날이 바뀌면 회복된다. 쓰러졌다가 깨어나도 스킬은 그대로 남는다. 최대 레벨에 닿으면 그 스킬의 엘리트 능력이 열린다.</p>
    </section>`;
  }

  function renderScene() {
    if (G.pending) return `${placeHeader()}${encounterCard()}${recentBox(G.pending.text)}${statusSection()}${logSection()}`;
    if (G.loc === 'hideout') {
      const slots = stashSlots();
      return `
        ${placeHeader()}
        <section class="section">
          <div class="actions">
            ${actBtn('출발하기', '지도에서 갈 곳 고르기', 'tab', 'map', 'primary')}
            ${actBtn('잠자기', `${fmtDur(C.sleepMinutes)} · 피로와 스테미너 회복`, 'sleep')}
            ${actBtn('휴식', `${fmtDur(C.restMinutes)} · 스테미너 회복`, 'rest')}
            ${actBtn('라디오 듣기', radioSub(), 'radio', '', radioStatus().fresh || radioStatus().missed ? 'on' : '')}
            ${facCfg('gym') ? actBtn('운동하기', `${fmtDur(EX.minutes)} · 힘·지구력 단련`, 'exercise', '', '', P().stamina < EX.minStamina) : ''}
            ${actBtn('시설 관리', hideoutHint(), 'tab', 'fac')}
            ${actBtn('짐 정리', `창고 ${slots}/${stashCap()}칸`, 'tab', 'inv')}
            ${escapeBtns()}
            ${labAskBtn()}
            ${G.residents.dj && bondLive('dj') && countHave('core_data') > 0 && !qflag('core_used') ? actBtn('한지수에게 핵심 데이터를 넘긴다', '세상에 알린다 · 엔딩', 'truth', '', 'on') : ''}
            ${crowMarkBtn()}
            ${bondBtns()}
            ${shopBtns()}
            ${G.residents.clinic && resActive('clinic') && qflag('clinic') ? actBtn('이서윤에게 치료받기', G.flags.clinicDay === dayOf(G.time) ? '오늘은 이미 치료받았다' : '무료 치료 · 1시간', 'clinic', '', '', G.flags.clinicDay === dayOf(G.time)) : ''}
          </div>
          ${overweightNote()}
          ${recentBox()}
        </section>
        ${residentsSection()}
        ${statusSection()}
        ${quickUseSection('먹고 마시기', true)}
        ${logSection()}`;
    }
    const L = LOC[G.loc], st = G.locs[G.loc];
    const groundIds = sortedIds(st.ground);
    const groundRows = groundIds.map((id) => {
      const q = st.ground[id];
      const can = carryFit(id, 1) > 0;
      return itemRow(id, q, btn('챙기기', 'take', id, '1', 'primary', !can) + (q > 1 ? btn('전부', 'take', id, 'all', '', !can) : '') + btn('숨기기', 'hide', id, 'ground'));
    }).join('');
    const searchSub = st.spots > 0 ? `${fmtDur(searchMinutes())} · 남은 구역 ${st.spots}` : '더 뒤질 곳이 없다';
    return `
      ${placeHeader()}
      <section class="section">
        <div class="actions">
          ${actBtn('수색하기', searchSub, 'search', '', st.spots > 0 ? 'primary' : '', st.spots <= 0)}
          ${actBtn('거점으로 귀환', fmtDur(travelMinutes('hideout')), 'travel', 'hideout')}
          ${actBtn('다른 곳으로', '지도 열기', 'tab', 'map')}
          ${actBtn('휴식', `${fmtDur(C.restMinutes)} · 스테미너 회복`, 'rest')}
          ${G.loc === 'lab3' && qflag('lab_power') ? actBtn('온실을 봉인한다', `${itemsText(C.lab.sealNeed)} (들고 있는 것) · 되돌릴 수 없다 · 엔딩`, 'sealLab', '', '', !C.lab.sealNeed.every(([id, n]) => (P().inv[id] || 0) >= n)) + actBtn('LS-7 원본을 내 몸에 주사한다', '되돌릴 수 없다 · 엔딩', 'subject') : ''}
          ${isLab(G.loc) ? G.labDoors.filter((id) => ROOMS[id].loc === G.loc).map((id) => actBtn('굳게 닫힌 문이다.', `${ROOMS[id].name} · ${RTYPE[ROOMS[id].type].color} 카드 리더기${roomLocked(id) ? ' · 봉쇄됨' : ''}`, 'labDoor', id, 'on')).join('') : ''}
          ${G.loc === 'lab1' && !qflag('lab_power') ? actBtn('발전실에 연료 넣기', `연료통 ${C.lab.powerFuel}개 (들고 있는 것) · 30분 · 불이 켜지고 B3 승강기가 움직인다`, 'labPower', '', (P().inv.fuel || 0) >= C.lab.powerFuel ? 'on' : '', (P().inv.fuel || 0) < C.lab.powerFuel) : ''}
          ${G.loc === G.labDoor && qflag('lab_door') ? actBtn('연구소로 내려가기', P().inv.lab_card > 0 ? `온실 출입 카드 · 남은 사용 ${C.lab.cardUses - G.cardWear}/${C.lab.cardUses}` : '온실 출입 카드가 필요하다', 'travel', 'lab1', 'on', !(P().inv.lab_card > 0)) : ''}
          ${radioCfg() ? actBtn('무전기 듣기', `${ITEMS[P().radio].name} · ${fmtDur(ST.radio.minutes)}`, 'radio', '', radioStatus().fresh ? 'on' : '') : ''}
          ${actBtn(ui.showHides ? '숨길 곳 닫기' : '숨기기', hiddenKinds(G.loc) ? `숨겨 둔 물건 ${hiddenKinds(G.loc)}종` : `숨길 곳 ${G.locs[G.loc].hides.length}곳 보기`, 'toggleHides', '', ui.showHides ? 'on' : '')}
          ${G.caches.filter((c) => c.loc === G.loc).map((c) => actBtn('메모에 적힌 곳 뒤지기', `${c.place} · ${fmtDur(ST.cacheMinutes)}`, 'openCache', c.id, 'on')).join('')}
          ${bondBtns()}
          ${placeBtns()}
          ${shopBtns()}
          ${reinviteBtns()}
          ${G.loc === 'mart' && qflag('clinic') && bondLive('clinic') && !G.residents.clinic ? actBtn('진료소 · 이서윤', G.flags.clinicDay === dayOf(G.time) ? '오늘은 이미 치료받았다' : '무료 치료 · 1시간', 'clinic', '', '', G.flags.clinicDay === dayOf(G.time)) : ''}
        </div>
        ${overweightNote()}
        ${recentBox()}
      </section>
      ${ui.showHides ? hidesSection() : ''}
      ${statusSection()}
      <section class="section">
        <div class="section-head"><h2>주변에 있는 물건</h2>${groundIds.length ? btn('모두 챙기기', 'takeAll', '', '', 'primary') : ''}</div>
        ${groundIds.length ? `<ul class="items">${groundRows}</ul>` : '<p class="empty">수색해서 찾은 물건이 여기에 놓인다.</p>'}
        <p class="note">그냥 두고 가면 날이 바뀔 때 ${pct(HIDE.groundTheft)}% 확률로 누군가 가져간다. 오래 둘 물건은 숨기자.</p>
      </section>
      ${quickUseSection('가진 음식과 약', false)}
      ${logSection()}`;
  }

  function invButtons(id, q, from) {
    const it = ITEMS[id];
    const atHome = G.loc === 'hideout';
    let b = '';
    if (it.cook && atHome) b += btn(cookVerb(it)[0], 'cook', id, '', 'primary');
    if (isUsable(it)) b += btn(useLabel(it), 'use', id, from, isRisky(it) ? 'danger' : 'primary');
    if (EQ_CATS.includes(it.cat)) b += btn(EQUIP_LABEL[it.cat], 'equip', id, from, 'primary');
    if (it.fill) b += btn('물 채우기', 'fill', id, from, 'primary', !fillFroms(it.fill).some((w) => (P().inv[w] || 0) + (atHome ? G.stash[w] || 0 : 0) >= (it.fill.n || 1)));
    if (it.salvage) b += btn('해체', 'dismantle', id, from);
    if (caseSlotsFor(from === 'stash' ? 'stash' : 'inv', id).length) b += btn('케이스에', 'casePut', id, from);
    if (from === 'inv') b += btn(P().locked[id] ? '잠금 풀기' : '잠금', 'lock', id, '', P().locked[id] ? 'on' : '');
    if (from === 'stash') {
      const can = carryFit(id, 1) > 0;
      b += btn('꺼내기', 'retrieve', id, '1', '', !can) + (q > 1 ? btn('전부', 'retrieve', id, 'all', '', !can) : '');
    } else if (atHome) {
      const can = stashFit(id, 1) > 0;
      b += btn('창고로', 'store', id, '1', '', !can) + (q > 1 ? btn('전부', 'store', id, 'all', '', !can) : '');
    } else {
      b += btn('숨기기', 'hide', id, 'inv');
    }
    b += btn('버리기', 'discard', id, from, 'ghost discard');
    return b;
  }
  // 기어 효과를 짧게
  function gearText(it) {
    if (it.radio) { const r = it.radio; return ['어디서나 라디오', r.static ? `잡음 ${pct(r.static)}%` : '', r.enc < 1 ? `조우 -${pct(1 - r.enc)}%` : '', r.supply ? '보급 방송' : '', r.pmc ? 'PMC 무전' : ''].filter(Boolean).join(' · '); }
    if (it.ear) return `승률 +${it.ear.win}% · 쉬거나 잘 때 습격 -${pct(1 - it.ear.rest)}%`;
    return '';
  }
  function equipRow(label, id, kind, idx, empty) {
    const it = id ? ITEMS[id] : null;
    let what;
    if (!it) what = `<span class="note">${empty}</span>`;
    else if (it.cat === 'weapon') what = `${esc(it.name)} <span class="note">(${esc(atkText(id))}${esc(ammoText(id))} · ${fmtKg(it.w)}kg)</span>`;
    else if (it.cat === 'armor') what = `${esc(it.name)} <span class="note">(피해 -${pct(it.def)}% · 디버프 -${pct(it.dbf)}% · 두께 ${it.thick || 1} · ${fmtKg(it.w)}kg)</span>`;
    else if (it.cat === 'gear') what = `${esc(it.name)} <span class="note">(${esc(gearText(it))} · ${fmtKg(it.w)}kg)</span>`;
    else what = `${esc(it.name)} <span class="note">(+${it.bag}kg · ${fmtKg(it.w)}kg)</span>`;
    const none = !slotChoices(kind).length;
    const pick = btn(it ? '바꾸기' : '착용', 'pickSlot', kind, String(idx), it ? '' : 'primary', none);
    return `<div class="equip-row${GEAR_SLOT[kind] ? ' gear' : ''}"><span class="slot">${esc(label)}</span><span class="what">${what}</span><span class="equip-btns">${pick}${it ? btn(it.cat === 'weapon' ? '해제' : '벗기', 'unequip', kind, String(idx)) : ''}</span></div>`;
  }
  // 겹쳐 입었을 때만 합계를 보여 주고, 둔해졌을 때만 무엇이 나빠지는지 보여 준다
  function layerSummary() {
    if (P().armors.length < 2) return '';
    const over = thickOver();
    const pen = over ? ` · 껴입어서 둔하다 → 행동시간 +${Math.round(over * EQ.perTime * 100)}% · 스테미너 소모 +${Math.round(over * EQ.perStamina * 100)}% · 승률 -${over * EQ.perWin}% · 도망 -${over * EQ.perFlee}%` : '';
    return `<p class="note${over ? ' warn-text' : ''}">옷 ${P().armors.length}겹: 받는 피해 -${pct(armorDef())}% · 디버프 확률 -${pct(armorDbf())}% · 두께 ${thickness()}${pen}</p>`;
  }
  // 장착한 총의 부착물 칸
  function gunModBlock(key) {
    const gid = gunAt(key), g = gid && ITEMS[gid];
    if (!g || !g.slots) return '';
    const m = modsAt(key);
    const rows = g.slots.map((slot) => {
      const it = m[slot] && ITEMS[m[slot]];
      const can = modChoices(key, slot).length > 0;
      const what = it ? `${esc(it.name)}<span class="note">${esc(modEffect(it))}</span>` : '<span class="note">비어 있다</span>';
      const b = it ? (can ? btn('바꾸기', 'attachMod', key, slot) : '') + btn('떼기', 'detachMod', key, slot) : btn('달기', 'attachMod', key, slot, can ? 'primary' : '', !can);
      return `<div class="mod-row"><span class="mod-slot">${GM_SLOTS[slot]}</span><span class="what">${what}</span><span class="equip-btns">${b}</span></div>`;
    }).join('');
    const a = modSum(m, 'ammo'), night = Math.min(modSum(m, 'night'), -CB.nightWin), quiet = modIds(m).some((x) => ITEMS[x].quiet);
    const sum = `부착물 승률 +${modSum(m, 'win')}%${night ? ` · 밤 +${night}%` : ''} · 탄약 ${g.ammoUse[0] + a}~${g.ammoUse[1] + a}발 · ${quiet ? '소음기: 총소리 없음' : '쏘면 총소리가 난다'}`;
    return `<div class="mods" id="mods-${key}">${rows}<p class="note">${sum}</p></div>`;
  }
  function equipSection() {
    const p = P();
    const rows = [];
    for (let i = 0; i < EQ.large; i++) rows.push(equipRow(`큰 무기 ${i + 1}`, p.weaponsL[i], 'L', i, '비어 있다. 방망이, 도끼, 산탄총, 소총 같은 큰 무기') + (p.weaponsL[i] ? gunModBlock(`L${i}`) : ''));
    rows.push(equipRow('작은 무기', p.weaponS, 'S', 0, '비어 있다. 칼, 마체테, 권총 같은 작은 무기') + (p.weaponS ? gunModBlock('S') : ''));
    for (let i = 0; i < EQ.layers; i++) rows.push(equipRow(`옷 ${i + 1}겹`, p.armors[i], 'A', i, i ? '비어 있다. 위에 겹쳐 입을 수 있다' : '비어 있다. 옷을 입으면 지더라도 덜 다친다'));
    rows.push(equipRow('가방', p.bag, 'bag', 0, '없다. 가방이 있으면 더 많이 들 수 있다'));
    rows.push(equipRow('무전기', p.radio, 'radio', 0, '없다. 무전기가 있으면 어디서나 라디오를 듣는다'));
    rows.push(equipRow('귀', p.ear, 'ear', 0, '없다. 헤드셋이나 이어폰을 끼면 작은 소리도 잘 들린다'));
    return `<section class="section">
        <div class="section-head"><h2>장비</h2><span class="meta">기본 중량 한계 ${C.baseCarry}kg · 싸울 때 들고 있는 무기 중에서 고른다</span></div>
        <div class="equip">${rows.join('')}</div>
        ${layerSummary()}
      </section>`;
  }

  // 소지품에 창고의 음식·물·의약품을 바로 챙겨 넣는다 (거점에서만)
  const PACK = { food: '음식', drink: '물', med: '의약품' };
  const packIds = (cat) => sortedIds(G.stash).filter((id) => ITEMS[id].cat === cat);
  function packAll(cat) {
    if (!G || G.loc !== 'hideout' || !PACK[cat]) return;
    mutate(() => {
      const moved = {};
      let left = false;
      for (const id of packIds(cat)) {
        const room = Math.max(0, carryLimit() - carried());
        const k = ITEMS[id].w > 0 ? clamp(Math.floor((room + 1e-6) / (ITEMS[id].w * weightEff())), 0, G.stash[id]) : G.stash[id];
        if (k > 0) { addTo(G.stash, id, -k); addTo(P().inv, id, k); addTo(moved, id, k); }
        if (G.stash[id]) left = true;
      }
      if (!Object.keys(moved).length) toast('더 넣으면 중량 한계를 넘는다.');
      else toast(`챙겼다: ${listText(moved)}${left ? ' (중량 한계까지만)' : ''}`);
    });
  }
  function packSection() {
    const bar = Object.entries(PACK).map(([cat, name]) => {
      const n = packIds(cat).length;
      return btn(`${name} 넣기${n ? ` (${n})` : ''}`, 'pack', cat, '', ui.pack === cat ? 'primary' : '');
    }).join('');
    let panel = '';
    if (PACK[ui.pack]) {
      const cat = ui.pack, name = PACK[cat], ids = packIds(cat);
      const rows = ids.map((id) => {
        const q = G.stash[id], can = carryFit(id, 1) > 0;
        return itemRow(id, q, btn('넣기', 'retrieve', id, '1', 'primary', !can) + (q > 1 ? btn('전부', 'retrieve', id, 'all', '', !can) : ''));
      }).join('');
      panel = `<div class="pack">
        <div class="pack-head"><span class="fac-next-label">창고에 있는 ${name}</span>${ids.length ? btn(`${name} 다 넣기`, 'packAll', cat) : ''}</div>
        ${ids.length ? `<ul class="items">${rows}</ul><p class="note">'다 넣기'는 중량 한계(${fmtKg(carryLimit())}kg)를 넘지 않을 만큼만 넣는다.</p>` : `<p class="empty">창고에 ${name}${jong(name) > 0 ? '이' : '가'} 없다.</p>`}
      </div>`;
    }
    return `<div class="row-btns seg" role="group" aria-label="창고에서 챙기기">${bar}</div>${panel}`;
  }

  // 소지품과 창고는 종류별 탭으로 나눠 본다
  const STASH_CATS = [
    ['all', '전체', null], ['food', '음식', ['food']], ['drink', '물', ['drink']], ['med', '의약품', ['med']],
    ['weapon', '무기·탄약', ['weapon', 'ammo', 'mod']], ['wear', '옷·가방', ['armor', 'bag', 'case', 'gear']], ['material', '재료·잡동사니', ['material', 'junk', 'quest']],
  ];
  const inStashCat = (id, k) => { const c = STASH_CATS.find(([x]) => x === k); return !c || !c[2] || c[2].includes(ITEMS[id].cat); };
  // m(소지품 또는 창고)을 종류별 탭으로 거른다. 비어 있는 탭은 흐리게
  function catChips(m, act, want, label) {
    const all = sortedIds(m);
    const cur = STASH_CATS.some(([k]) => k === want) ? want : 'all';
    const chips = STASH_CATS.map(([k, name]) => {
      const n = all.filter((id) => inStashCat(id, k)).length;
      const on = k === cur;
      return `<button type="button" role="tab" class="fchip${on ? ' on' : ''}" aria-selected="${on}" data-act="${act}" data-a="${k}"${!n && !on ? ' disabled' : ''}>${esc(name)}<span class="n">${n}</span></button>`;
    }).join('');
    const name = STASH_CATS.find(([k]) => k === cur)[1];
    const ids = all.filter((id) => inStashCat(id, cur));
    return {
      all, ids: ui.sortBy === 'rarity' ? byRarity(ids) : ids,
      chips: all.length ? `<div class="fchips" role="tablist" aria-label="${esc(label)}">${chips}</div>${sortToggle('sortBy', ui.sortBy, [['rarity', '레어도순'], ['cat', '종류순']])}` : '',
      none: (where) => `${where}에 ${name}${jong(name) > 0 ? '이' : '가'} 없다.`,
    };
  }

  // 짐은 장비 / 소지품 / 창고를 눌러서 하나씩 본다
  function renderInv() {
    const p = P();
    const atHome = G.loc === 'hideout';
    const invIds = sortedIds(p.inv);
    const view = ui.invView === 'stash' && !atHome ? 'inv' : ['equip', 'inv', 'stash'].includes(ui.invView) ? ui.invView : 'inv';
    const tabs = subTabs('invView', '짐 보기', [
      { id: 'equip', name: '장비', sub: `${equippedIds().length}개 착용`, state: thickOver() ? '껴입어 둔함' : '', stateCls: 'warn-text' },
      { id: 'inv', name: '소지품', sub: `${invIds.length}종${p.cases.length ? ` · 케이스 ${p.cases.length}` : ''} · ${fmtKg(mapWeight(p.inv) + caseWeight(p.cases))}kg` },
      { id: 'stash', name: '창고', sub: atHome ? `${stashSlots()}/${stashCap()}칸` : '거점에서만', disabled: !atHome },
    ], view);
    let body;
    if (view === 'equip') body = equipSection();
    else if (view === 'stash') {
      const c = catChips(G.stash, 'stashCat', ui.stashCat, '창고 종류');
      body = `
        <section class="section">
          <div class="section-head"><h2>창고</h2><span class="meta">${stashSlots()}/${stashCap()}칸 사용 중 · 무게 제한 없음</span></div>
          ${c.chips}
          ${c.ids.length ? `<ul class="items">${c.ids.map((id) => itemRow(id, G.stash[id], invButtons(id, G.stash[id], 'stash'))).join('')}</ul>`
            : `<p class="empty">${c.all.length ? esc(c.none('창고')) : '창고가 비어 있다.'}</p>`}
        </section>
        ${casesSection('stash')}`;
    } else {
      const c = catChips(p.inv, 'invCat', ui.invCat, '소지품 종류');
      body = `
      <section class="section">
        <div class="section-head"><h2>소지품</h2><span class="meta">${invIds.length}종${p.cases.length ? ` · 케이스 ${p.cases.length}` : ''} · ${fmtKg(mapWeight(p.inv) + caseWeight(p.cases))}kg</span>${atHome && invIds.length ? btn('전부 창고에 넣기', 'storeAll', '', '', 'primary') : ''}</div>
        ${atHome ? packSection() : ''}
        ${c.chips}
        ${c.ids.length ? `<ul class="items">${c.ids.map((id) => itemRow(id, p.inv[id], invButtons(id, p.inv[id], 'inv'), null, p.locked[id] ? '<span class="chip">잠금</span>' : '')).join('')}</ul>`
          : `<p class="empty">${invIds.length ? esc(c.none('소지품')) : '들고 있는 물건이 없다.'}</p>`}
        ${Object.keys(p.locked).some((id) => p.inv[id]) && atHome ? '<p class="note">잠근 물건은 \'전부 창고에 넣기\'를 눌러도 그대로 들고 있다.</p>' : ''}
        ${casesSection('inv')}
        ${atHome ? '' : '<p class="note">창고는 거점에서만 열 수 있다. 바깥에서는 물건을 숨겨 둘 수 있고, 숨긴 곳은 현장 화면에서 볼 수 있다.</p>'}
      </section>`;
    }
    return tabs + body;
  }

  function mapSvg() {
    const S = 21;
    const pt = (id) => {
      const p = POS[id], d = Math.hypot(p.x, p.y);
      if (!d) return { x: 0, y: 0 };
      const r = Math.sqrt(d) * S;
      return { x: (p.x / d) * r, y: (p.y / d) * r };
    };
    const rings = [[60, '1시간'], [120, '2시간'], [240, '4시간'], [360, '6시간']]
      .map(([m, t]) => { const r = Math.sqrt(m) * S; return `<circle class="ring" cx="0" cy="0" r="${r.toFixed(1)}"/><text class="ring-label" x="8" y="${(-r - 8).toFixed(1)}">${t}</text>`; })
      .join('');
    let route = '';
    if (ui.sel && ui.sel !== G.loc) {
      const a = pt(G.loc), b = pt(ui.sel);
      route = `<line class="route" x1="${a.x.toFixed(1)}" y1="${a.y.toFixed(1)}" x2="${b.x.toFixed(1)}" y2="${b.y.toFixed(1)}"/>`;
    }
    const dots = OUT_LOCS.map((l) => {
      const q = pt(l.id);
      const anchor = q.x > 120 ? 'end' : 'start';
      const lx = anchor === 'end' ? q.x - 22 : q.x + 22;
      const here = G.loc === l.id ? `<circle class="here" cx="${q.x.toFixed(1)}" cy="${q.y.toFixed(1)}" r="24"/>` : '';
      return `<g data-act="sel" data-a="${l.id}">
        ${here}<circle class="loc-dot dd${l.danger}" cx="${q.x.toFixed(1)}" cy="${q.y.toFixed(1)}" r="13"/>
        <text class="loc-label${ui.sel === l.id ? ' sel' : ''}" x="${lx.toFixed(1)}" y="${(q.y + 10).toFixed(1)}" text-anchor="${anchor}">${esc(l.name)}</text>
      </g>`;
    }).join('');
    const homeHere = G.loc === 'hideout' ? '<circle class="here" cx="0" cy="0" r="26"/>' : '';
    return `<svg class="map" viewBox="-420 -420 840 840" aria-label="도시 지도">
      ${rings}${route}
      <g data-act="sel" data-a="hideout">${homeHere}<rect class="hideout" x="-12" y="-12" width="24" height="24"/><text class="loc-label${ui.sel === 'hideout' ? ' sel' : ''}" x="0" y="-34" text-anchor="middle">거점</text></g>
      ${dots}
    </svg>`;
  }

  function renderMap() {
    const day = dayOf(G.time);
    const refillIn = Math.max(1, G.lastRefillDay + C.refill.everyDays - day);
    const ids = ['hideout', ...LOCS.filter((l) => !l.hidden || labShown(l)).map((l) => l.id)];
    ids.sort((a, b) => distMin(G.loc, a) - distMin(G.loc, b));
    const blocked = !!G.pending;
    const rows = ids.map((id) => {
      const here = id === G.loc;
      const mins = here ? 0 : travelMinutes(id);
      const arrive = G.time + mins;
      const eta = `${rideOk(id) && !here ? '오토바이 ' : ''}${fmtDur(mins)} · 도착 ${clockStr(arrive)}${isNight(arrive) ? ' (밤)' : ''}`;
      let name, meta;
      if (id === 'hideout') {
        name = '<span>거점</span>';
        meta = here ? '지금 여기 있다' : eta;
      } else {
        const l = LOC[id], st = G.locs[id];
        name = `<span>${esc(l.name)}</span>${dangerChip(l.danger)}`;
        const spots = st.visited ? `수색 구역 ${st.spots}/${l.spots}` : '아직 가 보지 않음';
        const enc = `조우 ${pct(encChance(id))}%${noisy(id) ? ' (총소리)' : ''}`;
        const hk = hiddenKinds(id);
        const cn = G.caches.filter((c) => c.loc === id).length;
        const bn = BONDS.filter((b) => { const st = bondStep(b); return st && st.loc === id; }).map((b) => b.who);
        const hid = (hk ? ` · 숨겨 둔 물건 ${hk}종` : '') + (cn ? ` · 메모에 적힌 곳 ${cn}` : '') + (bn.length ? ` · 인연: ${bn.join(', ')}` : '');
        meta = here ? `지금 여기 있다 · ${spots} · ${enc}${hid}` : `${eta} · ${spots} · ${enc}${hid}`;
        const lb = here ? '' : labBlock(id);
        if (lb) meta += ` · ${lb}`;
      }
      return `<li class="loc-row${ui.sel === id ? ' sel' : ''}" id="row-${id}">
        <div class="lr-main"><div class="lr-name">${name}${here ? '<span class="chip ok">현재 위치</span>' : ''}</div><div class="lr-meta">${esc(meta)}</div></div>
        ${here ? '' : btn('이동', 'travel', id, '', ui.sel === id ? 'primary' : '', blocked || !!labBlock(id))}
      </li>`;
    }).join('');
    return `
      <section class="section">
        <div class="section-head"><h2>지도</h2><span class="meta">거점 기준 걸어서 걸리는 시간 · 다음 보급까지 ${refillIn}일</span></div>
        ${blocked ? '<p class="note bad-text">눈앞의 상황부터 해결해야 움직일 수 있다.</p>' : ''}
        ${bikeSection()}
        <div class="map-wrap">${mapSvg()}</div>
        <div class="row-btns" aria-label="위험도">${D.dangers.map((d, i) => dangerChip(i)).join('')}</div>
        ${overweightNote()}
      </section>
      <section class="section">
        <div class="section-head"><h2>갈 수 있는 곳</h2><span class="meta">가까운 순 · 조우는 수색 1회당 확률</span></div>
        <ul class="locs">${rows}</ul>
      </section>`;
  }

  function renderMenu() {
    const cloud = !!Store.ref;
    // 위기 상황이나 쓰러진 상태에서는 세이브 코드를 만들 수 없다 (결과를 되돌리는 데 쓰지 못하게)
    const noCode = !!(G.pending || G.dead);
    if (noCode && ui.menuView === 'export') { ui.menuView = null; ui.exportCode = ''; }
    let codeBlock = '';
    if (ui.menuView === 'export') {
      codeBlock = `<textarea id="export-code" class="code" readonly>${esc(ui.exportCode)}</textarea>
        <div class="row-btns">${btn('코드 복사', 'copyCode', '', '', 'primary')}${btn('닫기', 'menuView', '')}</div>`;
    } else if (ui.menuView === 'import') {
      codeBlock = `<textarea id="import-code" class="code" placeholder="RH1. 으로 시작하는 세이브 코드를 붙여넣기"></textarea>
        <div class="row-btns">${btn('불러오기', 'importCode', 'game', '', 'primary')}${btn('닫기', 'menuView', '')}</div>
        <p class="note">불러오면 지금 하던 게임은 사라진다.</p>`;
    }
    const nightEnc = pct(CB.nightEncounterMult - 1);
    // 아이템 도감: 열 때마다 data.js에서 새로 계산한다 (codex.js)
    if (ui.menuView === 'codex') {
      return `<section class="section">
        <div class="section-head"><h2>아이템 도감</h2><span class="meta">게임 데이터에서 바로 계산</span></div>
        <div class="row-btns">${btn('메뉴로 돌아가기', 'menuView', '')}</div>
        <div id="codex-root" class="codex"></div>
      </section>`;
    }
    return `
      <section class="section">
        <div class="section-head"><h2>아이템 도감</h2></div>
        <p class="note">모든 아이템의 제작 가능 여부와 장소별·적별 드랍 확률, 해체·상인·사건으로 얻는 곳. 게임 수치가 바뀌면 도감도 같이 바뀐다.</p>
        <div class="row-btns">${btn('도감 열기', 'menuView', 'codex', '', 'primary')}</div>
      </section>
      <section class="section">
        <div class="section-head"><h2>생존 기록</h2></div>
        <dl class="kv">
          <dt>생존</dt><dd>${dayOf(G.time)}일차</dd>
          <dt>수색 횟수</dt><dd>${G.stats.searches}회</dd>
          <dt>쓰러뜨린 적</dt><dd>${G.stats.kills}</dd>
          <dt>악몽에서 깨어난 횟수</dt><dd>${G.stats.deaths}회</dd>
          ${G.stats.deepSleeps ? `<dt>깊은 잠</dt><dd>${G.stats.deepSleeps}회${dsStacks() ? ` · ${esc(dsRewardText(dsStacks()))}` : ''}</dd>` : ''}
        </dl>
      </section>
      <section class="section">
        <div class="section-head"><h2>깊은 잠</h2></div>
        <p class="note">DAY 1부터 다시 시작한다. 지어 둔 시설은 ${DS.facLevel}레벨로, 스킬은 -${DS.skillLoss}로 남고, 나머지(물건, 창고, 기록, 인연, 라디오, 숨겨 둔 물건)는 모두 처음으로 돌아간다.${DSR ? ` 대신 잘 때마다 ${iga(DSR.name)} 한 겹씩 쌓이고(최대 ${DSR.maxStacks}겹, 한 겹에 스킬 경험치 +${Math.round(DSR.xpPerStack * 100)}% · 최대 HP +${DSR.hpPerStack}, 영구), 창고에 기초 물자가 놓여 있다.` : ''}</p>
        <div class="row-btns">${btn('깊은 잠에 빠진다', 'deepSleep', '', '', 'danger', !!G.pending)}</div>
      </section>
      <section class="section">
        <div class="section-head"><h2>저장</h2></div>
        <p class="note">행동할 때마다 자동으로 저장된다. ${cloud ? '이 계정에도 저장되어 다른 기기에서 이 링크를 열어도 이어서 할 수 있다.' : '지금은 이 브라우저에만 저장된다. 다른 기기로 옮기려면 세이브 코드를 쓰자.'}</p>
        <div class="row-btns">${btn('세이브 코드 만들기', 'exportCode', '', '', '', noCode)}${btn('세이브 코드 불러오기', 'menuView', 'import')}</div>
        ${noCode ? '<p class="note">눈앞의 상황을 해결한 뒤에 세이브 코드를 만들 수 있다.</p>' : ''}
        ${codeBlock}
      </section>
      <section class="section">
        <div class="section-head"><h2>규칙 요약</h2></div>
        <ul class="help">
          <li><b>전투</b>: 수색·이동·휴식 중에 적을 만날 수 있다. 이길 확률은 위험도 기본값(안전함 ${CB.base[0]}% ~ 매우위험함 ${CB.base[4]}%)에 적 종류, 무기, 밤, 부상, 과적, 디버프가 더해진다. 지면 크게 다치고 출혈·감염·골절에 걸릴 수 있다. 도망칠 기회가 있을 때도 있다.</li>
          <li><b>거점 시설</b>: 재료를 모아 발전기·작업대·창고·침실·의무실·조리대·정수기·체육관·방어벽을 짓고 올린다(각 ${FAC.workbench.levels.length}레벨). 높은 레벨에서는 새 제작법이 열리고, 시설에서 만드는 시간이 줄고, 태양광·감염 치료 같은 효과가 붙는다. 공사와 제작은 시간이 걸리지만 자리를 비워도 진행된다. 정수기와 일부 제작에는 발전기 전력이 필요하다.</li>
          <li><b>숨기기</b>: 바깥에서는 장소마다 있는 숨길 곳 5곳에 물건을 숨겨 둘 수 있다. 곳마다 숨기는 시간과 털릴 확률(하루 단위)이 다르고, 털릴 확률은 실제로 털려 봐야 알 수 있다. 털린 건 그 장소에 다시 가야 알게 된다. 숨긴 물건은 쓰러져도 남는다.</li>
          <li><b>라디오</b>: 거점에서 라디오를 들을 수 있다(${fmtDur(ST.radio.minutes)}). 무전기를 챙기면 밖에서도 들을 수 있다. 채널마다 날이 갈수록 방송이 바뀌고, 끊기기도 하고, 다시 살아나기도 한다. 듣지 못하고 지나간 방송은 나중에 켤 때 '지난 방송'으로 무작위로 다시 나온다. 들으면 공포가 조금 가라앉는다.</li>
          <li><b>메모에 적힌 곳</b>: 낙서된 지도나 쪽지를 찾으면 적힌 장소에 가서 숨겨진 물건을 찾을 수 있다. 지도와 그 장소의 현장 화면에 표시된다.</li>
          <li><b>인연</b>: 기록을 모으거나 라디오를 듣다 보면 기록 속 사람들이 어디 있는지 알게 된다. 그 장소에 가면 만나서 돕거나 구할 수 있다. 시간이 정해진 만남도 있다. 도운 일은 라디오에 소식으로 나오고, 저마다 보답이 있다. '기록' 탭의 '인연'에서 진행 상황을 볼 수 있다.</li>
          <li><b>기록</b>: 장소를 수색하다 보면 사람들이 남긴 메모를 찾는다. 같은 사람의 메모를 모으면 일상부터 지금까지 한 사람의 이야기가 이어진다. '기록' 탭에서 인물별로, 또는 시간순으로 읽을 수 있다.</li>
          <li><b>위험한 아이템</b>: 식중독 확률이 ${pct(C.riskPoisonAt)}% 이상이거나 반동이 있는 아이템은 빨간색으로 표시되고, 쓰기 전에 한 번 더 묻는다. 날고기·눅눅한 빵·빗물은 거점 조리대에서 익히거나 끓이면 안전해진다. 소지품·창고의 익히기·끓이기 버튼은 조리대 제작을 바로 시작하는 지름길이라 재료와 시간이 조리대와 같다. 발전기가 켜져 있으면 전기로 해서 목재가 필요 없다.</li>
          <li><b>배불리 먹기</b>: 먹고 마셔서 배고픔과 갈증을 둘 다 ${C.fullBuff.at} 이하(거의 0)까지 채우면 ${esc(BUFFS[C.fullBuff.buff].name)}(${esc(BUFFS[C.fullBuff.buff].desc)})이 ${fmtDur(C.fullBuff.minutes)} 붙는다. 신진대사 LV마다 ${Math.round(C.fullBuff.perLv * 100)}%씩 길어진다.</li>
          <li><b>음식 효과</b>: 고기 스튜(든든함), 구운 고기(기운), 전투식량(군용 보급), 초콜릿·탄산음료(당 충전), 에너지 드링크(각성)는 먹으면 일정 시간 버프가 붙는다. 신진대사가 오르면 음식 효과와 버프 시간이 늘어난다.</li>
          <li><b>스킬</b>: 힘·지구력·체력·집중력·스트레스 저항력·신진대사·지능은 관련된 행동을 할수록 오른다(최대 LV ${SK.max}). LV ${SK.max}에 닿으면 스킬마다 엘리트 능력이 하나씩 열린다(힘: 과적 피해 없음, 체력: 하루 한 번 HP 1로 버팀 등). '스킬' 탭에서 효과와 올리는 법을 볼 수 있다.</li>
          <li><b>장비</b>: 큰 무기 ${EQ.large}개와 작은 무기 ${EQ.small}개를 들 수 있고, 싸울 때 그중 하나를 고른다. 총은 탄약이 있어야 제값을 한다. 근접 무기는 힘, 총은 집중력이 오를수록 강해진다. 산탄총은 감염자 무리와 변이 감염자에게, 기관단총은 무리와 들개에게(권총탄을 많이 쓴다), 사냥용 소총은 변이 감염자와 약탈자에게 더 잘 듣는다. 장비 화면에서 총에 부착물(조준경·총구·탄창·개머리판·레일)을 달 수 있다. 소음기 없이 바깥에서 쏘면 한동안 그곳에 놈들이 몰려든다. 탄약을 안 쓰는 무기로도 거의 똑같이 이길 수 있으면 그 무기가 먼저 골라진다. 옷은 ${EQ.layers}겹까지 껴입을 수 있다. 겹칠수록 덜 다치지만 너무 껴입으면 몸이 둔해진다(껴입었을 때 무엇이 나빠지는지 알려 준다).</li>
          <li><b>해체</b>: 무기·옷·가방과 잡동사니(고장 난 라디오, 컴퓨터 본체, 자전거, 빈 구급함 등)는 '짐' 탭에서 해체해 재료로 되돌릴 수 있다(장착한 것은 먼저 벗기). 전선·화약 같은 고급 재료는 확률로만 건진다. 지능이 오를수록 재료가 더 나오고, 고급 재료를 잘 건지고, 제작·해체가 빨라진다.</li>
          <li><b>디버프</b>: 출혈(붕대·구급상자), 감염(항생제. 감염이 n%면 하루에 최대 HP의 n%를 잃고, 방치하면 시간당 ${DB.infection.growPerHour}%씩 퍼져 피해도 점점 커진다), 골절(부목), 공포(진정제·휴식), 식중독(지사제). '몸 상태'에서 바로 치료할 수 있다.</li>
          <li><b>중량</b>: 기본 ${C.baseCarry}kg + 가방(최대 +35kg). 한계를 넘으면 <b>경과적</b>(행동시간 ×1.25), 1.25배를 넘으면 <b>중과적</b>(행동시간 ×2, 이동·수색 중 HP 감소, 도망 불가). 1.5배를 넘게는 못 줍는다.</li>
          <li><b>생존 수치</b>: 배고픔·갈증·피로는 시간이 지나면 오른다. 100이 되면 HP가 깎인다. 배고픔·갈증이 70을 넘으면 회복이 절반으로 줄어든다.</li>
          <li><b>수색 구역</b>: 장소마다 정해져 있고 뒤질수록 줄어든다. ${C.refill.everyDays}일마다 각 장소의 ${pct(C.refill.ratio)}%가 다시 채워진다.</li>
          <li><b>밤</b>: ${C.night.start}시부터 ${C.night.end}시까지. 조우 확률 +${nightEnc}%, 승률 ${CB.nightWin}%, 대신 좋은 물건이 더 잘 나온다.</li>
          <li><b>깊은 잠</b>: 메뉴에서 고를 수 있는 세미 초기화. 지어 둔 시설은 ${DS.facLevel}레벨로, 스킬은 -${DS.skillLoss}로 남고, 나머지는 모두 새 게임처럼 DAY 1부터 다시 시작한다.</li>
          <li><b>죽음</b>: 쓰러지면 고른다. <b>악몽에서 깨어나기</b>는 지니고 있던 물건을 모두 잃고 다음 날 아침 거점에서 깨어난다. <b>운명을 받아들이기</b>는 세이브를 삭제하고 끝낸다.</li>
        </ul>
      </section>
      <section class="section">
        <div class="row-btns">${btn('타이틀로', 'toTitle')}${btn('새 게임 시작', 'restart')}</div>
      </section>`;
  }

  function renderMain() {
    const main = $('#main');
    if (ui.tab === 'inv') main.innerHTML = renderInv();
    else if (ui.tab === 'map') main.innerHTML = renderMap();
    else if (ui.tab === 'skills') main.innerHTML = renderSkills();
    else if (ui.tab === 'fac') main.innerHTML = renderFacilities();
    else if (ui.tab === 'records') main.innerHTML = renderRecords();
    else if (ui.tab === 'menu') {
      main.innerHTML = renderMenu();
      if (ui.menuView === 'codex' && window.RH_CODEX) window.RH_CODEX.mount(document.getElementById('codex-root'), D);
    } else main.innerHTML = renderScene();
  }

  function renderTitle() {
    const save = bestSave();
    let body = '';
    if (ui.titleView === 'import') {
      body = `
        <div class="section-head"><h2>세이브 코드로 불러오기</h2></div>
        <textarea id="import-code" class="code" placeholder="RH1. 으로 시작하는 세이브 코드를 붙여넣기"></textarea>
        <div class="row-btns">${btn('불러오기', 'importCode', 'title', '', 'primary')}${btn('뒤로', 'titleView', 'main', '', 'ghost')}</div>`;
    } else {
      let status = '';
      if (save && save.state.dead) status = ' · 쓰러진 채로 멈춰 있다';
      else if (save && save.state.pending) status = ' · 위기 상황에서 멈춰 있다';
      // 계정 저장을 확인하는 동안(최대 몇 초)은 이어하기·새 게임을 잠시 막는다: 오래된 저장이 새 저장을 덮지 않게
      const wait = !Store.checked;
      const cont = save ? actBtn('이어하기', `${dayOf(save.state.time)}일차 ${clockStr(save.state.time)}${status}`, 'continue', '', 'primary', wait) : '';
      body = `
        <div class="title-menu">
          ${cont}
          ${actBtn('새 게임', '1일차 아침, 거점에서 시작한다', 'newGame', '', save ? '' : 'primary', wait)}
          ${actBtn('세이브 코드로 불러오기', '다른 기기에서 하던 게임 이어하기', 'titleView', 'import')}
        </div>
        ${Store.checked ? '' : '<p class="note">저장된 게임을 확인하는 중…</p>'}
        ${(() => { const rec = endingRecords(), ids = Object.keys(END.list), n = ids.filter((id) => rec[id]).length; return n ? `<div class="title-endings"><p class="note">본 엔딩 ${n}/${ids.length}</p><ul class="ending-list">${ids.map((id) => `<li class="${rec[id] ? 'seen' : ''}">${rec[id] || !END.list[id].hidden ? esc(END.list[id].title) : '???'}</li>`).join('')}</ul></div>` : ''; })()}`;
    }
    $('#title').innerHTML = `
      <div class="tape" aria-hidden="true"></div>
      <div class="title-block">
        <span class="title-kicker">텍스트 생존 시뮬레이션</span>
        <h1 class="title-name">폐허의 거점</h1>
        <p class="title-lead">무너진 도시 외곽, 지하 창고 하나가 당신의 전부다. 밖으로 나가 뒤지고, 싸우고, 짊어지고, 살아서 돌아와라. 짐이 무거울수록 길은 길어진다.</p>
        <p class="title-tag">${esc(ST.titleTagline)}</p>
      </div>
      <section class="section">${body}</section>`;
  }

  function render() {
    if (G) openCases();
    const title = $('#title'), game = $('#game');
    if (ui.screen !== 'game' || !G) {
      title.hidden = false;
      game.hidden = true;
      renderTitle();
      return;
    }
    title.hidden = true;
    game.hidden = false;
    renderHud();
    renderTabs();
    renderMain();
  }

  // ---------- 모달, 알림 ----------
  function showModal({ title, body = [], buttons = [{ label: '확인', primary: true }], stack = false }) {
    const m = $('#modal');
    m.innerHTML = `<div class="modal" role="dialog" aria-modal="true" aria-labelledby="m-title">
      <h2 id="m-title">${esc(title)}</h2>
      <div class="m-body">${body.map((t) => (Array.isArray(t) ? `<p><b>${esc(t[0])}</b> ${esc(t[1])}</p>` : t && t.html ? t.html : t && t.head ? `<div class="m-sec"><span class="m-head">${esc(t.head)}</span><p>${esc(t.text)}</p></div>` : `<p>${esc(t)}</p>`)).join('')}</div>
      <div class="row-btns${stack ? ' stack' : ''}">${buttons.map((b, i) => `<button type="button" class="btn ${b.primary ? 'primary' : b.danger ? 'danger' : ''}" data-mi="${i}">${esc(b.label)}</button>`).join('')}</div>
    </div>`;
    m.hidden = false;
    m.onclick = (e) => {
      const el = e.target.closest('[data-mi]');
      if (!el) return;
      const b = buttons[+el.dataset.mi];
      m.hidden = true;
      m.innerHTML = '';
      if (b && b.onClick) b.onClick();
    };
    const first = m.querySelector('.btn.primary') || m.querySelector('.btn');
    if (first) first.focus();
  }
  // 위험한 아이템은 쓰기 전에 경고하고 한 번 더 묻는다
  function confirmRisk(id, go) {
    const it = ITEMS[id];
    const risks = it ? itemRisks(it) : [];
    if (!risks.length) return go();
    const verb = { food: ['먹을까', '먹는다'], drink: ['마실까', '마신다'], med: ['쓸까', '쓴다'] }[it.cat] || ['쓸까', '쓴다'];
    const canCook = it.cook && G && G.loc === 'hideout';
    showModal({
      title: `정말 ${eul(it.name)} ${verb[0]}?`,
      body: [...risks.map((r) => ['주의', r]), ...(it.riskTip ? [it.riskTip] : [])],
      buttons: [
        { label: '그만둔다' },
        ...(canCook ? [{ label: `먼저 ${cookVerb(it)[0]}`, primary: true, onClick: () => askCook(id) }] : []),
        { label: `그래도 ${verb[1]}`, danger: true, onClick: go },
      ],
    });
  }
  // 이름을 누르면 여는 정보 창: 부착물은 맞는 총, 버프·무작위 효과가 있는 것은 그 효과
  const hasInfo = (it) => it.cat === 'mod' || !!(it.buff || it.random);
  function itemInfo(id) {
    const it = ITEMS[id];
    if (!G || !it || modalOpen()) return;
    if (it.cat === 'mod') return modFitsWin(id);
    if (!(it.buff || it.random)) return;
    // 음식·음료의 버프는 신진대사만큼 길어진다
    const m = it.cat === 'food' || it.cat === 'drink' ? foodMult() : 1;
    const box = (b, mins, tag) => {
      const B = BUFFS[b], on = P().buffs[b];
      return `<div class="fx-box"><div class="fx-head"><b>${esc(B.name)}</b><span>${esc(`${fmtDur(mins)}${tag || ''}${on ? ` · 지금 걸려 있음 (${fmtDur(on.left)} 남음)` : ''}`)}</span></div><ul class="fx-lines">${B.desc.split(' · ').map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>`;
    };
    const basic = [it.use && useText(it), it.treat && treatText(it.treat), it.useMinutes ? `쓰는 데 ${fmtDur(it.useMinutes)}` : ''].filter(Boolean).join(' · ');
    const body = [];
    if (basic) body.push({ html: `<p class="fit-sub">${esc(basic)}</p>` });
    if (it.buff) body.push({ html: box(it.buff[0], Math.round(it.buff[1] * m), m > 1 ? ' (신진대사 보정)' : '') });
    if (it.random) {
      const X = it.random;
      body.push({ html: `<p class="fit-sub">아래 중 ${X.pick}개가 무작위로 걸린다${(X.bad || []).length ? ` · 가끔 ${X.bad.map(([t]) => DB[t].name).join('·')}` : ''}</p>` });
      body.push({ html: X.buffs.map((b) => box(b, X.minutes)).join('') });
    }
    const risks = itemRisks(it);
    if (risks.length) body.push({ html: `<p class="fx-warn">주의: ${esc(risks.join(' · '))}</p>` });
    showModal({ title: it.name, body, buttons: [{ label: '닫기', primary: true }] });
  }
  // 부착물: 어느 총에 끼울 수 있나. 맞는 총은 노랗게, 안 맞는 총은 회색으로 흐리게 (가진 총은 표시)
  function modFitsWin(id) {
    const it = ITEMS[id];
    if (!G || !it || it.cat !== 'mod' || modalOpen()) return;
    const guns = Object.keys(ITEMS).filter((g) => ITEMS[g].cat === 'weapon' && ITEMS[g].slots);
    const own = new Set([...weaponIds(), ...Object.keys(P().inv), ...Object.keys(G.stash)]);
    const chips = guns.map((g) => {
      const ok = it.fits.includes(g);
      return `<li class="fit-chip ${ok ? 'yes' : 'no'}" aria-label="${esc(`${ITEMS[g].name}: ${ok ? '끼울 수 있다' : '안 맞는다'}`)}">${esc(ITEMS[g].name)}${own.has(g) ? '<span class="fit-own">가짐</span>' : ''}</li>`;
    }).join('');
    showModal({
      title: it.name,
      body: [
        { html: `<p class="fit-sub">${esc(GM_SLOTS[it.slot])} 칸${modEffect(it) ? ` · ${esc(modEffect(it))}` : ''}</p>` },
        { html: `<ul class="fit-list">${chips}</ul>` },
      ],
      buttons: [{ label: '닫기', primary: true }],
    });
  }
  // 아이템 확률정보: 화면 맨 아래 오른쪽에서 여는 도감 창 (따로 띄운 도감 페이지 링크도 둔다)
  const CODEX_URL = 'https://claude.ai/artifact/LdYDWf97kAZLhYDQaoaScQ';
  function openCodexWin() {
    if (!window.RH_CODEX || modalOpen()) return;
    const m = $('#modal');
    m.innerHTML = `<div class="modal modal-wide" role="dialog" aria-modal="true" aria-labelledby="m-title">
      <div class="cxw-head"><h2 id="m-title">아이템 확률정보</h2><button type="button" class="btn" data-mi="close">닫기</button></div>
      <p class="note">아이템마다 어디서 얼마나 나오는지, 만들 수 있는지를 게임 데이터에서 바로 계산한다. <a href="${CODEX_URL}" target="_blank" rel="noopener">아이템 도감 새 창으로 열기 ↗</a></p>
      <div id="codex-win" class="codex"></div>
    </div>`;
    m.hidden = false;
    const close = () => { m.hidden = true; m.innerHTML = ''; };
    m.onclick = (e) => { if (e.target === m || e.target.closest('[data-mi="close"]')) close(); };
    window.RH_CODEX.mount($('#codex-win'), D);
    m.querySelector('[data-mi="close"]').focus();
  }
  function confirmBox(title, text, okLabel, onOk) {
    showModal({ title, body: [text], buttons: [{ label: '취소' }, { label: okLabel, primary: true, onClick: onOk }] });
  }
  let toastTimer = 0;
  function toast(msg) {
    let el = document.getElementById('toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'toast';
      el.className = 'toast';
      el.setAttribute('role', 'status');
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, 2600);
  }

  // ---------- 클릭 처리 ----------
  const ACTIONS = {
    codexWin: () => openCodexWin(),
    feedAll: () => feedAll(),
    toggleAutoFeed: () => mutate(() => { G.flags.autoFeedOff = !G.flags.autoFeedOff; }),
    toggleAutoEat: () => mutate(() => { G.flags.autoEat = !G.flags.autoEat; }),
    unqueue: (fid, i) => unqueue(fid, i),
    missRecipe: (rid, n) => { const R = RECIPE[rid]; if (G && R) missWin(timesIn(recipeIn(R), Math.max(1, +n || 1)), `${ITEMS[R.out[0]].name} · 모자란 재료`); },
    missUpgrade: (fid) => { const L = G && FAC[fid] && FAC[fid].levels[facLv(fid)]; if (L) missWin(L.cost, `${FAC[fid].name} LV ${facLv(fid) + 1} · 모자란 재료`); },
    pinBond: (id) => { if (!G) return; G.flags.pin = id && BOND[id] ? id : null; persist(); render(); },
    logFilter: (f) => { ui.logFilter = f; render(); },
    tab: (t) => {
      ui.tab = t;
      ui.menuView = null;
      // 받을 물건이 있으면 그 시설부터 보여 준다
      if (t === 'fac' && G && !facReady(ui.facView)) { const r = FAC_ORDER.find(facReady); if (r) ui.facView = r; }
      if (t === 'skills' && G && G.skillNew) { G.skillNew = false; persist(); }
      if (t === 'records' && G && G.recordNew) { G.recordNew = false; persist(); }
      render();
      window.scrollTo(0, 0);
    },
    prologue: () => showPrologue(),
    recordView: (v) => { ui.recordView = ['time', 'bonds', 'lab'].includes(v) ? v : 'people'; render(); },
    labAsk: () => labAsk(),
    labPower: () => labPower(),
    labDoor: (id) => openLabDoor(id),
    modFits: (id) => modFitsWin(id),
    itemInfo: (id) => itemInfo(id),
    truth: () => truthEnding(),
    deal: () => dealEnding(),
    sealLab: () => sealLab(),
    subject: () => subjectEnding(),
    bribe: () => bribe(),
    meet: (id) => meetBond(id),
    clinic: () => clinicVisit(),
    qplace: (key) => doPlace(key),
    shop: (id) => openShop(id),
    feedRes: (id, kind) => feedRes(id, kind),
    reinvite: (id) => reinvite(id),
    crowMark: () => crowMark(),
    contact: () => contactCommand(),
    escape: () => askEscape(),
    invView: (v) => { ui.invView = v; render(); },
    stashCat: (k) => { ui.stashCat = k; render(); },
    invCat: (k) => { ui.invCat = k; render(); },
    sortBy: (k) => { ui.sortBy = k === 'cat' ? 'cat' : 'rarity'; render(); },
    recipeSort: (k) => { ui.recipeSort = k === 'level' ? 'level' : 'rarity'; render(); },
    facView: (v) => { ui.facView = v; render(); },
    skillView: (v) => { ui.skillView = v; render(); },
    toggleHides: () => {
      ui.showHides = !ui.showHides;
      render();
      const el = document.getElementById('hides');
      if (ui.showHides && el) el.scrollIntoView({ block: 'nearest', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    },
    upgrade: (fid) => upgrade(fid),
    craft: (rid) => craft(rid, craftQty(rid)),
    collect: (fid) => collect(fid),
    collectWater: () => collectWater(),
    addFuel: () => addFuel(),
    toggleGen: () => toggleGen(),
    exercise: () => exercise(),
    radio: () => listenRadio(),
    openCache: (id) => openCache(id),
    travel: (dest) => travel(dest),
    search: () => search(),
    rest: () => rest(),
    sleep: () => sleep(),
    fight: (wid) => fight(wid),
    flee: () => flee(),
    choose: (i) => chooseEvent(i),
    use: (id, from) => confirmRisk(id, () => useItem(id, from)),
    take: (id, n) => take(id, n),
    takeAll: () => takeAll(),
    hide: (id, src) => askHide(id, src),
    hideAll: (i) => { if (G && G.pending) return toast('눈앞의 상황부터 해결해야 한다.'); pickSpotAll(+i); },
    unhide: (i, id) => doRetrieve(+i, id || 'all'),
    store: (id, n) => store(id, n),
    storeAll: () => storeAll(),
    bikeToggle: () => bikeToggle(),
    bikeFuel: () => bikeFuel(),
    lock: (id) => toggleLock(id),
    fill: (id, from) => fillItem(id, from),
    casePut: (id, from) => casePut(id, from),
    caseTake: (a, id) => caseTake(a, id),
    caseMove: (a) => caseMove(a),
    caseDrop: (a) => caseDrop(a),
    caseUse: (a, id) => confirmRisk(id, () => useItem(id, `case:${a}`)),
    retrieve: (id, n) => retrieve(id, n),
    equip: (id, from) => equip(id, from),
    unequip: (kind, idx) => unequip(kind, +idx || 0),
    attachMod: (key, slot) => attachMod(key, slot),
    detachMod: (key, slot) => detachMod(key, slot),
    pickSlot: (kind, idx) => pickSlot(kind, +idx || 0),
    pack: (cat) => { ui.pack = ui.pack === cat ? null : cat; render(); },
    packAll: (cat) => packAll(cat),
    discard: (id, from) => confirmDiscard(id, from),
    dismantle: (id, from) => askDismantle(id, from),
    cook: (id) => askCook(id),
    sel: (id) => {
      ui.sel = ui.sel === id ? null : id;
      render();
      const row = document.getElementById('row-' + id);
      if (row && ui.sel) row.scrollIntoView({ block: 'nearest', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    },
    continue: () => continueGame(),
    titleView: (v) => { ui.titleView = v; render(); },
    newGame: () => {
      if (bestSave()) confirmBox('새 게임', '저장된 게임이 있다. 새로 시작하면 지금 저장이 덮어써진다.', '새로 시작', startNew);
      else startNew();
    },
    menuView: (v) => { ui.menuView = v || null; render(); },
    exportCode: () => {
      if (!G || G.pending || G.dead) { toast('눈앞의 상황을 해결한 뒤에 세이브 코드를 만들 수 있다.'); return; }
      ui.exportCode = encodeSave(); ui.menuView = 'export'; render();
    },
    copyCode: () => {
      const ta = document.getElementById('export-code');
      const text = ui.exportCode;
      const fallback = () => { if (ta) { ta.focus(); ta.select(); } toast('자동 복사가 막혀 있다. 선택된 코드를 직접 복사하자.'); };
      try {
        navigator.clipboard.writeText(text).then(() => toast('세이브 코드를 복사했다.'), fallback);
      } catch (e) { fallback(); }
    },
    importCode: (where) => {
      const ta = document.getElementById('import-code');
      let st;
      try { st = decodeSave(ta ? ta.value : ''); } catch (e) { toast('세이브 코드가 올바르지 않다. RH1. 으로 시작하는 코드 전체를 붙여넣자.'); return; }
      const apply = () => {
        G = st;
        baseAt = confirmedAt();
        G.recent = [];
        log('세이브 코드로 게임을 불러왔다.');
        ui.screen = 'game'; ui.tab = 'scene'; ui.menuView = null; ui.titleView = 'main';
        persist(); render(); window.scrollTo(0, 0);
        showDeathChoice();
      };
      if (where === 'game' || bestSave()) confirmBox('불러오기', '지금 저장된 게임을 이 코드의 게임으로 바꾼다.', '불러오기', apply);
      else apply();
    },
    toTitle: () => { Store.flushNow(); ui.screen = 'title'; ui.titleView = 'main'; render(); window.scrollTo(0, 0); },
    deepSleep: () => askDeepSleep(),
    restart: () => confirmBox('새 게임', '지금 하던 게임을 버리고 새로 시작할까? 저장이 덮어써진다.', '새로 시작', startNew),
  };

  const modalOpen = () => { const m = $('#modal'); return !!(m && !m.hidden); };
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-act]');
    if (!el || el.disabled) return;
    if (modalOpen() && !$('#modal').contains(el)) return; // 창이 떠 있으면 뒤의 버튼은 막는다

    const fn = ACTIONS[el.dataset.act];
    if (fn) fn(el.dataset.a || '', el.dataset.b || '');
  });
  document.addEventListener('input', (e) => {
    const el = e.target;
    if (el && el.matches && el.matches('[data-qty]')) onQtyInput(el);
  });
  // 창이 떠 있는 동안 Tab은 창 안의 버튼·입력칸·링크만 돈다. 도감 창은 Esc로 닫는다
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modalOpen() && $('#codex-win')) { const m = $('#modal'); m.hidden = true; m.innerHTML = ''; return; }
    if (e.key !== 'Tab' || !modalOpen()) return;
    const btns = [...$('#modal').querySelectorAll('button, input, a[href]')];
    if (!btns.length) return;
    const i = btns.indexOf(document.activeElement);
    e.preventDefault();
    btns[(i + (e.shiftKey ? -1 : 1) + btns.length) % btns.length].focus();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') Store.flushNow();
  });

  // ---------- 부팅 ----------
  function start(data) {
    try {
      const s = data && data.save;
      if (validSave(s)) {
        G = migrate(s.state);
        baseAt = s.savedAt || 0;
        ui.screen = 'game';
        ui.tab = data.tab || 'scene';
      }
    } catch (e) { G = null; }
    render();
    showDeathChoice();
    // 계정 저장 확인이 끝나면 입력 중이 아닌 화면만 다시 그린다
    const refresh = () => {
      if ((ui.screen !== 'game' && ui.titleView === 'main') || (ui.screen === 'game' && ui.tab === 'menu' && !ui.menuView)) render();
    };
    Store.init().then(() => {
      Store.checked = true;
      Store.ready = true;
      refresh();
      if (!G || !Store.ref) return;
      const r = Store.remoteSave;
      // 계정 저장을 확인하기 전에 시작한 게임: 계정 쪽이 더 새로우면 덮어쓰지 않고 묻는다
      if (validSave(r) && (r.savedAt || 0) > baseAt) askCloudConflict(r);
      else Store.queueRemote(makeSave());
    });
    setTimeout(() => { if (!Store.checked) { Store.checked = true; refresh(); } }, 3500);
  }

  function askCloudConflict(r) {
    Store.hold = true;
    const when = (st) => `${dayOf(st.time)}일차 ${clockStr(st.time)}${st.dead ? ' (쓰러진 채)' : ''}`;
    const done = () => { Store.hold = false; render(); showDeathChoice(); };
    showModal({
      title: '계정에 더 최근 저장이 있다',
      body: [['이 기기', when(G)], ['계정 저장', when(r.state)], '어느 쪽으로 이어 할까? 고르지 않은 쪽은 덮어써진다.'],
      buttons: [
        { label: '이 기기 것으로 계속', onClick: () => { baseAt = Date.now(); done(); persist(); } },
        { label: '계정 저장 불러오기', primary: true, onClick: () => {
          G = migrate(r.state);
          baseAt = r.savedAt || 0;
          Store.writeLocal(r);
          ui.sel = null;
          ui.menuView = null;
          if (ui.screen === 'game') ui.tab = 'scene';
          done();
          window.scrollTo(0, 0);
        } },
      ],
    });
  }

  if (window.claude && window.claude.hot && typeof window.claude.hot.snapshot === 'function') {
    window.claude.hot.snapshot(() => ({ save: G ? makeSave() : null, tab: ui.tab }));
  }
  const hot = window.claude && window.claude.hot;
  if (hot && hot.ready) hot.ready(start);
  else start((hot && hot.data) || {});

  // 테스트용 진입점
  window.__RH = {
    get state() { return G; }, set state(v) { G = v; },
    render, persist, carried, carryLimit, tierIndex,
    passTime: (m, a) => passTime(m, a),
    startCombat: (id, ctx, opts) => { G.recent = []; startCombat(id, ctx || { type: 'search', danger: dangerOf(G.loc), completeOnWin: G.loc !== 'hideout' }, opts); persist(); render(); },
    startEvent: (id, ctx) => { G.recent = []; startEvent(EVENTS[id], ctx || { type: 'search', danger: dangerOf(G.loc) }); persist(); render(); },
    applyDebuff: (t) => { applyDebuff(t); render(); },
    winOdds: () => (G.pending && G.pending.kind === 'combat' ? winOdds(G.pending) : null),
    gainXp: (k, v) => { gainXp(k, v); render(); },
    stashCap: () => stashCap(),
    foodMult: () => foodMult(),
    checkThefts: () => { checkThefts(); render(); },
    nextFragmentAt: (loc) => { const f = nextFragmentAt(loc); return f ? f.id : null; },
    rollEvent: (on, danger) => { const e = rollEvent(on, danger || 0); return e ? e.id : null; },
    isPowered: () => isPowered(),
    maxHp: () => maxHp(),
    maxStamina: () => maxStamina(),
    encChanceAt: (id) => encChance(id),
    craftBlock: (rid) => craftBlock(rid),
  };
})();
