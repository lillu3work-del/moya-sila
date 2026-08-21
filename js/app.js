/* Логика: генерация тренировки, мгновенная замена, вес/история, финиш дня. */

const STORAGE_MODE = "moya-sila-mode-v1";
const STORAGE_SESSION = "moya-sila-current-session-v2";
const STORAGE_STATUS = "moya-sila-status-v1";
const STORAGE_HISTORY = "moya-sila-history-v1";
const STORAGE_LOG = "moya-sila-log-v2";
const STORAGE_VIBE = "moya-sila-vibe-v1";
const STORAGE_CALENDAR = "moya-sila-calendar-v1";
const STORAGE_RIR_SEEN = "moya-sila-rir-seen-v1";

const ALL_STORAGE_KEYS = [STORAGE_MODE, STORAGE_SESSION, STORAGE_STATUS, STORAGE_HISTORY, STORAGE_LOG, STORAGE_VIBE, STORAGE_CALENDAR, "moya-sila-rotation-v1", "moya-sila-last-by-letter-v1"];

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
  expanded: null,
  swapOpenKey: null,
  calendarOpenDay: null,
  calendarMonth: { year: new Date().getFullYear(), month: new Date().getMonth() },
  timer: { key: null, seconds: 0, running: false, interval: null },
};
if (!state.session) {
  state.session = generateSession(rotation.next, state.mode, state.vibe);
  saveJSON(STORAGE_SESSION, state.session);
}
if (typeof localStorage.getItem(STORAGE_MODE) !== "string") saveJSON(STORAGE_MODE, state.mode);

