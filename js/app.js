/* Логика: генерация тренировки, мгновенная замена, вес/история, финиш дня. */

const STORAGE_MODE = "moya-sila-mode-v1";
const STORAGE_SESSION = "moya-sila-current-session-v2";
const STORAGE_STATUS = "moya-sila-status-v1";
const STORAGE_HISTORY = "moya-sila-history-v1";
const STORAGE_LOG = "moya-sila-log-v2";
const STORAGE_VIBE = "moya-sila-vibe-v1";
const STORAGE_CALENDAR = "moya-sila-calendar-v1";
const STORAGE_RIR_SEEN = "moya-sila-rir-seen-v1";
const STORAGE_UNDO = "moya-sila-undo-v1";
const STORAGE_MANUAL_ACTIVITIES = "moya-sila-manual-activities-v1";
const STORAGE_DRAFT_WEIGHT_IDS = "moya-sila-draft-weight-ids-v1";
const STORAGE_ACCENTS = "moya-sila-accents-v1";
const STORAGE_ZONE = "moya-sila-zone-v1";

const ALL_STORAGE_KEYS = [STORAGE_MODE, STORAGE_SESSION, STORAGE_STATUS, STORAGE_HISTORY, STORAGE_LOG, STORAGE_VIBE, STORAGE_CALENDAR, STORAGE_UNDO, STORAGE_MANUAL_ACTIVITIES, STORAGE_DRAFT_WEIGHT_IDS, STORAGE_ACCENTS, STORAGE_ZONE, "moya-sila-rotation-v1", "moya-sila-last-by-letter-v1", "moya-sila-last-by-family-v1"];

function makeId() {
  return Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
}

