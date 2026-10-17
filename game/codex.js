// 아이템 도감: data.js(GAME_DATA)에서 아이템마다 제작법과 얻는 곳을 계산해 보여 준다
// 게임 안(메뉴 → 아이템 도감)과 따로 여는 codex.html이 같은 코드를 쓴다
// 미리 만들어 둔 표가 아니라 열 때마다 데이터에서 새로 계산하므로, 수치를 바꾸거나 아이템을 추가하면 도감도 같이 바뀐다
(() => {
  const CAT = { weapon: '무기', ammo: '탄약', mod: '부착물', armor: '옷', bag: '가방', gear: '기어', case: '케이스', food: '음식', drink: '물', med: '의약품', material: '재료', junk: '잡동사니', quest: '중요한 물건' };
  const ORDER = ['weapon', 'ammo', 'mod', 'armor', 'bag', 'gear', 'case', 'food', 'drink', 'med', 'material', 'junk', 'quest'];

  // ---------- 계산 ----------
  function compute(D) {
    const ST = D.story || {}, I = D.items, CB = (D.config && D.config.combat) || {};
    const name = (id) => (I[id] ? I[id].name : id);
    const locName = (id) => { const l = D.locations.find((x) => x.id === id); return l ? l.name : id; };
    const out = {};
    const add = (id, kind, src) => { if (I[id]) (out[id] = out[id] || []).push({ kind, ...src }); };

    // 수색: 장소별로 수색 1번에 그 아이템이 한 번 이상 나올 확률 (집중력·밤 보정 전)
    const locTables = D.locations.map((L) => {
      const fac = D.dangers[L.danger].rarity;
      const entries = L.loot.map(([id, w, a = 1, b = a]) => ({ id, a, b, w: I[id] ? w * (fac[I[id].r] || 0) : 0 })).filter((e) => e.w > 0);
      const sum = entries.reduce((s, e) => s + e.w, 0) || 1;
      const avg = (L.finds[0] + L.finds[1]) / 2;
      const rows = entries.map((e) => ({ id: e.id, a: e.a, b: e.b, per: (1 - L.emptyChance) * (1 - Math.pow(1 - e.w / sum, avg)) })).sort((x, y) => y.per - x.per);
      for (const r of rows) add(r.id, 'search', { loc: L.id, locName: L.name, per: r.per, a: r.a, b: r.b });
      return { id: L.id, name: L.name, danger: L.danger, dangerName: D.dangers[L.danger].name, spots: L.spots, finds: L.finds, empty: L.emptyChance, encounter: (CB.encounter || [])[L.danger] || 0, rows };
    });
    // 연구소 전용방: 카드키로 한 번 열 때 그 아이템이 한 번 이상 나올 확률
    const LB = (D.config && D.config.lab) || {};
    for (const R of LB.rooms || []) {
      const L = D.locations.find((x) => x.id === R.loc), fac = D.dangers[L.danger].rarity, T = LB.roomTypes[R.type];
      const entries = [...LB.roomPools[R.type], ...(R.extra || [])].map(([id, w, a = 1, b = a]) => ({ id, a, b, w: I[id] ? w * (fac[I[id].r] || 0) : 0 })).filter((e) => e.w > 0);
      const sum = entries.reduce((s, e) => s + e.w, 0) || 1, avg = (LB.roomFinds[0] + LB.roomFinds[1]) / 2;
      const per = {};
      for (const e of entries) per[e.id] = Math.max(per[e.id] || 0, 1 - Math.pow(1 - e.w / sum, avg));
      for (const e of entries) if (per[e.id] != null) { add(e.id, 'room', { label: `${R.name} (${L.name.split(' · ')[0]} · ${T.color} 카드)`, per: per[e.id], a: e.a, b: e.b }); delete per[e.id]; }
    }
    // 연구소에서 찾는 PMC의 시신
    for (const [id, p, a, b] of LB.corpse || []) add(id, 'enemy', { enemyName: `PMC의 시신 (연구소 수색 ${Math.round((LB.corpseChance || 0) * 100)}%)`, p, a, b });
    // 길 위: 이동 중 사건·전투 보상
    const roadSum = (D.roadLoot || []).reduce((s, [, w]) => s + w, 0) || 1;
    for (const [id, w, a = 1, b = a] of D.roadLoot || []) add(id, 'road', { share: w / roadSum, a, b });
    // 적이 떨어뜨림 (이겼을 때)
    for (const E of Object.values(D.enemies)) for (const [id, p, a, b] of E.drops || []) add(id, 'enemy', { enemyName: E.name, p, a, b });
    // 제작
    const needText = (R) => [R.needClue && LB.roomTypes ? `연구소 ${LB.roomTypes[R.needClue].name} 단서 ${LB.clueNeed}장` : '', R.needLabNotes ? '연구소 기록 10장' : '', R.needFlag ? '김정우의 연구 완료' : ''].filter(Boolean).join(' · ');
    for (const R of D.recipes) add(R.out[0], 'craft', { atName: D.facilities[R.at].name, lv: R.lv, req: Object.entries(R.req || {}).map(([f, lv]) => `${D.facilities[f].name} LV${lv}`).join(' · '), power: !!R.power, need: needText(R), in: R.in.map(([x, n]) => [name(x), n]), outN: R.out[1], time: R.time });
    // 해체
    for (const it of Object.values(I)) for (const [m, n] of it.salvage || []) add(m, 'salvage', { fromName: it.name, n, rare: I[m] && I[m].r >= 1 });
    // 상인
    for (const t of D.trades || []) for (const [g, n] of t.get) add(g, 'trade', { give: t.give.map(([x, k]) => [name(x), k]), n, rare: t.kind === 'rare' });
    // 사건·인연: 결과 안의 아이템과 은닉처를 모두 훑는다
    const walk = (o, cb) => {
      if (!o || typeof o !== 'object') return;
      for (const [id, a, b = a, p = 1] of o.items || []) cb('items', id, { a, b, p });
      if (o.cache && o.cache.items) for (const [id, n] of Object.entries(o.cache.items)) cb('cache', id, { a: n, b: n, p: 1, place: `${o.cache.loc ? `${locName(o.cache.loc)} · ` : ''}${o.cache.place || ''}` });
      for (const k of ['success', 'fail', 'win', 'lose']) walk(o[k], cb);
      for (const sub of o.roll || []) walk(sub, cb);
    };
    for (const ev of D.events || []) {
      walk(ev.outcome, (t, id, x) => add(id, 'event', { label: ev.title, ...x }));
      for (const ch of ev.choices || []) walk(ch.outcome, (t, id, x) => add(id, 'event', { label: `${ev.title} · ${ch.label}`, ...x }));
    }
    for (const b of ST.bonds || []) for (const step of b.steps) for (const ch of step.choices || []) {
      walk(ch.outcome, (t, id, x) => add(id, t === 'cache' ? 'cache' : 'bond', { label: `${b.who} · ${step.title}`, ...x }));
    }
    for (const f of ST.fragments || []) if (f.cache) for (const [id, n] of Object.entries(f.cache.items)) add(id, 'cache', { label: `기록 '${f.title}'`, place: `${locName(f.cache.loc)} · ${f.cache.place}`, a: n, b: n, p: 1 });
    // 의뢰인과 거래 (신뢰 단계)
    for (const b of ST.bonds || []) for (const o of b.shop || []) for (const [g, n] of o.get) add(g, 'shop', { who: b.who, at: o.at || 0, of: b.steps.length, give: o.give.map(([x, k]) => [name(x), k]), n, daily: !!b.stock });
    // 특별한 방법 (아이템에 적힌 howto)
    for (const [id, it] of Object.entries(I)) if (it.howto) add(id, 'special', { label: it.howto });
    // 처음 가진 것
    for (const [id, n] of Object.entries((D.start && D.start.stash) || {})) add(id, 'start', { where: '창고', n });
    for (const [id, n] of Object.entries((D.start && D.start.inv) || {})) add(id, 'start', { where: '소지품', n });
    // 시설 생산: 정수기
    const wl = D.facilities.water && D.facilities.water.levels[0];
    if (wl) add('water_bottle', 'facility', { label: `정수기 (전기로 ${wl.every / 60}시간마다 1개)` });

    // 효과: 아이템 데이터에서 바로 문장을 만든다
    const CF = D.config || {}, BU = CF.buffs || {}, DB = CF.debuffs || {};
    const sg = (v) => (v > 0 ? `+${v}` : `${v}`);
    const durT = (m) => (m >= 60 ? `${Math.floor(m / 60)}시간${m % 60 ? ` ${m % 60}분` : ''}` : `${m}분`);
    const enemy = (e) => (D.enemies[e] ? D.enemies[e].name : e);
    const SLOT = { sight: '조준경', muzzle: '총구', mag: '탄창', stock: '개머리판', rail: '레일' };
    const CASECAT = { med: '의약품', drink: '마실 것', material: '재료', mod: '부착물', quest: '중요한 물건' };
    function effects(it) {
      const fx = [];
      const u = it.use || {};
      const stat = [['hp', 'HP'], ['stamina', '스테미너'], ['hunger', '배고픔'], ['thirst', '갈증'], ['fatigue', '피로']].filter(([k]) => u[k]).map(([k, n]) => `${n} ${sg(u[k])}`);
      if (stat.length) fx.push(stat.join(' · '));
      if (u.poison) fx.push(`식중독 위험 ${Math.round(u.poison * 100)}%`);
      if (it.treat) fx.push(Object.keys(it.treat).map((k) => (k === 'infection' ? `감염 -${it.treat[k]}%` : `${DB[k] ? DB[k].name : k} 치료`)).join(' · '));
      if (it.buff && BU[it.buff[0]]) { const B = BU[it.buff[0]]; fx.push(`${B.name} ${durT(it.buff[1])}: ${B.desc}`); }
      if (it.random) fx.push(`무작위 효과 ${it.random.pick}개 ${durT(it.random.minutes)} (${it.random.buffs.filter((b) => BU[b]).map((b) => BU[b].name).join('·')} 중) · 가끔 ${(it.random.bad || []).map(([t]) => (DB[t] ? DB[t].name : t)).join('·')}`);
      if (it.useMinutes) fx.push(`쓰는 데 ${durT(it.useMinutes)}`);
      if (it.cook) fx.push(`거점에서 ${it.cat === 'drink' ? '끓이면' : '익히면'} ${name(it.cook[0])}`);
      if (it.leaves) fx.push(`다 쓰면 ${name(it.leaves)}이 남는다`);
      if (it.fill) fx.push(`${[].concat(it.fill.from).map(name).join('·')} 중 하나를 ${it.fill.n || 1}병 채우면 ${name(it.fill.to)} (어디서나 ${durT(it.fill.minutes || 5)})`);
      if (it.cat === 'weapon') {
        fx.push(`${it.size === 'small' ? '작은' : '큰'} 무기 · 승률 +${it.atk}%`);
        if (it.vs) fx.push(Object.entries(it.vs).map(([e, v]) => `${enemy(e)} 상대 +${v}%`).join(' · '));
        if (it.ammo) fx.push(`${name(it.ammo)} ${it.ammoUse ? `${it.ammoUse[0]}~${it.ammoUse[1]}발/전투` : '사용'}${it.noAmmoAtk != null ? ` · 탄이 없으면 휘둘러 +${it.noAmmoAtk}%` : ''}`);
        if (it.slots) fx.push(`부착 칸: ${it.slots.map((x) => SLOT[x] || x).join('·')}`);
      }
      if (it.cat === 'armor') fx.push(`받는 피해 -${Math.round(it.def * 100)}% · 디버프 확률 -${Math.round(it.dbf * 100)}% · 두께 ${it.thick || 1}`);
      if (it.bag) fx.push(`중량 한계 +${it.bag}kg`);
      if (it.radio) { const r = it.radio; fx.push(['무전기 칸 · 어디서나 라디오를 듣는다', r.static ? `잡음 ${Math.round(r.static * 100)}%` : '', r.enc < 1 ? `조우 확률 -${Math.round((1 - r.enc) * 100)}%` : '', r.supply ? '보급 방송(보급 상자 위치)' : '', r.pmc ? 'PMC 암호 무전' : ''].filter(Boolean).join(' · ')); }
      if (it.ear) fx.push(`귀 칸 · 이길 확률 +${it.ear.win}% · 쉬거나 잘 때 습격 -${Math.round((1 - it.ear.rest) * 100)}%`);
      if (it.cat === 'mod') {
        fx.push(`${SLOT[it.slot] || it.slot} · ${it.fits.map(name).join('·')}`);
        const m = [it.win ? `승률 +${it.win}%` : '', it.night ? `밤 승률 +${it.night}%` : '', ...Object.entries(it.vs || {}).map(([e, v]) => `${enemy(e)} 상대 +${v}%`), it.ammo ? `탄약 +${it.ammo}발` : '', it.quiet ? '총소리 없음' : ''].filter(Boolean);
        if (m.length) fx.push(m.join(' · '));
      }
      if (it.case) fx.push(`${it.case.inj ? '주사기만' : `${it.case.cats.map((c) => CASECAT[c] || c).join('·')} (1개 ${it.case.maxW}kg 이하)`} ${it.case.cap}개 · 들고 다니면 싸우는 중에도 꺼내 쓰고 약탈자에게 안 빼앗긴다 · 창고에선 1칸`);
      if (it.cat === 'ammo' && it.desc) fx.push(it.desc);
      if (it.salvage) fx.push(`해체: ${it.salvage.map(([m, n]) => `${name(m)} ${n}`).join(', ')}`);
      return fx.join(' · ');
    }
    const items = Object.entries(I).map(([id, it]) => ({
      id, name: it.name, cat: it.cat, catName: CAT[it.cat] || it.cat, r: it.r, rName: D.rarities[it.r], w: it.w,
      extra: it.cat === 'weapon' ? `승률 +${it.atk}%${it.ammo ? ` · ${name(it.ammo)}` : ''}${it.slots ? ' · 부착물 가능' : ''}` : it.cat === 'mod' ? it.fits.map(name).join('·') : '',
      fx: effects(it),
      src: out[id] || [],
    }));
    const pos = (c) => (ORDER.includes(c) ? ORDER.indexOf(c) : ORDER.length);
    items.sort((a, b) => pos(a.cat) - pos(b.cat) || b.r - a.r || a.name.localeCompare(b.name, 'ko'));
    const enemies = Object.values(D.enemies).map((E) => ({ name: E.name, drops: (E.drops || []).filter(([x]) => I[x]).map(([id, p, a, b]) => ({ id, name: name(id), p, a, b })) })).filter((e) => e.drops.length);
    const cats = [...ORDER.filter((c) => items.some((it) => it.cat === c)), ...[...new Set(items.map((it) => it.cat))].filter((c) => !ORDER.includes(c))].map((c) => [c, CAT[c] || c]);
    return { items, locTables, enemies, cats };
  }

  // ---------- 화면 ----------
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const pct = (p) => (p >= 0.995 ? '100%' : p >= 0.1 ? `${Math.round(p * 100)}%` : p >= 0.01 ? `${(p * 100).toFixed(1)}%` : `${(p * 100).toFixed(2)}%`);
  const qty = (a, b) => (a === b ? `${a}개` : `${a}~${b}개`);
  const kg = (w) => String(+w.toFixed(w < 0.1 ? 3 : 1));
  const dur = (m) => (m >= 60 ? `${Math.floor(m / 60)}시간${m % 60 ? ` ${m % 60}분` : ''}` : `${m}분`);
  const LABEL = { craft: '제작', facility: '시설', special: '특별', search: '수색', room: '전용방', enemy: '적 드랍', salvage: '해체', trade: '상인', shop: '의뢰인 거래', road: '길 위', event: '사건', bond: '인연·의뢰', cache: '은닉처', start: '시작' };
  const KINDS = Object.keys(LABEL);
  const craftable = (it) => it.src.some((s) => s.kind === 'craft');
  // 다시 그려져도(게임 화면 갱신) 고른 보기·검색어를 기억한다
  const st = { view: 'items', cat: 'all', craft: 'all', q: '' };
  try { st.view = localStorage.getItem('rh-codex-view') === 'locs' ? 'locs' : 'items'; } catch (e) { /* 저장소 막힘 */ }

  function srcLine(kind, list) {
    let body = '';
    if (kind === 'craft') body = list.map((s) => `<span class="cx-line">${esc(s.atName)} LV${s.lv}${s.req ? ` (+ ${esc(s.req)})` : ''}${s.power ? ' · 전기' : ''}${s.need ? ` · ${esc(s.need)}` : ''} · ${s.in.map(([n, k]) => `${esc(n)} ${k}`).join(' + ')} → ${s.outN}개 · ${dur(s.time)}</span>`).join('');
    else if (kind === 'search') body = list.slice().sort((a, b) => b.per - a.per).map((s) => `<span class="cx-tag">${esc(s.locName)} <b>${pct(s.per)}</b> · ${qty(s.a, s.b)}</span>`).join('');
    else if (kind === 'room') body = list.slice().sort((a, b) => b.per - a.per).map((s) => `<span class="cx-tag">${esc(s.label)} <b>${pct(s.per)}</b> · ${qty(s.a, s.b)}</span>`).join('');
    else if (kind === 'enemy') body = list.map((s) => `<span class="cx-tag">${esc(s.enemyName)} <b>${pct(s.p)}</b> · ${qty(s.a, s.b)}</span>`).join('');
    else if (kind === 'salvage') body = list.map((s) => `<span class="cx-tag">${esc(s.fromName)} ${s.n}개${s.rare ? ' (확률)' : ''}</span>`).join('');
    else if (kind === 'trade') body = list.map((s) => `<span class="cx-tag">${s.give.map(([n, k]) => `${esc(n)} ${k}`).join(' + ')} → ${s.n}개${s.rare ? ' · 가끔' : ''}</span>`).join('');
    else if (kind === 'shop') body = list.map((s) => `<span class="cx-tag">${esc(s.who)} (신뢰 ${Math.min(s.at, s.of)}/${s.of}${s.daily ? ' · 그날 물건에 있으면' : ''}) · ${s.give.map(([n, k]) => `${esc(n)} ${k}`).join(' + ')} → ${s.n}개</span>`).join('');
    else if (kind === 'road') body = list.map((s) => `<span class="cx-tag">이동 중 사건·전투 보상 <b>${pct(s.share)}</b>/개 · ${qty(s.a, s.b)}</span>`).join('');
    else if (kind === 'event' || kind === 'bond') body = list.map((s) => `<span class="cx-tag">${esc(s.label)} · ${qty(s.a, s.b)}${s.p < 1 ? ` (${pct(s.p)})` : ''}</span>`).join('');
    else if (kind === 'cache') body = list.map((s) => `<span class="cx-tag">${s.label ? `${esc(s.label)} · ` : ''}${esc(s.place)} · ${s.a}개</span>`).join('');
    else if (kind === 'start') body = list.map((s) => `<span class="cx-tag cx-dim">${esc(s.where)}에 ${s.n}개</span>`).join('');
    else body = list.map((s) => `<span class="cx-tag">${esc(s.label)}</span>`).join('');
    return `<div class="cx-src"><span class="cx-k">${LABEL[kind]}</span><span class="cx-v">${body}</span></div>`;
  }
  function itemCard(it) {
    const by = {};
    for (const s of it.src) (by[s.kind] = by[s.kind] || []).push(s);
    const c = craftable(it);
    return `<article class="cx-item">
      <div class="cx-head"><span class="cx-name r${it.r}">${esc(it.name)}</span><span class="cx-meta">${esc(it.catName)} · ${esc(it.rName)} · ${kg(it.w)}kg${it.extra ? ` · ${esc(it.extra)}` : ''}</span><span class="cx-badge${c ? ' yes' : ''}">${c ? '제작 가능' : '제작 불가'}</span></div>
      ${it.fx ? `<p class="cx-fx"><span class="cx-k">효과</span><span>${esc(it.fx)}</span></p>` : ''}
      <div class="cx-srcs">${it.src.length ? KINDS.filter((k) => by[k]).map((k) => srcLine(k, by[k])).join('') : '<span class="cx-none">얻을 곳이 없다</span>'}</div>
    </article>`;
  }

  // el 안에 도감을 그린다. 그릴 때마다 D에서 새로 계산한다
  function mount(el, D) {
    if (!el) return;
    const data = compute(D);
    const items = data.items;
    const nCraft = items.filter(craftable).length, nNone = items.filter((it) => !it.src.length).length;
    const match = (it) => !st.q || it.name.includes(st.q) || it.id.includes(st.q.toLowerCase());
    el.innerHTML = `
      <div class="cx-stats">${[[items.length, '아이템'], [nCraft, '제작 가능'], [items.length - nCraft, '제작 불가'], [nNone, '얻을 곳 없음']].map(([n, l]) => `<div class="cx-stat"><b>${n}</b><span>${l}</span></div>`).join('')}</div>
      <div class="cx-bar">
        <div class="cx-row">
          <div class="cx-seg" role="group" aria-label="도감 보기">
            <button type="button" data-cx-view="items">아이템별</button>
            <button type="button" data-cx-view="locs">장소별 드랍</button>
          </div>
          <input type="search" id="cx-q" placeholder="아이템 이름 검색 (예: 소총, 붕대)" aria-label="아이템 검색" value="${esc(st.q)}">
        </div>
        <div class="cx-row cx-filters"></div>
      </div>
      <div class="cx-body"></div>
      <p class="cx-note">수색 확률은 수색 1번에 그 아이템이 한 번 이상 나올 확률이다 (집중력 스킬·밤 보너스 전). 위험한 장소일수록 희귀·최상급이 잘 나오고, 안전한 곳에서는 아예 안 나오는 등급도 있다. 적 드랍은 이겼을 때 확률. 해체로 나오는 고급 이상 재료는 지능 스킬에 따라 확률로 나온다.</p>`;
    const body = el.querySelector('.cx-body'), filters = el.querySelector('.cx-filters');
    const draw = () => {
      el.querySelectorAll('[data-cx-view]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.cxView === st.view)));
      if (st.view === 'items') {
        const base = items.filter(match);
        filters.innerHTML = [['all', '전체'], ...data.cats].map(([k, n]) => `<button type="button" class="cx-chip" data-cx-cat="${k}" aria-pressed="${st.cat === k}">${esc(n)}<span>${base.filter((it) => k === 'all' || it.cat === k).length}</span></button>`).join('')
          + [['all', '제작 전부'], ['yes', '제작 가능'], ['no', '제작 불가']].map(([k, n]) => `<button type="button" class="cx-chip" data-cx-craft="${k}" aria-pressed="${st.craft === k}">${n}</button>`).join('');
        const list = base.filter((it) => (st.cat === 'all' || it.cat === st.cat) && (st.craft === 'all' || (st.craft === 'yes') === craftable(it)));
        body.innerHTML = list.length ? `<div class="cx-list">${list.map(itemCard).join('')}</div>` : '<p class="cx-empty">맞는 아이템이 없다. 검색어나 분류를 바꿔 보자.</p>';
        return;
      }
      filters.innerHTML = '';
      const byId = Object.fromEntries(items.map((it) => [it.id, it]));
      const table = (head, rows) => `<div class="cx-tbl"><table><thead><tr><th>아이템</th><th class="num">${head}</th><th class="num">개수</th></tr></thead><tbody>${rows.join('')}</tbody></table></div>`;
      const tr = (id, p, a, b) => `<tr><td><span class="cx-rd r${byId[id].r}"></span>${esc(byId[id].name)}</td><td class="num">${pct(p)}</td><td class="num">${qty(a, b)}</td></tr>`;
      const locs = data.locTables.map((L) => {
        const rows = L.rows.filter((r) => !st.q || byId[r.id].name.includes(st.q));
        if (st.q && !rows.length) return '';
        return `<section class="cx-loc"><h3>${esc(L.name)} <span class="cx-d d${L.danger}">${esc(L.dangerName)}</span></h3>
          <p class="cx-note">수색 구역 ${L.spots} · 한 번에 ${L.finds[0]}~${L.finds[1]}개 · 빈손 ${Math.round(L.empty * 100)}% · 수색 중 조우 ${Math.round(L.encounter * 100)}%</p>
          ${table('수색 1번', rows.map((r) => tr(r.id, r.per, r.a, r.b)))}</section>`;
      }).join('');
      const foes = data.enemies.map((E) => {
        const rows = E.drops.filter((d) => !st.q || d.name.includes(st.q));
        if (st.q && !rows.length) return '';
        return `<section class="cx-loc"><h3>${esc(E.name)} <span class="cx-d d3">적 드랍</span></h3>${table('이겼을 때', rows.map((d) => tr(d.id, d.p, d.a, d.b)))}</section>`;
      }).join('');
      body.innerHTML = locs + foes ? `<div class="cx-locs">${locs}${foes}</div>` : '<p class="cx-empty">그 이름이 나오는 곳이 없다.</p>';
    };
    el.onclick = (e) => {
      const v = e.target.closest('[data-cx-view]'), c = e.target.closest('[data-cx-cat]'), f = e.target.closest('[data-cx-craft]');
      if (v) { st.view = v.dataset.cxView; try { localStorage.setItem('rh-codex-view', st.view); } catch (err) { /* 저장소 막힘 */ } }
      else if (c) st.cat = c.dataset.cxCat;
      else if (f) st.craft = f.dataset.cxCraft;
      else return;
      draw();
    };
    el.querySelector('#cx-q').oninput = (e) => { st.q = e.target.value.trim(); draw(); };
    draw();
  }

  window.RH_CODEX = { compute, mount };
})();
