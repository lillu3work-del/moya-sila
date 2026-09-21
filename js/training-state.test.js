const test = require("node:test");
const assert = require("node:assert/strict");
const state = require("./training-state.js");

test("maps A and C to LOWER and B to UPPER without changing historic records", () => {
  assert.equal(state.getFamilyForLegacyLetter("A"), "LOWER");
  assert.equal(state.getFamilyForLegacyLetter("C"), "LOWER");
  assert.equal(state.getFamilyForLegacyLetter("B"), "UPPER");
});

test("keeps a manual run beside a completed lower session on the same day", () => {
  const manual = state.setManualActivity({}, "2026-09-21", {
    type: "run",
    note: "Лёгкий бег",
    mood: "🙂",
  });

  assert.deepEqual(manual["2026-09-21"], {
    type: "run",
    note: "Лёгкий бег",
    mood: "🙂",
  });
  assert.equal(state.getFamilyForLegacyLetter("C"), "LOWER");
});

test("recommends upper, mobility and full body after lower", () => {
  const result = state.getRecommendation([
    { date: "2026-09-20T10:00:00.000Z", family: "LOWER" },
  ]);

  assert.equal(result.lastFamily, "LOWER");
  assert.deepEqual(result.suggestedFamilies, ["UPPER", "MOBILITY", "FULL_BODY"]);
});

test("old data without manual activities still returns zero activity counts", () => {
  assert.deepEqual(state.getMonthStats([], undefined, new Date("2026-09-21")), {
    strength: 0,
    mobility: 0,
    other: 0,
  });
});

test("keeps a selected past date as the session date", () => {
  assert.equal(
    state.toSessionIso("2026-09-20"),
    "2026-09-20T12:00:00.000Z",
  );
});

test("moves only the selected session log date", () => {
  const log = [{ id: "s1", date: "2026-09-21T12:00:00.000Z", family: "LOWER" }];
  const moved = state.moveSessionLogDate(log, "s1", "2026-09-19");

  assert.equal(moved[0].date, "2026-09-19T12:00:00.000Z");
  assert.equal(log[0].date, "2026-09-21T12:00:00.000Z");
});

test("deletes only the selected manual activity", () => {
  const records = {
    "2026-09-20": { type: "walk", note: "", mood: "🙂" },
    "2026-09-21": { type: "run", note: "", mood: "💪" },
  };

  assert.deepEqual(state.removeManualActivity(records, "2026-09-20"), {
    "2026-09-21": { type: "run", note: "", mood: "💪" },
  });
});

test("recognizes every known label in the September backup", () => {
  const labels = [
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
  ];

  assert.ok(labels.every((label) => state.isKnownBackupLabel(label)));
});

test("keeps mobility and calisthenics independent", () => {
  assert.deepEqual(
    state.toggleAccent({ mobility: true, calisthenics: false }, "calisthenics"),
    { mobility: true, calisthenics: true },
  );
});

test("normalizes an old session with no accents", () => {
  assert.deepEqual(state.normalizeAccents(undefined), { mobility: false, calisthenics: false });
});

test("counts manual gym mobility without creating a session", () => {
  const stats = state.getMonthStats([], { "2026-09-20": { type: "gym", family: "MOBILITY" } }, new Date("2026-09-21"));
  assert.deepEqual(stats, { strength: 0, mobility: 1, other: 0 });
});
