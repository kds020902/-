// 폐허의 거점 — 게임 로직 (4단계: 하이드아웃 시설, 제작, 생산)
(function () {
  'use strict';

  const D = window.GAME_DATA;
  const C = D.config;
  const DB = C.debuffs;
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
  const SAVE_VERSION = 4;
  const LOCAL_KEY = 'ruin-hideout.save.v1';
  const LOG_MAX = 150;
  const HIDEOUT_DESC = '도시 외곽의 낡은 지하 창고. 철문을 걸어 잠그면 그나마 숨을 돌릴 수 있다.';
  const DEBUFF_KEYS = ['bleed', 'infection', 'fracture', 'fear', 'poison'];
  const SLOTS = ['weapon', 'armor', 'bag'];

  // 지도 좌표: 거점이 (0,0), 거리 단위는 "걸어서 걸리는 분"
  const POS = { hideout: { x: 0, y: 0 } };
  LOCS.forEach((l) => {
    const a = (l.angle * Math.PI) / 180;
    POS[l.id] = { x: l.dist * Math.cos(a), y: -l.dist * Math.sin(a) };
  });
  const distMin = (a, b) => Math.hypot(POS[a].x - POS[b].x, POS[a].y - POS[b].y);

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
  const ro = (w) => w + (jong(w) > 0 && jong(w) !== 8 ? '으로' : '로');
  const fill = (t, place) => String(t).replace(/\{place\}/g, place);

  const dayOf = (t) => Math.floor(t / 1440) + 1;
  const hourOf = (t) => Math.floor((t % 1440) / 60);
  const isNight = (t) => { const h = hourOf(t); return h >= C.night.start || h < C.night.end; };
  const clockStr = (t) => {
    const m = ((t % 1440) + 1440) % 1440;
    return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  };

  const CAT_ORDER = { weapon: 0, armor: 1, bag: 2, ammo: 3, food: 4, drink: 5, med: 6, material: 7 };
  const USE_VERB = { food: '먹었다', drink: '마셨다', med: '사용했다' };
  const USE_LABEL = { food: '먹기', drink: '마시기', med: '사용' };
  const EQUIP_LABEL = { weapon: '들기', armor: '입기', bag: '메기' };
  const SLOT_NAME = { weapon: '무기', armor: '방어구', bag: '가방' };

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
  const ui = { screen: 'title', tab: 'scene', titleView: 'main', menuView: null, sel: null, exportCode: '' };

  function newState() {
    return {
      v: SAVE_VERSION,
      time: C.startMinute,
      loc: 'hideout',
      player: {
        hp: C.hp.base, stamina: C.stamina.max, hunger: 20, thirst: 20, fatigue: 10,
        inv: { ...D.start.inv }, bag: D.start.bag, weapon: null, armor: null, debuffs: {},
      },
      stash: { ...D.start.stash },
      locs: Object.fromEntries(LOCS.map((l) => [l.id, { spots: l.spots, ground: {}, visited: false }])),
      lastRefillDay: 1,
      log: [],
      recent: [],
      stats: { deaths: 0, searches: 0, kills: 0 },
      skills: Object.fromEntries(SKILL_KEYS.map((k) => [k, { lv: 0, xp: 0, today: 0 }])),
      skillDay: 1,
      skillNew: false,
      flags: {},
      fragments: [],
      hideout: newHideout(),
      pending: null,
      dead: false,
      deathCause: null,
    };
  }

  function newHideout() {
    return { fac: Object.fromEntries(FAC_ORDER.map((id) => [id, 0])), build: null, crafts: {}, ready: {}, fuel: 0, genOn: true, water: { stored: 0, prog: 0 } };
  }
  function cleanHideout(h) {
    const out = newHideout();
    if (!h || typeof h !== 'object') return out;
    for (const id of FAC_ORDER) out.fac[id] = clamp(Math.floor(+(h.fac && h.fac[id]) || 0), 0, FAC[id].levels.length);
    if (h.build && FAC[h.build.id] && h.build.to === out.fac[h.build.id] + 1) out.build = { id: h.build.id, to: h.build.to, left: Math.max(0, +h.build.left || 0) };
    for (const fid in h.crafts || {}) { const c = h.crafts[fid]; if (FAC[fid] && c && RECIPE[c.recipe]) out.crafts[fid] = { recipe: c.recipe, left: Math.max(0, +c.left || 0) }; }
    for (const fid in h.ready || {}) if (FAC[fid]) { const m = cleanItems(h.ready[fid]); if (Object.keys(m).length) out.ready[fid] = m; }
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
  function cleanDebuffs(d) {
    const out = {};
    if (!d || typeof d !== 'object') return out;
    for (const k of ['bleed', 'fracture', 'fear', 'poison']) if (d[k] && d[k].left > 0) out[k] = { left: +d[k].left };
    if (d.infection && d.infection.sev > 0) out.infection = { sev: Math.min(100, +d.infection.sev) };
    return out;
  }
  function cleanPending(pd) {
    if (!pd || typeof pd !== 'object' || !pd.ctx) return null;
    if (pd.ctx.type === 'travel' && !(pd.ctx.dest === 'hideout' || LOC[pd.ctx.dest])) return null;
    if (pd.kind === 'combat' && ENEMIES[pd.enemy]) return pd;
    if (pd.kind === 'event' && EVENTS[pd.id] && (!EVENTS[pd.id].trade || D.trades[pd.offer])) return pd;
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
    for (const slot of SLOTS) {
      const id = st.player[slot];
      if (id && (!ITEMS[id] || ITEMS[id].cat !== slot)) st.player[slot] = null;
    }
    st.player.debuffs = cleanDebuffs(st.player.debuffs);
    st.stash = cleanItems(s.stash);
    st.stats = { ...fresh.stats, ...(s.stats || {}) };
    st.locs = {};
    for (const l of LOCS) {
      const old = (s.locs && s.locs[l.id]) || {};
      const loc = { ...fresh.locs[l.id], ...old, ground: cleanItems(old.ground) };
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
    st.hideout = cleanHideout(s.hideout);
    st.dead = !!s.dead; // 쓰러진 채 저장됐다면 다시 열었을 때 선택지를 띄운다
    st.deathCause = st.dead ? s.deathCause || '쓰러졌다' : null;
    st.v = SAVE_VERSION;
    return st;
  }

  // ---------- 계산 ----------
  const P = () => G.player;
  const lvl = (k) => G.skills[k].lv;
  const facLv = (id) => G.hideout.fac[id] || 0;
  const facCfg = (id) => (facLv(id) ? FAC[id].levels[facLv(id) - 1] : null);
  const stashCap = () => C.stashSlots + (facCfg('stash') ? facCfg('stash').slots : 0);
  const isPowered = () => facLv('generator') > 0 && G.hideout.genOn && G.hideout.fuel > 0;
  const bedFatigueMult = () => (facCfg('bed') ? facCfg('bed').fatigueMult : 1);
  const homeHpBonus = (sleeping) => (G.loc !== 'hideout' ? 0 : (facCfg('medbay') ? facCfg('medbay').hp : 0) + (sleeping && facCfg('bed') ? facCfg('bed').hp : 0));
  const countHave = (id) => (G.stash[id] || 0) + (P().inv[id] || 0);
  const haveAll = (list) => list.every(([id, n]) => countHave(id) >= n);
  const reqMet = (req) => Object.entries(req || {}).every(([f, lv]) => facLv(f) >= lv);
  const SL = SK.list;
  const strengthCarry = () => Math.floor(lvl('strength') / SL.strength.carryEvery) * SL.strength.carryKg;
  const maxHp = () => C.hp.base + lvl('vitality') * SL.vitality.hpPerLv;
  const bagBonus = () => (P().bag ? ITEMS[P().bag].bag : 0);
  const carryLimit = () => C.baseCarry + bagBonus() + strengthCarry();
  function mapWeight(m) { let w = 0; for (const id in m) w += ITEMS[id].w * m[id]; return w; }
  const equippedWeight = () => SLOTS.reduce((s, k) => s + (P()[k] ? ITEMS[P()[k]].w : 0), 0);
  const carried = () => mapWeight(P().inv) + equippedWeight();
  function tierIndex() {
    const r = carried() / carryLimit();
    for (let i = 0; i < C.overweight.length; i++) if (r <= C.overweight[i].upTo + 1e-9) return i;
    return C.overweight.length - 1;
  }
  const tier = () => C.overweight[tierIndex()];
  const has = (k) => !!P().debuffs[k];
  function timeMult() {
    let m = tier().timeMult;
    if (P().stamina <= 0) m *= C.stamina.exhaustedTimeMult;
    if (P().fatigue >= C.fatigueSlowAt) m *= C.fatigueTimeMult;
    if (has('fracture')) m *= DB.fracture.timeMult;
    return m;
  }
  const travelMinutes = (dest) => Math.max(5, Math.round(distMin(G.loc, dest) * timeMult() * (1 - lvl('endurance') * SL.endurance.travelPerLv)));
  const searchMinutes = () => Math.max(5, Math.round(C.searchMinutes * timeMult() * (has('fear') ? DB.fear.searchMult : 1) * (1 - lvl('focus') * SL.focus.searchPerLv)));
  const placeName = (id) => (id === 'hideout' ? '거점' : LOC[id].name);
  const dangerOf = (id) => (id === 'hideout' ? 0 : LOC[id].danger);
  const armorDef = () => (P().armor ? ITEMS[P().armor].def : 0);
  const armorDbf = () => (P().armor ? ITEMS[P().armor].dbf : 0);
  const debuffChanceMult = () => 1 - lvl('resolve') * SL.resolve.chancePerLv;
  const debuffDurationMult = () => 1 - lvl('resolve') * SL.resolve.durationPerLv;
  const dodgeChance = () => CB.baseDodge + lvl('endurance') * SL.endurance.dodgePerLv;
  const rareMult = () => 1 + lvl('focus') * SL.focus.rarePerLv;
  // 근접 싸움: 맨손, 근접 무기, 탄약 없는 총(휘두르기)
  const isMelee = () => { const w = P().weapon; return !w || !ITEMS[w].ammo || !(P().inv[ITEMS[w].ammo] > 0); };
  const searchEncounterChance = (danger) => Math.min(0.95, CB.encounter[danger] * (isNight(G.time) ? CB.nightEncounterMult : 1));
  const hasItem = (id) => (P().inv[id] || 0) > 0 || SLOTS.some((s) => P()[s] === id);
  const isUsable = (it) => !!(it.use || it.treat);

  function addTo(m, id, n) {
    m[id] = (m[id] || 0) + n;
    if (m[id] <= 0) delete m[id];
  }
  function stashSlots(m = G.stash) { let s = 0; for (const id in m) s += Math.ceil(m[id] / ITEMS[id].stack); return s; }
  function stashFit(id, want) {
    const cur = G.stash[id] || 0, stack = ITEMS[id].stack;
    const free = Math.max(0, stashCap() - stashSlots());
    const room = Math.ceil(cur / stack) * stack - cur + free * stack;
    return clamp(want, 0, room);
  }
  function carryFit(id, want) {
    const cap = carryLimit() * C.pickupHardCap - carried();
    return clamp(Math.floor((cap + 1e-6) / ITEMS[id].w), 0, want);
  }
  function fxText(u) {
    const parts = [];
    if (u.hp) parts.push(`HP ${signed(u.hp)}`);
    if (u.stamina) parts.push(`스테미너 ${signed(u.stamina)}`);
    if (u.hunger) parts.push(`배고픔 ${signed(u.hunger)}`);
    if (u.thirst) parts.push(`갈증 ${signed(u.thirst)}`);
    if (u.fatigue) parts.push(`피로 ${signed(u.fatigue)}`);
    if (u.poison) parts.push(`식중독 위험 ${pct(u.poison)}%`);
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

  // ---------- 기록 ----------
  function log(text, k = 'info') {
    const e = { t: G.time, text, k };
    G.log.push(e);
    if (G.log.length > LOG_MAX) G.log.splice(0, G.log.length - LOG_MAX);
    G.recent.push(e);
  }
  function hurt(amount, cause) {
    const p = P();
    p.hp = clamp(p.hp - amount, 0, maxHp());
    if (p.hp <= 0 && !G.dead) { G.dead = true; G.deathCause = cause; }
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
    if (k === 'endurance') return `회피 ${(CB.baseDodge + lv * c.dodgePerLv).toFixed(1)}% · 이동시간 -${(lv * c.travelPerLv * 100).toFixed(1)}%`;
    if (k === 'vitality') return `최대 HP +${lv * c.hpPerLv}`;
    if (k === 'focus') return `수색시간 -${Math.round(lv * c.searchPerLv * 100)}% · 좋은 물건 +${Math.round(lv * c.rarePerLv * 100)}% · 추가 발견 ${(lv * c.extraFindPerLv * 100).toFixed(1)}%`;
    if (k === 'resolve') return `디버프 확률 -${(lv * c.chancePerLv * 100).toFixed(1)}% · 지속시간 -${Math.round(lv * c.durationPerLv * 100)}%`;
    return '';
  }
  const efficiency = (today) => (today < SK.dailySoft ? 1 : Math.max(SK.minEfficiency, SK.dailySoft / today));
  function gainXp(k, raw) {
    if (!G || !(raw > 0)) return;
    const day = dayOf(G.time);
    if (G.skillDay !== day) { G.skillDay = day; SKILL_KEYS.forEach((x) => { G.skills[x].today = 0; }); }
    const sk = G.skills[k];
    if (sk.lv >= SK.max) return;
    const gym = (k === 'strength' || k === 'endurance') && facCfg('gym') ? facCfg('gym').xpMult : 1;
    const got = raw * efficiency(sk.today) * gym;
    sk.today += raw;
    sk.xp += got;
    while (sk.lv < SK.max && sk.xp >= xpNeed(sk.lv)) {
      sk.xp -= xpNeed(sk.lv);
      sk.lv += 1;
      if (k === 'vitality') P().hp = clamp(P().hp + SL.vitality.hpPerLv, 0, maxHp());
      const milestone = k === 'strength' && sk.lv % SL.strength.carryEvery === 0 ? ` 중량 한계 +${SL.strength.carryKg}kg!` : '';
      log(`${SL[k].name} LV ${sk.lv}. (${skillEffect(k)})${milestone}`, 'level');
      G.skillNew = true;
      storyOnce('firstLevel', ST.moments.firstLevel);
    }
    if (sk.lv >= SK.max) sk.xp = 0;
  }

  // ---------- 디버프 ----------
  function applyDebuff(type) {
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
    if (p > 0 && chance(p * debuffChanceMult())) applyDebuff(type);
  }

  // ---------- 시간 흐름 ----------
  function passTime(minutes, activity) {
    const p = P(), N = C.needs;
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
      const rate = sleeping ? N.sleepNeedsRate : 1;
      p.hunger = clamp(p.hunger + N.hungerPerHour * rate * h, 0, 100);
      p.thirst = clamp(p.thirst + N.thirstPerHour * rate * (d.poison ? DB.poison.thirstMult : 1) * h, 0, 100);
      if (sleeping) p.fatigue = clamp(p.fatigue - N.sleepFatigueRecoverPerHour * (home ? bedFatigueMult() : 1) * h, 0, 100);
      else if (resting) p.fatigue = clamp(p.fatigue - N.restFatigueRecoverPerHour * h, 0, 100);
      else p.fatigue = clamp(p.fatigue + (exercising ? EX.fatiguePerHour : N.fatiguePerHour) * h, 0, 100);

      const needy = p.hunger >= N.penaltyAt || p.thirst >= N.penaltyAt;
      const recov = (needy ? 0.5 : 1) * (d.poison ? DB.poison.recoverMult : 1);
      if (exert) p.stamina = clamp(p.stamina - C.stamina.exertPerHour * tr.staminaMult * h, 0, C.stamina.max);
      else if (exercising) p.stamina = clamp(p.stamina - EX.staminaPerHour * h, 0, C.stamina.max);
      else if (resting) p.stamina = clamp(p.stamina + C.stamina.restPerHour * recov * h, 0, C.stamina.max);
      else if (sleeping) p.stamina = clamp(p.stamina + C.stamina.sleepPerHour * recov * h, 0, C.stamina.max);

      let loss = 0, cause = null;
      const add = (v, c) => { if (v > 0) { loss += v; cause = cause || c; } };
      if (exert && tr.hpPerHour) add(tr.hpPerHour * h, 'weight');
      if (d.bleed) {
        add(DB.bleed.hpPerHour * h, 'bleed');
        if (!d.infection) tryDebuff('infection', DB.bleed.infectPerHour * h);
        d.bleed.left -= dt;
        if (d.bleed.left <= 0) { delete d.bleed; ended.push('bleed'); }
      }
      if (d.infection) {
        const s = (d.infection.sev = Math.min(100, d.infection.sev + DB.infection.growPerHour * debuffDurationMult() * h));
        add((s / DB.infection.hpDiv + (s >= 100 ? DB.infection.extraAt100 : 0)) * h, 'infection');
      }
      if (p.thirst >= 100) add(N.dehydrateHpPerHour * h, 'thirst');
      if (p.hunger >= 100) add(N.starveHpPerHour * h, 'hunger');
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

      if (exert) xpCarry += SK.xp.carryPerHour * h * Math.min(1.5, carried() / carryLimit());
      if (activity === 'travel') xpWalk += SK.xp.travelPerHour * h;
      lost += Math.min(loss, p.hp);
      if (loss > 0) p.hp = clamp(p.hp - loss, 0, maxHp());
      else if (!needy && sleeping) p.hp = clamp(p.hp + (C.hp.sleepRegenPerHour + homeHpBonus(true)) * h, 0, maxHp());
      else if (!needy && resting) p.hp = clamp(p.hp + (C.hp.restRegenPerHour + homeHpBonus(false)) * h, 0, maxHp());

      hideoutTick(dt, hmsgs);
      G.time += dt;
      if (p.hp <= 0) {
        G.dead = true;
        G.deathCause = DEATH_TEXT[cause] || '쓰러졌다';
        break;
      }
    }
    checkRefill();
    if (G.dead) return;
    const today = dayOf(G.time);
    if (today > startDay) log(journal(today), 'story');
    for (const [t, k] of hmsgs) log(t, k);
    gainXp('strength', xpCarry);
    gainXp('endurance', xpWalk);
    gainXp('vitality', lost * SK.xp.hpLost);
    for (const k of ended) log(DB[k].ended, 'good');
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
    if (powered) {
      H.fuel = Math.max(0, H.fuel - dt / 60);
      if (H.fuel <= 0) msgs.push(['거점의 발전기가 연료가 떨어져 멈췄다.', 'warn']);
    }
    if (H.build) {
      H.build.left -= dt;
      if (H.build.left <= 0) {
        const { id, to } = H.build;
        H.fac[id] = to;
        H.build = null;
        msgs.push([`${FAC[id].name} ${to}레벨 공사가 끝났다. (${FAC[id].levels[to - 1].effect})`, 'good']);
      }
    }
    for (const fid of Object.keys(H.crafts)) {
      const c = H.crafts[fid], R = RECIPE[c.recipe];
      if (R.power && !powered) continue;
      c.left -= dt;
      if (c.left <= 0) {
        H.ready[fid] = H.ready[fid] || {};
        addTo(H.ready[fid], R.out[0], R.out[1]);
        delete H.crafts[fid];
        msgs.push([`${FAC[fid].name} 제작 완료: ${ITEMS[R.out[0]].name} ×${R.out[1]}. 거점에서 받을 수 있다.`, 'good']);
      }
    }
    const wc = facCfg('water');
    if (wc && powered) {
      if (H.water.stored < wc.max) {
        H.water.prog += dt;
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
  function craftBlock(rid) {
    const R = RECIPE[rid];
    if (G.loc !== 'hideout') return '거점에서만 할 수 있다';
    if (G.pending) return '눈앞의 상황부터 해결해야 한다';
    if (facLv(R.at) < R.lv) return `${FAC[R.at].name} LV ${R.lv} 필요`;
    if (G.hideout.crafts[R.at]) return '이미 만드는 중이다';
    if (R.power && !isPowered()) return '전력이 필요하다';
    if (!haveAll(R.in)) return '재료가 부족하다';
    return '';
  }
  // 창고에 있는 것부터 쓰고, 모자라면 소지품에서 쓴다 (장착한 장비는 쓰지 않는다)
  function consumeItems(list) {
    for (const [id, n] of list) {
      const fromStash = Math.min(n, G.stash[id] || 0);
      addTo(G.stash, id, -fromStash);
      if (n - fromStash > 0) addTo(P().inv, id, -(n - fromStash));
    }
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
  function craft(rid) {
    const why = craftBlock(rid);
    if (why) return toast(why);
    run(() => {
      const R = RECIPE[rid];
      consumeItems(R.in);
      G.hideout.crafts[R.at] = { recipe: rid, left: R.time };
      log(`${FAC[R.at].name}에서 ${ITEMS[R.out[0]].name} ×${R.out[1]} 만들기를 시작했다. (${fmtDur(R.time)})`);
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
    fn();
    if (G.dead) {
      G.pending = null;
      log(`${G.deathCause}.`, 'bad');
      persist(); // 쓰러진 상태로 저장해서 새로고침으로 죽음을 피할 수 없게 한다
      render();
      showDeathChoice();
      return;
    }
    if (G.loc !== 'hideout' && isNight(G.time)) storyOnce('firstNight', ST.moments.firstNight);
    persist();
    render();
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
    if (chance(L.emptyChance)) return {};
    const extra = chance(lvl('focus') * SL.focus.extraFindPerLv) ? 1 : 0;
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
      if (st.spots <= 0) log('이곳은 이미 다 뒤졌다.', 'warn');
    }
    ui.tab = 'scene';
    ui.sel = null;
  }
  function finishCtx(ctx) {
    if (ctx.type === 'travel') arrive(ctx);
  }

  function travel(dest) {
    if (!G || dest === G.loc || (dest !== 'hideout' && !LOC[dest])) return;
    run(() => {
      const mins = travelMinutes(dest);
      const danger = Math.max(dangerOf(G.loc), dangerOf(dest));
      const ctx = { type: 'travel', dest, danger, t0: G.time };
      if (tierIndex() > 0) storyOnce('firstOverweight', ST.moments.firstOverweight);
      if (tier().hpPerHour) log('짐이 너무 무겁다. 한 걸음 한 걸음이 고통스럽다. (HP 감소)', 'warn');
      passTime(mins, 'travel');
      if (G.dead) return;
      const hours = mins / 60;
      let pEnc = 1 - Math.pow(1 - CB.travelPerHour[danger], hours);
      if (isNight(G.time)) pEnc *= CB.nightEncounterMult;
      if (chance(pEnc)) { startCombat(pickEnemy(danger), ctx); return; }
      const ec = C.eventChance;
      if (chance(clamp(ec.travelPerHour * hours, ec.travelMin, ec.travelMax))) {
        const ev = rollEvent('travel', danger);
        if (ev) { startEvent(ev, ctx); if (G.pending || G.dead) return; }
      }
      arrive(ctx);
    }, { top: true });
  }

  function completeSearch() {
    const L = LOC[G.loc], st = G.locs[G.loc];
    st.spots = Math.max(0, st.spots - 1);
    G.stats.searches += 1;
    const found = searchLoot(L);
    if (!Object.keys(found).length) log(pick(D.emptyLines));
    else stow(found, { type: 'search' });
    gainXp('focus', SK.xp.search + Object.keys(found).filter((id) => ITEMS[id].r >= 2).length * SK.xp.rareFind);
    if (isNight(G.time)) gainXp('resolve', SK.xp.nightSearch);
    const frag = ST.fragments.find((f) => f.loc === G.loc);
    if (frag && !G.fragments.includes(frag.id) && chance(ST.fragmentChance)) {
      G.fragments.push(frag.id);
      log(`[기록 ${G.fragments.length}/${ST.fragments.length}] ${frag.title}. ${frag.text}`, 'story');
      if (G.fragments.length === ST.fragments.length) log(ST.allFragments, 'story');
    }
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
      if (chance(searchEncounterChance(L.danger))) { startCombat(pickEnemy(L.danger), { ...ctx, completeOnWin: true }); return; }
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
      if (chance(searchEncounterChance(L.danger) * CB.restMult)) { startCombat(pickEnemy(L.danger), ctx); return; }
      maybeEvent('rest', ctx, C.eventChance.rest);
    });
  }

  function sleep() {
    if (!G || G.loc !== 'hideout') return;
    run(() => {
      log('담요를 덮고 눈을 감았다.');
      passTime(C.sleepMinutes, 'sleep');
      if (G.dead) return;
      log(`${clockStr(G.time)}, 눈을 떴다.`, 'good');
      if (facCfg('bed') && facCfg('bed').calm && P().debuffs.fear) { delete P().debuffs.fear; log('푹 자고 나니 떨림이 가라앉았다.', 'good'); }
      maybeEvent('sleep', { type: 'sleep', danger: 0 }, C.eventChance.sleep);
    });
  }

  // ---------- 전투 ----------
  function pickEnemy(danger) {
    const e = weightedPick(Object.keys(ENEMIES).map((id) => ({ id, w: ENEMIES[id].weight[danger] || 0 })));
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
    if (canFlee && tierIndex() === 2) { canFlee = false; note = '짐이 너무 무거워 도망칠 수 없다. 싸워야 한다.'; }
    const text = opts.intro || fill(pick(E.intro), ctxPlace(ctx));
    log(text, 'event');
    G.pending = { kind: 'combat', enemy: enemyId, canFlee, note, text, ctx, penalty: 0, winLoot: opts.winLoot || 0 };
    gainXp('resolve', SK.xp.encounter + Math.round((E.fear || 0) * 10));
  }

  function weaponBonus() {
    const w = P().weapon;
    if (!w) return { label: '맨손', value: 0 };
    const it = ITEMS[w];
    if (it.ammo && !(P().inv[it.ammo] > 0)) return { label: `${it.name} (탄약 없음)`, value: it.noAmmoAtk || 0 };
    return { label: it.name, value: it.atk };
  }
  function combatDanger(pd) { return pd.ctx && pd.ctx.danger != null ? pd.ctx.danger : dangerOf(G.loc); }
  function winOdds(pd) {
    const E = ENEMIES[pd.enemy], p = P(), M = CB.mods, d = p.debuffs;
    const danger = combatDanger(pd);
    const rows = [[`위험도 기본 (${D.dangers[danger].name})`, CB.base[danger]]];
    if (E.mod) rows.push([E.name, E.mod]);
    const wb = weaponBonus();
    rows.push([wb.label, wb.value]);
    if (isMelee() && lvl('strength') > 0) rows.push([`힘 LV ${lvl('strength')}`, lvl('strength') * SL.strength.meleePerLv]);
    if (isNight(G.time)) rows.push(['밤', CB.nightWin]);
    const hpPct = p.hp / maxHp();
    if (hpPct < 0.5) rows.push(['부상', -Math.round((0.5 - hpPct) * 100 * M.hpLowPer)]);
    if (p.stamina <= 0) rows.push(['탈진', M.exhausted]);
    else if (p.stamina < 25) rows.push(['지침', M.tired]);
    if (p.fatigue >= C.fatigueSlowAt) rows.push(['피로', M.fatigue]);
    const ti = tierIndex();
    if (ti === 1) rows.push(['경과적', M.light]);
    if (ti === 2) rows.push(['중과적', M.heavy]);
    if (d.fracture) rows.push(['골절', DB.fracture.win]);
    if (d.fear) rows.push(['공포', DB.fear.win]);
    if (d.infection && d.infection.sev >= DB.infection.winAt) rows.push(['감염', DB.infection.win]);
    if (d.poison) rows.push(['식중독', DB.poison.win]);
    if (pd.penalty) rows.push(['도망 실패', pd.penalty]);
    const sum = rows.reduce((s, r) => s + r[1], 0);
    return { total: clamp(Math.round(sum), CB.minWin, CB.maxWin), rows };
  }
  function fleeOdds(pd) {
    const E = ENEMIES[pd.enemy], p = P(), F = CB.fleeMods;
    let v = CB.fleeBase + (E.fleeMod || 0) + (p.stamina - 50) * F.staminaPer;
    if (tierIndex() === 1) v += F.light;
    if (has('fracture')) v += DB.fracture.flee;
    if (isNight(G.time)) v += F.night;
    return clamp(Math.round(v), CB.minWin, 90);
  }
  function sneakOdds(base) {
    const S = CB.sneakMods;
    let v = base;
    const ti = tierIndex();
    if (ti === 1) v += S.light;
    if (ti === 2) v += S.heavy;
    if (has('fracture')) v += S.fracture;
    if (isNight(G.time)) v += S.night;
    return clamp(Math.round(v), CB.minWin, CB.maxWin);
  }

  function fight() {
    const pd = G && G.pending;
    if (!pd || pd.kind !== 'combat') return;
    run(() => {
      const E = ENEMIES[pd.enemy], p = P(), ctx = pd.ctx;
      const odds = winOdds(pd).total; // 버튼에 보인 확률 그대로 쓴다
      const melee = isMelee();
      G.pending = null;
      const w = p.weapon ? ITEMS[p.weapon] : null;
      let ammoNote = '';
      if (w && w.ammo && p.inv[w.ammo] > 0) {
        const n = Math.min(p.inv[w.ammo], randInt(w.ammoUse[0], w.ammoUse[1]));
        addTo(p.inv, w.ammo, -n);
        ammoNote = ` (${ITEMS[w.ammo].name} ${n}발 사용)`;
      }
      p.stamina = clamp(p.stamina - CB.fightStamina, 0, C.stamina.max);
      passTime(CB.fightMinutes, 'fight');
      if (G.dead) return;
      const def = armorDef(), dbf = armorDbf();
      const cause = `${E.name}에게 당해 쓰러졌다`;
      gainXp('endurance', SK.xp.fight);
      const won = Math.random() * 100 < odds;
      if (melee) gainXp('strength', won ? SK.xp.meleeWin : SK.xp.meleeLose);
      if (won) {
        log(pick(E.win) + ammoNote, 'good');
        G.stats.kills += 1;
        storyOnce('firstKill', ST.moments.firstKill);
        if (chance(E.hurtOnWin)) {
          const dmg = Math.max(1, Math.round(randInt(E.winDmg[0], E.winDmg[1]) * (1 - def)));
          log(`싸우다 가벼운 상처를 입었다. (HP -${dmg})`, 'warn');
          hurt(dmg, cause);
          tryDebuff('bleed', 0.25 * (1 - dbf));
          if (E.debuffs.some(([t]) => t === 'infection')) tryDebuff('infection', 0.08 * (1 - dbf));
        }
        tryDebuff('fear', E.fear);
        if (G.dead) return;
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
          for (const [t, c] of E.debuffs) tryDebuff(t, c * (1 - dbf));
          if (E.steal && !G.dead) stealFrom();
        }
        tryDebuff('fear', Math.min(1, E.fear * 1.5));
        if (G.dead) return;
      }
      finishCtx(ctx);
    }, { allowPending: true, keepRecent: true, top: pd.ctx.type === 'travel' });
  }

  function stealFrom() {
    const ids = Object.keys(P().inv);
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

  function flee() {
    const pd = G && G.pending;
    if (!pd || pd.kind !== 'combat' || !pd.canFlee) return;
    run(() => {
      const odds = fleeOdds(pd);
      const p = P();
      G.pending = null;
      p.stamina = clamp(p.stamina - CB.fleeStamina, 0, C.stamina.max);
      passTime(CB.fleeMinutes, 'travel');
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
      .filter((e) => e.on.includes(on) && danger >= (e.minDanger || 0) && (e.night === undefined || e.night === night) && (!e.outside || outside))
      .filter((e) => !(e.blockedBy && facLv(e.blockedBy.fac) >= e.blockedBy.lv))
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
  function pickOffer() {
    const all = D.trades.map((t, i) => i);
    const ok = all.filter((i) => canAfford(D.trades[i].give));
    return ok.length && chance(0.7) ? pick(ok) : pick(all);
  }
  function startEvent(ev, ctx) {
    const text = fill(pick(ev.text), ctxPlace(ctx));
    log(text, 'event');
    if (ev.trade) { G.pending = { kind: 'event', id: ev.id, text, ctx, offer: pickOffer() }; return; }
    if (ev.choices) { G.pending = { kind: 'event', id: ev.id, text, ctx }; return; }
    applyOutcome(ev.outcome || {}, ctx, ev);
  }
  const choiceOk = (ch) => !ch.requires || ch.requires.every(hasItem);

  function chooseEvent(i) {
    const pd = G && G.pending;
    if (!pd || pd.kind !== 'event') return;
    const ev = EVENTS[pd.id];
    const idx = +i;
    if (ev.trade) {
      if (idx === 0 && !canAfford(D.trades[pd.offer].give)) return toast('바꿀 물건이 부족하다.');
    } else if (!ev.choices[idx] || !choiceOk(ev.choices[idx])) {
      return toast('필요한 물건이 없다.');
    }
    run(() => {
      G.pending = null;
      const ctx = pd.ctx;
      if (ev.trade) {
        const offer = D.trades[pd.offer];
        if (idx === 0) {
          for (const [id, n] of offer.give) addTo(P().inv, id, -n);
          log(`${itemsText(offer.give)}개를 건넸다.`);
          stow(Object.fromEntries(offer.get), ctx);
          log('"거래 고마워. 몸조심해." 생존자는 수레를 끌고 멀어졌다.');
        } else {
          log('고개를 젓자 생존자는 어깨를 으쓱하고 멀어졌다.');
        }
      } else {
        applyOutcome(ev.choices[idx].outcome, ctx, ev);
      }
      if (!G.pending && !G.dead) finishCtx(ctx);
    }, { allowPending: true, keepRecent: true, top: pd.ctx.type === 'travel' });
  }

  function applyOutcome(o, ctx, ev) {
    if (!o) return;
    const p = P();
    if (o.consume) for (const [id, n] of o.consume) addTo(p.inv, id, -n);
    if (o.time) {
      passTime(o.time, ctx.type === 'travel' ? 'travel' : 'search');
      if (G.dead) return;
    }
    if (o.roll) {
      const r = Math.random();
      let acc = 0;
      for (const sub of o.roll) { acc += sub.p; if (r < acc) return applyOutcome(sub, ctx, ev); }
      return applyOutcome(o.roll[o.roll.length - 1], ctx, ev);
    }
    if (o.sneak != null) return applyOutcome(Math.random() * 100 < sneakOdds(o.sneak) ? o.success : o.fail, ctx, ev);
    if (o.combat) {
      const id = o.combat === 'random' ? pickEnemy(ctx.danger || 0) : o.combat;
      startCombat(id, ctx, { intro: o.log, canFlee: o.canFlee, winLoot: o.winLoot });
      return;
    }
    if (o.log) log(o.log);
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
    if (o.stamina) { p.stamina = clamp(p.stamina + o.stamina, 0, C.stamina.max); parts.push(`스테미너 ${signed(o.stamina)}`); if (o.stamina < 0) bad = true; }
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
      const found = rollFinds(lootPool(ctx), ctx.danger || 0, o.loot);
      if (Object.keys(found).length) stow(found, ctx);
      else log(pick(D.emptyLines));
    }
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
  function useItem(id, from) {
    const it = ITEMS[id];
    if (!G || !it || !isUsable(it)) return;
    const src = from === 'stash' && G.loc === 'hideout' ? G.stash : P().inv;
    if (!src[id]) return;
    const tr = it.treat || {};
    const relevant = Object.keys(tr).some((k) => has(k));
    if (!it.use && !relevant) { toast('지금은 쓸 필요가 없다.'); return; }
    run(() => {
      addTo(src, id, -1);
      const p = P(), u = it.use || {};
      if (u.hunger) p.hunger = clamp(p.hunger + u.hunger, 0, 100);
      if (u.thirst) p.thirst = clamp(p.thirst + u.thirst, 0, 100);
      if (u.fatigue) p.fatigue = clamp(p.fatigue + u.fatigue, 0, 100);
      if (u.stamina) p.stamina = clamp(p.stamina + u.stamina, 0, C.stamina.max);
      if (u.hp) p.hp = clamp(p.hp + u.hp, 0, maxHp());
      const shown = { ...u };
      delete shown.poison;
      const fx = fxText(shown);
      log(`${eul(it.name)} ${USE_VERB[it.cat]}.${fx ? ` (${fx})` : ''}`);
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
      if (u.poison) tryDebuff('poison', u.poison);
      passTime(it.useMinutes || 5, 'idle');
    });
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
  function drop(id, n) {
    if (!G || G.loc === 'hideout') return;
    mutate(() => {
      const have = P().inv[id] || 0;
      const k = n === 'all' ? have : Math.min(1, have);
      if (!k) return;
      addTo(P().inv, id, -k);
      addTo(G.locs[G.loc].ground, id, k);
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
      let left = false;
      for (const id of Object.keys(P().inv)) {
        const k = stashFit(id, P().inv[id]);
        if (k > 0) { addTo(P().inv, id, -k); addTo(G.stash, id, k); }
        if (P().inv[id]) left = true;
      }
      if (left) toast('창고가 가득 차서 일부는 그대로 들고 있다.');
    });
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
  function equip(id, from) {
    const it = ITEMS[id];
    if (!G || !it || !SLOTS.includes(it.cat)) return;
    const src = from === 'stash' && G.loc === 'hideout' ? G.stash : P().inv;
    if (!src[id]) return;
    mutate(() => {
      const slot = it.cat;
      addTo(src, id, -1);
      const old = P()[slot];
      P()[slot] = id;
      if (old) addTo(src, old, 1);
      const verb = { weapon: '들었다', armor: '입었다', bag: '멨다' }[slot];
      toast(slot === 'bag' ? `${eul(it.name)} ${verb}. 중량 한계 ${fmtKg(carryLimit())}kg` : `${eul(it.name)} ${verb}.`);
    });
  }
  function unequip(slot) {
    if (!G || !SLOTS.includes(slot) || !P()[slot]) return;
    mutate(() => {
      const id = P()[slot];
      P()[slot] = null;
      if (G.loc === 'hideout' && stashFit(id, 1) === 1) addTo(G.stash, id, 1);
      else addTo(P().inv, id, 1);
    });
  }

  // ---------- 죽음: 쓰러진 뒤에 고른다 ----------
  const carriedCount = () => Object.values(P().inv).reduce((a, b) => a + b, 0) + SLOTS.filter((s) => P()[s]).length;

  function showDeathChoice() {
    if (!G || !G.dead) return;
    const lost = carriedCount();
    showModal({
      title: '쓰러졌다',
      body: [
        `${dayOf(G.time)}일차 ${clockStr(G.time)}, ${G.deathCause}.`,
        '눈앞이 캄캄해진다. 이대로 끝일까, 아니면…',
        ['악몽에서 깨어나기', lost ? `지니고 있던 물건 ${lost}개를 모두 잃고 다음 날 아침 거점에서 깨어난다. 거점과 창고는 남는다.` : '다음 날 아침 거점에서 깨어난다. 거점과 창고는 남는다.'],
        ['운명을 받아들이기', '생존 기록을 여기서 끝낸다. 세이브가 삭제된다.'],
      ],
      buttons: [
        { label: '운명을 받아들이기', onClick: confirmFate },
        { label: '악몽에서 깨어나기', primary: true, onClick: wakeFromNightmare },
      ],
    });
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
    const day = dayOf(G.time), cause = G.deathCause, s = G.stats;
    Store.clearAll();
    G = null;
    ui.screen = 'title';
    ui.titleView = 'main';
    render();
    window.scrollTo(0, 0);
    showModal({
      title: '생존 기록 끝',
      body: [`${day}일차, ${cause}.`, `수색 ${s.searches}회 · 쓰러뜨린 적 ${s.kills} · 악몽에서 깨어난 횟수 ${s.deaths}회`, '세이브는 삭제되었다.'],
      buttons: [{ label: '확인', primary: true }],
    });
  }
  function wakeFromNightmare() {
    if (!G || !G.dead) return;
    const day = dayOf(G.time);
    const p = P();
    p.inv = {};
    for (const s of SLOTS) p[s] = null;
    p.debuffs = {};
    G.stats.deaths += 1;
    const r = C.respawn;
    G.time = day * 1440 + r.hour * 60;
    Object.assign(p, { hp: r.hp, stamina: r.stamina, hunger: r.hunger, thirst: r.thirst, fatigue: r.fatigue });
    G.loc = 'hideout';
    G.pending = null;
    G.dead = false;
    G.deathCause = null;
    ui.sel = null;
    checkRefill();
    log(`${dayOf(G.time)}일차 아침, 거점에서 식은땀을 흘리며 눈을 떴다. 악몽이었을까. 몸에 지니고 있던 것은 모두 사라졌다.`, 'warn');
    storyOnce('firstWake', ST.moments.firstWake);
    ui.tab = 'scene';
    persist();
    render();
    window.scrollTo(0, 0);
  }

  // ---------- 저장 ----------
  const Store = {
    ref: null, checked: false, remoteSave: null, pending: null, writing: false, timer: 0, retried: false, status: '',
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
      if (!this.ref) return;
      this.pending = save;
      clearTimeout(this.timer);
      this.timer = setTimeout(() => this.flush(), 1500);
    },
    flushNow() { clearTimeout(this.timer); this.flush(); },
    async flush() {
      if (!this.ref || !this.pending || this.writing) return;
      const save = this.pending;
      this.pending = null;
      this.writing = true;
      try {
        await this.ref.set({ v: save.v, savedAt: save.savedAt, json: JSON.stringify(save.state) });
        this.remoteSave = save;
        this.status = 'ok';
        this.retried = false;
      } catch (e) {
        this.status = 'error';
        const code = e && e.code;
        if (code === 'unavailable' && !this.retried) {
          this.retried = true;
          if (!this.pending) this.pending = save;
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
      this.clearLocal();
      this.pending = null;
      clearTimeout(this.timer);
      this.remoteSave = null;
      if (this.ref) this.ref.delete().catch(() => {});
    },
  };

  function makeSave() { return { v: SAVE_VERSION, savedAt: Date.now(), state: G }; }
  function persist() {
    if (!G) return;
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
  const dangerChip = (d) => `<span class="chip d${d}">${esc(D.dangers[d].name)}</span>`;

  function itemMeta(id, qty) {
    const it = ITEMS[id];
    let meta = `${fmtKg(it.w)}kg`;
    if (qty > 1) meta += ` (총 ${fmtKg(it.w * qty)}kg)`;
    meta += ` · ${D.rarities[it.r]}`;
    if (it.cat === 'weapon') meta += ` · 승률 +${it.atk}%${it.ammo ? ` · ${ITEMS[it.ammo].name} 필요` : ''}`;
    else if (it.cat === 'armor') meta += ` · 받는 피해 -${pct(it.def)}% · 디버프 확률 -${pct(it.dbf)}%`;
    else if (it.cat === 'ammo') meta += ` · ${it.desc}`;
    else if (it.bag) meta += ` · 중량 한계 +${it.bag}kg`;
    else if (isUsable(it)) meta += ' · ' + [it.use && fxText(it.use), it.treat && treatText(it.treat)].filter(Boolean).join(' · ');
    else if (it.cat === 'material') meta += ' · 시설 재료';
    return meta;
  }
  function itemRow(id, qty, buttons, metaOverride) {
    const it = ITEMS[id];
    return `<li class="item" title="${esc(it.desc || '')}">
      <div class="item-main">
        <div class="item-name"><span class="rdot r${it.r}"></span><span class="rname r${it.r}">${esc(it.name)}</span><span class="qty">×${qty}</span></div>
        <div class="item-meta">${esc(metaOverride || itemMeta(id, qty))}</div>
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
    $('#hud').innerHTML = `
      <div class="hud-top">
        <div class="clock"><span class="day">DAY ${dayOf(G.time)}</span><span class="time">${clockStr(G.time)}</span><span class="chip ${night ? 'night-chip' : 'day-chip'}">${night ? '밤' : '낮'}</span></div>
        <div class="where">${where}</div>
      </div>
      <div class="gauges">
        ${gauge('HP', p.hp, maxHp(), 'var(--hp)', hpState[0], hpState[1])}
        ${gauge('스테미너', p.stamina, C.stamina.max, 'var(--stam)', stState[0], stState[1])}
        ${needGauge('hunger', '배고픔', p.hunger, 'var(--hunger)')}
        ${needGauge('thirst', '갈증', p.thirst, 'var(--thirst)')}
        ${needGauge('fatigue', '피로', p.fatigue, 'var(--fatigue)')}
      </div>
      ${debuffs.length ? `<div class="debuffs" aria-label="디버프">${debuffs.map((k) => `<span class="chip bad">${esc(debuffShort(k))}</span>`).join('')}</div>` : ''}
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
      </div>`;
  }

  const TABS = [['scene', '현장'], ['inv', '소지품'], ['map', '지도'], ['fac', '시설'], ['skills', '스킬'], ['menu', '메뉴']];
  function renderTabs() {
    $('#tabs').innerHTML = TABS.map(([id, name]) => {
      let label = esc(name);
      if (id === 'scene' && G.pending) label += '<span class="badge">●</span>';
      if (id === 'skills' && G.skillNew) label += '<span class="badge">▲</span>';
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
    if (tr.hpPerHour) t += `, 이동·수색 중 시간당 HP -${tr.hpPerHour}, 도망 불가`;
    return `<p class="note ${ti === 1 ? 'warn-text' : 'bad-text'}">${esc(t)}</p>`;
  }
  function logSection() {
    const entries = G.log.slice(-40).reverse();
    return `<section class="section">
      <div class="section-head"><h2>생존 일지</h2><span class="meta">최근 ${entries.length}개</span></div>
      <ul class="log">${entries.map((e) => `<li><span class="log-time">${dayOf(e.t)}일 ${clockStr(e.t)}</span><span class="log-text ${e.k}">${esc(e.text)}</span></li>`).join('')}</ul>
    </section>`;
  }
  function quickUseSection(title, includeStash) {
    const ids = new Set(Object.keys(P().inv).filter((id) => ITEMS[id].use));
    if (includeStash) Object.keys(G.stash).filter((id) => ITEMS[id].use).forEach((id) => ids.add(id));
    const list = sortedIds(Object.fromEntries([...ids].map((id) => [id, 1])));
    if (!list.length) {
      return `<section class="section"><div class="section-head"><h2>${esc(title)}</h2></div><p class="empty">먹고 마실 것이 없다.</p></section>`;
    }
    const rows = list.map((id) => {
      const inS = includeStash ? G.stash[id] || 0 : 0, inI = P().inv[id] || 0;
      const from = inS > 0 ? 'stash' : 'inv';
      const fx = fxText(ITEMS[id].use);
      const where = includeStash ? `창고 ${inS} · 소지품 ${inI} · ${fx}` : fx;
      return itemRow(id, inS + inI, btn(USE_LABEL[ITEMS[id].cat], 'use', id, from), where);
    }).join('');
    return `<section class="section"><div class="section-head"><h2>${esc(title)}</h2>${includeStash ? '<span class="meta">창고에 있는 것부터 쓴다</span>' : ''}</div><ul class="items">${rows}</ul></section>`;
  }

  // 디버프 목록과 바로 치료하기
  function cureFor(k) {
    for (const [where, map] of [['inv', P().inv], ['stash', G.loc === 'hideout' ? G.stash : {}]]) {
      const id = Object.keys(map).find((x) => ITEMS[x].treat && ITEMS[x].treat[k]);
      if (id) return { id, where };
    }
    return null;
  }
  function debuffEffect(k) {
    const d = P().debuffs[k], c = DB[k];
    if (k === 'bleed') return `시간당 HP -${c.hpPerHour} · 방치하면 감염 위험 · ${fmtLeft(d.left)} 뒤 멎음`;
    if (k === 'infection') {
      const hpH = d.sev / c.hpDiv + (d.sev >= 100 ? c.extraAt100 : 0);
      return `시간당 HP -${hpH.toFixed(1)} · 점점 퍼진다${d.sev >= c.winAt ? ` · 승률 ${c.win}%` : ''}`;
    }
    if (k === 'fracture') return `행동시간 ×${c.timeMult} · 승률 ${c.win}% · 도망 ${c.flee}% · ${fmtLeft(d.left)} 뒤 회복`;
    if (k === 'fear') return `승률 ${c.win}% · 수색시간 ×${c.searchMult} · ${fmtLeft(d.left)} 남음 (쉬거나 자면 빨리 사라짐)`;
    if (k === 'poison') return `시간당 HP -${c.hpPerHour} · 갈증 ×${c.thirstMult} · 회복 절반 · ${fmtLeft(d.left)} 남음`;
    return '';
  }
  function statusSection() {
    const keys = DEBUFF_KEYS.filter((k) => P().debuffs[k]);
    if (!keys.length) return '';
    const rows = keys.map((k) => {
      const cure = cureFor(k);
      const cureNames = Object.keys(ITEMS).filter((id) => ITEMS[id].treat && ITEMS[id].treat[k]).map((id) => ITEMS[id].name).join(', ');
      const b = cure && !G.pending ? btn(`${ITEMS[cure.id].name} 쓰기`, 'use', cure.id, cure.where, 'primary') : `<span class="note">치료: ${esc(cureNames)}${cure ? '' : ' (없음)'}</span>`;
      return `<li class="item"><div class="item-main"><div class="item-name"><span class="rdot bad-dot"></span><span class="bad-text">${esc(debuffShort(k))}</span></div><div class="item-meta">${esc(debuffEffect(k))}</div></div><div class="item-btns">${b}</div></li>`;
    }).join('');
    return `<section class="section"><div class="section-head"><h2>몸 상태</h2></div><ul class="items">${rows}</ul></section>`;
  }

  function scrollToEncounter() {
    const el = document.getElementById('encounter');
    const hud = document.getElementById('hud');
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY - (hud ? hud.offsetHeight : 0) - 12;
    window.scrollTo(0, Math.max(0, top));
  }
  function weaponLabel() {
    const wb = weaponBonus();
    const w = P().weapon ? ITEMS[P().weapon] : null;
    let t = `${wb.label} (${signed(wb.value)}%)`;
    if (w && w.ammo) t += ` · ${ITEMS[w.ammo].name} ${P().inv[w.ammo] || 0}발`;
    return t;
  }
  function encounterCard() {
    const pd = G.pending;
    if (pd.kind === 'combat') {
      const E = ENEMIES[pd.enemy];
      const odds = winOdds(pd);
      const fl = pd.canFlee ? fleeOdds(pd) : null;
      const tone = odds.total >= 70 ? 'ok' : odds.total >= 40 ? 'warn' : 'bad';
      const armor = P().armor ? `${ITEMS[P().armor].name} (피해 -${pct(armorDef())}%)` : '없음';
      return `<section class="encounter" id="encounter">
        <div class="enc-head"><span class="enc-kicker">조우</span>${dangerChip(combatDanger(pd))}</div>
        <h2 class="enc-title">${esc(E.name)}</h2>
        <p class="enc-text">${esc(pd.text)}</p>
        ${pd.note ? `<p class="enc-note">${esc(pd.note)}</p>` : ''}
        <div class="odds ${tone}"><span class="odds-label">이길 확률</span><span class="odds-num">${odds.total}%</span></div>
        <details class="odds-detail"><summary>확률 계산 보기</summary>
          <dl class="kv">${odds.rows.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${signed(v)}%</dd>`).join('')}<dt>최종</dt><dd>${odds.total}% (${CB.minWin}~${CB.maxWin}% 사이)</dd></dl>
        </details>
        <p class="note">무기 ${esc(weaponLabel())} · 방어구 ${esc(armor)}</p>
        <div class="actions">
          ${actBtn('싸운다', `이길 확률 ${odds.total}%`, 'fight', '', 'primary')}
          ${pd.canFlee ? actBtn('도망친다', `성공 확률 ${fl}%`, 'flee') : ''}
        </div>
      </section>`;
    }
    const ev = EVENTS[pd.id];
    let buttons;
    if (ev.trade) {
      const offer = D.trades[pd.offer];
      const ok = canAfford(offer.give);
      buttons = actBtn('거래한다', `${itemsText(offer.give)}개 주고 ${itemsText(offer.get)}개 받기${ok ? '' : ' · 가진 게 부족하다'}`, 'choose', '0', ok ? 'primary' : '', !ok)
        + actBtn('거절한다', '그냥 지나간다', 'choose', '1', ok ? '' : 'primary');
    } else {
      const firstOk = ev.choices.findIndex(choiceOk);
      buttons = ev.choices.map((ch, i) => {
        const ok = choiceOk(ch);
        let sub = ch.sub || '';
        if (ch.outcome && ch.outcome.sneak != null) sub = sub.replace('{sneak}', sneakOdds(ch.outcome.sneak));
        return actBtn(ch.label, ok ? sub : `${sub} · 가진 게 없다`, 'choose', String(i), i === firstOk ? 'primary' : '', !ok);
      }).join('');
    }
    return `<section class="encounter event" id="encounter">
      <div class="enc-head"><span class="enc-kicker">사건</span></div>
      <h2 class="enc-title">${esc(ev.title)}</h2>
      <p class="enc-text">${esc(pd.text)}</p>
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
      <div class="place-head"><h1 class="place-name">${esc(L.name)}</h1>${dangerChip(L.danger)}</div>
      <p class="place-desc">${esc(L.desc)}</p>
      <div class="place-facts"><span>수색 구역 <b>${st.spots}/${L.spots}</b></span><span>수색 중 조우 <b>${pct(searchEncounterChance(L.danger))}%</b></span><span>거점까지 <b>${fmtDur(travelMinutes('hideout'))}</b></span>${fragmentHint(G.loc)}</div>
    </section>`;
  }

  function fragmentHint(loc) {
    const f = ST.fragments.find((x) => x.loc === loc);
    if (!f) return '';
    return G.fragments.includes(f.id) ? '<span>남겨진 기록 <b>찾음</b></span>' : '<span>누군가의 기록이 <b>남아 있는 것 같다</b></span>';
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
      const h = countHave(id);
      return `<span class="cost ${h >= n ? 'ok' : 'lack'}">${esc(ITEMS[id].name)} ${h}/${n}</span>`;
    }).join('');
  }
  function reqChips(req) {
    return Object.entries(req || {}).map(([f, lv]) => `<span class="cost ${facLv(f) >= lv ? 'ok' : 'lack'}">${esc(FAC[f].name)} LV ${lv}</span>`).join('');
  }
  function powerBox() {
    const H = G.hideout, gc = facCfg('generator');
    if (!gc) return '';
    const state = isPowered() ? ['켜짐', 'ok'] : H.fuel > 0 ? ['꺼짐', 'warn'] : ['연료 없음', 'bad'];
    const home = G.loc === 'hideout';
    return `<div class="fac-box">
      <div class="fac-box-head"><span class="chip ${state[1]}">${state[0]}</span><span class="num">연료 ${Math.floor(H.fuel)} / ${gc.tank}시간</span></div>
      <div class="w-track"><div class="w-fill" style="width:${clamp((H.fuel / gc.tank) * 100, 0, 100).toFixed(1)}%;background:var(--accent)"></div></div>
      <div class="row-btns">
        ${btn(`연료 넣기 (연료통 ${countHave('fuel')}개)`, 'addFuel', '', '', 'primary', !home || countHave('fuel') < 1 || H.fuel >= gc.tank - 0.01)}
        ${btn(H.genOn ? '끄기' : '켜기', 'toggleGen', '', '', '', !home)}
      </div>
      <p class="note">연료통 1개로 ${gc.fuelHours}시간 돌아간다. 켜 두면 쓸 데가 없어도 연료가 닳는다.</p>
    </div>`;
  }
  function recipeRow(R) {
    const out = ITEMS[R.out[0]];
    const locked = facLv(R.at) < R.lv;
    const why = craftBlock(R.id);
    return `<li class="item recipe${locked ? ' locked' : ''}">
      <div class="item-main">
        <div class="item-name"><span class="rdot r${out.r}"></span><span class="rname r${out.r}">${esc(out.name)}</span><span class="qty">×${R.out[1]}</span>${R.power ? '<span class="chip warn">전력</span>' : ''}</div>
        <div class="costs">${locked ? `<span class="note">LV ${R.lv}에서 열린다</span>` : costChips(R.in)}</div>
      </div>
      <div class="item-btns">${locked ? '' : btn(`만들기 · ${fmtDur(R.time)}`, 'craft', R.id, '', why ? '' : 'primary', !!why)}</div>
    </li>`;
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
          : `<div class="row-btns">${btn(`${lv ? '업그레이드' : '짓기'} · ${fmtDur(L.time)}`, 'upgrade', fid, '', why ? '' : 'primary', !!why)}${why ? `<span class="note">${esc(why)}</span>` : ''}</div>`}
      </div>`;
    }
    const recipes = D.recipes.filter((r) => r.at === fid);
    let craftHtml = '';
    if (recipes.length) {
      const c = H.crafts[fid];
      const r = H.ready[fid];
      let status = '';
      if (c) {
        const R = RECIPE[c.recipe];
        status += `<p class="note warn-text">만드는 중: ${esc(ITEMS[R.out[0]].name)} ×${R.out[1]} · ${fmtLeft(c.left)} 남음${R.power && !isPowered() ? ' (전력이 없어 멈춤)' : ''}</p>`;
      }
      if (r) {
        status += `<div class="fac-box ready"><span>완성품: ${esc(sortedIds(r).map((id) => `${ITEMS[id].name} ×${r[id]}`).join(', '))}</span>${btn('받기', 'collect', fid, '', 'primary', !home)}</div>`;
      }
      craftHtml = `<div class="fac-craft"><div class="fac-next-label">제작</div>${status}<ul class="items">${recipes.map(recipeRow).join('')}</ul></div>`;
    }
    return `<article class="fac" id="fac-${fid}">
      <div class="fac-head"><h3>${esc(F.name)}</h3><span class="fac-lv">LV <b>${lv}</b> / ${max}</span></div>
      <p class="note">${esc(F.desc)}</p>
      <p class="fac-cur">${lv ? esc(F.levels[lv - 1].effect) : '아직 없다.'}</p>
      ${extra}${next}${craftHtml}
    </article>`;
  }
  function renderFacilities() {
    const H = G.hideout, home = G.loc === 'hideout';
    const build = H.build ? `공사 중: ${FAC[H.build.id].name} LV ${H.build.to} · ${fmtLeft(H.build.left)} 남음` : '진행 중인 공사 없음';
    return `<section class="section">
      <div class="section-head"><h2>거점 시설</h2><span class="meta">${esc(build)}</span></div>
      ${home ? '<p class="note">재료는 창고에 있는 것부터 쓰고, 모자라면 소지품에서 쓴다. 장착한 장비는 쓰지 않는다. 공사는 한 번에 하나만 할 수 있다.</p>'
        : '<p class="note bad-text">거점에 있을 때만 짓고, 만들고, 받을 수 있다. 공사와 제작은 자리를 비워도 계속된다.</p>'}
      <div class="facs">${FAC_ORDER.map(facBlock).join('')}</div>
    </section>`;
  }

  function renderSkills() {
    const rows = SKILL_KEYS.map((k) => {
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
        <p class="note">${esc(c.train)}</p>
      </li>`;
    }).join('');
    return `<section class="section">
      <div class="section-head"><h2>스킬</h2><span class="meta">행동할수록 오른다 · 최대 LV ${SK.max}</span></div>
      <ul class="skills">${rows}</ul>
      <p class="note">같은 날 한 스킬을 많이 단련할수록 효율이 떨어지고, 날이 바뀌면 회복된다. 쓰러졌다가 깨어나도 스킬은 그대로 남는다.</p>
    </section>`;
  }

  function fragmentsSection() {
    const rows = ST.fragments.map((f) => {
      if (!G.fragments.includes(f.id)) return `<li class="frag locked"><span class="frag-title">아직 찾지 못한 기록</span><span class="note">${esc(LOC[f.loc].name)} 어딘가</span></li>`;
      return `<li class="frag"><span class="frag-title">${esc(f.title)}</span><span class="note">${esc(LOC[f.loc].name)}에서 찾음</span><p class="frag-text">${esc(f.text)}</p></li>`;
    }).join('');
    return `<section class="section">
      <div class="section-head"><h2>모은 기록</h2><span class="meta">${G.fragments.length}/${ST.fragments.length}</span>${btn('프롤로그 다시 보기', 'prologue', '', '', 'ghost')}</div>
      ${G.fragments.length === ST.fragments.length ? `<p class="frag-text">${esc(ST.allFragments)}</p>` : ''}
      <ul class="frags">${rows}</ul>
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
            ${facCfg('gym') ? actBtn('운동하기', `${fmtDur(EX.minutes)} · 힘·지구력 단련`, 'exercise', '', '', P().stamina < EX.minStamina) : ''}
            ${actBtn('시설 관리', hideoutHint(), 'tab', 'fac')}
            ${actBtn('짐 정리', `창고 ${slots}/${stashCap()}칸`, 'tab', 'inv')}
          </div>
          ${overweightNote()}
          ${recentBox()}
        </section>
        ${statusSection()}
        ${quickUseSection('먹고 마시기', true)}
        ${logSection()}`;
    }
    const L = LOC[G.loc], st = G.locs[G.loc];
    const groundIds = sortedIds(st.ground);
    const groundRows = groundIds.map((id) => {
      const q = st.ground[id];
      const can = carryFit(id, 1) > 0;
      return itemRow(id, q, btn('챙기기', 'take', id, '1', 'primary', !can) + (q > 1 ? btn('전부', 'take', id, 'all', '', !can) : ''));
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
        </div>
        ${overweightNote()}
        ${recentBox()}
      </section>
      ${statusSection()}
      <section class="section">
        <div class="section-head"><h2>주변에 있는 물건</h2>${groundIds.length ? btn('모두 챙기기', 'takeAll', '', '', 'primary') : ''}</div>
        ${groundIds.length ? `<ul class="items">${groundRows}</ul>` : '<p class="empty">찾은 물건과 내려놓은 물건이 여기에 남는다.</p>'}
        <p class="note">못 챙긴 물건은 이 자리에 그대로 남는다. 나중에 다시 와서 가져갈 수 있다.</p>
      </section>
      ${quickUseSection('가진 음식과 약', false)}
      ${logSection()}`;
  }

  function invButtons(id, q, from) {
    const it = ITEMS[id];
    const atHome = G.loc === 'hideout';
    let b = '';
    if (isUsable(it)) b += btn(USE_LABEL[it.cat], 'use', id, from, 'primary');
    if (SLOTS.includes(it.cat)) b += btn(EQUIP_LABEL[it.cat], 'equip', id, from, 'primary');
    if (from === 'stash') {
      const can = carryFit(id, 1) > 0;
      b += btn('꺼내기', 'retrieve', id, '1', '', !can) + (q > 1 ? btn('전부', 'retrieve', id, 'all', '', !can) : '');
    } else if (atHome) {
      const can = stashFit(id, 1) > 0;
      b += btn('넣기', 'store', id, '1', '', !can) + (q > 1 ? btn('전부', 'store', id, 'all', '', !can) : '');
    } else {
      b += btn('내려놓기', 'drop', id, '1') + (q > 1 ? btn('전부', 'drop', id, 'all') : '');
    }
    return b;
  }
  function equipRow(slot) {
    const id = P()[slot];
    const it = id ? ITEMS[id] : null;
    let what;
    if (!it) what = `<span class="note">${{ weapon: '맨손. 무기가 있으면 이길 확률이 오른다.', armor: '없음. 방어구가 있으면 지더라도 덜 다친다.', bag: '없음. 가방이 있으면 더 많이 들 수 있다.' }[slot]}</span>`;
    else if (slot === 'weapon') what = `${esc(it.name)} <span class="note">(승률 +${it.atk}%${it.ammo ? ` · ${esc(ITEMS[it.ammo].name)} ${P().inv[it.ammo] || 0}발` : ''} · ${fmtKg(it.w)}kg)</span>`;
    else if (slot === 'armor') what = `${esc(it.name)} <span class="note">(피해 -${pct(it.def)}% · 디버프 -${pct(it.dbf)}% · ${fmtKg(it.w)}kg)</span>`;
    else what = `${esc(it.name)} <span class="note">(+${it.bag}kg · ${fmtKg(it.w)}kg)</span>`;
    return `<div class="equip-row"><span class="slot">${SLOT_NAME[slot]}</span><span class="what">${what}</span>${it ? btn(slot === 'weapon' ? '내려놓기' : '벗기', 'unequip', slot) : ''}</div>`;
  }

  function renderInv() {
    const p = P();
    const atHome = G.loc === 'hideout';
    const invIds = sortedIds(p.inv);
    let html = `
      <section class="section">
        <div class="section-head"><h2>장비</h2><span class="meta">기본 중량 한계 ${C.baseCarry}kg</span></div>
        <div class="equip">${SLOTS.map(equipRow).join('')}</div>
      </section>
      <section class="section">
        <div class="section-head"><h2>소지품</h2><span class="meta">${invIds.length}종 · ${fmtKg(mapWeight(p.inv))}kg</span>${atHome && invIds.length ? btn('전부 창고에 넣기', 'storeAll', '', '', 'primary') : ''}</div>
        ${invIds.length ? `<ul class="items">${invIds.map((id) => itemRow(id, p.inv[id], invButtons(id, p.inv[id], 'inv'))).join('')}</ul>` : '<p class="empty">들고 있는 물건이 없다.</p>'}
      </section>`;
    if (atHome) {
      const stIds = sortedIds(G.stash);
      html += `
        <section class="section">
          <div class="section-head"><h2>창고</h2><span class="meta">${stashSlots()}/${stashCap()}칸 사용 중 · 무게 제한 없음</span></div>
          ${stIds.length ? `<ul class="items">${stIds.map((id) => itemRow(id, G.stash[id], invButtons(id, G.stash[id], 'stash'))).join('')}</ul>` : '<p class="empty">창고가 비어 있다.</p>'}
        </section>`;
    } else {
      html += '<p class="note">창고는 거점에서만 열 수 있다. 여기서 내려놓은 물건은 이 장소 바닥에 남는다.</p>';
    }
    return html;
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
    const dots = LOCS.map((l) => {
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
    const ids = ['hideout', ...LOCS.map((l) => l.id)];
    ids.sort((a, b) => distMin(G.loc, a) - distMin(G.loc, b));
    const blocked = !!G.pending;
    const rows = ids.map((id) => {
      const here = id === G.loc;
      const mins = here ? 0 : travelMinutes(id);
      const arrive = G.time + mins;
      const eta = `${fmtDur(mins)} · 도착 ${clockStr(arrive)}${isNight(arrive) ? ' (밤)' : ''}`;
      let name, meta;
      if (id === 'hideout') {
        name = '<span>거점</span>';
        meta = here ? '지금 여기 있다' : eta;
      } else {
        const l = LOC[id], st = G.locs[id];
        name = `<span>${esc(l.name)}</span>${dangerChip(l.danger)}`;
        const spots = st.visited ? `수색 구역 ${st.spots}/${l.spots}` : '아직 가 보지 않음';
        const enc = `조우 ${pct(searchEncounterChance(l.danger))}%`;
        meta = here ? `지금 여기 있다 · ${spots} · ${enc}` : `${eta} · ${spots} · ${enc}`;
      }
      return `<li class="loc-row${ui.sel === id ? ' sel' : ''}" id="row-${id}">
        <div class="lr-main"><div class="lr-name">${name}${here ? '<span class="chip ok">현재 위치</span>' : ''}</div><div class="lr-meta">${esc(meta)}</div></div>
        ${here ? '' : btn('이동', 'travel', id, '', ui.sel === id ? 'primary' : '', blocked)}
      </li>`;
    }).join('');
    return `
      <section class="section">
        <div class="section-head"><h2>지도</h2><span class="meta">거점 기준 걸어서 걸리는 시간 · 다음 보급까지 ${refillIn}일</span></div>
        ${blocked ? '<p class="note bad-text">눈앞의 상황부터 해결해야 움직일 수 있다.</p>' : ''}
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
    return `
      <section class="section">
        <div class="section-head"><h2>생존 기록</h2></div>
        <dl class="kv">
          <dt>생존</dt><dd>${dayOf(G.time)}일차</dd>
          <dt>수색 횟수</dt><dd>${G.stats.searches}회</dd>
          <dt>쓰러뜨린 적</dt><dd>${G.stats.kills}</dd>
          <dt>악몽에서 깨어난 횟수</dt><dd>${G.stats.deaths}회</dd>
        </dl>
      </section>
      ${fragmentsSection()}
      <section class="section">
        <div class="section-head"><h2>저장</h2></div>
        <p class="note">행동할 때마다 자동으로 저장된다. ${cloud ? '이 계정에도 저장되어 다른 기기에서 이 링크를 열어도 이어서 할 수 있다.' : '지금은 이 브라우저에만 저장된다. 다른 기기로 옮기려면 세이브 코드를 쓰자.'}</p>
        <div class="row-btns">${btn('세이브 코드 만들기', 'exportCode')}${btn('세이브 코드 불러오기', 'menuView', 'import')}</div>
        ${codeBlock}
      </section>
      <section class="section">
        <div class="section-head"><h2>규칙 요약</h2></div>
        <ul class="help">
          <li><b>전투</b>: 수색·이동·휴식 중에 적을 만날 수 있다. 이길 확률은 위험도 기본값(안전함 ${CB.base[0]}% ~ 매우위험함 ${CB.base[4]}%)에 적 종류, 무기, 밤, 부상, 과적, 디버프가 더해진다. 지면 크게 다치고 출혈·감염·골절에 걸릴 수 있다. 도망칠 기회가 있을 때도 있다.</li>
          <li><b>거점 시설</b>: 재료를 모아 발전기·작업대·창고·침대·의무실·조리대·정수기·체육관·방어벽을 짓고 올린다(각 3레벨). 공사와 제작은 시간이 걸리지만 자리를 비워도 진행된다. 정수기와 일부 제작에는 발전기 전력이 필요하다.</li>
          <li><b>스킬</b>: 힘·지구력·체력·집중력·스트레스 저항력은 관련된 행동을 할수록 오른다(최대 LV ${SK.max}). '스킬' 탭에서 효과와 올리는 법을 볼 수 있다.</li>
          <li><b>장비</b>: 무기는 이길 확률을 올린다. 총은 탄약이 있어야 제값을 한다. 방어구는 졌을 때 받는 피해와 디버프 확률을 줄인다.</li>
          <li><b>디버프</b>: 출혈(붕대·구급상자), 감염(항생제, 방치하면 점점 퍼진다), 골절(부목), 공포(진정제·휴식), 식중독(지사제). '몸 상태'에서 바로 치료할 수 있다.</li>
          <li><b>중량</b>: 기본 ${C.baseCarry}kg + 가방(최대 +35kg). 한계를 넘으면 <b>경과적</b>(행동시간 ×1.25), 1.25배를 넘으면 <b>중과적</b>(행동시간 ×2, 이동·수색 중 HP 감소, 도망 불가). 1.5배를 넘게는 못 줍는다.</li>
          <li><b>생존 수치</b>: 배고픔·갈증·피로는 시간이 지나면 오른다. 100이 되면 HP가 깎인다. 배고픔·갈증이 70을 넘으면 회복이 절반으로 줄어든다.</li>
          <li><b>수색 구역</b>: 장소마다 정해져 있고 뒤질수록 줄어든다. ${C.refill.everyDays}일마다 각 장소의 ${pct(C.refill.ratio)}%가 다시 채워진다.</li>
          <li><b>밤</b>: ${C.night.start}시부터 ${C.night.end}시까지. 조우 확률 +${nightEnc}%, 승률 ${CB.nightWin}%, 대신 좋은 물건이 더 잘 나온다.</li>
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
    else if (ui.tab === 'menu') main.innerHTML = renderMenu();
    else main.innerHTML = renderScene();
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
      const cont = save ? actBtn('이어하기', `${dayOf(save.state.time)}일차 ${clockStr(save.state.time)}${status}`, 'continue', '', 'primary') : '';
      body = `
        <div class="title-menu">
          ${cont}
          ${actBtn('새 게임', '1일차 아침, 거점에서 시작한다', 'newGame', '', save ? '' : 'primary')}
          ${actBtn('세이브 코드로 불러오기', '다른 기기에서 하던 게임 이어하기', 'titleView', 'import')}
        </div>
        ${Store.checked ? '' : '<p class="note">저장된 게임을 확인하는 중…</p>'}`;
    }
    $('#title').innerHTML = `
      <div class="tape" aria-hidden="true"></div>
      <div class="title-block">
        <span class="title-kicker">텍스트 생존 시뮬레이션</span>
        <h1 class="title-name">폐허의 거점</h1>
        <p class="title-lead">무너진 도시 외곽, 지하 창고 하나가 당신의 전부다. 밖으로 나가 뒤지고, 싸우고, 짊어지고, 살아서 돌아와라. 짐이 무거울수록 길은 길어진다.</p>
      </div>
      <section class="section">${body}</section>`;
  }

  function render() {
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
  function showModal({ title, body = [], buttons = [{ label: '확인', primary: true }] }) {
    const m = $('#modal');
    m.innerHTML = `<div class="modal" role="dialog" aria-modal="true" aria-labelledby="m-title">
      <h2 id="m-title">${esc(title)}</h2>
      <div class="m-body">${body.map((t) => (Array.isArray(t) ? `<p><b>${esc(t[0])}</b> ${esc(t[1])}</p>` : `<p>${esc(t)}</p>`)).join('')}</div>
      <div class="row-btns">${buttons.map((b, i) => `<button type="button" class="btn ${b.primary ? 'primary' : ''}" data-mi="${i}">${esc(b.label)}</button>`).join('')}</div>
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
    tab: (t) => {
      ui.tab = t;
      ui.menuView = null;
      if (t === 'skills' && G && G.skillNew) { G.skillNew = false; persist(); }
      render();
      window.scrollTo(0, 0);
    },
    prologue: () => showPrologue(),
    upgrade: (fid) => upgrade(fid),
    craft: (rid) => craft(rid),
    collect: (fid) => collect(fid),
    collectWater: () => collectWater(),
    addFuel: () => addFuel(),
    toggleGen: () => toggleGen(),
    exercise: () => exercise(),
    travel: (dest) => travel(dest),
    search: () => search(),
    rest: () => rest(),
    sleep: () => sleep(),
    fight: () => fight(),
    flee: () => flee(),
    choose: (i) => chooseEvent(i),
    use: (id, from) => useItem(id, from),
    take: (id, n) => take(id, n),
    takeAll: () => takeAll(),
    drop: (id, n) => drop(id, n),
    store: (id, n) => store(id, n),
    storeAll: () => storeAll(),
    retrieve: (id, n) => retrieve(id, n),
    equip: (id, from) => equip(id, from),
    unequip: (slot) => unequip(slot),
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
    exportCode: () => { ui.exportCode = encodeSave(); ui.menuView = 'export'; render(); },
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
    restart: () => confirmBox('새 게임', '지금 하던 게임을 버리고 새로 시작할까? 저장이 덮어써진다.', '새로 시작', startNew),
  };

  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-act]');
    if (!el || el.disabled) return;
    const fn = ACTIONS[el.dataset.act];
    if (fn) fn(el.dataset.a || '', el.dataset.b || '');
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
      refresh();
      if (G && Store.ref) Store.queueRemote(makeSave());
    });
    setTimeout(() => { if (!Store.checked) { Store.checked = true; refresh(); } }, 3500);
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
    rollEvent: (on, danger) => { const e = rollEvent(on, danger || 0); return e ? e.id : null; },
    isPowered: () => isPowered(),
    maxHp: () => maxHp(),
  };
})();