function dateKey(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const WEEKDAYS_RU = ["ВС", "ПН", "ВТ", "СР", "ЧТ", "ПТ", "СБ"];
const MONTHS_RU = ["янв", "фев", "мар", "апр", "мая", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];
const MONTHS_RU_FULL = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
const MONTHS_RU_NOM = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"];

function loadJSON(key, fallback) {
  try {
    const saved = JSON.parse(localStorage.getItem(key));
    if (saved !== null && saved !== undefined) return saved;
  } catch (e) {}
  return fallback;
}
function saveJSON(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

const rotation = loadRotationState();
const state = {
  mode: loadJSON(STORAGE_MODE, "NORMAL"),
  vibe: loadVibeState().current,
  session: loadJSON(STORAGE_SESSION, null),
  status: loadJSON(STORAGE_STATUS, {}), // key -> 'done' | 'skipped'
  history: loadJSON(STORAGE_HISTORY, {}), // exerciseId -> [{date, weight, reps}]
  log: loadJSON(STORAGE_LOG, []),
  calendar: loadJSON(STORAGE_CALENDAR, {}), // dateKey -> {type: 'session'|'cardio'|'other'|'rest', letter?}
  manualActivities: loadJSON(STORAGE_MANUAL_ACTIVITIES, {}),
  draftWeightIds: loadJSON(STORAGE_DRAFT_WEIGHT_IDS, []),
  accents: MoyaSilaTrainingState.normalizeAccents(loadJSON(STORAGE_ACCENTS, {})),
  zone: MoyaSilaTrainingState.normalizeZone(loadJSON(STORAGE_ZONE, "any")),
  blockZones: {},
  lastUndo: loadJSON(STORAGE_UNDO, null),
  view: "home", // 'home' | 'workout' | 'history' | 'report'
  reportId: null,
  expanded: null,
  swapOpenKey: null,
  calendarOpenDay: null,
  calendarMonth: { year: new Date().getFullYear(), month: new Date().getMonth() },
  activityEditor: { key: null, type: "other", family: "unknown" },
  timer: { key: null, seconds: 0, running: false, interval: null },
};
if (!state.session) {
  state.session = generateSession("LOWER", state.mode, state.vibe);
  saveJSON(STORAGE_SESSION, state.session);
}
state.session.accents = MoyaSilaTrainingState.normalizeAccents(state.session.accents || state.accents);
state.session.zone = MoyaSilaTrainingState.normalizeZone(state.session.zone || state.zone);
saveJSON(STORAGE_SESSION, state.session);

function selectedSessionDateKey() {
  const input = document.getElementById("session-date");
  return input && /^\d{4}-\d{2}-\d{2}$/.test(input.value) ? input.value : dateKey(new Date());
}
if (typeof localStorage.getItem(STORAGE_MODE) !== "string") saveJSON(STORAGE_MODE, state.mode);

const BLOCKS = [
  { group: "warmup", title: "Разминка", cls: "block-warmup" },
  { group: "anchors", title: "Основные", cls: "block-main" },
  { group: "rotation", title: "Ротация / любимое", cls: "block-rotation" },
  { group: "core", title: "Кор", cls: "block-core" },
  { group: "mobilityAccent", title: "Мобильный акцент", cls: "block-mobility" },
  { group: "calisthenics", title: "Калистеника · прогрессия", cls: "block-calisthenics" },
  { group: "cooldown", title: "Растяжка / роллер", cls: "block-cooldown" },
];

function slotKey(group, index) {
  return `${group}:${index}`;
}

function getRow(group, index) {
  return state.session[group][index];
}

function allTrackableRows() {
  const rows = [];
  BLOCKS.forEach((b) => {
    (state.session[b.group] || []).forEach((row, i) => {
      if (row.optional) return;
      rows.push({ ...row, group: b.group, index: i });
    });
  });
  return rows;
}

function progressPercent() {
  const rows = allTrackableRows();
  if (!rows.length) return 0;
  const settled = rows.filter((r) => state.status[slotKey(r.group, r.index)]);
  return Math.round((settled.length / rows.length) * 100);
}

function setStatus(key, value) {
  if (state.status[key] === value) delete state.status[key];
  else state.status[key] = value;
  saveJSON(STORAGE_STATUS, state.status);
  render();
}

function toggleExpand(key) {
  state.expanded = state.expanded === key ? null : key;
  state.swapOpenKey = null;
  stopTimer();
  render();
}

function toggleSwap(key) {
  state.expanded = key;
  state.swapOpenKey = state.swapOpenKey === key ? null : key;
  render();
}

function applySwap(group, index, newId) {
  const row = getRow(group, index);
  row.id = newId;
  saveJSON(STORAGE_SESSION, state.session);
  state.swapOpenKey = null;
  render();
}

// ⟳ рядом с копированием — мгновенная автозамена на следующий вариант по кругу,
// без открытия списка (список открывается отдельно через "Заменить упражнение →").
function quickSwap(group, index) {
  const row = getRow(group, index);
  const isPrepSlot = group === "warmup" || group === "cooldown";
  const options = getSwapOptions(row.id, row.originalId, isPrepSlot, state.blockZones[group] || "any");
  if (options.length < 2) return;
  const ids = options.map((o) => o.id);
  const curIdx = ids.indexOf(row.id);
  const nextId = ids[(curIdx + 1) % ids.length];
  row.id = nextId;
  saveJSON(STORAGE_SESSION, state.session);
  render();
}

function changeMode(mode) {
  withTransition(() => {
    state.mode = mode;
    saveJSON(STORAGE_MODE, mode);
    state.session = generateSession(state.session.family || state.session.letter, mode, state.vibe, state.accents, state.zone);
    saveJSON(STORAGE_SESSION, state.session);
    state.status = {};
    saveJSON(STORAGE_STATUS, state.status);
    clearDraftWeightIds();
    state.expanded = null;
    state.swapOpenKey = null;
    render();
  });
}

function startFamilySession(family) {
  withTransition(() => {
    state.session = generateSession(family, state.mode, state.vibe, state.accents, state.zone);
    saveJSON(STORAGE_SESSION, state.session);
    state.status = {};
    saveJSON(STORAGE_STATUS, state.status);
    clearDraftWeightIds();
    state.expanded = null;
    state.swapOpenKey = null;
    showView("workout");
  });
}

function changeVibe(vibe) {
  withTransition(() => {
    state.vibe = vibe;
    saveVibeState({ current: vibe });
    state.session = generateSession(state.session.family || state.session.letter, state.mode, vibe, state.accents, state.zone);
    saveJSON(STORAGE_SESSION, state.session);
    state.status = {};
    saveJSON(STORAGE_STATUS, state.status);
    clearDraftWeightIds();
    state.expanded = null;
    state.swapOpenKey = null;
    render();
  });
}

// ---------- ЭКРАНЫ (Тренировка / История / Отчёт) ----------

function showView(view) {
  state.view = view;
  ["view-home", "view-workout", "view-history", "view-report"].forEach((id) => {
    const el2 = document.getElementById(id);
    if (el2) el2.classList.toggle("hidden", id !== `view-${view}`);
  });
  render();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function openReport(id) {
  state.reportId = id;
  showView("report");
}

function setCalendarDay(key, type) {
  if (type === null) delete state.calendar[key];
  else state.calendar[key] = { type };
  saveJSON(STORAGE_CALENDAR, state.calendar);
  state.calendarOpenDay = null;
  render();
}

const ACTIVITY_TYPES = [
  ["run", "Бег"], ["walk", "Прогулка"], ["stretch", "Растяжка"],
  ["mobility", "Мобильность"], ["gym", "Тренировка в зале"], ["other", "Другое"], ["rest", "Отдых"],
];

function getCalendarEntry(key) {
  const session = state.log.find((entry) => dateKey(new Date(entry.date)) === key);
  if (session) return { type: "session", letter: session.family || session.letter, label: session.label };
  const manual = state.manualActivities[key];
  if (manual) return { type: manual.type, note: manual.note };
  return state.calendar[key] || null;
}

function openActivityEditor(key = dateKey(new Date())) {
  const modal = document.getElementById("activity-modal");
  const existing = state.manualActivities[key] || state.calendar[key] || {};
  state.activityEditor = { key, type: existing.type || "other", family: existing.family || "unknown" };
  document.getElementById("activity-date").value = key;
  document.getElementById("activity-note").value = existing.note || "";
  renderActivityTypes();
  document.getElementById("activity-delete-btn").classList.toggle("hidden", !state.manualActivities[key]);
  modal.classList.remove("hidden");
}

function closeActivityEditor() { document.getElementById("activity-modal").classList.add("hidden"); }

function renderActivityTypes() {
  const wrap = document.getElementById("activity-types");
  if (!wrap) return;
  wrap.innerHTML = "";
  ACTIVITY_TYPES.forEach(([type, label]) => {
    const button = el(`<button type="button" class="${type === state.activityEditor.type ? "active" : ""}" data-type="${type}">${label}</button>`);
    button.addEventListener("click", () => { state.activityEditor.type = type; renderActivityTypes(); });
    wrap.appendChild(button);
  });
  const gymWrap = document.getElementById("activity-gym-family");
  gymWrap.classList.toggle("hidden", state.activityEditor.type !== "gym");
  gymWrap.innerHTML = "";
  if (state.activityEditor.type === "gym") {
    [["LOWER", "Низ"], ["UPPER", "Верх"], ["MOBILITY", "Мобильность"], ["FULL_BODY", "Всё тело"], ["unknown", "Не помню"]].forEach(([family, label]) => {
      const button = el(`<button type="button" class="${state.activityEditor.family === family ? "active" : ""}">${label}</button>`);
      button.addEventListener("click", () => { state.activityEditor.family = family; renderActivityTypes(); });
      gymWrap.appendChild(button);
    });
  }
}

function saveActivityEditor() {
  const key = document.getElementById("activity-date").value;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key) || key > dateKey(new Date())) return;
  if (state.activityEditor.key !== key) delete state.manualActivities[state.activityEditor.key];
  state.manualActivities = MoyaSilaTrainingState.setManualActivity(state.manualActivities, key, {
    type: state.activityEditor.type,
    family: state.activityEditor.type === "gym" ? state.activityEditor.family : "",
    note: document.getElementById("activity-note").value.trim(),
  });
  saveJSON(STORAGE_MANUAL_ACTIVITIES, state.manualActivities);
  closeActivityEditor();
  render();
}

function deleteActivityEditor() {
  state.manualActivities = MoyaSilaTrainingState.removeManualActivity(state.manualActivities, state.activityEditor.key);
  saveJSON(STORAGE_MANUAL_ACTIVITIES, state.manualActivities);
  closeActivityEditor();
  render();
}

// Полный слепок тренировки для отчёта: что было в каждом блоке, отмечено ли,
// и какой вес/повторы записаны именно сегодня (чтобы отчёт не тянул старые записи).
function snapshotSessionExercises(sessionKey) {
  const out = [];
  BLOCKS.forEach((b) => {
    (state.session[b.group] || []).forEach((row, i) => {
      const exercise = EXERCISES[row.id];
      const key = slotKey(b.group, i);
      const last = lastLog(row.id);
      const loggedToday = last && dateKey(new Date(last.date)) === sessionKey ? last : null;
      out.push({
        id: row.id,
        name: exercise.nameEn,
        block: b.group,
        blockTitle: b.title,
        slotTitle: row.slotTitle,
        status: state.status[key] || null,
        weight: loggedToday ? loggedToday.weight : "",
        reps: loggedToday ? loggedToday.reps : "",
      });
    });
  });
  return out;
}

function commitDraftWeights(sessionKey) {
  const draftIds = new Set(state.draftWeightIds);
  if (!draftIds.size) return;
  Object.values(state.history).forEach((entries) => {
    entries.forEach((entry) => {
      if (draftIds.has(entry.id)) entry.date = MoyaSilaTrainingState.toSessionIso(sessionKey);
    });
  });
  saveJSON(STORAGE_HISTORY, state.history);
}

function finishSession() {
  const rows = allTrackableRows();
  const doneCount = rows.filter((r) => state.status[slotKey(r.group, r.index)] === "done").length;
  const skippedCount = rows.filter((r) => state.status[slotKey(r.group, r.index)] === "skipped").length;
  const note = (document.getElementById("session-note").value || "").trim();
  const todayKey = selectedSessionDateKey();
  commitDraftWeights(todayKey);
  const exercisesSnapshot = snapshotSessionExercises(todayKey);

  // Снэпшот всего, что мы сейчас поменяем — чтобы можно было одним тапом откатить,
  // если "Готово" нажали случайно или слишком рано.
  const undoSnapshot = {
    session: state.session,
    status: state.status,
    rotationNext: rotation.next,
    rotationHistory: rotation.history.slice(),
    vibe: state.vibe,
    calendarKey: todayKey,
    previousCalendarEntry: state.calendar[todayKey] || null,
  };

  const logId = makeId();
  state.log.push({
    id: logId,
    date: MoyaSilaTrainingState.toSessionIso(todayKey),
    letter: state.session.letter,
    family: state.session.family || state.session.letter,
    focus: state.session.focus || state.session.label,
    label: state.session.label,
    mode: state.session.mode,
    vibe: state.session.vibe,
    total: rows.length,
    done: doneCount,
    skipped: skippedCount,
    note,
    exercises: exercisesSnapshot,
  });
  saveJSON(STORAGE_LOG, state.log);
  undoSnapshot.logId = logId;

  state.calendar[todayKey] = { type: "session", letter: state.session.letter };
  saveJSON(STORAGE_CALENDAR, state.calendar);

  rotation.history.push(state.session.family || state.session.letter);
  rotation.next = MoyaSilaTrainingState.getRecommendation(state.log).suggestedFamilies[0];
  saveRotationState(rotation);

  state.vibe = nextVibeAfter(state.vibe);
  saveVibeState({ current: state.vibe });

  state.session = generateSession(rotation.next, state.mode, state.vibe);
  saveJSON(STORAGE_SESSION, state.session);
  state.status = {};
  saveJSON(STORAGE_STATUS, state.status);
  state.draftWeightIds = [];
  saveJSON(STORAGE_DRAFT_WEIGHT_IDS, state.draftWeightIds);
  state.expanded = null;
  state.swapOpenKey = null;
  document.getElementById("session-note").value = "";

  state.lastUndo = undoSnapshot;
  saveJSON(STORAGE_UNDO, undoSnapshot);

  render();
  window.scrollTo({ top: 0, behavior: "smooth" });
  showCelebration({ done: doneCount, total: rows.length, letter: undoSnapshot.session.letter, streak: calculateStreak() });
}

// Сколько дней подряд (включая сегодня) есть хоть какая-то отметка в календаре.
function calculateStreak() {
  let streak = 0;
  const d = new Date();
  while (true) {
    const key = dateKey(d);
    if (!getCalendarEntry(key)) break;
    streak += 1;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

function undoLastFinish() {
  const snap = state.lastUndo;
  if (!snap) return;
  if (!window.confirm("Отменить последнее завершение и вернуться к той тренировке?")) return;

  const idx = state.log.findIndex((e) => e.id === snap.logId);
  if (idx !== -1) state.log.splice(idx, 1);
  saveJSON(STORAGE_LOG, state.log);

  if (snap.previousCalendarEntry) state.calendar[snap.calendarKey] = snap.previousCalendarEntry;
  else delete state.calendar[snap.calendarKey];
  saveJSON(STORAGE_CALENDAR, state.calendar);

  rotation.next = snap.rotationNext;
  rotation.history = snap.rotationHistory;
  saveRotationState(rotation);

  state.vibe = snap.vibe;
  saveVibeState({ current: state.vibe });

  state.session = snap.session;
  saveJSON(STORAGE_SESSION, state.session);
  state.status = snap.status;
  saveJSON(STORAGE_STATUS, state.status);

  state.lastUndo = null;
  localStorage.removeItem(STORAGE_UNDO);

  state.expanded = null;
  state.swapOpenKey = null;
  render();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function dismissUndo() {
  state.lastUndo = null;
  localStorage.removeItem(STORAGE_UNDO);
  render();
}

function deleteHistoryEntry(id) {
  if (!window.confirm("Удалить эту запись из истории?")) return;
  const idx = state.log.findIndex((e) => e.id === id);
  if (idx === -1) return;
  const entry = state.log[idx];
  state.log.splice(idx, 1);
  saveJSON(STORAGE_LOG, state.log);

  const key = dateKey(new Date(entry.date));
  const calEntry = state.calendar[key];
  if (calEntry && calEntry.type === "session" && calEntry.letter === entry.letter) {
    const stillHasSessionThatDay = state.log.some((e) => dateKey(new Date(e.date)) === key);
    if (!stillHasSessionThatDay) delete state.calendar[key];
    saveJSON(STORAGE_CALENDAR, state.calendar);
  }

  if (state.lastUndo && state.lastUndo.logId === id) {
    state.lastUndo = null;
    localStorage.removeItem(STORAGE_UNDO);
  }
  render();
}

function updateHistoryNote(id, note) {
  const entry = state.log.find((e) => e.id === id);
  if (!entry) return;
  entry.note = note;
  saveJSON(STORAGE_LOG, state.log);
}

function updateHistoryDate(id, nextKey) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(nextKey) || nextKey > dateKey(new Date())) return;
  const entry = state.log.find((item) => item.id === id);
  if (!entry) return;
  const previousKey = dateKey(new Date(entry.date));
  state.log = MoyaSilaTrainingState.moveSessionLogDate(state.log, id, nextKey);
  saveJSON(STORAGE_LOG, state.log);
  if (state.calendar[previousKey] && state.calendar[previousKey].type === "session") delete state.calendar[previousKey];
  state.calendar[nextKey] = { type: "session", letter: entry.family || entry.letter };
  saveJSON(STORAGE_CALENDAR, state.calendar);
  render();
}

const FINISH_QUOTES = [
  "Готово. Тело не спросит «а стоило ли» — оно просто станет крепче.",
  "Ты пришла и сделала. Это уже больше, чем у большинства планов на сегодня.",
  "Ещё одна тренировка в копилке. Считается.",
  "Не идеально — и не надо. Сделано — уже отлично.",
  "Тело помнит каждую тренировку, даже когда ты не помнишь.",
  "Маленький шаг, которого не было бы без тебя сегодня.",
  "Сложно было встать — но ты встала. Остальное было делом техники.",
  "Прогресс редко выглядит эффектно. Обычно он выглядит вот так.",
  "Никто не видел, но это было. И это главное.",
  "Сегодняшняя тренировка — это письмо будущей тебе. Хорошее письмо.",
  "Дисциплина — это не про настроение. Настроения не было, а тренировка есть.",
  "Ты не обязана была сегодня. Но ты выбрала. Это разница.",
  "Форма меняется не на одной тренировке — а на том, что ты не бросила счёт.",
  "Сравни себя только с собой месяц назад. Разница уже есть.",
  "Это была не самая простая тренировка недели — и ты её закрыла.",
  "Пока ты сомневалась, стоит ли — тело уже работало. Красиво вышло.",
  "Пот высохнет, а результат останется.",
  "Ты не должна чувствовать себя великой каждый раз. Достаточно, что ты пришла.",
  "Пусть это будет ещё одна причина гордиться собой сегодня вечером.",
  "Настоящая сила — прийти, даже когда не хочется. Ты пришла.",
  "Каждая тренировка — вклад, который не сгорает.",
  "Это была не гонка с кем-то. Это была встреча с собой. Она состоялась.",
];

function pickFinishQuote(stats) {
  const dynamic = [];
  if (stats.total > 0) {
    if (stats.done === stats.total) {
      dynamic.push(`Сделано всё до единого — ${stats.done} из ${stats.total}. Сегодня ты выложилась полностью.`);
    } else if (stats.done > 0) {
      dynamic.push(`${stats.done} из ${stats.total} — не всё, но реально сделано, а не просто задумано.`);
    }
  }
  dynamic.push(`Тренировка «${stats.letter}» закрыта. Следующая по очереди будет другой — и это тоже часть плана.`);
  if (stats.streak >= 2) dynamic.push(`Это уже ${stats.streak}-й день подряд с активностью. Ты держишь ритм.`);

  const useDynamic = dynamic.length && Math.random() < 0.45;
  const pool = useDynamic ? dynamic : FINISH_QUOTES;
  return pool[Math.floor(Math.random() * pool.length)];
}

function showCelebration(stats) {
  const overlay = document.createElement("div");
  overlay.className = "celebrate-overlay";
  const emojis = ["✨", "🔥", "💪", "🌟", "🎉", "🩷"];
  let particles = "";
  for (let i = 0; i < 18; i++) {
    const emoji = emojis[Math.floor(Math.random() * emojis.length)];
    const left = Math.random() * 100;
    const delay = Math.random() * 0.3;
    const duration = 1.1 + Math.random() * 0.7;
    const size = 14 + Math.random() * 14;
    particles += `<span class="confetti-piece" style="left:${left}%; animation-delay:${delay}s; animation-duration:${duration}s; font-size:${size}px;">${emoji}</span>`;
  }
  const quote = pickFinishQuote(stats);
  overlay.innerHTML = `
    <div class="confetti-layer">${particles}</div>
    <div class="celebrate-card">
      <button type="button" class="celebrate-close" aria-label="Закрыть">×</button>
      <span class="celebrate-emoji">🎉</span>
      <p>${quote}</p>
    </div>
  `;
  document.body.appendChild(overlay);
  const close = () => {
    overlay.classList.add("fade-out");
    window.setTimeout(() => overlay.remove(), 400);
  };
  overlay.querySelector(".celebrate-close").addEventListener("click", close);
  const timer = window.setTimeout(close, 7000);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) { window.clearTimeout(timer); close(); }
  });
}

