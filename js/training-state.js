(function attachTrainingState(global) {
  const FAMILIES = ["LOWER", "UPPER", "MOBILITY", "FULL_BODY"];
  const FAMILY_BY_LEGACY_LETTER = { A: "LOWER", B: "UPPER", C: "LOWER" };
  const KNOWN_BACKUP_LABELS = new Set([
    "режим_тренировки",
    "текущая_тренировка",
    "отметки_упражнений",
    "история_весов_и_повторов",
    "журнал_завершённых_тренировок",
    "текущий_вайб",
    "календарь",
    "последняя_отмена",
    "очередь_A_B_C",
    "что_было_в_прошлый_раз",
    "ручные_активности_календаря",
  ]);

  function getFamilyForLegacyLetter(letter) {
    return FAMILY_BY_LEGACY_LETTER[letter] || null;
  }

  function normalizeFamily(value) {
    return FAMILIES.includes(value) ? value : getFamilyForLegacyLetter(value);
  }

  function normalizeAccents(value) {
    return {
      mobility: Boolean(value && value.mobility),
      calisthenics: Boolean(value && value.calisthenics),
    };
  }

  function toggleAccent(accents, name) {
    const next = normalizeAccents(accents);
    if (name === "mobility" || name === "calisthenics") next[name] = !next[name];
    return next;
  }

  function normalizeZone(value) {
    const zones = ["any", "dumbbells", "landmine", "cable", "machines", "bodyweight", "floor"];
    return zones.includes(value) ? value : "any";
  }

  function lastFamilyFromLog(log) {
    return (log || [])
      .map((entry) => ({ entry, family: normalizeFamily(entry.family || entry.letter) }))
      .filter((item) => item.family && item.entry.date)
      .sort((a, b) => new Date(b.entry.date) - new Date(a.entry.date))[0] || null;
  }

  function getRecommendation(log) {
    const last = lastFamilyFromLog(log);
    if (!last) {
      return {
        lastFamily: null,
        suggestedFamilies: ["LOWER", "UPPER", "MOBILITY", "FULL_BODY"],
        text: "Выбери то, что сейчас хочется делать.",
      };
    }

    const suggestions = {
      LOWER: ["UPPER", "MOBILITY", "FULL_BODY"],
      UPPER: ["LOWER", "MOBILITY", "FULL_BODY"],
      MOBILITY: ["LOWER", "UPPER", "FULL_BODY"],
      FULL_BODY: ["MOBILITY", "UPPER", "LOWER"],
    }[last.family];

    const labels = {
      LOWER: "нижняя часть",
      UPPER: "верхняя часть",
      MOBILITY: "мобильность и восстановление",
      FULL_BODY: "всё тело",
    };

    return {
      lastFamily: last.family,
      suggestedFamilies: suggestions,
      text: `Последняя силовая: ${labels[last.family]}. Сегодня можно выбрать ${labels[suggestions[0]]}, ${labels[suggestions[1]]} или ${labels[suggestions[2]]}.`,
    };
  }

  function isSameMonth(value, now) {
    const date = new Date(value);
    return !Number.isNaN(date.getTime()) && date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
  }

  function getMonthStats(log, manualActivities, now) {
    const current = now || new Date();
    const stats = { strength: 0, mobility: 0, other: 0 };

    (log || []).forEach((entry) => {
      if (!isSameMonth(entry.date, current)) return;
      const family = normalizeFamily(entry.family || entry.letter);
      if (["LOWER", "UPPER", "FULL_BODY"].includes(family)) stats.strength += 1;
      if (family === "MOBILITY") stats.mobility += 1;
    });

    Object.entries(manualActivities || {}).forEach(([dateKey, entry]) => {
      if (!isSameMonth(`${dateKey}T12:00:00.000Z`, current)) return;
      if (entry.type === "mobility") stats.mobility += 1;
      if (entry.type === "gym" && entry.family === "MOBILITY") stats.mobility += 1;
      if (entry.type === "gym" && ["LOWER", "UPPER", "FULL_BODY"].includes(entry.family)) stats.strength += 1;
      if (["run", "walk", "stretch", "other"].includes(entry.type)) stats.other += 1;
      if (["lower", "upper", "full_body"].includes(entry.type)) stats.strength += 1;
    });

    return stats;
  }

  function setManualActivity(activities, dateKey, value) {
    return {
      ...(activities || {}),
      [dateKey]: {
        type: value.type,
        ...(value.family ? { family: value.family } : {}),
        note: value.note || "",
        mood: value.mood || "",
      },
    };
  }

  function removeManualActivity(activities, dateKey) {
    const next = { ...(activities || {}) };
    delete next[dateKey];
    return next;
  }

  function toSessionIso(dateKey) {
    return `${dateKey}T12:00:00.000Z`;
  }

  function moveSessionLogDate(log, id, dateKey) {
    return (log || []).map((entry) => entry.id === id ? { ...entry, date: toSessionIso(dateKey) } : entry);
  }

  function isKnownBackupLabel(label) {
    return KNOWN_BACKUP_LABELS.has(label);
  }

  const api = {
    getFamilyForLegacyLetter,
    normalizeFamily,
    normalizeAccents,
    toggleAccent,
    normalizeZone,
    getRecommendation,
    getMonthStats,
    setManualActivity,
    removeManualActivity,
    toSessionIso,
    moveSessionLogDate,
    isKnownBackupLabel,
  };

  global.MoyaSilaTrainingState = api;
  if (typeof module !== "undefined") module.exports = api;
})(globalThis);
