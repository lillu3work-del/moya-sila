// Новые упражнения из обновления библиотеки v4. Добавляются поверх исходных 162 записей.
(function addKatyaExercises() {
  const make = (id, nameEn, tag, role, equipment, sessionTags, cue, prescription, extra = {}) => ({
    id, name: nameEn, nameEn, tag, role, roleLabel: role === "anchor" ? "Основное" : role === "warm-up" ? "Разминка" : "Мобильность / навык",
    equipment, sessionTags, cue, prescription, prefWeight: 3, setupWeight: 2, timed: false, recovery: role === "recovery" || role === "warm-up",
    excludedDefault: false, favorite: false, funRole: false, coreSprintRole: false, optionalActivityRole: false,
    pose: "stand", weightGuide: role === "anchor" ? "Тяжёлый рабочий вес" : role === "skill" ? "Без веса / лёгкая помощь" : (role === "recovery" || role === "warm-up") ? "Без веса" : "Лёгкий рабочий вес", ...extra,
  });
  const additions = [
    make("EX163", "Standing Two-Arm Landmine Press", "shoulders", "anchor", "barbell", ["B", "FULL_BODY"], "Кор напряжён, жми по дуге вперёд-вверх, не прогибай поясницу.", "3 × 8–12 · RIR 2–3", { pose: "press", alt1: "EX090" }),
    make("EX164", "Landmine Goblet Squat", "quads", "anchor", "barbell", ["A", "C", "FULL_BODY"], "Колени следуют за носками, таз опускается контролируемо, стопа полностью на полу.", "3 × 8–12 · RIR 2–3", { pose: "squat" }),
    make("EX165", "Landmine Row", "back", "anchor", "barbell", ["B", "FULL_BODY"], "Тяни локтем к тазу, рёбра собраны, не разворачивай корпус.", "3 × 8–12 на сторону · RIR 2–3", { pose: "row" }),
    make("EX166", "TRX Assisted Pull-Up", "back", "skill", "band", ["B", "FULL_BODY"], "Начни с виса, опусти лопатки, помогай ногами ровно настолько, сколько нужно.", "3 × 4–8 · контроль", { pose: "pull" }),
    make("EX167", "Band Scapular Pull-Up", "back", "skill", "band", ["B", "FULL_BODY", "WARMUP"], "Руки прямые: опускай и поднимай только лопатки, без рывка шеей.", "2 × 6–10 · медленно", { pose: "pull" }),
    make("EX168", "Incline Push-Up", "chest", "skill", "bodyweight", ["B", "FULL_BODY"], "Кор собран, тело одной линией, выбери высоту, где нет провала в пояснице.", "3 × 6–12 · RIR 2–4", { pose: "press" }),
    make("EX169", "Eccentric Push-Up", "chest", "skill", "bodyweight", ["B", "FULL_BODY"], "Опускайся 3–5 секунд, внизу поставь колени при необходимости и вернись без рывка.", "3 × 3–6 · контроль", { pose: "press" }),
    make("EX170", "Bulgarian Split Squat - Dumbbells", "glute-max", "rotation", "freeweight", ["A", "C", "FULL_BODY"], "Короткая устойчивость, корпус слегка вперёд, колено движется по линии стопы.", "3 × 8–12 на сторону · RIR 2–3", { pose: "lunge" }),
    make("EX171", "Dumbbell Rear-Delt Row", "back", "rotation", "freeweight", ["B", "FULL_BODY"], "Наклон стабильный, локти расходятся в стороны, не зажимай шею.", "3 × 10–15 · лёгкий–рабочий", { pose: "row" }),
    make("EX172", "Thoracic Extension on Foam Roller", "warmup", "recovery", "roller", ["WARMUP", "MOBILITY", "POSTURE"], "Роллер под верхней частью спины, поддержи голову, мягко разгибай грудной отдел.", "6–8 спокойных повторов", { pose: "floor" }),
    make("EX173", "Wall Slide with Serratus Reach", "shoulders", "warm-up", "bodyweight", ["WARMUP", "MOBILITY", "POSTURE", "B"], "Предплечья на стене, скользи вверх и в конце мягко потянись лопатками вперёд.", "8–10 повторов", { pose: "stand" }),
    make("EX174", "Half-Kneeling Hip Flexor Rock", "warmup", "warm-up", "bodyweight", ["WARMUP", "MOBILITY", "A", "C"], "Таз нейтрально, мягко переноси вес вперёд-назад без прогиба поясницы.", "6–8 на сторону", { pose: "lunge" }),
  ];
  additions.forEach((exercise) => { if (!EXERCISES[exercise.id]) { EXERCISE_LIBRARY_LIST.push(exercise); EXERCISES[exercise.id] = exercise; } });
})();
