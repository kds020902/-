// 폐허의 거점 — 게임 수치 데이터
// 이 파일만 고치고 브라우저를 새로고침하면 바로 적용됩니다.
// 시간 단위는 모두 "게임 안 분(minute)"입니다.

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
      exertPerHour: 12,           // 이동·수색 중 시간당 소모
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

  // cat: food / drink / med / material / bag
  // w: 무게(kg), r: 등급(0~3), stack: 창고 한 칸에 들어가는 개수
  // use: 사용 효과 (hunger·thirst·fatigue는 음수일수록 좋음, hp·stamina는 양수일수록 좋음)
  items: {
    canned_food:    { name: '통조림',         cat: 'food',  w: 0.4,  r: 0, stack: 10, use: { hunger: -30 },                desc: '유통기한은 지났지만 아직 먹을 만하다.' },
    bread:          { name: '눅눅한 빵',      cat: 'food',  w: 0.2,  r: 0, stack: 10, use: { hunger: -15 },                desc: '곰팡이 핀 부분만 떼어내면 된다.' },
    instant_noodle: { name: '컵라면',         cat: 'food',  w: 0.15, r: 0, stack: 10, use: { hunger: -20, thirst: 5 },     desc: '물 없이 부숴 먹는다. 짜다.' },
    chocolate:      { name: '초콜릿 바',      cat: 'food',  w: 0.1,  r: 1, stack: 20, use: { hunger: -10, stamina: 15 },   desc: '작지만 힘이 난다.' },
    ration:         { name: '전투식량',       cat: 'food',  w: 0.6,  r: 2, stack: 5,  use: { hunger: -60, stamina: 20 },   desc: '군용 비상식량. 든든하다.' },
    water_bottle:   { name: '생수',           cat: 'drink', w: 0.5,  r: 0, stack: 10, use: { thirst: -35 },                desc: '뚜껑이 밀봉된 500ml 생수.' },
    soda:           { name: '탄산음료',       cat: 'drink', w: 0.35, r: 0, stack: 10, use: { thirst: -20, stamina: 5 },    desc: '김은 다 빠졌다.' },
    energy_drink:   { name: '에너지 드링크',  cat: 'drink', w: 0.3,  r: 1, stack: 10, use: { thirst: -15, stamina: 40, fatigue: -10 }, desc: '심장이 빨리 뛴다.' },
    bandage:        { name: '붕대',           cat: 'med',   w: 0.05, r: 0, stack: 20, use: { hp: 8 },                      desc: '작은 상처를 감싼다.' },
    painkiller:     { name: '진통제',         cat: 'med',   w: 0.05, r: 1, stack: 20, use: { hp: 5, stamina: 10 },         desc: '통증이 조금 가신다.' },
    first_aid:      { name: '구급상자',       cat: 'med',   w: 0.4,  r: 1, stack: 5,  use: { hp: 35 }, useMinutes: 15,     desc: '제대로 된 응급처치 도구.' },

    cloth:            { name: '천 조각',      cat: 'material', w: 0.1,  r: 0, stack: 50, desc: '하이드아웃 시설 재료.' },
    wood:             { name: '목재',         cat: 'material', w: 1.5,  r: 0, stack: 20, desc: '하이드아웃 시설 재료.' },
    nails:            { name: '못 한 줌',     cat: 'material', w: 0.3,  r: 0, stack: 30, desc: '하이드아웃 시설 재료.' },
    scrap_metal:      { name: '고철',         cat: 'material', w: 2.0,  r: 0, stack: 20, desc: '하이드아웃 시설 재료. 무겁다.' },
    pipe:             { name: '쇠파이프',     cat: 'material', w: 1.2,  r: 0, stack: 20, desc: '하이드아웃 시설 재료.' },
    duct_tape:        { name: '덕트 테이프',  cat: 'material', w: 0.15, r: 0, stack: 20, desc: '하이드아웃 시설 재료.' },
    plastic:          { name: '플라스틱 용기', cat: 'material', w: 0.2, r: 0, stack: 30, desc: '하이드아웃 시설 재료.' },
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
      id: 'houses', name: '버려진 주택가', danger: 0, dist: 30, angle: 205, spots: 10, finds: [1, 2], emptyChance: 0.15,
      desc: '창문이 깨진 단독주택들이 늘어선 골목. 대부분 이미 털렸지만 구석구석 남은 게 있을지도 모른다.',
      loot: [['canned_food', 5], ['bread', 6], ['cloth', 9, 1, 3], ['plastic', 5, 1, 2], ['water_bottle', 3], ['duct_tape', 3], ['nails', 3], ['bandage', 3, 1, 2], ['soda', 3], ['chocolate', 2], ['wood', 4], ['bag_school', 1.5]],
      flavor: ['부엌 찬장을 하나씩 열어 보았다.', '아이 방 장난감 상자 밑을 뒤졌다.', '현관 신발장 위를 훑었다.', '반쯤 무너진 창고 문을 비집고 들어갔다.'],
    },
    {
      id: 'store', name: '동네 편의점', danger: 0, dist: 40, angle: 330, spots: 6, finds: [1, 3], emptyChance: 0.12,
      desc: '셔터가 반쯤 내려간 24시 편의점. 진열대가 모두 쓰러져 있다.',
      loot: [['canned_food', 6], ['instant_noodle', 7, 1, 2], ['water_bottle', 7], ['soda', 6], ['chocolate', 4], ['energy_drink', 1.5], ['bandage', 2], ['plastic', 3], ['battery', 1.5]],
      flavor: ['쓰러진 진열대 밑으로 손을 넣었다.', '계산대 뒤 창고를 뒤졌다.', '냉장고 문을 하나씩 열어 보았다. 냄새가 지독하다.'],
    },
    {
      id: 'gas', name: '폐 주유소', danger: 1, dist: 60, angle: 70, spots: 6, finds: [1, 3], emptyChance: 0.12,
      desc: '녹슨 주유기 사이로 바람이 분다. 정비실 문이 열려 있다.',
      loot: [['fuel', 3], ['soda', 5], ['water_bottle', 4], ['instant_noodle', 3], ['tools', 1], ['scrap_metal', 4], ['pipe', 3], ['wire', 2], ['duct_tape', 3], ['battery', 2]],
      flavor: ['정비실 공구함을 열어 보았다.', '매점 카운터 뒤를 뒤졌다.', '버려진 차량의 트렁크를 열었다.'],
    },
    {
      id: 'hardware', name: '철물점', danger: 1, dist: 80, angle: 150, spots: 8, finds: [1, 3], emptyChance: 0.1,
      desc: '간판이 떨어진 철물점. 선반에 공구와 자재가 어지럽게 흩어져 있다.',
      loot: [['nails', 8, 1, 3], ['wood', 7, 1, 2], ['pipe', 6], ['scrap_metal', 5], ['wire', 4], ['duct_tape', 5, 1, 2], ['tools', 2], ['battery', 2], ['water_bottle', 2]],
      flavor: ['안쪽 자재 창고로 들어갔다.', '무너진 선반을 하나씩 들어 올렸다.', '계산대 서랍을 억지로 열었다.'],
    },
    {
      id: 'school', name: '학교', danger: 2, dist: 120, angle: 260, spots: 8, finds: [1, 3], emptyChance: 0.12,
      desc: '운동장에 차들이 버려져 있다. 교실마다 바리케이드를 쳤던 흔적이 남아 있다.',
      loot: [['bag_school', 4], ['bag_hiking', 1], ['bandage', 4, 1, 2], ['first_aid', 1.5], ['cloth', 5, 1, 3], ['bread', 3], ['water_bottle', 3], ['chocolate', 3], ['plastic', 4], ['wire', 2], ['battery', 2], ['electronic', 1]],
      flavor: ['교실 사물함을 하나씩 열었다.', '보건실 약장을 뒤졌다.', '컴퓨터실의 부서진 본체를 뜯었다.', '급식실 창고 문을 밀고 들어갔다.'],
    },
    {
      id: 'mart', name: '대형마트', danger: 2, dist: 150, angle: 15, spots: 10, finds: [1, 3], emptyChance: 0.1,
      desc: '넓은 매장 안은 어둡고 조용하다. 너무 조용하다.',
      loot: [['canned_food', 8, 1, 2], ['instant_noodle', 6, 1, 2], ['water_bottle', 7, 1, 2], ['soda', 5], ['chocolate', 4], ['energy_drink', 3], ['bag_hiking', 2], ['bag_tactical', 0.4], ['cloth', 4], ['plastic', 4], ['battery', 3], ['duct_tape', 3], ['first_aid', 1]],
      flavor: ['식품 코너의 쓰러진 매대를 뒤졌다.', '아웃도어 매장 쪽으로 들어갔다.', '직원 전용 물류 창고를 살폈다.', '카트 더미 사이를 헤집었다.'],
    },
    {
      id: 'hospital', name: '병원', danger: 3, dist: 210, angle: 105, spots: 8, finds: [1, 3], emptyChance: 0.1,
      desc: '응급실 앞에 구급차가 엎어져 있다. 소독약 냄새와 썩은 냄새가 뒤섞여 있다.',
      loot: [['bandage', 8, 1, 3], ['first_aid', 5], ['painkiller', 5, 1, 2], ['medical_supplies', 5, 1, 2], ['water_bottle', 3], ['electronic', 2], ['battery', 2], ['cloth', 3, 1, 2]],
      flavor: ['응급실 처치대 서랍을 열었다.', '약제부 선반을 뒤졌다.', '병동 간호사실을 살폈다.'],
    },
    {
      id: 'police', name: '경찰서', danger: 3, dist: 240, angle: 300, spots: 6, finds: [1, 3], emptyChance: 0.12,
      desc: '유리문 너머로 서류가 어지럽게 흩어져 있다. 무기고 문은 아직 잠겨 있을까.',
      loot: [['bag_tactical', 2], ['ration', 2], ['first_aid', 2], ['bandage', 3], ['battery', 3], ['wire', 2], ['electronic', 2], ['energy_drink', 2], ['water_bottle', 3], ['tools', 1], ['duct_tape', 2]],
      flavor: ['당직실 캐비닛을 열었다.', '압수품 보관실을 뒤졌다.', '순찰차 트렁크를 열어 보았다.'],
    },
    {
      id: 'base', name: '군사기지', danger: 4, dist: 360, angle: 215, spots: 10, finds: [2, 3], emptyChance: 0.08,
      desc: '철조망 너머 버려진 군사기지. 무엇이 기다리고 있는지 아무도 모른다.',
      loot: [['ration', 5, 1, 2], ['bag_military', 1.2], ['bag_tactical', 2], ['engine_part', 2], ['electronic', 3, 1, 2], ['fuel', 3], ['first_aid', 3], ['battery', 3, 1, 2], ['wire', 3], ['tools', 2], ['energy_drink', 3], ['water_bottle', 4]],
      flavor: ['보급 창고의 나무 상자를 뜯었다.', '막사 관물대를 하나씩 열었다.', '정비고 안쪽으로 들어갔다.', '버려진 군용 트럭 짐칸을 뒤졌다.'],
    },
  ],

  emptyLines: ['쓸 만한 건 아무것도 없었다.', '누군가 이미 싹 털어 갔다.', '먼지만 잔뜩 뒤집어썼다.'],

  start: {
    stash: { canned_food: 3, water_bottle: 3, bandage: 2, chocolate: 1 },
    inv: { water_bottle: 1 },
    bag: null,
  },
};
