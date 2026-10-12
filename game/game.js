// 폐허의 거점 — 게임 로직 (1단계: 이동, 수색, 생존 수치, 중량)
(function () {
  'use strict';

  const D = window.GAME_DATA;
  const C = D.config;
  const ITEMS = D.items;
  const LOCS = D.locations;
  const LOC = Object.fromEntries(LOCS.map((l) => [l.id, l]));
  const SAVE_VERSION = 1;
  const LOCAL_KEY = 'ruin-hideout.save.v1';
  const LOG_MAX = 150;
  const HIDEOUT_DESC = '도시 외곽의 낡은 지하 창고. 철문을 걸어 잠그면 그나마 숨을 돌릴 수 있다.';

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
  const randInt = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmtKg = (w) => (Math.round(w * 10) / 10).toFixed(1);
  const round1 = (v) => Math.round(v);
  function fmtDur(min) {
    min = Math.round(min);
    const h = Math.floor(min / 60), m = min % 60;
    if (!h) return `${m}분`;
    if (!m) return `${h}시간`;
    return `${h}시간 ${m}분`;
  }
  function hasBatchim(word) {
    const ch = String(word).charCodeAt(String(word).length - 1);
    if (ch < 0xac00 || ch > 0xd7a3) return false;
    return (ch - 0xac00) % 28 !== 0;
  }
  const eul = (w) => w + (hasBatchim(w) ? '을' : '를');

  const dayOf = (t) => Math.floor(t / 1440) + 1;
  const hourOf = (t) => Math.floor((t % 1440) / 60);
  const isNight = (t) => { const h = hourOf(t); return h >= C.night.start || h < C.night.end; };
  const clockStr = (t) => {
    const m = ((t % 1440) + 1440) % 1440;
    return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  };

  const CAT_ORDER = { bag: 0, food: 1, drink: 2, med: 3, material: 4 };
  const USE_VERB = { food: '먹었다', drink: '마셨다', med: '사용했다' };
  const USE_LABEL = { food: '먹기', drink: '마시기', med: '사용' };

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
    thirst: '탈수로 쓰러졌다',
    hunger: '굶주림 끝에 쓰러졌다',
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
        inv: { ...D.start.inv }, bag: D.start.bag,
      },
      stash: { ...D.start.stash },
      locs: Object.fromEntries(LOCS.map((l) => [l.id, { spots: l.spots, ground: {}, visited: false }])),
      lastRefillDay: 1,
      log: [],
      recent: [],
      stats: { deaths: 0, searches: 0 },
      dead: false,
      deathCause: null,
    };
  }

  function cleanItems(m) {
    const out = {};
    if (m && typeof m === 'object') for (const id in m) if (ITEMS[id] && m[id] > 0) out[id] = Math.floor(m[id]);
    return out;
  }

  // 예전 세이브나 다음 단계 세이브를 현재 데이터에 맞춘다
  function migrate(s) {
    const fresh = newState();
    const st = { ...fresh, ...s };
    delete st.mode; // 예전 세이브의 "시작할 때 고른 죽음 방식"은 더 이상 쓰지 않는다
    st.player = { ...fresh.player, ...(s.player || {}) };
    st.player.inv = cleanItems(st.player.inv);
    if (st.player.bag && !ITEMS[st.player.bag]) st.player.bag = null;
    st.stash = cleanItems(s.stash);
    st.stats = { ...fresh.stats, ...(s.stats || {}) };
    st.locs = {};
    for (const l of LOCS) {
      const old = (s.locs && s.locs[l.id]) || {};
      st.locs[l.id] = { ...fresh.locs[l.id], ...old, ground: cleanItems(old.ground) };
      st.locs[l.id].spots = clamp(st.locs[l.id].spots, 0, l.spots);
    }
    if (st.loc !== 'hideout' && !LOC[st.loc]) st.loc = 'hideout';
    st.log = Array.isArray(s.log) ? s.log.slice(-LOG_MAX) : [];
    st.recent = Array.isArray(s.recent) ? s.recent : [];
    st.dead = !!s.dead; // 쓰러진 채 저장됐다면 다시 열었을 때 선택지를 띄운다
    st.deathCause = st.dead ? s.deathCause || '쓰러졌다' : null;
    st.v = SAVE_VERSION;
    return st;
  }

  // ---------- 계산 ----------
  const maxHp = () => C.hp.base; // 3단계: 체력 스킬 보너스
  const bagBonus = () => (G.player.bag ? ITEMS[G.player.bag].bag : 0);
  const carryLimit = () => C.baseCarry + bagBonus(); // 3단계: 힘 스킬 보너스
  function mapWeight(m) { let w = 0; for (const id in m) w += ITEMS[id].w * m[id]; return w; }
  const carried = () => mapWeight(G.player.inv) + (G.player.bag ? ITEMS[G.player.bag].w : 0);
  function tierIndex() {
    const r = carried() / carryLimit();
    for (let i = 0; i < C.overweight.length; i++) if (r <= C.overweight[i].upTo + 1e-9) return i;
    return C.overweight.length - 1;
  }
  const tier = () => C.overweight[tierIndex()];
  function timeMult() {
    let m = tier().timeMult;
    if (G.player.stamina <= 0) m *= C.stamina.exhaustedTimeMult;
    if (G.player.fatigue >= C.fatigueSlowAt) m *= C.fatigueTimeMult;
    return m;
  }
  const travelMinutes = (dest) => Math.max(5, Math.round(distMin(G.loc, dest) * timeMult()));
  const searchMinutes = () => Math.round(C.searchMinutes * timeMult());
  const placeName = (id) => (id === 'hideout' ? '거점' : LOC[id].name);

  function addTo(m, id, n) {
    m[id] = (m[id] || 0) + n;
    if (m[id] <= 0) delete m[id];
  }
  function stashSlots(m = G.stash) { let s = 0; for (const id in m) s += Math.ceil(m[id] / ITEMS[id].stack); return s; }
  function stashFit(id, want) {
    const cur = G.stash[id] || 0, stack = ITEMS[id].stack;
    const free = Math.max(0, C.stashSlots - stashSlots());
    const room = Math.ceil(cur / stack) * stack - cur + free * stack;
    return clamp(want, 0, room);
  }
  function carryFit(id, want) {
    const cap = carryLimit() * C.pickupHardCap - carried();
    return clamp(Math.floor((cap + 1e-6) / ITEMS[id].w), 0, want);
  }
  function fxText(u) {
    const parts = [];
    if (u.hp) parts.push(`HP ${u.hp > 0 ? '+' : ''}${u.hp}`);
    if (u.stamina) parts.push(`스테미너 ${u.stamina > 0 ? '+' : ''}${u.stamina}`);
    if (u.hunger) parts.push(`배고픔 ${u.hunger > 0 ? '+' : ''}${u.hunger}`);
    if (u.thirst) parts.push(`갈증 ${u.thirst > 0 ? '+' : ''}${u.thirst}`);
    if (u.fatigue) parts.push(`피로 ${u.fatigue > 0 ? '+' : ''}${u.fatigue}`);
    return parts.join(' · ');
  }
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

  // ---------- 시간 흐름 ----------
  function passTime(minutes, activity) {
    const p = G.player;
    const N = C.needs;
    const before = {
      hunger: needState('hunger', p.hunger), thirst: needState('thirst', p.thirst), fatigue: needState('fatigue', p.fatigue),
      stamina: p.stamina, hp: p.hp,
    };
    const exert = activity === 'travel' || activity === 'search';
    const sleeping = activity === 'sleep';
    const resting = activity === 'rest';
    let left = Math.max(0, Math.round(minutes));
    while (left > 0) {
      const dt = Math.min(10, left);
      left -= dt;
      const h = dt / 60;
      const tr = tier();
      const rate = sleeping ? N.sleepNeedsRate : 1;
      p.hunger = clamp(p.hunger + N.hungerPerHour * rate * h, 0, 100);
      p.thirst = clamp(p.thirst + N.thirstPerHour * rate * h, 0, 100);
      if (sleeping) p.fatigue = clamp(p.fatigue - N.sleepFatigueRecoverPerHour * h, 0, 100);
      else if (resting) p.fatigue = clamp(p.fatigue - N.restFatigueRecoverPerHour * h, 0, 100);
      else p.fatigue = clamp(p.fatigue + N.fatiguePerHour * h, 0, 100);

      const needy = p.hunger >= N.penaltyAt || p.thirst >= N.penaltyAt;
      const recov = needy ? 0.5 : 1;
      if (exert) p.stamina = clamp(p.stamina - C.stamina.exertPerHour * tr.staminaMult * h, 0, C.stamina.max);
      else if (resting) p.stamina = clamp(p.stamina + C.stamina.restPerHour * recov * h, 0, C.stamina.max);
      else if (sleeping) p.stamina = clamp(p.stamina + C.stamina.sleepPerHour * recov * h, 0, C.stamina.max);

      let loss = 0, cause = null;
      if (exert && tr.hpPerHour) { loss += tr.hpPerHour * h; cause = cause || 'weight'; }
      if (p.thirst >= 100) { loss += N.dehydrateHpPerHour * h; cause = cause || 'thirst'; }
      if (p.hunger >= 100) { loss += N.starveHpPerHour * h; cause = cause || 'hunger'; }
      if (p.fatigue >= 100) { loss += N.exhaustedHpPerHour * h; cause = cause || 'fatigue'; }
      if (loss > 0) p.hp = clamp(p.hp - loss, 0, maxHp());
      else if (!needy && sleeping) p.hp = clamp(p.hp + C.hp.sleepRegenPerHour * h, 0, maxHp());
      else if (!needy && resting) p.hp = clamp(p.hp + C.hp.restRegenPerHour * h, 0, maxHp());

      G.time += dt;
      if (p.hp <= 0) {
        G.dead = true;
        G.deathCause = DEATH_TEXT[cause] || '쓰러졌다';
        break;
      }
    }
    checkRefill();
    if (G.dead) return;
    for (const k of ['hunger', 'thirst', 'fatigue']) {
      const s = needState(k, p[k]);
      if (s > before[k] && NEED_WARN[k][s]) log(NEED_WARN[k][s], s >= 4 ? 'bad' : 'warn');
    }
    if (before.stamina > 0 && p.stamina <= 0) log('숨이 턱까지 차오른다. 탈진했다. (행동시간 증가)', 'warn');
    if (before.hp >= 30 && p.hp < 30) log('몸 상태가 좋지 않다. 치료가 필요하다.', 'bad');
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

  // ---------- 행동 ----------
  function run(fn, opts = {}) {
    if (!G || G.dead) return;
    G.recent = [];
    fn();
    if (G.dead) {
      log(`${G.deathCause}.`, 'bad');
      persist(); // 쓰러진 상태로 저장해서 새로고침으로 죽음을 피할 수 없게 한다
      render();
      showDeathChoice();
      return;
    }
    persist();
    render();
    if (opts.top) window.scrollTo(0, 0);
  }
  function mutate(fn) {
    if (!G || G.dead) return;
    fn();
    persist();
    render();
  }

  function travel(dest) {
    if (!G || dest === G.loc || (dest !== 'hideout' && !LOC[dest])) return;
    run(() => {
      const mins = travelMinutes(dest);
      if (tier().hpPerHour) log('짐이 너무 무겁다. 한 걸음 한 걸음이 고통스럽다. (HP 감소)', 'warn');
      passTime(mins, 'travel');
      if (G.dead) return;
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
    }, { top: true });
  }

  function rollLoot(L) {
    const out = {};
    if (Math.random() < L.emptyChance) return out;
    const fac = D.dangers[L.danger].rarity;
    const pool = L.loot
      .map(([id, w, a = 1, b = a]) => ({ id, w: w * (fac[ITEMS[id].r] || 0), a, b }))
      .filter((e) => e.w > 0);
    const total = pool.reduce((s, e) => s + e.w, 0);
    const n = randInt(L.finds[0], L.finds[1]);
    for (let i = 0; i < n; i++) {
      let x = Math.random() * total;
      let chosen = pool[pool.length - 1];
      for (const e of pool) { x -= e.w; if (x <= 0) { chosen = e; break; } }
      addTo(out, chosen.id, randInt(chosen.a, chosen.b));
    }
    return out;
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
      st.spots -= 1;
      G.stats.searches += 1;
      const found = rollLoot(L);
      const ids = sortedIds(found);
      if (!ids.length) log(pick(D.emptyLines));
      else {
        ids.forEach((id) => addTo(st.ground, id, found[id]));
        log('찾았다: ' + ids.map((id) => `${ITEMS[id].name} ×${found[id]}`).join(', '), 'good');
      }
      if (st.spots === 0) log('이곳은 이제 더 뒤질 곳이 없다.', 'warn');
    });
  }

  function rest() {
    run(() => {
      passTime(C.restMinutes, 'rest');
      if (G.dead) return;
      log(G.loc === 'hideout' ? '벽에 기대 한 시간쯤 숨을 골랐다.' : '몸을 숨길 만한 구석에서 한 시간쯤 숨을 골랐다.');
    });
  }

  function sleep() {
    if (!G || G.loc !== 'hideout') return;
    run(() => {
      log('담요를 덮고 눈을 감았다.');
      passTime(C.sleepMinutes, 'sleep');
      if (G.dead) return;
      log(`${clockStr(G.time)}, 눈을 떴다. 몸이 한결 가볍다.`, 'good');
    });
  }

  function useItem(id, from) {
    const it = ITEMS[id];
    if (!G || !it || !it.use) return;
    const src = from === 'stash' && G.loc === 'hideout' ? G.stash : G.player.inv;
    if (!src[id]) return;
    run(() => {
      addTo(src, id, -1);
      const p = G.player, u = it.use;
      if (u.hunger) p.hunger = clamp(p.hunger + u.hunger, 0, 100);
      if (u.thirst) p.thirst = clamp(p.thirst + u.thirst, 0, 100);
      if (u.fatigue) p.fatigue = clamp(p.fatigue + u.fatigue, 0, 100);
      if (u.stamina) p.stamina = clamp(p.stamina + u.stamina, 0, C.stamina.max);
      if (u.hp) p.hp = clamp(p.hp + u.hp, 0, maxHp());
      log(`${eul(it.name)} ${USE_VERB[it.cat]}. (${fxText(u)})`);
      passTime(it.useMinutes || 5, 'idle');
    });
  }

  // 아이템 옮기기 (시간 소모 없음)
  const toastMsg = { carry: '더 들 수 없다. 짐이 한계의 1.5배를 넘는다.', stash: '창고가 가득 찼다.' };
  function take(id, n) {
    if (!G || G.loc === 'hideout') return;
    mutate(() => {
      const g = G.locs[G.loc].ground;
      const want = n === 'all' ? g[id] || 0 : Math.min(1, g[id] || 0);
      const k = carryFit(id, want);
      if (k <= 0) return toast(toastMsg.carry);
      addTo(g, id, -k);
      addTo(G.player.inv, id, k);
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
        if (k > 0) { addTo(g, id, -k); addTo(G.player.inv, id, k); }
        if (g[id]) left = true;
      }
      if (left) toast('다 챙기지 못했다. 더는 들 수 없다.');
    });
  }
  function drop(id, n) {
    if (!G || G.loc === 'hideout') return;
    mutate(() => {
      const have = G.player.inv[id] || 0;
      const k = n === 'all' ? have : Math.min(1, have);
      if (!k) return;
      addTo(G.player.inv, id, -k);
      addTo(G.locs[G.loc].ground, id, k);
    });
  }
  function store(id, n) {
    if (!G || G.loc !== 'hideout') return;
    mutate(() => {
      const have = G.player.inv[id] || 0;
      const want = n === 'all' ? have : Math.min(1, have);
      const k = stashFit(id, want);
      if (k <= 0) return toast(toastMsg.stash);
      addTo(G.player.inv, id, -k);
      addTo(G.stash, id, k);
      if (k < want) toast(`${k}개만 넣었다. 창고가 가득 찼다.`);
    });
  }
  function storeAll() {
    if (!G || G.loc !== 'hideout') return;
    mutate(() => {
      let left = false;
      for (const id of Object.keys(G.player.inv)) {
        const k = stashFit(id, G.player.inv[id]);
        if (k > 0) { addTo(G.player.inv, id, -k); addTo(G.stash, id, k); }
        if (G.player.inv[id]) left = true;
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
      addTo(G.player.inv, id, k);
      if (k < want) toast(`${k}개만 꺼냈다. 더는 들 수 없다.`);
    });
  }
  function equipBag(id, from) {
    if (!G || !ITEMS[id] || !ITEMS[id].bag) return;
    const src = from === 'stash' && G.loc === 'hideout' ? G.stash : G.player.inv;
    if (!src[id]) return;
    mutate(() => {
      addTo(src, id, -1);
      const old = G.player.bag;
      G.player.bag = id;
      if (old) addTo(src, old, 1);
      toast(`${eul(ITEMS[id].name)} 멨다. 중량 한계 ${fmtKg(carryLimit())}kg`);
    });
  }
  function unequipBag() {
    if (!G || !G.player.bag) return;
    mutate(() => {
      const id = G.player.bag;
      G.player.bag = null;
      if (G.loc === 'hideout' && stashFit(id, 1) === 1) addTo(G.stash, id, 1);
      else addTo(G.player.inv, id, 1);
    });
  }

  // ---------- 죽음: 쓰러진 뒤에 고른다 ----------
  const carriedCount = () => Object.values(G.player.inv).reduce((a, b) => a + b, 0) + (G.player.bag ? 1 : 0);

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
    const day = dayOf(G.time), cause = G.deathCause, searches = G.stats.searches, wakes = G.stats.deaths;
    Store.clearAll();
    G = null;
    ui.screen = 'title';
    ui.titleView = 'main';
    render();
    window.scrollTo(0, 0);
    showModal({
      title: '생존 기록 끝',
      body: [`${day}일차, ${cause}.`, `수색 ${searches}회 · 악몽에서 깨어난 횟수 ${wakes}회`, '세이브는 삭제되었다.'],
      buttons: [{ label: '확인', primary: true }],
    });
  }

  function wakeFromNightmare() {
    if (!G || !G.dead) return;
    const day = dayOf(G.time);
    G.player.inv = {};
    G.player.bag = null;
    G.stats.deaths += 1;
    const r = C.respawn;
    G.time = day * 1440 + r.hour * 60;
    Object.assign(G.player, { hp: r.hp, stamina: r.stamina, hunger: r.hunger, thirst: r.thirst, fatigue: r.fatigue });
    G.loc = 'hideout';
    G.dead = false;
    G.deathCause = null;
    ui.sel = null;
    checkRefill();
    log(`${dayOf(G.time)}일차 아침, 거점에서 식은땀을 흘리며 눈을 떴다. 악몽이었을까. 몸에 지니고 있던 것은 모두 사라졌다.`, 'warn');
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
    return migrate(obj.state);
  }

  // ---------- 게임 시작 ----------
  function startNew() {
    G = newState();
    log('세상이 무너진 지 석 달이 지났다.');
    log('도시 외곽 낡은 지하 창고를 거점 삼아 버티고 있다. 창고에 남은 식량은 많지 않다.');
    log('살아남으려면 밖으로 나가야 한다. 지도를 펴고 갈 곳을 정하자.');
    ui.screen = 'game';
    ui.tab = 'scene';
    ui.menuView = null;
    persist();
    render();
    window.scrollTo(0, 0);
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
    if (it.use) meta += ` · ${fxText(it.use)}`;
    else if (it.bag) meta += ` · 중량 한계 +${it.bag}kg`;
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

  function gauge(label, value, max, color, stateText, stateCls, valueText) {
    const pct = clamp((value / max) * 100, 0, 100);
    return `<div class="gauge">
      <div class="g-head"><span class="g-label">${esc(label)}</span><span class="g-val">${esc(valueText != null ? valueText : round1(value))}</span></div>
      <div class="g-bar"><div class="g-fill" style="width:${pct.toFixed(1)}%;background:${color}"></div></div>
      <div class="g-state ${stateCls}">${esc(stateText)}</div>
    </div>`;
  }
  function needGauge(kind, label, value, color) {
    const s = needState(kind, value);
    const cls = s >= 3 ? 'bad' : s === 2 ? 'warn' : '';
    return gauge(label, value, 100, color, NEED_STATES[kind][s][1], cls);
  }

  function renderHud() {
    const p = G.player;
    const night = isNight(G.time);
    const hpPct = p.hp / maxHp();
    const hpState = hpPct < 0.3 ? ['위독', 'bad'] : hpPct < 0.6 ? ['부상', 'warn'] : ['양호', ''];
    const stState = p.stamina <= 0 ? ['탈진', 'bad'] : p.stamina < 25 ? ['지침', 'warn'] : ['양호', ''];
    const limit = carryLimit(), w = carried(), ti = tierIndex(), tr = C.overweight[ti];
    const span = limit * C.pickupHardCap;
    const fillColor = ti === 0 ? 'var(--ok)' : ti === 1 ? 'var(--warn)' : 'var(--bad)';
    const where = G.loc === 'hideout'
      ? '<span class="label">거점</span>'
      : `<span class="label">${esc(LOC[G.loc].name)}</span>${dangerChip(LOC[G.loc].danger)}`;
    $('#hud').innerHTML = `
      <div class="hud-top">
        <div class="clock"><span class="day">DAY ${dayOf(G.time)}</span><span class="time">${clockStr(G.time)}</span><span class="chip ${night ? 'night-chip' : 'day-chip'}">${night ? '밤' : '낮'}</span></div>
        <div class="where">${where}</div>
      </div>
      <div class="gauges">
        ${gauge('HP', p.hp, maxHp(), 'var(--hp)', hpState[0], hpState[1], `${round1(p.hp)}`)}
        ${gauge('스테미너', p.stamina, C.stamina.max, 'var(--stam)', stState[0], stState[1])}
        ${needGauge('hunger', '배고픔', p.hunger, 'var(--hunger)')}
        ${needGauge('thirst', '갈증', p.thirst, 'var(--thirst)')}
        ${needGauge('fatigue', '피로', p.fatigue, 'var(--fatigue)')}
      </div>
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

  const TABS = [['scene', '현장'], ['inv', '소지품'], ['map', '지도'], ['menu', '메뉴']];
  function renderTabs() {
    $('#tabs').innerHTML = TABS.map(([id, name]) => {
      let label = esc(name);
      if (id === 'inv' && G.loc === 'hideout') label = '소지품·창고';
      return `<button type="button" class="tab" role="tab" aria-selected="${ui.tab === id}" data-act="tab" data-a="${id}">${label}</button>`;
    }).join('');
  }

  function recentBox() {
    if (!G.recent || !G.recent.length) return '';
    return `<div class="recent" aria-live="polite"><span class="label">방금 일어난 일</span>${G.recent.map((e) => `<p class="${e.k}">${esc(e.text)}</p>`).join('')}</div>`;
  }
  function overweightNote() {
    const ti = tierIndex();
    if (!ti) return '';
    const tr = C.overweight[ti];
    let t = `${tr.name} 상태: 행동시간 ×${tr.timeMult}, 스테미너 소모 ×${tr.staminaMult}`;
    if (tr.hpPerHour) t += `, 이동·수색 중 시간당 HP -${tr.hpPerHour}`;
    return `<p class="note" style="color:var(--${ti === 1 ? 'warn' : 'bad'})">${esc(t)}</p>`;
  }
  function logSection() {
    const entries = G.log.slice(-40).reverse();
    return `<section class="section">
      <div class="section-head"><h2>생존 일지</h2><span class="meta">최근 ${entries.length}개</span></div>
      <ul class="log">${entries.map((e) => `<li><span class="log-time">${dayOf(e.t)}일 ${clockStr(e.t)}</span><span class="log-text ${e.k}">${esc(e.text)}</span></li>`).join('')}</ul>
    </section>`;
  }
  function quickUseSection(title, includeStash) {
    const ids = new Set(Object.keys(G.player.inv).filter((id) => ITEMS[id].use));
    if (includeStash) Object.keys(G.stash).filter((id) => ITEMS[id].use).forEach((id) => ids.add(id));
    const list = sortedIds(Object.fromEntries([...ids].map((id) => [id, 1])));
    if (!list.length) {
      return `<section class="section"><div class="section-head"><h2>${esc(title)}</h2></div><p class="empty">먹고 마실 것이 없다.</p></section>`;
    }
    const rows = list.map((id) => {
      const inS = includeStash ? G.stash[id] || 0 : 0, inI = G.player.inv[id] || 0;
      const from = inS > 0 ? 'stash' : 'inv';
      const where = includeStash ? `창고 ${inS} · 소지품 ${inI} · ${fxText(ITEMS[id].use)}` : `${fxText(ITEMS[id].use)}`;
      return itemRow(id, inS + inI, btn(USE_LABEL[ITEMS[id].cat], 'use', id, from), where);
    }).join('');
    return `<section class="section"><div class="section-head"><h2>${esc(title)}</h2>${includeStash ? '<span class="meta">창고에 있는 것부터 쓴다</span>' : ''}</div><ul class="items">${rows}</ul></section>`;
  }

  function renderScene() {
    const p = G.player;
    if (G.loc === 'hideout') {
      const slots = stashSlots();
      return `
        <section class="place">
          <div class="place-head"><h1 class="place-name">거점</h1>${isNight(G.time) ? '<span class="chip night-chip">밤</span>' : ''}</div>
          <p class="place-desc">${esc(HIDEOUT_DESC)}</p>
          <div class="place-facts"><span>창고 <b>${slots}/${C.stashSlots}</b>칸</span><span>시설 업그레이드는 4단계에서 열린다</span></div>
        </section>
        <section class="section">
          <div class="actions">
            ${actBtn('출발하기', '지도에서 갈 곳 고르기', 'tab', 'map', 'primary')}
            ${actBtn('잠자기', `${fmtDur(C.sleepMinutes)} · 피로와 스테미너 회복`, 'sleep')}
            ${actBtn('휴식', `${fmtDur(C.restMinutes)} · 스테미너 회복`, 'rest')}
            ${actBtn('짐 정리', `창고 ${slots}/${C.stashSlots}칸`, 'tab', 'inv')}
          </div>
          ${overweightNote()}
          ${recentBox()}
        </section>
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
      <section class="place">
        <div class="place-head"><h1 class="place-name">${esc(L.name)}</h1>${dangerChip(L.danger)}</div>
        <p class="place-desc">${esc(L.desc)}</p>
        <div class="place-facts"><span>수색 구역 <b>${st.spots}/${L.spots}</b></span><span>거점까지 <b>${fmtDur(travelMinutes('hideout'))}</b></span></div>
      </section>
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
      <section class="section">
        <div class="section-head"><h2>주변에 있는 물건</h2>${groundIds.length ? btn('모두 챙기기', 'takeAll', '', '', 'primary') : ''}</div>
        ${groundIds.length ? `<ul class="items">${groundRows}</ul>` : '<p class="empty">찾은 물건과 내려놓은 물건이 여기에 남는다.</p>'}
        <p class="note">못 챙긴 물건은 이 자리에 그대로 남는다. 나중에 다시 와서 가져갈 수 있다.</p>
      </section>
      ${quickUseSection('가진 음식과 약', false)}
      ${logSection()}`;
  }

  function renderInv() {
    const p = G.player;
    const atHome = G.loc === 'hideout';
    const bag = p.bag ? ITEMS[p.bag] : null;
    const invIds = sortedIds(p.inv);
    const invRows = invIds.map((id) => {
      const it = ITEMS[id], q = p.inv[id];
      let b = '';
      if (it.use) b += btn(USE_LABEL[it.cat], 'use', id, 'inv', 'primary');
      if (it.bag) b += btn('메기', 'equip', id, 'inv', 'primary');
      if (atHome) {
        const can = stashFit(id, 1) > 0;
        b += btn('넣기', 'store', id, '1', '', !can) + (q > 1 ? btn('전부', 'store', id, 'all', '', !can) : '');
      } else {
        b += btn('내려놓기', 'drop', id, '1') + (q > 1 ? btn('전부', 'drop', id, 'all') : '');
      }
      return itemRow(id, q, b);
    }).join('');
    let html = `
      <section class="section">
        <div class="section-head"><h2>장비</h2><span class="meta">기본 중량 한계 ${C.baseCarry}kg</span></div>
        <div class="equip-row">
          <span class="slot">가방</span>
          <span class="what">${bag ? `${esc(bag.name)} <span class="note">(+${bag.bag}kg · ${fmtKg(bag.w)}kg)</span>` : '<span class="note">없음. 가방을 찾으면 더 많이 들 수 있다.</span>'}</span>
          ${bag ? btn('벗기', 'unequip') : ''}
        </div>
      </section>
      <section class="section">
        <div class="section-head"><h2>소지품</h2><span class="meta">${invIds.length}종 · ${fmtKg(mapWeight(p.inv))}kg</span>${atHome && invIds.length ? btn('전부 창고에 넣기', 'storeAll', '', '', 'primary') : ''}</div>
        ${invIds.length ? `<ul class="items">${invRows}</ul>` : '<p class="empty">들고 있는 물건이 없다.</p>'}
      </section>`;
    if (atHome) {
      const stIds = sortedIds(G.stash);
      const stRows = stIds.map((id) => {
        const it = ITEMS[id], q = G.stash[id];
        const can = carryFit(id, 1) > 0;
        let b = '';
        if (it.use) b += btn(USE_LABEL[it.cat], 'use', id, 'stash', 'primary');
        if (it.bag) b += btn('메기', 'equip', id, 'stash', 'primary');
        b += btn('꺼내기', 'retrieve', id, '1', '', !can) + (q > 1 ? btn('전부', 'retrieve', id, 'all', '', !can) : '');
        return itemRow(id, q, b);
      }).join('');
      html += `
        <section class="section">
          <div class="section-head"><h2>창고</h2><span class="meta">${stashSlots()}/${C.stashSlots}칸 사용 중 · 무게 제한 없음</span></div>
          ${stIds.length ? `<ul class="items">${stRows}</ul>` : '<p class="empty">창고가 비어 있다.</p>'}
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
    const rows = ids.map((id) => {
      const here = id === G.loc;
      const mins = here ? 0 : travelMinutes(id);
      const arrive = G.time + mins;
      let name, meta;
      if (id === 'hideout') {
        name = '<span>거점</span>';
        meta = here ? '지금 여기 있다' : `${fmtDur(mins)} · 도착 ${clockStr(arrive)}${isNight(arrive) ? ' (밤)' : ''}`;
      } else {
        const l = LOC[id], st = G.locs[id];
        name = `<span>${esc(l.name)}</span>${dangerChip(l.danger)}`;
        const spots = st.visited ? `수색 구역 ${st.spots}/${l.spots}` : '아직 가 보지 않음';
        meta = here ? `지금 여기 있다 · ${spots}` : `${fmtDur(mins)} · 도착 ${clockStr(arrive)}${isNight(arrive) ? ' (밤)' : ''} · ${spots}`;
      }
      return `<li class="loc-row${ui.sel === id ? ' sel' : ''}" id="row-${id}">
        <div class="lr-main"><div class="lr-name">${name}${here ? '<span class="chip ok">현재 위치</span>' : ''}</div><div class="lr-meta">${esc(meta)}</div></div>
        ${here ? '' : btn('이동', 'travel', id, '', ui.sel === id ? 'primary' : '')}
      </li>`;
    }).join('');
    return `
      <section class="section">
        <div class="section-head"><h2>지도</h2><span class="meta">거점 기준 걸어서 걸리는 시간 · 다음 보급까지 ${refillIn}일</span></div>
        <div class="map-wrap">${mapSvg()}</div>
        <div class="row-btns" aria-label="위험도">${D.dangers.map((d, i) => dangerChip(i)).join('')}</div>
        ${overweightNote()}
      </section>
      <section class="section">
        <div class="section-head"><h2>갈 수 있는 곳</h2><span class="meta">가까운 순</span></div>
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
    return `
      <section class="section">
        <div class="section-head"><h2>생존 기록</h2></div>
        <dl class="kv">
          <dt>생존</dt><dd>${dayOf(G.time)}일차</dd>
          <dt>수색 횟수</dt><dd>${G.stats.searches}회</dd>
          <dt>악몽에서 깨어난 횟수</dt><dd>${G.stats.deaths}회</dd>
        </dl>
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
          <li><b>중량</b>: 기본 ${C.baseCarry}kg + 가방(최대 +35kg). 한계를 넘으면 <b>경과적</b>(행동시간 ×1.25), 1.25배를 넘으면 <b>중과적</b>(행동시간 ×2, 이동·수색 중 HP 감소). 1.5배를 넘게는 못 줍는다.</li>
          <li><b>생존 수치</b>: 배고픔·갈증·피로는 시간이 지나면 오른다. 100이 되면 HP가 깎인다. 배고픔·갈증이 70을 넘으면 회복이 절반으로 줄어든다.</li>
          <li><b>스테미너</b>: 이동과 수색에 쓰인다. 0이 되면 행동시간이 1.5배가 된다. 휴식과 잠으로 회복한다.</li>
          <li><b>수색 구역</b>: 장소마다 정해져 있고 뒤질수록 줄어든다. ${C.refill.everyDays}일마다 각 장소의 ${Math.round(C.refill.ratio * 100)}%가 다시 채워진다.</li>
          <li><b>밤</b>: ${C.night.start}시부터 ${C.night.end}시까지. 2단계에서 밤에는 더 위험해지고 더 좋은 물건이 나온다.</li>
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
      const cont = save
        ? actBtn('이어하기', `${dayOf(save.state.time)}일차 ${clockStr(save.state.time)}${save.state.dead ? ' · 쓰러진 채로 멈춰 있다' : ''}`, 'continue', '', 'primary')
        : '';
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
        <p class="title-lead">무너진 도시 외곽, 지하 창고 하나가 당신의 전부다. 밖으로 나가 뒤지고, 짊어지고, 살아서 돌아와라. 짐이 무거울수록 길은 길어진다.</p>
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
    tab: (t) => { ui.tab = t; ui.menuView = null; render(); window.scrollTo(0, 0); },
    travel: (dest) => travel(dest),
    search: () => search(),
    rest: () => rest(),
    sleep: () => sleep(),
    use: (id, from) => useItem(id, from),
    take: (id, n) => take(id, n),
    takeAll: () => takeAll(),
    drop: (id, n) => drop(id, n),
    store: (id, n) => store(id, n),
    storeAll: () => storeAll(),
    retrieve: (id, n) => retrieve(id, n),
    equip: (id, from) => equipBag(id, from),
    unequip: () => unequipBag(),
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
  window.__RH = { get state() { return G; }, set state(v) { G = v; }, render, passTime: (m, a) => passTime(m, a), carried, carryLimit, tierIndex, persist };
})();
