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

const VIBES = ["strong", "explore", "fun", "comfort", "pump"];
const VIBE_LABEL = { strong: "Сила", explore: "Новое", fun: "Фан", comfort: "Комфорт", pump: "Памп" };
const VIBE_HINT = {
  strong: "Меньше вариаций, больше основного веса",
  explore: "Специально подмешиваю то, что ты давно не делала",
  fun: "Упор на фан-блок и разнообразие",
  comfort: "Только простые тренажёры, минимум возни",
  pump: "Больше подходов в работе, лёгкий памп",
};
const VIBE_CONFIG = {
  strong: { rotationDelta: -1, suppressFun: true, coreModePreference: ["strength", "sprint"], setupMult: 1, exploreCount: 0 },
  explore: { rotationDelta: 0, coreModePreference: null, setupMult: 1, exploreCount: 1 },
  fun: { rotationDelta: 1, forceFun: true, coreModePreference: ["sprint", "carry", "weighted"], setupMult: 1, exploreCount: 0 },
  comfort: { rotationDelta: 0, coreModePreference: ["strength"], setupMult: 4, exploreCount: 0 },
  pump: { rotationDelta: 1, coreModePreference: ["sprint"], setupMult: 1, exploreCount: 0 },
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

function generateSession(letter, mode, vibe) {
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

function nextLetterAfter(letter) {
  const order = ["A", "B", "C"];
  const idx = order.indexOf(letter);
  return order[(idx + 1) % order.length];
}

// Полный список реальных вариантов на замену + гарантированное исходное упражнение,
// чтобы всегда можно было вернуться назад одним тапом.
function getSwapOptions(currentId, originalId, isPrepSlot) {
  const current = EXERCISES[currentId];
  if (!current) return [];
  const pool = EXERCISE_LIBRARY_LIST.filter((ex) => {
    if (ex.tag !== current.tag || ex.excludedDefault) return false;
    if (!isPrepSlot && (ex.recovery || ex.role === "warm-up" || ex.role === "cardio" || ex.role === "recovery" || ex.role === "optional-activity")) return false;
    return true;
  });
  const preferredIds = [current.alt1, current.alt2].filter(Boolean);
  const scored = pool.map((ex) => ({
    ex,
    score: (preferredIds.includes(ex.id) ? 5 : 0) + ex.prefWeight * 2 + ex.setupWeight,
  }));
  scored.sort((a, b) => b.score - a.score);
  const ids = scored.slice(0, 7).map((s) => s.ex.id);
  if (originalId && !ids.includes(originalId) && EXERCISES[originalId]) ids.unshift(originalId);
  if (!ids.includes(currentId) && EXERCISES[currentId]) ids.unshift(currentId);
  return ids.slice(0, 8).map((id) => EXERCISES[id]);
}
