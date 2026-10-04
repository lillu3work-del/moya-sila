/*
  Генератор тренировки v3.1 — "модульный пазл" по Katya_Sport_Database_v3_MODULAR_FUN.xlsx
  + VIBE-система для реального разнообразия между заходами.

  A/B/C — не фиксированные тренировки, а мышечные задачи. Каждый визит собирается заново
  из блоков: Разминка → Основные (anchors) → Ротация/Любимое → Фан/челлендж →
  Кор (один из 5 режимов) → Растяжка. Вайб (Сила/Новое/Фан/Комфорт/Памп) меняет то,
  как именно собираются блоки — это и даёт ощущение разной тренировки, а не просто
  "то же самое, но другая кнопка". Что использовалось в прошлый раз для этой же буквы —
  избегаем, чтобы тренировки не повторялись один в один.
*/

const MODE_RANK = { EXPRESS: 1, NORMAL: 2, FULL: 3 };
const MODE_LABEL = { EXPRESS: "Экспресс 35–45 мин", NORMAL: "Стандарт 55–70 мин", FULL: "Полная 75–90 мин" };

const VIBES = ["strong", "explore", "fun", "comfort", "pump", "mobility"];
const VIBE_LABEL = { strong: "Сила", explore: "Новое", fun: "Фан", comfort: "Комфорт", pump: "Памп", mobility: "Мобильный акцент" };
const VIBE_HINT = {
  strong: "Меньше вариаций, больше основного веса",
  explore: "Специально подмешиваю то, что ты давно не делала",
  fun: "Больше вариаций, но без отдельного «челленджа»",
  comfort: "Только простые тренажёры, минимум возни",
  pump: "Больше подходов в работе, лёгкий памп",
  mobility: "Добавляю больше подвижности и меньше тяжёлой ротации",
};
const VIBE_CONFIG = {
  strong: { rotationDelta: -1, suppressFun: true, coreModePreference: ["strength", "sprint"], setupMult: 1, exploreCount: 0 },
  explore: { rotationDelta: 0, coreModePreference: null, setupMult: 1, exploreCount: 1 },
  // «Фан» — это просто более живая ротация обычных движений. Не подмешиваем
  // переноски или случайный кор как отдельный челлендж.
  fun: { rotationDelta: 1, suppressFun: true, coreModePreference: ["weighted", "rotation", "strength"], setupMult: 1, exploreCount: 0 },
  comfort: { rotationDelta: 0, coreModePreference: ["strength"], setupMult: 4, exploreCount: 0 },
  pump: { rotationDelta: 1, coreModePreference: ["sprint"], setupMult: 1, exploreCount: 0 },
  mobility: { rotationDelta: -1, coreModePreference: ["rotation", "weighted"], setupMult: 1, exploreCount: 0 },
};

const FAMILY_TAGS = {
  A: ["glute-max", "glute-medius", "hamstrings", "adductors"],
  B: ["back", "chest", "shoulders", "triceps", "biceps"],
  C: ["quads", "glute-max", "glute-medius", "adductors", "calves"],
};

const SESSION_DEFS = {
  A: {
    label: "Ягодицы и задняя цепь",
    warmupKey: "A",
    anchorSlots: [
      { key: "hip-extension", tag: "glute-max", role: ["anchor"], title: "Разгибание бедра" },
      { key: "hinge-or-curl", tag: ["hamstrings"], role: ["anchor", "learn"], title: "Тазовый шарнир / сгибание бедра" },
      { key: "posterior-extra", tag: ["glute-medius", "adductors"], role: ["anchor", "rotation"], title: "Отведение / приведение бедра" },
    ],
  },
  B: {
    label: "Осанка, спина и грудь",
    warmupKey: "B",
    anchorSlots: [
      { key: "horizontal-pull", tag: "back", pose: "pull-horizontal", role: ["anchor"], title: "Горизонтальная тяга" },
      { key: "chest-press", tag: "chest", role: ["anchor"], title: "Жим от груди" },
      { key: "scapular", tag: "back", role: ["anchor", "rotation"], title: "Задние дельты / осанка" },
    ],
  },
  C: {
    label: "Ноги и ягодицы",
    warmupKey: "C",
    anchorSlots: [
      { key: "knee-dominant", tag: "quads", role: ["anchor", "learn"], title: "Многосуставное на ноги" },
      { key: "glute-role", tag: "glute-max", role: ["anchor", "rotation"], title: "Ягодицы" },
      { key: "accessory", tag: ["glute-medius", "adductors", "calves"], role: ["anchor", "rotation"], title: "Приводящие / средняя ягодичная" },
    ],
  },
};

const FAMILY_DEFS = {
  LOWER: {
    label: "Нижняя часть",
    focuses: [
      { label: "Ягодицы и задняя цепь", legacyLetter: "A" },
      { label: "Квадрицепс, икры и односторонние движения", legacyLetter: "C" },
      { label: "Нижняя часть с мобильностью", legacyLetter: "C", vibe: "mobility" },
    ],
  },
  UPPER: {
    label: "Верхняя часть",
    focuses: [
      { label: "Руки и плечи", legacyLetter: "B" },
      { label: "Спина и осанка", legacyLetter: "B" },
      { label: "Сбалансированный верх", legacyLetter: "B" },
    ],
  },
  MOBILITY: { label: "Мобильность и восстановление", focuses: [{ label: "Грудной отдел, плечи, тазобедренные и кор" }] },
  FULL_BODY: { label: "Всё тело", focuses: [{ label: "Спокойная общая тренировка" }] },
};
const FAMILY_ORDER = ["LOWER", "UPPER", "MOBILITY", "FULL_BODY"];

function loadRotationState() {
  try {
    const saved = JSON.parse(localStorage.getItem("moya-sila-rotation-v1"));
    if (saved && saved.next) return saved;
  } catch (e) {}
  return { next: "A", history: [] };
}
function saveRotationState(state) {
  localStorage.setItem("moya-sila-rotation-v1", JSON.stringify(state));
}

