// Curated metadata overlay v5. It keeps the original exercise library intact
// and makes focus, equipment zone and automatic eligibility explicit.
(function applyFocusedExerciseCatalog() {
  const patch = (id, focusIds, movementPattern, equipmentZone, section, autoEligible = true, weightGuide) => ({
    id, focusIds, movementPattern, equipmentZone, section, autoEligible,
    ...(weightGuide ? { weightGuide } : {}),
  });
  const patches = [
    patch("EX001", ["LOWER_GLUTES_POSTERIOR", "FULL_STRENGTH", "FULL_RETURN", "FULL_STRENGTH_MOBILITY"], "hip-thrust", "machines", "anchors", true, "Рабочий вес"),
    patch("EX009", ["LOWER_GLUTES_POSTERIOR", "FULL_STRENGTH", "FULL_RETURN", "FULL_STRENGTH_MOBILITY", "MOBILITY_RECOVERY"], "back-extension-glute", "floor", "rotation", true, "Лёгкий рабочий вес"),
    patch("EX012", ["LOWER_GLUTES_POSTERIOR", "LOWER_UNILATERAL", "MOBILITY_LOWER_JOINTS"], "glute-bridge", "floor", "activation", true, "Без веса или лёгкая резинка"),
    patch("EX013", ["LOWER_GLUTES_POSTERIOR", "LOWER_UNILATERAL", "FULL_STRENGTH", "FULL_RETURN", "FULL_STRENGTH_MOBILITY", "MOBILITY_RECOVERY"], "hip-abduction", "machines", "rotation", true, "Лёгкий рабочий вес"),
    patch("EX017", ["LOWER_GLUTES_POSTERIOR", "LOWER_UNILATERAL", "MOBILITY_LOWER_JOINTS"], "lateral-band-walk", "bodyweight", "activation", true, "Лёгкая резинка"),
    patch("EX019", ["LOWER_GLUTES_POSTERIOR"], "leg-curl", "machines", "anchors", true, "Рабочий вес"),
    patch("EX020", ["LOWER_GLUTES_POSTERIOR"], "leg-curl", "machines", "anchors", true, "Рабочий вес"),
    patch("EX024", ["LOWER_GLUTES_POSTERIOR", "FULL_STRENGTH", "FULL_RETURN", "FULL_STRENGTH_MOBILITY", "MOBILITY_RECOVERY"], "romanian-deadlift", "dumbbells", "anchors", true, "Лёгкий рабочий вес"),
    patch("EX030", ["LOWER_QUADS_CALVES", "FULL_STRENGTH", "FULL_RETURN", "FULL_STRENGTH_MOBILITY", "MOBILITY_RECOVERY"], "leg-press", "machines", "anchors", true, "Рабочий вес"),
    patch("EX035", ["LOWER_QUADS_CALVES", "FULL_STRENGTH", "FULL_RETURN", "FULL_STRENGTH_MOBILITY", "MOBILITY_RECOVERY"], "goblet-squat", "dumbbells", "rotation", true, "Лёгкий рабочий вес"),
    patch("EX040", ["LOWER_UNILATERAL", "LOWER_GLUTES_POSTERIOR", "LOWER_QUADS_CALVES", "FULL_STRENGTH", "FULL_RETURN", "FULL_STRENGTH_MOBILITY", "MOBILITY_RECOVERY"], "split-squat", "dumbbells", "rotation", true, "Лёгкий рабочий вес"),
    patch("EX041", ["LOWER_UNILATERAL", "LOWER_QUADS_CALVES"], "step-up", "dumbbells", "rotation", true, "Без веса или лёгкий рабочий вес"),
    patch("EX046", ["LOWER_QUADS_CALVES"], "calf-raise", "machines", "rotation", true, "Рабочий вес"),
    patch("EX047", ["LOWER_QUADS_CALVES"], "calf-raise", "machines", "rotation", true, "Рабочий вес"),
    patch("EX050", ["UPPER_PULL_POSTURE", "FULL_STRENGTH", "FULL_RETURN", "FULL_STRENGTH_MOBILITY", "MOBILITY_RECOVERY"], "horizontal-pull", "cable", "anchors", true, "Рабочий вес"),
    patch("EX051", ["UPPER_PULL_POSTURE", "FULL_STRENGTH", "FULL_RETURN", "FULL_STRENGTH_MOBILITY", "MOBILITY_RECOVERY"], "horizontal-pull", "machines", "anchors", true, "Рабочий вес"),
    patch("EX056", ["UPPER_PULL_POSTURE", "FULL_STRENGTH"], "vertical-pull", "cable", "anchors", true, "Рабочий вес"),
    patch("EX059", ["UPPER_PULL_POSTURE"], "vertical-pull", "machines", "anchors", true, "Рабочий вес"),
    patch("EX062", ["UPPER_PULL_POSTURE", "UPPER_ARMS_DELTS"], "face-pull", "cable", "healthyBack", true, "Лёгкий рабочий вес"),
    patch("EX068", ["MOBILITY_UPPER_POSTURE", "UPPER_PULL_POSTURE"], "wall-slide", "floor", "activation", true, "Без веса"),
    patch("EX069", ["UPPER_PUSH_SHOULDERS", "FULL_STRENGTH", "FULL_RETURN", "FULL_STRENGTH_MOBILITY", "MOBILITY_RECOVERY"], "horizontal-push", "machines", "anchors", true, "Рабочий вес"),
    patch("EX071", ["UPPER_PUSH_SHOULDERS", "FULL_STRENGTH", "FULL_RETURN", "FULL_STRENGTH_MOBILITY", "MOBILITY_RECOVERY"], "horizontal-push", "dumbbells", "anchors", true, "Рабочий вес"),
    patch("EX083", ["UPPER_PUSH_SHOULDERS", "UPPER_ARMS_DELTS"], "vertical-push", "machines", "anchors", true, "Рабочий вес"),
    patch("EX084", ["UPPER_PUSH_SHOULDERS", "UPPER_ARMS_DELTS"], "vertical-push", "dumbbells", "anchors", true, "Лёгкий рабочий вес"),
    patch("EX087", ["UPPER_PUSH_SHOULDERS", "UPPER_ARMS_DELTS"], "lateral-raise", "dumbbells", "rotation", true, "Лёгкий рабочий вес"),
    patch("EX089", ["UPPER_PUSH_SHOULDERS", "UPPER_ARMS_DELTS"], "triceps-extension", "cable", "rotation", true, "Лёгкий рабочий вес"),
    patch("EX094", ["UPPER_PULL_POSTURE", "UPPER_ARMS_DELTS"], "biceps-curl", "dumbbells", "rotation", true, "Лёгкий рабочий вес"),
    patch("EX095", ["UPPER_PULL_POSTURE", "UPPER_ARMS_DELTS"], "biceps-curl", "dumbbells", "rotation", true, "Лёгкий рабочий вес"),
    patch("EX064", ["UPPER_PULL_POSTURE", "MOBILITY_UPPER_POSTURE"], "rear-delt-fly", "cable", "rotation", true, "Лёгкий рабочий вес"),
    patch("EX065", ["UPPER_PULL_POSTURE", "MOBILITY_UPPER_POSTURE"], "cable-y-raise", "cable", "rotation", true, "Очень лёгкий рабочий вес"),
    patch("EX076", ["UPPER_PUSH_SHOULDERS", "UPPER_ARMS_DELTS", "MOBILITY_UPPER_POSTURE"], "chest-fly", "cable", "rotation", true, "Лёгкий рабочий вес"),
    patch("EX081", ["UPPER_PUSH_SHOULDERS"], "standing-cable-press", "cable", "rotation", true, "Лёгкий рабочий вес"),
    patch("EX085", ["UPPER_PUSH_SHOULDERS", "UPPER_ARMS_DELTS"], "cable-lateral-raise", "cable", "rotation", true, "Лёгкий рабочий вес"),
    patch("EX092", ["UPPER_PUSH_SHOULDERS", "UPPER_ARMS_DELTS"], "overhead-triceps-extension", "cable", "rotation", true, "Лёгкий рабочий вес"),
    patch("EX098", ["UPPER_PULL_POSTURE", "UPPER_ARMS_DELTS"], "bayesian-curl", "cable", "rotation", true, "Лёгкий рабочий вес"),
    patch("EX103", ["FULL_STRENGTH", "FULL_RETURN"], "anti-rotation", "bodyweight", "core", true, "Лёгкая резинка"),
    patch("EX101", ["LOWER_GLUTES_POSTERIOR", "LOWER_QUADS_CALVES", "LOWER_UNILATERAL", "FULL_STRENGTH", "FULL_RETURN", "FULL_STRENGTH_MOBILITY", "MOBILITY_RECOVERY"], "reverse-crunch", "floor", "core", true, "Без веса"),
    patch("EX102", ["LOWER_GLUTES_POSTERIOR", "LOWER_QUADS_CALVES", "LOWER_UNILATERAL", "FULL_STRENGTH", "FULL_RETURN", "FULL_STRENGTH_MOBILITY", "MOBILITY_RECOVERY"], "dead-bug", "floor", "core", true, "Без веса"),
    patch("EX105", ["LOWER_GLUTES_POSTERIOR", "LOWER_QUADS_CALVES", "LOWER_UNILATERAL", "UPPER_ARMS_DELTS", "FULL_STRENGTH", "FULL_RETURN", "FULL_STRENGTH_MOBILITY", "MOBILITY_RECOVERY"], "rotation-core", "floor", "core", true, "Без веса или лёгкий блин"),
    patch("EX108", ["LOWER_GLUTES_POSTERIOR", "LOWER_QUADS_CALVES", "LOWER_UNILATERAL", "FULL_STRENGTH", "FULL_RETURN", "FULL_STRENGTH_MOBILITY", "MOBILITY_RECOVERY"], "front-plank", "floor", "core", true, "Без веса"),
    patch("EX119", ["MOBILITY_UPPER_POSTURE", "UPPER_PULL_POSTURE"], "thoracic-extension", "floor", "cooldown", true, "Без веса"),
    patch("EX120", ["MOBILITY_UPPER_POSTURE", "UPPER_PULL_POSTURE"], "thoracic-rotation", "floor", "cooldown", true, "Без веса"),
    patch("EX122", ["MOBILITY_LOWER_JOINTS", "LOWER_UNILATERAL"], "hip-rotation", "floor", "prep", true, "Без веса"),
    patch("EX123", ["MOBILITY_LOWER_JOINTS", "LOWER_UNILATERAL"], "adductor-mobility", "floor", "prep", true, "Без веса"),
    patch("EX124", ["MOBILITY_LOWER_JOINTS", "LOWER_QUADS_CALVES", "LOWER_UNILATERAL"], "ankle-mobility", "floor", "prep", true, "Без веса"),
    patch("EX147", ["LOWER_UNILATERAL", "MOBILITY_LOWER_JOINTS"], "hip-airplane", "floor", "activation", true, "Без веса / опора рядом"),
    patch("EX163", ["UPPER_PUSH_SHOULDERS", "FULL_STRENGTH", "FULL_RETURN", "FULL_STRENGTH_MOBILITY", "MOBILITY_RECOVERY"], "landmine-press", "landmine", "anchors", true, "Лёгкий рабочий вес"),
    patch("EX164", ["LOWER_QUADS_CALVES", "FULL_STRENGTH", "FULL_RETURN", "FULL_STRENGTH_MOBILITY", "MOBILITY_RECOVERY"], "landmine-squat", "landmine", "anchors", true, "Лёгкий рабочий вес"),
    patch("EX165", ["UPPER_PULL_POSTURE", "FULL_STRENGTH", "FULL_RETURN", "FULL_STRENGTH_MOBILITY", "MOBILITY_RECOVERY"], "horizontal-pull", "landmine", "anchors", true, "Лёгкий рабочий вес"),
    patch("EX166", ["UPPER_PULL_POSTURE"], "vertical-pull", "bodyweight", "calisthenics", false, "Без веса / лёгкая помощь"),
    patch("EX167", ["UPPER_PULL_POSTURE", "MOBILITY_UPPER_POSTURE"], "scapular-pull", "bodyweight", "activation", true, "Без веса / лёгкая резинка"),
    patch("EX168", ["UPPER_PUSH_SHOULDERS", "FULL_STRENGTH"], "push-up", "bodyweight", "calisthenics", false, "Без веса"),
    patch("EX169", ["UPPER_PUSH_SHOULDERS", "FULL_STRENGTH"], "push-up", "bodyweight", "calisthenics", false, "Без веса"),
    patch("EX170", ["LOWER_UNILATERAL"], "split-squat", "dumbbells", "rotation", true, "Лёгкий рабочий вес"),
    patch("EX171", ["UPPER_PULL_POSTURE", "UPPER_ARMS_DELTS"], "rear-delt-row", "dumbbells", "healthyBack", true, "Лёгкий рабочий вес"),
    patch("EX172", ["MOBILITY_UPPER_POSTURE", "UPPER_PULL_POSTURE"], "thoracic-extension", "floor", "cooldown", true, "Без веса"),
    patch("EX173", ["MOBILITY_UPPER_POSTURE", "UPPER_PULL_POSTURE"], "wall-slide", "floor", "activation", true, "Без веса"),
    patch("EX174", ["MOBILITY_LOWER_JOINTS", "LOWER_UNILATERAL"], "hip-flexor-mobility", "floor", "prep", true, "Без веса"),
  ];

  const additions = [
    ["EX175", "Dumbbell Reverse Lunge", "glute-max", "rotation", "freeweight", ["LOWER_UNILATERAL", "LOWER_GLUTES_POSTERIOR", "LOWER_QUADS_CALVES", "FULL_STRENGTH", "FULL_RETURN", "FULL_STRENGTH_MOBILITY", "MOBILITY_RECOVERY"], "reverse-lunge", "dumbbells", "rotation", "Лёгкий рабочий вес", "Шаг назад короткий и устойчивый; колено следует по линии стопы.", "3 × 8–10 на сторону · RIR 2–3", true],
    ["EX176", "Dumbbell Step-Up - Low Box", "glute-max", "rotation", "freeweight", ["LOWER_UNILATERAL", "LOWER_QUADS_CALVES"], "step-up", "dumbbells", "rotation", "Лёгкий рабочий вес", "Выбери низкую устойчивую тумбу, отталкивайся рабочей ногой без рывка.", "3 × 8 на сторону · RIR 2–3", true],
    ["EX177", "Band Pull-Apart", "back", "activation", "band", ["UPPER_PULL_POSTURE", "UPPER_ARMS_DELTS", "MOBILITY_UPPER_POSTURE"], "scapular-retraction", "bodyweight", "activation", "Без веса / лёгкая резинка", "Тяни ленту до комфортного раскрытия груди без подъёма плеч.", "2 × 10–15", true],
    ["EX178", "Band External Rotation - Elbow by Side", "shoulders", "activation", "band", ["UPPER_PUSH_SHOULDERS", "UPPER_PULL_POSTURE", "MOBILITY_UPPER_POSTURE"], "shoulder-external-rotation", "bodyweight", "activation", "Без веса / очень лёгкая резинка", "Локоть рядом с корпусом, вращай плечом медленно, без разворота корпуса.", "2 × 10–12 на сторону", true],
    ["EX179", "Scapular Push-Up", "shoulders", "activation", "bodyweight", ["UPPER_PUSH_SHOULDERS", "MOBILITY_UPPER_POSTURE", "FULL_STRENGTH_MOBILITY"], "scapular-protraction", "floor", "activation", "Без веса", "В высокой планке сохрани прямые руки и двигай только лопатками.", "2 × 8–12", true],
    ["EX180", "Band-Assisted Pull-Up", "back", "skill", "band", ["UPPER_PULL_POSTURE", "FULL_STRENGTH"], "vertical-pull", "bodyweight", "calisthenics", "Лёгкая или средняя помощь резинки", "Сначала опусти лопатки, затем тяни грудь к перекладине; без маха.", "3 × 3–6 · контроль", false],
    ["EX181", "Hanging Knee Raise", "core", "skill", "bodyweight", ["UPPER_PULL_POSTURE", "FULL_STRENGTH"], "hanging-core", "bodyweight", "calisthenics", "Без веса", "Поднимай колени без раскачки и без боли в плечах.", "2–3 × 5–8 · контроль", false],
    ["EX182", "Dumbbell Suitcase Romanian Deadlift", "hamstrings", "rotation", "freeweight", ["LOWER_GLUTES_POSTERIOR", "FULL_STRENGTH"], "hinge", "dumbbells", "rotation", "Лёгкий рабочий вес", "Гантели близко к ногам, таз уходит назад, спина нейтральна.", "3 × 8–10 · RIR 2–3", true],
    ["EX183", "Single-Leg Balance Reach", "glute-medius", "skill", "bodyweight", ["LOWER_UNILATERAL", "MOBILITY_LOWER_JOINTS", "FULL_RETURN"], "single-leg-balance", "floor", "calisthenics", "Без веса", "Стоя на одной ноге, мягко тянись свободной ногой назад; таз остаётся ровным.", "2 × 5–8 на сторону · контроль", false],
    ["EX184", "BOSU Squat to Box - Supported", "quads", "skill", "bodyweight", ["LOWER_UNILATERAL", "LOWER_QUADS_CALVES", "FULL_RETURN"], "bosu-squat", "bodyweight", "calisthenics", "Без веса / опора рядом", "Используй низкую амплитуду и опору рядом; цель — контроль стопы и колена, не глубина.", "2 × 5–8 · контроль", false],
    ["EX185", "Banded Ankle Inversion / Eversion", "calves", "activation", "band", ["LOWER_QUADS_CALVES", "LOWER_UNILATERAL", "MOBILITY_LOWER_JOINTS"], "ankle-stability", "floor", "prep", "Очень лёгкая резинка", "Двигай стопой медленно, колено остаётся неподвижным; не тяни через боль.", "2 × 8–12 на сторону", true],
    ["EX186", "Single-Leg Calf Raise - Supported", "calves", "skill", "bodyweight", ["LOWER_QUADS_CALVES", "LOWER_UNILATERAL", "FULL_RETURN"], "single-leg-calf-raise", "floor", "calisthenics", "Без веса / опора рядом", "Держись за опору, поднимайся и опускайся медленно без завала стопы.", "2 × 8–12 на сторону", false],
  ];

  patches.forEach((meta) => {
    if (EXERCISES[meta.id]) Object.assign(EXERCISES[meta.id], meta);
  });
  additions.forEach(([id, nameEn, tag, role, equipment, focusIds, movementPattern, equipmentZone, section, weightGuide, cue, prescription, autoEligible]) => {
    if (EXERCISES[id]) return;
    const exercise = { id, name: nameEn, nameEn, tag, role, equipment, focusIds, movementPattern, equipmentZone, section, weightGuide, cue, prescription, autoEligible, sessionTags: ["FOCUSED"], prefWeight: 3, setupWeight: 2, timed: false, recovery: false, excludedDefault: false, favorite: false, funRole: false, coreSprintRole: false, optionalActivityRole: false, pose: section === "calisthenics" ? "pull" : "stand" };
    EXERCISE_LIBRARY_LIST.push(exercise);
    EXERCISES[id] = exercise;
  });
  globalThis.MOYA_SILA_EXERCISE_CATALOG_V5 = { patches, additions };
})();