const BLOCKS = [
  { group: "warmup", title: "Разминка", cls: "block-warmup" },
  { group: "anchors", title: "Основные", cls: "block-main" },
  { group: "rotation", title: "Ротация / любимое", cls: "block-rotation" },
  { group: "fun", title: "Фан / челлендж", cls: "block-fun" },
  { group: "core", title: "Кор", cls: "block-core" },
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

function changeMode(mode) {
  state.mode = mode;
  saveJSON(STORAGE_MODE, mode);
  state.session = generateSession(state.session.letter, mode, state.vibe);
  saveJSON(STORAGE_SESSION, state.session);
  state.status = {};
  saveJSON(STORAGE_STATUS, state.status);
  state.expanded = null;
  state.swapOpenKey = null;
  render();
}

function switchDay(letter) {
  state.session = generateSession(letter, state.mode, state.vibe);
  saveJSON(STORAGE_SESSION, state.session);
  state.status = {};
  saveJSON(STORAGE_STATUS, state.status);
  state.expanded = null;
  state.swapOpenKey = null;
  render();
}

function changeVibe(vibe) {
  state.vibe = vibe;
  saveVibeState({ current: vibe });
  state.session = generateSession(state.session.letter, state.mode, vibe);
  saveJSON(STORAGE_SESSION, state.session);
  state.status = {};
  saveJSON(STORAGE_STATUS, state.status);
  state.expanded = null;
  state.swapOpenKey = null;
  render();
}

function setCalendarDay(key, type) {
  if (type === null) delete state.calendar[key];
  else state.calendar[key] = { type };
  saveJSON(STORAGE_CALENDAR, state.calendar);
  state.calendarOpenDay = null;
  render();
}

function finishSession() {
  const rows = allTrackableRows();
  const doneCount = rows.filter((r) => state.status[slotKey(r.group, r.index)] === "done").length;
  const skippedCount = rows.filter((r) => state.status[slotKey(r.group, r.index)] === "skipped").length;
  const note = (document.getElementById("session-note").value || "").trim();

  state.log.push({
    date: new Date().toISOString(),
    letter: state.session.letter,
    label: state.session.label,
    mode: state.session.mode,
    vibe: state.session.vibe,
    total: rows.length,
    done: doneCount,
    skipped: skippedCount,
    note,
  });
  saveJSON(STORAGE_LOG, state.log);

  state.calendar[dateKey(new Date())] = { type: "session", letter: state.session.letter };
  saveJSON(STORAGE_CALENDAR, state.calendar);

  rotation.history.push(state.session.letter);
  rotation.next = nextLetterAfter(state.session.letter);
  saveRotationState(rotation);

  state.vibe = nextVibeAfter(state.vibe);
  saveVibeState({ current: state.vibe });

  state.session = generateSession(rotation.next, state.mode, state.vibe);
  saveJSON(STORAGE_SESSION, state.session);
  state.status = {};
  saveJSON(STORAGE_STATUS, state.status);
  state.expanded = null;
  state.swapOpenKey = null;
  document.getElementById("session-note").value = "";
  render();
  window.scrollTo({ top: 0, behavior: "smooth" });
  showCelebration();
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
];

function showCelebration() {
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
  const quote = FINISH_QUOTES[Math.floor(Math.random() * FINISH_QUOTES.length)];
  overlay.innerHTML = `
    <div class="confetti-layer">${particles}</div>
    <div class="celebrate-card">
      <span class="celebrate-emoji">🎉</span>
      <p>${quote}</p>
    </div>
  `;
  document.body.appendChild(overlay);
  overlay.addEventListener("click", () => overlay.remove());
  window.setTimeout(() => {
    overlay.classList.add("fade-out");
    window.setTimeout(() => overlay.remove(), 400);
  }, 2600);
}

function logWeight(exerciseId, weight, reps) {
  if (!weight && !reps) return;
  const list = state.history[exerciseId] || [];
  list.push({ date: new Date().toISOString(), weight: weight || "", reps: reps || "" });
  state.history[exerciseId] = list.slice(-20);
  saveJSON(STORAGE_HISTORY, state.history);
  render();
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
  "moya-sila-rotation-v1": "очередь_A_B_C",
  "moya-sila-last-by-letter-v1": "что_было_в_прошлый_раз",
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
  document.getElementById("hero-date").textContent = formatDate();
  document.getElementById("hero-letter").textContent = state.session.letter;
  document.getElementById("hero-focus").textContent = state.session.label;
  document.getElementById("hero-sub").textContent = `${MODE_LABEL[state.session.mode]} · вайб «${VIBE_LABEL[state.session.vibe]}»`;
  const pct = progressPercent();
  document.getElementById("progress-fill").style.width = `${pct}%`;
  document.getElementById("progress-value").textContent = `${pct}%`;
}

function renderDaySwitcher() {
  const wrap = document.getElementById("day-switcher");
  wrap.innerHTML = "";
  ["A", "B", "C"].forEach((letter) => {
    const btn = el(`<button type="button" class="${letter === state.session.letter ? "active" : ""}">${letter}</button>`);
    btn.addEventListener("click", () => switchDay(letter));
    wrap.appendChild(btn);
  });
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
  const accentMap = { warmup: "warmup", core: "core", cooldown: "cooldown", rotation: "rotation", fun: "fun", anchors: "main" };
  const accentClass = accentMap[block.group] || "main";
  const wasSwapped = row.originalId && row.originalId !== row.id;

  const card = el(`
    <article class="ex-card ${status || ""} ${row.optional ? "optional" : ""}">
      <div class="ex-row">
        <div class="ex-status">
          <button class="ex-check" title="Сделано">${status === "done" ? "✓" : ""}</button>
          <button class="ex-skip" title="Пропустить">${status === "skipped" ? "×" : ""}</button>
        </div>
        <button class="ex-main">
          <div class="ex-name-row">
            <span class="ex-name-en">${exercise.nameEn}</span>
            ${row.explore ? '<span class="ex-badge ex-badge-explore">новое</span>' : ""}
            ${wasSwapped ? '<span class="ex-badge ex-badge-swapped">заменено</span>' : ""}
          </div>
          <div class="ex-meta">${row.slotTitle}${exercise.prescription ? " · " + exercise.prescription : ""}${renderEquipmentBadge(exercise.equipment)}</div>
        </button>
        <button class="ex-copy" title="Скопировать название">⧉</button>
        <button class="ex-cycle ${isSwapOpen ? "active" : ""}" title="Заменить">⟳</button>
      </div>
    </article>
  `);

  card.querySelector(".ex-check").addEventListener("click", () => setStatus(key, "done"));
  card.querySelector(".ex-skip").addEventListener("click", () => setStatus(key, "skipped"));
  card.querySelector(".ex-main").addEventListener("click", () => toggleExpand(key));
  card.querySelector(".ex-copy").addEventListener("click", (e) => copyName(exercise.nameEn, e.currentTarget));
  card.querySelector(".ex-cycle").addEventListener("click", () => toggleSwap(key));

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
            <p class="ex-cue">${exercise.cue}</p>
            ${last ? `<p class="ex-last">Прошлый раз: <strong>${last.weight ? last.weight + " кг" : ""}${last.weight && last.reps ? " × " : ""}${last.reps || ""}</strong></p>` : ""}
            <div class="ex-log">
              <input type="text" inputmode="decimal" placeholder="кг" class="log-weight" />
              <input type="text" inputmode="numeric" placeholder="повторы" class="log-reps" />
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
      const options = getSwapOptions(row.id, row.originalId, isPrepSlot);
      options.forEach((opt) => {
        const isCurrent = opt.id === row.id;
        const isOriginal = opt.id === row.originalId && row.originalId !== row.id;
        const chip = el(`<button type="button" class="swap-chip ${isCurrent ? "current" : ""}">${opt.nameEn}${isOriginal ? " ↺" : ""}</button>`);
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
    rows.forEach((row, i) => list.appendChild(exerciseCard(block, row, i)));
    wrap.appendChild(section);
  });
}

function renderHistory() {
  const wrap = document.getElementById("history-list");
  wrap.innerHTML = "";
  const recent = state.log.slice(-8).reverse();
  if (!recent.length) {
    wrap.appendChild(el(`<p class="history-empty">Пока пусто — заверши первую тренировку.</p>`));
    return;
  }
  recent.forEach((entry) => {
    const d = new Date(entry.date);
    wrap.appendChild(el(`
      <div class="history-item">
        <div><span class="h-letter">${entry.letter}</span> · ${entry.label}<br />${d.getDate()} ${MONTHS_RU_FULL[d.getMonth()]} · ${entry.done}/${entry.total}${entry.skipped ? ", пропущено " + entry.skipped : ""}
        ${entry.note ? `<div class="h-note">${entry.note}</div>` : ""}</div>
      </div>
    `));
  });
}

function calendarLabel(entry) {
  if (!entry) return "";
  if (entry.type === "session") return `Тренировка ${entry.letter}`;
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
    const entry = state.calendar[key];
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
  const entry = state.calendar[k];
  chooser.innerHTML = `<span class="cal-chooser-date">${k}</span>`;
  if (entry && entry.type === "session") {
    chooser.appendChild(el(`<span class="cal-chooser-note">Тренировка ${entry.letter} — уже записана автоматически</span>`));
  }
  const opts = [["cardio", "Кардио / плавание"], ["other", "Другое"], ["rest", "Отдых"]];
  opts.forEach(([type, label]) => {
    const b = el(`<button type="button" class="${entry && entry.type === type ? "active" : ""}">${label}</button>`);
    b.addEventListener("click", () => setCalendarDay(k, type));
    chooser.appendChild(b);
  });
  if (entry) {
    const clearBtn = el(`<button type="button" class="cal-clear">Очистить день</button>`);
    clearBtn.addEventListener("click", () => setCalendarDay(k, null));
    chooser.appendChild(clearBtn);
  }
}

function render() {
  renderTop();
  renderDaySwitcher();
  renderModePicker();
  renderVibePicker();
  renderBlocks();
  renderCalendar();
  renderHistory();
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
}

document.addEventListener("DOMContentLoaded", () => {
  render();
  initFinishButton();
  initExtras();
});