function loadVibeState() {
  try {
    const saved = JSON.parse(localStorage.getItem("moya-sila-vibe-v1"));
    if (saved && VIBES.includes(saved.current)) return saved;
  } catch (e) {}
  return { current: "strong" };
}
function saveVibeState(v) {
  localStorage.setItem("moya-sila-vibe-v1", JSON.stringify(v));
}
function nextVibeAfter(vibe) {
  const idx = VIBES.indexOf(vibe);
  return VIBES[(idx + 1) % VIBES.length];
}

function loadLastByLetter() {
  try {
    const saved = JSON.parse(localStorage.getItem("moya-sila-last-by-letter-v1"));
    if (saved && typeof saved === "object") return saved;
  } catch (e) {}
  return {};
}
function saveLastByLetter(map) {
  localStorage.setItem("moya-sila-last-by-letter-v1", JSON.stringify(map));
}

function matchesTag(exercise, tagSpec) {
  const tags = Array.isArray(tagSpec) ? tagSpec : [tagSpec];
  return tags.includes(exercise.tag);
}

// Общий фильтр "годится для силового/фан/кор слота": не исключено по умолчанию,
// не разминка/кардио/восстановление/активность-на-выбор (это отдельные пулы) и не помечено как recovery.
function eligiblePool() {
  return EXERCISE_LIBRARY_LIST.filter(
    (ex) => !ex.excludedDefault && !ex.recovery && ex.role !== "warm-up" && ex.role !== "cardio" && ex.role !== "recovery" && ex.role !== "optional-activity"
  );
}

function pickBest(pool, avoidIds, setupMult) {
  const mult = setupMult || 1;
  const scored = pool.map((ex) => ({
    ex,
    score: (avoidIds && avoidIds.has(ex.id) ? -10 : 0) + ex.prefWeight * 2 + ex.setupWeight * mult,
  }));
  scored.sort((a, b) => b.score - a.score);
  return scored.length ? scored[0].ex : null;
}

function pickAnchors(letter, mode, usedIds, avoidIds, cfg) {
  const def = SESSION_DEFS[letter];
  const rank = MODE_RANK[mode];
  const slotCount = rank === 1 ? 2 : 3;
  const slots = def.anchorSlots.slice(0, slotCount);
  const picked = [];
  slots.forEach((slot) => {
    let pool = eligiblePool().filter((ex) => {
      if (usedIds.has(ex.id)) return false;
      if (!matchesTag(ex, slot.tag)) return false;
      if (slot.pose && ex.pose !== slot.pose) return false;
      return slot.role.includes(ex.role);
    });
    if (!pool.length) {
      pool = eligiblePool().filter((ex) => !usedIds.has(ex.id) && matchesTag(ex, slot.tag));
    }
    if (!pool.length) return;
    const chosen = pickBest(pool, avoidIds, cfg.setupMult);
    usedIds.add(chosen.id);
    picked.push({ slotKey: slot.key, slotTitle: slot.title, id: chosen.id, originalId: chosen.id });
  });
  return picked;
}

function pickFavorite(letter, usedIds, avoidIds, cfg) {
  const pool = eligiblePool().filter((ex) => ex.favorite && FAMILY_TAGS[letter].includes(ex.tag) && !usedIds.has(ex.id));
  if (!pool.length) return [];
  const chosen = pickBest(pool, avoidIds, cfg.setupMult);
  usedIds.add(chosen.id);
  return [{ slotKey: "favorite", slotTitle: "Любимое", id: chosen.id, originalId: chosen.id }];
}

function pickRotations(letter, mode, usedIds, avoidIds, cfg) {
  const rank = MODE_RANK[mode];
  const base = rank === 1 ? 1 : rank === 2 ? 2 : 3;
  const count = Math.max(0, base + (cfg.rotationDelta || 0));
  const pool = eligiblePool().filter((ex) => FAMILY_TAGS[letter].includes(ex.tag) && !usedIds.has(ex.id) && ex.role !== "future");
  const picked = [];
  const localAvoid = new Set(avoidIds);
  for (let i = 0; i < count; i++) {
    const remaining = pool.filter((ex) => !usedIds.has(ex.id));
    if (!remaining.length) break;
    const chosen = pickBest(remaining, localAvoid, cfg.setupMult);
    usedIds.add(chosen.id);
    localAvoid.add(chosen.id);
    picked.push({ slotKey: "rotation", slotTitle: "Ротация", id: chosen.id, originalId: chosen.id });
  }
  return picked;
}

// Explore: намеренно достаём что-то с низким весом предпочтения (то, что редко используется),
// чтобы реально показать глубину библиотеки, а не только топ-фавориты.
function pickExplore(letter, usedIds, count) {
  const pool = eligiblePool().filter((ex) => FAMILY_TAGS[letter].includes(ex.tag) && !usedIds.has(ex.id));
  if (!pool.length) return [];
  const sorted = pool.slice().sort((a, b) => a.prefWeight - b.prefWeight || a.setupWeight - b.setupWeight);
  const picked = [];
  for (let i = 0; i < count && i < sorted.length; i++) {
    const ex = sorted[i];
    usedIds.add(ex.id);
    picked.push({ slotKey: "explore", slotTitle: "Новое для тебя", id: ex.id, originalId: ex.id, explore: true });
  }
  return picked;
}

const FUN_BEST_WITH = {
  A: ["EX153", "EX152", "EX155", "EX161", "EX008"],
  B: ["EX152", "EX158", "EX159", "EX161"],
  C: ["EX153", "EX155", "EX160", "EX154"],
};

function pickFun(letter, mode, usedIds, avoidIds, cfg) {
  const rank = MODE_RANK[mode];
  if (cfg.suppressFun) return [];
  if (!cfg.forceFun) {
    if (rank === 1) return [];
    if (rank === 2 && Math.random() < 0.4) return [];
  }
  const pool = EXERCISE_LIBRARY_LIST.filter((ex) => ex.funRole && !ex.excludedDefault && !usedIds.has(ex.id));
  if (!pool.length) return [];
  const preferred = FUN_BEST_WITH[letter] || [];
  const setupMult = cfg.setupMult || 1;
  const scored = pool.map((ex) => ({
    ex,
    score: (avoidIds && avoidIds.has(ex.id) ? -10 : 0) + (preferred.includes(ex.id) ? 3 : 0) + ex.prefWeight + ex.setupWeight * (setupMult - 1),
  }));
  scored.sort((a, b) => b.score - a.score);
  const chosen = scored[0].ex;
  usedIds.add(chosen.id);
  return [{ slotKey: "fun", slotTitle: "Фан / челлендж", id: chosen.id, originalId: chosen.id }];
}