function logWeight(exerciseId, weight, reps) {
  if (!weight && !reps) return;
  const list = state.history[exerciseId] || [];
  const id = makeId();
  list.push({ id, date: new Date().toISOString(), weight: weight || "", reps: reps || "" });
  state.history[exerciseId] = list.slice(-20);
  saveJSON(STORAGE_HISTORY, state.history);
  state.draftWeightIds.push(id);
  saveJSON(STORAGE_DRAFT_WEIGHT_IDS, state.draftWeightIds);
  render();
}

function clearDraftWeightIds() {
  state.draftWeightIds = [];
  saveJSON(STORAGE_DRAFT_WEIGHT_IDS, state.draftWeightIds);
}

function lastLog(exerciseId) {
  const list = state.history[exerciseId];
  if (!list || !list.length) return null;
  return list[list.length - 1];
}

function copyName(text, btn) {
  const done = () => {
    btn.textContent = "✓";
    btn.classList.add("copied");
    window.setTimeout(() => { btn.textContent = "⧉"; btn.classList.remove("copied"); }, 1200);
  };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(done).catch(() => fallbackCopy(text, done));
  } else {
    fallbackCopy(text, done);
  }
}
function fallbackCopy(text, done) {
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.style.position = "fixed";
  ta.style.opacity = "0";
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand("copy"); done(); } catch (e) {}
  document.body.removeChild(ta);
}

