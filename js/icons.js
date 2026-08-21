/*
  Схематичные картинки-позы для упражнений (фигурка человека) + значки оборудования.
  Красным пятном подсвечена примерная зона работающей мышцы — ориентир, не анатомический атлас.
*/

const POSE_PATHS = {
  walk: {
    head: [80, 38],
    lines: [
      [[80, 47], [78, 82]],
      [[79, 55], [62, 70]],
      [[79, 55], [98, 66]],
      [[78, 82], [58, 122]],
      [[78, 82], [101, 118]],
    ],
    highlight: null,
  },
  stretch: {
    head: [82, 34],
    lines: [
      [[82, 43], [87, 84]],
      [[85, 52], [106, 26]],
      [[85, 58], [69, 84]],
      [[87, 84], [77, 124]],
      [[87, 84], [97, 124]],
    ],
    highlight: null,
  },
  squat: {
    head: [80, 32],
    lines: [
      [[80, 41], [85, 68]],
      [[84, 50], [102, 64]],
      [[84, 50], [102, 68]],
      [[85, 68], [63, 90]],
      [[63, 90], [66, 118]],
      [[85, 68], [107, 90]],
      [[107, 90], [104, 118]],
    ],
    highlight: { cx: 85, cy: 96, rx: 24, ry: 17 },
  },
  hinge: {
    head: [28, 96],
    lines: [
      [[41, 101], [77, 82]],
      [[41, 101], [54, 120]],
      [[77, 82], [107, 100]],
      [[107, 100], [107, 126]],
    ],
    highlight: { cx: 88, cy: 92, rx: 22, ry: 16 },
  },
  "pull-vertical": {
    head: [80, 34],
    lines: [
      [[80, 43], [80, 88]],
      [[80, 50], [52, 33]],
      [[80, 50], [108, 33]],
      [[52, 33], [108, 33]],
      [[80, 88], [61, 100]],
      [[61, 100], [61, 124]],
      [[80, 88], [99, 100]],
      [[99, 100], [99, 124]],
    ],
    highlight: { cx: 80, cy: 64, rx: 17, ry: 22 },
  },
  "pull-horizontal": {
    head: [33, 48],
    lines: [
      [[36, 57], [66, 85]],
      [[66, 85], [41, 91]],
      [[66, 85], [107, 93]],
      [[107, 93], [107, 122]],
    ],
    highlight: { cx: 54, cy: 68, rx: 19, ry: 16 },
  },
  "push-horizontal": {
    head: [28, 100],
    lines: [
      [[37, 100], [86, 100]],
      [[86, 100], [101, 85]],
      [[101, 85], [116, 100]],
      [[56, 100], [56, 64]],
      [[68, 100], [68, 64]],
      [[56, 64], [68, 64]],
    ],
    highlight: { cx: 60, cy: 94, rx: 21, ry: 14 },
  },
  core: {
    head: [28, 58],
    lines: [
      [[37, 61], [86, 80]],
      [[46, 66], [46, 90]],
      [[86, 80], [122, 86]],
    ],
    highlight: { cx: 64, cy: 72, rx: 20, ry: 14 },
  },
  carry: {
    head: [80, 30],
    lines: [
      [[80, 39], [80, 88]],
      [[80, 88], [66, 128]],
      [[80, 88], [94, 128]],
      [[80, 55], [56, 65]],
      [[56, 65], [56, 95]],
      [[80, 55], [104, 65]],
      [[104, 65], [104, 95]],
    ],
    highlight: { cx: 80, cy: 62, rx: 16, ry: 18 },
  },
  arm: {
    head: [46, 30],
    lines: [
      [[50, 39], [56, 92]],
      [[56, 92], [48, 128]],
      [[56, 92], [68, 128]],
      [[52, 50], [72, 66]],
      [[72, 66], [58, 88]],
    ],
    highlight: { cx: 64, cy: 58, rx: 14, ry: 12 },
  },
  calf: {
    head: [72, 30],
    lines: [
      [[75, 39], [79, 90]],
      [[79, 90], [86, 118]],
      [[86, 118], [100, 122]],
      [[74, 50], [64, 74]],
    ],
    highlight: { cx: 90, cy: 106, rx: 13, ry: 15 },
  },
};

function poseJoints(data) {
  // Точки, где сходятся 2+ отрезка — рисуем там маленький сустав-кружок для читаемости.
  const counts = new Map();
  const keyOf = (p) => `${p[0]},${p[1]}`;
  data.lines.forEach(([a, b]) => {
    [a, b].forEach((p) => {
      const k = keyOf(p);
      counts.set(k, (counts.get(k) || 0) + 1);
    });
  });
  const joints = [];
  counts.forEach((count, k) => {
    if (count >= 2) {
      const [x, y] = k.split(",").map(Number);
      if (x === data.head[0] && y === data.head[1]) return;
      joints.push([x, y]);
    }
  });
  return joints;
}

function renderPoseIcon(pose, accent) {
  const data = POSE_PATHS[pose] || POSE_PATHS.stretch;
  const segments = data.lines.map(([[x1, y1], [x2, y2]]) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" />`).join("");
  const joints = poseJoints(data)
    .map(([x, y]) => `<circle class="pose-joint" cx="${x}" cy="${y}" r="4.5" />`)
    .join("");
  const highlight = data.highlight
    ? `<ellipse class="pose-highlight" cx="${data.highlight.cx}" cy="${data.highlight.cy}" rx="${data.highlight.rx}" ry="${data.highlight.ry}" />`
    : "";
  return `
    <svg class="pose-icon" viewBox="0 0 160 160" role="img" aria-hidden="true">
      <circle class="pose-blob ${accent || ""}" cx="80" cy="80" r="72" />
      ${highlight}
      <g class="pose-figure">
        ${segments}
        ${joints}
        <circle class="pose-head" cx="${data.head[0]}" cy="${data.head[1]}" r="10" />
      </g>
    </svg>
  `;
}

// ---------- ЗНАЧКИ ОБОРУДОВАНИЯ ----------

const EQUIPMENT_META = {
  machine: { icon: "🔧", label: "Тренажёр" },
  smith: { icon: "🎛", label: "Смит" },
  cable: { icon: "🔗", label: "Блок / кабель" },
  barbell: { icon: "🏋", label: "Штанга" },
  freeweight: { icon: "🔵", label: "Гантели / гиря" },
  band: { icon: "➰", label: "Резинка" },
  ball: { icon: "⚽", label: "Мяч" },
  bodyweight: { icon: "🧍", label: "Свой вес" },
  cardio: { icon: "🚴", label: "Кардио-тренажёр" },
  roller: { icon: "🧻", label: "Ролик" },
  sled: { icon: "🛷", label: "Сани" },
  jumprope: { icon: "➿", label: "Скакалка" },
  pool: { icon: "🌊", label: "Бассейн" },
  class: { icon: "👥", label: "Групповое занятие" },
};

function renderEquipmentBadge(equipment) {
  const meta = EQUIPMENT_META[equipment];
  if (!meta) return "";
  return `<span class="equip-badge" title="${meta.label}"><span class="equip-icon">${meta.icon}</span>${meta.label}</span>`;
}