const CORE_MODES = ["strength", "sprint", "carry", "rotation", "weighted"];

function classifyCoreMode(ex) {
  const n = ex.nameEn.toLowerCase();
  if (ex.coreSprintRole) return "sprint";
  if (n.includes("carry") || n.includes("march")) return "carry";
  if (n.includes("rotation") || n.includes("twist") || n.includes("chop") || n.includes("pallof")) return "rotation";
  if (n.includes("medicine ball") || n.includes("kettlebell") || n.includes("dumbbell")) return "weighted";
  return "strength";
}

function pickCore(letter, mode, usedIds, avoidIds, lastCoreMode, cfg) {
  const rank = MODE_RANK[mode];
  if (rank === 1 && Math.random() < 0.5) return { items: [], mode: null };
  const corePool = EXERCISE_LIBRARY_LIST.filter((ex) => ex.tag === "core" && !ex.excludedDefault && ex.role !== "warm-up" && ex.sessionTags.includes(letter) && !usedIds.has(ex.id));
  const byMode = {};
  corePool.forEach((ex) => {
    const m = classifyCoreMode(ex);
    (byMode[m] = byMode[m] || []).push(ex);
  });
  let available = CORE_MODES.filter((m) => byMode[m] && byMode[m].length);
  if (!available.length) return { items: [], mode: null };
  if (cfg.coreModePreference) {
    const preferredAvailable = cfg.coreModePreference.filter((m) => available.includes(m));
    if (preferredAvailable.length) available = preferredAvailable;
  }
  let modeChoice = available.find((m) => m !== lastCoreMode) || available[0];

  if (modeChoice === "sprint") {
    const items = byMode.sprint.slice(0, 2).map((ex) => {
      usedIds.add(ex.id);
      return { slotKey: "core", slotTitle: "Кор · спринт", id: ex.id, originalId: ex.id };
    });
    return { items, mode: modeChoice };
  }
  const chosen = pickBest(byMode[modeChoice], avoidIds, cfg.setupMult);
  usedIds.add(chosen.id);
  const modeLabel = { strength: "Кор · сила", carry: "Кор · переноска", rotation: "Кор · ротация", weighted: "Кор · с весом" }[modeChoice] || "Кор";
  return { items: [{ slotKey: "core", slotTitle: modeLabel, id: chosen.id, originalId: chosen.id }], mode: modeChoice };
}

function pickWarmup(letter, count, usedIds) {
  const pool = EXERCISE_LIBRARY_LIST.filter((ex) => !ex.excludedDefault && ex.sessionTags.includes("WARMUP") && (ex.sessionTags.includes(letter) || ex.tag === "cardio"));
  const cardio = pool.filter((ex) => (ex.tag === "cardio" || ex.tag === "warmup") && ex.pose === "walk");
  const drills = pool.filter((ex) => ex.pose !== "walk");
  const picked = [];
  if (cardio.length) picked.push(pickBest(cardio));
  const sortedDrills = drills.filter((e) => !picked.find((p) => p.id === e.id)).sort((a, b) => b.prefWeight - a.prefWeight);
  for (const ex of sortedDrills) {
    if (picked.length >= count) break;
    picked.push(ex);
  }
  picked.forEach((ex) => usedIds.add(ex.id));
  return picked.map((ex) => ({ slotKey: "warmup", slotTitle: "Разминка", id: ex.id, originalId: ex.id }));
}

const COOLDOWN_PREFERRED = {
  A: ["EX128", "EX123", "EX137"],
  B: ["EX129", "EX119", "EX120", "EX137"],
  C: ["EX128", "EX124", "EX137"],
};
const OPTIONAL_CARDIO_PREFERRED = { A: "EX130", B: "EX133", C: "EX131" };

function pickCooldown(letter, rank, usedIds) {
  const count = rank === 1 ? 1 : rank === 2 ? 2 : 3;
  const picked = [];
  const preferred = COOLDOWN_PREFERRED[letter] || ["EX137"];
  preferred.forEach((id) => {
    if (picked.length < count && !usedIds.has(id) && EXERCISES[id] && !EXERCISES[id].excludedDefault && !picked.find((e) => e.id === id)) picked.push(EXERCISES[id]);
  });
  if (picked.length < count) {
    const pool = EXERCISE_LIBRARY_LIST.filter((ex) => ex.recovery && !ex.excludedDefault && !usedIds.has(ex.id) && !picked.find((e) => e.id === ex.id));
    pool.sort((a, b) => b.prefWeight - a.prefWeight).forEach((ex) => {
      if (picked.length < count) picked.push(ex);
    });
  }
  const items = picked.map((ex) => {
    usedIds.add(ex.id);
    return { slotKey: "cooldown", slotTitle: "Растяжка / роллер", id: ex.id, originalId: ex.id, optional: false };
  });
  if (rank === 3) {
    const cardioId = OPTIONAL_CARDIO_PREFERRED[letter];
    if (cardioId && EXERCISES[cardioId] && !usedIds.has(cardioId)) {
      items.push({ slotKey: "cooldown", slotTitle: "Кардио (по желанию)", id: cardioId, originalId: cardioId, optional: true });
      usedIds.add(cardioId);
    }
  }
  return items;
}