// ---------- РЕЗЕРВНАЯ КОПИЯ (данные живут только в этом браузере) ----------
// Экспортируем не сырые строки localStorage (там всё было бы одной длинной
// экранированной строкой), а нормально распарсенные вложенные данные с понятными
// русскими названиями полей — файл можно открыть и прочитать самой.

const STORAGE_KEY_LABELS = {
  [STORAGE_MODE]: "режим_тренировки",
  [STORAGE_SESSION]: "текущая_тренировка",
  [STORAGE_STATUS]: "отметки_упражнений",
  [STORAGE_HISTORY]: "история_весов_и_повторов",
  [STORAGE_LOG]: "журнал_завершённых_тренировок",
  [STORAGE_VIBE]: "текущий_вайб",
  [STORAGE_CALENDAR]: "календарь",
  [STORAGE_MANUAL_ACTIVITIES]: "ручные_активности_календаря",
  [STORAGE_DRAFT_WEIGHT_IDS]: "черновые_записи_весов",
  [STORAGE_UNDO]: "последняя_отмена",
  "moya-sila-rotation-v1": "очередь_A_B_C",
  "moya-sila-last-by-letter-v1": "что_было_в_прошлый_раз",
  "moya-sila-last-by-family-v1": "что_было_в_прошлый_раз_по_формату",
};
const REVERSE_KEY_LABELS = Object.fromEntries(Object.entries(STORAGE_KEY_LABELS).map(([k, v]) => [v, k]));

