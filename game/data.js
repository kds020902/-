// 폐허의 거점 — 게임 수치 데이터
// 이 파일만 고치고 브라우저를 새로고침하면 바로 적용됩니다.
// 시간 단위는 모두 "게임 안 분(minute)", 확률은 0~1 (combat.base 등 % 표기는 따로 적어 둠)

window.GAME_DATA = {
  config: {
    startMinute: 8 * 60,          // 1일차 08:00에 시작

    // 중량
    baseCarry: 30,                // 기본 중량 한계 (kg)
    pickupHardCap: 1.5,           // 한계의 1.5배를 넘으면 더 못 줍는다
    overweight: [
      // upTo: 한계 대비 비율 상한, timeMult: 행동시간 배율, staminaMult: 스테미너 소모 배율, hpPerHour: 이동·수색 중 시간당 HP 감소
      { id: 'normal', name: '정상',   upTo: 1.0,      timeMult: 1.0,  staminaMult: 1.0, hpPerHour: 0 },
      { id: 'light',  name: '경과적', upTo: 1.25,     timeMult: 1.25, staminaMult: 1.5, hpPerHour: 0 },
      { id: 'heavy',  name: '중과적', upTo: Infinity, timeMult: 2.0,  staminaMult: 2.5, hpPerHour: 8 },
    ],

    // 생존 수치 (0 = 괜찮음, 100 = 한계)
    needs: {
      hungerPerHour: 4,
      thirstPerHour: 6,
      fatiguePerHour: 4,
      sleepNeedsRate: 0.5,        // 자는 동안 배고픔·갈증은 절반 속도
      sleepFatigueRecoverPerHour: 12.5,
      restFatigueRecoverPerHour: 3,
      starveHpPerHour: 4,         // 배고픔 100일 때
      dehydrateHpPerHour: 6,      // 갈증 100일 때
      exhaustedHpPerHour: 2,      // 피로 100일 때
      penaltyAt: 70,              // 배고픔·갈증이 이 이상이면 회복 효율 절반, HP 자연 회복 없음
    },
    stamina: {
      max: 100,
      exertPerHour: 12,           // 이동·수색·전투 중 시간당 소모
      restPerHour: 25,
      sleepPerHour: 15,
      exhaustedTimeMult: 1.5,     // 스테미너 0이면 행동시간 1.5배
    },
    fatigueSlowAt: 80,            // 피로가 이 이상이면 행동시간 1.2배
    fatigueTimeMult: 1.2,
    hp: { base: 100, sleepRegenPerHour: 3, restRegenPerHour: 1 },

    searchMinutes: 30,
    restMinutes: 60,
    sleepMinutes: 8 * 60,
    night: { start: 18, end: 6 },
    refill: { everyDays: 3, ratio: 0.3 },   // 3일마다 각 지역 수색 구역의 30% 회복
    stashSlots: 30,
    respawn: { hp: 50, stamina: 50, hunger: 40, thirst: 40, fatigue: 20, hour: 8 },

    // 전투 (확률 % 단위)
    combat: {
      base: [85, 75, 60, 45, 30],                      // 위험도별 기본 승률(%)
      encounter: [0.05, 0.15, 0.30, 0.45, 0.60],       // 수색 1회당 조우 확률
      travelPerHour: [0.03, 0.06, 0.10, 0.14, 0.18],   // 이동 1시간당 조우 확률 (출발지·도착지 중 더 위험한 쪽 기준)
      restMult: 0.4,                                   // 바깥에서 쉴 때 조우 확률 = 수색 조우 확률 × 0.4
      nightEncounterMult: 1.3,                         // 밤에는 조우 확률 1.3배
      nightWin: -8,                                    // 밤에는 승률 -8%
      nightLootMult: 1.25,                             // 밤에는 고급 이상 아이템이 1.25배 잘 나온다
      minWin: 5, maxWin: 95,
      fightMinutes: 15, fightStamina: 12,
      fleeBase: 55, fleeMinutes: 10, fleeStamina: 12, fleeFailPenalty: -10,
      baseDodge: 5,                                    // 졌을 때 피해를 통째로 피할 확률(%), 3단계에서 지구력이 올려준다
      mods: { hpLowPer: 0.4, exhausted: -20, tired: -10, fatigue: -5, light: -5, heavy: -15 },
      fleeMods: { staminaPer: 0.3, light: -15, night: -5 },
      sneakMods: { light: -15, heavy: -30, fracture: -20, night: 10 },
    },

    // 디버프
    debuffs: {
      bleed:     { name: '출혈',   hours: 4,   hpPerHour: 8, infectPerHour: 0.05,
                   onset: '상처에서 피가 멈추지 않는다. (출혈)', ended: '출혈이 멎었다.', cured: '상처를 감싸 피를 멈췄다.' },
      fracture:  { name: '골절',   hours: 120, timeMult: 1.3, win: -15, flee: -25,
                   onset: '뼈가 어긋나는 소리가 났다. (골절)', ended: '부러진 뼈가 어느 정도 붙었다.', cured: '부목을 대고 단단히 묶었다. 이제 좀 걸을 만하다.' },
      infection: { name: '감염',   start: 10, growPerHour: 1.2, hpDiv: 25, extraAt100: 6, win: -5, winAt: 50,
                   onset: '상처 주변이 붉게 부어오른다. (감염)', worse: '상처가 더 곪았다. (감염 악화)',
                   at50: '열이 나고 식은땀이 흐른다. 감염이 퍼지고 있다.', at100: '감염이 온몸에 퍼졌다. 이대로는 오래 못 버틴다.',
                   cured: '항생제를 삼켰다. 열이 내리기 시작한다.', reduced: '항생제를 삼켰다. 감염이 조금 가라앉았다.' },
      fear:      { name: '공포',   hours: 6,   win: -10, searchMult: 1.2, restMult: 2, sleepMult: 3,
                   onset: '손이 떨린다. 공포가 엄습한다. (공포)', ended: '마음이 조금 진정됐다.', cured: '진정제를 먹었다. 떨림이 멎는다.' },
      poison:    { name: '식중독', hours: 12,  hpPerHour: 1, thirstMult: 1.5, recoverMult: 0.5, win: -5,
                   onset: '속이 뒤집힌다. (식중독)', ended: '속이 가라앉았다.', cured: '지사제를 먹었다. 속이 진정된다.' },
    },

    // 랜덤 이벤트가 일어날 확률
    eventChance: { search: 0.12, travelPerHour: 0.10, travelMin: 0.06, travelMax: 0.35, rest: 0.10, sleep: 0.30 },
  },

  // 위험도 5단계. rarity: 아이템 등급(일반/고급/희귀/최상급)별 출현 가중치 배율
  dangers: [
    { name: '안전함',     rarity: [1, 0.30, 0.05, 0.00] },
    { name: '괜찮음',     rarity: [1, 0.50, 0.12, 0.01] },
    { name: '조심',       rarity: [1, 0.80, 0.25, 0.05] },
    { name: '위험함',     rarity: [1, 1.10, 0.45, 0.12] },
    { name: '매우위험함', rarity: [1, 1.40, 0.80, 0.30] },
  ],

  rarities: ['일반', '고급', '희귀', '최상급'],

  // cat: weapon / armor / bag / ammo / food / drink / med / material
  // w: 무게(kg), r: 등급(0~3), stack: 창고 한 칸에 들어가는 개수
  // use: 사용 효과 (hunger·thirst·fatigue는 음수일수록 좋음, hp·stamina는 양수일수록 좋음, poison: 식중독 확률)
  // treat: 치료하는 디버프 (infection은 감염 수치를 그만큼 낮춘다)
  // atk: 승률 보너스(%), ammo: 필요한 탄약, ammoUse: 싸움마다 쓰는 탄약, noAmmoAtk: 탄약이 없을 때 승률 보너스
  // def: 졌을 때 받는 피해 감소, dbf: 디버프 걸릴 확률 감소
  items: {
    canned_food:    { name: '통조림',         cat: 'food',  w: 0.4,  r: 0, stack: 10, use: { hunger: -30, poison: 0.03 },  desc: '유통기한은 지났지만 아직 먹을 만하다.' },
    bread:          { name: '눅눅한 빵',      cat: 'food',  w: 0.2,  r: 0, stack: 10, use: { hunger: -15, poison: 0.12 },  desc: '곰팡이 핀 부분만 떼어내면 된다. 아마도.' },
    instant_noodle: { name: '컵라면',         cat: 'food',  w: 0.15, r: 0, stack: 10, use: { hunger: -20, thirst: 5 },     desc: '물 없이 부숴 먹는다. 짜다.' },
    chocolate:      { name: '초콜릿 바',      cat: 'food',  w: 0.1,  r: 1, stack: 20, use: { hunger: -10, stamina: 15 },   desc: '작지만 힘이 난다.' },
    ration:         { name: '전투식량',       cat: 'food',  w: 0.6,  r: 2, stack: 5,  use: { hunger: -60, stamina: 20 },   desc: '군용 비상식량. 든든하다.' },
    water_bottle:   { name: '생수',           cat: 'drink', w: 0.5,  r: 0, stack: 10, use: { thirst: -35 },                desc: '뚜껑이 밀봉된 500ml 생수.' },
    rain_water:     { name: '빗물',           cat: 'drink', w: 0.5,  r: 0, stack: 10, use: { thirst: -30, poison: 0.1 },   desc: '받아 둔 빗물. 깨끗하진 않다.' },
    soda:           { name: '탄산음료',       cat: 'drink', w: 0.35, r: 0, stack: 10, use: { thirst: -20, stamina: 5 },    desc: '김은 다 빠졌다.' },
    energy_drink:   { name: '에너지 드링크',  cat: 'drink', w: 0.3,  r: 1, stack: 10, use: { thirst: -15, stamina: 40, fatigue: -10 }, desc: '심장이 빨리 뛴다.' },

    bandage:        { name: '붕대',           cat: 'med',   w: 0.05, r: 0, stack: 20, use: { hp: 8 }, treat: { bleed: true },      desc: '상처를 감싸 피를 멈춘다.' },
    first_aid:      { name: '구급상자',       cat: 'med',   w: 0.4,  r: 1, stack: 5,  use: { hp: 35 }, treat: { bleed: true }, useMinutes: 15, desc: '제대로 된 응급처치 도구.' },
    painkiller:     { name: '진통제',         cat: 'med',   w: 0.05, r: 1, stack: 20, use: { hp: 5, stamina: 10 },         desc: '통증이 조금 가신다.' },
    splint:         { name: '부목',           cat: 'med',   w: 0.3,  r: 1, stack: 10, treat: { fracture: true }, useMinutes: 15, desc: '부러진 뼈를 고정한다.' },
    antibiotics:    { name: '항생제',         cat: 'med',   w: 0.05, r: 2, stack: 20, treat: { infection: 60 },            desc: '감염을 가라앉힌다. 귀하다.' },
    sedative:       { name: '진정제',         cat: 'med',   w: 0.05, r: 1, stack: 20, treat: { fear: true },               desc: '떨리는 손을 멈춘다.' },
    antidiarrheal:  { name: '지사제',         cat: 'med',   w: 0.05, r: 0, stack: 20, treat: { poison: true },             desc: '뒤집힌 속을 가라앉힌다.' },

    kitchen_knife:  { name: '부엌칼',         cat: 'weapon', w: 0.3, r: 0, stack: 1, atk: 5,  desc: '없는 것보단 낫다.' },
    bat:            { name: '야구방망이',     cat: 'weapon', w: 1.0, r: 0, stack: 1, atk: 9,  desc: '묵직하게 손에 감긴다.' },
    crowbar:        { name: '빠루',           cat: 'weapon', w: 1.8, r: 0, stack: 1, atk: 8,  desc: '잠긴 문을 조용히 열 수 있다.' },
    machete:        { name: '마체테',         cat: 'weapon', w: 0.8, r: 1, stack: 1, atk: 13, desc: '가볍고 날카롭다.' },
    fire_axe:       { name: '소방 도끼',      cat: 'weapon', w: 2.5, r: 1, stack: 1, atk: 16, desc: '무겁지만 한 방이 확실하다.' },
    pistol:         { name: '권총',           cat: 'weapon', w: 1.0, r: 2, stack: 1, atk: 22, ammo: 'pistol_ammo', ammoUse: [1, 2], noAmmoAtk: 4, desc: '탄약이 있어야 제값을 한다.' },
    shotgun:        { name: '산탄총',         cat: 'weapon', w: 3.5, r: 3, stack: 1, atk: 30, ammo: 'shells', ammoUse: [1, 2], noAmmoAtk: 6, desc: '가까운 거리라면 무엇이든 멈춘다.' },
    pistol_ammo:    { name: '권총탄',         cat: 'ammo',   w: 0.012, r: 1, stack: 60, desc: '권총에 쓴다.' },
    shells:         { name: '산탄',           cat: 'ammo',   w: 0.045, r: 2, stack: 40, desc: '산탄총에 쓴다.' },

    padded_jacket:  { name: '두꺼운 패딩',    cat: 'armor', w: 1.5, r: 0, stack: 1, def: 0.15, dbf: 0.10, desc: '이빨 정도는 막아 준다.' },
    leather_jacket: { name: '가죽 재킷',      cat: 'armor', w: 2.0, r: 1, stack: 1, def: 0.25, dbf: 0.20, desc: '질긴 가죽.' },
    riot_armor:     { name: '진압복',         cat: 'armor', w: 5.0, r: 2, stack: 1, def: 0.40, dbf: 0.35, desc: '경찰 기동대용 보호구. 무겁다.' },
    military_vest:  { name: '방탄조끼',       cat: 'armor', w: 6.0, r: 3, stack: 1, def: 0.50, dbf: 0.40, desc: '군용 방탄조끼. 아주 무겁다.' },

    cloth:            { name: '천 조각',      cat: 'material', w: 0.1,  r: 0, stack: 50, desc: '하이드아웃 시설 재료.' },
    wood:             { name: '목재',         cat: 'material', w: 1.5,  r: 0, stack: 20, desc: '하이드아웃 시설 재료.' },
    nails:            { name: '못 한 줌',     cat: 'material', w: 0.3,  r: 0, stack: 30, desc: '하이드아웃 시설 재료.' },
    scrap_metal:      { name: '고철',         cat: 'material', w: 2.0,  r: 0, stack: 20, desc: '하이드아웃 시설 재료. 무겁다.' },
    pipe:             { name: '쇠파이프',     cat: 'material', w: 1.2,  r: 0, stack: 20, desc: '하이드아웃 시설 재료.' },
    duct_tape:        { name: '덕트 테이프',  cat: 'material', w: 0.15, r: 0, stack: 20, desc: '하이드아웃 시설 재료.' },
    plastic:          { name: '플라스틱 용기', cat: 'material', w: 0.2, r: 0, stack: 30, desc: '하이드아웃 시설 재료. 빗물을 받을 수도 있다.' },
    wire:             { name: '전선 뭉치',    cat: 'material', w: 0.4,  r: 1, stack: 20, desc: '하이드아웃 시설 재료.' },
    tools:            { name: '공구 세트',    cat: 'material', w: 2.5,  r: 1, stack: 5,  desc: '하이드아웃 시설 재료. 무겁다.' },
    fuel:             { name: '연료통',       cat: 'material', w: 4.0,  r: 1, stack: 5,  desc: '5L 연료. 발전기를 돌린다. 매우 무겁다.' },
    battery:          { name: '배터리',       cat: 'material', w: 0.3,  r: 1, stack: 20, desc: '하이드아웃 시설 재료.' },
    medical_supplies: { name: '의료 소모품',  cat: 'material', w: 0.5,  r: 1, stack: 20, desc: '의무실 재료.' },
    electronic:       { name: '전자 부품',    cat: 'material', w: 0.2,  r: 2, stack: 30, desc: '귀한 시설 재료.' },
    engine_part:      { name: '발전기 부품',  cat: 'material', w: 3.0,  r: 3, stack: 5,  desc: '군용 발전기 부품. 아주 귀하다.' },

    // bag: 장착하면 중량 한계 증가 (최대 +35kg)
    bag_school:   { name: '책가방',         cat: 'bag', w: 0.8, r: 0, stack: 1, bag: 8,  desc: '중량 한계 +8kg' },
    bag_hiking:   { name: '등산 가방',      cat: 'bag', w: 1.5, r: 1, stack: 1, bag: 18, desc: '중량 한계 +18kg' },
    bag_tactical: { name: '전술 배낭',      cat: 'bag', w: 2.2, r: 2, stack: 1, bag: 26, desc: '중량 한계 +26kg' },
    bag_military: { name: '군용 대형 배낭', cat: 'bag', w: 3.0, r: 3, stack: 1, bag: 35, desc: '중량 한계 +35kg' },
  },

  // dist: 거점에서 걸리는 시간(분), angle: 지도 위 방향(도)
  // spots: 수색 구역 수, finds: 한 번 수색할 때 나오는 아이템 종류 수 [최소, 최대]
  // loot: [아이템, 가중치, 최소 개수, 최대 개수]
  locations: [
    {
      id: 'houses', name: '버려진 주택가', danger: 0, dist: 30, angle: 205, spots: 50, finds: [1, 2], emptyChance: 0.15,
      desc: '창문이 깨진 단독주택들이 늘어선 골목. 대부분 이미 털렸지만 구석구석 남은 게 있을지도 모른다.',
      loot: [['canned_food', 5], ['bread', 6], ['cloth', 9, 1, 3], ['plastic', 5, 1, 2], ['water_bottle', 3], ['duct_tape', 3], ['nails', 3], ['bandage', 3, 1, 2], ['soda', 3], ['chocolate', 2], ['wood', 4], ['bag_school', 1.5],
             ['kitchen_knife', 2], ['bat', 1], ['padded_jacket', 1.2], ['antidiarrheal', 1], ['sedative', 0.4]],
      flavor: ['부엌 찬장을 하나씩 열어 보았다.', '아이 방 장난감 상자 밑을 뒤졌다.', '현관 신발장 위를 훑었다.', '반쯤 무너진 창고 문을 비집고 들어갔다.'],
    },
    {
      id: 'store', name: '동네 편의점', danger: 0, dist: 40, angle: 330, spots: 30, finds: [1, 3], emptyChance: 0.12,
      desc: '셔터가 반쯤 내려간 24시 편의점. 진열대가 모두 쓰러져 있다.',
      loot: [['canned_food', 6], ['instant_noodle', 7, 1, 2], ['water_bottle', 7], ['soda', 6], ['chocolate', 4], ['energy_drink', 1.5], ['bandage', 2], ['plastic', 3], ['battery', 1.5],
             ['antidiarrheal', 1.5], ['kitchen_knife', 0.5]],
      flavor: ['쓰러진 진열대 밑으로 손을 넣었다.', '계산대 뒤 창고를 뒤졌다.', '냉장고 문을 하나씩 열어 보았다. 냄새가 지독하다.'],
    },
    {
      id: 'gas', name: '폐 주유소', danger: 1, dist: 60, angle: 70, spots: 30, finds: [1, 3], emptyChance: 0.12,
      desc: '녹슨 주유기 사이로 바람이 분다. 정비실 문이 열려 있다.',
      loot: [['fuel', 3], ['soda', 5], ['water_bottle', 4], ['instant_noodle', 3], ['tools', 1], ['scrap_metal', 4], ['pipe', 3], ['wire', 2], ['duct_tape', 3], ['battery', 2],
             ['crowbar', 2], ['padded_jacket', 0.8], ['leather_jacket', 0.4]],
      flavor: ['정비실 공구함을 열어 보았다.', '매점 카운터 뒤를 뒤졌다.', '버려진 차량의 트렁크를 열었다.'],
    },
    {
      id: 'hardware', name: '철물점', danger: 1, dist: 80, angle: 150, spots: 40, finds: [1, 3], emptyChance: 0.1,
      desc: '간판이 떨어진 철물점. 선반에 공구와 자재가 어지럽게 흩어져 있다.',
      loot: [['nails', 8, 1, 3], ['wood', 7, 1, 2], ['pipe', 6], ['scrap_metal', 5], ['wire', 4], ['duct_tape', 5, 1, 2], ['tools', 2], ['battery', 2], ['water_bottle', 2],
             ['crowbar', 3], ['fire_axe', 1], ['machete', 0.8]],
      flavor: ['안쪽 자재 창고로 들어갔다.', '무너진 선반을 하나씩 들어 올렸다.', '계산대 서랍을 억지로 열었다.'],
    },
    {
      id: 'school', name: '학교', danger: 2, dist: 120, angle: 260, spots: 40, finds: [1, 3], emptyChance: 0.12,
      desc: '운동장에 차들이 버려져 있다. 교실마다 바리케이드를 쳤던 흔적이 남아 있다.',
      loot: [['bag_school', 4], ['bag_hiking', 1], ['bandage', 4, 1, 2], ['first_aid', 1.5], ['cloth', 5, 1, 3], ['bread', 3], ['water_bottle', 3], ['chocolate', 3], ['plastic', 4], ['wire', 2], ['battery', 2], ['electronic', 1],
             ['bat', 2], ['splint', 1.5], ['sedative', 1], ['antidiarrheal', 1], ['padded_jacket', 1]],
      flavor: ['교실 사물함을 하나씩 열었다.', '보건실 약장을 뒤졌다.', '컴퓨터실의 부서진 본체를 뜯었다.', '급식실 창고 문을 밀고 들어갔다.'],
    },
    {
      id: 'mart', name: '대형마트', danger: 2, dist: 150, angle: 15, spots: 50, finds: [1, 3], emptyChance: 0.1,
      desc: '넓은 매장 안은 어둡고 조용하다. 너무 조용하다.',
      loot: [['canned_food', 8, 1, 2], ['instant_noodle', 6, 1, 2], ['water_bottle', 7, 1, 2], ['soda', 5], ['chocolate', 4], ['energy_drink', 3], ['bag_hiking', 2], ['bag_tactical', 0.4], ['cloth', 4], ['plastic', 4], ['battery', 3], ['duct_tape', 3], ['first_aid', 1],
             ['kitchen_knife', 2], ['bat', 1.5], ['machete', 0.6], ['padded_jacket', 2], ['leather_jacket', 1], ['antidiarrheal', 2]],
      flavor: ['식품 코너의 쓰러진 매대를 뒤졌다.', '아웃도어 매장 쪽으로 들어갔다.', '직원 전용 물류 창고를 살폈다.', '카트 더미 사이를 헤집었다.'],
    },
    {
      id: 'hospital', name: '병원', danger: 3, dist: 210, angle: 105, spots: 40, finds: [1, 3], emptyChance: 0.1,
      desc: '응급실 앞에 구급차가 엎어져 있다. 소독약 냄새와 썩은 냄새가 뒤섞여 있다.',
      loot: [['bandage', 8, 1, 3], ['first_aid', 5], ['painkiller', 5, 1, 2], ['medical_supplies', 5, 1, 2], ['water_bottle', 3], ['electronic', 2], ['battery', 2], ['cloth', 3, 1, 2],
             ['antibiotics', 3], ['splint', 4], ['sedative', 3, 1, 2], ['antidiarrheal', 3]],
      flavor: ['응급실 처치대 서랍을 열었다.', '약제부 선반을 뒤졌다.', '병동 간호사실을 살폈다.'],
    },
    {
      id: 'police', name: '경찰서', danger: 3, dist: 240, angle: 300, spots: 30, finds: [1, 3], emptyChance: 0.12,
      desc: '유리문 너머로 서류가 어지럽게 흩어져 있다. 무기고 문은 아직 잠겨 있을까.',
      loot: [['bag_tactical', 2], ['ration', 2], ['first_aid', 2], ['bandage', 3], ['battery', 3], ['wire', 2], ['electronic', 2], ['energy_drink', 2], ['water_bottle', 3], ['tools', 1], ['duct_tape', 2],
             ['pistol', 1.5], ['pistol_ammo', 5, 2, 8], ['riot_armor', 1.5], ['leather_jacket', 1], ['shells', 1, 1, 4], ['shotgun', 0.4], ['sedative', 1], ['splint', 1]],
      flavor: ['당직실 캐비닛을 열었다.', '압수품 보관실을 뒤졌다.', '순찰차 트렁크를 열어 보았다.'],
    },
    {
      id: 'base', name: '군사기지', danger: 4, dist: 360, angle: 215, spots: 50, finds: [2, 3], emptyChance: 0.08,
      desc: '철조망 너머 버려진 군사기지. 무엇이 기다리고 있는지 아무도 모른다.',
      loot: [['ration', 5, 1, 2], ['bag_military', 1.2], ['bag_tactical', 2], ['engine_part', 2], ['electronic', 3, 1, 2], ['fuel', 3], ['first_aid', 3], ['battery', 3, 1, 2], ['wire', 3], ['tools', 2], ['energy_drink', 3], ['water_bottle', 4],
             ['shotgun', 1], ['shells', 3, 2, 6], ['pistol', 2], ['pistol_ammo', 4, 3, 10], ['military_vest', 1], ['riot_armor', 1.5], ['antibiotics', 2], ['splint', 2], ['fire_axe', 1]],
      flavor: ['보급 창고의 나무 상자를 뜯었다.', '막사 관물대를 하나씩 열었다.', '정비고 안쪽으로 들어갔다.', '버려진 군용 트럭 짐칸을 뒤졌다.'],
    },
  ],

  // 길 위에서 줍는 물건 (이동 중 이벤트)
  roadLoot: [['water_bottle', 4], ['soda', 4], ['canned_food', 3], ['bandage', 3], ['chocolate', 2], ['cloth', 4, 1, 2], ['plastic', 3], ['kitchen_knife', 1], ['painkiller', 1], ['pistol_ammo', 0.5, 2, 5], ['antidiarrheal', 1]],

  emptyLines: ['쓸 만한 건 아무것도 없었다.', '누군가 이미 싹 털어 갔다.', '먼지만 잔뜩 뒤집어썼다.'],

  // 적. weight: 위험도별 등장 가중치, mod: 승률 보정(%), canFlee: 도망칠 기회가 있을 확률, fleeMod: 도망 성공률 보정(%)
  // dmg: 졌을 때 피해, debuffs: 졌을 때 걸릴 디버프 확률, fear: 싸운 뒤 공포 확률
  // hurtOnWin / winDmg: 이겨도 다칠 확률과 피해, drops: [아이템, 확률, 최소, 최대], steal: 지면 소지품을 빼앗긴다
  enemies: {
    infected: {
      name: '감염자', weight: [10, 8, 6, 4, 3], mod: 0, canFlee: 0.7, fleeMod: 0,
      dmg: [10, 22], debuffs: [['bleed', 0.45], ['infection', 0.30], ['fracture', 0.05]], fear: 0.05, hurtOnWin: 0.2, winDmg: [2, 6],
      intro: ['{place}에서 소리가 나 돌아보니 감염자가 내 쪽으로 다가온다.', '{place}, 모퉁이를 돌자 감염자와 눈이 마주쳤다.', '썩은 냄새가 확 끼쳐 온다. {place}에서 감염자 하나가 비틀거리며 다가온다.'],
      win: ['감염자의 머리를 힘껏 내리쳤다. 다시는 일어나지 않는다.', '몸싸움 끝에 감염자를 바닥에 눕혔다.'],
      lose: ['감염자에게 붙잡혀 한참을 뒹굴었다. 간신히 떨쳐내고 몸을 뺐다.', '감염자의 이빨이 팔을 스쳤다. 겨우 밀쳐내고 거리를 벌렸다.'],
    },
    infected_pair: {
      name: '감염자 둘', weight: [2, 4, 5, 4, 3], mod: -12, canFlee: 0.65, fleeMod: -5,
      dmg: [14, 28], debuffs: [['bleed', 0.55], ['infection', 0.40], ['fracture', 0.08]], fear: 0.1, hurtOnWin: 0.3, winDmg: [3, 8],
      intro: ['{place}에서 발소리가 겹쳐 들린다. 감염자 둘이 양쪽에서 다가온다.'],
      win: ['하나를 쓰러뜨리고, 남은 하나도 겨우 처리했다.'],
      lose: ['둘을 한꺼번에 상대하기는 무리였다. 할퀴고 물어뜯기며 간신히 빠져나왔다.'],
    },
    dogs: {
      name: '굶주린 들개 떼', weight: [2, 3, 3, 3, 2], mod: -8, canFlee: 0, fleeMod: 0, noFleeText: '개들은 너무 빠르다. 도망칠 수 없다.',
      dmg: [8, 18], debuffs: [['bleed', 0.65], ['infection', 0.10]], fear: 0.1, hurtOnWin: 0.3, winDmg: [3, 7],
      intro: ['{place}에서 낮은 으르렁 소리가 들린다. 뼈만 남은 들개 떼가 이빨을 드러낸다.'],
      win: ['맨 앞의 놈을 쓰러뜨리자 나머지가 꼬리를 내리고 흩어졌다.'],
      lose: ['다리를 물린 채 끌려다녔다. 정신없이 휘두르다 보니 개들이 물러났다.'],
    },
    raider: {
      name: '약탈자', weight: [0, 1, 3, 4, 3], mod: -12, canFlee: 0.5, fleeMod: -10, steal: true,
      dmg: [15, 30], debuffs: [['bleed', 0.50], ['fracture', 0.15]], fear: 0.15, hurtOnWin: 0.3, winDmg: [4, 10],
      drops: [['pistol_ammo', 0.4, 2, 6], ['kitchen_knife', 0.2, 1, 1], ['bandage', 0.4, 1, 2], ['canned_food', 0.4, 1, 2], ['water_bottle', 0.35, 1, 1], ['machete', 0.08, 1, 1], ['pistol', 0.05, 1, 1], ['leather_jacket', 0.05, 1, 1]],
      intro: ['"거기 서! 가진 거 다 내려놔!" {place}에서 약탈자가 앞을 막아선다.', '{place}에서 누군가 나를 지켜보고 있었다. 칼을 든 약탈자가 다가온다.'],
      win: ['약탈자를 쓰러뜨렸다. 그가 가진 것을 뒤졌다.'],
      lose: ['약탈자의 일격에 나뒹굴었다. 정신을 차렸을 때 그는 이미 사라진 뒤였다.'],
    },
    horde: {
      name: '감염자 무리', weight: [0, 0, 1, 3, 4], mod: -22, canFlee: 0.85, fleeMod: 10,
      dmg: [20, 35], debuffs: [['bleed', 0.60], ['infection', 0.45], ['fracture', 0.15]], fear: 0.4, hurtOnWin: 0.4, winDmg: [5, 12],
      intro: ['{place}에서 신음 소리가 사방에서 들려온다. 감염자 무리다!'],
      win: ['무리 사이를 베고 밀치며 길을 텄다. 살아남았다.'],
      lose: ['무리에 휩쓸려 바닥을 구르다 간신히 빠져나왔다.'],
    },
    mutant: {
      name: '변이 감염자', weight: [0, 0, 0, 1, 3], mod: -28, canFlee: 0.4, fleeMod: -10,
      dmg: [28, 45], debuffs: [['bleed', 0.50], ['infection', 0.60], ['fracture', 0.25]], fear: 0.6, hurtOnWin: 0.5, winDmg: [8, 16],
      intro: ['{place}의 어둠 속에서 사람이라고 하기엔 너무 큰 무언가가 몸을 일으킨다.'],
      win: ['수없이 내리친 끝에 거대한 몸이 무너졌다. 손이 아직도 떨린다.'],
      lose: ['괴물 같은 힘에 벽까지 날아갔다. 정신을 차리자마자 기어서 도망쳤다.'],
    },
  },

  // 랜덤 이벤트
  // on: 언제 일어나는지 (search 수색 / travel 이동 / rest 바깥에서 휴식 / sleep 거점에서 잠)
  // outcome: 바로 일어나는 결과. choices: 고를 수 있는 선택지. trade: 떠돌이 생존자와 거래
  // 결과 항목: log, time, hp([최소,최대]), stamina, fatigue, debuffs, items([아이템,최소,최대,확률]), loot(현재 장소에서 추가로 찾는 횟수),
  //           consume, roll([{p, ...}]), sneak(기본 성공률%) + success/fail, combat(적 또는 'random') + canFlee + winLoot, stashLoseFood, heavyMult(중과적이면 피해·확률 배율)
  events: [
    { id: 'stash', on: ['search'], weight: 6, title: '숨겨진 꾸러미',
      text: ['벽 틈에 누군가 숨겨 둔 꾸러미가 끼워져 있다.', '천장 패널 하나가 어긋나 있다. 들춰 보니 비닐로 싼 꾸러미가 있다.'],
      outcome: { loot: 2 } },
    { id: 'trap', on: ['search'], weight: 4, minDanger: 1, title: '덫', deathText: '덫에 걸린 채 쓰러졌다',
      text: ['발밑에서 철컥 소리가 났다. 누군가 설치한 덫이다!'],
      outcome: { hp: [-18, -8], debuffs: [['bleed', 0.6]] } },
    { id: 'collapse', on: ['search'], weight: 3, title: '무너진 바닥', deathText: '무너진 바닥 아래에서 쓰러졌다',
      text: ['발을 디딘 바닥이 꺼지면서 아래로 떨어졌다.'],
      outcome: { hp: [-14, -5], debuffs: [['fracture', 0.25]], heavyMult: 2 } },
    { id: 'rats', on: ['search'], weight: 4, title: '쥐 떼',
      text: ['썩은 음식 더미를 들추자 쥐 떼가 쏟아져 나왔다.'],
      outcome: { hp: [-4, -1], debuffs: [['infection', 0.12]] } },
    { id: 'corpse', on: ['search'], weight: 5, title: '배낭을 멘 시신',
      text: ['벽에 기대 앉은 시신이 있다. 배낭이 아직 어깨에 걸려 있다.'],
      choices: [
        { label: '배낭을 뒤진다', sub: '10분', outcome: { time: 10, roll: [
          { p: 0.75, log: '배낭 안을 털었다.', loot: 2 },
          { p: 0.25, log: '손을 뻗는 순간 시신이 눈을 떴다!', combat: 'infected', canFlee: false, winLoot: 2 },
        ] } },
        { label: '그냥 둔다', sub: '건드리지 않는다', outcome: { log: '좋은 예감이 들지 않는다. 그냥 지나쳤다.' } },
      ] },
    { id: 'locked', on: ['search'], weight: 5, title: '잠긴 문',
      text: ['안쪽에 잠긴 문이 하나 있다. 아직 아무도 열지 않은 것 같다.'],
      choices: [
        { label: '빠루로 조용히 연다', sub: '10분 · 필요: 빠루', requires: ['crowbar'], outcome: { time: 10, log: '빠루로 문틈을 비집어 소리 없이 열었다.', loot: 3 } },
        { label: '힘으로 부순다', sub: '30분 · 스테미너 -15 · 소리가 크다', outcome: { time: 30, stamina: -15, roll: [
          { p: 0.6, log: '몇 번을 걷어찬 끝에 문이 열렸다.', loot: 3 },
          { p: 0.4, log: '문이 부서지는 소리에 무언가 몰려온다!', combat: 'random', winLoot: 3 },
        ] } },
        { label: '그냥 둔다', sub: '시간을 아낀다', outcome: { log: '문을 그대로 두고 돌아섰다.' } },
      ] },
    { id: 'note', on: ['search'], weight: 3, title: '남겨진 글씨',
      text: [
        '벽에 휘갈겨 쓴 글씨가 있다. "엄마, 학교 체육관으로 가. 거기서 기다릴게."',
        '문에 붙은 쪽지. "물은 꼭 끓여 마실 것. 2번 국도 다리 무너짐."',
        '거울에 립스틱으로 쓴 글씨. "밤에 불 켜지 마. 놈들은 빛을 보고 온다."',
        '찢어진 수첩 한 장. "군사기지 정문 쪽은 이미 끝났다. 뒤쪽 정비고로 돌아갈 것."',
        '계단 벽에 페인트로 쓴 글씨. "3층에 사람 있음. 노크 세 번."',
      ],
      outcome: {} },
    { id: 'gift', on: ['search', 'travel'], weight: 2, title: '남겨진 상자',
      text: ['"필요한 사람 가져가세요." 삐뚤빼뚤한 글씨가 적힌 상자가 놓여 있다.'],
      outcome: { items: [['water_bottle', 1, 2], ['canned_food', 1, 2], ['bandage', 1, 2, 0.5]] } },
    { id: 'night_noise', on: ['search'], weight: 5, night: true, title: '어둠 속의 소리',
      text: ['어둠 속에서 무언가 움직였다. 숨을 죽이고 기다렸지만 아무것도 나타나지 않았다.'],
      outcome: { debuffs: [['fear', 0.5]] } },

    { id: 'car', on: ['travel'], weight: 6, title: '버려진 승용차',
      text: ['{place}에 문이 열린 승용차가 서 있다.'],
      choices: [
        { label: '뒤져 본다', sub: '20분', outcome: { time: 20, roll: [
          { p: 0.85, log: '좌석 밑과 트렁크를 뒤졌다.', emptyLog: '글러브 박스까지 열어 봤지만 빈손이다.',
            items: [['soda', 1, 1, 0.5], ['water_bottle', 1, 1, 0.4], ['fuel', 1, 1, 0.2], ['bandage', 1, 2, 0.3], ['chocolate', 1, 1, 0.3], ['painkiller', 1, 1, 0.15], ['kitchen_knife', 1, 1, 0.08]] },
          { p: 0.15, log: '뒷좌석에서 무언가 벌떡 일어났다!', combat: 'infected', canFlee: false },
        ] } },
        { label: '지나친다', sub: '갈 길이 바쁘다', outcome: { log: '차를 지나쳐 걸음을 옮겼다.' } },
      ] },
    { id: 'rain', on: ['travel'], weight: 4, title: '소나기',
      text: ['갑자기 굵은 빗줄기가 쏟아진다.'],
      choices: [
        { label: '빗물을 받는다', sub: '30분 · 필요: 플라스틱 용기', requires: ['plastic'], outcome: { time: 30, consume: [['plastic', 1]], log: '플라스틱 용기 가득 빗물을 받았다.', items: [['rain_water', 1, 1]] } },
        { label: '비를 맞으며 계속 간다', sub: '피로 +5', outcome: { log: '흠뻑 젖은 채 걸음을 재촉했다.', fatigue: 5 } },
      ] },
    { id: 'stumble', on: ['travel'], weight: 4, title: '헛디딤', deathText: '넘어진 채 일어나지 못했다',
      text: ['무너진 보도블록에 발을 헛디뎌 넘어졌다.'],
      outcome: { hp: [-8, -3], debuffs: [['fracture', 0.08]], heavyMult: 2.5 } },
    { id: 'gunshots', on: ['travel'], weight: 3, minDanger: 1, title: '총성',
      text: ['멀리서 총성이 몇 발 울렸다. 그리고 다시 조용해졌다.'],
      outcome: { debuffs: [['fear', 0.3]] } },
    { id: 'trader', on: ['travel'], weight: 3, title: '떠돌이 생존자', trade: true,
      text: ['낡은 수레를 끄는 생존자와 마주쳤다. 서로 경계하며 한참을 노려보다가 그가 먼저 입을 열었다. "거래할래?"'] },
    { id: 'horde_road', on: ['travel'], weight: 3, minDanger: 2, title: '길을 막은 무리',
      text: ['{place} 앞쪽 도로를 감염자 무리가 가득 메우고 있다.'],
      choices: [
        { label: '멀리 돌아간다', sub: '40분 더 걸린다', outcome: { time: 40, log: '골목을 몇 개나 돌아 무리를 피했다.' } },
        { label: '몰래 지나간다', sub: '성공 확률 {sneak}%', outcome: { sneak: 70,
          success: { log: '숨을 죽이고 무리 사이를 빠져나갔다.' },
          fail: { log: '발밑의 깡통이 굴러갔다. 무리가 일제히 고개를 돌린다!', combat: 'horde', canFlee: false } } },
      ] },
    { id: 'backpack_road', on: ['travel'], weight: 2, title: '버려진 배낭',
      text: ['길 한가운데 배낭 하나가 떨어져 있다. 주인은 보이지 않는다.'],
      outcome: { loot: 2 } },

    { id: 'rest_found', on: ['rest'], weight: 3, outside: true, title: '구석의 물건',
      text: ['쉬려고 앉은 자리 옆에 무언가 굴러다닌다.'],
      outcome: { loot: 1 } },
    { id: 'rest_fear', on: ['rest'], weight: 3, outside: true, title: '인기척',
      text: ['어디선가 발소리가 들렸다. 쉬는 둥 마는 둥 했다.'],
      outcome: { fatigue: 5, debuffs: [['fear', 0.3]] } },

    { id: 'rats_home', on: ['sleep'], weight: 4, title: '쥐',
      text: ['밤새 바스락거리는 소리가 났다. 쥐가 창고를 뒤졌다.'],
      outcome: { stashLoseFood: 1 } },
    { id: 'rain_home', on: ['sleep'], weight: 4, title: '밤비',
      text: ['밤새 비가 내렸다. 거점 앞 양동이에 빗물이 고였다.'],
      outcome: { items: [['rain_water', 1, 2]] } },
    { id: 'knock', on: ['sleep'], weight: 2, title: '문 두드리는 소리',
      text: ['한밤중 누군가 철문을 두드렸다. 숨죽이고 기다리자 발소리가 멀어졌다. 아침에 나가 보니 문 앞에 작은 꾸러미가 놓여 있었다.'],
      outcome: { items: [['canned_food', 1, 1], ['bandage', 1, 2, 0.6], ['antibiotics', 1, 1, 0.15]] } },
    { id: 'nightmare', on: ['sleep'], weight: 4, title: '악몽',
      text: ['무너지던 날의 꿈을 꿨다. 식은땀에 젖어 깼다.'],
      outcome: { fatigue: 10, debuffs: [['fear', 0.5]] } },
    { id: 'deep_sleep', on: ['sleep'], weight: 4, title: '깊은 잠',
      text: ['오랜만에 아무 꿈도 꾸지 않고 푹 잤다.'],
      outcome: { hp: 5, fatigue: -10 } },
  ],

  // 떠돌이 생존자의 거래 제안 (give를 주고 get을 받는다)
  trades: [
    { give: [['canned_food', 1]], get: [['water_bottle', 2]] },
    { give: [['water_bottle', 2]], get: [['bandage', 2]] },
    { give: [['cloth', 3]], get: [['canned_food', 1]] },
    { give: [['battery', 1]], get: [['pistol_ammo', 4]] },
    { give: [['chocolate', 1]], get: [['painkiller', 1]] },
    { give: [['scrap_metal', 1]], get: [['soda', 1]] },
    { give: [['fuel', 1]], get: [['first_aid', 1]] },
    { give: [['canned_food', 2]], get: [['antibiotics', 1]] },
    { give: [['bandage', 3]], get: [['splint', 1]] },
  ],

  start: {
    stash: { canned_food: 3, water_bottle: 3, bandage: 2, chocolate: 1 },
    inv: { water_bottle: 1 },
    bag: null,
  },
};