function generateLegacySession(letter, mode, vibe) {
  const def = SESSION_DEFS[letter];
  const rank = MODE_RANK[mode];
  const activeVibe = VIBES.includes(vibe) ? vibe : "strong";
  const cfg = VIBE_CONFIG[activeVibe];
  const usedIds = new Set();

  const lastByLetter = loadLastByLetter();
  const last = lastByLetter[letter] || {};
  const avoidIds = new Set([...(last.rotationIds || []), last.favoriteId, last.funId, ...(last.coreIds || [])].filter(Boolean));

  const anchors = pickAnchors(letter, mode, usedIds, avoidIds, cfg);
  const favorite = pickFavorite(letter, usedIds, avoidIds, cfg);
  const rotation = pickRotations(letter, mode, usedIds, avoidIds, cfg);
  const exploreCount = cfg.exploreCount ? (rank === 3 ? cfg.exploreCount + 1 : cfg.exploreCount) : 0;
  const explore = exploreCount ? pickExplore(letter, usedIds, exploreCount) : [];
  const fun = pickFun(letter, mode, usedIds, avoidIds, cfg);
  const coreResult = pickCore(letter, mode, usedIds, avoidIds, last.coreMode, cfg);
  const warmupCount = rank === 1 ? 2 : rank === 2 ? 3 : 4;
  const warmup = pickWarmup(def.warmupKey, warmupCount, usedIds);
  const cooldown = pickCooldown(letter, rank, usedIds);

  lastByLetter[letter] = {
    anchorIds: anchors.map((r) => r.id),
    favoriteId: favorite[0] ? favorite[0].id : null,
    rotationIds: [...rotation, ...explore].map((r) => r.id),
    funId: fun[0] ? fun[0].id : null,
    coreIds: coreResult.items.map((r) => r.id),
    coreMode: coreResult.mode,
  };
  saveLastByLetter(lastByLetter);

  return {
    letter,
    label: def.label,
    mode,
    vibe: activeVibe,
    warmup,
    anchors,
    rotation: [...favorite, ...rotation, ...explore],
    fun,
    core: coreResult.items,
    cooldown,
  };
}

function loadLastByFamily() {
  try {
    const saved = JSON.parse(localStorage.getItem("moya-sila-last-by-family-v1"));
    if (saved && typeof saved === "object") return saved;
  } catch (e) {}
  return {};
}

function saveLastByFamily(value) {
  localStorage.setItem("moya-sila-last-by-family-v1", JSON.stringify(value));
}

function pickFamilyFocus(family) {
  const def = FAMILY_DEFS[family];
  const saved = loadLastByFamily();
  const previous = saved[family] || -1;
  const index = (previous + 1) % def.focuses.length;
  saved[family] = index;
  saveLastByFamily(saved);
  return def.focuses[index];
}

function rowFromExercise(exercise, slotTitle) {
  return { slotKey: "mobility", slotTitle, id: exercise.id, originalId: exercise.id };
}

function generateMobilitySession(mode, vibe) {
  const usedIds = new Set();
  const targetCount = mode === "EXPRESS" ? 6 : mode === "FULL" ? 10 : 8;
  const pool = EXERCISE_LIBRARY_LIST.filter((ex) => !ex.excludedDefault && (ex.sessionTags.includes("WARMUP") || ex.sessionTags.includes("MOBILITY") || ex.sessionTags.includes("POSTURE") || ex.recovery));
  const sorted = pool.slice().sort((a, b) => b.prefWeight - a.prefWeight || b.setupWeight - a.setupWeight);
  const drills = [];
  for (const ex of sorted) {
    if (drills.length >= targetCount) break;
    if (usedIds.has(ex.id)) continue;
    usedIds.add(ex.id);
    drills.push(rowFromExercise(ex, "Мобильность · короткий комплекс"));
  }
  return {
    letter: "MOBILITY",
    family: "MOBILITY",
    focus: FAMILY_DEFS.MOBILITY.focuses[0].label,
    label: FAMILY_DEFS.MOBILITY.label,
    mode,
    vibe: VIBES.includes(vibe) ? vibe : "mobility",
    warmup: drills,
    anchors: [],
    rotation: [],
    fun: [],
    core: [],
    cooldown: [],
  };
}

function addRowMetadata(row, format, circuitId, circuitOrder) {
  const exercise = EXERCISES[row.id] || {};
  const equipment = exercise.equipment || "bodyweight";
  const zoneMap = { freeweight: "dumbbells", barbell: "landmine", smith: "landmine", cable: "cable", machine: "machines", band: "bodyweight", bodyweight: "floor", roller: "floor" };
  const guide = exercise.weightGuide || (exercise.recovery || exercise.role === "warm-up" ? "Без веса" : exercise.role === "anchor" ? "Тяжёлый рабочий вес" : exercise.role === "skill" ? "Без веса / лёгкая помощь" : "Лёгкий рабочий вес");
  return { ...row, format, circuitId, circuitOrder, equipmentZone: zoneMap[equipment] || "any", weightGuide: guide };
}

function pickShortChecklist(family, count, role, usedIds) {
  const familyTags = family === "LOWER" ? ["A", "C"] : family === "UPPER" ? ["B"] : ["WARMUP", "MOBILITY", "POSTURE"];
  const isPrep = role === "warmup";
  let pool = EXERCISE_LIBRARY_LIST.filter((ex) => !ex.excludedDefault && !usedIds.has(ex.id) && (isPrep ? (ex.sessionTags.includes("WARMUP") || ex.tag === "warmup") : (ex.recovery || ex.sessionTags.includes("MOBILITY") || ex.sessionTags.includes("POSTURE"))) && (familyTags.some((tag) => ex.sessionTags.includes(tag)) || ex.sessionTags.includes("WARMUP") || ex.sessionTags.includes("MOBILITY") || ex.sessionTags.includes("POSTURE")));
  if (pool.length < count) pool = EXERCISE_LIBRARY_LIST.filter((ex) => !ex.excludedDefault && !usedIds.has(ex.id) && (isPrep ? (ex.sessionTags.includes("WARMUP") || ex.tag === "warmup") : (ex.recovery || ex.sessionTags.includes("MOBILITY") || ex.sessionTags.includes("POSTURE"))));
  return pool.slice().sort((a, b) => b.prefWeight - a.prefWeight).slice(0, count).map((ex, index) => {
    usedIds.add(ex.id);
    return addRowMetadata(rowFromExercise(ex, isPrep ? "Разминка · короткое движение" : "Роллер / заминка · короткое движение"), "circuit", role, index + 1);
  });
}

function pickMobilityAccent(family, count, usedIds) {
  return pickShortChecklist(family, count, "mobility-accent", usedIds).map((row) => ({ ...row, slotTitle: "Мобильный акцент · короткое движение" }));
}

