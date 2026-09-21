const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const test = require("node:test");
const assert = require("node:assert/strict");
const trainingState = require("./training-state.js");

function loadGenerator() {
  const storage = new Map();
  const deterministicMath = Object.create(Math);
  deterministicMath.random = () => 0.25;
  const context = vm.createContext({
    console,
    Math: deterministicMath,
    localStorage: {
      getItem: (key) => storage.get(key) || null,
      setItem: (key, value) => storage.set(key, value),
    },
    MoyaSilaTrainingState: trainingState,
  });

  const directory = __dirname;
  vm.runInContext(
    `${fs.readFileSync(path.join(directory, "exercises-data.js"), "utf8")}\nglobalThis.__library = EXERCISE_LIBRARY_LIST;\nglobalThis.__exercises = EXERCISES;`,
    context,
  );
  vm.runInContext(fs.readFileSync(path.join(directory, "exercise-additions.js"), "utf8"), context);
  vm.runInContext(
    `${fs.readFileSync(path.join(directory, "generator.js"), "utf8")}\nglobalThis.__generator = { generateSession, nextFamilyAfter, getSwapOptions };`,
    context,
  );

  return { generator: context.__generator, exercises: context.__exercises };
}

test("does not return A, B or C as a generated session family", () => {
  const { generator } = loadGenerator();
  const session = generator.generateSession("LOWER", "NORMAL", "comfort");

  assert.equal(session.family, "LOWER");
  assert.notEqual(session.label, "Ягодицы и задняя цепь");
});

test("creates a mobility session with at least six short drills", () => {
  const { generator } = loadGenerator();
  const session = generator.generateSession("MOBILITY", "NORMAL", "mobility");

  assert.ok(session.warmup.length + session.anchors.length + session.rotation.length >= 6);
});

test("creates full body with one lower and one upper anchor", () => {
  const { generator, exercises } = loadGenerator();
  const session = generator.generateSession("FULL_BODY", "NORMAL", "comfort");
  const tags = session.anchors.map((row) => exercises[row.id].tag);

  assert.ok(tags.some((tag) => ["glute-max", "quads", "hamstrings"].includes(tag)));
  assert.ok(tags.some((tag) => ["back", "chest", "shoulders", "biceps", "triceps"].includes(tag)));
});

test("adds a separate mobility accent to full body", () => {
  const { generator } = loadGenerator();
  const session = generator.generateSession("FULL_BODY", "NORMAL", "comfort", { mobility: true, calisthenics: false }, "any");
  assert.ok(session.mobilityAccent.length >= 6);
  assert.ok(session.warmup.length >= 3);
});

test("keeps both optional blocks when both accents are chosen", () => {
  const { generator } = loadGenerator();
  const session = generator.generateSession("LOWER", "FULL", "strong", { mobility: true, calisthenics: true }, "any");
  assert.ok(session.mobilityAccent.length >= 8);
  assert.ok(session.calisthenics.length >= 3);
});

test("full body full mode has at least eleven cards", () => {
  const { generator } = loadGenerator();
  const session = generator.generateSession("FULL_BODY", "FULL", "comfort", { mobility: false, calisthenics: false }, "any");
  assert.ok(Object.values(session).filter(Array.isArray).flat().length >= 11);
});

test("standard lower prioritizes strength cards over prep cards", () => {
  const { generator } = loadGenerator();
  const session = generator.generateSession("LOWER", "NORMAL", "comfort", { mobility: false, calisthenics: false }, "any");
  const strengthCount = session.anchors.length + session.rotation.length + session.core.length;
  assert.ok(strengthCount >= 6);
  assert.equal(session.anchors.length >= 2, true);
});

test("full lower exposes ten optional warmup and roller checklist items", () => {
  const { generator } = loadGenerator();
  const session = generator.generateSession("LOWER", "FULL", "comfort", { mobility: false, calisthenics: false }, "any");
  assert.equal(session.warmup.length, 10);
  assert.equal(session.cooldown.length, 10);
});

test("full lower has a real three-exercise core block", () => {
  const { generator } = loadGenerator();
  const session = generator.generateSession("LOWER", "FULL", "comfort", { mobility: false, calisthenics: false }, "any");
  assert.ok(session.core.length >= 3);
});

test("default replacements ignore the global training zone", () => {
  const { generator } = loadGenerator();
  const options = generator.getSwapOptions("EX163", "EX163", false, "any");
  assert.ok(options.length >= 6);
});

test("every main strength exercise has at least six broad replacement options", () => {
  const { generator, exercises } = loadGenerator();
  const anchorIds = Object.values(exercises)
    .filter((exercise) => exercise.role === "anchor")
    .map((exercise) => exercise.id);

  anchorIds.forEach((id) => {
    assert.ok(
      generator.getSwapOptions(id, id, false, "any").length >= 6,
      `${id} should have a useful replacement list`,
    );
  });
});

test("prefers the selected gym zone for generated main exercises when alternatives exist", () => {
  const { generator, exercises } = loadGenerator();
  const session = generator.generateSession("LOWER", "NORMAL", "comfort", { mobility: false, calisthenics: false }, "dumbbells");

  assert.ok(session.anchors.every((row) => exercises[row.id].equipment === "freeweight"));
});
