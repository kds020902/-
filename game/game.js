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
  for (const b of BONDS) b.steps.forEach((st, i) => { EVENTS[`q:${b.id}:${i}`] = { id: `q:${b.id}:${i}`, title: `${b.who} · ${st.title}`, text: [st.text], choices: st.choices, bond: b.id }; });
  const LOCAL_KEY = 'ruin-hideout.save.v1';
  const LOG_MAX = 150;
  const HIDEOUT_DESC = '도시 외곽의 낡은 지하 창고. 철문을 걸어 잠그면 그나마 숨을 돌릴 수 있다.';
  const DEBUFF_KEYS = ['bleed', 'infection', 'fracture', 'fear', 'poison'];
  const EQ_CATS = ['weapon', 'armor', 'bag'];

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

  const CAT_ORDER = { weapon: 0, armor: 1, bag: 2, ammo: 3, food: 4, drink: 5, med: 6, material: 7, junk: 8 };
  const USE_VERB = { food: '먹었다', drink: '마셨다', med: '사용했다' };
  const USE_LABEL = { food: '먹기', drink: '마시기', med: '사용' };
  const EQUIP_LABEL = { weapon: '들기', armor: '입기', bag: '메기' };

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
  const ui = { screen: 'title', tab: 'scene', titleView: 'main', menuView: null, sel: null, exportCode: '', showHides: false, recordView: 'people', craftQty: {}, invView: 'inv', facView: null, skillView: null, pack: null, stashCat: 'all', invCat: 'all' };

  function newState() {
    return {
      v: SAVE_VERSION,
      time: C.startMinute,
      loc: 'hideout',
      player: {
        hp: C.hp.base, stamina: C.stamina.max, hunger: 20, thirst: 20, fatigue: 10,
        inv: { ...D.start.inv }, bag: D.start.bag, weaponsL: [], weaponS: null, armors: [], debuffs: {}, buffs: {},
      },
      stash: { ...D.start.stash },
      locs: Object.fromEntries(LOCS.map((l) => [l.id, { spots: l.spots, ground: {}, visited: false, hides: makeHides(l), groundLost: null }])),
      lastRefillDay: 1,
      lastTheftDay: 1,
      recordNew: false,
      log: [],
      recent: [],
      stats: { deaths: 0, searches: 0, kills: 0 },
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
    return { fac: Object.fromEntries(FAC_ORDER.map((id) => [id, 0])), build: null, crafts: {}, ready: {}, fuel: 0, genOn: true, water: { stored: 0, prog: 0 } };
  }
  function cleanHideout(h) {
    const out = newHideout();
    if (!h || typeof h !== 'object') return out;
    for (const id of FAC_ORDER) out.fac[id] = clamp(Math.floor(+(h.fac && h.fac[id]) || 0), 0, FAC[id].levels.length);
    if (h.build && FAC[h.build.id] && h.build.to === out.fac[h.build.id] + 1) out.build = { id: h.build.id, to: h.build.to, left: Math.max(0, +h.build.left || 0) };
    for (const fid in h.crafts || {}) { const c = h.crafts[fid]; if (FAC[fid] && c && RECIPE[c.recipe]) out.crafts[fid] = { recipe: c.recipe, left: Math.max(0, +c.left || 0), count: Math.max(1, Math.floor(+c.count || 1)), ...(c.elec ? { elec: true } : {}) }; }
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
    st.player.debuffs = cleanDebuffs(st.player.debuffs);
    const buffs = {};
    for (const id in st.player.buffs || {}) if (BUFFS[id] && st.player.buffs[id].left > 0) buffs[id] = { left: +st.player.buffs[id].left };
    st.player.buffs = buffs;
    st.stash = cleanItems(s.stash);
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
      if (c && typeof c.id === 'string' && c.id.startsWith('q:') && LOC[c.loc] && typeof c.place === 'string') return { id: c.id, loc: c.loc, place: c.place, items: cleanItems(c.items) };
      return null;
    }).filter(Boolean);
    st.bonds = {};
    for (const b of BONDS) {
      const o = s.bonds && s.bonds[b.id];
      if (o) st.bonds[b.id] = { step: clamp(Math.floor(+o.step || 0), 0, b.steps.length - 1), at: Math.max(0, Math.floor(+o.at || 0)), done: !!o.done };
    }
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
  const facLv = (id) => G.hideout.fac[id] || 0;
  const facCfg = (id) => (facLv(id) ? FAC[id].levels[facLv(id) - 1] : null);
  const stashCap = () => C.stashSlots + (facCfg('stash') ? facCfg('stash').slots : 0);
  // 발전기 7레벨은 낮에 태양광으로 돌아가 연료가 닳지 않는다
  const solarNow = () => { const g = facCfg('generator'); return !!(g && g.solar && !isNight(G.time)); };
  const isPowered = () => facLv('generator') > 0 && G.hideout.genOn && (G.hideout.fuel > 0 || solarNow());
  // 시설 레벨이 오르면 그 시설에서 만드는 시간이 줄어든다
  const facSpeed = (fid) => (facCfg(fid) && facCfg(fid).speed) || 1;
  const bedFatigueMult = () => (facCfg('bed') ? facCfg('bed').fatigueMult : 1);
  const homeHpBonus = (sleeping) => (G.loc !== 'hideout' ? 0 : (facCfg('medbay') ? facCfg('medbay').hp : 0) + (sleeping && facCfg('bed') ? facCfg('bed').hp : 0));
  const countHave = (id) => (G.stash[id] || 0) + (P().inv[id] || 0);
  // 대체 재료까지 합친 개수 (예: 끓인 물 대신 생수)
  const SUBS = C.substitutes || {};
  const countAny = (id) => countHave(id) + (SUBS[id] || []).reduce((sum, x) => sum + countHave(x), 0);
  const haveAll = (list) => list.every(([id, n]) => countAny(id) >= n);
  const reqMet = (req) => Object.entries(req || {}).every(([f, lv]) => facLv(f) >= lv);
  const SL = SK.list;
  const strengthCarry = () => Math.floor(lvl('strength') / SL.strength.carryEvery) * SL.strength.carryKg;
  const maxHp = () => C.hp.base + lvl('vitality') * SL.vitality.hpPerLv;
  // 지구력: LV당 최대 스테미너 +staminaPerLv
  const maxStamina = () => Math.round(C.stamina.max * (1 + lvl('endurance') * SL.endurance.staminaPerLv));
  const bagBonus = () => (P().bag ? ITEMS[P().bag].bag : 0);
  const carryLimit = () => C.baseCarry + bagBonus() + strengthCarry() + buffSum('carry');
  function mapWeight(m) { let w = 0; for (const id in m) w += ITEMS[id].w * m[id]; return w; }
  const weaponIds = () => [...P().weaponsL, ...(P().weaponS ? [P().weaponS] : [])];
  const equippedIds = () => [...weaponIds(), ...P().armors, ...(P().bag ? [P().bag] : [])];
  const equippedWeight = () => equippedIds().reduce((sum, id) => sum + ITEMS[id].w, 0);
  // 옷 껴입기: 두께 합이 기준을 넘은 만큼 둔해진다
  const thickness = () => P().armors.reduce((sum, id) => sum + (ITEMS[id].thick || 1), 0);
  const thickOver = () => Math.max(0, thickness() - EQ.freeThickness);
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
    m *= 1 + thickOver() * EQ.perTime;
    return m;
  }
  const travelMinutes = (dest) => Math.max(5, Math.round(distMin(G.loc, dest) * timeMult() * (1 - lvl('endurance') * SL.endurance.travelPerLv)));
  const searchMinutes = () => Math.max(5, Math.round(C.searchMinutes * timeMult() * (has('fear') ? DB.fear.searchMult : 1) * (1 - lvl('focus') * SL.focus.searchPerLv)));
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
  const foodMult = () => 1 + lvl('metabolism') * SL.metabolism.foodPerLv + (G.loc === 'hideout' && facCfg('kitchen') ? facCfg('kitchen').food || 0 : 0);
  const buffMult = (field) => Object.keys(P().buffs).reduce((m, id) => m * (BUFFS[id][field] != null ? BUFFS[id][field] : 1), 1);
  function buffSum(field) { return G ? Object.keys(P().buffs).reduce((a, id) => a + (BUFFS[id][field] || 0), 0) : 0; }
  // 근접 싸움: 맨손, 근접 무기, 탄약 없는 총(휘두르기)
  const isMelee = (w) => !w || !ITEMS[w].ammo || !(P().inv[ITEMS[w].ammo] > 0);
  const searchEncounterChance = (danger) => Math.min(0.95, CB.encounter[danger] * (isNight(G.time) ? CB.nightEncounterMult : 1));
  const hasItem = (id) => (P().inv[id] || 0) > 0 || equippedIds().includes(id);
  const isUsable = (it) => !!(it.use || it.treat);
  // 쓰면 해가 될 수 있는 아이템: 식중독 확률이 기준 이상이거나, 효과가 끝날 때 반동이 있는 것
  function itemRisks(it) {
    const out = [];
    const u = it.use || {};
    if (u.poison && u.poison >= C.riskPoisonAt) out.push(`식중독에 걸릴 확률 ${Math.round(u.poison * (G ? debuffChanceMult() : 1) * 100)}%${it.cook ? ` (거점에서 ${cookVerb(it)[1]} 안전)` : ''}`);
    if (it.buff && BUFFS[it.buff[0]].endFatigue) out.push(`${BUFFS[it.buff[0]].name} 효과가 끝나면 피로 +${BUFFS[it.buff[0]].endFatigue}`);
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
    if (u.poison) parts.push(`식중독 위험 ${Math.round(u.poison * (G ? debuffChanceMult() : 1) * 100)}%`);
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
    if (k === 'endurance') return `최대 스테미너 +${Math.round(lv * c.staminaPerLv * 100)}% · 회피 ${(CB.baseDodge + lv * c.dodgePerLv).toFixed(1)}% · 이동시간 -${(lv * c.travelPerLv * 100).toFixed(1)}%`;
    if (k === 'vitality') return `최대 HP +${lv * c.hpPerLv}`;
    if (k === 'focus') return `수색시간 -${Math.round(lv * c.searchPerLv * 100)}% · 좋은 물건 +${Math.round(lv * c.rarePerLv * 100)}% · 추가 발견 ${(lv * c.extraFindPerLv * 100).toFixed(1)}% · 총 승률 +${Math.round(lv * c.gunPerLv)}%`;
    if (k === 'resolve') return `디버프 확률 -${(lv * c.chancePerLv * 100).toFixed(1)}% · 지속시간 -${Math.round(lv * c.durationPerLv * 100)}%`;
    if (k === 'metabolism') return `배고픔·갈증 소모 -${Math.round(lv * c.drainPerLv * 100)}% · 음식 효과 +${(lv * c.foodPerLv * 100).toFixed(1)}%`;
    if (k === 'intellect') return `해체 수량 +${Math.round(lv * c.yieldPerLv * 100)}% · 고급 재료 회수 ${pct(rareSalvage(lv))}% · 제작·해체 시간 -${Math.round(lv * c.craftTimePerLv * 100)}%`;
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
    const kind = type === 'fear' ? buffMult('fearMult') : type === 'infection' ? buffMult('infectMult') : 1;
    if (p > 0 && chance(p * debuffChanceMult() * buffMult('dbfMult') * kind)) applyDebuff(type);
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
      const add = (v, c) => { if (v > 0) { loss += v; cause = cause || c; } };
      if (exert && tr.hpPerHour) add(tr.hpPerHour * h, 'weight');
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
        } else if (!(mb && mb.infection === 'hold')) {
          d.infection.sev = Math.min(100, d.infection.sev + DB.infection.growPerHour * debuffDurationMult() * buffMult('infectGrow') * h);
        }
        if (d.infection) {
          const s = d.infection.sev;
          add(infectionHpPerDay(s) / 24 * h, 'infection');
        }
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
      if (loss <= 0 && buffSum('hpRegen')) p.hp = clamp(p.hp + buffSum('hpRegen') * h, 0, maxHp());

      for (const id of Object.keys(p.buffs)) {
        p.buffs[id].left -= dt;
        if (p.buffs[id].left <= 0) {
          delete p.buffs[id];
          bEnded.push(id);
          if (BUFFS[id].endFatigue) p.fatigue = clamp(p.fatigue + BUFFS[id].endFatigue, 0, 100);
        }
      }

      hideoutTick(dt, hmsgs);
      G.time += dt;
      if (p.hp <= 0) {
        G.dead = true;
        G.deathCause = DEATH_TEXT[cause] || '쓰러졌다';
        break;
      }
    }
    checkRefill();
    checkThefts();
    if (G.dead) return;
    const today = dayOf(G.time);
    if (today > startDay) log(journal(today), 'story');
    for (const [t, k] of hmsgs) log(t, k);
    gainXp('strength', xpCarry);
    gainXp('endurance', xpWalk);
    gainXp('vitality', lost * SK.xp.hpLost);
    for (const k of ended) log(DB[k].ended, 'good');
    for (const id of bEnded) log(BUFFS[id].endFatigue ? `${BUFFS[id].name} 효과가 끝났다. 피로가 한꺼번에 몰려온다. (피로 +${BUFFS[id].endFatigue})` : `${BUFFS[id].name} 효과가 끝났다.`, BUFFS[id].endFatigue ? 'warn' : 'info');
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
      if ((R.power || c.elec) && !powered) continue;
      c.left -= dt;
      if (c.left <= 0) {
        const made = R.out[1] * (c.count || 1);
        H.ready[fid] = H.ready[fid] || {};
        addTo(H.ready[fid], R.out[0], made);
        delete H.crafts[fid];
        msgs.push([`${FAC[fid].name} 제작 완료: ${ITEMS[R.out[0]].name} ×${made}. 거점에서 받을 수 있다.`, 'good']);
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
  // 지능이 오를수록 제작·해체가 빨라진다
  const craftTimeMult = () => 1 - lvl('intellect') * SL.intellect.craftTimePerLv;
  const craftMinutes = (R, n) => Math.max(1, Math.round(R.time * n * craftTimeMult() * facSpeed(R.at)));
  // 전기로 할 수 있으면 불 피울 재료(목재)는 쓰지 않는다
  const elecFuel = (R) => !!R.fuel && isPowered();
  const recipeIn = (R) => (elecFuel(R) ? R.in.filter(([id]) => id !== R.fuel) : R.in);
  // 가진 재료로 몇 번 만들 수 있나
  function maxBatch(rid) {
    const R = RECIPE[rid];
    return Math.min(D.craftBatchMax, ...recipeIn(R).map(([id, n]) => Math.floor(countAny(id) / n)));
  }
  const timesIn = (list, k) => list.map(([id, n]) => [id, n * k]);
  function craftBlock(rid, times = 1) {
    const R = RECIPE[rid];
    if (G.loc !== 'hideout') return '거점에서만 할 수 있다';
    if (G.pending) return '눈앞의 상황부터 해결해야 한다';
    if (facLv(R.at) < R.lv) return `${FAC[R.at].name} LV ${R.lv} 필요`;
    if (G.hideout.crafts[R.at]) return '이미 만드는 중이다';
    if (R.power && !isPowered()) return '전력이 필요하다';
    if (!haveAll(timesIn(recipeIn(R), times))) return '재료가 부족하다';
    return '';
  }
  // 창고에 있는 것부터 쓰고, 모자라면 소지품에서 쓴다 (장착한 장비는 쓰지 않는다)
  function consumeItems(list) {
    for (const [id, n] of list) {
      let left = n;
      for (const x of [id, ...(SUBS[id] || [])]) {
        for (const m of [G.stash, P().inv]) {
          const k = Math.min(left, m[x] || 0);
          if (k > 0) { addTo(m, x, -k); left -= k; }
        }
        if (left <= 0) break;
      }
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
  function craft(rid, times = 1) {
    times = Math.max(1, Math.floor(times) || 1);
    const why = craftBlock(rid, times);
    if (why) return toast(why);
    run(() => {
      const R = RECIPE[rid], elec = elecFuel(R), mins = craftMinutes(R, times);
      consumeItems(timesIn(recipeIn(R), times));
      G.hideout.crafts[R.at] = { recipe: rid, left: mins, count: times, ...(elec ? { elec: true } : {}) };
      gainXp('intellect', SK.xp.craft * times);
      const what = `${ITEMS[R.out[0]].name} ×${R.out[1] * times}`;
      log(`${FAC[R.at].name}에서 ${what} 만들기를 시작했다.${times > 1 ? ` (${times}번 한꺼번에)` : ''}${elec ? ` 전기로 해서 ${ITEMS[R.fuel].name}는 쓰지 않았다.` : ''} (${fmtDur(mins)})`);
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
  // 거점에서 식중독 위험 음식을 목재로 한 번에 익힌다 (조리대가 있으면 빠르다, 전기가 있으면 목재 없이)
  function cookCount(id) { return (G.stash[id] || 0) + (P().inv[id] || 0); }
  function cookMinutes(n) {
    const c = C.cook;
    return Math.round((c.minutes + c.perItem * n) * (facLv('kitchen') ? c.kitchenTimeMult * facSpeed('kitchen') : 1));
  }
  function askCook(id) {
    const it = ITEMS[id];
    if (!G || !it || !it.cook) return;
    if (G.loc !== 'hideout') return toast('거점에서만 익힐 수 있다.');
    if (G.pending) return toast('눈앞의 상황부터 해결해야 한다.');
    const n = cookCount(id);
    if (!n) return;
    const c = C.cook, fuel = ITEMS[c.fuel], elec = isPowered();
    if (!elec && countHave(c.fuel) < c.fuelCount) return toast(`${fuel.name} ${c.fuelCount}개가 있어야 불을 피울 수 있다. 발전기를 켜 두면 전기로 할 수 있다.`);
    const out = ITEMS[it.cook[0]], mins = cookMinutes(n), v = cookVerb(it);
    const how = elec ? `전기로 가진 것을 한 번에 ${v[0] === '끓이기' ? '끓인다' : '익힌다'}. ${fuel.name}는 쓰지 않는다.` : `${fuel.name} ${c.fuelCount}개로 가진 것을 한 번에 ${v[0] === '끓이기' ? '끓인다' : '익힌다'}.`;
    showModal({
      title: `${it.name} ${n}개를 ${v[0] === '끓이기' ? '끓일까' : '익힐까'}?`,
      body: [
        `${how} ${fmtDur(mins)} 걸린다.`,
        `결과: ${out.name} ×${it.cook[1] * n} (식중독 걱정 없음)`,
        facLv('kitchen') ? '조리대가 있어 빨리 끝난다.' : `조리대가 없어 ${elec ? '바닥에서' : '모닥불로'} 한다. 조리대를 지으면 두 배 빨라진다.`,
      ],
      buttons: [{ label: '그만둔다' }, { label: `${v[0] === '끓이기' ? '끓인다' : '익힌다'} · ${fmtDur(mins)}`, primary: true, onClick: () => cook(id) }],
    });
  }
  function cook(id) {
    const it = ITEMS[id];
    if (!G || G.loc !== 'hideout' || !it || !it.cook) return;
    const n = cookCount(id), elec = isPowered();
    if (!n || (!elec && countHave(C.cook.fuel) < C.cook.fuelCount)) return;
    run(() => {
      const mins = cookMinutes(n);
      consumeItems([...(elec ? [] : [[C.cook.fuel, C.cook.fuelCount]]), [id, n]]);
      passTime(mins, 'idle');
      if (G.dead) return;
      const made = { [it.cook[0]]: it.cook[1] * n };
      const spill = storeOrCarry(made);
      const where = elec ? (facLv('kitchen') ? '조리대에서 전기로' : '전기로') : facLv('kitchen') ? '조리대에서' : '모닥불에';
      log(`${where} ${it.name} ${n}개를 ${cookVerb(it)[2]}: ${listText(made)} (${fmtDur(mins)})${spill ? ' 창고가 차서 일부는 소지품으로 옮겼다.' : ''}`, 'good');
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
  // 날이 바뀔 때마다 숨긴 곳마다 털릴지 판정한다. 플레이어가 지금 있는 곳은 털리지 않는다
  function checkThefts() {
    const day = dayOf(G.time);
    if (!G.lastTheftDay) G.lastTheftDay = day;
    while (G.lastTheftDay < day) {
      G.lastTheftDay += 1;
      for (const l of LOCS) {
        if (l.id === G.loc) continue;
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
  const hideTime = (h) => Math.max(5, Math.round(h.time * timeMult()));
  const retrieveTime = (h) => Math.max(5, Math.round(h.time * HIDE.retrieveMult * timeMult()));
  function doHide(idx, src, id, n) {
    if (!G || G.loc === 'hideout') return;
    const st = G.locs[G.loc], h = st.hides[idx];
    if (!h) return;
    run(() => {
      const mins = hideTime(h);
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
    });
  }
  function doRetrieve(idx, id) {
    if (!G || G.loc === 'hideout') return;
    const st = G.locs[G.loc], h = st.hides[idx];
    if (!h || !Object.keys(h.items).length) return;
    run(() => {
      const mins = retrieveTime(h);
      passTime(mins, 'search');
      if (G.dead) return;
      const ids = id === 'all' ? sortedIds(h.items) : [id];
      const taken = {};
      let left = false;
      for (const k of ids) {
        const q = carryFit(k, h.items[k] || 0);
        if (q > 0) { addTo(h.items, k, -q); addTo(P().inv, k, q); addTo(taken, k, q); }
        if (h.items[k]) left = true;
      }
      if (!Object.keys(taken).length) log('짐이 너무 무거워 아무것도 꺼내지 못했다.', 'warn');
      else log(`${LOC[G.loc].hides[idx]}에서 꺼냈다: ${listText(taken)}${left ? ' (다 들 수 없어 일부는 남겨 뒀다)' : ''} (${fmtDur(mins)})`);
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
      body: [`소지품: ${listText(P().inv)}`, `${fmtDur(hideTime(h))} 걸린다. 장착한 장비는 그대로 둔다.`],
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
          label: `${LOC[G.loc].hides[i]} · ${fmtDur(hideTime(h))}${h.known ? ` · 털릴 확률 하루 ${pct(h.risk)}%` : ''}`,
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
    fn();
    if (!G.dead) checkBonds();
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
  function bondUnlocked(b) {
    if (b.minDay && dayOf(G.time) < b.minDay) return false;
    return b.unlock.some((u) => {
      const i = u.indexOf(':'), k = u.slice(0, i), v = u.slice(i + 1);
      return k === 'frag' ? G.fragments.includes(v) : k === 'radio' ? G.radioHeard.includes(v) : k === 'flag' ? qflag(v) : false;
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
  const bondStep = (b) => { const st = G.bonds[b.id]; return st && !st.done ? b.steps[st.step] : null; };
  // 지금 여기서 만날 수 있으면 '', 아니면 이유
  function bondBlock(b) {
    const st = G.bonds[b.id], step = bondStep(b);
    if (!step || step.loc !== G.loc) return '여기 없다';
    if (dayOf(G.time) < st.at + (step.wait || 0)) return '아직 때가 아니다. 내일 다시 오자';
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
      log(`[인연] ${b.who}: ${b.done}`, 'good');
      return;
    }
    st.step = step + 1;
    st.at = dayOf(G.time);
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
    if (!G || G.loc !== 'mart' || !qflag('clinic')) return;
    if (G.flags.clinicDay === dayOf(G.time)) return toast('오늘은 이미 치료받았다. 내일 다시 오자.');
    run(() => {
      passTime(60, 'rest');
      if (G.dead) return;
      const p = P();
      p.hp = maxHp();
      for (const k of ['bleed', 'fracture', 'infection', 'poison']) delete p.debuffs[k];
      G.flags.clinicDay = dayOf(G.time);
      log('이서윤이 상처를 꼼꼼히 소독하고 꿰맸다. "또 다치면 또 와요. 안 다치면 더 좋고요." (HP 회복 · 출혈, 골절, 감염, 식중독 치료)', 'good');
    });
  }
  // 옥상의 아이들이 학교에서 망을 봐 준다
  const encChance = (locId) => searchEncounterChance(LOC[locId].danger) * (locId === 'school' && qflag('kids_fed') ? 0.5 : 1);

  // ---------- 라디오 ----------
  // 채널마다 날짜별 방송이 있다. 끊기는 채널도, 다시 살아나는 채널도 있다.
  // 듣지 못하고 지나간 방송은 나중에 라디오를 켤 때 무작위로 '지난 방송'으로 다시 나온다
  // 방송 키: 날짜 방송은 '채널:일차', 반응 방송은 '채널:r:플래그', 무전은 '채널:p번호'
  const rKey = (ch, b) => (b.react ? `${ch.id}:r:${b.react}` : `${ch.id}:${b.day}`);
  const heardB = (ch, b) => G.radioHeard.includes(rKey(ch, b));
  const condOk = (b) => (!b.if || qflag(b.if)) && (!b.unless || !qflag(b.unless));
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
      if (freshReact(ch, day)) fresh = true;
      if (ch.pool) continue;
      if (freshB(ch, currentB(ch, day))) fresh = true;
      missed += missedB(ch, day).length;
    }
    return { fresh, missed };
  }
  function listenRadio() {
    if (!G || G.loc !== 'hideout') return;
    let body = null, title = '';
    run(() => {
      passTime(ST.radio.minutes, 'idle');
      if (G.dead) return;
      const day = dayOf(G.time);
      body = [];
      // tag: '새 방송' / '지난 방송 (n일차)' / 없음(무전)
      const hear = (ch, key, tag, text) => {
        body.push({ head: tag ? `${ch.name} · ${tag}` : ch.name, text });
        if (!G.radioHeard.includes(key)) { G.radioHeard.push(key); log(`[라디오 · ${ch.name}${tag && tag !== '새 방송' && tag !== '새 소식' ? ` · ${tag}` : ''}] ${text}`, 'story'); }
      };
      for (const ch of ST.radio.channels) {
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
      title = `라디오 · ${day}일차 ${clockStr(G.time)}`;
      const fear = P().debuffs.fear;
      if (fear) { fear.left = Math.round(fear.left * ST.radio.calmMult); log('사람 목소리를 들으니 떨림이 조금 가라앉았다.', 'good'); }
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
    if (!Object.keys(found).length) log(pick(D.emptyLines));
    else stow(found, { type: 'search' });
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
      if (chance(encChance(G.loc))) { startCombat(pickEnemy(L.danger), { ...ctx, completeOnWin: true }); return; }
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
      if (chance(encChance(G.loc) * CB.restMult)) { startCombat(pickEnemy(L.danger), ctx); return; }
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
      const radio = nextFragmentAt('radio');
      if (radio && chance(ST.radioChance)) {
        log('잠들기 전 라디오 주파수를 돌리다가, 잡음 사이로 목소리를 붙잡았다.', 'story');
        foundFragment(radio);
      }
      maybeEvent('sleep', { type: 'sleep', danger: 0 }, C.eventChance.sleep);
    });
  }

  // ---------- 전투 ----------
  function pickEnemy(danger) {
    const e = weightedPick(Object.keys(ENEMIES).map((id) => ({ id, w: (ENEMIES[id].weight[danger] || 0) * (id === 'raider' && qflag('black_dogs_gone') ? 0.3 : 1) })));
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
    G.pending = { kind: 'combat', enemy: enemyId, canFlee, note, text, ctx, penalty: 0, winLoot: opts.winLoot || 0, bonus: opts.bonus || 0, bonusLabel: opts.bonusLabel || '' };
    gainXp('resolve', SK.xp.encounter + Math.round((E.fear || 0) * 10));
  }

  function weaponBonus(w) {
    if (!w) return { label: '맨손', value: 0 };
    const it = ITEMS[w];
    if (it.ammo && !(P().inv[it.ammo] > 0)) return { label: `${it.name} (탄약 없음)`, value: it.noAmmoAtk || 0 };
    return { label: it.name, value: it.atk };
  }
  function combatDanger(pd) { return pd.ctx && pd.ctx.danger != null ? pd.ctx.danger : dangerOf(G.loc); }
  // 들고 있는 무기 중 가장 유리한 것 (무기가 없으면 맨손)
  function bestWeapon(pd) {
    const ids = weaponIds();
    if (!ids.length) return null;
    const odds = ids.map((id) => [id, oddsWith(pd, id).total]);
    const top = Math.max(...odds.map(([, o]) => o));
    // 탄약을 안 쓰는 무기가 거의 같으면(상한에 걸린 경우 포함) 그 무기를 먼저 고른다
    const free = odds.filter(([id]) => isMelee(id)).sort((a, b) => b[1] - a[1])[0];
    if (free && free[1] >= top - CB.ammoSaveMargin) return free[0];
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
    if (isMelee(weapon) && lvl('strength') > 0) rows.push([`힘 LV ${lvl('strength')}`, lvl('strength') * SL.strength.meleePerLv]);
    if (!isMelee(weapon)) {
      const aim = Math.round(lvl('focus') * SL.focus.gunPerLv);
      if (aim > 0) rows.push([`집중력 LV ${lvl('focus')} (사격)`, aim]);
      // 4. 상대에 따라 잘 듣는 총 (산탄총: 무리·변이 감염자)
      const vs = ITEMS[weapon].vs && ITEMS[weapon].vs[pd.enemy];
      if (vs) rows.push([`${ITEMS[weapon].name} · ${E.name} 상대`, vs]);
    }
    for (const id of Object.keys(p.buffs)) if (BUFFS[id].win) rows.push([BUFFS[id].name, BUFFS[id].win]);
    if (pd.bonus) rows.push([pd.bonusLabel || '도움', pd.bonus]);
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
    if (thickOver()) rows.push([`껴입음 (두께 ${thickness()})`, -thickOver() * EQ.perWin]);
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
    v -= thickOver() * EQ.perFlee;
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

  function fight(wid) {
    const pd = G && G.pending;
    if (!pd || pd.kind !== 'combat') return;
    const weapon = wid && weaponIds().includes(wid) ? wid : bestWeapon(pd);
    run(() => {
      const E = ENEMIES[pd.enemy], p = P(), ctx = pd.ctx;
      const odds = oddsWith(pd, weapon).total; // 버튼에 보인 확률 그대로 쓴다
      const melee = isMelee(weapon);
      G.pending = null;
      const w = weapon ? ITEMS[weapon] : null;
      let ammoNote = '';
      if (w && w.ammo && p.inv[w.ammo] > 0) {
        const n = Math.min(p.inv[w.ammo], randInt(w.ammoUse[0], w.ammoUse[1]));
        addTo(p.inv, w.ammo, -n);
        ammoNote = ` (${ITEMS[w.ammo].name} ${n}발 사용)`;
      }
      p.stamina = clamp(p.stamina - CB.fightStamina, 0, maxStamina());
      passTime(CB.fightMinutes, 'fight');
      if (G.dead) return;
      const def = armorDef(), dbf = armorDbf();
      const cause = `${E.name}에게 당해 쓰러졌다`;
      gainXp('endurance', SK.xp.fight);
      const won = Math.random() * 100 < odds;
      if (melee) gainXp('strength', won ? SK.xp.meleeWin : SK.xp.meleeLose);
      else gainXp('focus', won ? SK.xp.gunWin : SK.xp.gunLose);
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
      if (ctx.bond && ctx.choice != null) {
        const ch = BOND[ctx.bond].steps[ctx.step].choices[ctx.choice];
        const o = won ? ch.outcome.win : ch.outcome.lose;
        if (o) applyOutcome(o, ctx, EVENTS[`q:${ctx.bond}:${ctx.step}`]);
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
      p.stamina = clamp(p.stamina - CB.fleeStamina, 0, maxStamina());
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
  const choiceOk = (ch) => (!ch.requires || ch.requires.every(hasItem)) && (!ch.need || ch.need.every(([k, n]) => needCount(k) >= n));
  // '@그룹'은 그룹 안의 아무 물건이나 (소지품만 센다)
  const needIds = (k) => (k[0] === '@' ? BGROUP[k.slice(1)].ids : [k]);
  const needName = (k) => (k[0] === '@' ? BGROUP[k.slice(1)].name : ITEMS[k].name);
  const needCount = (k) => needIds(k).reduce((a, id) => a + (P().inv[id] || 0), 0);
  function giveNeed(need) {
    for (const [k, n] of need) {
      let left = n;
      for (const id of needIds(k)) {
        const q = Math.min(left, P().inv[id] || 0);
        if (q > 0) { addTo(P().inv, id, -q); left -= q; }
        if (left <= 0) break;
      }
    }
  }
  const qflag = (name) => !!(G && G.flags[`q:${name}`]);
  function setQFlag(name) { if (!G.flags[`q:${name}`]) G.flags[`q:${name}`] = dayOf(G.time); }
  const choiceShown = (ch) => (!ch.if || qflag(ch.if)) && (!ch.unless || !qflag(ch.unless))
    && (!ch.ifFrag || G.fragments.includes(ch.ifFrag)) && (!ch.ifHeard || ch.ifHeard.some((k) => G.radioHeard.includes(k)));

  function chooseEvent(i) {
    const pd = G && G.pending;
    if (!pd || pd.kind !== 'event') return;
    const ev = EVENTS[pd.id];
    const idx = +i;
    if (ev.trade) {
      if (idx === 0 && !canAfford(D.trades[pd.offer].give)) return toast('바꿀 물건이 부족하다.');
    } else if (!ev.choices[idx] || !choiceShown(ev.choices[idx]) || !choiceOk(ev.choices[idx])) {
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
      startCombat(id, ctx, { intro: o.log, canFlee: o.canFlee, winLoot: o.winLoot, bonus: o.bonus, bonusLabel: o.bonusLabel });
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
      const found = rollFinds(lootPool(ctx), ctx.danger || 0, o.loot);
      if (Object.keys(found).length) stow(found, ctx);
      else log(pick(D.emptyLines));
    }
    if (o.flag) setQFlag(o.flag);
    if (o.flagBefore) setQFlag(dayOf(G.time) < o.flagBefore.day ? o.flagBefore.before : o.flagBefore.after);
    if (o.xp) gainXp(o.xp[0], o.xp[1]);
    if (o.cache && ctx.bond) addCache(`q:${ctx.bond}`, o.cache);
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
      const p = P(), base = it.use || {};
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
      log(`${eul(it.name)} ${USE_VERB[it.cat]}.${fx ? ` (${fx})` : ''}`);
      if (it.buff) {
        const [bid, mins] = it.buff;
        const left = Math.round(mins * m);
        p.buffs[bid] = { left: Math.max(left, p.buffs[bid] ? p.buffs[bid].left : 0) };
        log(`${BUFFS[bid].name} ${fmtDur(left)}: ${BUFFS[bid].desc}`, 'good');
      }
      if (eat) gainXp('metabolism', (Math.max(0, -(base.hunger || 0)) + Math.max(0, -(base.thirst || 0))) * SK.xp.eat);
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
      let old = null;
      if (it.cat === 'bag') { old = p.bag; p.bag = id; }
      else if (it.cat === 'weapon' && sizeOf(id) === 'small') { old = p.weaponS; p.weaponS = id; }
      else {
        const list = it.cat === 'armor' ? p.armors : p.weaponsL;
        if (replaceAt >= 0) { old = list[replaceAt]; list[replaceAt] = id; } else list.push(id);
      }
      if (old) addTo(src, old, 1);
      if (it.cat === 'bag') toast(`${eul(it.name)} 멨다. 중량 한계 ${fmtKg(carryLimit())}kg`);
      else if (it.cat === 'armor') {
        if (thickOver() > overBefore) layered = replaceAt >= 0 ? replaceAt : p.armors.length - 1;
        else if (p.armors.length >= 2) toast(`${eul(it.name)} 겹쳐 입었다. 옷 ${p.armors.length}겹 · 받는 피해 -${pct(armorDef())}%${thickOver() ? ' · 껴입어서 둔하다' : ''}`);
        else toast(`${eul(it.name)} 입었다. 받는 피해 -${pct(armorDef())}%`);
      } else toast(`${eul(it.name)} 들었다.`);
    });
    if (layered >= 0) showLayered(id, layered);
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
  };
  function slotChoices(kind) {
    const out = [], seen = new Set();
    const srcs = [['inv', P().inv], ...(G.loc === 'hideout' ? [['stash', G.stash]] : [])];
    for (const [from, m] of srcs) {
      for (const id of Object.keys(m)) {
        if (m[id] > 0 && !seen.has(id) && SLOT_FIT[kind](ITEMS[id])) { seen.add(id); out.push({ id, from }); }
      }
    }
    const power = (it) => it.atk || it.def || it.bag || 0;
    return out.sort((a, b) => power(ITEMS[b.id]) - power(ITEMS[a.id]));
  }
  function choiceLabel({ id, from }) {
    const it = ITEMS[id];
    const stat = it.cat === 'weapon' ? `승률 +${it.atk}%${ammoText(id)}` : it.cat === 'armor' ? `피해 -${pct(it.def)}% · 두께 ${it.thick || 1}` : `+${it.bag}kg`;
    return `${it.name} · ${stat} · ${fmtKg(it.w)}kg${from === 'stash' ? ' · 창고' : ''}`;
  }
  function pickSlot(kind, idx) {
    if (!G || !SLOT_FIT[kind]) return;
    if (G.pending) return toast('눈앞의 상황부터 해결해야 한다.');
    const list = slotChoices(kind);
    if (!list.length) return toast(G.loc === 'hideout' ? '소지품에도 창고에도 넣을 만한 게 없다.' : '소지품에 넣을 만한 게 없다.');
    const p = P();
    const cur = kind === 'L' ? p.weaponsL[idx] : kind === 'A' ? p.armors[idx] : kind === 'S' ? p.weaponS : p.bag;
    const replaceAt = (kind === 'L' || kind === 'A') && cur ? idx : -1;
    const title = { L: `큰 무기 ${idx + 1}칸에 무엇을 들까?`, S: '작은 무기 칸에 무엇을 들까?', A: `${idx + 1}겹째에 무엇을 입을까?`, bag: '어떤 가방을 멜까?' }[kind];
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
    if (!id) return;
    mutate(() => {
      if (kind === 'L') p.weaponsL.splice(idx, 1);
      else if (kind === 'A') p.armors.splice(idx, 1);
      else if (kind === 'S') p.weaponS = null;
      else p.bag = null;
      if (G.loc === 'hideout' && stashFit(id, 1) === 1) addTo(G.stash, id, 1);
      else addTo(P().inv, id, 1);
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
      ],
      buttons: [{ label: '그만둔다' }, { label: '깊은 잠에 빠진다', danger: true, onClick: deepSleep }],
    });
  }
  function deepSleep() {
    if (!G || G.dead || G.pending) return;
    const old = G;
    G = newState();
    for (const id of FAC_ORDER) G.hideout.fac[id] = Math.min(old.hideout.fac[id] || 0, DS.facLevel);
    for (const k of SKILL_KEYS) G.skills[k] = { lv: Math.max(0, old.skills[k].lv - DS.skillLoss), xp: 0, today: 0 };
    G.player.hp = maxHp();
    G.player.stamina = maxStamina();
    G.stats.deepSleeps = (old.stats.deepSleeps || 0) + 1;
    DS.wake.forEach((t) => log(t, 'story'));
    log(`깊은 잠에서 깨어났다. 오늘이 첫날이다. (시설 ${DS.facLevel}레벨, 스킬 -${DS.skillLoss}만 남았다)`, 'story');
    ui.tab = 'scene';
    ui.menuView = null;
    ui.recordView = 'people';
    persist();
    render();
    window.scrollTo(0, 0);
    showModal({ title: DS.title, body: DS.wake, buttons: [{ label: DS.button, primary: true }] });
  }

  // ---------- 죽음: 쓰러진 뒤에 고른다 ----------
  const carriedCount = () => Object.values(P().inv).reduce((a, b) => a + b, 0) + equippedIds().length;

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
        ['악몽에서 깨어나기', lost ? `지니고 있던 물건 ${lost}개를 모두 잃고 다음 날 아침 거점에서 깨어난다. 거점과 창고는 남는다.` : '다음 날 아침 거점에서 깨어난다. 거점과 창고는 남는다.'],
        ['운명을 받아들이기', '생존 기록을 여기서 끝낸다. 세이브가 삭제된다.'],
      ],
      buttons: [
        { label: '운명을 받아들이기', onClick: confirmFate },
        { label: '악몽에서 깨어나기', primary: true, onClick: wakeFromNightmare },
      ],
    });
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
    p.inv = {};
    p.weaponsL = [];
    p.weaponS = null;
    p.armors = [];
    p.bag = null;
    p.debuffs = {};
    p.buffs = {};
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
    if (it.cat === 'weapon') meta += ` · ${(it.size || 'large') === 'small' ? '작은' : '큰'} 무기 · 승률 +${it.atk}%${it.vs ? ` (${Object.entries(it.vs).map(([e, v]) => `${ENEMIES[e].name} +${v}%`).join(', ')})` : ''}${it.ammo ? ` · ${ITEMS[it.ammo].name} 필요` : ''}`;
    else if (it.cat === 'armor') meta += ` · 받는 피해 -${pct(it.def)}% · 디버프 확률 -${pct(it.dbf)}% · 두께 ${it.thick || 1}`;
    else if (it.cat === 'ammo') meta += ` · ${it.desc}`;
    else if (it.bag) meta += ` · 중량 한계 +${it.bag}kg`;
    else if (isUsable(it)) meta += ' · ' + [it.use && useText(it), it.treat && treatText(it.treat), it.buff && `${BUFFS[it.buff[0]].name} ${fmtDur(it.buff[1])}`].filter(Boolean).join(' · ');
    else if (it.cat === 'material') meta += ' · 시설 재료';
    else if (it.cat === 'junk') meta += ` · 잡동사니 · 해체하면 ${it.salvage.map(([m]) => ITEMS[m].name).join(', ')}`;
    return meta;
  }
  function itemRow(id, qty, buttons, metaOverride) {
    const it = ITEMS[id];
    const risks = itemRisks(it);
    return `<li class="item${risks.length ? ' risky' : ''}" title="${esc(it.desc || '')}">
      <div class="item-main">
        <div class="item-name"><span class="rdot r${it.r}"></span><span class="rname r${it.r}">${esc(it.name)}</span><span class="qty">×${qty}</span>${risks.length ? '<span class="chip bad">위험</span>' : ''}</div>
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
      ${debuffs.length || buffIds.length || thickOver() ? `<div class="debuffs" aria-label="몸 상태">${thickOver() ? `<span class="chip warn">껴입음 두께 ${thickness()}</span>` : ''}${buffIds.map((id) => `<span class="chip ok">${esc(BUFFS[id].name)} ${fmtLeft(p.buffs[id].left)}</span>`).join('')}${debuffs.map((k) => `<span class="chip bad">${esc(debuffShort(k))}</span>`).join('')}</div>` : ''}
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
      const it = ITEMS[id];
      const fx = useText(it) + (it.buff ? ` · ${BUFFS[it.buff[0]].name} ${fmtDur(it.buff[1])}` : '');
      const where = includeStash ? `창고 ${inS} · 소지품 ${inI} · ${fx}` : fx;
      const cookBtn = it.cook && includeStash ? btn(cookVerb(it)[0], 'cook', id, '', 'primary') : '';
      return itemRow(id, inS + inI, cookBtn + btn(USE_LABEL[it.cat], 'use', id, from, isRisky(it) ? 'danger' : ''), where);
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
  // 감염 n%: 하루에 최대 HP의 n%를 잃는다. 감염이 퍼질수록 점점 늘어난다
  const infectionHpPerDay = (sev) => maxHp() * (sev / 100) * DB.infection.dailyHpMult;
  function debuffEffect(k) {
    const d = P().debuffs[k], c = DB[k];
    if (k === 'bleed') return `시간당 HP -${c.hpPerHour} · 방치하면 감염 위험 · ${fmtLeft(d.left)} 뒤 멎음`;
    if (k === 'infection') {
      return `하루 HP -${Math.round(infectionHpPerDay(d.sev))} (최대 HP의 ${Math.round(d.sev * c.dailyHpMult)}%) · 시간당 +${c.growPerHour}%씩 퍼진다${d.sev >= c.winAt ? ` · 승률 ${c.win}%` : ''}`;
    }
    if (k === 'fracture') return `행동시간 ×${c.timeMult} · 승률 ${c.win}% · 도망 ${c.flee}% · ${fmtLeft(d.left)} 뒤 회복`;
    if (k === 'fear') return `승률 ${c.win}% · 수색시간 ×${c.searchMult} · ${fmtLeft(d.left)} 남음 (쉬거나 자면 빨리 사라짐)`;
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
      const b = cure && !G.pending ? btn(`${ITEMS[cure.id].name} 쓰기`, 'use', cure.id, cure.where, 'primary') : `<span class="note">치료: ${esc(cureNames)}${cure ? '' : ' (없음)'}</span>`;
      return `<li class="item"><div class="item-main"><div class="item-name"><span class="rdot bad-dot"></span><span class="bad-text">${esc(debuffShort(k))}</span></div><div class="item-meta">${esc(debuffEffect(k))}</div></div><div class="item-btns">${b}</div></li>`;
    }).join('');
    return `<section class="section"><div class="section-head"><h2>몸 상태</h2></div><ul class="items">${buffRows}${rows}</ul></section>`;
  }

  function scrollToEncounter() {
    const el = document.getElementById('encounter');
    const hud = document.getElementById('hud');
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY - (hud ? hud.offsetHeight : 0) - 12;
    window.scrollTo(0, Math.max(0, top));
  }
  const ammoText = (w) => (w && ITEMS[w].ammo ? ` · ${ITEMS[ITEMS[w].ammo].name} ${P().inv[ITEMS[w].ammo] || 0}발` : '');
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
        return actBtn(w ? `싸운다 · ${ITEMS[w].name}` : '싸운다 · 맨손', `이길 확률 ${o}%${ammoText(w)}`, 'fight', w || '', w === best ? 'primary' : '');
      }).join('');
      return `<section class="encounter" id="encounter">
        <div class="enc-head"><span class="enc-kicker">조우</span>${dangerChip(combatDanger(pd))}</div>
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
      const shown = ev.choices.map((ch, i) => [ch, i]).filter(([ch]) => choiceShown(ch));
      const first = shown.find(([ch]) => choiceOk(ch));
      buttons = shown.map(([ch, i]) => {
        const ok = choiceOk(ch);
        let sub = ch.sub || '';
        if (ch.outcome && ch.outcome.sneak != null) sub = sub.replace('{sneak}', sneakOdds(ch.outcome.sneak));
        if (ch.need) sub = `${sub} · 가진 것 ${ch.need.map(([k, n]) => `${needName(k)} ${needCount(k)}/${n}`).join(', ')}`;
        return actBtn(ch.label, ok ? sub : `${sub} · 부족하다`, 'choose', String(i), first && first[1] === i ? 'primary' : '', !ok);
      }).join('');
    }
    return `<section class="encounter event" id="encounter">
      <div class="enc-head"><span class="enc-kicker">${ev.bond ? '인연' : '사건'}</span></div>
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
      <div class="place-facts"><span>수색 구역 <b>${st.spots}/${L.spots}</b></span><span>수색 중 조우 <b>${pct(encChance(G.loc))}%</b></span><span>거점까지 <b>${fmtDur(travelMinutes('hideout'))}</b></span>${fragmentHint(G.loc)}</div>
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
  const craftBtnLabel = (R, n) => `만들기 · ${fmtDur(craftMinutes(R, n))}`;
  function recipeCosts(R, n) {
    if (!R.fuel) return costChips(timesIn(R.in, n));
    if (elecFuel(R)) return `${costChips(timesIn(recipeIn(R), n))}<span class="cost ok">전기 사용 · ${esc(ITEMS[R.fuel].name)} 필요 없음</span>`;
    return `${costChips(timesIn(R.in, n))}<span class="note">발전기를 켜 두면 ${esc(ITEMS[R.fuel].name)} 없이 만든다</span>`;
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
        <div class="item-name"><span class="rdot r${out.r}"></span><span class="rname r${out.r}">${esc(out.name)}</span><span class="qty">×${R.out[1]}</span>${R.power ? '<span class="chip warn">전력</span>' : ''}</div>
        <div class="costs" id="costs-${R.id}">${locked ? `<span class="note">LV ${R.lv}에서 열린다</span>` : recipeCosts(R, n)}</div>
        ${locked ? '' : `<div class="qty-ctl">${slider}<span class="qty-label" id="qtyl-${R.id}">${esc(qtyLabel(R, n, max))}</span></div>`}
      </div>
      <div class="item-btns">${locked ? '' : `<button type="button" class="btn ${why ? '' : 'primary'}" id="craftbtn-${R.id}" data-act="craft" data-a="${R.id}"${why ? ' disabled' : ''}>${esc(craftBtnLabel(R, n))}</button>`}</div>
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
    if (costs) costs.innerHTML = recipeCosts(R, n);
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
        status += `<p class="note warn-text">만드는 중: ${esc(ITEMS[R.out[0]].name)} ×${R.out[1] * (c.count || 1)}${(c.count || 1) > 1 ? ` (${c.count}번)` : ''} · ${fmtLeft(c.left)} 남음${(R.power || c.elec) && !isPowered() ? ' (전력이 없어 멈춤)' : ''}</p>`;
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
  const facReady = (fid) => !!(G.hideout.ready[fid] || (fid === 'water' && G.hideout.water.stored));
  function renderFacilities() {
    const H = G.hideout, home = G.loc === 'hideout';
    const build = H.build ? `공사 중: ${FAC[H.build.id].name} LV ${H.build.to} · ${fmtLeft(H.build.left)} 남음` : '진행 중인 공사 없음';
    const cur = FAC[ui.facView] ? ui.facView : FAC_ORDER[0];
    const tabs = subTabs('facView', '시설 고르기', FAC_ORDER.map((fid) => {
      const state = facReady(fid) ? ['받을 것 있음', 'ok-text'] : H.build && H.build.id === fid ? ['공사 중', 'warn-text'] : H.crafts[fid] ? ['만드는 중', 'warn-text'] : null;
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
      const btns = (hasInv ? btn(`가진 것 전부 숨기기 · ${fmtDur(hideTime(h))}`, 'hideAll', String(i)) : '') + (ids.length > 1 ? btn(`모두 꺼내기 · ${fmtDur(retrieveTime(h))}`, 'unhide', String(i), 'all') : '');
      return `<li class="hide-spot${ids.length ? ' filled' : ''}">
        <div class="hs-head"><span class="hs-name">${esc(names[i])}</span>${risk}</div>
        <div class="note">숨기기 ${fmtDur(hideTime(h))} · 꺼내기 ${fmtDur(retrieveTime(h))}</div>
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
    if (ui.recordView === 'bonds') {
      body = `<ul class="frags bonds">${BONDS.map((b) => {
        const st = G.bonds[b.id];
        if (!st) return `<li class="frag locked"><span class="frag-title">아직 모르는 사람</span><span class="note">${esc(THREAD[b.th].name)}의 기록을 모으거나 라디오를 듣다 보면 알게 된다</span></li>`;
        const step = bondStep(b);
        const past = b.steps.slice(0, st.done ? b.steps.length : st.step).map((x) => x.title).join(' → ');
        return `<li class="frag bond"><div class="bond-head"><span class="frag-title">${esc(b.who)}</span>${st.done ? '<span class="chip ok">도움 완료</span>' : '<span class="chip warn">진행 중</span>'}</div>
          ${st.done ? `<p class="frag-text">${esc(b.done)}</p>` : `<p class="bond-next"><b>다음:</b> ${esc(step.hint)} <span class="note">(${esc(bondWhere(step))})</span></p>`}
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
      <div class="row-btns seg" role="group" aria-label="보기 방식">${btn('인물별', 'recordView', 'people', '', ui.recordView === 'people' ? 'primary' : '')}${btn('시간순', 'recordView', 'time', '', ui.recordView === 'time' ? 'primary' : '')}${btn(`인연 ${BONDS.filter((b) => G.bonds[b.id] && G.bonds[b.id].done).length}/${BONDS.length}`, 'recordView', 'bonds', '', ui.recordView === 'bonds' ? 'primary' : '')}</div>
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
    const tabs = subTabs('skillView', '스킬 고르기', SKILL_KEYS.map((k) => ({ id: k, name: SL[k].name, sub: `LV ${G.skills[k].lv}`, bar: skillFill(k) })), cur);
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
        <p class="note">${esc(c.train)}</p>
      </li>`;
    }).join('');
    return `<section class="section">
      <div class="section-head"><h2>스킬</h2><span class="meta">행동할수록 오른다 · 최대 LV ${SK.max}</span></div>
      ${tabs}
      <ul class="skills">${rows}</ul>
      <p class="note">같은 날 한 스킬을 많이 단련할수록 효율이 떨어지고, 날이 바뀌면 회복된다. 쓰러졌다가 깨어나도 스킬은 그대로 남는다.</p>
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
          ${actBtn(ui.showHides ? '숨길 곳 닫기' : '숨기기', hiddenKinds(G.loc) ? `숨겨 둔 물건 ${hiddenKinds(G.loc)}종` : '숨길 곳 5곳 보기', 'toggleHides', '', ui.showHides ? 'on' : '')}
          ${G.caches.filter((c) => c.loc === G.loc).map((c) => actBtn('메모에 적힌 곳 뒤지기', `${c.place} · ${fmtDur(ST.cacheMinutes)}`, 'openCache', c.id, 'on')).join('')}
          ${bondBtns()}
          ${G.loc === 'mart' && qflag('clinic') ? actBtn('진료소 · 이서윤', G.flags.clinicDay === dayOf(G.time) ? '오늘은 이미 치료받았다' : '무료 치료 · 1시간', 'clinic', '', '', G.flags.clinicDay === dayOf(G.time)) : ''}
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
    if (isUsable(it)) b += btn(USE_LABEL[it.cat], 'use', id, from, isRisky(it) ? 'danger' : 'primary');
    if (EQ_CATS.includes(it.cat)) b += btn(EQUIP_LABEL[it.cat], 'equip', id, from, 'primary');
    if (it.salvage) b += btn('해체', 'dismantle', id, from);
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
  function equipRow(label, id, kind, idx, empty) {
    const it = id ? ITEMS[id] : null;
    let what;
    if (!it) what = `<span class="note">${empty}</span>`;
    else if (it.cat === 'weapon') what = `${esc(it.name)} <span class="note">(승률 +${it.atk}%${esc(ammoText(id))} · ${fmtKg(it.w)}kg)</span>`;
    else if (it.cat === 'armor') what = `${esc(it.name)} <span class="note">(피해 -${pct(it.def)}% · 디버프 -${pct(it.dbf)}% · 두께 ${it.thick || 1} · ${fmtKg(it.w)}kg)</span>`;
    else what = `${esc(it.name)} <span class="note">(+${it.bag}kg · ${fmtKg(it.w)}kg)</span>`;
    const none = !slotChoices(kind).length;
    const pick = btn(it ? '바꾸기' : '착용', 'pickSlot', kind, String(idx), it ? '' : 'primary', none);
    return `<div class="equip-row"><span class="slot">${esc(label)}</span><span class="what">${what}</span><span class="equip-btns">${pick}${it ? btn(it.cat === 'weapon' ? '해제' : '벗기', 'unequip', kind, String(idx)) : ''}</span></div>`;
  }
  // 겹쳐 입었을 때만 합계를 보여 주고, 둔해졌을 때만 무엇이 나빠지는지 보여 준다
  function layerSummary() {
    if (P().armors.length < 2) return '';
    const over = thickOver();
    const pen = over ? ` · 껴입어서 둔하다 → 행동시간 +${Math.round(over * EQ.perTime * 100)}% · 스테미너 소모 +${Math.round(over * EQ.perStamina * 100)}% · 승률 -${over * EQ.perWin}% · 도망 -${over * EQ.perFlee}%` : '';
    return `<p class="note${over ? ' warn-text' : ''}">옷 ${P().armors.length}겹: 받는 피해 -${pct(armorDef())}% · 디버프 확률 -${pct(armorDbf())}% · 두께 ${thickness()}${pen}</p>`;
  }
  function equipSection() {
    const p = P();
    const rows = [];
    for (let i = 0; i < EQ.large; i++) rows.push(equipRow(`큰 무기 ${i + 1}`, p.weaponsL[i], 'L', i, '비어 있다. 방망이, 도끼, 산탄총 같은 큰 무기'));
    rows.push(equipRow('작은 무기', p.weaponS, 'S', 0, '비어 있다. 칼, 마체테, 권총 같은 작은 무기'));
    for (let i = 0; i < EQ.layers; i++) rows.push(equipRow(`옷 ${i + 1}겹`, p.armors[i], 'A', i, i ? '비어 있다. 위에 겹쳐 입을 수 있다' : '비어 있다. 옷을 입으면 지더라도 덜 다친다'));
    rows.push(equipRow('가방', p.bag, 'bag', 0, '없다. 가방이 있으면 더 많이 들 수 있다'));
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
        const k = ITEMS[id].w > 0 ? clamp(Math.floor((room + 1e-6) / ITEMS[id].w), 0, G.stash[id]) : G.stash[id];
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
    ['weapon', '무기·탄약', ['weapon', 'ammo']], ['wear', '옷·가방', ['armor', 'bag']], ['material', '재료·잡동사니', ['material', 'junk']],
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
    return {
      all, ids: all.filter((id) => inStashCat(id, cur)),
      chips: all.length ? `<div class="fchips" role="tablist" aria-label="${esc(label)}">${chips}</div>` : '',
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
      { id: 'inv', name: '소지품', sub: `${invIds.length}종 · ${fmtKg(mapWeight(p.inv))}kg` },
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
        </section>`;
    } else {
      const c = catChips(p.inv, 'invCat', ui.invCat, '소지품 종류');
      body = `
      <section class="section">
        <div class="section-head"><h2>소지품</h2><span class="meta">${invIds.length}종 · ${fmtKg(mapWeight(p.inv))}kg</span>${atHome && invIds.length ? btn('전부 창고에 넣기', 'storeAll', '', '', 'primary') : ''}</div>
        ${atHome ? packSection() : ''}
        ${c.chips}
        ${c.ids.length ? `<ul class="items">${c.ids.map((id) => itemRow(id, p.inv[id], invButtons(id, p.inv[id], 'inv'))).join('')}</ul>`
          : `<p class="empty">${invIds.length ? esc(c.none('소지품')) : '들고 있는 물건이 없다.'}</p>`}
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
        const enc = `조우 ${pct(encChance(id))}%`;
        const hk = hiddenKinds(id);
        const cn = G.caches.filter((c) => c.loc === id).length;
        const bn = BONDS.filter((b) => { const st = bondStep(b); return st && st.loc === id; }).map((b) => b.who);
        const hid = (hk ? ` · 숨겨 둔 물건 ${hk}종` : '') + (cn ? ` · 메모에 적힌 곳 ${cn}` : '') + (bn.length ? ` · 인연: ${bn.join(', ')}` : '');
        meta = here ? `지금 여기 있다 · ${spots} · ${enc}${hid}` : `${eta} · ${spots} · ${enc}${hid}`;
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
          ${G.stats.deepSleeps ? `<dt>깊은 잠</dt><dd>${G.stats.deepSleeps}회</dd>` : ''}
        </dl>
      </section>
      <section class="section">
        <div class="section-head"><h2>깊은 잠</h2></div>
        <p class="note">DAY 1부터 다시 시작한다. 지어 둔 시설은 ${DS.facLevel}레벨로, 스킬은 -${DS.skillLoss}로 남고, 나머지(물건, 창고, 기록, 인연, 라디오, 숨겨 둔 물건)는 모두 처음으로 돌아간다.</p>
        <div class="row-btns">${btn('깊은 잠에 빠진다', 'deepSleep', '', '', 'danger', !!G.pending)}</div>
      </section>
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
          <li><b>거점 시설</b>: 재료를 모아 발전기·작업대·창고·침대·의무실·조리대·정수기·체육관·방어벽을 짓고 올린다(각 ${FAC.workbench.levels.length}레벨). 높은 레벨에서는 새 제작법이 열리고, 시설에서 만드는 시간이 줄고, 태양광·감염 치료 같은 효과가 붙는다. 공사와 제작은 시간이 걸리지만 자리를 비워도 진행된다. 정수기와 일부 제작에는 발전기 전력이 필요하다.</li>
          <li><b>숨기기</b>: 바깥에서는 장소마다 있는 숨길 곳 5곳에 물건을 숨겨 둘 수 있다. 곳마다 숨기는 시간과 털릴 확률(하루 단위)이 다르고, 털릴 확률은 실제로 털려 봐야 알 수 있다. 털린 건 그 장소에 다시 가야 알게 된다. 숨긴 물건은 쓰러져도 남는다.</li>
          <li><b>라디오</b>: 거점에서 라디오를 들을 수 있다(${fmtDur(ST.radio.minutes)}). 채널마다 날이 갈수록 방송이 바뀌고, 끊기기도 하고, 다시 살아나기도 한다. 듣지 못하고 지나간 방송은 나중에 켤 때 '지난 방송'으로 무작위로 다시 나온다. 들으면 공포가 조금 가라앉는다.</li>
          <li><b>메모에 적힌 곳</b>: 낙서된 지도나 쪽지를 찾으면 적힌 장소에 가서 숨겨진 물건을 찾을 수 있다. 지도와 그 장소의 현장 화면에 표시된다.</li>
          <li><b>인연</b>: 기록을 모으거나 라디오를 듣다 보면 기록 속 사람들이 어디 있는지 알게 된다. 그 장소에 가면 만나서 돕거나 구할 수 있다. 시간이 정해진 만남도 있다. 도운 일은 라디오에 소식으로 나오고, 저마다 보답이 있다. '기록' 탭의 '인연'에서 진행 상황을 볼 수 있다.</li>
          <li><b>기록</b>: 장소를 수색하다 보면 사람들이 남긴 메모를 찾는다. 같은 사람의 메모를 모으면 일상부터 지금까지 한 사람의 이야기가 이어진다. '기록' 탭에서 인물별로, 또는 시간순으로 읽을 수 있다.</li>
          <li><b>위험한 아이템</b>: 식중독 확률이 ${pct(C.riskPoisonAt)}% 이상이거나 반동이 있는 아이템은 빨간색으로 표시되고, 쓰기 전에 한 번 더 묻는다. 날고기·눅눅한 빵·빗물은 거점에서 목재 1개로 익히거나 끓이면 안전해진다(조리대가 있으면 두 배 빠르다). 발전기가 켜져 있으면 전기로 해서 목재가 필요 없다(조리대의 굽기·끓이기도 마찬가지).</li>
          <li><b>음식 효과</b>: 고기 스튜(든든함), 구운 고기(기운), 전투식량(군용 보급), 초콜릿·탄산음료(당 충전), 에너지 드링크(각성)는 먹으면 일정 시간 버프가 붙는다. 신진대사가 오르면 음식 효과와 버프 시간이 늘어난다.</li>
          <li><b>스킬</b>: 힘·지구력·체력·집중력·스트레스 저항력·신진대사·지능은 관련된 행동을 할수록 오른다(최대 LV ${SK.max}). '스킬' 탭에서 효과와 올리는 법을 볼 수 있다.</li>
          <li><b>장비</b>: 큰 무기 ${EQ.large}개와 작은 무기 ${EQ.small}개를 들 수 있고, 싸울 때 그중 하나를 고른다. 총은 탄약이 있어야 제값을 한다. 근접 무기는 힘, 총은 집중력이 오를수록 강해진다. 산탄총은 감염자 무리와 변이 감염자에게 더 잘 듣는다. 탄약을 안 쓰는 무기로도 거의 똑같이 이길 수 있으면 그 무기가 먼저 골라진다. 옷은 ${EQ.layers}겹까지 껴입을 수 있다. 겹칠수록 덜 다치지만 너무 껴입으면 몸이 둔해진다(껴입었을 때 무엇이 나빠지는지 알려 준다).</li>
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
        <p class="title-tag">${esc(ST.titleTagline)}</p>
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
  function showModal({ title, body = [], buttons = [{ label: '확인', primary: true }], stack = false }) {
    const m = $('#modal');
    m.innerHTML = `<div class="modal" role="dialog" aria-modal="true" aria-labelledby="m-title">
      <h2 id="m-title">${esc(title)}</h2>
      <div class="m-body">${body.map((t) => (Array.isArray(t) ? `<p><b>${esc(t[0])}</b> ${esc(t[1])}</p>` : t && t.head ? `<div class="m-sec"><span class="m-head">${esc(t.head)}</span><p>${esc(t.text)}</p></div>` : `<p>${esc(t)}</p>`)).join('')}</div>
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
      // 받을 물건이 있으면 그 시설부터 보여 준다
      if (t === 'fac' && G && !facReady(ui.facView)) { const r = FAC_ORDER.find(facReady); if (r) ui.facView = r; }
      if (t === 'skills' && G && G.skillNew) { G.skillNew = false; persist(); }
      if (t === 'records' && G && G.recordNew) { G.recordNew = false; persist(); }
      render();
      window.scrollTo(0, 0);
    },
    prologue: () => showPrologue(),
    recordView: (v) => { ui.recordView = ['time', 'bonds'].includes(v) ? v : 'people'; render(); },
    meet: (id) => meetBond(id),
    clinic: () => clinicVisit(),
    invView: (v) => { ui.invView = v; render(); },
    stashCat: (k) => { ui.stashCat = k; render(); },
    invCat: (k) => { ui.invCat = k; render(); },
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
    retrieve: (id, n) => retrieve(id, n),
    equip: (id, from) => equip(id, from),
    unequip: (kind, idx) => unequip(kind, +idx || 0),
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
    deepSleep: () => askDeepSleep(),
    restart: () => confirmBox('새 게임', '지금 하던 게임을 버리고 새로 시작할까? 저장이 덮어써진다.', '새로 시작', startNew),
  };

  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-act]');
    if (!el || el.disabled) return;
    const fn = ACTIONS[el.dataset.act];
    if (fn) fn(el.dataset.a || '', el.dataset.b || '');
  });
  document.addEventListener('input', (e) => {
    const el = e.target;
    if (el && el.matches && el.matches('[data-qty]')) onQtyInput(el);
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
    foodMult: () => foodMult(),
    checkThefts: () => { checkThefts(); render(); },
    nextFragmentAt: (loc) => { const f = nextFragmentAt(loc); return f ? f.id : null; },
    rollEvent: (on, danger) => { const e = rollEvent(on, danger || 0); return e ? e.id : null; },
    isPowered: () => isPowered(),
    maxHp: () => maxHp(),
    maxStamina: () => maxStamina(),
  };
})();