function pickCalisthenicsProgression(count, usedIds, zone) {
  const names = /pull-up|chin-up|hang|scapular|push-up|plank|dead bug|hollow|inchworm/i;
  const pool = EXERCISE_LIBRARY_LIST.filter((ex) => !ex.excludedDefault && !usedIds.has(ex.id) && names.test(ex.nameEn) && (zone === "any" || zone === "floor" || ex.equipment === "bodyweight" || ex.equipment === "band"));
  return pool.slice().sort((a, b) => b.prefWeight - a.prefWeight).slice(0, count).map((ex, index) => {
    usedIds.add(ex.id);
    return addRowMetadata(rowFromExercise(ex, "Калистеника · прогрессия"), "sets", "calisthenics", index + 1);
  });
}

// Общая зона нужна не только как фильтр в панели замены: при новой генерации
// она старается собрать силовые движения рядом. Если в этой зоне нет разумной
// альтернативы, исходное упражнение остаётся — сессия не превращается в пустой список.
function applyZonePreference(rows, zone) {
  if (!zone || zone === "any") return rows || [];
  const chosenIds = new Set();
  return (rows || []).map((row) => {
    const currentZone = addRowMetadata({ id: row.id }, "sets", "", 0).equipmentZone;
    if (currentZone === zone) {
      chosenIds.add(row.id);
      return row;
    }
    const option = getSwapOptions(row.id, row.originalId, false, zone).find((exercise) => {
      const optionZone = addRowMetadata({ id: exercise.id }, "sets", "", 0).equipmentZone;
      return optionZone === zone && !chosenIds.has(exercise.id);
    });
    if (!option) return row;
    chosenIds.add(option.id);
    return { ...row, id: option.id };
  });
}

function decorateSession(session, accents, zone) {
  const activeAccents = globalThis.MoyaSilaTrainingState ? globalThis.MoyaSilaTrainingState.normalizeAccents(accents) : { mobility: false, calisthenics: false };
  session.anchors = applyZonePreference(session.anchors, zone);
  session.rotation = applyZonePreference(session.rotation, zone);
  session.core = applyZonePreference(session.core, zone);
  const usedIds = new Set(Object.values(session).filter(Array.isArray).flat().map((row) => row.id));
  const counts = { EXPRESS: { warmup: 6, cooldown: 6, mobility: 4, calisthenics: 2 }, NORMAL: { warmup: 10, cooldown: 10, mobility: 6, calisthenics: 3 }, FULL: { warmup: 10, cooldown: 10, mobility: 8, calisthenics: 3 } }[session.mode] || { warmup: 10, cooldown: 10, mobility: 6, calisthenics: 3 };
  if (session.family === "MOBILITY") { counts.warmup = session.mode === "FULL" ? 10 : session.mode === "EXPRESS" ? 6 : 8; counts.cooldown = 0; }
  session.warmup = pickShortChecklist(session.family, counts.warmup, "warmup", usedIds);
  session.cooldown = pickShortChecklist(session.family, counts.cooldown, "cooldown", usedIds);
  session.anchors = (session.anchors || []).map((row) => addRowMetadata(row, "sets", "", 0));
  session.rotation = (session.rotation || []).map((row) => addRowMetadata(row, "sets", "", 0));
  session.core = (session.core || []).map((row, index) => addRowMetadata(row, "circuit", "core", index + 1));
  if (session.mode === "FULL" && session.family !== "MOBILITY") {
    const extraCore = EXERCISE_LIBRARY_LIST.filter((ex) => ex.tag === "core" && !ex.excludedDefault && !usedIds.has(ex.id)).slice(0, 2);
    extraCore.forEach((ex, index) => { usedIds.add(ex.id); session.core.push(addRowMetadata(rowFromExercise(ex, "Кор"), "circuit", "core", session.core.length + index + 1)); });
  }
  session.fun = [];
  session.mobilityAccent = activeAccents.mobility ? pickMobilityAccent(session.family, counts.mobility, usedIds) : [];
  session.calisthenics = activeAccents.calisthenics ? pickCalisthenicsProgression(counts.calisthenics, usedIds, zone) : [];
  session.accents = activeAccents;
  session.zone = zone || "any";
  return session;
}

function generateFullBodySession(mode, vibe, accents, zone) {
  const lower = generateLegacySession("A", mode, vibe);
  const upper = generateLegacySession("B", mode, vibe);
  const lowerAnchor = lower.anchors[0] ? [lower.anchors[0]] : [];
  const upperAnchor = upper.anchors[0] ? [upper.anchors[0]] : [];
  return decorateSession({
    letter: "FULL_BODY",
    family: "FULL_BODY",
    focus: FAMILY_DEFS.FULL_BODY.focuses[0].label,
    label: FAMILY_DEFS.FULL_BODY.label,
    mode,
    vibe: VIBES.includes(vibe) ? vibe : "comfort",
    warmup: lower.warmup.slice(0, 3),
    anchors: [...lower.anchors.slice(0, mode === "FULL" ? 2 : 1), ...upper.anchors.slice(0, mode === "FULL" ? 2 : 1)],
    rotation: [...lower.rotation.slice(0, mode === "FULL" ? 2 : 1), ...upper.rotation.slice(0, mode === "FULL" ? 2 : 1)],
    fun: [],
    core: upper.core.slice(0, 1),
    cooldown: lower.cooldown.slice(0, 2),
  }, accents, zone);
}