function exportBackup() {
  const readableData = {};
  ALL_STORAGE_KEYS.forEach((k) => {
    const raw = localStorage.getItem(k);
    if (raw === null) return;
    const label = STORAGE_KEY_LABELS[k] || k;
    try {
      readableData[label] = JSON.parse(raw);
    } catch (e) {
      readableData[label] = raw;
    }
  });
  const dump = {
    приложение: "Моя сила",
    дата_бэкапа: new Date().toISOString(),
    тренировок_в_журнале: state.log.length,
    отмеченных_дней_в_календаре: Object.keys(state.calendar).length,
    данные: readableData,
  };
  const blob = new Blob([JSON.stringify(dump, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `moya-sila-backup-${dateKey(new Date())}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function importBackupFile(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const dump = JSON.parse(reader.result);
      const readableData = dump && dump.данные ? dump.данные : dump; // подстраховка на случай другого формата файла
      let restored = 0;
      Object.entries(readableData).forEach(([label, value]) => {
        const key = REVERSE_KEY_LABELS[label] || (ALL_STORAGE_KEYS.includes(label) ? label : null);
        if (!key) return;
        localStorage.setItem(key, JSON.stringify(value));
        restored += 1;
      });
      if (!restored) throw new Error("empty");
      window.alert(`Бэкап загружен: восстановлено записей — ${restored}. Сейчас страница обновится.`);
      window.location.reload();
    } catch (e) {
      window.alert("Не получилось прочитать файл бэкапа — похоже, это не тот файл или он повреждён.");
    }
  };
  reader.readAsText(file);
}

// ---------- ТАЙМЕР (только для timed-упражнений) ----------

function startTimer(key) {
  if (state.timer.key !== key) state.timer = { key, seconds: 0, running: false, interval: null };
  state.timer.running = !state.timer.running;
  if (state.timer.running) {
    state.timer.interval = window.setInterval(() => {
      state.timer.seconds += 1;
      renderTimerDisplay();
    }, 1000);
  } else {
    window.clearInterval(state.timer.interval);
  }
  renderTimerDisplay();
}
function stopTimer() {
  window.clearInterval(state.timer.interval);
  state.timer = { key: null, seconds: 0, running: false, interval: null };
}
function renderTimerDisplay() {
  const el = document.querySelector(`[data-timer-key="${state.timer.key}"]`);
  if (!el) return;
  const mins = String(Math.floor(state.timer.seconds / 60)).padStart(2, "0");
  const secs = String(state.timer.seconds % 60).padStart(2, "0");
  el.querySelector(".timer-value").textContent = `${mins}:${secs}`;
  el.querySelector(".timer-toggle").textContent = state.timer.running ? "Стоп" : (state.timer.seconds > 0 ? "Дальше" : "Старт");
}

// ---------- РЕНДЕР ----------

function el(html) {
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

function formatDate() {
  const now = new Date();
  return `${WEEKDAYS_RU[now.getDay()]} · ${now.getDate()} ${MONTHS_RU[now.getMonth()]}`;
}

function renderTop() {
  document.body.classList.remove("day-A", "day-B", "day-C", "day-LOWER", "day-UPPER", "day-MOBILITY", "day-FULL_BODY");
  document.body.classList.add(`day-${state.session.family || state.session.letter}`);
  document.getElementById("hero-date").textContent = formatDate();
  document.getElementById("hero-letter").textContent = state.session.family === "FULL_BODY" ? "ВСЁ" : state.session.family === "MOBILITY" ? "MOB" : state.session.family || state.session.letter;
  document.getElementById("hero-focus").textContent = state.session.label;
  document.getElementById("hero-sub").textContent = `${MODE_LABEL[state.session.mode]} · вайб «${VIBE_LABEL[state.session.vibe]}»`;
  const pct = progressPercent();
  document.getElementById("progress-fill").style.width = `${pct}%`;
  document.getElementById("progress-value").textContent = `${pct}%`;
}

function renderHome() {
  const recommendation = MoyaSilaTrainingState.getRecommendation(state.log);
  const recommendationEl = document.getElementById("home-recommendation");
  if (recommendationEl) recommendationEl.textContent = recommendation.text;
  const today = document.getElementById("home-today");
  if (today) today.textContent = formatDate();
  const grid = document.getElementById("family-grid");
  if (grid) {
    const cards = [
      ["LOWER", "Нижняя часть", "ягодицы, ноги и опора"],
      ["UPPER", "Верхняя часть", "руки, плечи и осанка"],
      ["MOBILITY", "Мобильность и восстановление", "короткий комплекс для всего тела"],
      ["FULL_BODY", "Общее тело", "вернуться после паузы или собрать всё"],
    ];
    grid.innerHTML = "";
    cards.forEach(([family, title, desc]) => {
      const card = el(`<button type="button" class="family-card family-${family.toLowerCase()}"><span>${family === "MOBILITY" ? "◌" : family === "FULL_BODY" ? "✦" : family === "LOWER" ? "⌄" : "⌃"}</span><strong>${title}</strong><small>${desc}</small><i>Открыть →</i></button>`);
      card.addEventListener("click", () => startFamilySession(family));
      grid.appendChild(card);
    });
  }
  const stats = MoyaSilaTrainingState.getMonthStats(state.log, state.manualActivities);
  const statsEl = document.getElementById("home-stats");
  if (statsEl) statsEl.innerHTML = `<div><strong>${stats.strength}</strong><span>силовых за месяц</span></div><div><strong>${stats.mobility}</strong><span>мобильности</span></div><div><strong>${stats.other}</strong><span>другой активности</span></div>`;
}

function renderModePicker() {
  const wrap = document.getElementById("mode-picker");
  wrap.innerHTML = "";
  ["EXPRESS", "NORMAL", "FULL"].forEach((mode) => {
    const btn = el(`<button type="button" class="${mode === state.mode ? "selected" : ""}">${MODE_LABEL[mode].split(" ")[0]}</button>`);
    btn.addEventListener("click", () => changeMode(mode));
    wrap.appendChild(btn);
  });
}

function renderVibePicker() {
  const wrap = document.getElementById("vibe-picker");
  wrap.innerHTML = "";
  VIBES.forEach((v) => {
    const btn = el(`<button type="button" class="${v === state.vibe ? "selected" : ""}">${VIBE_LABEL[v]}</button>`);
    btn.title = VIBE_HINT[v];
    btn.addEventListener("click", () => changeVibe(v));
    wrap.appendChild(btn);
  });
  const hint = document.getElementById("vibe-hint");
  if (hint) hint.textContent = VIBE_HINT[state.vibe];
}

function regenerateForOptions() {
  state.session = generateSession(state.session.family || state.session.letter, state.mode, state.vibe, state.accents, state.zone);
  saveJSON(STORAGE_SESSION, state.session);
  state.status = {};
  saveJSON(STORAGE_STATUS, state.status);
  render();
}

function renderAccentPicker() {
  const wrap = document.getElementById("accent-picker");
  if (!wrap) return;
  wrap.innerHTML = "";
  [["mobility", "+ Мобильность"], ["calisthenics", "+ Калистеника"]].forEach(([name, label]) => {
    const button = el(`<button type="button" class="${state.accents[name] ? "selected" : ""}">${label}</button>`);
    button.addEventListener("click", () => {
      state.accents = MoyaSilaTrainingState.toggleAccent(state.accents, name);
      saveJSON(STORAGE_ACCENTS, state.accents);
      regenerateForOptions();
    });
    wrap.appendChild(button);
  });
}

function renderZonePicker() {
  const wrap = document.getElementById("zone-picker");
  if (!wrap) return;
  const labels = { any: "Любая зона", dumbbells: "Гантели", landmine: "Штанга / landmine", cable: "Кабель", machines: "Тренажёры", bodyweight: "Резинка / вес тела", floor: "Коврик / роллер" };
  wrap.innerHTML = "";
  Object.entries(labels).forEach(([zone, label]) => {
    const button = el(`<button type="button" class="${zone === state.zone ? "selected" : ""}">${label}</button>`);
    button.addEventListener("click", () => { state.zone = zone; saveJSON(STORAGE_ZONE, zone); regenerateForOptions(); });
    wrap.appendChild(button);
  });
}

function toggleRirInfo() {
  const box = document.getElementById("rir-info");
  box.classList.toggle("hidden");
  localStorage.setItem(STORAGE_RIR_SEEN, "1");
}

function exerciseCard(block, row, index) {
  const exercise = EXERCISES[row.id];
  const key = slotKey(block.group, index);
  const status = state.status[key];
  const isExpanded = state.expanded === key;
  const isSwapOpen = state.swapOpenKey === key;
  const isPrepSlot = block.group === "warmup" || block.group === "cooldown";
  const accentMap = { warmup: "warmup", core: "core", cooldown: "cooldown", rotation: "rotation", mobilityAccent: "cooldown", calisthenics: "rotation", anchors: "main" };
  const accentClass = accentMap[block.group] || "main";
  const wasSwapped = row.originalId && row.originalId !== row.id;

  const card = el(`
    <article class="ex-card ${status || ""} ${row.optional ? "optional" : ""}">
      <div class="ex-row">
        <div class="ex-status">
          <button class="ex-check" title="Сделано" aria-label="Отметить упражнение как сделанное">${status === "done" ? "✓" : ""}</button>
          <button class="ex-skip" title="Пропустить" aria-label="Пропустить упражнение">${status === "skipped" ? "×" : ""}</button>
        </div>
        <button class="ex-main" aria-label="Открыть детали упражнения ${exercise.nameEn}">
          <div class="ex-name-row">
            <span class="ex-name-en">${exercise.nameEn}</span>
            ${row.explore ? '<span class="ex-badge ex-badge-explore">новое</span>' : ""}
            ${wasSwapped ? '<span class="ex-badge ex-badge-swapped">заменено</span>' : ""}
          </div>
          <div class="ex-meta">${exercise.prescription || row.slotTitle}${renderEquipmentBadge(exercise.equipment)}</div>
        </button>
        <button class="ex-copy" title="Скопировать название" aria-label="Скопировать название упражнения">⧉</button>
        <button class="ex-cycle" title="Быстро заменить на следующий вариант" aria-label="Быстро заменить упражнение">⟳</button>
      </div>
    </article>
  `);

  card.querySelector(".ex-check").addEventListener("click", () => setStatus(key, "done"));
  card.querySelector(".ex-skip").addEventListener("click", () => setStatus(key, "skipped"));
  card.querySelector(".ex-main").addEventListener("click", () => toggleExpand(key));
  card.querySelector(".ex-copy").addEventListener("click", (e) => copyName(exercise.nameEn, e.currentTarget));
  card.querySelector(".ex-cycle").addEventListener("click", () => quickSwap(block.group, index));

  if (isExpanded) {
    const last = lastLog(exercise.id);
    const timerHtml = exercise.timed
      ? `<div class="ex-timer" data-timer-key="${key}">
          <button type="button" class="timer-toggle">${state.timer.key === key && state.timer.running ? "Стоп" : "Старт"}</button>
          <strong class="timer-value">${state.timer.key === key ? formatSeconds(state.timer.seconds) : "00:00"}</strong>
        </div>`
      : "";
    const detail = el(`
      <div class="ex-detail">
        <div class="ex-detail-grid">
          <div class="ex-pose">${renderPoseIcon(exercise.pose, accentClass)}</div>
          <div>
            <p class="ex-muscle">🎯 Работает: <strong>${GROUP_LABELS[exercise.tag] || exercise.tag}</strong></p>
            <p class="ex-cue">${exercise.cue}</p>
            <p class="ex-weight-guide">${row.weightGuide || "Вес: выбери тот, с которым техника остаётся чистой."}</p>
            ${last ? `<p class="ex-last">Прошлый раз: <strong>${last.weight ? last.weight + " кг" : ""}${last.weight && last.reps ? " × " : ""}${last.reps || ""}</strong> — подставила ниже, можно просто подтвердить или поправить</p>` : ""}
            <div class="ex-log">
              <input type="text" inputmode="decimal" placeholder="кг" class="log-weight" value="${last && last.weight ? last.weight : ""}" />
              <input type="text" inputmode="numeric" placeholder="повторы" class="log-reps" value="${last && last.reps ? last.reps : ""}" />
              <button type="button" class="log-save">Записать</button>
            </div>
            ${timerHtml}
            <button type="button" class="swap-link">${isSwapOpen ? "Скрыть замену ↑" : "Заменить упражнение →"}</button>
          </div>
        </div>
        <div class="swap-chips ${isSwapOpen ? "" : "hidden"}"></div>
      </div>
    `);
    detail.querySelector(".log-save").addEventListener("click", () => {
      const w = detail.querySelector(".log-weight").value.trim();
      const r = detail.querySelector(".log-reps").value.trim();
      logWeight(exercise.id, w, r);
    });
    if (exercise.timed) {
      detail.querySelector(".timer-toggle").addEventListener("click", () => startTimer(key));
    }
    detail.querySelector(".swap-link").addEventListener("click", () => toggleSwap(key));

    if (isSwapOpen) {
      const chipsWrap = detail.querySelector(".swap-chips");
      const options = getSwapOptions(row.id, row.originalId, isPrepSlot, state.blockZones[block.group] || "any");
      options.forEach((opt) => {
        const isCurrent = opt.id === row.id;
        const isOriginal = opt.id === row.originalId && row.originalId !== row.id;
        const chip = el(`<button type="button" class="swap-chip ${isCurrent ? "current" : ""}">${renderEquipmentBadge(opt.equipment)} ${opt.nameEn}${isOriginal ? " ↺" : ""}</button>`);
        chip.addEventListener("click", () => applySwap(block.group, index, opt.id));
        chipsWrap.appendChild(chip);
      });
      if (options.length <= 1) {
        chipsWrap.appendChild(el(`<p class="swap-empty">Для этого слота в библиотеке пока нет других вариантов.</p>`));
      }
    }
    card.appendChild(detail);
  }

  return card;
}

function formatSeconds(total) {
  const mins = String(Math.floor(total / 60)).padStart(2, "0");
  const secs = String(total % 60).padStart(2, "0");
  return `${mins}:${secs}`;
}

function quickChecklistCard(block, row, index) {
  const exercise = EXERCISES[row.id];
  const key = slotKey(block.group, index);
  const done = state.status[key] === "done";
  const card = el(`<button type="button" class="quick-check ${done ? "done" : ""}"><span>${done ? "✓" : ""}</span><strong>${exercise.nameEn}</strong><i>⧉</i></button>`);
  card.addEventListener("click", () => setStatus(key, "done"));
  card.querySelector("i").addEventListener("click", (event) => { event.stopPropagation(); copyName(exercise.nameEn, event.currentTarget); });
  return card;
}

function renderBlocks() {
  const wrap = document.getElementById("blocks");
  wrap.innerHTML = "";
  BLOCKS.forEach((block) => {
    const rows = state.session[block.group] || [];
    if (!rows.length) return;
    const section = el(`
      <section class="block ${block.cls}">
        <div class="block-head"><span class="block-dot"></span><strong>${block.title}</strong><span>${rows.length} шт</span></div>
        <div class="block-list"></div>
      </section>
    `);
    const list = section.querySelector(".block-list");
    if (["warmup", "cooldown", "mobilityAccent"].includes(block.group)) {
      section.querySelector(".block-head").insertAdjacentHTML("beforeend", `<small>Отметь то, что сделала</small>`);
      rows.forEach((row, i) => list.appendChild(quickChecklistCard(block, row, i)));
    } else {
      if (["anchors", "rotation", "core", "calisthenics"].includes(block.group)) {
        const select = el(`<select class="block-zone" aria-label="Зона для замен в блоке"><option value="any">Любая зона</option><option value="dumbbells">Гантели</option><option value="landmine">Штанга / landmine</option><option value="cable">Кабель</option><option value="machines">Тренажёры</option><option value="bodyweight">Резинка / вес тела</option><option value="floor">Коврик / роллер</option></select>`);
        select.value = state.blockZones[block.group] || "any";
        select.addEventListener("change", () => { state.blockZones[block.group] = select.value; });
        section.querySelector(".block-head").appendChild(select);
      }
      if (rows.some((row) => row.format === "circuit")) {
        section.querySelector(".block-head").insertAdjacentHTML("afterend", `<p class="circuit-help">Круг: подряд → отдых → повторить 2–3 раза</p>`);
      }
      rows.forEach((row, i) => list.appendChild(exerciseCard(block, row, i)));
    }
    wrap.appendChild(section);
  });
}

function renderUndoBanner() {
  const wrap = document.getElementById("undo-banner");
  if (!wrap) return;
  if (!state.lastUndo) {
    wrap.classList.add("hidden");
    wrap.innerHTML = "";
    return;
  }
  wrap.classList.remove("hidden");
  wrap.innerHTML = `
    <span>Тренировка «${state.lastUndo.session.letter}» отмечена завершённой.</span>
    <div class="undo-actions">
      <button type="button" class="undo-btn">Отменить, вернуться →</button>
      <button type="button" class="undo-dismiss" aria-label="Скрыть">×</button>
    </div>
  `;
  wrap.querySelector(".undo-btn").addEventListener("click", undoLastFinish);
  wrap.querySelector(".undo-dismiss").addEventListener("click", dismissUndo);
}

function renderHistory() {
  const wrap = document.getElementById("history-list");
  if (!wrap) return;
  wrap.innerHTML = "";
  const recent = state.log.slice().reverse();
  if (!recent.length) {
    wrap.appendChild(el(`<p class="history-empty">Пока пусто — заверши первую тренировку.</p>`));
    return;
  }
  recent.forEach((entry) => {
    const d = new Date(entry.date);
    const item = el(`
      <div class="history-item">
        <div class="h-row">
          <button type="button" class="h-info">
            <span class="h-letter">${entry.letter}</span> · ${entry.label}<br />
            <span class="h-sub">${d.getDate()} ${MONTHS_RU_FULL[d.getMonth()]} · ${entry.done}/${entry.total}${entry.skipped ? ", пропущено " + entry.skipped : ""} · открыть отчёт →</span>
          </button>
          <button type="button" class="h-delete" title="Удалить запись">🗑</button>
        </div>
        <label class="h-date-label">Дата <input type="date" value="${dateKey(d)}" max="${dateKey(new Date())}" /></label>
        <textarea class="h-note-input" placeholder="Добавить заметку…">${entry.note || ""}</textarea>
      </div>
    `);
    item.querySelector(".h-info").addEventListener("click", () => openReport(entry.id));
    item.querySelector(".h-delete").addEventListener("click", () => deleteHistoryEntry(entry.id));
    const noteInput = item.querySelector(".h-note-input");
    noteInput.addEventListener("change", () => updateHistoryNote(entry.id, noteInput.value.trim()));
    noteInput.addEventListener("blur", () => updateHistoryNote(entry.id, noteInput.value.trim()));
    item.querySelector(".h-date-label input").addEventListener("change", (event) => updateHistoryDate(entry.id, event.target.value));
    wrap.appendChild(item);
  });
}

function renderAnalytics() {
  const wrap = document.getElementById("analytics-grid");
  if (!wrap) return;
  const now = new Date();
  const weekAgo = new Date(now); weekAgo.setDate(weekAgo.getDate() - 7);
  const monthAgo = new Date(now); monthAgo.setDate(monthAgo.getDate() - 30);
  const total = state.log.length;
  const thisWeek = state.log.filter((e) => new Date(e.date) >= weekAgo).length;
  const thisMonth = state.log.filter((e) => new Date(e.date) >= monthAgo).length;
  const streak = calculateStreak();
  const perFamily = { LOWER: 0, UPPER: 0, MOBILITY: 0, FULL_BODY: 0 };
  state.log.forEach((e) => { const family = MoyaSilaTrainingState.normalizeFamily(e.family || e.letter); if (perFamily[family] !== undefined) perFamily[family] += 1; });

  wrap.innerHTML = `
    <div class="an-tile"><strong>${total}</strong><span>тренировок всего</span></div>
    <div class="an-tile"><strong>${thisWeek}</strong><span>за 7 дней</span></div>
    <div class="an-tile"><strong>${thisMonth}</strong><span>за 30 дней</span></div>
    <div class="an-tile"><strong>${streak}</strong><span>дней подряд с активностью</span></div>
    <div class="an-tile an-balance">
      <span class="an-balance-label">Баланс по форматам</span>
      <div class="an-balance-bars">
        <span class="an-bar"><i style="width:${total ? (perFamily.LOWER/total*100) : 0}%"></i>Низ · ${perFamily.LOWER}</span>
        <span class="an-bar an-bar-b"><i style="width:${total ? (perFamily.UPPER/total*100) : 0}%"></i>Верх · ${perFamily.UPPER}</span>
        <span class="an-bar an-bar-c"><i style="width:${total ? ((perFamily.MOBILITY + perFamily.FULL_BODY)/total*100) : 0}%"></i>Мобильность / всё тело · ${perFamily.MOBILITY + perFamily.FULL_BODY}</span>
      </div>
    </div>
  `;
}

function renderReportView() {
  const wrap = document.getElementById("report-content");
  if (!wrap) return;
  const entry = state.log.find((e) => e.id === state.reportId);
  if (!entry) {
    wrap.innerHTML = `<p class="history-empty">Запись не найдена — возможно, её удалили.</p>`;
    return;
  }
  const d = new Date(entry.date);
  const exercisesHtml = (entry.exercises || [])
    .map((ex) => {
      const statusIcon = ex.status === "done" ? "✓" : ex.status === "skipped" ? "×" : "—";
      const statusCls = ex.status === "done" ? "done" : ex.status === "skipped" ? "skipped" : "";
      const weightText = ex.weight || ex.reps ? `${ex.weight ? ex.weight + " кг" : ""}${ex.weight && ex.reps ? " × " : ""}${ex.reps || ""}` : "";
      return `
        <div class="report-ex ${statusCls}">
          <span class="report-ex-status">${statusIcon}</span>
          <span class="report-ex-name">${ex.name}<small>${ex.slotTitle}</small></span>
          ${weightText ? `<span class="report-ex-weight">${weightText}</span>` : ""}
        </div>
      `;
    })
    .join("");

  wrap.innerHTML = `
    <div class="report-head">
      <span class="hero-letter" style="background:var(--day-accent-bg); color:var(--day-accent);">${entry.letter}</span>
      <h2>${entry.label}</h2>
      <p class="report-meta">${d.getDate()} ${MONTHS_RU_FULL[d.getMonth()]} ${d.getFullYear()} · ${MODE_LABEL[entry.mode] || entry.mode} · вайб «${VIBE_LABEL[entry.vibe] || entry.vibe}»</p>
      <div class="report-stats">
        <div><strong>${entry.done}</strong><span>сделано</span></div>
        <div><strong>${entry.skipped}</strong><span>пропущено</span></div>
        <div><strong>${entry.total}</strong><span>всего</span></div>
      </div>
    </div>
    ${entry.note ? `<p class="report-note">📝 ${entry.note}</p>` : ""}
    <div class="report-exercises">${exercisesHtml || '<p class="history-empty">Список упражнений не сохранён для этой записи.</p>'}</div>
    <button type="button" class="report-delete" id="report-delete-btn">Удалить эту запись</button>
  `;
  const delBtn = wrap.querySelector("#report-delete-btn");
  if (delBtn) delBtn.addEventListener("click", () => { deleteHistoryEntry(entry.id); showView("history"); });
}

function calendarLabel(entry) {
  if (!entry) return "";
  if (entry.type === "session") return entry.label || `Тренировка ${entry.letter}`;
  if (entry.type === "run") return "Бег";
  if (entry.type === "walk") return "Прогулка";
  if (entry.type === "stretch") return "Растяжка";
  if (entry.type === "mobility") return "Мобильность";
  if (entry.type === "gym") return `Зал · ${{ LOWER: "Низ", UPPER: "Верх", MOBILITY: "Мобильность", FULL_BODY: "Всё тело", unknown: "не помню" }[entry.family] || "не помню"}`;
  if (entry.type === "cardio") return "Кардио / плавание";
  if (entry.type === "other") return "Другая активность";
  if (entry.type === "rest") return "Отдых";
  return "";
}

function changeCalendarMonth(delta) {
  let { year, month } = state.calendarMonth;
  month += delta;
  if (month < 0) { month = 11; year -= 1; }
  if (month > 11) { month = 0; year += 1; }
  state.calendarMonth = { year, month };
  state.calendarOpenDay = null;
  render();
}

const WEEKDAY_HEADERS = ["ПН", "ВТ", "СР", "ЧТ", "ПТ", "СБ", "ВС"];

function renderCalendar() {
  const wrap = document.getElementById("calendar-grid");
  if (!wrap) return;
  wrap.innerHTML = "";

  const { year, month } = state.calendarMonth;
  const label = document.getElementById("calendar-month-label");
  if (label) label.textContent = `${MONTHS_RU_NOM[month]} ${year}`;
  const nextBtn = document.getElementById("calendar-next");
  if (nextBtn) {
    const now = new Date();
    nextBtn.disabled = year === now.getFullYear() && month === now.getMonth();
  }

  WEEKDAY_HEADERS.forEach((wd) => wrap.appendChild(el(`<span class="cal-weekday">${wd}</span>`)));

  const firstOfMonth = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const leadingBlanks = (firstOfMonth.getDay() + 6) % 7; // неделя с понедельника
  const todayKey = dateKey(new Date());

  for (let i = 0; i < leadingBlanks; i++) wrap.appendChild(el(`<span class="cal-blank"></span>`));

  for (let day = 1; day <= daysInMonth; day++) {
    const d = new Date(year, month, day);
    const key = dateKey(d);
    const entry = getCalendarEntry(key);
    const isFuture = d > new Date();
    let cls = "cal-day";
    if (entry) cls += ` cal-${entry.type}${entry.type === "session" ? " cal-letter-" + entry.letter : ""}`;
    if (key === todayKey) cls += " cal-today";
    if (state.calendarOpenDay === key) cls += " cal-open";
    if (isFuture) cls += " cal-future";
    const cell = el(`<button type="button" class="${cls}" ${isFuture ? "disabled" : ""}><span>${day}</span></button>`);
    cell.title = `${day} ${MONTHS_RU[month]}${entry ? " — " + calendarLabel(entry) : ""}`;
    if (!isFuture) {
      cell.addEventListener("click", () => {
        state.calendarOpenDay = state.calendarOpenDay === key ? null : key;
        render();
      });
    }
    wrap.appendChild(cell);
  }

  const chooser = document.getElementById("calendar-chooser");
  if (!chooser) return;
  if (!state.calendarOpenDay) {
    chooser.classList.add("hidden");
    chooser.innerHTML = "";
    return;
  }
  chooser.classList.remove("hidden");
  const k = state.calendarOpenDay;
  const entry = getCalendarEntry(k);
  chooser.innerHTML = `<span class="cal-chooser-date">${k}</span>`;
  if (entry && entry.type === "session") chooser.appendChild(el(`<span class="cal-chooser-note">${calendarLabel(entry)} — дата меняется в архиве тренировок</span>`));
  const editBtn = el(`<button type="button">${state.manualActivities[k] ? "Изменить активность" : "Отметить активность"}</button>`);
  editBtn.addEventListener("click", () => openActivityEditor(k));
  chooser.appendChild(editBtn);
}

function render() {
  renderTop();
  renderHome();
  renderModePicker();
  renderVibePicker();
  renderAccentPicker();
  renderZonePicker();
  renderUndoBanner();
  renderBlocks();
  renderCalendar();
  renderHistory();
  renderAnalytics();
  renderReportView();
}

function initFinishButton() {
  document.getElementById("finish-session-btn").addEventListener("click", finishSession);
}

function initExtras() {
  const rirToggle = document.getElementById("rir-toggle");
  if (rirToggle) rirToggle.addEventListener("click", toggleRirInfo);

  const exportBtn = document.getElementById("export-backup-btn");
  if (exportBtn) exportBtn.addEventListener("click", exportBackup);

  const importInput = document.getElementById("import-backup-input");
  if (importInput) {
    importInput.addEventListener("change", (e) => {
      const file = e.target.files && e.target.files[0];
      if (file) importBackupFile(file);
    });
  }

  const prevMonthBtn = document.getElementById("calendar-prev");
  if (prevMonthBtn) prevMonthBtn.addEventListener("click", () => changeCalendarMonth(-1));
  const nextMonthBtn = document.getElementById("calendar-next");
  if (nextMonthBtn) nextMonthBtn.addEventListener("click", () => changeCalendarMonth(1));

  const navHistoryBtn = document.getElementById("nav-history-btn");
  if (navHistoryBtn) navHistoryBtn.addEventListener("click", () => showView("history"));
  const navHomeBtn = document.getElementById("nav-home-btn");
  if (navHomeBtn) navHomeBtn.addEventListener("click", () => showView("home"));
  const homeActivityBtn = document.getElementById("home-activity-btn");
  if (homeActivityBtn) homeActivityBtn.addEventListener("click", () => openActivityEditor());
  const activityCloseBtn = document.getElementById("activity-close-btn");
  if (activityCloseBtn) activityCloseBtn.addEventListener("click", closeActivityEditor);
  const activitySaveBtn = document.getElementById("activity-save-btn");
  if (activitySaveBtn) activitySaveBtn.addEventListener("click", saveActivityEditor);
  const activityDeleteBtn = document.getElementById("activity-delete-btn");
  if (activityDeleteBtn) activityDeleteBtn.addEventListener("click", deleteActivityEditor);
  const backToWorkoutBtn = document.getElementById("back-to-workout-btn");
  if (backToWorkoutBtn) backToWorkoutBtn.addEventListener("click", () => showView("home"));
  const backToHistoryBtn = document.getElementById("back-to-history-btn");
  if (backToHistoryBtn) backToHistoryBtn.addEventListener("click", () => showView("history"));
}

function initSplash() {
  const splash = document.getElementById("splash");
  const dateEl = document.getElementById("splash-date");
  const nextEl = document.getElementById("splash-next");
  const startBtn = document.getElementById("splash-start");
  if (!splash) return;

  if (dateEl) dateEl.textContent = formatDate();
  if (nextEl) {
    nextEl.innerHTML = `Сегодня можно выбрать: <strong>низ, верх, мобильность или всё тело</strong>`;
  }
  if (startBtn) {
    startBtn.addEventListener("click", () => {
      splash.classList.add("splash-hidden");
      document.body.classList.remove("splash-open");
      showView("home");
    });
  }
}

// Плавно скрывает текущий вид, применяет изменения, затем плавно показывает новый.
function withTransition(mutateFn) {
  const targets = [document.querySelector(".hero"), document.getElementById("blocks")].filter(Boolean);
  if (!targets.length) { mutateFn(); return; }
  targets.forEach((el) => el.classList.add("view-fade"));
  window.setTimeout(() => {
    mutateFn();
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        targets.forEach((el) => el.classList.remove("view-fade"));
      });
    });
  }, 220);
}

document.addEventListener("DOMContentLoaded", () => {
  const sessionDate = document.getElementById("session-date");
  if (sessionDate) sessionDate.value = dateKey(new Date());
  render();
  initFinishButton();
  initExtras();
  initSplash();
});
