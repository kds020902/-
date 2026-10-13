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
    // 장비: 큰 무기 2개 + 작은 무기 1개, 옷은 최대 3겹
    // 옷 두께 합이 freeThickness를 넘으면 넘은 1당 행동시간·스테미너 소모가 늘고 승률·도망 확률이 떨어진다
    equip: { large: 2, small: 1, layers: 3, freeThickness: 3, perTime: 0.06, perStamina: 0.08, perWin: 2, perFlee: 4 },
    riskPoisonAt: 0.1,
    // 익히기: 거점에서 식중독 위험이 있는 음식(cook가 있는 것)을 목재 1개로 한 번에 안전하게 만든다
    // 발전기가 켜져 있으면 전기로 해서 목재를 쓰지 않는다
    // 걸리는 시간 = minutes + perItem × 개수, 조리대가 있으면 × kitchenTimeMult
    cook: { fuel: 'wood', fuelCount: 1, minutes: 20, perItem: 5, kitchenTimeMult: 0.5 },
    // 대체 재료: 제작·공사 재료로 왼쪽 아이템 대신 오른쪽 아이템을 써도 된다 (왼쪽부터 먼저 쓴다)
    substitutes: { boiled_water: ['water_bottle'] },
    // 숨기기: 숨길 곳마다 털릴 확률(하루에 한 번 판정)과 숨기는 시간이 새 게임마다 무작위로 정해진다
    // 털릴 확률 = riskMin~riskMax + 위험도 × riskPerDanger, 꺼낼 때는 숨기는 시간 × retrieveMult
    // groundTheft: 바닥에 그냥 두고 간 물건이 날이 바뀔 때 사라질 확률
    hide: { riskMin: 0.03, riskMax: 0.30, riskPerDanger: 0.03, timeMin: 10, timeMax: 60, retrieveMult: 0.5, groundTheft: 0.6 },            // 식중독 확률이 이 이상이면 '위험한 아이템'으로 빨갛게 표시하고, 쓰기 전에 한 번 더 묻는다
    respawn: { hp: 50, stamina: 50, hunger: 40, thirst: 40, fatigue: 20, hour: 8 },

    // 전투 (확률 % 단위)
    combat: {
      base: [85, 75, 60, 45, 30],                      // 위험도별 기본 승률(%)
      encounter: [0.05, 0.15, 0.30, 0.45, 0.60],       // 수색 1회당 조우 확률
      travelPerHour: [0.03, 0.06, 0.10, 0.14, 0.18],   // 이동 1시간당 조우 확률 (출발지·도착지 중 더 위험한 쪽 기준)
      restMult: 0.4,                                   // 바깥에서 쉴 때 조우 확률 = 수색 조우 확률 × 0.4
      nightEncounterMult: 1.3,                         // 밤에는 조우 확률 1.3배
      nightWin: -8,                                    // 밤에는 승률 -8%
      ammoSaveMargin: 3,                               // 탄약 안 쓰는 무기가 총보다 이만큼(%) 이내면 그 무기를 먼저 고른다
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
      // 감염: start%에서 시작해 시간당 growPerHour%씩 퍼진다. 감염이 n%면 하루에 최대 HP의 n% × dailyHpMult를 잃는다 (시간마다 나눠서)
      infection: { name: '감염',   start: 10, growPerHour: 1.2, dailyHpMult: 1, win: -5, winAt: 50,
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
      // 조리대·의무실 4~7레벨 아이템. fearMult/infectMult/dbfMult: 디버프 확률 배수 · infectGrow: 감염 진행 배수
      // hpRegen: 시간당 HP 회복 · carry: 중량 한계 +kg
      cozy:       { name: '포근함',     fearMult: 0.5, fatigueMult: 0.8,          desc: '공포에 걸릴 확률 -50% · 피로 증가 -20%' },
      strong:     { name: '힘이 넘침',  carry: 5,                                 desc: '중량 한계 +5kg' },
      tonic:      { name: '보양',       hpRegen: 2, dbfMult: 0.8,                 desc: 'HP 회복 +2/시간 · 디버프 확률 -20%' },
      immune:     { name: '면역',       infectMult: 0.3, infectGrow: 0.5,         desc: '감염될 확률 -70% · 감염 진행 -50%' },
      adrenaline: { name: '아드레날린', win: 10, staminaDrainMult: 0.5, endFatigue: 25, desc: '이길 확률 +10% · 스테미너 소모 -50% · 끝나면 피로 +25' },
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
  // atk: 승률 보너스(%), ammo: 필요한 탄약, ammoUse: 싸움마다 쓰는 탄약, noAmmoAtk: 탄약이 없을 때 승률 보너스, size: large(큰 무기) / small(작은 무기)
  // def: 졌을 때 받는 피해 감소, dbf: 디버프 걸릴 확률 감소, thick: 옷 두께 (껴입으면 합산)
  // salvage: 해체하면 나오는 재료 [재료, 개수]. 고급 이상 재료는 개수마다 확률로 회수한다
  items: {
    canned_food:    { name: '통조림',         cat: 'food',  w: 0.4,  r: 0, stack: 10, use: { hunger: -30, poison: 0.03 },  desc: '유통기한은 지났지만 아직 먹을 만하다.' },
    bread:          { name: '눅눅한 빵',      cat: 'food',  w: 0.2,  r: 0, stack: 10, use: { hunger: -15, poison: 0.12 },  desc: '곰팡이 핀 부분만 떼어내면 된다. 아마도.', cook: ['toast', 1], riskTip: '거점에서 바싹 구우면 안전하게 먹을 수 있다.' },
    toast:          { name: '구운 빵',        cat: 'food',  w: 0.2,  r: 0, stack: 10, use: { hunger: -18 },                desc: '바싹 구우니 곰팡이 냄새가 사라졌다.' },
    instant_noodle: { name: '컵라면',         cat: 'food',  w: 0.15, r: 0, stack: 10, use: { hunger: -20, thirst: 5 },     desc: '물 없이 부숴 먹는다. 짜다.' },
    chocolate:      { name: '초콜릿 바',      cat: 'food',  w: 0.1,  r: 1, stack: 20, use: { hunger: -10, stamina: 15 }, buff: ['sugar', 120],  desc: '작지만 힘이 난다.' },
    ration:         { name: '전투식량',       cat: 'food',  w: 0.6,  r: 2, stack: 5,  use: { hunger: -60, stamina: 20 }, buff: ['ration', 360], desc: '군용 비상식량. 든든하다.' },
    water_bottle:   { name: '생수',           cat: 'drink', w: 0.5,  r: 0, stack: 10, use: { thirst: -35 },                desc: '뚜껑이 밀봉된 500ml 생수.' },
    rain_water:     { name: '빗물',           cat: 'drink', w: 0.5,  r: 0, stack: 10, use: { thirst: -30, poison: 0.1 },   desc: '받아 둔 빗물. 깨끗하진 않다.', cook: ['boiled_water', 1], riskTip: '거점에서 끓여 마시면 안전하다.' },
    boiled_water:   { name: '끓인 물',        cat: 'drink', w: 0.5,  r: 0, stack: 10, use: { thirst: -35 },                desc: '한 번 끓여서 안전하다.' },
    raw_meat:       { name: '날고기',         cat: 'food',  w: 0.5,  r: 0, stack: 10, use: { hunger: -20, poison: 0.5 },   desc: '익혀 먹어야 한다. 날로 먹으면 탈이 나기 쉽다.', cook: ['cooked_meat', 1], riskTip: '거점에서 구워 먹으면 안전하다.' },
    cooked_meat:    { name: '구운 고기',      cat: 'food',  w: 0.4,  r: 1, stack: 10, use: { hunger: -40, stamina: 5 }, buff: ['vigor', 240],  desc: '기름이 뚝뚝 떨어진다. 먹고 나면 힘이 솟는다.' },
    jerky:          { name: '육포',           cat: 'food',  w: 0.1,  r: 1, stack: 20, use: { hunger: -25, thirst: 5 },     desc: '바싹 말려 가볍다. 먼 길을 갈 때 짐이 되지 않는다.' },
    meat_ramen:     { name: '고기 라면',      cat: 'food',  w: 0.5,  r: 1, stack: 5,  use: { hunger: -50, thirst: 10, stamina: 15 }, buff: ['strong', 360], desc: '라면에 고기를 듬뿍 넣었다. 먹고 나면 뭐든 들 수 있을 것 같다.' },
    tonic_soup:     { name: '보양 수프',      cat: 'food',  w: 0.8,  r: 2, stack: 5,  use: { hunger: -55, thirst: -15, hp: 15 }, buff: ['tonic', 720], desc: '고기를 오래 고았다. 몸 깊은 곳까지 따뜻해진다.' },
    stew:           { name: '고기 스튜',      cat: 'food',  w: 0.8,  r: 1, stack: 5,  use: { hunger: -65, thirst: -10, stamina: 20 }, buff: ['hearty', 480], desc: '따뜻한 음식이 이렇게 위로가 될 줄이야.' },
    soda:           { name: '탄산음료',       cat: 'drink', w: 0.35, r: 0, stack: 10, use: { thirst: -20, stamina: 5 }, buff: ['sugar', 60],    desc: '김은 다 빠졌다.' },
    cocoa:          { name: '따뜻한 코코아',  cat: 'drink', w: 0.3,  r: 1, stack: 10, use: { thirst: -20, hunger: -10, fatigue: -5 }, treat: { fear: true }, buff: ['cozy', 360], desc: '초콜릿을 끓는 물에 녹였다. 손이 덜 떨린다.' },
    energy_drink:   { name: '에너지 드링크',  cat: 'drink', w: 0.3,  r: 1, stack: 10, use: { thirst: -15, stamina: 40, fatigue: -10 }, buff: ['awake', 240], desc: '심장이 빨리 뛴다. 효과가 끝나면 몰려오는 피로를 조심.' },

    bandage:        { name: '붕대',           cat: 'med',   w: 0.05, r: 0, stack: 20, use: { hp: 8 }, treat: { bleed: true },      desc: '상처를 감싸 피를 멈춘다.' },
    first_aid:      { name: '구급상자',       cat: 'med',   w: 0.4,  r: 1, stack: 5,  use: { hp: 35 }, treat: { bleed: true }, useMinutes: 15, desc: '제대로 된 응급처치 도구.' },
    painkiller:     { name: '진통제',         cat: 'med',   w: 0.05, r: 1, stack: 20, use: { hp: 5, stamina: 10 },         desc: '통증이 조금 가신다.' },
    splint:         { name: '부목',           cat: 'med',   w: 0.3,  r: 1, stack: 10, treat: { fracture: true }, useMinutes: 15, desc: '부러진 뼈를 고정한다.' },
    antibiotics:    { name: '항생제',         cat: 'med',   w: 0.05, r: 2, stack: 20, treat: { infection: 60 },            desc: '감염을 가라앉힌다. 귀하다.' },
    iv_pack:        { name: '수액 팩',        cat: 'med',   w: 0.6,  r: 1, stack: 5,  use: { hp: 20, thirst: -40, stamina: 30 }, useMinutes: 30, desc: '끓인 물로 만든 수액. 탈진했을 때 한 번에 일으켜 세운다.' },
    immune_shot:    { name: '면역 주사',      cat: 'med',   w: 0.05, r: 2, stack: 10, use: {}, buff: ['immune', 1440], desc: '하루 동안 감염에 잘 걸리지 않고, 걸려도 천천히 퍼진다.' },
    stim:           { name: '전투 자극제',    cat: 'med',   w: 0.05, r: 2, stack: 10, use: { stamina: 50 }, buff: ['adrenaline', 120], desc: '심장이 터질 것 같다. 두 시간 동안은 무엇과도 싸울 수 있다.' },
    surgery_kit:    { name: '수술 키트',      cat: 'med',   w: 0.8,  r: 3, stack: 3,  use: { hp: 50 }, treat: { bleed: true, fracture: true, infection: 50 }, useMinutes: 60, desc: '출혈, 골절, 감염을 한 번에 손본다. 시간이 오래 걸린다.' },
    serum:          { name: '실험용 혈청',    cat: 'med',   w: 0.05, r: 3, stack: 5,  use: {}, treat: { infection: 100 }, buff: ['immune', 4320], desc: '연구원 김정우가 만든 혈청. 깊은 감염도 되돌리고, 사흘 동안 감염에 강해진다.' },
    sedative:       { name: '진정제',         cat: 'med',   w: 0.05, r: 1, stack: 20, treat: { fear: true },               desc: '떨리는 손을 멈춘다.' },
    antidiarrheal:  { name: '지사제',         cat: 'med',   w: 0.05, r: 0, stack: 20, treat: { poison: true },             desc: '뒤집힌 속을 가라앉힌다.' },

    kitchen_knife:  { name: '부엌칼',         cat: 'weapon', size: 'small', w: 0.3, r: 0, stack: 1, atk: 5,  salvage: [['scrap_metal', 1]], desc: '없는 것보단 낫다.' },
    bat:            { name: '야구방망이',     cat: 'weapon', size: 'large', w: 1.0, r: 0, stack: 1, atk: 9,  salvage: [['wood', 1]], desc: '묵직하게 손에 감긴다.' },
    nail_bat:       { name: '못 박은 방망이', cat: 'weapon', size: 'large', w: 1.2, r: 1, stack: 1, atk: 12, salvage: [['wood', 1], ['nails', 1]], desc: '야구방망이에 못을 박았다. 무식하지만 확실하다.' },
    crowbar:        { name: '빠루',           cat: 'weapon', size: 'large', w: 1.8, r: 0, stack: 1, atk: 8,  salvage: [['scrap_metal', 1]], desc: '잠긴 문을 조용히 열 수 있다.' },
    machete:        { name: '마체테',         cat: 'weapon', size: 'small', w: 0.8, r: 1, stack: 1, atk: 13, salvage: [['scrap_metal', 1], ['cloth', 1]], desc: '가볍고 날카롭다.' },
    fire_axe:       { name: '소방 도끼',      cat: 'weapon', size: 'large', w: 2.5, r: 1, stack: 1, atk: 16, salvage: [['scrap_metal', 1], ['wood', 1]], desc: '무겁지만 한 방이 확실하다.' },
    pistol:         { name: '권총',           cat: 'weapon', size: 'small', w: 1.0, r: 2, stack: 1, atk: 22, ammo: 'pistol_ammo', ammoUse: [1, 2], noAmmoAtk: 4, salvage: [['scrap_metal', 1], ['gunpowder', 1]], desc: '탄약이 있어야 제값을 한다.' },
    shotgun:        { name: '산탄총',         cat: 'weapon', size: 'large', w: 3.5, r: 3, stack: 1, atk: 30, ammo: 'shells', ammoUse: [1, 2], noAmmoAtk: 6, vs: { horde: 10, mutant: 10 }, salvage: [['scrap_metal', 2], ['wood', 1], ['gunpowder', 1]], desc: '가까운 거리라면 무엇이든 멈춘다. 몰려오는 무리와 변이 감염자에게 특히 잘 듣는다.' },
    pistol_ammo:    { name: '권총탄',         cat: 'ammo',   w: 0.012, r: 1, stack: 60, desc: '권총에 쓴다.' },
    shells:         { name: '산탄',           cat: 'ammo',   w: 0.045, r: 2, stack: 40, desc: '산탄총에 쓴다.' },

    padded_jacket:  { name: '두꺼운 패딩',    cat: 'armor', thick: 2, w: 1.5, r: 0, stack: 1, def: 0.15, dbf: 0.10, salvage: [['cloth', 4]], desc: '이빨 정도는 막아 준다.' },
    leather_jacket: { name: '가죽 재킷',      cat: 'armor', thick: 2, w: 2.0, r: 1, stack: 1, def: 0.25, dbf: 0.20, salvage: [['cloth', 3], ['duct_tape', 1]], desc: '질긴 가죽.' },
    riot_armor:     { name: '진압복',         cat: 'armor', thick: 3, w: 5.0, r: 2, stack: 1, def: 0.40, dbf: 0.35, salvage: [['plastic', 3], ['cloth', 3], ['scrap_metal', 1]], desc: '경찰 기동대용 보호구. 무겁다.' },
    military_vest:  { name: '방탄조끼',       cat: 'armor', thick: 3, w: 6.0, r: 3, stack: 1, def: 0.50, dbf: 0.40, salvage: [['cloth', 3], ['scrap_metal', 2], ['wire', 1]], desc: '군용 방탄조끼. 아주 무겁다.' },

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
    // 잡동사니: 그대로는 쓸 데가 없다. 해체하면 재료가 나온다 (전선·배터리·전자 부품·의료 소모품 같은 고급 재료는 확률로)
    broken_radio:     { name: '고장 난 라디오', cat: 'junk', w: 1.2, r: 0, stack: 5,  salvage: [['electronic', 2], ['wire', 2], ['plastic', 1], ['scrap_metal', 1]], desc: '전원이 들어오지 않는다. 안에 부품은 남아 있다.' },
    old_phone:        { name: '꺼진 휴대폰',    cat: 'junk', w: 0.2, r: 0, stack: 10, salvage: [['electronic', 1], ['battery', 2], ['plastic', 1]], desc: '화면이 깨졌다. 배터리는 아직 쓸 만할지도.' },
    pc_tower:         { name: '컴퓨터 본체',    cat: 'junk', w: 6.0, r: 1, stack: 2,  salvage: [['electronic', 3], ['wire', 3], ['scrap_metal', 3]], desc: '무겁다. 뜯으면 전자 부품이 꽤 나온다.' },
    folding_chair:    { name: '접이식 철제 의자', cat: 'junk', w: 3.0, r: 0, stack: 3, salvage: [['pipe', 3], ['scrap_metal', 2]], desc: '다리가 쇠파이프다.' },
    bicycle:          { name: '부서진 자전거',  cat: 'junk', w: 9.0, r: 0, stack: 1,  salvage: [['pipe', 5], ['scrap_metal', 4], ['wire', 2]], desc: '바퀴가 휘었다. 프레임은 쓸 만하다. 아주 무겁다.' },
    toaster:          { name: '전기 토스터',    cat: 'junk', w: 1.5, r: 0, stack: 3,  salvage: [['wire', 2], ['scrap_metal', 2], ['electronic', 1]], desc: '빵을 구울 일은 이제 없다.' },
    first_aid_box:    { name: '빈 구급함',      cat: 'junk', w: 0.8, r: 0, stack: 3,  salvage: [['medical_supplies', 3], ['plastic', 2]], desc: '약은 누가 다 가져갔다. 구석에 거즈와 솜이 남아 있을지도.' },
    pill_bottles:     { name: '약병 꾸러미',    cat: 'junk', w: 0.3, r: 0, stack: 10, salvage: [['medical_supplies', 2], ['plastic', 1]], desc: '대부분 비었다. 바닥에 뭔가 남아 있다.' },
    gunpowder:        { name: '화약',         cat: 'material', w: 0.1,  r: 2, stack: 30, desc: '탄약을 만드는 재료.' },

    // bag: 장착하면 중량 한계 증가 (최대 +35kg)
    bag_school:   { name: '책가방',         cat: 'bag', w: 0.8, r: 0, stack: 1, bag: 8,  salvage: [['cloth', 2]], desc: '중량 한계 +8kg' },
    bag_hiking:   { name: '등산 가방',      cat: 'bag', w: 1.5, r: 1, stack: 1, bag: 18, salvage: [['cloth', 4], ['plastic', 1]], desc: '중량 한계 +18kg' },
    bag_tactical: { name: '전술 배낭',      cat: 'bag', w: 2.2, r: 2, stack: 1, bag: 26, salvage: [['cloth', 5], ['duct_tape', 1], ['wire', 1]], desc: '중량 한계 +26kg' },
    bag_military: { name: '군용 대형 배낭', cat: 'bag', w: 3.0, r: 3, stack: 1, bag: 35, salvage: [['cloth', 7], ['duct_tape', 2], ['wire', 1]], desc: '중량 한계 +35kg' },
  },

  // dist: 거점에서 걸리는 시간(분), angle: 지도 위 방향(도)
  // spots: 수색 구역 수, finds: 한 번 수색할 때 나오는 아이템 종류 수 [최소, 최대]
  // loot: [아이템, 가중치, 최소 개수, 최대 개수]
  locations: [
    {
      id: 'houses', name: '버려진 주택가', danger: 0, dist: 30, angle: 205, spots: 50, finds: [1, 2], emptyChance: 0.15,
      desc: '창문이 깨진 단독주택들이 늘어선 골목. 대부분 이미 털렸지만 구석구석 남은 게 있을지도 모른다.',
      loot: [['broken_radio', 2.25], ['old_phone', 2.25], ['folding_chair', 1.8], ['toaster', 1.8], ['pill_bottles', 1.5], ['bicycle', 0.9], ['canned_food', 5], ['bread', 6],
             ['cloth', 11.7, 2, 5], ['plastic', 6.5, 1, 3], ['water_bottle', 3], ['duct_tape', 3.6, 1, 2], ['nails', 4.5, 2, 5], ['bandage', 3, 1, 2], ['soda', 3], ['chocolate', 2],
             ['wood', 6, 1, 3], ['bag_school', 1.5], ['kitchen_knife', 2], ['bat', 1], ['padded_jacket', 1.2], ['antidiarrheal', 1], ['sedative', 0.4], ['scrap_metal', 5, 2, 5],
             ['wire', 2, 1, 3], ['pipe', 2, 1, 3]],
      flavor: ['부엌 찬장을 하나씩 열어 보았다.', '아이 방 장난감 상자 밑을 뒤졌다.', '현관 신발장 위를 훑었다.', '반쯤 무너진 창고 문을 비집고 들어갔다.'],
      ambient: [
        '식탁 위에 저녁상이 차려진 채 말라붙어 있다. 숟가락 네 개가 가지런하다.',
        '아이 방 문틀에 연필로 키를 잰 눈금이 있다. 마지막 눈금 옆에 "3월"이라고 적혀 있다.',
        '거실 TV 위에 먼지가 하얗게 앉았다. 리모컨은 아직 누군가의 손이 닿던 자리에 놓여 있다.',
        '현관문 안쪽에 판자가 못질되어 있다. 못은 바깥에서 뜯겨 나가 있었다.',
        '냉장고 문에 아이가 그린 가족 그림이 붙어 있다. 넷이 손을 잡고 웃고 있다.',
        '욕조에 물이 가득 받아져 있다. 단수되기 전에 누군가 받아 둔 모양이다. 지금은 초록색이다.',
        '마당 빨랫줄에 셔츠가 석 달째 걸려 있다. 볕에 바래 원래 색을 알 수 없다.',
      ],
      hides: ['부엌 싱크대 밑', '아이 방 옷장 속', '창고 바닥 판자 밑', '정원 화분 밑', '다락방 단열재 사이'],
    },
    {
      id: 'store', name: '동네 편의점', danger: 0, dist: 40, angle: 330, spots: 30, finds: [1, 3], emptyChance: 0.12,
      desc: '셔터가 반쯤 내려간 24시 편의점. 진열대가 모두 쓰러져 있다.',
      loot: [['old_phone', 2.25], ['folding_chair', 1.5], ['pill_bottles', 1.2], ['canned_food', 6], ['instant_noodle', 7, 1, 2], ['water_bottle', 7], ['soda', 6], ['chocolate', 4],
             ['energy_drink', 1.5], ['bandage', 2], ['plastic', 3.9, 1, 3], ['battery', 2.25, 1, 3], ['antidiarrheal', 1.5], ['kitchen_knife', 0.5], ['scrap_metal', 2.5, 2, 5], ['wire', 2, 1, 3]],
      flavor: ['쓰러진 진열대 밑으로 손을 넣었다.', '계산대 뒤 창고를 뒤졌다.', '냉장고 문을 하나씩 열어 보았다. 냄새가 지독하다.'],
      ambient: [
        '계산대 화면에 마지막 거래가 떠 있다. 생수 6개, 3월 15일 03:12.',
        '아이스크림 냉동고가 열린 채 멈춰 있다. 녹았다 굳은 자국이 바닥까지 흘렀다.',
        '창고 문의 "직원 외 출입 금지" 종이 위에 누군가 "사람 살려"라고 덧썼다.',
        '복권 판매대에 이번 주 당첨 번호가 붙어 있다. 아무도 찾으러 오지 않았을 것이다.',
        '셔터 안쪽에 손톱 자국이 길게 나 있다. 안에서 밖으로 나가려던 자국이다.',
        '진열대 사이에 학생 가방 하나가 떨어져 있다. 열쇠고리에 강아지 사진이 붙어 있다.',
      ],
      hides: ['계산대 밑 금고', '창고 박스 더미 속', '천장 환풍구', '쓰러진 냉장고 뒤', '뒷골목 쓰레기통'],
    },
    {
      id: 'gas', name: '폐 주유소', danger: 1, dist: 60, angle: 70, spots: 30, finds: [1, 3], emptyChance: 0.12,
      desc: '녹슨 주유기 사이로 바람이 분다. 정비실 문이 열려 있다.',
      loot: [['bicycle', 1.5], ['folding_chair', 1.5], ['broken_radio', 1.5], ['old_phone', 1.2], ['fuel', 3], ['soda', 5], ['water_bottle', 4], ['instant_noodle', 3],
             ['tools', 2.1, 1, 2], ['scrap_metal', 10, 2, 5], ['pipe', 6, 1, 3], ['wire', 4, 1, 3], ['duct_tape', 3.6, 1, 2], ['battery', 3, 1, 3], ['crowbar', 2], ['padded_jacket', 0.8],
             ['leather_jacket', 0.4], ['electronic', 3.2, 1, 3], ['nails', 3, 2, 5]],
      flavor: ['정비실 공구함을 열어 보았다.', '매점 카운터 뒤를 뒤졌다.', '버려진 차량의 트렁크를 열었다.'],
      ambient: [
        '주유기 화면에 리터당 가격이 그대로 떠 있다. 이제는 아무 의미 없는 숫자다.',
        '세차장 안에 차 한 대가 거품을 뒤집어쓴 채 말라 있다. 운전석 문이 열려 있다.',
        '정비실 달력이 3월에 멈춰 있다. 14일 칸에 "기지 탱크로리 입고"라고 적혀 있다.',
        '기름 떨어진 차들이 진입로에 줄지어 있다. 몇 대는 문이 잠긴 채다. 안은 들여다보지 않았다.',
        '휴게실 TV 앞에 의자들이 둥글게 놓여 있다. 다들 마지막 뉴스를 여기서 봤나 보다.',
        '냉장고에 붙은 쪽지. "외상 사절. 세상이 망해도."',
      ],
      hides: ['정비실 공구함 밑', '화장실 천장 패널 위', '폐차 트렁크', '매점 냉동고 안', '세차장 배수구 옆'],
    },
    {
      id: 'hardware', name: '철물점', danger: 1, dist: 80, angle: 150, spots: 40, finds: [1, 3], emptyChance: 0.1,
      desc: '간판이 떨어진 철물점. 선반에 공구와 자재가 어지럽게 흩어져 있다.',
      loot: [['folding_chair', 2.25], ['bicycle', 1.8], ['toaster', 1.5], ['broken_radio', 1.2], ['nails', 12, 2, 5], ['wood', 10.5, 1, 3], ['pipe', 12, 1, 3], ['scrap_metal', 12.5, 2, 5],
             ['wire', 8, 1, 3], ['duct_tape', 6, 1, 2], ['tools', 4.2, 1, 2], ['battery', 3, 1, 3], ['water_bottle', 2], ['crowbar', 3], ['fire_axe', 1], ['machete', 0.8],
             ['gunpowder', 0.6], ['electronic', 3.2, 1, 3]],
      flavor: ['안쪽 자재 창고로 들어갔다.', '무너진 선반을 하나씩 들어 올렸다.', '계산대 서랍을 억지로 열었다.'],
      ambient: [
        '계산대에 "열쇠 복사 10분" 안내판이 있다. 그 밑에 복사된 열쇠 수십 개가 주인을 기다린다.',
        '못 상자들이 모조리 비어 있다. 처음 며칠 동안 다들 문에 판자를 박았다고 했다.',
        '벽에 걸려 있던 사다리 하나가 없다. 바닥 먼지에 사다리를 끈 자국이 문까지 이어진다.',
        '사장 책상 서랍에 외상 장부가 있다. 마지막 줄. "학교 체육관, 합판 20장, 나중에."',
        '진열대 끝의 손도끼 걸이가 비어 있다. 가격표만 흔들린다.',
        '창고 구석에 누군가 자고 간 흔적이 있다. 박스를 깔고, 공구함을 베개 삼았다.',
      ],
      hides: ['자재 창고 합판 뒤', '계산대 서랍 이중 바닥', '2층 사무실 책상 밑', '셔터 상자 안', '뒷마당 벽돌 더미'],
    },
    {
      id: 'school', name: '학교', danger: 2, dist: 120, angle: 260, spots: 40, finds: [1, 3], emptyChance: 0.12,
      desc: '운동장에 차들이 버려져 있다. 교실마다 바리케이드를 쳤던 흔적이 남아 있다.',
      loot: [['pc_tower', 2.25], ['folding_chair', 3], ['first_aid_box', 1.8], ['broken_radio', 1.5], ['bag_school', 4], ['bag_hiking', 1], ['bandage', 4, 1, 2], ['first_aid', 1.5],
             ['cloth', 6.5, 2, 5], ['bread', 3], ['water_bottle', 3], ['chocolate', 3], ['plastic', 5.2, 1, 3], ['wire', 4, 1, 3], ['battery', 3, 1, 3], ['electronic', 3.2, 1, 3],
             ['bat', 2], ['splint', 1.5], ['sedative', 1], ['antidiarrheal', 1], ['padded_jacket', 1], ['scrap_metal', 7.5, 2, 5], ['pipe', 4, 1, 3], ['wood', 4.5, 1, 3],
             ['nails', 3, 2, 5]],
      flavor: ['교실 사물함을 하나씩 열었다.', '보건실 약장을 뒤졌다.', '컴퓨터실의 부서진 본체를 뜯었다.', '급식실 창고 문을 밀고 들어갔다.'],
      ambient: [
        '복도 게시판에 "3월의 칭찬 왕" 사진이 붙어 있다. 아이들이 손가락으로 브이를 그리고 있다.',
        '교실 칠판 귀퉁이에 "3/16 숙제: 봄 그리기"라고 적혀 있다.',
        '체육관 바닥에 매트가 줄지어 깔려 있다. 매트마다 이름표가 붙어 있다. 대부분 비어 있다.',
        '급식실 칠판. "오늘의 메뉴 — 물 반 컵, 건빵 3개." 날짜는 4월 3일이다.',
        '음악실 피아노 위에 악보가 펼쳐져 있다. 졸업식 노래다.',
        '보건실 침대 시트에 크레파스 글씨가 있다. "선생님 무서워요."',
      ],
      hides: ['교무실 캐비닛', '체육 창고 매트 사이', '음악실 피아노 안', '옥상 물탱크 옆', '보건실 침대 밑'],
    },
    {
      id: 'mart', name: '대형마트', danger: 2, dist: 150, angle: 15, spots: 50, finds: [1, 3], emptyChance: 0.1,
      desc: '넓은 매장 안은 어둡고 조용하다. 너무 조용하다.',
      loot: [['toaster', 2.25], ['broken_radio', 1.8], ['old_phone', 2.25], ['pill_bottles', 1.5], ['canned_food', 8, 1, 2], ['instant_noodle', 6, 1, 2], ['water_bottle', 7, 1, 2], ['soda', 5],
             ['chocolate', 4], ['energy_drink', 3], ['bag_hiking', 2], ['bag_tactical', 0.4], ['cloth', 5.2, 2, 5], ['plastic', 5.2, 1, 3], ['battery', 4.5, 1, 3], ['duct_tape', 3.6, 1, 2],
             ['first_aid', 1], ['kitchen_knife', 2], ['bat', 1.5], ['machete', 0.6], ['padded_jacket', 2], ['leather_jacket', 1], ['antidiarrheal', 2], ['scrap_metal', 5, 2, 5],
             ['wire', 3, 1, 3], ['pipe', 3, 1, 3], ['electronic', 4.8, 1, 3]],
      flavor: ['식품 코너의 쓰러진 매대를 뒤졌다.', '아웃도어 매장 쪽으로 들어갔다.', '직원 전용 물류 창고를 살폈다.', '카트 더미 사이를 헤집었다.'],
      ambient: [
        '입구 카트 보관대에 카트가 하나도 없다. 마지막 날 다들 카트째 밀고 나갔다고 했다.',
        '안내 방송 마이크 옆에 원고가 놓여 있다. "고객 여러분, 침착하게 출구로…" 끝까지 읽혔을까.',
        '시식 코너에 이쑤시개가 꽂힌 만두가 돌처럼 말라붙어 있다.',
        '분실물 선반에 아이 신발 한 짝, 휴대폰 열두 대, 결혼반지 하나가 있다.',
        '1층 이벤트홀에 "시티FM 공개방송" 현수막이 반쯤 떨어져 매달려 있다.',
        '주차장 3층에 텐트 몇 동이 쳐져 있다. 누군가 여기서 살아 보려 했던 모양이다. 지금은 바람만 드나든다.',
      ],
      hides: ['물류 창고 팔레트 밑', '직원 휴게실 사물함', '푸드코트 오븐 안', '주차장 차량 안', '옥상 실외기 뒤'],
    },
    {
      id: 'hospital', name: '병원', danger: 3, dist: 210, angle: 105, spots: 40, finds: [1, 3], emptyChance: 0.1,
      desc: '응급실 앞에 구급차가 엎어져 있다. 소독약 냄새와 썩은 냄새가 뒤섞여 있다.',
      loot: [['first_aid_box', 3.75], ['pill_bottles', 3.75], ['pc_tower', 1.5], ['bandage', 8, 1, 3], ['first_aid', 5], ['painkiller', 5, 1, 2], ['medical_supplies', 10.4, 1, 3], ['water_bottle', 3],
             ['electronic', 6.4, 1, 3], ['battery', 3, 1, 3], ['cloth', 3.9, 2, 5], ['antibiotics', 3], ['splint', 4], ['sedative', 3, 1, 2], ['antidiarrheal', 3], ['scrap_metal', 3.75, 2, 5],
             ['pipe', 3, 1, 3], ['wire', 3, 1, 3], ['plastic', 3.9, 1, 3]],
      flavor: ['응급실 처치대 서랍을 열었다.', '약제부 선반을 뒤졌다.', '병동 간호사실을 살폈다.'],
      ambient: [
        '대기실 번호표 기계가 437번에서 멈춰 있다.',
        '복도 벽에 손바닥 자국이 길게 끌려 있다. 응급실 쪽으로 이어진다.',
        '간호사실 화이트보드에 병상 현황이 적혀 있다. 모든 칸 위에 누군가 크게 X를 그었다.',
        '소아과 대기실 수족관에 물만 남았다. 물고기 모형 하나가 바닥에 가라앉아 있다.',
        '응급실 입구에 들것이 겹겹이 쌓여 바리케이드가 되어 있다. 안쪽에서 쌓은 것이다.',
        '옥상 헬기장에 침대 시트로 "SOS"를 써 두었다. 시트 한 장이 날아가 "SO"만 남았다.',
      ],
      hides: ['영안실 서랍', '약제부 이중 선반', '병동 천장 패널', '보일러실 배관 뒤', '구급차 안'],
    },
    {
      id: 'police', name: '경찰서', danger: 3, dist: 240, angle: 300, spots: 30, finds: [1, 3], emptyChance: 0.12,
      desc: '유리문 너머로 서류가 어지럽게 흩어져 있다. 무기고 문은 아직 잠겨 있을까.',
      loot: [['pc_tower', 2.25], ['broken_radio', 2.25], ['old_phone', 1.8], ['first_aid_box', 1.2], ['bag_tactical', 2], ['ration', 2], ['first_aid', 2], ['bandage', 3],
             ['battery', 4.5, 1, 3], ['wire', 4, 1, 3], ['electronic', 6.4, 1, 3], ['energy_drink', 2], ['water_bottle', 3], ['tools', 2.1, 1, 2], ['duct_tape', 2.4, 1, 2], ['pistol', 1.5],
             ['pistol_ammo', 5, 2, 8], ['riot_armor', 1.5], ['leather_jacket', 1], ['shells', 1, 1, 4], ['shotgun', 0.4], ['sedative', 1], ['splint', 1], ['gunpowder', 2, 1, 2],
             ['scrap_metal', 7.5, 2, 5], ['pipe', 4, 1, 3], ['nails', 3, 2, 5]],
      flavor: ['당직실 캐비닛을 열었다.', '압수품 보관실을 뒤졌다.', '순찰차 트렁크를 열어 보았다.'],
      ambient: [
        '상황실 벽시계가 19시 30분에 멈춰 있다.',
        '유치장 문이 모두 열려 있다. 누가 열어 줬는지는 알 수 없다.',
        '책상마다 가족사진이 놓여 있다. 한 책상만 사진이 엎어져 있다.',
        '무기고 문이 뜯겨 있다. 총기 거치대에는 번호표만 가지런하다.',
        '분실물 보관함에 "주인을 찾습니다" 쪽지가 붙은 곰 인형이 있다.',
        '게시판의 수배 전단 위로 실종자 전단이 겹겹이 붙었다. 맨 위는 아이 사진이다.',
      ],
      hides: ['증거물 보관함', '당직실 침대 밑', '유치장 변기 뒤', '순찰차 스페어타이어 칸', '옥상 안테나 박스'],
    },
    {
      id: 'base', name: '군사기지', danger: 4, dist: 360, angle: 215, spots: 50, finds: [2, 3], emptyChance: 0.08,
      desc: '철조망 너머 버려진 군사기지. 무엇이 기다리고 있는지 아무도 모른다.',
      loot: [['pc_tower', 2.25], ['broken_radio', 2.25], ['first_aid_box', 1.8], ['ration', 5, 1, 2], ['bag_military', 1.2], ['bag_tactical', 2], ['engine_part', 3, 1, 1], ['electronic', 9.6, 1, 4],
             ['fuel', 3], ['first_aid', 3], ['battery', 4.5, 1, 3], ['wire', 6, 1, 3], ['tools', 4.2, 1, 2], ['energy_drink', 3], ['water_bottle', 4], ['shotgun', 1],
             ['shells', 3, 2, 6], ['pistol', 2], ['pistol_ammo', 4, 3, 10], ['military_vest', 1], ['riot_armor', 1.5], ['antibiotics', 2], ['splint', 2], ['fire_axe', 1],
             ['gunpowder', 2, 1, 3], ['scrap_metal', 12.5, 2, 5], ['pipe', 6, 1, 3], ['nails', 4.5, 2, 5], ['cloth', 3.9, 2, 5]],
      flavor: ['보급 창고의 나무 상자를 뜯었다.', '막사 관물대를 하나씩 열었다.', '정비고 안쪽으로 들어갔다.', '버려진 군용 트럭 짐칸을 뒤졌다.'],
      ambient: [
        '정문 차단기가 위로 올라간 채 멈춰 있다. 마지막 차가 나간 뒤로 아무도 내리지 않았다.',
        '연병장에 버려진 군용 트럭들이 서 있다. 한 대는 시동 열쇠가 꽂혀 있다. 기름은 없다.',
        '막사 관물대가 모두 열려 있다. 부치지 못한 편지 묶음이 바닥에 흩어져 있다.',
        '연구동 창문은 모두 안쪽에서 판자로 막혀 있다. 3층 창문 하나만 막혀 있지 않다.',
        '헬기장 바닥의 H 표시가 그을려 있다. 마지막 헬기가 떠난 자리다.',
        '방송실 스피커에서 가끔 지지직 소리가 난다. 아무도 마이크를 잡지 않았는데.',
      ],
      hides: ['막사 관물대 이중 바닥', '탄약고 빈 상자', '정비고 피트 아래', '감시탑 꼭대기', '연구동 환기구'],
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
    black_dogs: {
      name: '검은 개 일당', weight: [0, 0, 0, 0, 0], mod: -20, canFlee: 0, fleeMod: 0,
      dmg: [18, 32], debuffs: [['bleed', 0.5], ['fracture', 0.2]], fear: 0.2, hurtOnWin: 0.6, winDmg: [5, 14],
      intro: ['휴게소 담장 너머로 화염병이 날아든다. 검은 개 일당이 쏟아져 나온다!'],
      win: ['마지막 남은 검은 개가 무기를 버리고 달아났다. 휴게소 창고에 불길이 번진다.'],
      lose: ['총알이 귓가를 스쳤다. 누군가 나를 끌어당겼다. 그다음은 기억나지 않는다.'],
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

    { id: 'helicopter', on: ['search', 'travel', 'rest'], weight: 2, title: '헬기',
      text: ['머리 위로 헬기 소리가 지나간다. 낮게, 천천히. 사방에서 감염자들이 일제히 하늘을 올려다본다.'],
      choices: [
        { label: '숨어서 지나가길 기다린다', sub: '30분', outcome: { time: 30, log: '헬기 소리가 멀어질 때까지 숨을 죽였다. 놈들이 소리를 따라 우르르 몰려갔다. 헬기는 끝내 내려오지 않았다.' } },
        { label: '뛰어나가 손을 흔든다', sub: '구조일지도 모른다', outcome: { roll: [
          { p: 0.15, log: '헬기에서 무언가 떨어졌다. 낙하산이 달린 보급 상자다. 헬기는 그대로 멀어졌다.', items: [['ration', 1, 2], ['first_aid', 1, 1], ['water_bottle', 2, 3]] },
          { p: 0.85, log: '헬기는 나를 보지 못했다. 대신 놈들이 나를 봤다!', combat: 'random', winLoot: 1 },
        ] } },
      ] },
    { id: 'alarm', on: ['search'], weight: 3, title: '경보음',
      text: ['어딘가에서 자동차 경보음이 울리기 시작했다. 멈추지 않는다.', '건물 어딘가의 화재 경보기가 갑자기 울어 댄다. 배터리가 아직 남아 있었나 보다.'],
      choices: [
        { label: '서둘러 챙기고 빠진다', sub: '10분 · 놈들이 소리 쪽으로 몰린다', outcome: { time: 10, log: '경보음이 놈들을 끌어가는 동안 손에 잡히는 대로 챙겼다.', loot: 1 } },
        { label: '조용해질 때까지 숨는다', sub: '40분', outcome: { time: 40, log: '한참 뒤 배터리가 다 됐는지 경보음이 멎었다. 그동안 숨소리도 크게 내지 못했다.' } },
      ] },
    { id: 'leaflet', on: ['travel'], weight: 2, title: '전단',
      text: ['바람에 날려 온 종이가 발목에 감긴다. 석 달 전 헬기가 뿌린 계엄사령부 전단이다. "구조를 기다리십시오." 그 아래에 누군가 크게 적어 두었다. "아무도 안 와."'],
      outcome: {} },
    { id: 'light_signal', on: ['search'], weight: 2, night: true, unlessFlag: 'jungwoo_left', title: '불빛',
      text: ['멀리 기지 쪽에서 불빛이 세 번 깜빡였다. 쉬었다가, 다시 세 번. 그리고 꺼졌다.'],
      outcome: {} },
    { id: 'siren', on: ['travel'], weight: 2, title: '사이렌',
      text: ['어딘가에서 아직 살아 있는 민방위 사이렌이 울린다. 늘어진 테이프 같은 소리다. 놈들이 하나둘 소리 쪽으로 걸어간다. 덕분에 {place} 길이 잠시 비었다.'],
      outcome: {} },
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
  // 시설: 레벨마다 cost(재료), req(먼저 지어야 할 시설 레벨), time(공사 분), effect(설명)와 효과 수치
  // speed: 그 시설에서 만드는 시간 배수 · food: 거점에서 먹을 때 음식 효과 + · drain: 거점에서 잘 때 배고픔·갈증 배수
  // infection: 'hold'(거점에서 쉬거나 자는 동안 감염이 안 퍼짐) / 'heal'(시간당 infHeal만큼 낫는다)
  // solar: 낮에는 연료 없이 돌아간다 · defense: 밤 습격 방어력 (5단계에서 쓰인다)
  facilities: {
    generator: { name: '발전기', desc: '다른 시설에 전기를 댄다. 연료통을 넣어야 돌아간다.', levels: [
      { cost: [['scrap_metal', 5], ['wire', 3], ['battery', 2], ['tools', 1]], req: { workbench: 1 }, time: 360, fuelHours: 24, tank: 72, effect: '연료통 1개로 24시간 · 최대 72시간' },
      { cost: [['scrap_metal', 6], ['wire', 4], ['electronic', 2]], req: { workbench: 2 }, time: 480, fuelHours: 36, tank: 108, effect: '연료통 1개로 36시간 · 최대 108시간' },
      { cost: [['engine_part', 1], ['electronic', 3], ['wire', 4]], req: { workbench: 3 }, time: 720, fuelHours: 48, tank: 144, effect: '연료통 1개로 48시간 · 최대 144시간' },
      { cost: [['scrap_metal', 10], ['wire', 6], ['electronic', 4], ['tools', 1]], req: { workbench: 4 }, time: 900, fuelHours: 60, tank: 180, effect: '연료통 1개로 60시간 · 최대 180시간' },
      { cost: [['engine_part', 1], ['electronic', 5], ['wire', 6], ['battery', 3]], req: { workbench: 5 }, time: 1200, fuelHours: 72, tank: 216, effect: '연료통 1개로 72시간 · 최대 216시간' },
      { cost: [['scrap_metal', 14], ['electronic', 6], ['wire', 8], ['tools', 2]], req: { workbench: 5 }, time: 1680, fuelHours: 84, tank: 252, effect: '연료통 1개로 84시간 · 최대 252시간' },
      { cost: [['engine_part', 2], ['electronic', 8], ['battery', 6], ['wire', 10], ['plastic', 8]], req: { workbench: 6 }, time: 2160, fuelHours: 96, tank: 288, solar: true, effect: '연료통 1개로 96시간 · 최대 288시간 · 태양광: 낮에는 연료 없이 돌아간다' },
    ] },
    workbench: { name: '작업대', desc: '도구와 무기, 방어구를 만든다.', levels: [
      { cost: [['wood', 5], ['nails', 4], ['duct_tape', 2]], req: {}, time: 180, effect: '붕대, 부목, 못 박은 방망이, 못 제작' },
      { cost: [['scrap_metal', 4], ['tools', 1], ['pipe', 2], ['wire', 2]], req: { stash: 1 }, time: 360, effect: '두꺼운 패딩, 마체테, 등산 가방, 쇠파이프 제작' },
      { cost: [['tools', 2], ['electronic', 3], ['wire', 4], ['battery', 2]], req: { generator: 1 }, time: 600, effect: '탄약, 진압복, 전자 부품, 발전기 부품 제작 (전력 필요)' },
      { cost: [['tools', 2], ['scrap_metal', 10], ['pipe', 4], ['electronic', 2]], req: { generator: 3 }, time: 900, speed: 0.9, effect: '공구 세트, 소방 도끼 제작 · 작업대 제작 시간 -10%' },
      { cost: [['tools', 3], ['electronic', 4], ['wire', 6], ['battery', 2]], req: { generator: 4 }, time: 1200, speed: 0.8, effect: '전술 배낭, 방탄조끼 제작 · 작업대 제작 시간 -20%' },
      { cost: [['tools', 3], ['scrap_metal', 16], ['pipe', 6], ['electronic', 5]], req: { generator: 5, stash: 4 }, time: 1680, speed: 0.7, effect: '권총 제작 · 작업대 제작 시간 -30%' },
      { cost: [['tools', 4], ['electronic', 8], ['engine_part', 1], ['wire', 8]], req: { generator: 6 }, time: 2160, speed: 0.6, effect: '산탄총, 군용 대형 배낭 제작 · 작업대 제작 시간 -40%' },
    ] },
    stash: { name: '창고', desc: '물건을 보관한다. 레벨이 오를수록 칸이 늘어난다.', levels: [
      { cost: [['wood', 4], ['nails', 3]], req: {}, time: 120, slots: 15, effect: '창고 45칸' },
      { cost: [['wood', 6], ['scrap_metal', 3], ['nails', 5], ['tools', 1]], req: { workbench: 1 }, time: 240, slots: 30, effect: '창고 60칸' },
      { cost: [['scrap_metal', 8], ['pipe', 4], ['nails', 8], ['wire', 2]], req: { workbench: 2 }, time: 480, slots: 50, effect: '창고 80칸' },
      { cost: [['wood', 10], ['scrap_metal', 10], ['nails', 12], ['tools', 1]], req: { workbench: 3 }, time: 720, slots: 70, effect: '창고 100칸' },
      { cost: [['scrap_metal', 14], ['pipe', 6], ['nails', 14], ['wire', 4]], req: { workbench: 4 }, time: 900, slots: 90, effect: '창고 120칸' },
      { cost: [['scrap_metal', 18], ['pipe', 8], ['nails', 16], ['tools', 2]], req: { workbench: 5 }, time: 1200, slots: 120, effect: '창고 150칸' },
      { cost: [['scrap_metal', 24], ['pipe', 10], ['nails', 20], ['tools', 3], ['electronic', 2]], req: { workbench: 6 }, time: 1680, slots: 170, effect: '창고 200칸' },
    ] },
    bed: { name: '침대', desc: '잠의 질이 좋아진다.', levels: [
      { cost: [['wood', 4], ['cloth', 6], ['nails', 2]], req: {}, time: 120, fatigueMult: 1.2, hp: 1, effect: '잘 때 피로 회복 +20%, HP 회복 +1/시간' },
      { cost: [['wood', 6], ['cloth', 10], ['duct_tape', 2]], req: { workbench: 1 }, time: 240, fatigueMult: 1.4, hp: 2, effect: '잘 때 피로 회복 +40%, HP 회복 +2/시간' },
      { cost: [['cloth', 14], ['electronic', 1], ['battery', 1]], req: { generator: 1 }, time: 360, fatigueMult: 1.6, hp: 3, calm: true, effect: '잘 때 피로 회복 +60%, HP 회복 +3/시간, 자고 나면 공포가 사라진다' },
      { cost: [['cloth', 20], ['wood', 8], ['duct_tape', 4]], req: { workbench: 3 }, time: 600, fatigueMult: 1.8, hp: 4, calm: true, effect: '잘 때 피로 회복 +80%, HP 회복 +4/시간, 공포 해소' },
      { cost: [['cloth', 24], ['plastic', 6], ['electronic', 2], ['battery', 2]], req: { medbay: 4 }, time: 900, fatigueMult: 2.0, hp: 5, calm: true, drain: 0.85, effect: '피로 회복 2배, HP 회복 +5/시간, 공포 해소, 자는 동안 배고픔·갈증 -15%' },
      { cost: [['cloth', 30], ['pipe', 4], ['electronic', 3], ['battery', 3]], req: { generator: 4 }, time: 1200, fatigueMult: 2.2, hp: 6, calm: true, drain: 0.75, effect: '피로 회복 +120%, HP 회복 +6/시간, 공포 해소, 자는 동안 배고픔·갈증 -25%' },
      { cost: [['cloth', 36], ['electronic', 5], ['battery', 4], ['tools', 1]], req: { medbay: 6 }, time: 1680, fatigueMult: 2.5, hp: 8, calm: true, drain: 0.6, effect: '피로 회복 2.5배, HP 회복 +8/시간, 공포 해소, 자는 동안 배고픔·갈증 -40%' },
    ] },
    medbay: { name: '의무실', desc: '거점에서 쉬는 동안 몸을 돌보고, 약을 만든다.', levels: [
      { cost: [['wood', 3], ['cloth', 5], ['medical_supplies', 2]], req: { bed: 1 }, time: 180, hp: 2, effect: '거점에서 쉬거나 잘 때 HP 회복 +2/시간, 골절 회복 2배, 진통제·지사제·의료 소모품 제작' },
      { cost: [['medical_supplies', 4], ['electronic', 1], ['plastic', 4]], req: { generator: 1 }, time: 360, hp: 4, effect: 'HP 회복 +4/시간, 구급상자·진정제 제작' },
      { cost: [['medical_supplies', 6], ['electronic', 3], ['battery', 2]], req: { generator: 2 }, time: 600, hp: 6, effect: 'HP 회복 +6/시간, 항생제 제작' },
      { cost: [['medical_supplies', 8], ['electronic', 3], ['plastic', 6], ['battery', 2]], req: { generator: 3 }, time: 900, hp: 8, speed: 0.9, effect: 'HP 회복 +8/시간, 수액 팩 제작, 의무실 제작 시간 -10%' },
      { cost: [['medical_supplies', 10], ['electronic', 4], ['battery', 3], ['tools', 1]], req: { generator: 4, bed: 4 }, time: 1200, hp: 10, speed: 0.8, infection: 'hold', effect: 'HP 회복 +10/시간, 거점에서 쉬거나 자는 동안 감염이 퍼지지 않는다, 면역 주사 제작, 제작 시간 -20%' },
      { cost: [['medical_supplies', 12], ['electronic', 5], ['wire', 6], ['battery', 4]], req: { workbench: 5 }, time: 1680, hp: 12, speed: 0.7, infection: 'hold', effect: 'HP 회복 +12/시간, 감염 진행 멈춤, 전투 자극제 제작, 제작 시간 -30%' },
      { cost: [['medical_supplies', 16], ['electronic', 8], ['battery', 6], ['tools', 2]], req: { generator: 6 }, time: 2160, hp: 15, speed: 0.6, infection: 'heal', infHeal: 5, effect: 'HP 회복 +15/시간, 거점에서 쉬거나 자면 감염이 시간당 5%씩 낫는다, 수술 키트 제작, 제작 시간 -40%' },
    ] },
    kitchen: { name: '조리대', desc: '날것을 익히고 물을 끓인다.', levels: [
      { cost: [['scrap_metal', 2], ['wood', 3], ['pipe', 1]], req: {}, time: 120, effect: '물 끓이기, 고기 굽기' },
      { cost: [['scrap_metal', 4], ['pipe', 2], ['plastic', 3]], req: { workbench: 1 }, time: 240, effect: '고기 스튜, 고기 두 개 한꺼번에 굽기' },
      { cost: [['electronic', 1], ['wire', 2], ['battery', 1]], req: { generator: 1 }, time: 360, effect: '전기로 물 끓이기, 전투식량 만들기 (전력 필요)' },
      { cost: [['scrap_metal', 6], ['pipe', 4], ['plastic', 6], ['wire', 2]], req: { workbench: 3 }, time: 600, speed: 0.9, food: 0.05, effect: '육포 만들기, 조리 시간 -10%, 거점에서 먹으면 음식 효과 +5%' },
      { cost: [['scrap_metal', 8], ['electronic', 2], ['wire', 4], ['battery', 2]], req: { generator: 4 }, time: 900, speed: 0.8, food: 0.1, effect: '따뜻한 코코아 만들기, 조리 시간 -20%, 거점에서 먹으면 음식 효과 +10%' },
      { cost: [['electronic', 3], ['pipe', 6], ['plastic', 10], ['tools', 1]], req: { water: 4 }, time: 1200, speed: 0.7, food: 0.15, effect: '고기 라면 만들기, 조리 시간 -30%, 거점에서 먹으면 음식 효과 +15%' },
      { cost: [['electronic', 5], ['battery', 4], ['wire', 6], ['tools', 2]], req: { generator: 6 }, time: 1680, speed: 0.6, food: 0.2, effect: '보양 수프 만들기, 조리 시간 -40%, 거점에서 먹으면 음식 효과 +20%' },
    ] },
    water: { name: '정수기', desc: '전기로 깨끗한 물을 만든다. 전력이 있어야 돌아간다.', levels: [
      { cost: [['plastic', 4], ['pipe', 2], ['duct_tape', 2]], req: { generator: 1 }, time: 180, every: 360, max: 5, effect: '6시간마다 생수 1개 (최대 5개 보관)' },
      { cost: [['pipe', 4], ['wire', 2], ['plastic', 6], ['tools', 1]], req: { generator: 2 }, time: 360, every: 240, max: 8, effect: '4시간마다 생수 1개 (최대 8개 보관)' },
      { cost: [['electronic', 2], ['pipe', 6], ['battery', 2]], req: { generator: 2, workbench: 3 }, time: 600, every: 180, max: 12, effect: '3시간마다 생수 1개 (최대 12개 보관)' },
      { cost: [['pipe', 8], ['plastic', 10], ['electronic', 2], ['duct_tape', 4]], req: { generator: 4 }, time: 900, every: 150, max: 16, effect: '2시간 30분마다 생수 1개 (최대 16개 보관)' },
      { cost: [['pipe', 10], ['electronic', 3], ['battery', 3], ['tools', 1]], req: { generator: 5 }, time: 1200, every: 120, max: 20, effect: '2시간마다 생수 1개 (최대 20개 보관)' },
      { cost: [['pipe', 12], ['plastic', 14], ['electronic', 4], ['wire', 6]], req: { workbench: 5 }, time: 1680, every: 90, max: 25, effect: '1시간 30분마다 생수 1개 (최대 25개 보관)' },
      { cost: [['electronic', 6], ['battery', 5], ['pipe', 14], ['tools', 2]], req: { generator: 7 }, time: 2160, every: 60, max: 30, effect: '1시간마다 생수 1개 (최대 30개 보관)' },
    ] },
    gym: { name: '체육관', desc: '몸을 단련한다.', levels: [
      { cost: [['wood', 4], ['scrap_metal', 4], ['pipe', 2]], req: { bed: 1 }, time: 180, xpMult: 1.1, exercise: 1, effect: '운동하기 가능, 힘·지구력 경험치 +10%' },
      { cost: [['scrap_metal', 8], ['pipe', 4], ['tools', 1]], req: { workbench: 2 }, time: 360, xpMult: 1.2, exercise: 1.5, effect: '운동 효과 1.5배, 힘·지구력 경험치 +20%' },
      { cost: [['scrap_metal', 12], ['pipe', 6], ['electronic', 1]], req: { generator: 1 }, time: 600, xpMult: 1.3, exercise: 2, effect: '운동 효과 2배, 힘·지구력 경험치 +30%' },
      { cost: [['scrap_metal', 16], ['pipe', 8], ['cloth', 6], ['tools', 1]], req: { workbench: 3 }, time: 900, xpMult: 1.4, exercise: 2.5, effect: '운동 효과 2.5배, 힘·지구력 경험치 +40%' },
      { cost: [['scrap_metal', 20], ['pipe', 10], ['duct_tape', 6], ['tools', 2]], req: { bed: 4 }, time: 1200, xpMult: 1.5, exercise: 3, effect: '운동 효과 3배, 힘·지구력 경험치 +50%' },
      { cost: [['scrap_metal', 24], ['pipe', 12], ['electronic', 2], ['battery', 2]], req: { generator: 5 }, time: 1680, xpMult: 1.6, exercise: 3.5, vitality: true, effect: '운동 효과 3.5배, 힘·지구력 경험치 +60%, 운동하면 체력도 오른다' },
      { cost: [['scrap_metal', 30], ['pipe', 14], ['electronic', 3], ['tools', 3]], req: { medbay: 6 }, time: 2160, xpMult: 1.75, exercise: 4, vitality: true, effect: '운동 효과 4배, 힘·지구력 경험치 +75%, 운동하면 체력도 오른다' },
    ] },
    wall: { name: '방어벽', desc: '거점을 지킨다. 밤 습격은 5단계에서 추가된다.', levels: [
      { cost: [['wood', 6], ['nails', 6], ['scrap_metal', 2]], req: { workbench: 1 }, time: 240, defense: 10, effect: '쥐가 창고에 못 들어온다 · 방어력 10' },
      { cost: [['scrap_metal', 8], ['nails', 8], ['wire', 3]], req: { workbench: 2 }, time: 480, defense: 25, effect: '마음 놓고 자서 악몽을 덜 꾼다 · 방어력 25' },
      { cost: [['scrap_metal', 12], ['pipe', 6], ['tools', 2], ['battery', 2]], req: { generator: 2 }, time: 720, defense: 40, effect: '경보 장치 · 방어력 40' },
      { cost: [['scrap_metal', 16], ['pipe', 8], ['nails', 12], ['wire', 6]], req: { workbench: 4 }, time: 900, defense: 55, effect: '철조망 · 방어력 55' },
      { cost: [['scrap_metal', 20], ['pipe', 10], ['tools', 2], ['wire', 8]], req: { workbench: 5 }, time: 1200, defense: 70, effect: '이중 철문 · 방어력 70' },
      { cost: [['scrap_metal', 26], ['electronic', 3], ['battery', 3], ['wire', 10]], req: { generator: 5 }, time: 1680, defense: 85, effect: '탐조등과 감시 카메라 · 방어력 85' },
      { cost: [['scrap_metal', 32], ['pipe', 14], ['tools', 3], ['electronic', 5], ['gunpowder', 4]], req: { workbench: 7 }, time: 2160, defense: 100, effect: '요새화: 부비트랩과 사격 구멍 · 방어력 100' },
    ] },
  },
  // 제작법. at: 시설, lv: 필요한 시설 레벨, in: 재료, out: [결과물, 개수], time: 분, power: 전력 필요
  // fuel: 불 피우는 데 쓰는 재료. 발전기가 켜져 있으면 전기로 해서 이 재료는 쓰지 않는다 (대신 만드는 동안 전력이 필요)
  recipes: [
    { id: 'r_bandage',      at: 'workbench', lv: 1, in: [['cloth', 3]], out: ['bandage', 2], time: 30 },
    { id: 'r_nails',        at: 'workbench', lv: 1, in: [['scrap_metal', 1]], out: ['nails', 3], time: 30 },
    { id: 'r_pipe',         at: 'workbench', lv: 2, in: [['scrap_metal', 2]], out: ['pipe', 1], time: 60 },
    { id: 'r_electronic',   at: 'workbench', lv: 3, power: true, in: [['wire', 2], ['battery', 1], ['plastic', 1]], out: ['electronic', 1], time: 120 },
    { id: 'r_splint',       at: 'workbench', lv: 1, in: [['wood', 1], ['cloth', 2], ['duct_tape', 1]], out: ['splint', 1], time: 40 },
    { id: 'r_nail_bat',     at: 'workbench', lv: 1, in: [['bat', 1], ['nails', 2], ['duct_tape', 1]], out: ['nail_bat', 1], time: 60 },
    { id: 'r_padded',       at: 'workbench', lv: 2, in: [['cloth', 10], ['duct_tape', 2]], out: ['padded_jacket', 1], time: 120 },
    { id: 'r_machete',      at: 'workbench', lv: 2, in: [['scrap_metal', 3], ['duct_tape', 1], ['cloth', 2]], out: ['machete', 1], time: 120 },
    { id: 'r_bag',          at: 'workbench', lv: 2, in: [['cloth', 12], ['duct_tape', 4], ['pipe', 1]], out: ['bag_hiking', 1], time: 180 },
    { id: 'r_pistol_ammo',  at: 'workbench', lv: 3, power: true, in: [['scrap_metal', 1], ['gunpowder', 1]], out: ['pistol_ammo', 6], time: 60 },
    { id: 'r_shells',       at: 'workbench', lv: 3, power: true, in: [['scrap_metal', 1], ['gunpowder', 1], ['plastic', 1]], out: ['shells', 4], time: 60 },
    { id: 'r_riot',         at: 'workbench', lv: 3, power: true, in: [['scrap_metal', 8], ['cloth', 10], ['duct_tape', 4]], out: ['riot_armor', 1], time: 240 },
    { id: 'r_tools',        at: 'workbench', lv: 4, in: [['scrap_metal', 4], ['pipe', 1], ['duct_tape', 2]], out: ['tools', 1], time: 120 },
    { id: 'r_fire_axe',     at: 'workbench', lv: 4, in: [['scrap_metal', 4], ['wood', 2], ['duct_tape', 1]], out: ['fire_axe', 1], time: 150 },
    { id: 'r_bag_tactical', at: 'workbench', lv: 5, in: [['cloth', 16], ['duct_tape', 5], ['wire', 2], ['pipe', 2]], out: ['bag_tactical', 1], time: 240 },
    { id: 'r_vest',         at: 'workbench', lv: 5, power: true, in: [['scrap_metal', 10], ['cloth', 12], ['duct_tape', 6], ['plastic', 6]], out: ['military_vest', 1], time: 360 },
    { id: 'r_pistol',       at: 'workbench', lv: 6, power: true, in: [['scrap_metal', 6], ['pipe', 1], ['tools', 1], ['electronic', 1]], out: ['pistol', 1], time: 300 },
    { id: 'r_shotgun',      at: 'workbench', lv: 7, power: true, in: [['pipe', 3], ['scrap_metal', 6], ['wood', 2], ['tools', 1]], out: ['shotgun', 1], time: 360 },
    { id: 'r_bag_military', at: 'workbench', lv: 7, in: [['cloth', 24], ['duct_tape', 8], ['wire', 4], ['pipe', 2]], out: ['bag_military', 1], time: 360 },
    { id: 'r_engine_part',  at: 'workbench', lv: 3, power: true, in: [['scrap_metal', 6], ['electronic', 3], ['wire', 4], ['tools', 1]], out: ['engine_part', 1], time: 480 },
    { id: 'r_painkiller',   at: 'medbay', lv: 1, in: [['medical_supplies', 1]], out: ['painkiller', 2], time: 30 },
    { id: 'r_antidiarrheal', at: 'medbay', lv: 1, in: [['medical_supplies', 1], ['boiled_water', 1]], out: ['antidiarrheal', 2], time: 30 },
    { id: 'r_first_aid',    at: 'medbay', lv: 2, in: [['bandage', 3], ['medical_supplies', 2], ['plastic', 1]], out: ['first_aid', 1], time: 60 },
    { id: 'r_sedative',     at: 'medbay', lv: 2, power: true, in: [['medical_supplies', 2]], out: ['sedative', 2], time: 60 },
    { id: 'r_antibiotics',  at: 'medbay', lv: 3, power: true, in: [['medical_supplies', 3], ['boiled_water', 1]], out: ['antibiotics', 1], time: 180 },
    { id: 'r_med_supplies', at: 'medbay', lv: 1, in: [['cloth', 4], ['boiled_water', 2], ['plastic', 1]], out: ['medical_supplies', 1], time: 60 },
    { id: 'r_iv_pack',      at: 'medbay', lv: 4, in: [['boiled_water', 2], ['medical_supplies', 1], ['plastic', 1]], out: ['iv_pack', 1], time: 60 },
    { id: 'r_immune_shot',  at: 'medbay', lv: 5, power: true, in: [['medical_supplies', 3], ['boiled_water', 1]], out: ['immune_shot', 1], time: 120 },
    { id: 'r_stim',         at: 'medbay', lv: 6, power: true, in: [['painkiller', 2], ['energy_drink', 1], ['medical_supplies', 1]], out: ['stim', 1], time: 90 },
    { id: 'r_surgery_kit',  at: 'medbay', lv: 7, power: true, in: [['first_aid', 1], ['splint', 1], ['antibiotics', 1], ['medical_supplies', 2]], out: ['surgery_kit', 1], time: 180 },
    { id: 'r_boil',         at: 'kitchen', lv: 1, fuel: 'wood', in: [['rain_water', 2], ['wood', 1]], out: ['boiled_water', 2], time: 30 },
    { id: 'r_grill',        at: 'kitchen', lv: 1, fuel: 'wood', in: [['raw_meat', 1], ['wood', 1]], out: ['cooked_meat', 1], time: 30 },
    { id: 'r_grill2',       at: 'kitchen', lv: 2, fuel: 'wood', in: [['raw_meat', 2], ['wood', 1]], out: ['cooked_meat', 2], time: 40 },
    { id: 'r_stew',         at: 'kitchen', lv: 2, in: [['raw_meat', 1], ['canned_food', 1], ['boiled_water', 1]], out: ['stew', 1], time: 60 },
    { id: 'r_boil_e',       at: 'kitchen', lv: 3, power: true, in: [['rain_water', 3]], out: ['boiled_water', 3], time: 30 },
    { id: 'r_ration',       at: 'kitchen', lv: 3, power: true, in: [['cooked_meat', 1], ['chocolate', 1], ['canned_food', 1]], out: ['ration', 2], time: 120 },
    { id: 'r_jerky',        at: 'kitchen', lv: 4, fuel: 'wood', in: [['raw_meat', 2], ['wood', 1]], out: ['jerky', 2], time: 240 },
    { id: 'r_cocoa',        at: 'kitchen', lv: 5, fuel: 'wood', in: [['chocolate', 1], ['boiled_water', 1], ['wood', 1]], out: ['cocoa', 1], time: 20 },
    { id: 'r_meat_ramen',   at: 'kitchen', lv: 6, fuel: 'wood', in: [['instant_noodle', 1], ['cooked_meat', 1], ['boiled_water', 1], ['wood', 1]], out: ['meat_ramen', 1], time: 20 },
    { id: 'r_tonic_soup',   at: 'kitchen', lv: 7, fuel: 'wood', in: [['raw_meat', 2], ['canned_food', 1], ['boiled_water', 2], ['wood', 1]], out: ['tonic_soup', 1], time: 180 },
  ],
  // 한번에 만들기: 재료가 되는 만큼 한꺼번에 (최대 craftBatchMax번, 시간은 그만큼 늘어난다)
  craftBatchMax: 20,
  // 해체: 장비를 재료로 되돌린다. 고급 이상 재료는 rareBase 확률(+지능)로 회수
  dismantle: { minutes: 20, rareBase: 0.4 },
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
                   staminaPerLv: 0.02, dodgePerLv: 0.4, travelPerLv: 0.008 },
      vitality:  { name: '체력',           train: '다치고도 살아남으면 오른다.',
                   hpPerLv: 3 },
      focus:     { name: '집중력',         train: '수색하거나 총을 쏠수록 오른다. 귀한 물건을 찾으면 더 오른다.',
                   searchPerLv: 0.01, rarePerLv: 0.02, extraFindPerLv: 0.015, gunPerLv: 0.6 },
      resolve:   { name: '스트레스 저항력', train: '적과 마주치거나, 디버프에 걸리거나, 밤에 수색하면 오른다.',
                   chancePerLv: 0.008, durationPerLv: 0.01 },
      metabolism: { name: '신진대사',      train: '먹고 마실수록 오른다. 든든하게 먹을수록 더 오른다.',
                   drainPerLv: 0.01, foodPerLv: 0.015 },
      intellect: { name: '지능',           train: '장비를 해체하거나 물건을 만들수록 오른다.',
                   yieldPerLv: 0.02, rarePerLv: 0.015, craftTimePerLv: 0.01 },
    },
    // 경험치를 얻는 행동
    xp: {
      carryPerHour: 5,      // 힘: 이동·수색·전투 시간당 × (짐 무게 ÷ 중량 한계, 최대 1.5)
      meleeWin: 6, meleeLose: 3,   // 힘: 근접 싸움
      gunWin: 5, gunLose: 2,       // 집중력: 총으로 싸움
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
      dismantle: 5,         // 지능: 장비 1개 해체
      craft: 3,             // 지능: 제작 1번 (한꺼번에 여러 번이면 그만큼)
    },
  },

  // 스토리
  story: {
    prologue: {
      title: '그날 이후',
      paragraphs: [
        '3월, 북부 신도시에서 원인 모를 열병이 돌기 시작했다. 처음엔 화학 물질이 샜다고 했다. 다음엔 독감이라고 했다.',
        '물리지 않은 사람까지 열이 나기 시작하자, 방송은 더 이상 아무 말도 하지 않았다. 2주 뒤 도시는 봉쇄됐고, 4주 뒤 군대는 헬기를 타고 떠났다. 전기가 끊기고, 수돗물이 끊겼다. 그 뒤로 이곳에 법은 없다.',
        '석 달이 지났다. 당신은 도시 외곽의 낡은 지하 창고에 숨어 지낸다. 철문 하나, 담요 한 장, 줄어드는 통조림 몇 개, 그리고 구석의 낡은 라디오가 전부다.',
        '라디오에서는 아직 누군가의 목소리가 흘러나온다. 밖에는 쓸 만한 것들과, 그것을 노리는 것들이 남아 있다. 흩어진 기록을 모아 이 도시에 무슨 일이 있었는지 알아내라.',
      ],
      button: '철문을 연다',
    },
    // 날이 바뀌면 남기는 일지. 정해진 날은 그 문장, 나머지 날은 dayPool에서 고른다
    days: {
      2: '2일차. 밤새 멀리서 개 짖는 소리가 났다. 아직 살아 있다.',
      3: '3일차. 라디오 97.5에서 그 여자가 또 떠들었다. 한지수. 이름을 외웠다.',
      4: '4일차. 창고 벽에 날짜를 새기기 시작했다. 오늘을 잊지 않으려고.',
      5: '5일차. 꿈에 무너지기 전의 거리가 나왔다. 깨고 나니 더 조용했다.',
      6: '6일차. 군 주파수의 숫자를 벽에 적어 봤다. 삼칠영영구. 아무리 들여다봐도 모르겠다.',
      7: '7일차. 일주일을 버텼다. 처음엔 사흘도 못 버틸 줄 알았다.',
      8: '8일차. 손에 굳은살이 박였다. 예전의 내 손 같지 않다.',
      10: '10일차. 열흘. 이제 누구를 기다리는 건지도 잘 모르겠다.',
      12: '12일차. 처음 발표는 화학 물질이 샜다는 거였다. 그다음엔 독감. 그다음엔 아무 말도 없었다. 그때 알았어야 했다.',
      14: '14일차. 두 주가 지났다. 벽에 새긴 줄이 제법 길어졌다.',
      16: '16일차. 89.1의 비상 방송이 끊겼다. 석 달 내내 같은 말만 하던 목소리였는데, 막상 안 들리니 이상하게 허전하다.',
      18: '18일차. 전기가 끊긴 지 두 달이 넘었다. 스위치를 누르는 버릇은 아직도 안 고쳐진다.',
      21: '21일차. 세 주. 97.5의 그 여자는 오늘도 살아 있었다. 나도.',
      25: '25일차. 물린 적 없는 사람도 열이 난다는 말, 처음엔 안 믿었다. 지금은 매일 아침 내 이마부터 짚는다.',
      30: '30일차. 한 달. 이 도시에 나 말고도 누군가 남아 있을까.',
      33: '33일차. 97.5에 잡음만 흐른다. 마지막 방송이라고 했다. 그래도 주파수는 그대로 맞춰 둔다.',
      40: '40일차. 사십 일. 거울 속 얼굴이 낯설다. 그래도 눈빛만은 아직 내 것이다.',
      45: '45일차. 97.5에서 다시 목소리가 났다. 소리 내어 웃었다. 얼마 만인지 모르겠다.',
      50: '50일차. 군 주파수에서 그 숫자가 다시 들렸다. 삼칠영영구. 누가 아직 저걸 보내고 있을까.',
      60: '60일차. 두 달. 이제는 밤에 들리는 소리만으로 무엇이 오는지 안다.',
      75: '75일차. 밤이 길어졌다. 겨울이 오고 있다.',
      100: '100일차. 백 일. 벽에 새긴 줄을 세다가 그만뒀다. 오늘도 살아 있으면 그걸로 됐다.',
    },
    dayPool: [
      '{day}일차. 바람이 차다.',
      '{day}일차. 오늘도 해가 떴다. 그것만으로도 다행이다.',
      '{day}일차. 철문 경첩에 기름을 쳤다. 소리가 덜 난다.',
      '{day}일차. 어제 본 감염자의 얼굴이 자꾸 떠오른다. 누군가의 가족이었겠지.',
      '{day}일차. 하늘에서 헬기 소리가 들린 것 같았다. 착각이었다.',
      '{day}일차. 창고 구석에 쥐구멍을 하나 더 찾아 막았다.',
      '{day}일차. 오랜만에 소리 내어 말해 봤다. 내 목소리가 낯설다.',
      '{day}일차. 통조림 뚜껑 따는 소리가 이렇게 큰 줄 몰랐다.',
      '{day}일차. 밤사이 비가 왔다. 양동이를 확인하는 게 아침 일과가 됐다.',
      '{day}일차. 꿈에서 누군가 내 이름을 불렀다. 대답하려다 깼다.',
      '{day}일차. 오늘은 아무와도 싸우지 않았다. 그게 이렇게 고마운 일인지 몰랐다.',
      '{day}일차. 아침에 새소리가 들렸다. 새들은 아무 일도 없었던 것처럼 운다.',
      '{day}일차. 지도를 다시 그렸다. 갈 수 있는 곳과, 가면 안 되는 곳.',
      '{day}일차. 철문 너머로 발소리가 지나갔다. 사람인지 아닌지 끝내 몰랐다.',
      '{day}일차. 예전 휴대폰을 꺼내 사진을 봤다. 배터리가 다 될 때까지.',
      '{day}일차. 먼지 쌓인 달력을 넘겼다. 날짜는 이제 내가 정한다.',
      '{day}일차. 오늘 처음으로 그날 이전을 떠올리지 않고 하루를 보냈다. 그게 좋은 건지는 모르겠다.',
      '{day}일차. 라디오를 켜 두고 잠들었다. 사람 목소리가 있으면 덜 무섭다.',
    ],
    // 기록: 시간순 6장, 인물별 이야기. 장소를 수색하다 보면 찾는다(그 장소의 가장 이른 기록부터). loc: 'radio'는 거점에서 잘 때 라디오로 듣는다
    chapters: [
      { id: 'before', title: '일상',    when: '3월 초',      desc: '아무 일도 없던 때.' },
      { id: 'start',  title: '시작',    when: '3월 14~16일', desc: '열병이 퍼지기 시작한 사흘.' },
      { id: 'week2',  title: '2주 후',  when: '3월 말',      desc: '봉쇄와 계엄.' },
      { id: 'week4',  title: '4주 후',  when: '4월 중순',    desc: '통제가 무너지고 군대가 떠났다.' },
      { id: 'month3', title: '3달 뒤',  when: '6월',         desc: '법이 사라진 도시.' },
      { id: 'now',    title: '지금',    when: '현재',        desc: '아직 끝나지 않은 이야기.' },
    ],
    fragmentChance: 0.25,
    radioChance: 0.25,
    // 인물별 이야기. 같은 인물의 메모를 첫 장부터 마지막 장까지 모으면 한 사람의 이야기가 된다
    threads: [
      { id: 'family',  name: '민지네 가족',        desc: '기지 연구원 정우, 아내 수연, 민지(9)와 민호(6).' },
      { id: 'doctor',  name: '응급실 의사 이서윤', desc: '도시 병원 응급실의 야간 당직 의사.' },
      { id: 'clerk',   name: '편의점 알바 김도현', desc: '동네 편의점 야간 아르바이트생.' },
      { id: 'police',  name: '박 경위',            desc: '경찰서 상황실 근무.' },
      { id: 'teacher', name: '담임 정은희',        desc: '민지네 학교 3학년 담임 선생님.' },
      { id: 'anchor',  name: '라디오 진행자 한지수', desc: '시티FM 오후 프로그램 진행자. 지금은 97.5 MHz에서 혼자 방송한다.' },
      { id: 'soldier', name: '일병 최준혁',        desc: '북부 기지 경계병. 다리 봉쇄선에 섰다.' },
      { id: 'strangers', name: '이름 없는 생존자들', desc: '낙서된 지도와 쪽지. 적힌 곳에 가면 무언가 남아 있다.' },
      { id: 'city',    name: '도시의 목소리',      desc: '안내문, 훈령, 무전, 라디오.' },
    ],
    fragments: [
      // 민지네 가족
      { id: 'day_houses',    th: 'family',  ch: 'before', loc: 'houses',   title: '가족 달력',          text: '3월 달력. "7일 민지 학교 상담. 12일 정우 씨 생일, 케이크 예약(기지 야근 없는 날로!). 16일 캠핑!!" 16일에는 동그라미가 세 번 쳐져 있다.' },
      { id: 'note_houses',   th: 'family',  ch: 'start',  loc: 'houses',   title: '냉장고에 붙은 메모', text: '"정우 씨, 오늘도 기지에서 못 와? 뉴스에서 북부에 이상한 독감이 돈대. 애들 학교 휴교래. 퇴근길에 마스크 사 올게. 수연, 3월 15일"' },
      { id: 'fam_school',    th: 'family',  ch: 'week2',  loc: 'school',   title: '체육관 입소 명부',   text: '"3월 26일 입소. 김수연(38), 김민지(9), 김민호(6)." 비고란에 또박또박 적혀 있다. "남편 김정우, 북부 기지 연구동 근무. 연락 두절."' },
      { id: 'diary_houses',  th: 'family',  ch: 'week4',  loc: 'houses',   title: '아이의 그림일기',    text: '"4월 15일 맑음. 학교에서 집으로 돌아왔다. 체육관은 이제 안 된대. 아빠는 아직 안 왔다. 엄마가 아빠는 기지에서 사람들을 고치는 약을 만든대." 크레파스로 문 세 개가 그려져 있다.' },
      { id: 'note_base',     th: 'family',  ch: 'week4',  loc: 'base',     title: '연구동 출입 기록',   text: '"실험체 격리 실패. 3층 봉쇄. 정문 대피 인원은 받지 말 것." 맨 아래에 볼펜으로 덧붙였다. "이걸 읽는 사람이 있다면, 우리가 시작했다. 미안하다. 연구원 김정우"' },
      { id: 'fam_month3',    th: 'family',  ch: 'month3', loc: 'school',   title: '체육관 벽의 글씨',   text: '매직으로 크게. "정우 씨에게. 우리 셋 다 살아 있어. 아이들 데리고 남쪽 항구로 가. 이걸 보면 꼭 따라와. 수연, 6월 3일"' },
      { id: 'light_base',    th: 'family',  ch: 'now',    loc: 'base',     title: '아빠의 마지막 무전', text: '녹음기에 같은 말이 반복된다. "…수연아, 민지야, 민호야. 아빠는 아직 연구동 3층에 있다. 매일 밤 9시에 불을 세 번 깜빡일게. 이걸 듣는 누구라도, 내 가족을 보면 전해 줘. 미안하다고…"' },

      // 응급실 의사 이서윤
      { id: 'doc_before',    th: 'doctor',  ch: 'before', loc: 'hospital', title: '당직표',             text: '"3월 둘째 주 응급실 야간: 이서윤." 옆에 작은 글씨. "이번 주만 버티면 제주도!"' },
      { id: 'note_hospital', th: 'doctor',  ch: 'start',  loc: 'hospital', title: '응급실 인수인계 메모', text: '"3/14 야간. 고열과 발작 환자 7명, 전원 북부 신도시 거주. 독감 검사 음성. 원인 불명. 격리실이 모자라다. 이서윤"' },
      { id: 'memo_hospital', th: 'doctor',  ch: 'week2',  loc: 'hospital', title: '응급실 의사의 수첩', text: '"상처가 이상하다. 물린 자리가 아니라 혈관을 따라 번진다. 군에서 온 사람들이 샘플을 가져갔다. 그중 김정우라는 연구원이 나한테만 조용히 말했다. 이건 독감이 아니에요. 우리 거예요."' },
      { id: 'doc_week4',     th: 'doctor',  ch: 'week4',  loc: 'hospital', title: '진료 기록 마지막 장', text: '"병원 철수 명령. 환자를 두고 가라고 한다. 나는 남는다. 열병은 막을 수 없어도, 상처가 곪는 건 막을 수 있다."' },
      { id: 'ledger_mart',   th: 'doctor',  ch: 'month3', loc: 'mart',     title: '마트 2층 진료소 장부', text: '"진료비 통조림 1. 봉합 통조림 2. 항생제 1 = 통조림 3. 총알은 받지 않음." 맨 아래 한 줄. "사람은 더더욱. 이서윤"' },
      { id: 'doc_now',       th: 'doctor',  ch: 'now',    loc: 'mart',     title: '진료소 문의 쪽지',   text: '"항생제가 떨어져 진료소를 닫는다. 남쪽 항구 소문을 확인하러 간다. 돌아오지 못하면, 이 장부에 적힌 사람들은 모두 내 환자였다고 기억해 줘."' },

      // 편의점 알바 김도현
      { id: 'day_store',     th: 'clerk',   ch: 'before', loc: 'store',    title: '아르바이트 근무표',  text: '"3월 둘째 주 야간: 김도현." 아래에 볼펜으로 작게. "폐기 도시락 먹어도 됨. 점장님한테는 비밀."' },
      { id: 'clerk_start',   th: 'clerk',   ch: 'start',  loc: 'store',    title: '계산대 옆 메모',     text: '"3/15 새벽 3시. 손님이 계산대 앞에서 쓰러졌다가 일어나 나를 물려고 했다. 119는 계속 통화 중. 점장님한테 문자 보냄. 답 없음. 도현"' },
      { id: 'note_store',    th: 'clerk',   ch: 'week2',  loc: 'store',    title: '영수증 뒷면',        text: '"생수 12, 라면 30, 건전지. 계산대 아저씨 말로는 군인들이 다리를 막고 있단다. 시내로는 못 들어간대. 나도 집에 못 간다."' },
      { id: 'photo_gas',     th: 'clerk',   ch: 'week4',  loc: 'gas',      title: '사진 뒷면',          text: '피난 차량 행렬 사진. 뒷면에 적혀 있다. "4월 12일. 기지 가는 길이 차로 꽉 막혔다. 기름 떨어진 차들이 버려진다. 우리도 걸어간다. 가진 건 편의점 라면 두 박스. 도현"' },
      { id: 'clerk_month3',  th: 'clerk',   ch: 'month3', loc: 'hardware', title: '구겨진 쪽지',        text: '"검은 개가 나를 받아 줬다. 물이 있고 밥이 있다. 대신 밤마다 나가서 남의 것을 뺏어 와야 한다. 오늘 처음으로 사람을 때렸다. 손이 아직도 떨린다."' },
      { id: 'note_now_store', th: 'clerk',  ch: 'now',    loc: 'store',    title: '아직 따뜻한 쪽지',   text: '"검은 개에서 도망쳤다. 어제까지 여기 숨어 있었다. 컵라면 국물이 아직 따뜻할 거다. 당신도 살아 있다면 3번 국도 쪽은 피해라. 놈들이 거기 있다. 편의점 알바였던 사람."' },

      // 박 경위
      { id: 'pol_before',    th: 'police',  ch: 'before', loc: 'police',   title: '근무 일지',          text: '"3월 10일. 특이사항 없음. 북부 기지 쪽 야간 사이렌 소음 민원 3건. 군에 문의했으나 훈련 중이라는 답변. 박 경위"' },
      { id: 'call_police',   th: 'police',  ch: 'start',  loc: 'police',   title: '112 신고 기록',      text: '"3/15 02:14 옆집 사람이 남편을 물었다. 02:31 길에 쓰러졌던 사람이 일어나 달려든다. 02:40까지 같은 신고 37건. 출동 인원 부족."' },
      { id: 'pol_week2',     th: 'police',  ch: 'week2',  loc: 'police',   title: '봉쇄선 근무 명령서', text: '"3월 27일. 다리 봉쇄선 경찰 지원. 봉쇄선을 넘는 민간인은 군에 인계할 것." 메모란에 누군가 적었다. "사람에게 총을 겨누려고 경찰이 된 게 아니다."' },
      { id: 'note_police',   th: 'police',  ch: 'week4',  loc: 'police',   title: '상황실 무전 기록',   text: '"18:40 기지 통신 두절. 19:05 정문 방면 총성 다수. 19:30 상부 지시: 전 인원 철수, 시민 통제 해제. …우리가 마지막이다. 나는 남는다. 박"' },
      { id: 'poster_police', th: 'police',  ch: 'month3', loc: 'police',   title: '수배 전단',          text: '"약탈 집단 검은 개 두목. 현상금: 전투식량 10개. 시민 자경단 대표 박(전 경위)." 경찰서 게시판에 붙어 있다.' },
      { id: 'pol_now',       th: 'police',  ch: 'now',    loc: 'gas',      title: '자경단 연락 쪽지',   text: '"검은 개 본거지를 찾았다. 3번 국도 휴게소. 사람이 필요하다. 총을 쓸 줄 알면 매일 정오, 이 주유소 정비실로. 박"' },

      // 담임 정은희
      { id: 'day_school',    th: 'teacher', ch: 'before', loc: 'school',   title: '가정 통신문',        text: '"봄맞이 학부모 공개수업 안내. 3월 18일(수) 오전 10시. 많은 참석 바랍니다. 3학년 2반 담임 정은희." 그날 수업은 열리지 않았다.' },
      { id: 'teach_start',   th: 'teacher', ch: 'start',  loc: 'school',   title: '휴교 안내문',        text: '"[긴급] 3월 16일부터 무기한 휴교합니다. 가정에서 외출을 삼가 주십시오. 갈 곳이 없는 가정은 학교 체육관을 대피소로 엽니다. 정은희 드림"' },
      { id: 'note_school',   th: 'teacher', ch: 'week2',  loc: 'school',   title: '칠판의 글씨',        text: '"대피소 운영 4일째. 아이들 112명. 물이 모자라다. 군 수송 트럭이 오기로 했는데 오지 않는다. 오늘 밤은 체육관 문을 잠근다."' },
      { id: 'teach_week4',   th: 'teacher', ch: 'week4',  loc: 'school',   title: '교무 수첩',          text: '"트럭은 끝내 오지 않았다. 어젯밤 체육관 문이 뚫렸다. 아이들을 데리고 옥상으로 올라갔다. 몇 명을 잃었는지 세지 못하겠다. 민지네는 집으로 돌려보냈다. 잘한 걸까."' },
      { id: 'list_school',   th: 'teacher', ch: 'month3', loc: 'school',   title: '생존자 명단',        text: '"체육관 생존자 명단. 112명 중 41명." 마지막 기록은 6월 2일. 그 아래로 이름이 하나씩 줄로 지워져 있다.' },
      { id: 'teach_now',     th: 'teacher', ch: 'now',    loc: 'school',   title: '옥상의 흰 천',       text: '옥상 난간에 흰 천이 걸려 있다. 새로 쓴 글씨다. "아이들 13명 생존. 물이 필요합니다. 정은희."' },

      // 라디오 진행자 한지수
      { id: 'dj_before',     th: 'anchor',  ch: 'before', loc: 'mart',     title: '공개방송 포스터',    text: '"시티FM 〈한지수의 오후 네 시〉 공개방송! 3월 14일 오후 4시, 대형마트 1층 이벤트홀. 사연이 뽑힌 분께 즉석 선물." 포스터 위에 붉은 도장이 찍혀 있다. "행사 취소."' },
      { id: 'dj_start',      th: 'anchor',  ch: 'start',  loc: 'police',   title: '보도자료',           text: '"[군·경 합동 발표] 3월 15일. 북부 신도시 화학 물질 소량 유출. 인체에 해롭지 않음. 독감과 비슷한 증상이 있으면 집에서 쉴 것." 여백에 볼펜 글씨. "화학 물질인데 왜 독감 증상이지? 확인할 것. — 지수"' },
      { id: 'dj_week2',      th: 'anchor',  ch: 'week2',  loc: 'hospital', title: '취재 수첩',          text: '"3월 25일. 응급실 이서윤 선생 인터뷰. \'물린 적 없는 사람도 열이 나요.\' 공기로 옮는다는 뜻이냐고 물었더니 대답하지 않았다. 오늘 국장 지침. \'공기 감염\'이라는 말은 방송에서 쓰지 말 것."' },
      { id: 'dj_week4',      th: 'anchor',  ch: 'week4',  loc: 'gas',      title: '철수 버스 시간표',   text: '"시티FM 직원 철수 버스. 4월 13일 06:00, 방송국 앞. 1인 1가방." 그 아래 다른 글씨. "나는 안 탄다. 다 떠나면 남은 사람들한테는 누가 말해 주나. 지수"' },
      { id: 'dj_month3',     th: 'anchor',  ch: 'month3', loc: 'hardware', title: '송신기 부품 목록',   text: '"자동차 배터리 2, 전선 20m, 안테나 세울 쇠파이프 3. 철물점 뒤 창고에서 다 구했다. 주파수는 97.5. 방송 이름은… 도시의 마지막 라디오. 거창한가? 상관없다. 듣는 사람이 한 명이라도 있으면."' },
      { id: 'dj_now',        th: 'anchor',  ch: 'now',    loc: 'radio',    title: '방송 대신 편지',     text: '"…오늘은 사연 대신 제 편지를 읽을게요. 엄마, 나 아직 살아 있어. 이 도시에서 제일 시끄러운 사람이 됐어. 엄마가 들으면 웃겠다… 죄송해요, 여러분. 다음 곡 틀게요."' },

      // 일병 최준혁
      { id: 'sol_before',    th: 'soldier', ch: 'before', loc: 'base',     title: '휴가 신청서',        text: '"일병 최준혁. 3월 20일부터 4박 5일. 사유: 어머니 생신." 결재란에 붉은 도장. "보류 — 부대 비상 대기." 뒷면에 연필로. "또 보류. 엄마 미안."' },
      { id: 'sol_start',     th: 'soldier', ch: 'start',  loc: 'base',     title: '경계 근무 수첩',     text: '"3/14. 방독면 쓴 사람들이 연구동에서 들것을 날랐다. 우리한테는 화학 사고라고 했다. 화학 사고면 우리한테도 방독면을 줘야 하는 거 아닌가. 오늘부로 부대 전화가 다 끊겼다. 바깥 연락 금지."' },
      { id: 'sol_week2',     th: 'soldier', ch: 'week2',  loc: 'gas',      title: '초소 근무 일지',     text: '"다리 봉쇄 사흘째. 넘어오는 사람에게는 경고 사격. 오늘 아이를 안은 여자가 왔다. 나는 하늘을 쐈다. 옆 초소는 하늘을 쏘지 않았다."' },
      { id: 'sol_week4',     th: 'soldier', ch: 'week4',  loc: 'base',     title: '철수 헬기 탑승 명단', text: '"4월 14일 철수 헬기. 1편: 장교, 연구원. 2편: 부사관. 3편: 병사." 3편 칸 옆에 볼펜 글씨. "3편은 오지 않았다. 헬기 소리가 멀어지는 걸 다 같이 듣고만 있었다."' },
      { id: 'sol_month3',    th: 'soldier', ch: 'month3', loc: 'school',   title: '체육관 문 앞의 상자', text: '탄창 하나와 쪽지. "아이들을 지키는 데 써 주십시오. 저는 봉쇄선에서 하늘을 쏜 병사입니다. 이걸로 갚았다고 생각하지는 않습니다. 일병 최준혁."' },
      { id: 'sol_now',       th: 'soldier', ch: 'now',    loc: 'police',   title: '자경단 명부',        text: '"자경단 명부. 박(전 경위) 외 7명." 맨 아래에 새로 적힌 이름. "최준혁, 전 육군 일병. 사격 가능. 이번에는 지키는 쪽에 서겠습니다."' },

      // 이름 없는 생존자들: 낙서된 지도를 찾으면 적힌 곳에 물건이 있다 (cache)
      { id: 'str_mart',      th: 'strangers', ch: 'week4', loc: 'mart',     title: '냉동창고 문의 쪽지', text: '"우리는 남쪽으로 갑니다. 남은 생수는 냉동창고 맨 안쪽 선반 뒤에 두었어요. 필요한 사람 가져가요. 3층 할머니네가." 글씨가 떨린다.',
        cache: { loc: 'mart', place: '냉동창고 맨 안쪽 선반 뒤', items: { water_bottle: 4, canned_food: 2 } } },
      { id: 'str_store',     th: 'strangers', ch: 'month3', loc: 'store',   title: '누군가의 일기',      text: '"6월 1일. 아내가 열이 난다. 물린 데는 없다. 아무 데도 없다. 몇 번이나 확인했다. 그런데 왜." 다음 장은 비어 있다.' },
      { id: 'str_map_gas',   th: 'strangers', ch: 'month3', loc: 'houses',  title: '낙서된 동네 지도',   text: '동네 지도 위에 빨간 동그라미 하나. 옆에 적혀 있다. "주유소 정비실, 공구함 밑 바닥 판자. 통조림 넷, 붕대. 꼭 다시 올 것. — S"',
        cache: { loc: 'gas', place: '정비실 공구함 밑 바닥 판자', items: { canned_food: 4, bandage: 3 } } },
      { id: 'str_map_hosp',  th: 'strangers', ch: 'now',    loc: 'hardware', title: '접힌 약도',         text: '"병원 지하 보일러실, 환풍구 안쪽. 항생제 두 통이랑 진통제. 내 몫은 챙겼으니 나머지는 당신 거. 운이 좋으면 아직 있을 거다."',
        cache: { loc: 'hospital', place: '지하 보일러실 환풍구 안쪽', items: { antibiotics: 2, painkiller: 2 } } },
      { id: 'str_map_police', th: 'strangers', ch: 'now',   loc: 'school',  title: '탄약 메모',          text: '"경찰서 뒤뜰 순찰차 트렁크. 산탄 여섯 발. 열쇠는 앞바퀴 위. 나는 총이 없으니 쓸 사람이 쓰길."',
        cache: { loc: 'police', place: '뒤뜰 순찰차 트렁크', items: { shells: 6 } } },
      { id: 'str_map_base',  th: 'strangers', ch: 'now',    loc: 'hospital', title: '마지막 지도',       text: '"기지 정문 초소 지붕 위. 내가 모은 전부다. 열이 내리지 않는다. 나는 이제 못 쓸 것 같다. 누군가 쓰면 그걸로 됐다."',
        cache: { loc: 'base', place: '정문 초소 지붕 위', items: { first_aid: 1, pistol_ammo: 12, ration: 2 } } },

      // 도시의 목소리
      { id: 'note_gas',      th: 'city',    ch: 'before', loc: 'gas',      title: '정비 일지',          text: '"3월 9일. 탱크로리 기사가 그러는데, 요즘 기지 쪽에서 밤마다 사이렌이 운단다. 훈련이겠지."' },
      { id: 'city_sms',      th: 'city',    ch: 'start',  loc: 'houses',   title: '휴대폰 재난 문자',   text: '꺼진 휴대폰을 충전해 보니 문자 두 통이 남아 있다. "[재난문자] 3/15 07:12 북부 신도시 화학 물질 유출. 창문을 닫고 실내에 머무르십시오." "[재난문자] 3/15 19:40 독감 유사 증상자는 병원 방문을 자제하고 자택에서 대기하십시오."' },
      { id: 'notice_mart',   th: 'city',    ch: 'start',  loc: 'mart',     title: '구매 제한 안내문',   text: '"고객 여러분께. 생수, 라면, 통조림은 1인 2개로 구매를 제한합니다. 마스크는 품절입니다. 3월 16일 점장."' },
      { id: 'city_leaflet',  th: 'city',    ch: 'week2',  loc: 'gas',      title: '헬기가 뿌린 전단',   text: '"계엄사령부 알림. 1. 실내에 머무르십시오. 2. 봉쇄선에 접근하면 발포합니다. 3. 물린 상처가 없어도 열이 나면 격리 대상입니다. 4. 구조를 기다리십시오." 4번 아래에 누군가 볼펜으로 적었다. "언제까지?"' },
      { id: 'order_base',    th: 'city',    ch: 'week2',  loc: 'base',     title: '훈령 사본',          text: '"계엄 선포에 따라 북부 권역 전면 봉쇄. 봉쇄선에 접근하는 민간인은 경고 후 조치할 것. 감염 의심자는 기지 연구동으로 이송. 3월 28일."' },
      { id: 'city_power',    th: 'city',    ch: 'week4',  loc: 'hardware', title: '전력 공급 중단 공지', text: '"북부 권역 전력 공급을 4월 20일부로 중단합니다. 상수도 공급도 순차적으로 중단됩니다. 그동안 이용해 주셔서 감사합니다." 공지문 위에 누가 덧써 놓았다. "감사는 무슨."' },
      { id: 'note_mart',     th: 'city',    ch: 'week4',  loc: 'mart',     title: '무전기 녹음',        text: '"…여기는 북부 대피 본부… 생존자는 군사기지 정문으로… 반복한다, 정문으로… 감염자는 절대 기지 안으로… [잡음]"' },
      { id: 'graffiti_hw',   th: 'city',    ch: 'month3', loc: 'hardware', title: '벽의 낙서',          text: '붉은 스프레이. "이 구역은 검은 개의 것이다. 통행료 물 2병. 어기면 죽는다."' },
      { id: 'radio_port',    th: 'city',    ch: 'now',    loc: 'radio',    title: '라디오 방송',        text: '"…남쪽 항구에서 배가 뜬다는 소문은 사실이 아닙니다. 반복합니다… 아니, 사실일 수도 있습니다. 누구라도 이걸 듣고 있다면…" 방송은 거기서 끊겼다.' },
      { id: 'radio_winter',  th: 'city',    ch: 'now',    loc: 'radio',    title: '반복되는 방송',      text: '"…이 방송은 매일 반복됩니다. 거점을 지키는 생존자 여러분, 겨울이 오기 전에 연료를 모으십시오. 그리고 밤에는 불을 끄십시오…"' },
    ],
    allFragments: '흩어진 메모를 모두 모았다. 기지에서 시작된 열병, 화학 물질이라던 발표, 막힌 다리와 하늘로 쏜 총, 오지 않은 트럭과 세 번째 헬기, 끊긴 전기. 그리고 아직 끝나지 않은 이야기들. 남쪽 항구로 간 수연과 아이들, 진료소를 닫고 떠난 이서윤, 검은 개를 쫓는 박 경위와 최준혁, 옥상의 아이들 13명, 97.5 MHz에서 혼자 떠드는 한지수. 그리고 매일 밤 9시, 기지 3층에서 세 번 깜빡이는 불빛.',
    // 처음 겪는 순간
    moments: {
      firstKill: '처음으로 무언가를 죽였다. 손이 한참 동안 떨렸다.',
      firstNight: '밖에서 밤을 맞았다. 어둠이 이렇게 깊은 줄 몰랐다.',
      firstOverweight: '짐이 어깨를 짓누른다. 욕심일까, 생존일까.',
      firstDebuff: '몸이 망가지는 건 한순간이다. 조심해야 한다.',
      firstLevel: '몸이 이 세계에 적응하고 있다. 조금씩, 그러나 확실하게.',
      firstWake: '죽음의 문턱까지 갔다가 돌아온 기분이다. 다음은 없을지도 모른다.',
      firstRadio: '라디오 너머에 아직 사람이 있다. 그것만으로 오늘은 버틸 수 있다.',
      firstCache: '이름 모를 누군가가 남긴 지도를 따라왔다. 만난 적도 없는 사람이 나를 살렸다.',
    },
    // 인연: 기록 속 사람들을 만나 돕는다. unlock 중 하나라도 맞으면 열린다 (frag:기록, radio:들은 방송, flag:인연 플래그)
    // 단계마다 loc(장소), hours(시각, 이상~미만), wait(앞 단계 뒤 며칠), choices(사건과 같은 선택지)
    // need: 필요한 물건 ('@그룹'은 bondGroups 중 아무거나) · give: 필요한 물건을 건넨다
    // quest: 'next'/'done' · flag: 라디오와 다른 인연에 남는 표시 · chain: 다음 단계를 바로 잇는다 · if/unless/ifHeard/ifFrag: 선택지가 보일 조건
    bondGroups: {
      water: { name: '생수·끓인 물', ids: ['water_bottle', 'boiled_water'] },
      food: { name: '먹을 것', ids: ['canned_food', 'ration', 'jerky', 'instant_noodle', 'toast', 'cooked_meat', 'stew', 'meat_ramen', 'tonic_soup', 'chocolate'] },
      ammo: { name: '탄약', ids: ['pistol_ammo', 'shells'] },
    },
    bonds: [
      { id: 'kids', th: 'teacher', who: '정은희와 아이들', unlock: ['frag:teach_now', 'radio:last:26'],
        done: '정은희와 아이들 13명은 옥상에서 겨울을 준비한다. 학교에 가면 아이들이 옥상에서 망을 봐 준다 (학교 조우 -50%).',
        steps: [
          { loc: 'school', title: '옥상 문', hint: '학교 옥상에 물을 가져다주자 (생수·끓인 물 6)',
            text: '옥상으로 가는 철문을 두드리자 한참 뒤 문이 손가락 두 마디만큼 열린다. 마른 여자가 쇠파이프를 쥐고 있다. "누구세요." 그 뒤로 작은 얼굴들이 겹쳐 보인다. "…물을 가져오셨어요?"',
            choices: [
              { label: '물 6병을 건넨다', sub: '생수·끓인 물 6', need: [['@water', 6]], outcome: { give: true, quest: 'next', flag: 'kids_water', xp: ['resolve', 6],
                log: '여자가 물병을 받아 아이들에게 하나씩 나눠 준다. 아이들이 두 손으로 병을 쥐고 마신다. "고맙습니다. 정말로…" 그녀는 그제야 쇠파이프를 내려놓았다. "정은희예요. 3학년 2반 담임이었어요."' } },
              { label: '지금은 줄 게 없다', sub: '돌아선다', outcome: { log: '"…그래요. 다음에." 문이 다시 닫혔다. 문 너머에서 아이 하나가 묻는다. "선생님, 그 사람 또 와?"' } },
            ] },
          { loc: 'school', wait: 1, title: '열이 나는 아이', hint: '학교 옥상의 아픈 아이에게 약을 (항생제 또는 구급상자 1)',
            text: '정은희가 문을 활짝 연다. 얼굴이 하얗다. "민서가 사흘째 열이 나요. 물린 데는 없어요. 정말이에요. 약이… 약이 있으면…"',
            choices: [
              { label: '항생제를 준다', sub: '항생제 1', need: [['antibiotics', 1]], outcome: { give: true, quest: 'next', xp: ['resolve', 6],
                log: '정은희가 알약을 반으로 쪼개 물에 녹였다. 민서는 쓰다고 울면서도 다 마셨다. 그날 밤 열이 내렸다고, 다음에 왔을 때 들었다.' } },
              { label: '구급상자를 준다', sub: '구급상자 1', need: [['first_aid', 1]], outcome: { give: true, quest: 'next', xp: ['resolve', 6],
                log: '구급상자 안의 해열제와 소독약으로 정은희가 밤새 민서를 돌봤다. 다음 날 아침, 민서가 처음으로 죽을 다 먹었다고 했다.' } },
              { label: '줄 수 없다', sub: '돌아선다', outcome: { log: '"…알겠어요." 그녀는 문을 닫지 않고 오래 서 있었다.' } },
            ] },
          { loc: 'school', wait: 2, title: '겨울 준비', hint: '학교 옥상에 먹을 것을 (먹을 것 8)',
            text: '옥상에 텐트가 하나 늘었다. 아이들이 빗물 받는 통을 줄 세워 두었다. 민서가 제일 먼저 뛰어나온다. 정은희가 웃는다. 처음 보는 웃음이다. "덕분에 다들 버티고 있어요. 그런데 곧 추워질 거예요. 먹을 게…"',
            choices: [
              { label: '먹을 것 8개를 건넨다', sub: '통조림, 전투식량, 육포 등', need: [['@food', 8]], outcome: { give: true, quest: 'done', flag: 'kids_fed', xp: ['resolve', 10],
                log: '아이들이 통조림을 줄지어 옮긴다. 막내가 크레파스 그림을 내밀었다. 철문 앞에 서 있는 사람. 나다. 정은희가 말했다. "이제 학교에 오면 아이들이 옥상에서 망을 볼 거예요. 놈들이 보이면 깡통을 두드릴게요."' } },
              { label: '다음에 가져오겠다', sub: '돌아선다', outcome: { log: '"기다릴게요." 아이들이 옥상 난간에서 손을 흔든다.' } },
            ] },
        ] },

      { id: 'dohyun', th: 'clerk', who: '김도현', unlock: ['frag:note_now_store', 'radio:last:5', 'radio:ham:p13'],
        done: '김도현은 몸을 추슬러 떠났다. 그가 남긴 종이에는 검은 개의 보급 창고가 적혀 있었다.',
        steps: [
          { loc: 'houses', title: '다락의 인기척', hint: '주택가 어딘가에 김도현이 숨어 있다',
            text: '다락방 천장 판자가 들썩였다. 판자 틈으로 칼끝이 먼저 나왔다. "오, 오지 마요!" 마른 청년이다. 편의점 조끼를 아직 입고 있다. 한쪽 다리에 피가 배어 있다.',
            choices: [
              { label: '붕대를 감아 준다', sub: '붕대 1', need: [['bandage', 1]], outcome: { give: true, quest: 'next', xp: ['resolve', 5],
                log: '"…왜 도와줘요?" 대답 대신 붕대를 감았다. 청년이 칼을 내려놓았다. "김도현이에요. 편의점 알바였어요. 검은 개에서 도망쳤어요. 거기서… 사람을 때렸어요. 시켜서요."' } },
              { label: '구급상자로 치료한다', sub: '구급상자 1', need: [['first_aid', 1]], outcome: { give: true, quest: 'next', xp: ['resolve', 5],
                log: '상처를 꿰매는 동안 청년은 이를 악물고 소리를 내지 않았다. "김도현이에요. 검은 개에서 도망쳤어요. 고마워요. 진짜로."' } },
              { label: '조용히 물러난다', sub: '건드리지 않는다', outcome: { log: '판자가 다시 닫혔다. 위에서 숨죽인 울음소리가 들린다.' } },
            ] },
          { loc: 'houses', wait: 1, title: '누나의 목소리', hint: '김도현에게 먹을 것을 (먹을 것 2). 라디오에서 누나 소식을 들었다면 전해 주자',
            text: '도현이 다락에서 내려와 벽에 기대 앉아 있다. 다리는 아물고 있다. "배고파요… 사흘째 아무것도 못 먹었어요."',
            choices: [
              { label: '먹을 것을 주고, 라디오에서 들은 누나 이야기를 전한다', sub: '먹을 것 2', need: [['@food', 2]], ifHeard: ['last:5', 'ham:p13'],
                outcome: { give: true, quest: 'done', flag: 'dohyun_sister', xp: ['resolve', 8],
                  cache: { loc: 'hardware', place: '지하 보일러실 (검은 개 보급 창고)', items: { pistol_ammo: 12, ration: 2, fuel: 1 } },
                  log: '도현이 통조림을 먹다 말고 숟가락을 내려놓았다. "누나가… 라디오에서요? 97.5요?" 한참을 울던 그가 일어섰다. "송신탑으로 갈게요. 거기서 누나한테 연락할 수 있을 거예요." 떠나기 전에 종이 한 장을 내밀었다. "검은 개 보급 창고예요. 철물점 지하. 놈들은 이제 거기 잘 안 가요."' } },
              { label: '먹을 것을 준다', sub: '먹을 것 2', need: [['@food', 2]],
                outcome: { give: true, quest: 'done', flag: 'dohyun_left', xp: ['resolve', 6],
                  cache: { loc: 'hardware', place: '지하 보일러실 (검은 개 보급 창고)', items: { pistol_ammo: 12, ration: 2, fuel: 1 } },
                  log: '도현이 허겁지겁 먹었다. "고마워요. 이제 걸을 수 있어요." 그는 북쪽으로 가 보겠다고 했다. 떠나기 전에 종이 한 장을 내밀었다. "검은 개 보급 창고예요. 철물점 지하. 당신이 쓰는 게 맞아요."' } },
              { label: '다음에 오겠다', sub: '돌아선다', outcome: { log: '"…기다릴게요. 여기 말고는 갈 데도 없어요."' } },
            ] },
        ] },

      { id: 'vigilante', th: 'police', who: '박 경위와 최준혁', unlock: ['frag:pol_now', 'frag:poster_police', 'frag:sol_now', 'radio:last:24'],
        done: '자경단이 검은 개를 쳤다. 3번 국도가 조용해졌고, 약탈자를 만나는 일이 크게 줄었다.',
        steps: [
          { loc: 'gas', hours: [11, 14], title: '정오의 정비실', hint: '정오 무렵(11~14시) 주유소 정비실로',
            text: '정오. 정비실 셔터 아래로 군화 두 켤레가 보인다. "총 쓸 줄 알아?" 반백의 남자가 묻는다. 박 경위다. 옆의 젊은 남자가 소총을 고쳐 멘다. 군복 상의에 \'최준혁\'이라는 이름표가 그대로 붙어 있다.',
            choices: [
              { label: '합류한다. 붕대를 보탠다', sub: '붕대 3', need: [['bandage', 3]], outcome: { give: true, quest: 'next', flag: 'joined_vigilante', xp: ['resolve', 6],
                log: '박 경위가 붕대를 세어 보더니 고개를 끄덕였다. "내일 저녁, 3번 국도 휴게소. 놈들 창고를 친다. 올 거면 해 지기 전에 여기로 와." 최준혁이 짧게 경례했다. 습관인 것 같았다.' } },
              { label: '합류한다. 탄약을 보탠다', sub: '탄약 6발', need: [['@ammo', 6]], outcome: { give: true, quest: 'next', flag: 'joined_vigilante', xp: ['resolve', 6],
                log: '최준혁이 탄약을 받아 탄창에 하나씩 끼운다. "이거면 됩니다." 박 경위가 지도를 접었다. "내일 저녁, 해 지기 전에 여기로 와."' } },
              { label: '아직은 아니다', sub: '돌아선다', outcome: { log: '"그래. 마음 바뀌면 정오에 와. 매일 여기 있다."' } },
            ] },
          { loc: 'gas', wait: 1, hours: [16, 21], title: '3번 국도 휴게소', hint: '저녁(16~21시)에 주유소로. 자경단과 검은 개를 친다',
            text: '자경단 여덟 명이 정비실에 모여 있다. 박 경위가 지도를 펼친다. "놈들은 열둘. 우리는 아홉. 정면은 우리가 맡는다. 너는 준혁이랑 뒤로 돌아." 최준혁이 고개를 끄덕인다. "이번에는 지키는 쪽으로 쏩니다."',
            choices: [
              { label: '함께 간다', sub: '전투 · 자경단과 함께 승률 +20%', outcome: { time: 60, combat: 'black_dogs', canFlee: false, bonus: 20, bonusLabel: '자경단과 함께', winLoot: 2,
                win: { quest: 'done', flag: 'black_dogs_gone', xp: ['resolve', 12], items: [['shells', 8, 8], ['ration', 2, 2]],
                  log: '휴게소에 불길이 치솟았다. 검은 개는 흩어졌다. 박 경위가 그을린 얼굴로 손을 내밀었다. "고맙다. 이 도시에도 아직 지킬 게 남아 있었네." 최준혁이 산탄 한 줌과 전투식량을 쥐여 주었다.' },
                lose: { log: '…정신을 차리니 정비실 바닥이다. 최준혁이 나를 끌고 나왔다고 했다. "놈들도 많이 다쳤습니다. 다시 갑니다. 준비되면 저녁에 오세요."' } } },
              { label: '아직 준비가 안 됐다', sub: '돌아선다', outcome: { log: '"내일 저녁에도 간다. 준비되면 와." 박 경위가 담배 대신 껌을 씹는다.' } },
            ] },
        ] },

      { id: 'clinic', th: 'doctor', who: '이서윤', unlock: ['frag:doc_now', 'radio:last:14', 'radio:last:28'], minDay: 14,
        done: '이서윤이 마트 2층 진료소를 다시 열었다. 마트에 가면 하루 한 번 무료로 치료받을 수 있다.',
        steps: [
          { loc: 'mart', title: '닫힌 진료소', hint: '마트 2층 진료소에 이서윤이 돌아왔다 (항생제 2, 의료 소모품 3)',
            text: '마트 2층 진료소 문에 붙어 있던 \'진료 중단\' 쪽지가 떼어져 있다. 안에서 누군가 빈 약병을 세고 있다. 흰 가운은 잿빛이 됐다. "…환자예요? 미안해요. 약이 없어요. 항구에도 아무것도 없었어요."',
            choices: [
              { label: '항생제와 의료 소모품을 건넨다', sub: '항생제 2 · 의료 소모품 3', need: [['antibiotics', 2], ['medical_supplies', 3]], outcome: { give: true, quest: 'done', flag: 'clinic', xp: ['resolve', 10],
                log: '이서윤이 약병을 오래 들여다보았다. "이거면… 문을 다시 열 수 있어요." 그녀는 장부 맨 위에 이름 대신 \'첫 번째 후원자\'라고 적었다. "다치면 오세요. 당신은 언제든 무료예요."' } },
              { label: '항구 이야기를 묻는다', sub: '이야기만 듣는다', unless: 'heard_port', outcome: { flag: 'heard_port',
                log: '"배는 없었어요. 부두엔 놈들뿐이었고요. 그런데 항구 쪽으로 걸어가던 엄마와 아이 둘을 봤다는 사람이 있었어요. 아이 하나가 노란 우비를 입고 있었대요." 그녀가 고개를 저었다. "누군지 알 것 같아요. 체육관에서 봤던 민지네예요."' } },
              { label: '그냥 나간다', sub: '돌아선다', outcome: { log: '"약을 구하면 와 줘요. 기다리는 사람이 많아요."' } },
            ] },
        ] },

      { id: 'dj', th: 'anchor', who: '한지수', unlock: ['radio:last:22', 'frag:dj_month3'],
        done: '송신탑 아래 상자에 배터리를 두고 왔다. 97.5는 계속 떠든다.',
        steps: [
          { loc: 'hardware', title: '송신탑 아래 상자', hint: '철물점 뒤 송신탑 아래 상자에 배터리를 (배터리 3, 전선 2)',
            text: '철물점 뒤 언덕에 쇠파이프를 이어 붙인 안테나가 서 있다. 아래에 페인트로 \'사연함\'이라고 쓴 공구 상자가 있다. 안에는 쪽지가 수북하다. 맨 위 쪽지. "지수 씨 덕분에 오늘도 버텼어요."',
            choices: [
              { label: '배터리와 전선을 넣어 둔다', sub: '배터리 3 · 전선 2', need: [['battery', 3], ['wire', 2]], outcome: { give: true, quest: 'done', flag: 'dj_battery', flagBefore: { day: 30, before: 'dj_battery_early', after: 'dj_battery_late' }, xp: ['resolve', 8],
                log: '상자에 배터리를 넣고 쪽지 한 장을 남겼다. "계속 떠들어 주세요." 이름은 쓰지 않았다. 언덕을 내려오는데 안테나 끝의 작은 불이 깜빡였다.' } },
              { label: '사연을 하나 남긴다', sub: '쪽지 한 장', unless: 'dj_letter', outcome: { flag: 'dj_letter',
                log: '"거점에서 듣고 있어요. 오늘도 살아 있어요." 이름 대신 \'철문 집\'이라고 적었다.' } },
              { label: '그냥 간다', sub: '돌아선다', outcome: { log: '상자 뚜껑을 닫았다. 바람에 안테나가 낮게 운다.' } },
            ] },
        ] },

      { id: 'jungwoo', th: 'family', who: '김정우', unlock: ['frag:light_base', 'radio:last:18', 'radio:military:12'],
        done: '김정우는 혈청을 남기고 가족을 찾아 남쪽 항구로 떠났다. 기지 3층의 불빛은 더 이상 깜빡이지 않는다.',
        steps: [
          { loc: 'base', hours: [20, 23], title: '세 번의 불빛', hint: '밤 9시 무렵(20~23시) 군사기지 연구동 3층',
            text: '밤 9시. 연구동 3층 창문에서 불빛이 세 번 깜빡인다. 쉬었다가, 다시 세 번. 판자로 막힌 1층 비상문에 \'노크 세 번\'이라고 긁어 놓은 글씨가 있다.',
            choices: [
              { label: '노크를 세 번 한다', sub: '문 너머로', outcome: { quest: 'next', chain: true, flag: 'jungwoo_met', log: '안쪽에서 계단을 내려오는 발소리가 들린다. 빗장이 하나씩 풀린다.' } },
              { label: '지금은 돌아간다', sub: '기지는 위험하다', outcome: { log: '불빛은 한 번 더 세 번 깜빡이고 꺼졌다.' } },
            ] },
          { loc: 'base', hours: [20, 24], title: '연구원 김정우', hint: '밤(20시 이후)에 기지 연구동 3층의 김정우에게. 수연의 메시지를 찾았다면 전해 주자',
            text: '수염이 덥수룩한 남자가 손전등을 내린다. 팔에 붕대를 칭칭 감았다. "사람… 사람이네요. 저는 김정우입니다. 여기서 시작된 걸 끝내 보려고 남았어요." 벽 메모에 \'37009\'라고 적혀 있다. "군 주파수 숫자 들었죠? 이 방 냉동고 번호예요. 샘플을 회수하러 온다고 했어요. 안 왔지만." 책상 위에 앰풀이 줄지어 있다. "혈청이에요. 아직 완성은 아니지만."',
            choices: [
              { label: '수연의 메시지를 전한다', sub: '체육관 벽의 글씨', ifFrag: 'fam_month3', outcome: { quest: 'done', flag: 'jungwoo_left', xp: ['resolve', 12], items: [['serum', 2, 2]],
                log: '"남쪽 항구로… 셋 다 살아 있다고요?" 그가 벽을 짚고 주저앉았다. 한참 뒤 그가 앰풀 두 개를 내 손에 쥐여 주었다. "가져가요. 저는 항구로 갑니다. 이걸 끝내지 못한 채로라도." 그날 밤, 3층의 불빛은 처음으로 켜지지 않았다.' } },
              { label: '혈청을 하나 얻는다', sub: '그는 여기 남는다', unless: 'jungwoo_serum', outcome: { flag: 'jungwoo_serum', items: [['serum', 1, 1]],
                log: '"이걸 가져가요. 감염이 깊어도 되돌릴 수 있어요. 아마도." 그가 앰풀 하나를 건넸다. "제 가족을 보면… 미안하다고 전해 주세요." 불빛은 오늘 밤에도 깜빡일 것이다.' } },
              { label: '그냥 떠난다', sub: '다시 올 수 있다', outcome: { log: '"또 와요. 매일 밤 9시에 불을 켤게요." 문이 다시 잠긴다.' } },
            ] },
        ] },
    ],
    // 깊은 잠: 메뉴에서 고르는 세미 초기화. 지어 둔 시설(facLevel 레벨로)과 스킬(skillLoss만큼 내려서)만 남고
    // 나머지는 모두 새 게임처럼 처음으로 돌아간다 (물건, 장비, 창고, 기록, 인연, 라디오, 숨겨 둔 물건, DAY 1)
    deepSleep: {
      facLevel: 1,
      skillLoss: 5,
      title: '깊은 잠',
      ask: '담요를 머리끝까지 덮었다. 이대로 아주 오래 잠들면, 모든 게 처음으로 돌아갈 것만 같다.',
      wake: [
        '얼마나 잤는지 모르겠다. 눈을 뜨니 벽에 새겨 둔 날짜 줄이 보이지 않는다. 누가 지운 걸까, 내가 지운 걸까.',
        '가진 것은 아무것도 없다. 창고는 비었고, 숨겨 둔 곳도, 읽었던 메모도, 라디오의 목소리도 꿈처럼 흐릿하다.',
        '창고의 시설들만 녹슬고 내려앉은 채 겨우 형태가 남았다. 그리고 몸이 조금은 기억한다. 손에 익었던 일들을.',
        '오늘이 첫날이다. 다시.',
      ],
      button: '철문을 연다',
    },
    // 수색할 때 가끔 장소의 흔적을 본다 (locations의 ambient)
    ambientChance: 0.3,
    titleTagline: '이것은 당신이 어떻게 살아남았는지에 대한 이야기다. 아직은.',
    deathTagline: '이것은 당신이 어떻게 죽었는지에 대한 이야기다.',
    // 메모에 적힌 은닉처를 뒤지는 시간
    cacheMinutes: 20,
    // 거점의 라디오: 채널마다 날짜(게임 일차)별 방송. 그날까지 나온 것 중 가장 늦은 방송이 들린다
    // silent: 그날부터 그 채널은 조용하다 · minor: 놓쳐도 다시 틀지 않는 반복 방송 · pool: 들을 때마다 바뀌는 무전
    // if/unless: 인연 플래그에 따라 바뀌는 방송 · react: 그 플래그가 생긴 다음 날 나오는 방송 (새 방송보다 먼저)
    // 듣지 못하고 지나간 방송은 나중에 들을 때 '지난 방송'으로 무작위로 나온다
    radio: {
      minutes: 15,
      calmMult: 0.5,
      channels: [
        { id: 'emergency', name: '89.1 MHz · 비상 안내 방송', at: [
          { day: 1, text: '[자동 방송] 시민 여러분께 알립니다. 북부 권역 대피 본부는 4월 14일부로 철수하였습니다. 남아 계신 분들은 문을 잠그고 실내에 머무르십시오. 물은 반드시 끓여 드십시오. 감염 의심자와 접촉하지 마십시오. 이 방송은 자동으로 반복됩니다.' },
          { day: 5, minor: true, text: '[자동 방송] …대피 본부는 …철수하였습니다. 남아 계신 분들은… 실내에… 물은 반드시… 이 방송은 자동으로…' },
          { day: 9, minor: true, text: '[자동 방송] …지지직… 끓여 드십시오… 접촉하지… 지지직… 반복됩니다… 반복됩…' },
          { day: 13, minor: true, text: '말소리는 사라지고, 삐— 하는 시험 신호음만 길게 이어진다.' },
          { day: 16, silent: true, text: '89.1 MHz는 이제 아무 소리도 내지 않는다. 송신소의 비상 배터리가 다 된 모양이다.' },
        ] },
        { id: 'last', name: '97.5 MHz · 도시의 마지막 라디오', at: [
          { day: 1, text: '"…켜져 있나요? 좋아요. 여기는 97.5, 도시의 마지막 라디오. 저는 한지수예요. 석 달째 이 도시에 남아 있는 여러분, 오늘도 살아 있어 줘서 고마워요. 오늘의 소식. 마트 2층 진료소가 문을 닫았대요. 항생제는 이제 각자 구하셔야 해요."' },
          { day: 3, text: '"오늘의 생존 요령. 빗물은 꼭 끓여 드세요. 연료 아깝다고 그냥 마시면 사흘을 화장실에서 보내요. 제가 그랬거든요."' },
          { day: 5, text: '"청취자 사연이에요. 송신탑 아래 상자에 쪽지가 들어 있었어요. \'편의점에서 일하던 동생을 찾습니다. 김도현, 스물셋. 검은 개에 끌려갔다는 소문이 있어요.\' 도현 씨, 듣고 있다면… 누나가 기다려요."' },
          { day: 8, text: '"헬기 소리 들으셨어요? 저도 들었어요. 구조 헬기냐고요? 아니에요. 그냥 지나갔어요. 하늘에서는 우리가 안 보이나 봐요. 그러니까 손 흔들지 마세요. 놈들만 몰려와요."' },
          { day: 11, text: '"오늘은 음악을 틀게요. 테이프가 늘어나서 노래가 조금 느리게 들려요. 그래도… 같이 들어요." 늘어진 노래가 잡음 사이로 흘러나온다.' },
          { day: 14, text: '"마트에서 진료소 하던 선생님이 남쪽 항구에 다녀오셨대요. 배는 없었대요. 부두엔 놈들뿐이었고요. 대신 6월 초에 항구 쪽으로 걸어가던 엄마와 아이 둘을 봤다는 사람을 만났대요. 무사하길."' },
          { day: 18, text: '"기지 3층에서 밤마다 불빛이 깜빡인다는 제보가 많아요. 세 번 깜빡이고, 쉬고, 다시 세 번. 매일 밤 9시래요. 누군가 신호를 보내는 걸까요."' },
          { day: 22, unless: 'dj_battery', text: '"송신기 배터리가 얼마 안 남았어요. 남는 자동차 배터리 있는 분… 아, 가져다줄 방법이 없겠네요. 괜찮아요. 남은 만큼만 할게요."' },
          { day: 26, unless: 'kids_fed', text: '"옥상에 흰 천 걸린 학교 아시죠? 거기 아이들 열세 명이 있어요. 선생님 한 분이 지키고 계세요. 근처를 지나가시면… 물 한 병이라도 문 앞에 두고 가 주세요."' },
          { day: 30, unless: 'dj_battery_early', text: '"이게 마지막 방송이 될 것 같아요. 배터리도, 저도 바닥이에요. 그래도 석 달 동안 혼자 떠든 게 아니었다는 거 알아요. 여러분이 들어 줬으니까. 문 꼭 잠그고, 물 끓여 마시고, 내일도 살아 있으세요. 여기는 97.5, 도시의 마지막 라디오. 한지수였습니다."' },
          { day: 33, silent: true, unless: 'dj_battery_early', text: '97.5 MHz에는 잡음만 흐른다.' },
          { day: 45, unless: 'dj_battery', text: '"…아, 아. 들리세요? 저 한지수예요. 아직 살아 있어요. 누가 송신탑 아래 상자에 자동차 배터리를 두고 갔어요. 쪽지도 있었어요. \'계속 떠들어 주세요.\' …네. 그럴게요. 여기는 97.5, 도시의 마지막 라디오입니다."' },
          { day: 52, unless: 'black_dogs_gone', text: '"오늘의 소식. 3번 국도 휴게소에서 큰불이 났대요. 자경단이 검은 개 본거지를 쳤다는 소문이에요. 확인된 건 없어요. 박 경위님, 듣고 계시면… 무사하시길."' },
          { day: 60, text: '"두 달째 같이 버티는 여러분. 오늘은 제가 제일 좋아하는 노래를 틀게요. 테이프가 한 번 끊겨서 붙인 거라 중간에 1초쯤 비어요. 그 1초 동안은… 각자 보고 싶은 사람 생각해요."' },
          { day: 75, text: '"밤이 길어졌어요. 곧 추워질 거예요. 연료 모으시고, 창문 틈은 테이프로 막으세요. 그리고 불빛이 밖으로 새지 않게. 놈들은 빛을 보고 와요."' },
          { day: 90, unless: 'jungwoo_left', text: '"기지 3층 불빛, 요즘도 보이세요? 저는 어젯밤에도 봤어요. 세 번 깜빡이고, 쉬고, 다시 세 번. 누군지 몰라도 그 사람도 우리처럼, 매일 밤 누군가를 기다리고 있는 거겠죠."' },
          { day: 2, text: '"어제 처음 들으신 분도 계시죠? 반가워요. 규칙은 하나예요. 이 방송은 배터리가 허락하는 만큼 매일 해요. 오늘의 소식은 없어요. 그게 오늘의 소식이에요."' },
          { day: 4, text: '"오늘의 생존 요령. 문은 잠그는 것보다 막는 게 낫대요. 경첩 쪽에 가구를 대 두세요. 놈들은 문고리를 돌릴 줄 몰라요. 미는 것만 알아요."' },
          { day: 6, text: '"요즘 밤마다 개 짖는 소리 들리시죠? 개들도 배가 고파요. 무리 지어 다니는 개는 놈들보다 빨라요. 밤엔 웬만하면 나가지 마세요."' },
          { day: 7, text: '"일주일째 같이 버텨 준 여러분께 노래 하나 틀어 드릴게요. 제목은 몰라요. 송신탑 아래 상자에 누가 넣어 둔 테이프예요. 라벨에 \'우리 딸 결혼식\'이라고 쓰여 있어요."' },
          { day: 9, text: '"사연이에요. \'옆집 할머니가 매일 아침 베란다에 화분을 내놓으세요. 물도 주시고요. 저도 따라 하기로 했어요.\' …저도 오늘 화분 하나 키워 볼게요. 뭘 심어야 할지는 모르겠지만."' },
          { day: 10, text: '"오늘은 조금 무서운 얘기를 할게요. 물린 사람이 바로 변하지 않을 때가 있대요. 하루쯤 걸리기도 한대요. 그러니까… 같이 있는 사람이 물렸다면, 그 하루 동안 할 말은 꼭 하세요."' },
          { day: 12, text: '"정부 발표 기억나세요? 처음엔 화학 물질이라고 했죠. 저도 그 원고를 읽었어요. 읽으면서도 이상하다고 생각했어요. 그때 더 크게 물었어야 했어요. 미안해요. 이제라도 제가 아는 건 다 말할게요."' },
          { day: 13, text: '"오늘의 생존 요령. 불은 밤에 피우지 마세요. 연기는 낮에 덜 보이고, 불빛은 밤에 더 멀리 보여요. 요리는 해 있을 때."' },
          { day: 15, text: '"보름째예요. 오늘 송신탑 아래 상자에 쪽지가 열한 장이나 들어 있었어요. 열한 명이 살아 있다는 뜻이에요. 실은 더 많겠죠. 쪽지를 못 쓴 사람도 있을 테니까."' },
          { day: 16, text: '"89.1 비상 방송이 오늘 끊겼대요. 석 달 동안 같은 말만 하던 그 목소리… 이상하게 서운하네요. 이제 이 도시에서 떠드는 건 저 하나인가 봐요."' },
          { day: 17, text: '"청취자 질문이에요. \'지수 씨는 무섭지 않아요?\' 무서워요. 마이크 앞에 앉기 전에 매일 무서워요. 그런데 말을 시작하면 조금 덜 무서워요. 여러분이 듣고 있다고 생각하면요."' },
          { day: 19, text: '"오늘은 노래 대신 빗소리를 들려 드릴게요. 창밖에 비가 와요. 빗물 받으세요. 그리고 꼭 끓여 드세요. 제 잔소리 지겹죠? 그래도 할 거예요."' },
          { day: 20, text: '"스무 날째. 송신탑 근처에서 놈 하나가 매일 같은 자리를 서성여요. 넥타이를 매고 있어요. 출근하던 길이었나 봐요. 이름을 붙여 줬어요. 김 과장님. 오늘도 출근하셨네요."' },
          { day: 21, text: '"사연이에요. \'아이가 아빠를 찾아요. 아빠는 기지에서 일했어요. 아이한테 뭐라고 해야 할까요.\' …저도 모르겠어요. 그냥 오늘 밤엔 꼭 안아 주세요."' },
          { day: 23, text: '"오늘의 소식. 검은 개가 3번 국도에 바리케이드를 세웠대요. 통행료를 받는대요. 물 두 병. 돌아가세요. 물 두 병이 목숨보다 싸요."' },
          { day: 24, text: '"자경단이 생겼대요. 전직 경찰관이 이끈다고 해요. 매일 정오 주유소 정비실에서 사람을 모은대요. 저는 총 쏠 줄 몰라서 못 가요. 대신 여기서 응원할게요."' },
          { day: 25, text: '"배터리를 아끼려고 오늘은 짧게 할게요. 다들 살아 있죠? 대답 안 해도 알아요. …오늘도 고마워요."' },
          { day: 27, text: '"사연이에요. \'개를 한 마리 주웠어요. 짖지 않는 개예요. 이름은 조용이.\' 조용아, 반가워. 주인 잘 지켜."' },
          { day: 28, unless: 'clinic', text: '"마트 진료소 선생님이 돌아오셨다는 얘기, 들으셨죠? 그런데 약이 하나도 없대요. 항생제 남는 분 계시면… 아니, 남는 분은 없겠죠. 그래도요."' },
          { day: 29, unless: 'dj_battery_early', text: '"내일은… 아마 마지막 방송이 될 것 같아요. 배터리가 거의 다 됐어요. 오늘 밤엔 하고 싶은 말을 미리 생각해 둘게요."' },
          { day: 29, if: 'dj_battery_early', text: '"배터리 걱정이 없으니까 오늘은 노래를 세 곡이나 틀 거예요. 사치 좀 부려 볼게요."' },
          { day: 30, if: 'dj_battery_early', text: '"한 달이에요. 이 방송이 한 달을 버텼어요. 사실 오늘을 마지막으로 하려고 했어요. 그런데 상자에 배터리가 있었잖아요. 그러니까… 계속할게요. 끝까지요."' },
          { day: 33, if: 'dj_battery_early', text: '"오늘의 생존 요령. 햇빛 좋은 날엔 젖은 옷부터 말리세요. 젖은 채로 밤을 나면 열이 나요. 열이 나면… 다들 쳐다보잖아요. 그게 더 아파요."' },
          { day: 36, if: 'dj_battery_early', text: '"사연이에요. \'오늘 처음으로 놈을 쓰러뜨렸어요. 기쁘지 않아요. 그 사람 손목에 시계가 있었어요.\' …기쁘지 않아도 돼요. 살아남은 걸로 충분해요."' },
          { day: 39, if: 'dj_battery_early', text: '"송신탑 근처의 김 과장님, 오늘은 안 보이세요. 이상하게 걱정되네요. 별걸 다 걱정해요, 저."' },
          { day: 42, if: 'dj_battery_early', text: '"6주째예요. 여러분 덕분에 이 마이크가 아직 켜져 있어요. 시 한 줄 읽을게요. \'아무도 오지 않는 밤에도 등불은 켜 둔다.\' 누가 쓴 건지는 기억이 안 나요."' },
          { day: 45, if: 'dj_battery', text: '"45일. 오늘 상자에 쪽지가 서른 장이었어요. 서른 명. 처음엔 열한 명이었는데. 우리가 늘고 있어요."' },
          { day: 46, unless: 'dj_battery_early', text: '"돌아오고 나서 제일 많이 받은 질문. \'그동안 어디 있었어요?\' 송신탑 밑에 있었어요. 마이크만 꺼져 있었어요. 여러분 목소리는 쪽지로 다 듣고 있었어요."' },
          { day: 46, if: 'dj_battery_early', text: '"사연이에요. \'지수 씨 방송이 끊길까 봐 매일 무서웠어요.\' 저도요. 그런데 안 끊겼어요. 누군가 덕분에."' },
          { day: 48, text: '"오늘의 생존 요령. 통조림이 부풀어 있으면 먹지 마세요. 아무리 배고파도요. 식중독은 놈들보다 조용히 사람을 죽여요."' },
          { day: 50, text: '"오십 일. 오늘은 기념으로 제가 노래를 불러 볼게요. …아니에요, 안 부를게요. 배터리 아까워요." 웃음소리가 잡음에 섞인다.' },
          { day: 52, if: 'black_dogs_gone', text: '"3번 국도가 조용해요. 검은 개가 흩어진 뒤로 약탈 소식이 확 줄었어요. 자경단 여러분, 고마워요. 그리고 함께 싸운 이름 모를 분도요."' },
          { day: 54, text: '"사연이에요. \'감자에서 싹이 났어요.\' 아마추어 무선에서도 똑같은 얘기를 들었어요. 이 도시에 감자 농부가 둘이에요. 두 분, 씨감자 나눠 주세요."' },
          { day: 57, text: '"오늘은 이름을 불러 볼게요. 쪽지에 적힌 이름들이에요. 영수 씨, 미숙 씨, 도윤이, 3층 할머니네, 조용이 주인, 그리고 이름 없이 \'철문 집\'이라고만 쓴 분. 다들 살아 있어요. 오늘 이 시간에."' },
          { day: 63, text: '"병원 지하에 아직 발전기가 돈다는 소문이 있어요. 가 보신 분? …가지 마세요. 거긴 놈들이 너무 많대요. 소문은 소문으로 두세요."' },
          { day: 66, text: '"오늘 송신탑 아래 상자에 아이 그림이 들어 있었어요. 옥상에 사람이 열네 명 그려져 있어요. 열세 명에 선생님 하나. 하늘에 해가 두 개예요. 하나는 제 거래요. 라디오 해."' },
          { day: 70, text: '"칠십 일. 처음 기억나세요? 처음엔 일주일만 버티면 구조가 올 줄 알았어요. 이제는 아무도 그 말을 안 해요. 대신 내일 뭐 먹을지를 얘기하죠. 그게 더 좋은 것 같아요."' },
          { day: 80, text: '"남쪽에서 무전이 하나 잡혔대요. 남부 임시 사령부래요. 생존자를 세고 있대요. 데리러 온다는 말은 없었대요. 그래도… 누군가 세고 있다는 거잖아요."' },
          { day: 85, text: '"오늘은 무서운 얘기 대신 웃긴 얘기. 김 과장님이 돌아왔어요. 넥타이는 잃어버리셨어요. 출근 복장 불량이에요."' },
          { day: 90, if: 'jungwoo_left', text: '"기지 3층 불빛이 꺼진 지 꽤 됐죠. 누군가 가족을 찾아 떠났대요. 저는 그게 이 도시에서 들은 소식 중에 제일 좋은 소식이라고 생각해요."' },
          { day: 95, text: '"첫눈이 올 것 같아요. 하늘이 무거워요. 장작 모으세요. 그리고 창문 틈 막으세요. 제 잔소리, 겨울에도 계속돼요."' },
          { day: 100, text: '"백 일. 이 방송이 백 일을 왔어요. 아니, 우리가 백 일을 왔어요. 오늘은 노래 없이, 사연 없이, 그냥 잠깐 조용히 있을게요. 같이요." 한참 동안 숨소리만 들린다.' },
          { day: 110, text: '"눈이 왔어요. 놈들이 눈 속에서 느려졌대요. 추위가 우리 편일 때도 있네요. 그래도 동상 조심하세요. 발가락은 열 개뿐이에요."' },
          { day: 120, text: '"넉 달. 처음 마이크를 켰을 때 저는 이 도시의 마지막 라디오라고 했어요. 이제 생각이 바뀌었어요. 마지막이 아니라 처음일지도 몰라요. 다음에 올 것들의. 여기는 97.5, 한지수였습니다. 내일 또 만나요."' },
          { react: 'kids_water', text: '"오늘 송신탑 상자에 아이 글씨 쪽지가 있었어요. \'물 마셨어요! 맛있었어요!\' 물이 맛있대요. 오늘 들은 말 중에 제일 좋네요."' },
          { react: 'kids_fed', text: '"학교 옥상 소식이에요. 누가 물이랑 먹을 걸 날라 줬대요. 정은희 선생님이 쪽지를 보냈어요. \'우리는 잘 있어요. 철문 집 사람에게 고맙다고 전해 주세요.\' 철문 집 사람, 듣고 있죠?"' },
          { react: 'dohyun_sister', text: '"오늘은 좋은 소식부터 할게요. 송신탑 아래로 청년 하나가 찾아왔어요. 김도현 씨. 네, 사연 속 그 동생이요. 누나랑 무전으로 통화했어요. 둘 다 엉엉 울었어요. 저도요."' },
          { react: 'dohyun_left', text: '"도현 씨 누나, 아직 듣고 계세요? 주택가에서 도현 씨를 봤다는 사람이 있어요. 다리를 다쳤지만 걸어서 북쪽으로 갔대요. 살아 있어요."' },
          { react: 'black_dogs_gone', text: '"오늘의 소식. 이번엔 소문이 아니에요. 자경단이 3번 국도 휴게소를 쳤어요. 검은 개는 흩어졌어요. 박 경위님이 직접 무전을 주셨어요. \'이제 3번 국도로 다녀도 된다.\' 다들… 오늘은 조금 크게 숨 쉬어도 돼요."' },
          { react: 'clinic', text: '"마트 2층 진료소가 다시 문을 열었어요! 누가 약을 가져다줬대요. 이서윤 선생님 말로는, 그분 진료비는 평생 무료래요. 다들 아프면 가세요. 아프기 전에도 가세요. 얼굴 보러."' },
          { react: 'dj_letter', text: '"사연 하나 읽을게요. \'거점에서 듣고 있어요. 오늘도 살아 있어요.\' 이름 대신 철문 집이라고 쓰셨네요. 철문 집의 당신, 저도 오늘 살아 있어요. 내일도 그러기로 해요."' },
          { react: 'jungwoo_left', text: '"항구 쪽에서 무전이 왔어요. 연구원이라는 남자가 가족을 찾았대요. 노란 우비 입은 아이가 아빠한테 매달려서 안 떨어졌대요. …오늘은 노래 없이 그냥 이 얘기만 할게요."' },
          { react: 'dj_battery', unless: 'dj_battery_late', text: '"사연함에 배터리가 들어 있었어요. 자동차 배터리 세 개랑 전선. 그리고 쪽지. \'계속 떠들어 주세요.\' …네. 그럴게요. 고마워요, 누군지 몰라도."' },
          { react: 'dj_battery_late', text: '"…아, 아. 들리세요? 저 한지수예요. 누가 송신탑 아래 상자에 배터리를 두고 갔어요. 쪽지도 있었어요. \'계속 떠들어 주세요.\' …네. 다시 시작할게요. 여기는 97.5, 도시의 마지막 라디오입니다."' },
        ] },
        { id: 'military', name: '군 주파수 · 숫자 방송', at: [
          { day: 1, text: '기계 같은 여자 목소리가 숫자를 읽는다. "삼, 칠, 영, 영, 구. 삼, 칠, 영, 영, 구." 무슨 뜻인지 알 수 없다.' },
          { day: 7, text: '숫자가 바뀌었다. "일, 사, 사, 일. 일, 사, 사, 일." 끝에 짧게 덧붙는다. "…회수 대기."' },
          { day: 15, text: '처음으로 숫자가 아닌 말이 들린다. 지친 남자 목소리다. "북부 기지 잔류 인원에게 알린다. 회수 작전은 취소되었다. 반복한다, 취소되었다. …미안하다."' },
          { day: 18, silent: true, text: '그 뒤로 군 주파수는 조용하다.' },
          { day: 3, text: '숫자가 하나 늘었다. "삼, 칠, 영, 영, 구, 일. 삼, 칠, 영, 영, 구, 일." 같은 목소리, 같은 속도.' },
          { day: 10, text: '숫자 사이로 다른 목소리가 끼어든다. "…북부 기지 회수 대기 인원 확인 바람. 응답 없음. 다시. 응답 없음."' },
          { day: 12, text: '"…연구동 3층 생존 신호 확인. 회수 우선순위, 낮음." 그리고 다시 숫자.' },
          { day: 58, text: '"삼, 칠, 영, 영, 구." 이번엔 숫자 끝에 사람 목소리가 붙는다. 아주 작게. "…아직 거기 있나?"' },
          { day: 80, text: '처음 듣는 목소리다. "여기는 남부 임시 사령부. 북부 생존자를 집계 중이다. 응답할 방법은 없다. 그래도 세고 있다. 반복한다. 세고 있다."' },
          { day: 100, text: '숫자 대신 짧은 음악이 흘러나온다. 군가다. 끝까지 나오고, 꺼진다. 아무 설명도 없다.' },
          { day: 65, silent: true, text: '군 주파수는 다시 조용해졌다.' },
          { day: 81, silent: true, text: '남부 임시 사령부의 방송은 한 번뿐이었다. 군 주파수는 다시 조용하다.' },
          { day: 101, silent: true, text: '군가가 끝난 뒤로 군 주파수에서는 아무것도 들리지 않는다.' },
          { react: 'jungwoo_met', text: '숫자가 멈췄다. 그리고 처음으로 질문이 들린다. "…연구동 3층. 아직 거기 있나. 응답하라." 아무도 응답하지 않는다. 김정우는 응답하지 않기로 한 것 같다.' },
          { day: 50, text: '오랜만에 숫자가 들린다. "삼, 칠, 영, 영, 구." 처음 들었던 그 숫자다. 누가, 왜, 아직 이걸 보내고 있을까.' },
        ] },
        { id: 'kids', name: '104.3 MHz · 어린이 방송', at: [
          { day: 1, text: '밝은 음악. "안녕, 친구들! 오늘은 손 씻는 방법을 배워 볼까요? 비누로 거품을 내고, 하나, 둘, 셋…" 석 달 전 녹화된 어린이 방송이다. 어딘가의 방송 장비가 아직 혼자 돌아가고 있다.' },
          { day: 4, text: '"오늘의 노래는 \'우리 동네 사람들\'! 우체부 아저씨, 경찰관 아저씨, 빵집 아주머니…" 노래 속 동네 사람들은 아무도 남아 있지 않다.' },
          { day: 8, text: '"친구들, 낯선 사람이 따라오라고 하면 어떻게 해야 할까요? 맞아요! 크게 소리치고 어른에게 알려요!" 지금은 크게 소리치면 안 된다.' },
          { day: 12, text: '"오늘은 꿈 이야기를 해요. 친구들은 커서 뭐가 되고 싶나요?" 녹음된 아이들이 차례로 대답한다. 소방관, 의사, 유튜버, 우주비행사.' },
          { day: 16, text: '"내일은 소풍 가는 날! 도시락 꼭 챙기세요!" 같은 회차가 반복된다. 내일은 오지 않는다.' },
          { day: 20, text: '테이프가 늘어났다. "안녀어엉, 치이인구들…" 진행자의 목소리가 끈적하게 늘어진다.' },
          { day: 27, text: '"…손을… 씻…" 소리가 자꾸 끊긴다. 화면이 있었다면 지금쯤 색이 다 바랬을 것이다.' },
          { day: 34, silent: true, text: '104.3 MHz에는 이제 잡음만 흐른다. 어린이 방송을 돌리던 장비가 마침내 멈췄다.' },
          { day: 58, text: '잡음 사이로 갑자기 어린이 방송이 다시 나온다. "안녕, 친구들!" 누군가 그 장비에 전기를 다시 넣었다.' },
          { day: 59, text: '어린이 방송 사이로 다른 목소리가 끼어든다. 진짜 아이 목소리다. "…이거 하면 다른 애들도 들어? 안녕! 우리는 학교 옥상에 있어! 선생님이 이거 고쳤어!"' },
          { day: 70, if: 'kids_fed', text: '"오늘의 노래는 \'우리 동네 사람들\'!" 이번엔 녹음이 아니다. 아이들이 직접 부른다. 가사가 바뀌었다. "자경단 아저씨, 라디오 언니, 철문 집 사람…"' },
          { day: 70, unless: 'kids_fed', text: '"오늘의 노래는 \'우리 동네 사람들\'!" 아이들이 직접 부른다. 목소리가 갈라진다. 물을 오래 못 마신 목소리다.' },
          { day: 90, text: '아이들이 숫자를 센다. "…아흔여덟, 아흔아홉, 백! 찾는다!" 숨바꼭질이다. 웃음소리가 길게 이어진다.' },
          { day: 110, text: '"친구들, 눈이 왔어요! 눈사람을 만들 때는…" 아이들 목소리가 이어받는다. "…장갑을 꼭 끼세요! 그리고 놈들이 안 보이는 데서 만드세요!" 선생님 목소리가 웃는다.' },
        ] },
        { id: 'ham', name: '아마추어 무선 · 생존자들', pool: [
          '"…여기 강변 아파트 12층… 셋이 있다… 물 없음… 아무나 응답 바람… 오버."',
          '"검은 개 무전 듣고 있는 놈들 다 안다. 3번 국도로 오지 마라. 거긴 우리 땅이다." 거친 웃음소리와 함께 끊긴다.',
          '아이 목소리. "엄마, 이거 누르면 돼? …여보세요? 여보세요?" 그리고 잡음.',
          '"…감자 심었다. 싹이 났다. 누가 듣든 말든, 싹이 났다고."',
          '"오늘 몇 명 남았는지 세어 봤다. 넷. 어제는 다섯이었다."',
          '노인 목소리. "주파수 맞춘 김에 하나 알려 주지. 빗물은 숯이랑 모래로 한 번 거르고 끓여. 그게 제일 낫다."',
          '"…교회 종탑 위에 있습니다. 아래에 놈들이 백 마리쯤. 사흘째 못 내려가고 있어요…"',
          '"헬기 봤어? 봤지? 우리 데리러 온 거야. 내일은 꼭 내려올 거야."',
          '누군가 하모니카를 분다. 서툴다. 그래도 끝까지 분다.',
          '"이 주파수 쓰는 사람들, 일요일 정오마다 이름 한 번씩 부르자. 살아 있다고. 나부터. 영수."',
          '"남쪽 항구 배 얘기 하는 것들 다 거짓말이다. 거기서 오는 길이다."',
          '"물려도 바로 안 변한다. 하루는 간다. 그 하루 동안 할 말은 다 해 둬라. 나는 그랬다."',
          '여자 목소리가 숫자를 센다. "…아흔여덟, 아흔아홉, 백!" 숨바꼭질이다. 아이들 웃음소리가 들린다.',
          '"편의점 알바 도현이 들으면 연락해라. 누나다. 살아만 있어라."',
          '"오늘도 아무 일 없음. 이상 무. 그게 제일 좋은 소식이다."',
          '"여기 동부 아파트 단지. 옥상에 텃밭을 만들었다. 상추 씨앗 남는 사람 있나. 오버."',
          '"…형, 나야. 대답 안 해도 돼. 그냥 매일 이 시간에 말할게. 나 아직 살아 있어."',
          '라디오 너머로 누군가 기타를 친다. 줄이 하나 끊어진 기타다. 다섯 줄로도 노래는 된다.',
          '"오늘 개 떼한테 쫓겼다. 나무 위에서 세 시간. 개들도 지쳐서 갔다. 다들 개 조심해."',
          '"…검은 개 놈들 오늘 3번 국도에서 트럭 하나 털었다. 운전하던 사람은… 아니다, 말 안 할래."',
          '"교회 종탑 사람들, 내려왔다. 다 같이 내려왔다. 그 얘기 하려고 무전 켰다."',
          '"누구 혹시 인슐린 있나. 냉장 안 돼도 괜찮다. 아버지가… 아니다. 있으면 말해 줘."',
          '아이가 동화를 읽는다. 글자를 더듬더듬. "…그래서 아기 돼지 셋째는 벽돌로 집을 지었어요." 벽돌집이 부러운 밤이다.',
          '"오늘의 날씨. 맑음. 놈들 많음. 바람 약간. 끝."',
          '"할아버지가 그러는데 전쟁 때보다 낫대. 그때는 라디오도 없었대. 그러니까 우리 아직 운 좋은 거래."',
          '"강 건너 불빛 봤어? 어젯밤 열 시쯤. 누가 불 피운 거야. 거기 사람 있다."',
          '"…발전기 고칠 줄 아는 사람. 통조림 다섯 개 준다. 아니, 여섯. 제발."',
          '"우리 셋 중에 하나가 오늘 열이 났다. 물린 데는 없다. 그런데도 다들 그 애를 쳐다본다. 나도 쳐다봤다. 미안해서 무전 켰다."',
          '여자 목소리가 자장가를 부른다. 중간에 아이가 칭얼댄다. 노래가 조금 빨라진다.',
          '"이 주파수 일요일 명단. 영수, 살아 있음. 미숙, 살아 있음. 도윤이네, 살아 있음. 박 씨 아저씨… 대답 없음."',
          '"오늘 처음으로 웃었다. 이유는 묻지 마. 그냥 웃겼다. 그래서 무전으로 자랑한다."',
          '"편의점 털러 갔다가 복권을 주웠다. 맞춰 볼 데가 없다. 1등일지도 모른다. 그걸로 됐다."',
          '"…마트 지하 냉동창고 쪽은 가지 마라. 문 닫아 놨는데 안에서 두드린다."',
          '"병원 옥상 SOS 아직 있다. 근데 거기 아무도 없다. 내가 가 봤다. 그냥 시트만 펄럭인다."',
          '"군인 출신 있으면 연락 바람. 총 다룰 줄 아는 사람 필요하다. 자경단이다. 정오, 주유소."',
          '"검은 개에 붙었던 놈 하나가 오늘 우리 쪽으로 넘어왔다. 울더라. 받아 줬다. 잘한 건지 모르겠다."',
          '"고양이 한 마리가 매일 우리 창문 앞에 온다. 먹을 거 줄 형편은 아닌데 자꾸 주게 된다."',
          '"…다리 쪽 봉쇄선 아직 있다. 사람은 없고 철조망만. 철조망에 옷가지가 걸려 있다. 넘으려던 사람들 거다."',
          '"오늘 생일이다. 몇 살인지는 비밀. 아무도 케이크 안 줘서 내가 나한테 통조림 하나 더 줬다."',
          '"라디오 언니 방송 들은 사람? 김 과장 얘기 웃겼지? 우리 동네에도 하나 있다. 이 부장."',
          '"감자 싹 사람이다. 감자 꽃 피었다. 하얗다. 이렇게 예쁜 줄 몰랐다."',
          '"…아무도 대답 안 해도 된다. 그냥 누가 듣고 있다는 것만 알면 된다. 오버."',
          '"물려서 이틀째다. 아직 나다. 내일도 나였으면 좋겠다. 가족들한테는 낚시 간다고 했다."',
          '"강변 아파트 12층이다. 아직 셋이다. 물은 구했다. 걱정해 준 사람들 고맙다. 오버."',
          '"…총소리 들었지? 우리 아니다. 우리는 총이 없다. 그러니까 저쪽 동네 조심해."',
          '"애들이 학교 가고 싶대. 학교가 제일 위험한 데가 됐는데. 그래서 집에서 칠판 놓고 수업한다. 오늘은 구구단."',
          '두 사람이 끝말잇기를 한다. "…사과." "과자." "자동차." "차… 차… 차가운 통조림." 웃음소리.',
          '"…거점에 철문 다는 법 알려 줄 사람. 경첩이 자꾸 빠진다."',
          '"남쪽 항구 다녀온 사람 또 있다. 배는 없었다. 그런데 바다는 예뻤다고 한다. 그 말이 이상하게 오래 남는다."',
          '"우리 개가 오늘 놈을 물었다. 개는 괜찮다. 개는 안 변하나 보다. 다행이다."',
          '"따, 따, 따. 따아, 따아, 따아. 따, 따, 따." 누군가 모스 부호로 SOS를 친다. 어디서 보내는지는 알 수 없다.',
          '"…오늘은 아무것도 안 했다. 그냥 누워 있었다. 그래도 된다고 누가 말해 줬으면 해서 무전 켰다."',
          '"새벽에 기지 쪽에서 헬기 소리 났다. 착륙은 안 했다. 한 바퀴 돌고 갔다. 뭘 찾는 걸까."',
          '"오늘 놈 하나를 봤는데, 손에 결혼반지를 끼고 있었다. 그냥 보내 줬다. 바보 같은 짓인 거 안다."',
          '"이 무전 듣는 사람 중에 의사 있나. 아니면 간호사. 아니면 뭐든. 아이가 팔이 부러졌다."',
          '"…여긴 북쪽 산장. 일곱 명. 사냥한다. 고기 남는다. 총알이랑 바꿀 사람."',
          '"오늘은 비. 빗소리 좋다. 놈들도 빗소리에 귀가 먹는지 조용하다. 비 오는 날이 제일 안전하다."',
          '"…누가 우리 집 문 앞에 통조림을 두고 갔다. 누군지 모르지만 고맙다. 우리도 내일 누군가한테 그렇게 할 거다."',
          '"전기 끊긴 지 석 달. 냉장고를 옷장으로 쓴다. 생각보다 괜찮다."',
          '"…오늘 형이 대답했다. 형이 대답했다고. 살아 있었어."',
        ], react: [
          { react: 'dohyun_sister', text: '"도현아, 누나다. 들었지? 살아 있어서 고맙다. 진짜 고맙다."' },
          { react: 'black_dogs_gone', text: '"검은 개 무전이 끊겼다. 사흘째 조용하다. 다들 들었지? 끝났다. 진짜 끝났다."' },
          { react: 'joined_vigilante', text: '"자경단이다. 오늘 새 사람이 하나 왔다. 붕대를 들고 왔다. 그런 사람이 제일 반갑다."' },
        ] },
      ],
    },
  },

  start: {
    stash: { canned_food: 3, water_bottle: 3, bandage: 2, chocolate: 1 },
    inv: { water_bottle: 1 },
    bag: null,
  },
};