const FOCUS_DEFS = {
  UPPER_PUSH_SHOULDERS: { family: "UPPER", label: "Грудь, плечи и трицепс", kind: "strength" },
  UPPER_PULL_POSTURE: { family: "UPPER", label: "Спина, задние дельты и осанка", kind: "strength", healthyBack: true },
  UPPER_ARMS_DELTS: { family: "UPPER", label: "Руки и дельты", kind: "strength", healthyBack: true },
  LOWER_GLUTES_POSTERIOR: { family: "LOWER", label: "Ягодицы и задняя цепь", kind: "strength" },
  LOWER_QUADS_CALVES: { family: "LOWER", label: "Квадрицепс и икры", kind: "strength" },
  LOWER_UNILATERAL: { family: "LOWER", label: "Односторонняя работа и выпады", kind: "strength" },
  MOBILITY_UPPER_POSTURE: { family: "MOBILITY", label: "Плечи, грудной отдел и осанка", kind: "strength", healthyBack: true },
  MOBILITY_LOWER_JOINTS: { family: "MOBILITY", label: "Тазобедренные, голеностоп и колени", kind: "strength" },
  MOBILITY_RECOVERY: { family: "MOBILITY", label: "Сила и восстановление всего тела", kind: "strength" },
  FULL_STRENGTH: { family: "FULL_BODY", label: "Всё тело · силовая", kind: "strength" },
  FULL_RETURN: { family: "FULL_BODY", label: "Всё тело · возвращение", kind: "strength" },
  FULL_STRENGTH_MOBILITY: { family: "FULL_BODY", label: "Всё тело · сила и мобильность", kind: "strength" },
};

const DEFAULT_FOCUS_BY_FAMILY = {
  UPPER: "UPPER_PULL_POSTURE",
  LOWER: "LOWER_GLUTES_POSTERIOR",
  MOBILITY: "MOBILITY_RECOVERY",
  FULL_BODY: "FULL_STRENGTH",
};

function exerciseZone(exercise) {
  if (exercise.equipmentZone) return exercise.equipmentZone;
  return addRowMetadata({ id: exercise.id }, "sets", "", 0).equipmentZone;
}

function focusedPool(focusId, zone, sections) {
  return EXERCISE_LIBRARY_LIST.filter((exercise) => {
    if (exercise.excludedDefault || (exercise.autoEligible === false && !(sections || []).includes("calisthenics"))) return false;
    if (!Array.isArray(exercise.focusIds) || !exercise.focusIds.includes(focusId)) return false;
    if (sections && !sections.includes(exercise.section)) return false;
    return !zone || zone === "any" || exerciseZone(exercise) === zone;
  });
}

function getFocusZoneAvailability(focusId, zone) {
  const focus = FOCUS_DEFS[focusId];
  const effectiveZone = zone || "any";
  if (!focus) return { available: false, count: 0, warning: "Выбери направление тренировки." };
  const strength = focusedPool(focusId, effectiveZone, ["anchors", "rotation"]);
  // A whole-workout zone is only honest when it can populate the agreed
  // three anchors plus three rotations. A partial match stays unavailable
  // instead of silently producing a mixed-equipment strength block.
  const required = focus.kind === "strength" ? 6 : 1;
  const available = effectiveZone === "any" || strength.length >= required;
  return {
    available,
    count: strength.length,
    required,
    warning: available ? "" : `В зоне «${effectiveZone}» пока недостаточно вариантов для 3 основных и 3 ротаций. Выбери «Любая зона» или другую зону.`,
  };
}

function getBlockZoneAvailability(rows, focusId, zone) {
  if (!zone || zone === "any") return { available: true, count: (rows || []).length };
  const pendingRows = (rows || []).filter(Boolean);
  const available = pendingRows.every((row) => {
    const options = getSwapOptions(row.id, row.originalId, focusId, zone, "zone");
    return options.some((exercise) => exerciseZone(exercise) === zone);
  });
  return { available, count: pendingRows.length };
}

function focusedRows(pool, count, usedIds, slotKey, slotTitle, format, usedPatterns = null, vibe = "comfort") {
  const picked = [];
  const vibeScore = (exercise) => {
    if (vibe === "strong") return exercise.section === "anchors" ? 6 : exercise.equipmentZone === "machines" ? 2 : 0;
    if (vibe === "comfort") return ["machines", "dumbbells"].includes(exercise.equipmentZone) ? 5 : 0;
    if (vibe === "pump") return exercise.section === "rotation" ? 5 : ["cable", "dumbbells"].includes(exercise.equipmentZone) ? 2 : 0;
    if (vibe === "mobility") return ["floor", "bodyweight", "dumbbells"].includes(exercise.equipmentZone) ? 5 : 0;
    if (vibe === "explore") return (String(exercise.id).charCodeAt(String(exercise.id).length - 1) % 5) + 1;
    if (vibe === "fun") return ["landmine", "dumbbells", "bodyweight"].includes(exercise.equipmentZone) ? 4 : 0;
    return 0;
  };
  const sorted = pool.slice().sort((a, b) => vibeScore(b) - vibeScore(a) || (b.prefWeight || 0) - (a.prefWeight || 0) || (b.setupWeight || 0) - (a.setupWeight || 0));
  for (const exercise of sorted) {
    if (picked.length >= count || usedIds.has(exercise.id)) continue;
    const pattern = exercise.movementPattern || exercise.tag;
    if (picked.some((row) => (EXERCISES[row.id].movementPattern || EXERCISES[row.id].tag) === pattern)) continue;
    if (usedPatterns && usedPatterns.has(pattern)) continue;
    usedIds.add(exercise.id);
    if (usedPatterns) usedPatterns.add(pattern);
    picked.push(addRowMetadata({ slotKey, slotTitle, id: exercise.id, originalId: exercise.id }, format || "sets", "", 0));
  }
  return picked;
}

function focusedSupportPool(focus, section) {
  const ids = focus.family === "UPPER"
    ? (section === "prep" ? ["EX119", "EX120", "EX125", "EX173"] : ["EX167", "EX177", "EX178", "EX179"])
    : focus.family === "LOWER"
      ? (section === "prep" ? ["EX122", "EX123", "EX124", "EX174", "EX185"] : ["EX012", "EX017", "EX147"])
      : ["EX119", "EX120", "EX122", "EX123", "EX124", "EX173", "EX174"];
  return ids.map((id) => EXERCISES[id]).filter(Boolean);
}

