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
    riskPoisonAt: 0.1,            // 식중독 확률이 이 이상이면 '위험한 아이템'으로 빨갛게 표시하고, 쓰기 전에 한 번 더 묻는다
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

    // 음식 버프 (특정 음식을 먹으면 일정 시간 동안). 여러 버프는 함께 걸리고, 같은 버프는 시간이 갱신된다
    // hungerMult·thirstMult: 배고픔·갈증 증가 배율, staminaDrainMult: 이동·수색·전투·운동 중 스테미너 소모 배율
    // staminaRegenMult: 쉬거나 잘 때 스테미너 회복 배율, fatigueMult: 깨어 있을 때 피로 증가 배율
    // win: 이길 확률 보너스(%), endFatigue: 끝날 때 피로 증가
    buffs: {
      hearty: { name: '든든함',     hungerMult: 0.5, staminaRegenMult: 1.5, desc: '배고픔 증가 -50% · 쉬거나 잘 때 스테미너 회복 +50%' },
      vigor:  { name: '기운',       win: 5,                                   desc: '이길 확률 +5%' },
      ration: { name: '군용 보급',  staminaDrainMult: 0.75, hungerMult: 0.75, desc: '스테미너 소모 -25% · 배고픔 증가 -25%' },
      sugar:  { name: '당 충전',    staminaDrainMult: 0.8,                    desc: '스테미너 소모 -20%' },
      awake:  { name: '각성',       fatigueMult: 0, endFatigue: 15,           desc: '피로가 오르지 않는다 · 끝나면 피로 +15' },
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
    bread:          { name: '눅눅한 빵',      cat: 'food',  w: 0.2,  r: 0, stack: 10, use: { hunger: -15, poison: 0.12 },  desc: '곰팡이 핀 부분만 떼어내면 된다. 아마도.', riskTip: '곰팡이를 떼어내도 탈이 날 수 있다.' },
    instant_noodle: { name: '컵라면',         cat: 'food',  w: 0.15, r: 0, stack: 10, use: { hunger: -20, thirst: 5 },     desc: '물 없이 부숴 먹는다. 짜다.' },
    chocolate:      { name: '초콜릿 바',      cat: 'food',  w: 0.1,  r: 1, stack: 20, use: { hunger: -10, stamina: 15 }, buff: ['sugar', 120],  desc: '작지만 힘이 난다.' },
    ration:         { name: '전투식량',       cat: 'food',  w: 0.6,  r: 2, stack: 5,  use: { hunger: -60, stamina: 20 }, buff: ['ration', 360], desc: '군용 비상식량. 든든하다.' },
    water_bottle:   { name: '생수',           cat: 'drink', w: 0.5,  r: 0, stack: 10, use: { thirst: -35 },                desc: '뚜껑이 밀봉된 500ml 생수.' },
    rain_water:     { name: '빗물',           cat: 'drink', w: 0.5,  r: 0, stack: 10, use: { thirst: -30, poison: 0.1 },   desc: '받아 둔 빗물. 깨끗하진 않다.', riskTip: '조리대에서 끓여 마시면 안전하다.' },
    boiled_water:   { name: '끓인 물',        cat: 'drink', w: 0.5,  r: 0, stack: 10, use: { thirst: -35 },                desc: '한 번 끓여서 안전하다.' },
    raw_meat:       { name: '날고기',         cat: 'food',  w: 0.5,  r: 0, stack: 10, use: { hunger: -20, poison: 0.5 },   desc: '익혀 먹어야 한다. 날로 먹으면 탈이 나기 쉽다.', riskTip: '조리대에서 구워 먹으면 안전하다.' },
    cooked_meat:    { name: '구운 고기',      cat: 'food',  w: 0.4,  r: 1, stack: 10, use: { hunger: -40, stamina: 5 }, buff: ['vigor', 240],  desc: '기름이 뚝뚝 떨어진다. 먹고 나면 힘이 솟는다.' },
    stew:           { name: '고기 스튜',      cat: 'food',  w: 0.8,  r: 1, stack: 5,  use: { hunger: -65, thirst: -10, stamina: 20 }, buff: ['hearty', 480], desc: '따뜻한 음식이 이렇게 위로가 될 줄이야.' },
    soda:           { name: '탄산음료',       cat: 'drink', w: 0.35, r: 0, stack: 10, use: { thirst: -20, stamina: 5 }, buff: ['sugar', 60],    desc: '김은 다 빠졌다.' },
    energy_drink:   { name: '에너지 드링크',  cat: 'drink', w: 0.3,  r: 1, stack: 10, use: { thirst: -15, stamina: 40, fatigue: -10 }, buff: ['awake', 240], desc: '심장이 빨리 뛴다. 효과가 끝나면 몰려오는 피로를 조심.' },

    bandage:        { name: '붕대',           cat: 'med',   w: 0.05, r: 0, stack: 20, use: { hp: 8 }, treat: { bleed: true },      desc: '상처를 감싸 피를 멈춘다.' },
    first_aid:      { name: '구급상자',       cat: 'med',   w: 0.4,  r: 1, stack: 5,  use: { hp: 35 }, treat: { bleed: true }, useMinutes: 15, desc: '제대로 된 응급처치 도구.' },
    painkiller:     { name: '진통제',         cat: 'med',   w: 0.05, r: 1, stack: 20, use: { hp: 5, stamina: 10 },         desc: '통증이 조금 가신다.' },
    splint:         { name: '부목',           cat: 'med',   w: 0.3,  r: 1, stack: 10, treat: { fracture: true }, useMinutes: 15, desc: '부러진 뼈를 고정한다.' },
    antibiotics:    { name: '항생제',         cat: 'med',   w: 0.05, r: 2, stack: 20, treat: { infection: 60 },            desc: '감염을 가라앉힌다. 귀하다.' },
    sedative:       { name: '진정제',         cat: 'med',   w: 0.05, r: 1, stack: 20, treat: { fear: true },               desc: '떨리는 손을 멈춘다.' },
    antidiarrheal:  { name: '지사제',         cat: 'med',   w: 0.05, r: 0, stack: 20, treat: { poison: true },             desc: '뒤집힌 속을 가라앉힌다.' },

    kitchen_knife:  { name: '부엌칼',         cat: 'weapon', w: 0.3, r: 0, stack: 1, atk: 5,  desc: '없는 것보단 낫다.' },
    bat:            { name: '야구방망이',     cat: 'weapon', w: 1.0, r: 0, stack: 1, atk: 9,  desc: '묵직하게 손에 감긴다.' },
    nail_bat:       { name: '못 박은 방망이', cat: 'weapon', w: 1.2, r: 1, stack: 1, atk: 12, desc: '야구방망이에 못을 박았다. 무식하지만 확실하다.' },
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
    gunpowder:        { name: '화약',         cat: 'material', w: 0.1,  r: 2, stack: 30, desc: '탄약을 만드는 재료.' },

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
             ['crowbar', 3], ['fire_axe', 1], ['machete', 0.8], ['gunpowder', 0.6]],
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
             ['pistol', 1.5], ['pistol_ammo', 5, 2, 8], ['riot_armor', 1.5], ['leather_jacket', 1], ['shells', 1, 1, 4], ['shotgun', 0.4], ['sedative', 1], ['splint', 1], ['gunpowder', 2, 1, 2]],
      flavor: ['당직실 캐비닛을 열었다.', '압수품 보관실을 뒤졌다.', '순찰차 트렁크를 열어 보았다.'],
    },
    {
      id: 'base', name: '군사기지', danger: 4, dist: 360, angle: 215, spots: 50, finds: [2, 3], emptyChance: 0.08,
      desc: '철조망 너머 버려진 군사기지. 무엇이 기다리고 있는지 아무도 모른다.',
      loot: [['ration', 5, 1, 2], ['bag_military', 1.2], ['bag_tactical', 2], ['engine_part', 2], ['electronic', 3, 1, 2], ['fuel', 3], ['first_aid', 3], ['battery', 3, 1, 2], ['wire', 3], ['tools', 2], ['energy_drink', 3], ['water_bottle', 4],
             ['shotgun', 1], ['shells', 3, 2, 6], ['pistol', 2], ['pistol_ammo', 4, 3, 10], ['military_vest', 1], ['riot_armor', 1.5], ['antibiotics', 2], ['splint', 2], ['fire_axe', 1], ['gunpowder', 2, 1, 3]],
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
      drops: [['raw_meat', 0.8, 1, 2]],
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
    { id: 'rabbit', on: ['travel'], weight: 3, title: '올무에 걸린 토끼',
      text: ['누군가 놓은 올무에 토끼가 걸려 있었다. 미안하지만 오늘 저녁거리다.'],
      outcome: { items: [['raw_meat', 1, 1]] } },
    { id: 'backpack_road', on: ['travel'], weight: 2, title: '버려진 배낭',
      text: ['길 한가운데 배낭 하나가 떨어져 있다. 주인은 보이지 않는다.'],
      outcome: { loot: 2 } },

    { id: 'rest_found', on: ['rest'], weight: 3, outside: true, title: '구석의 물건',
      text: ['쉬려고 앉은 자리 옆에 무언가 굴러다닌다.'],
      outcome: { loot: 1 } },
    { id: 'rest_fear', on: ['rest'], weight: 3, outside: true, title: '인기척',
      text: ['어디선가 발소리가 들렸다. 쉬는 둥 마는 둥 했다.'],
      outcome: { fatigue: 5, debuffs: [['fear', 0.3]] } },

    { id: 'rats_home', on: ['sleep'], weight: 4, title: '쥐', blockedBy: { fac: 'wall', lv: 1 },
      text: ['밤새 바스락거리는 소리가 났다. 쥐가 창고를 뒤졌다.'],
      outcome: { stashLoseFood: 1 } },
    { id: 'rain_home', on: ['sleep'], weight: 4, title: '밤비',
      text: ['밤새 비가 내렸다. 거점 앞 양동이에 빗물이 고였다.'],
      outcome: { items: [['rain_water', 1, 2]] } },
    { id: 'knock', on: ['sleep'], weight: 2, title: '문 두드리는 소리',
      text: ['한밤중 누군가 철문을 두드렸다. 숨죽이고 기다리자 발소리가 멀어졌다. 아침에 나가 보니 문 앞에 작은 꾸러미가 놓여 있었다.'],
      outcome: { items: [['canned_food', 1, 1], ['bandage', 1, 2, 0.6], ['antibiotics', 1, 1, 0.15]] } },
    { id: 'nightmare', on: ['sleep'], weight: 4, title: '악몽', softenedBy: { fac: 'wall', lv: 2, mult: 0.5 },
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

  // 하이드아웃 시설. 레벨마다 cost(재료), req(선행 시설 레벨), time(공사 시간, 분), effect(설명)과 효과 수치
  // 공사는 한 번에 하나, 거점을 비워도 시간이 지나면 진행된다
  facilityOrder: ['generator', 'workbench', 'stash', 'bed', 'medbay', 'kitchen', 'water', 'gym', 'wall'],
  facilities: {
    generator: { name: '발전기', desc: '다른 시설에 전기를 댄다. 연료통을 넣어야 돌아간다.', levels: [
      { cost: [['scrap_metal', 5], ['wire', 3], ['battery', 2], ['tools', 1]], req: { workbench: 1 }, time: 360, fuelHours: 24, tank: 72, effect: '연료통 1개로 24시간 · 최대 72시간' },
      { cost: [['scrap_metal', 6], ['wire', 4], ['electronic', 2]], req: { workbench: 2 }, time: 480, fuelHours: 36, tank: 108, effect: '연료통 1개로 36시간 · 최대 108시간' },
      { cost: [['engine_part', 1], ['electronic', 3], ['wire', 4]], req: { workbench: 3 }, time: 720, fuelHours: 48, tank: 144, effect: '연료통 1개로 48시간 · 최대 144시간' },
    ] },
    workbench: { name: '작업대', desc: '도구와 무기, 방어구를 만든다.', levels: [
      { cost: [['wood', 5], ['nails', 4], ['duct_tape', 2]], req: {}, time: 180, effect: '붕대, 부목, 못 박은 방망이 제작' },
      { cost: [['scrap_metal', 4], ['tools', 1], ['pipe', 2], ['wire', 2]], req: { stash: 1 }, time: 360, effect: '두꺼운 패딩, 마체테, 등산 가방 제작' },
      { cost: [['tools', 2], ['electronic', 3], ['wire', 4], ['battery', 2]], req: { generator: 1 }, time: 600, effect: '탄약, 진압복 제작 (전력 필요)' },
    ] },
    stash: { name: '창고', desc: '물건을 보관한다. 레벨이 오를수록 칸이 늘어난다.', levels: [
      { cost: [['wood', 4], ['nails', 3]], req: {}, time: 120, slots: 15, effect: '창고 45칸' },
      { cost: [['wood', 6], ['scrap_metal', 3], ['nails', 5], ['tools', 1]], req: { workbench: 1 }, time: 240, slots: 30, effect: '창고 60칸' },
      { cost: [['scrap_metal', 8], ['pipe', 4], ['nails', 8], ['wire', 2]], req: { workbench: 2 }, time: 480, slots: 50, effect: '창고 80칸' },
    ] },
    bed: { name: '침대', desc: '잠의 질이 좋아진다.', levels: [
      { cost: [['wood', 4], ['cloth', 6], ['nails', 2]], req: {}, time: 120, fatigueMult: 1.2, hp: 1, effect: '잘 때 피로 회복 +20%, HP 회복 +1/시간' },
      { cost: [['wood', 6], ['cloth', 10], ['duct_tape', 2]], req: { workbench: 1 }, time: 240, fatigueMult: 1.4, hp: 2, effect: '잘 때 피로 회복 +40%, HP 회복 +2/시간' },
      { cost: [['cloth', 14], ['electronic', 1], ['battery', 1]], req: { generator: 1 }, time: 360, fatigueMult: 1.6, hp: 3, calm: true, effect: '잘 때 피로 회복 +60%, HP 회복 +3/시간, 자고 나면 공포가 사라진다' },
    ] },
    medbay: { name: '의무실', desc: '거점에서 쉬는 동안 몸을 돌보고, 약을 만든다.', levels: [
      { cost: [['wood', 3], ['cloth', 5], ['medical_supplies', 2]], req: { bed: 1 }, time: 180, hp: 2, effect: '거점에서 쉬거나 잘 때 HP 회복 +2/시간, 골절 회복 2배, 진통제·지사제 제작' },
      { cost: [['medical_supplies', 4], ['electronic', 1], ['plastic', 4]], req: { generator: 1 }, time: 360, hp: 4, effect: 'HP 회복 +4/시간, 구급상자·진정제 제작' },
      { cost: [['medical_supplies', 6], ['electronic', 3], ['battery', 2]], req: { generator: 2 }, time: 600, hp: 6, effect: 'HP 회복 +6/시간, 항생제 제작' },
    ] },
    kitchen: { name: '조리대', desc: '날것을 익히고 물을 끓인다.', levels: [
      { cost: [['scrap_metal', 2], ['wood', 3], ['pipe', 1]], req: {}, time: 120, effect: '물 끓이기, 고기 굽기' },
      { cost: [['scrap_metal', 4], ['pipe', 2], ['plastic', 3]], req: { workbench: 1 }, time: 240, effect: '고기 스튜, 고기 두 개 한꺼번에 굽기' },
      { cost: [['electronic', 1], ['wire', 2], ['battery', 1]], req: { generator: 1 }, time: 360, effect: '전기로 물 끓이기, 전투식량 만들기 (전력 필요)' },
    ] },
    water: { name: '정수기', desc: '전기로 깨끗한 물을 만든다. 전력이 있어야 돌아간다.', levels: [
      { cost: [['plastic', 4], ['pipe', 2], ['duct_tape', 2]], req: { generator: 1 }, time: 180, every: 360, max: 5, effect: '6시간마다 생수 1개 (최대 5개 보관)' },
      { cost: [['pipe', 4], ['wire', 2], ['plastic', 6], ['tools', 1]], req: { generator: 2 }, time: 360, every: 240, max: 8, effect: '4시간마다 생수 1개 (최대 8개 보관)' },
      { cost: [['electronic', 2], ['pipe', 6], ['battery', 2]], req: { generator: 2, workbench: 3 }, time: 600, every: 180, max: 12, effect: '3시간마다 생수 1개 (최대 12개 보관)' },
    ] },
    gym: { name: '체육관', desc: '몸을 단련한다.', levels: [
      { cost: [['wood', 4], ['scrap_metal', 4], ['pipe', 2]], req: { bed: 1 }, time: 180, xpMult: 1.1, exercise: 1, effect: '운동하기 가능, 힘·지구력 경험치 +10%' },
      { cost: [['scrap_metal', 8], ['pipe', 4], ['tools', 1]], req: { workbench: 2 }, time: 360, xpMult: 1.2, exercise: 1.5, effect: '운동 효과 1.5배, 힘·지구력 경험치 +20%' },
      { cost: [['scrap_metal', 12], ['pipe', 6], ['electronic', 1]], req: { generator: 1 }, time: 600, xpMult: 1.3, exercise: 2, effect: '운동 효과 2배, 힘·지구력 경험치 +30%' },
    ] },
    wall: { name: '방어벽', desc: '거점을 지킨다. 밤 습격은 5단계에서 추가된다.', levels: [
      { cost: [['wood', 6], ['nails', 6], ['scrap_metal', 2]], req: { workbench: 1 }, time: 240, effect: '쥐가 창고에 못 들어온다' },
      { cost: [['scrap_metal', 8], ['nails', 8], ['wire', 3]], req: { workbench: 2 }, time: 480, effect: '마음 놓고 자서 악몽을 덜 꾼다' },
      { cost: [['scrap_metal', 12], ['pipe', 6], ['tools', 2], ['battery', 2]], req: { generator: 2 }, time: 720, effect: '경보 장치. 밤 습격 방어 최고 단계' },
    ] },
  },
  // 제작법. at: 시설, lv: 필요한 시설 레벨, in: 재료, out: [결과물, 개수], time: 분, power: 전력 필요
  recipes: [
    { id: 'r_bandage',      at: 'workbench', lv: 1, in: [['cloth', 3]], out: ['bandage', 2], time: 30 },
    { id: 'r_splint',       at: 'workbench', lv: 1, in: [['wood', 1], ['cloth', 2], ['duct_tape', 1]], out: ['splint', 1], time: 40 },
    { id: 'r_nail_bat',     at: 'workbench', lv: 1, in: [['bat', 1], ['nails', 2], ['duct_tape', 1]], out: ['nail_bat', 1], time: 60 },
    { id: 'r_padded',       at: 'workbench', lv: 2, in: [['cloth', 10], ['duct_tape', 2]], out: ['padded_jacket', 1], time: 120 },
    { id: 'r_machete',      at: 'workbench', lv: 2, in: [['scrap_metal', 3], ['duct_tape', 1], ['cloth', 2]], out: ['machete', 1], time: 120 },
    { id: 'r_bag',          at: 'workbench', lv: 2, in: [['cloth', 12], ['duct_tape', 4], ['pipe', 1]], out: ['bag_hiking', 1], time: 180 },
    { id: 'r_pistol_ammo',  at: 'workbench', lv: 3, power: true, in: [['scrap_metal', 1], ['gunpowder', 1]], out: ['pistol_ammo', 6], time: 60 },
    { id: 'r_shells',       at: 'workbench', lv: 3, power: true, in: [['scrap_metal', 1], ['gunpowder', 1], ['plastic', 1]], out: ['shells', 4], time: 60 },
    { id: 'r_riot',         at: 'workbench', lv: 3, power: true, in: [['scrap_metal', 8], ['cloth', 10], ['duct_tape', 4]], out: ['riot_armor', 1], time: 240 },
    { id: 'r_painkiller',   at: 'medbay', lv: 1, in: [['medical_supplies', 1]], out: ['painkiller', 2], time: 30 },
    { id: 'r_antidiarrheal', at: 'medbay', lv: 1, in: [['medical_supplies', 1], ['boiled_water', 1]], out: ['antidiarrheal', 2], time: 30 },
    { id: 'r_first_aid',    at: 'medbay', lv: 2, in: [['bandage', 3], ['medical_supplies', 2], ['plastic', 1]], out: ['first_aid', 1], time: 60 },
    { id: 'r_sedative',     at: 'medbay', lv: 2, power: true, in: [['medical_supplies', 2]], out: ['sedative', 2], time: 60 },
    { id: 'r_antibiotics',  at: 'medbay', lv: 3, power: true, in: [['medical_supplies', 3], ['boiled_water', 1]], out: ['antibiotics', 1], time: 180 },
    { id: 'r_boil',         at: 'kitchen', lv: 1, in: [['rain_water', 2], ['wood', 1]], out: ['boiled_water', 2], time: 30 },
    { id: 'r_grill',        at: 'kitchen', lv: 1, in: [['raw_meat', 1], ['wood', 1]], out: ['cooked_meat', 1], time: 30 },
    { id: 'r_grill2',       at: 'kitchen', lv: 2, in: [['raw_meat', 2], ['wood', 1]], out: ['cooked_meat', 2], time: 40 },
    { id: 'r_stew',         at: 'kitchen', lv: 2, in: [['raw_meat', 1], ['canned_food', 1], ['boiled_water', 1]], out: ['stew', 1], time: 60 },
    { id: 'r_boil_e',       at: 'kitchen', lv: 3, power: true, in: [['rain_water', 3]], out: ['boiled_water', 3], time: 30 },
    { id: 'r_ration',       at: 'kitchen', lv: 3, power: true, in: [['cooked_meat', 1], ['chocolate', 1], ['canned_food', 1]], out: ['ration', 2], time: 120 },
  ],
  // 체육관 운동하기
  exercise: { minutes: 60, xp: 8, minStamina: 25, staminaPerHour: 25, fatiguePerHour: 8 },
  medbayFractureMult: 2,

  // 스킬: 행동할수록 오른다 (타르코프식). 레벨 0~35
  // 다음 레벨까지 필요한 경험치 = xpBase + xpPerLevel × 현재 레벨
  // 하루에 dailySoft 넘게 얻으면 효율이 떨어지고(최소 minEfficiency), 날이 바뀌면 회복된다
  skills: {
    max: 35,
    xpBase: 8,
    xpPerLevel: 5,
    dailySoft: 40,
    minEfficiency: 0.25,
    list: {
      strength:  { name: '힘',             train: '짐을 지고 움직이거나 근접 무기·맨손으로 싸우면 오른다. 짐이 무거울수록 빨리 오른다.',
                   meleePerLv: 1, carryEvery: 5, carryKg: 3 },
      endurance: { name: '지구력',         train: '오래 걷거나, 싸우거나, 도망치면 오른다.',
                   dodgePerLv: 0.4, travelPerLv: 0.008 },
      vitality:  { name: '체력',           train: '다치고도 살아남으면 오른다.',
                   hpPerLv: 3 },
      focus:     { name: '집중력',         train: '수색할수록 오른다. 귀한 물건을 찾으면 더 오른다.',
                   searchPerLv: 0.01, rarePerLv: 0.02, extraFindPerLv: 0.015 },
      resolve:   { name: '스트레스 저항력', train: '적과 마주치거나, 디버프에 걸리거나, 밤에 수색하면 오른다.',
                   chancePerLv: 0.008, durationPerLv: 0.01 },
      metabolism: { name: '신진대사',      train: '먹고 마실수록 오른다. 든든하게 먹을수록 더 오른다.',
                   drainPerLv: 0.01, foodPerLv: 0.015 },
    },
    // 경험치를 얻는 행동
    xp: {
      carryPerHour: 5,      // 힘: 이동·수색·전투 시간당 × (짐 무게 ÷ 중량 한계, 최대 1.5)
      meleeWin: 6, meleeLose: 3,   // 힘: 근접 싸움
      travelPerHour: 5,     // 지구력: 이동 시간당
      fight: 2,             // 지구력: 싸움 1번
      fleeSuccess: 5, fleeFail: 2, // 지구력: 도망
      hpLost: 0.25,         // 체력: 잃은 HP 1당
      search: 4,            // 집중력: 수색 1번
      rareFind: 3,          // 집중력: 희귀 이상 물건 발견
      encounter: 3,         // 스트레스 저항력: 적과 마주침 (+ 무서운 적일수록 더)
      debuff: 6,            // 스트레스 저항력: 디버프에 걸림
      nightSearch: 2,       // 스트레스 저항력: 밤에 수색
      eat: 0.1,             // 신진대사: 음식·음료로 줄인 배고픔·갈증 1당 (기본 수치 기준)
    },
  },

  // 스토리
  story: {
    prologue: {
      title: '그날 이후',
      paragraphs: [
        '3월 15일, 도시는 하룻밤 사이에 무너졌다. 사이렌이 울렸고, 다리가 막혔고, 이웃들은 서로를 물어뜯기 시작했다.',
        '석 달이 지났다. 당신은 도시 외곽의 낡은 지하 창고에 숨어 지낸다. 철문 하나, 담요 한 장, 줄어드는 통조림 몇 개가 전부다.',
        '밖에는 아직 쓸 만한 것들이 남아 있다. 그리고 그것을 노리는 것들도.',
        '살아남아라. 그리고 이 도시에 무슨 일이 있었는지 알아내라.',
      ],
      button: '철문을 연다',
    },
    // 날이 바뀌면 남기는 일지. 정해진 날은 그 문장, 나머지 날은 dayPool에서 고른다
    days: {
      2: '2일차. 밤새 멀리서 개 짖는 소리가 났다. 아직 살아 있다.',
      3: '3일차. 라디오 주파수를 돌려 봤다. 잡음뿐이다. 그래도 매일 한 번은 돌려 보기로 했다.',
      4: '4일차. 창고 벽에 날짜를 새기기 시작했다. 오늘을 잊지 않으려고.',
      5: '5일차. 꿈에 무너지기 전의 거리가 나왔다. 깨고 나니 더 조용했다.',
      6: '6일차. 라디오에서 아주 잠깐 사람 목소리가 들렸다. "…기지…" 그 한마디뿐이었다.',
      7: '7일차. 일주일을 버텼다. 처음엔 사흘도 못 버틸 줄 알았다.',
      8: '8일차. 손에 굳은살이 박였다. 예전의 내 손 같지 않다.',
      10: '10일차. 열흘. 이제 누구를 기다리는 건지도 잘 모르겠다.',
      14: '14일차. 두 주가 지났다. 벽에 새긴 줄이 제법 길어졌다.',
      21: '21일차. 세 주. 라디오는 여전히 잡음뿐이다. 그래도 돌린다.',
      30: '30일차. 한 달. 이 도시에 나 말고도 누군가 남아 있을까.',
    },
    dayPool: [
      '{day}일차. 바람이 차다.',
      '{day}일차. 오늘도 해가 떴다. 그것만으로도 다행이다.',
      '{day}일차. 철문 경첩에 기름을 쳤다. 소리가 덜 난다.',
      '{day}일차. 어제 본 감염자의 얼굴이 자꾸 떠오른다. 누군가의 가족이었겠지.',
      '{day}일차. 하늘에서 헬기 소리가 들린 것 같았다. 착각이었다.',
      '{day}일차. 창고 구석에 쥐구멍을 하나 더 찾아 막았다.',
      '{day}일차. 오랜만에 소리 내어 말해 봤다. 내 목소리가 낯설다.',
    ],
    // 장소마다 하나씩 숨겨진 기록. 그곳을 수색하다 보면 찾는다
    fragmentChance: 0.2,
    fragments: [
      { id: 'note_houses',   loc: 'houses',   title: '냉장고에 붙은 메모',     text: '"여보, 애들 데리고 학교 체육관으로 먼저 가. 나는 약국 들렀다가 따라갈게. 문 꼭 잠그고." 날짜는 3월 14일이다.' },
      { id: 'note_store',    loc: 'store',    title: '영수증 뒷면',            text: '"생수 12, 라면 30, 건전지. 계산대 아저씨 말로는 군인들이 다리를 막고 있단다. 시내로는 못 들어간대."' },
      { id: 'note_gas',      loc: 'gas',      title: '정비 일지',              text: '"3월 9일. 탱크로리 기사가 그러는데, 요즘 기지 쪽에서 밤마다 사이렌이 운단다. 훈련이겠지."' },
      { id: 'note_hardware', loc: 'hardware', title: '주인의 장부',            text: '"합판, 못, 철망 다 팔렸다. 다들 창문을 막는다. 나도 셔터 내리고 2층에서 지낸다. 아래층에서 뭔가 긁는 소리가 난다."' },
      { id: 'note_school',   loc: 'school',   title: '칠판의 글씨',            text: '"대피소 운영 4일째. 아이들 112명. 물이 모자라다. 군 수송 트럭이 오기로 했는데 오지 않는다. 오늘 밤은 체육관 문을 잠근다."' },
      { id: 'note_mart',     loc: 'mart',     title: '무전기 녹음',            text: '"…여기는 북부 대피 본부… 생존자는 군사기지 정문으로… 반복한다, 정문으로… 감염자는 절대 기지 안으로… [잡음]"' },
      { id: 'note_hospital', loc: 'hospital', title: '응급실 의사의 수첩',     text: '"상처가 이상하다. 물린 자리가 아니라 혈관을 따라 번진다. 군에서 온 사람들이 샘플을 가져갔다. 어디서 시작된 거냐고 묻자 대답하지 않았다."' },
      { id: 'note_police',   loc: 'police',   title: '상황실 무전 기록',       text: '"18:40 기지 통신 두절. 19:05 정문 방면 총성 다수. 19:30 상부 지시: 전 인원 철수, 시민 통제 해제. …우리가 마지막이다."' },
      { id: 'note_base',     loc: 'base',     title: '연구동 출입 기록',       text: '"실험체 격리 실패. 3층 봉쇄. 정문 대피 인원은 받지 말 것." 맨 아래에 누군가 볼펜으로 덧붙였다. "이걸 읽는 사람이 있다면, 우리가 시작했다. 미안하다."' },
    ],
    allFragments: '흩어진 기록을 모두 모았다. 사이렌, 막힌 다리, 오지 않은 트럭, 그리고 기지. 이 도시는 사고로 무너진 게 아니었다.',
    // 처음 겪는 순간
    moments: {
      firstKill: '처음으로 무언가를 죽였다. 손이 한참 동안 떨렸다.',
      firstNight: '밖에서 밤을 맞았다. 어둠이 이렇게 깊은 줄 몰랐다.',
      firstOverweight: '짐이 어깨를 짓누른다. 욕심일까, 생존일까.',
      firstDebuff: '몸이 망가지는 건 한순간이다. 조심해야 한다.',
      firstLevel: '몸이 이 세계에 적응하고 있다. 조금씩, 그러나 확실하게.',
      firstWake: '죽음의 문턱까지 갔다가 돌아온 기분이다. 다음은 없을지도 모른다.',
    },
  },

  start: {
    stash: { canned_food: 3, water_bottle: 3, bandage: 2, chocolate: 1 },
    inv: { water_bottle: 1 },
    bag: null,
  },
};