// Optional accents are deliberate mini-blocks, not an extension of warm-up.
// Each focus gets a small safe fallback pool so an enabled accent never renders
// as an empty button just because its primary library has no exact tag yet.
function focusedAccentPool(focusId, focus, accent, zone) {
  const directSections = accent === "calisthenics" ? ["calisthenics"]
    : accent === "healthyBack" ? ["healthyBack"]
      : ["prep", "activation"];
  const direct = focusedPool(focusId, zone, directSections);
  const byFamily = {
    LOWER: {
      mobility: ["EX174", "EX185", "EX121", "EX137"],
      calisthenics: ["EX183", "EX184", "EX186"],
      healthyBack: ["EX062", "EX171", "EX119", "EX120"],
    },
    UPPER: {
      mobility: ["EX125", "EX121", "EX172", "EX178"],
      calisthenics: ["EX180", "EX181", "EX166", "EX168"],
      healthyBack: ["EX062", "EX171", "EX119", "EX120"],
    },
    MOBILITY: {
      mobility: ["EX123", "EX124", "EX185", "EX121"],
      calisthenics: ["EX183", "EX184", "EX186"],
      healthyBack: ["EX062", "EX171", "EX119", "EX120"],
    },
    FULL_BODY: {
      mobility: ["EX125", "EX174", "EX185", "EX121"],
      calisthenics: ["EX183", "EX180", "EX186"],
      healthyBack: ["EX062", "EX171", "EX119", "EX120"],
    },
  };
  const fallback = ((byFamily[focus.family] || {})[accent] || []).map((id) => EXERCISES[id]).filter(Boolean);
  return [...direct, ...fallback].filter((exercise, index, all) => all.findIndex((item) => item.id === exercise.id) === index);
}

function focusedStrengthPool(focusId, focus, zone) {
  const direct = focusedPool(focusId, zone, ["anchors", "rotation"]);
  const fallbackIds = {
    UPPER_PUSH_SHOULDERS: ["EX069", "EX071", "EX083", "EX087", "EX076", "EX081", "EX089", "EX092", "EX163"],
    UPPER_PULL_POSTURE: ["EX050", "EX056", "EX064", "EX065", "EX094", "EX098", "EX171", "EX165"],
    UPPER_ARMS_DELTS: ["EX089", "EX094", "EX083", "EX087", "EX092", "EX098", "EX171", "EX076"],
    LOWER_GLUTES_POSTERIOR: ["EX001", "EX019", "EX024", "EX009", "EX013", "EX040", "EX175", "EX182"],
    LOWER_QUADS_CALVES: ["EX030", "EX164", "EX035", "EX040", "EX041", "EX046", "EX175", "EX176"],
    LOWER_UNILATERAL: ["EX040", "EX175", "EX176", "EX041", "EX013", "EX030", "EX024", "EX046"],
    MOBILITY_UPPER_POSTURE: ["EX050", "EX069", "EX071", "EX083", "EX064", "EX065", "EX076", "EX163"],
    MOBILITY_LOWER_JOINTS: ["EX030", "EX035", "EX040", "EX041", "EX046", "EX024", "EX013", "EX175"],
    MOBILITY_RECOVERY: ["EX030", "EX050", "EX069", "EX163", "EX164", "EX165", "EX040", "EX175"],
    FULL_STRENGTH: ["EX030", "EX050", "EX069", "EX163", "EX164", "EX165", "EX040", "EX175"],
    FULL_RETURN: ["EX030", "EX050", "EX069", "EX163", "EX164", "EX165", "EX040", "EX175"],
    FULL_STRENGTH_MOBILITY: ["EX030", "EX050", "EX069", "EX163", "EX164", "EX165", "EX040", "EX175"],
  }[focusId] || [];
  const fallback = fallbackIds.map((id) => EXERCISES[id]).filter(Boolean).filter((exercise) => !zone || zone === "any" || exerciseZone(exercise) === zone);
  return [...direct, ...fallback].filter((exercise, index, all) => all.findIndex((item) => item.id === exercise.id) === index);
}

function focusedCorePool(focusId) {
  const direct = focusedPool(focusId, "any", ["core"]);
  const fallback = ["EX101", "EX105", "EX108", "EX109", "EX110"].map((id) => EXERCISES[id]).filter(Boolean);
  return [...direct, ...fallback].filter((exercise, index, all) => all.findIndex((item) => item.id === exercise.id) === index);
}

function generateFocusedSession(focusId, mode, vibe, accents, zone) {
  const focus = FOCUS_DEFS[focusId] || FOCUS_DEFS[DEFAULT_FOCUS_BY_FAMILY.LOWER];
  const rank = MODE_RANK[mode] || MODE_RANK.NORMAL;
  const activeAccents = globalThis.MoyaSilaTrainingState ? globalThis.MoyaSilaTrainingState.normalizeAccents(accents) : { mobility: false, calisthenics: false };
  const usedIds = new Set();
  const availability = getFocusZoneAvailability(focusId, zone);
  const strengthPool = focusedStrengthPool(focusId, focus, zone);
  const prepPool = [...focusedPool(focusId, "any", ["prep"]), ...focusedSupportPool(focus, "prep")];
  const activationPool = [...focusedPool(focusId, "any", ["activation"]), ...focusedSupportPool(focus, "activation")];
  const cooldownPool = [...focusedPool(focusId, "any", ["cooldown"]), ...focusedSupportPool(focus, "prep")];
  const corePool = focusedCorePool(focusId);
  const healthyBackPool = focusedAccentPool(focusId, focus, "healthyBack", zone);
  // Fixed session structure agreed for every detailed plan and every mode.
  // Mode changes the selection, not the number of essential blocks.
  const strengthPlan = { anchors: 3, rotation: 3 };
  const strengthPatterns = new Set();
  const activeVibe = VIBES.includes(vibe) ? vibe : "comfort";
  const anchors = focus.kind === "strength" ? focusedRows(strengthPool, strengthPlan.anchors, usedIds, "anchors", "Основные упражнения", "sets", strengthPatterns, activeVibe) : [];
  const rotation = focus.kind === "strength" ? focusedRows(strengthPool, strengthPlan.rotation, usedIds, "rotation", "Ротация", "sets", strengthPatterns, activeVibe) : [];
  const prep = focusedRows(prepPool, 4, usedIds, "prep", "Подготовка", "checklist");
  const activation = focusedRows(activationPool, 3, usedIds, "activation", "Активация", "checklist");
  const core = focus.kind === "strength" ? focusedRows(corePool, 2, usedIds, "core", "Кор · круг", "circuit") : [];
  const accentCount = 3;
  // Optional sections have their own mini-programs. Their length must not be
  // reduced merely because preparation used a similar movement earlier.
  const healthyBack = focus.healthyBack || activeAccents.healthyBack ? focusedRows(healthyBackPool, accentCount, new Set(), "healthyBack", "Здоровая спина", "sets") : [];
  const mobilityAccent = activeAccents.mobility ? focusedRows(focusedAccentPool(focusId, focus, "mobility", zone), accentCount, new Set(), "mobilityAccent", "Мобильный акцент", "sets") : [];
  const calisthenics = activeAccents.calisthenics ? focusedRows(focusedAccentPool(focusId, focus, "calisthenics", zone), accentCount, new Set(), "calisthenics", "Калистеника · прогрессия", "sets") : [];
  // Cooldown has its own short sequence. It may intentionally revisit a
  // mobility drill from preparation, so it does not lose its required length.
  const cooldown = focusedRows(cooldownPool, 3, new Set(), "cooldown", "Заминка / роллер", "checklist");

  return {
    letter: focus.family,
    family: focus.family,
    focusId,
    focus: focus.label,
    label: FAMILY_DEFS[focus.family].label,
    mode,
    vibe: activeVibe,
    zone: zone || "any",
    zoneWarning: availability.warning,
    accents: activeAccents,
    prep, activation, anchors, rotation, core, healthyBack, mobilityAccent, calisthenics, cooldown,
    warmup: prep,
    fun: [],
  };
}

function generateSession(family, mode, vibe, accents, zone, requestedFocusId) {
  if (requestedFocusId && FOCUS_DEFS[requestedFocusId]) return generateFocusedSession(requestedFocusId, mode, vibe, accents, zone);
  const normalized = globalThis.MoyaSilaTrainingState && globalThis.MoyaSilaTrainingState.normalizeFamily(family);
  const activeFamily = normalized || "LOWER";
  if (activeFamily === "MOBILITY") return decorateSession(generateMobilitySession(mode, vibe), accents, zone);
  if (activeFamily === "FULL_BODY") return generateFullBodySession(mode, vibe, accents, zone);

  const focus = pickFamilyFocus(activeFamily);
  const legacy = generateLegacySession(focus.legacyLetter, mode, focus.vibe || vibe);
  return decorateSession({
    ...legacy,
    letter: activeFamily,
    family: activeFamily,
    focus: focus.label,
    label: FAMILY_DEFS[activeFamily].label,
  }, accents, zone);
}

function nextFamilyAfter(family) {
  const normalized = globalThis.MoyaSilaTrainingState && globalThis.MoyaSilaTrainingState.normalizeFamily(family);
  const index = FAMILY_ORDER.indexOf(normalized || "LOWER");
  return FAMILY_ORDER[(index + 1) % FAMILY_ORDER.length];
}

function nextLetterAfter(letter) {
  const order = ["A", "B", "C"];
  const idx = order.indexOf(letter);
  return order[(idx + 1) % order.length];
}

// Полный список реальных вариантов на замену + гарантированное исходное упражнение,
// чтобы всегда можно было вернуться назад одним тапом.
function getSwapOptions(currentId, originalId, focusIdOrPrep, zoneOrScope, requestedScope) {
  const current = EXERCISES[currentId];
  if (!current) return [];
  const focusedRequest = typeof focusIdOrPrep === "string" && FOCUS_DEFS[focusIdOrPrep];
  const isPrepSlot = focusedRequest ? ["prep", "activation", "cooldown"].includes(current.section) : Boolean(focusIdOrPrep);
  const focusId = focusedRequest ? focusIdOrPrep : null;
  const zone = focusedRequest ? zoneOrScope : zoneOrScope;
  const scope = focusedRequest ? (requestedScope || "all") : "all";
  const relatedTags = {
    back: ["back", "biceps"],
    shoulders: ["shoulders", "chest", "triceps"],
    chest: ["chest", "shoulders", "triceps"],
    "glute-max": ["glute-max", "hamstrings", "quads"],
    quads: ["quads", "glute-max", "hamstrings", "adductors"],
    hamstrings: ["hamstrings", "glute-max", "quads"],
    "glute-medius": ["glute-medius", "glute-max", "quads", "adductors"],
    adductors: ["adductors", "glute-max", "quads", "hamstrings"],
    calves: ["calves", "quads", "glute-max"],
    core: ["core"],
  }[current.tag] || [current.tag];
  const pool = EXERCISE_LIBRARY_LIST.filter((ex) => {
    if (!relatedTags.includes(ex.tag) || ex.excludedDefault) return false;
    // In the broad replacement panel, preserve the target muscle/pattern but
    // deliberately allow another equipment method when the gym is busy.
    if (focusId && scope === "zone" && (!Array.isArray(ex.focusIds) || !ex.focusIds.includes(focusId))) return false;
    if (ex.autoEligible === false && ex.id !== currentId && ex.id !== originalId) return false;
    if (!isPrepSlot && (ex.recovery || ex.role === "warm-up" || ex.role === "cardio" || ex.role === "recovery" || ex.role === "optional-activity")) return false;
    if ((scope === "zone" || !focusedRequest) && zone && zone !== "any") {
      const rowZone = exerciseZone(ex);
      if (rowZone !== zone && ex.id !== currentId && ex.id !== originalId) return false;
    }
    return true;
  });
  const preferredIds = [current.alt1, current.alt2].filter(Boolean);
  const scored = pool.map((ex) => ({
    ex,
    score: (preferredIds.includes(ex.id) ? 5 : 0) + (ex.movementPattern === current.movementPattern ? 4 : 0) + ex.prefWeight * 2 + ex.setupWeight,
  }));
  scored.sort((a, b) => b.score - a.score);
  const ids = scored.slice(0, 11).map((s) => s.ex.id);
  if (originalId && !ids.includes(originalId) && EXERCISES[originalId]) ids.unshift(originalId);
  if (!ids.includes(currentId) && EXERCISES[currentId]) ids.unshift(currentId);
  return ids.slice(0, 12).map((id) => EXERCISES[id]);
}
