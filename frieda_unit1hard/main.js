import {
  TILE,
  COLS,
  ROWS,
  INTERIOR_COLS,
  INTERIOR_ROWS,
  INTERIOR_OFFSET,
  REAL_SECONDS_PER_INGAME_MINUTE,
  DAY_MINUTES,
  ui,
  state,
  currentScene,
  setScene
} from "./core.js";

import {
  palette,
  quests,
  furnitureCatalog,
  furnitureOrder,
  furnitureInventory,
  homeFurniture,
  cropCatalog,
  cropOrder,
  selectedCropId,
  setSelectedCropId,
  seedInventory,
  cropInventory,
  player,
  npcs,
  buildings
} from "./data.js";

// for test

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
ctx.imageSmoothingEnabled = false;

const map = Array.from({ length: ROWS }, () => Array.from({ length: COLS }, () => "grass"));
const solid = Array.from({ length: ROWS }, () => Array.from({ length: COLS }, () => false));
const bridgeTiles = new Set();
const dockTiles = new Set();
const walkableWaterTiles = new Set();
const homeMap = Array.from({ length: ROWS }, () => Array.from({ length: COLS }, () => "floor"));
const homeSolid = Array.from({ length: ROWS }, () => Array.from({ length: COLS }, () => false));
const homeDoor = { r: INTERIOR_OFFSET.r + INTERIOR_ROWS - 1, c: INTERIOR_OFFSET.c + Math.floor(INTERIOR_COLS / 2) };

function tileKey(r, c) {
  return `${r},${c}`;
}

function hash(r, c, seed = 0) {
  const value = Math.sin((r + seed) * 12.9898 + (c - seed) * 78.233) * 43758.5453;
  return value - Math.floor(value);
}

function paintRect(x, y, w, h, type, targetMap = map) {
  for (let r = y; r < y + h; r++) {
    for (let c = x; c < x + w; c++) {
      if (r >= 0 && c >= 0 && r < ROWS && c < COLS) {
        targetMap[r][c] = type;
      }
    }
  }
}

function setSolidRect(x, y, w, h, value = true, targetSolid = solid) {
  for (let r = y; r < y + h; r++) {
    for (let c = x; c < x + w; c++) {
      if (r >= 0 && c >= 0 && r < ROWS && c < COLS) {
        targetSolid[r][c] = value;
      }
    }
  }
}

function setSolidPoint(r, c, value = true, targetSolid = solid) {
  if (r >= 0 && c >= 0 && r < ROWS && c < COLS) {
    targetSolid[r][c] = value;
  }
}

function buildHomeMap() {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      homeMap[r][c] = "wall";
    }
  }

  for (let r = INTERIOR_OFFSET.r; r < INTERIOR_OFFSET.r + INTERIOR_ROWS; r++) {
    for (let c = INTERIOR_OFFSET.c; c < INTERIOR_OFFSET.c + INTERIOR_COLS; c++) {
      homeMap[r][c] = "floor";
    }
  }

  // Border walls so player can't walk over the frame
  for (let r = 0; r < ROWS; r++) {
    if (r < INTERIOR_OFFSET.r || r >= INTERIOR_OFFSET.r + INTERIOR_ROWS) {
      for (let c = 0; c < COLS; c++) homeMap[r][c] = "wall";
    }
  }
  for (let c = 0; c < COLS; c++) {
    if (c < INTERIOR_OFFSET.c || c >= INTERIOR_OFFSET.c + INTERIOR_COLS) {
      for (let r = 0; r < ROWS; r++) homeMap[r][c] = "wall";
    }
  }

  // Interior rugs
  paintRect(INTERIOR_OFFSET.c + 8, INTERIOR_OFFSET.r + 7, 6, 3, "rug", homeMap);
  paintRect(INTERIOR_OFFSET.c + 3, INTERIOR_OFFSET.r + 4, 4, 3, "rug", homeMap);
  homeMap[homeDoor.r][homeDoor.c] = "door";
}

function resolveDoorRow(house) {
  const doorC = house.x + Math.floor(house.w / 2);
  const candidates = [house.y + house.h, house.y + house.h - 1, house.y + 1, house.y + 2];
  for (const r of candidates) {
    if (r >= 0 && r < ROWS && map[r][doorC] !== "water") {
      return r;
    }
  }
  return house.y + house.h;
}

paintRect(2, 6, 26, 2, "path");
paintRect(14, 2, 2, 12, "path");
paintRect(6, 8, 2, 7, "path");
paintRect(20, 8, 2, 5, "path");
paintRect(11, 4, 6, 2, "pathBrick");
paintRect(21, 10, 7, 5, "water");
paintRect(0, 0, 5, 4, "grassDark");
paintRect(25, 0, 5, 4, "grassDark");
buildHomeMap();

// Dock on the pond (walkable)
paintRect(22, 12, 3, 1, "dock");
paintRect(23, 11, 1, 2, "dock");
for (let r = 10; r < 15; r++) {
  for (let c = 21; c < 28; c++) {
    if (map[r][c] === "dock") dockTiles.add(tileKey(r, c));
    if (map[r][c] === "water") walkableWaterTiles.add(tileKey(r, c));
  }
}

const farmPlots = [];
const farmBounds = { minR: 10, maxR: 13, minC: 2, maxC: 8 };
for (let r = farmBounds.minR; r <= farmBounds.maxR; r++) {
  for (let c = farmBounds.minC; c <= farmBounds.maxC; c++) {
    farmPlots.push({ r, c, watered: false, planted: false, growTime: 0, cropId: null });
    map[r][c] = "soil";
  }
}

const buildings = [
  { x: 3, y: 1, w: 4, h: 3, roof: "#ffb3c9", trim: "#ffd8ea", door: "#ff9fbf" },
  { x: 10, y: 1, w: 4, h: 3, roof: "#ffc7a5", trim: "#ffe5d4", door: "#f2a36b" },
  { x: 18, y: 1, w: 5, h: 3, roof: "#9ad8ff", trim: "#d7f1ff", door: "#6aaee8", type: "hall" },
  { x: 22, y: 8, w: 4, h: 3, roof: "#b9b6ff", trim: "#e5e4ff", door: "#8b88d8" }
];

const playerHouseDoor = {
  r: buildings[0].y + buildings[0].h,
  c: buildings[0].x + Math.floor(buildings[0].w / 2)
};
const houseDoors = buildings.map((house, index) => ({
  r: house.y + house.h,
  c: house.x + Math.floor(house.w / 2),
  isPlayer: index === 0
}));
// Ensure front paths lead to house doors
for (const door of houseDoors) {
  const c = door.c;
  const start = Math.min(door.r + 1, ROWS - 1);
  let reached = false;
  for (let r = start; r < ROWS; r++) {
    if (map[r][c] === "path" || map[r][c] === "pathBrick") {
      reached = true;
      break;
    }
    map[r][c] = "path";
  }
  if (!reached) {
    for (let r = door.r - 1; r >= 0; r--) {
      if (map[r][c] === "path" || map[r][c] === "pathBrick") break;
      map[r][c] = "path";
    }
  }
}
let activeReturnDoor = playerHouseDoor;
const homeSpawn = { x: homeDoor.c, y: homeDoor.r - 1 };

const trees = [
  { x: 1, y: 6 },
  { x: 2, y: 12 },
  { x: 4, y: 14 },
  { x: 26, y: 12 },
  { x: 28, y: 14 },
  { x: 12, y: 13 },
  { x: 24, y: 3 },
  { x: 6, y: 3 }
];

const fences = [];
for (let c = 1; c <= 9; c++) {
  if (c === 6 || c === 7) continue;
  fences.push({ r: 9, c });
}
for (let c = 1; c <= 9; c++) fences.push({ r: 14, c });
for (let r = 10; r <= 13; r++) fences.push({ r, c: 1 });
for (let r = 10; r <= 13; r++) fences.push({ r, c: 9 });
const fenceSet = new Set(fences.map(f => tileKey(f.r, f.c)));

const bridge = { r: 12, c: 22, w: 3, h: 1 };
for (let c = bridge.c; c < bridge.c + bridge.w; c++) {
  bridgeTiles.add(tileKey(bridge.r, c));
}

const decor = {
  flowers: [
    { r: 4, c: 8 }, { r: 4, c: 9 }, { r: 4, c: 10 },
    { r: 9, c: 12 }, { r: 9, c: 13 }, { r: 9, c: 14 },
    { r: 12, c: 17 }, { r: 13, c: 17 }
  ],
  bushes: [
    { r: 2, c: 26 }, { r: 3, c: 26 }, { r: 2, c: 27 },
    { r: 12, c: 20 }, { r: 13, c: 20 }
  ],
  rocks: [
    { r: 8, c: 4 }, { r: 8, c: 5 }, { r: 15, c: 18 }
  ],
  lanterns: [
    { r: 6, c: 11 }, { r: 6, c: 18 }, { r: 11, c: 14 }
  ],
  benches: [
    { r: 8, c: 16 }, { r: 13, c: 23 }
  ],
  mailboxes: [],
  signs: [
    { r: 7, c: 15 }
  ],
  well: { r: 5, c: 13 },
  stall: { r: 5, c: 8 }
};
// Mailboxes on the left side of each house path
decor.mailboxes = houseDoors.map((door) => {
  const r = Math.min(ROWS - 1, door.r + 1);
  const c = Math.max(0, door.c - 1);
  return { r, c };
});

const player = {
  x: 14,
  y: 9,
  dir: { x: 0, y: 1 },
  speed: 3.5,
  style: {
    fur: "#ffe4f1",
    outfit: "#7fd9c7",
    accent: "#ff93b9",
    ear: "cat",
    accessory: "hat",
    blush: "#ff9fc1"
  }
};

const npcs = [
  { name: "Hana", role: "Farmer", x: 6, y: 7, home: { x: 6, y: 7 }, followOffset: { x: -0.8, y: 0.6 }, mood: "Seeds make the village glow.", questId: "picnic", follow: false, blinkOffset: 1.2, style: {
    fur: "#fff0a6", outfit: "#ffb3c9", accent: "#ffd87a", ear: "bear", accessory: "bow", blush: "#ff9fc1"
  }},
  { name: "Kumo", role: "Cook", x: 18, y: 6, home: { x: 18, y: 6 }, followOffset: { x: 0.9, y: 0.3 }, mood: "Fresh food brings energy.", questId: null, follow: false, blinkOffset: 3.6, style: {
    fur: "#c8f0ff", outfit: "#9ad8ff", accent: "#6aaee8", ear: "bunny", accessory: "scarf", blush: "#ffb2c8"
  }},
  { name: "Sora", role: "Furniture", x: 22, y: 12, home: { x: 22, y: 12 }, followOffset: { x: -0.6, y: -0.8 }, mood: "A cozy home is a happy heart.", questId: null, follow: false, blinkOffset: 5.1, style: {
    fur: "#d8c7ff", outfit: "#b9b6ff", accent: "#8b88d8", ear: "cat", accessory: "flower", blush: "#ffb2e6"
  }},
  { name: "Poko", role: "Pet", x: 12, y: 11, home: { x: 12, y: 11 }, followOffset: { x: 0.4, y: -0.6 }, mood: "Pets make the island feel alive.", questId: null, follow: false, blinkOffset: 6.4, style: {
    fur: "#ffe4f1", outfit: "#ffd7a6", accent: "#ffb3c9", ear: "bear", accessory: "bow", blush: "#ff9fc1"
  }}
];

function drawTile(r, c, type) {
  const x = c * TILE;
  const y = r * TILE;

  if (type === "grass" || type === "grassDark") {
    ctx.fillStyle = type === "grass" ? palette.grass : palette.grassDark;
    ctx.fillRect(x, y, TILE, TILE);
    const noise = hash(r, c);
    if (noise > 0.82) {
      ctx.fillStyle = "#9bdc8f";
      ctx.fillRect(x + 5, y + 6, 6, 3);
      ctx.fillRect(x + 18, y + 16, 5, 3);
    }
    if (noise < 0.1) {
      ctx.fillStyle = "#ffc8dd";
      ctx.fillRect(x + 10, y + 10, 3, 3);
      ctx.fillRect(x + 14, y + 8, 3, 3);
    }
  } else if (type === "path" || type === "pathBrick") {
    ctx.fillStyle = type === "path" ? palette.path : palette.pathBrick;
    ctx.fillRect(x, y, TILE, TILE);
    ctx.fillStyle = palette.pathEdge;
    ctx.fillRect(x, y + TILE - 4, TILE, 4);
    if (type === "pathBrick") {
      ctx.fillStyle = "#e2b7a2";
      ctx.fillRect(x + 3, y + 4, 10, 6);
      ctx.fillRect(x + 16, y + 12, 10, 6);
    } else {
      ctx.fillStyle = "#e9c89a";
      ctx.fillRect(x + 4, y + 6, 6, 4);
      ctx.fillRect(x + 18, y + 15, 6, 4);
    }
  } else if (type === "water") {
    ctx.fillStyle = palette.water;
    ctx.fillRect(x, y, TILE, TILE);
    ctx.fillStyle = palette.waterDeep;
    ctx.fillRect(x, y + 16, TILE, 6);
    const wave = (hash(r, c, Math.floor(state.timeMinutes / 60)) + state.tick * 0.02) % 1;
    ctx.fillStyle = "#bde9ff";
    ctx.fillRect(x + 4, y + 6 + Math.floor(wave * 4), 10, 2);
  } else if (type === "dock") {
    ctx.fillStyle = palette.dock;
    ctx.fillRect(x, y, TILE, TILE);
    ctx.fillStyle = palette.dockEdge;
    ctx.fillRect(x, y + TILE - 4, TILE, 4);
    ctx.fillStyle = "#d6e9ff";
    ctx.fillRect(x + 4, y + 6, 8, 3);
  } else if (type === "floor") {
    ctx.fillStyle = palette.wood;
    ctx.fillRect(x, y, TILE, TILE);
    ctx.fillStyle = palette.woodDark;
    ctx.fillRect(x + 2, y + 4, TILE - 4, 4);
    ctx.fillRect(x + 2, y + 16, TILE - 4, 4);
  } else if (type === "wall") {
    ctx.fillStyle = palette.wall;
    ctx.fillRect(x, y, TILE, TILE);
    ctx.fillStyle = palette.wallShadow;
    ctx.fillRect(x, y + TILE - 6, TILE, 6);
  } else if (type === "rug") {
    ctx.fillStyle = palette.rug;
    ctx.fillRect(x, y, TILE, TILE);
    ctx.fillStyle = "#ffd1e6";
    ctx.fillRect(x + 6, y + 6, 8, 4);
  } else if (type === "door") {
    ctx.fillStyle = palette.wood;
    ctx.fillRect(x, y, TILE, TILE);
    ctx.fillStyle = palette.door;
    ctx.fillRect(x + 6, y + 6, 20, 22);
    ctx.fillStyle = palette.doorDark;
    ctx.fillRect(x + 9, y + 16, 3, 3);
  }
}

function drawHouse(house) {
  const x = house.x * TILE;
  const y = house.y * TILE;
  const w = TILE * house.w;
  const h = TILE * house.h;
  const wallY = y + 14;
  const wallH = h - 6;
  const roofColor = house.roof || palette.roof;
  const trimColor = house.trim || palette.trim;

  // Roof (peaked)
  ctx.fillStyle = roofColor;
  ctx.beginPath();
  ctx.moveTo(x - 6, y + 14);
  ctx.lineTo(x + w / 2, y - 8);
  ctx.lineTo(x + w + 6, y + 14);
  ctx.closePath();
  ctx.fill();
  ctx.fillRect(x - 4, y + 12, w + 8, 8);

  // Roof shingles
  ctx.fillStyle = "#e88fb0";
  for (let i = 0; i < w + 6; i += 10) {
    ctx.fillRect(x - 2 + i, y + 14, 6, 2);
    ctx.fillRect(x - 2 + i, y + 18, 6, 2);
  }

  // Chimney
  ctx.fillStyle = "#c17c56";
  ctx.fillRect(x + w - 18, y + 2, 10, 16);
  ctx.fillStyle = "#8b5e3c";
  ctx.fillRect(x + w - 20, y, 14, 4);

  // Walls
  ctx.fillStyle = palette.house;
  ctx.fillRect(x, wallY, w, wallH);
  ctx.fillStyle = trimColor;
  ctx.fillRect(x, wallY, w, 6);
  ctx.fillStyle = "#f5d6e6";
  ctx.fillRect(x, wallY + wallH - 6, w, 6);

  // Door (large rectangle, slightly narrower)
  const doorW = Math.min(40, w - 14);
  const doorH = Math.min(48, wallH - 4);
  const doorX = x + Math.floor(w / 2) - Math.floor(doorW / 2);
  const doorY = wallY + wallH - doorH;
  ctx.fillStyle = house.door || palette.door;
  ctx.fillRect(doorX, doorY, doorW, doorH);
  // Handle on left side (more visible, centered)
  ctx.fillStyle = "#ffd37a";
  ctx.fillRect(doorX + 6, doorY + Math.floor(doorH / 2), 4, 4);
  ctx.fillStyle = "#ffedb0";
  ctx.fillRect(doorX + 7, doorY + Math.floor(doorH / 2) + 1, 2, 2);
  ctx.fillStyle = "#b27c52";
  ctx.fillRect(doorX - 2, doorY + doorH, doorW + 4, 4);

  // Windows (between edge and door, detailed)
  const windowW = 14;
  const windowH = 14;
  const windowY = wallY + 18;
  const leftBound = x + 6;
  const rightBound = x + w - 6 - windowW;
  const leftX = Math.max(leftBound, doorX - windowW - 4);
  const rightX = Math.min(rightBound, doorX + doorW + 4);

  const drawWindow = (wx) => {
    ctx.fillStyle = "#f3e7f2";
    ctx.fillRect(wx - 2, windowY - 2, windowW + 4, windowH + 6); // frame
    ctx.fillStyle = "#c9e7ff";
    ctx.fillRect(wx, windowY, windowW, windowH); // glass
    ctx.fillStyle = "#9bc7ef";
    ctx.fillRect(wx + 1, windowY + 1, windowW - 2, windowH - 2); // inner tint
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(wx + 3, windowY + 3, 3, 3); // shine
    ctx.fillStyle = "#b086a8";
    ctx.fillRect(wx - 2, windowY + windowH + 2, windowW + 4, 2); // sill
    ctx.fillStyle = "#f3e7f2";
    ctx.fillRect(wx + Math.floor(windowW / 2) - 1, windowY, 2, windowH);
    ctx.fillRect(wx, windowY + Math.floor(windowH / 2) - 1, windowW, 2);
  };

  drawWindow(leftX);
  drawWindow(rightX);

  if (house.type === "hall") {
    ctx.fillStyle = "#fff";
    ctx.fillRect(x + 18, y + 6, 28, 6);
    ctx.fillStyle = "#9ad8ff";
    ctx.fillRect(x + 24, y + 8, 16, 2);
  }
}

function drawTree(tree) {
  const x = tree.x * TILE + 8;
  const y = tree.y * TILE + 6;
  ctx.fillStyle = palette.trunk;
  ctx.fillRect(x + 6, y + 14, 8, 14);
  ctx.fillStyle = palette.tree;
  ctx.beginPath();
  ctx.arc(x + 10, y + 10, 14, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#7acb98";
  ctx.beginPath();
  ctx.arc(x + 2, y + 8, 8, 0, Math.PI * 2);
  ctx.arc(x + 18, y + 8, 8, 0, Math.PI * 2);
  ctx.fill();
}

function drawFence(r, c) {
  const x = c * TILE;
  const y = r * TILE;
  const left = fenceSet.has(tileKey(r, c - 1));
  const right = fenceSet.has(tileKey(r, c + 1));
  const up = fenceSet.has(tileKey(r - 1, c));
  const down = fenceSet.has(tileKey(r + 1, c));

  ctx.fillStyle = palette.fenceShadow;
  ctx.fillRect(x + 12, y + 18, 8, 12);
  ctx.fillStyle = palette.fence;
  ctx.fillRect(x + 12, y + 14, 8, 14);

  ctx.fillStyle = "#f7d7e6";
  if (left || right) {
    ctx.fillRect(x + 4, y + 18, 24, 4);
    ctx.fillRect(x + 4, y + 24, 24, 4);
  }
  if (up || down) {
    ctx.fillRect(x + 14, y + 8, 4, 20);
  }
}

function drawFlower(r, c) {
  const x = c * TILE + 6;
  const y = r * TILE + 10;
  ctx.fillStyle = "#8adf93";
  ctx.fillRect(x + 4, y + 6, 2, 8);
  ctx.fillStyle = "#ff9cc8";
  ctx.beginPath();
  ctx.arc(x + 5, y + 4, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#ffd1e6";
  ctx.beginPath();
  ctx.arc(x + 5, y + 4, 2, 0, Math.PI * 2);
  ctx.fill();
}

function drawBush(r, c) {
  const x = c * TILE + 4;
  const y = r * TILE + 10;
  ctx.fillStyle = palette.bush;
  ctx.beginPath();
  ctx.arc(x + 6, y + 6, 8, 0, Math.PI * 2);
  ctx.arc(x + 16, y + 8, 10, 0, Math.PI * 2);
  ctx.fill();
}

function drawRock(r, c) {
  const x = c * TILE + 6;
  const y = r * TILE + 14;
  ctx.fillStyle = palette.rock;
  ctx.beginPath();
  ctx.arc(x + 6, y + 6, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#d5dbea";
  ctx.beginPath();
  ctx.arc(x + 3, y + 4, 2, 0, Math.PI * 2);
  ctx.fill();
}

function drawLamp(r, c) {
  const x = c * TILE + 12;
  const y = r * TILE + 6;
  ctx.fillStyle = "#7f6a8a";
  ctx.fillRect(x, y + 10, 4, 16);
  ctx.fillStyle = palette.lamp;
  ctx.beginPath();
  ctx.arc(x + 2, y + 8, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = palette.lantern;
  ctx.beginPath();
  ctx.arc(x + 2, y + 8, 3, 0, Math.PI * 2);
  ctx.fill();
}

function drawBench(r, c) {
  const x = c * TILE + 2;
  const y = r * TILE + 16;
  ctx.fillStyle = "#d8a97f";
  ctx.fillRect(x, y, 28, 6);
  ctx.fillStyle = "#b27c52";
  ctx.fillRect(x + 2, y + 6, 4, 8);
  ctx.fillRect(x + 22, y + 6, 4, 8);
}

function drawMailbox(r, c) {
  const x = c * TILE + 10;
  const y = r * TILE + 12;
  ctx.fillStyle = "#ff9fbf";
  ctx.fillRect(x, y, 10, 8);
  ctx.fillStyle = "#f06a96";
  ctx.fillRect(x, y - 4, 10, 4);
  ctx.fillStyle = "#8b5e3c";
  ctx.fillRect(x + 4, y + 8, 2, 8);
}

function drawSign(r, c) {
  const x = c * TILE + 10;
  const y = r * TILE + 10;
  ctx.fillStyle = "#d1a070";
  ctx.fillRect(x, y, 12, 8);
  ctx.fillStyle = "#8b5e3c";
  ctx.fillRect(x + 5, y + 8, 2, 10);
  ctx.fillStyle = "#fff";
  ctx.fillRect(x + 2, y + 2, 8, 2);
}

function drawWell(r, c) {
  const x = c * TILE;
  const y = r * TILE + 8;
  ctx.fillStyle = "#e5d9f2";
  ctx.fillRect(x + 4, y + 6, 24, 10);
  ctx.fillStyle = "#c9b7e6";
  ctx.fillRect(x + 8, y + 2, 16, 4);
  ctx.fillStyle = "#9ad8ff";
  ctx.fillRect(x + 10, y + 8, 12, 6);
}

function drawStall(r, c) {
  const x = c * TILE;
  const y = r * TILE + 8;
  ctx.fillStyle = "#ffd7a6";
  ctx.fillRect(x + 2, y + 8, 28, 10);
  ctx.fillStyle = "#ffb3c9";
  ctx.fillRect(x, y, 32, 8);
  ctx.fillStyle = "#fff";
  ctx.fillRect(x + 4, y + 2, 6, 4);
  ctx.fillRect(x + 12, y + 2, 6, 4);
  ctx.fillRect(x + 20, y + 2, 6, 4);
}

function drawBridgeTile(r, c) {
  const x = c * TILE;
  const y = r * TILE;
  ctx.fillStyle = "#d2a171";
  ctx.fillRect(x, y + 12, TILE, 8);
  ctx.fillStyle = "#b27c52";
  ctx.fillRect(x + 2, y + 10, TILE - 4, 4);
}

function drawInteriorDecor() {
  const baseC = INTERIOR_OFFSET.c;
  const baseR = INTERIOR_OFFSET.r;
  const items = [
    { kind: "fireplace", x: baseC + 6, y: baseR + 1 },
    { kind: "tv", x: baseC + 1, y: baseR + 2 },
    { kind: "table", x: baseC + 4, y: baseR + 4 },
    { kind: "chair", x: baseC + 2, y: baseR + 4 },
    { kind: "window", x: baseC + 2, y: baseR + 1 },
    { kind: "frame", x: baseC + 5, y: baseR + 1 },
    { kind: "plant", x: baseC + 1, y: baseR + 7 },
    { kind: "chest", x: baseC + 3, y: baseR + 6 },
    { kind: "rug", x: baseC + 4, y: baseR + 7 }
  ];

  for (const item of items) {
    const x = item.x * TILE;
    const y = item.y * TILE;
    if (item.kind === "fireplace") {
      ctx.fillStyle = palette.fireplace;
      ctx.fillRect(x, y, TILE * 3, TILE * 3);
      ctx.fillStyle = "#5c2f1d";
      ctx.fillRect(x + 8, y + 10, 28, 22);
      ctx.fillStyle = palette.fireplaceGlow;
      ctx.fillRect(x + 12, y + 18, 20, 10);
      ctx.fillStyle = palette.trimDark;
      ctx.fillRect(x + 10, y - 10, 24, 10);
    } else if (item.kind === "tv") {
      ctx.fillStyle = palette.metal;
      ctx.fillRect(x, y + 6, 28, 20);
      ctx.fillStyle = "#2b2f3a";
      ctx.fillRect(x + 4, y + 10, 20, 12);
      ctx.fillStyle = palette.trimDark;
      ctx.fillRect(x + 6, y + 26, 16, 6);
    } else if (item.kind === "table") {
      ctx.fillStyle = palette.trimDark;
      ctx.fillRect(x, y + 8, 32, 8);
      ctx.fillStyle = palette.woodDark;
      ctx.fillRect(x + 4, y + 16, 4, 12);
      ctx.fillRect(x + 24, y + 16, 4, 12);
      ctx.fillStyle = "#fff7e0";
      ctx.fillRect(x + 12, y + 4, 8, 6);
    } else if (item.kind === "chair") {
      ctx.fillStyle = palette.trimDark;
      ctx.fillRect(x + 6, y + 12, 16, 8);
      ctx.fillRect(x + 6, y + 4, 6, 8);
      ctx.fillRect(x + 16, y + 4, 6, 8);
    } else if (item.kind === "window") {
      ctx.fillStyle = "#fff5e4";
      ctx.fillRect(x + 4, y + 2, 16, 20);
      ctx.fillStyle = "#cdefff";
      ctx.fillRect(x + 6, y + 6, 12, 12);
    } else if (item.kind === "frame") {
      ctx.fillStyle = palette.trimDark;
      ctx.fillRect(x + 6, y + 6, 12, 12);
      ctx.fillStyle = "#6ec59b";
      ctx.fillRect(x + 8, y + 8, 8, 8);
    } else if (item.kind === "plant") {
      ctx.fillStyle = palette.leaf;
      ctx.fillRect(x + 6, y + 8, 12, 14);
      ctx.fillStyle = palette.trimDark;
      ctx.fillRect(x + 8, y + 22, 8, 6);
    } else if (item.kind === "chest") {
      ctx.fillStyle = palette.chest;
      ctx.fillRect(x + 6, y + 12, 18, 12);
      ctx.fillStyle = palette.trimDark;
      ctx.fillRect(x + 6, y + 10, 18, 4);
      ctx.fillStyle = "#ffd37a";
      ctx.fillRect(x + 12, y + 16, 4, 4);
    } else if (item.kind === "rug") {
      ctx.fillStyle = "#c97b4f";
      ctx.fillRect(x, y + 6, TILE * 3, TILE * 2);
      ctx.fillStyle = "#e4a47a";
      ctx.fillRect(x + 6, y + 10, TILE * 3 - 12, TILE * 2 - 12);
    }
  }
}

function getFurnitureSize(def, rotation) {
  if (rotation % 2 === 1) {
    return { w: def.h, h: def.w };
  }
  return { w: def.w, h: def.h };
}

function drawFurnitureItem(item) {
  const def = furnitureCatalog[item.id];
  const size = getFurnitureSize(def, item.rotation);
  const x = item.c * TILE;
  const y = item.r * TILE;
  const w = size.w * TILE;
  const h = size.h * TILE;

  if (item.id === "bed") {
    ctx.fillStyle = def.color;
    ctx.fillRect(x + 2, y + 10, w - 4, h - 12);
    ctx.fillStyle = def.accent;
    ctx.fillRect(x + 2, y + 2, w - 4, 10);
    ctx.fillStyle = "#fff";
    ctx.fillRect(x + 6, y + 4, 12, 6);
    ctx.fillStyle = "#f7b9d6";
    ctx.fillRect(x + w - 16, y + 4, 10, 6);
    ctx.fillStyle = "#b27c52";
    ctx.fillRect(x + 4, y + h - 6, 4, 4);
    ctx.fillRect(x + w - 8, y + h - 6, 4, 4);
  } else if (item.id === "table") {
    ctx.fillStyle = def.accent;
    ctx.fillRect(x + 2, y + 4, w - 4, 6);
    ctx.fillStyle = def.color;
    ctx.fillRect(x + 2, y + 10, w - 4, h - 16);
    ctx.fillStyle = "#b27c52";
    ctx.fillRect(x + 4, y + h - 6, 3, 6);
    ctx.fillRect(x + w - 7, y + h - 6, 3, 6);
    ctx.fillStyle = "#fff";
    ctx.fillRect(x + w / 2 - 3, y + 2, 6, 4);
  } else {
    ctx.fillStyle = def.color;
    ctx.fillRect(x + 8, y + 12, w - 16, h - 16);
    ctx.fillStyle = def.accent;
    ctx.fillRect(x + 6, y + 8, w - 12, 4);
    ctx.fillStyle = "#b27c52";
    ctx.fillRect(x + 10, y + h - 6, 3, 6);
    ctx.fillRect(x + w - 13, y + h - 6, 3, 6);
  }
}

function drawKawaiiSprite(x, y, style, isPlayer = false, offset = 0) {
  const bob = 0;
  const headY = y - 10 + bob;
  const bodyY = y - 2 + bob;
  const blink = Math.sin(state.tick * 3 + offset) > 0.98;

  ctx.fillStyle = "#bba6c9";
  ctx.beginPath();
  ctx.ellipse(x, y + 10 + bob, 10, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = style.fur;
  if (style.ear === "bunny") {
    ctx.beginPath();
    ctx.ellipse(x - 6, headY - 12, 4, 10, -0.2, 0, Math.PI * 2);
    ctx.ellipse(x + 6, headY - 12, 4, 10, 0.2, 0, Math.PI * 2);
    ctx.fill();
  } else if (style.ear === "bear") {
    ctx.beginPath();
    ctx.arc(x - 8, headY - 8, 4, 0, Math.PI * 2);
    ctx.arc(x + 8, headY - 8, 4, 0, Math.PI * 2);
    ctx.fill();
  } else if (style.ear === "cat") {
    ctx.beginPath();
    ctx.moveTo(x - 8, headY - 10);
    ctx.lineTo(x - 2, headY - 2);
    ctx.lineTo(x - 12, headY - 2);
    ctx.closePath();
    ctx.moveTo(x + 8, headY - 10);
    ctx.lineTo(x + 2, headY - 2);
    ctx.lineTo(x + 12, headY - 2);
    ctx.closePath();
    ctx.fill();
  }

  ctx.fillStyle = style.fur;
  ctx.beginPath();
  ctx.arc(x, headY, 11, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = style.outfit;
  roundedRect(x - 8, bodyY, 16, 14, 6);
  ctx.fill();

  ctx.fillStyle = style.accent;
  ctx.fillRect(x - 8, bodyY + 6, 16, 4);

  ctx.strokeStyle = "#3a2f4c";
  ctx.lineWidth = 1;
  if (blink) {
    ctx.beginPath();
    ctx.moveTo(x - 6, headY - 2);
    ctx.lineTo(x - 2, headY - 2);
    ctx.moveTo(x + 2, headY - 2);
    ctx.lineTo(x + 6, headY - 2);
    ctx.stroke();
  } else {
    ctx.fillStyle = "#3a2f4c";
    ctx.beginPath();
    ctx.arc(x - 4, headY - 2, 2.2, 0, Math.PI * 2);
    ctx.arc(x + 4, headY - 2, 2.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(x - 3, headY - 3, 0.8, 0, Math.PI * 2);
    ctx.arc(x + 5, headY - 3, 0.8, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.beginPath();
  ctx.moveTo(x - 1, headY + 3);
  ctx.lineTo(x + 1, headY + 3);
  ctx.stroke();

  ctx.fillStyle = style.blush;
  ctx.beginPath();
  ctx.arc(x - 6, headY + 4, 2, 0, Math.PI * 2);
  ctx.arc(x + 6, headY + 4, 2, 0, Math.PI * 2);
  ctx.fill();

  if (style.accessory === "bow") {
    ctx.fillStyle = "#ff9cc8";
    ctx.fillRect(x - 6, headY - 12, 12, 4);
    ctx.fillRect(x - 2, headY - 14, 4, 8);
  }
  if (style.accessory === "scarf") {
    ctx.fillStyle = "#ffd87a";
    ctx.fillRect(x - 8, bodyY + 2, 16, 4);
  }
  if (style.accessory === "flower") {
    ctx.fillStyle = "#ff9cc8";
    ctx.beginPath();
    ctx.arc(x + 6, headY - 8, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  if (style.accessory === "hat" && isPlayer) {
    ctx.fillStyle = "#7fd9c7";
    ctx.fillRect(x - 8, headY - 12, 16, 4);
    ctx.fillRect(x - 4, headY - 18, 8, 6);
  }
}

function activeMap() {
  return currentScene === "village" ? map : homeMap;
}

function activeSolid() {
  return currentScene === "village" ? solid : homeSolid;
}

function roundedRect(x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
}

function drawSpeechBubble(x, y, text, color = "#ffffff") {
  ctx.save();
  const padding = 6;
  const width = Math.max(24, text.length * 7) + padding * 2;
  const height = 20;
  const bubbleX = x - width / 2;
  const bubbleY = y - 34;
  ctx.fillStyle = color;
  roundedRect(bubbleX, bubbleY, width, height, 8);
  ctx.fill();
  ctx.fillStyle = "#3a2f4c";
  ctx.font = "12px \"Cherry Pop\", sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, x, bubbleY + height / 2 + 1);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x - 6, bubbleY + height);
  ctx.lineTo(x + 6, bubbleY + height);
  ctx.lineTo(x, bubbleY + height + 6);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawLighting() {
  const hour = Math.floor(state.timeMinutes / 60);
  let color = "#ffffff";
  let alpha = 0.02;

  if (hour >= 5 && hour < 8) {
    color = "#ffe9c9";
    alpha = 0.12;
  } else if (hour >= 8 && hour < 16) {
    color = "#ffffff";
    alpha = 0.02;
  } else if (hour >= 16 && hour < 19) {
    color = "#ffbfa1";
    alpha = 0.2;
  } else if (hour >= 19 && hour < 22) {
    color = "#7b6aa6";
    alpha = 0.3;
  } else {
    color = "#2a2b55";
    alpha = 0.5;
  }

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.restore();
}

function drawFade() {
  if (state.fade <= 0) return;
  ctx.save();
  ctx.globalAlpha = Math.min(1, state.fade);
  ctx.fillStyle = "#1d1730";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.restore();
}

const pixelFont = {
  "A": ["01110","10001","10001","11111","10001","10001","10001"],
  "B": ["11110","10001","10001","11110","10001","10001","11110"],
  "C": ["01110","10001","10000","10000","10000","10001","01110"],
  "D": ["11110","10001","10001","10001","10001","10001","11110"],
  "E": ["11111","10000","10000","11110","10000","10000","11111"],
  "F": ["11111","10000","10000","11110","10000","10000","10000"],
  "G": ["01110","10001","10000","10111","10001","10001","01110"],
  "H": ["10001","10001","10001","11111","10001","10001","10001"],
  "I": ["01110","00100","00100","00100","00100","00100","01110"],
  "J": ["00111","00010","00010","00010","00010","10010","01100"],
  "K": ["10001","10010","10100","11000","10100","10010","10001"],
  "L": ["10000","10000","10000","10000","10000","10000","11111"],
  "M": ["10001","11011","10101","10101","10001","10001","10001"],
  "N": ["10001","11001","10101","10011","10001","10001","10001"],
  "O": ["01110","10001","10001","10001","10001","10001","01110"],
  "P": ["11110","10001","10001","11110","10000","10000","10000"],
  "Q": ["01110","10001","10001","10001","10101","10010","01101"],
  "R": ["11110","10001","10001","11110","10100","10010","10001"],
  "S": ["01111","10000","10000","01110","00001","00001","11110"],
  "T": ["11111","00100","00100","00100","00100","00100","00100"],
  "U": ["10001","10001","10001","10001","10001","10001","01110"],
  "V": ["10001","10001","10001","10001","10001","01010","00100"],
  "W": ["10001","10001","10001","10101","10101","11011","10001"],
  "X": ["10001","10001","01010","00100","01010","10001","10001"],
  "Y": ["10001","10001","01010","00100","00100","00100","00100"],
  "Z": ["11111","00001","00010","00100","01000","10000","11111"],
  "0": ["01110","10001","10011","10101","11001","10001","01110"],
  "1": ["00100","01100","00100","00100","00100","00100","01110"],
  "2": ["01110","10001","00001","00010","00100","01000","11111"],
  "3": ["11110","00001","00001","01110","00001","00001","11110"],
  "4": ["00010","00110","01010","10010","11111","00010","00010"],
  "5": ["11111","10000","10000","11110","00001","00001","11110"],
  "6": ["01110","10000","10000","11110","10001","10001","01110"],
  "7": ["11111","00001","00010","00100","01000","01000","01000"],
  "8": ["01110","10001","10001","01110","10001","10001","01110"],
  "9": ["01110","10001","10001","01111","00001","00001","01110"],
  ".": ["00000","00000","00000","00000","00000","01100","01100"],
  ",": ["00000","00000","00000","00000","01100","01100","00100"],
  "!": ["00100","00100","00100","00100","00100","00000","00100"],
  "?": ["01110","10001","00001","00010","00100","00000","00100"],
  ":": ["00000","01100","01100","00000","01100","01100","00000"],
  "'": ["00100","00100","00000","00000","00000","00000","00000"],
  "-": ["00000","00000","00000","11111","00000","00000","00000"],
  " ": ["00000","00000","00000","00000","00000","00000","00000"]
};

function drawPixelText(text, x, y, scale, color) {
  const upper = text.toUpperCase();
  ctx.fillStyle = color;
  let cursor = x;
  for (const ch of upper) {
    const glyph = pixelFont[ch] || pixelFont[" "];
    for (let row = 0; row < glyph.length; row++) {
      for (let col = 0; col < glyph[row].length; col++) {
        if (glyph[row][col] === "1") {
          ctx.fillRect(cursor + col * scale, y + row * scale, scale, scale);
          ctx.fillRect(cursor + col * scale + 1, y + row * scale, scale, scale);
        }
      }
    }
    cursor += (glyph[0].length + 1) * scale;
  }
}

function drawDialogueBox() {
  if (!state.dialogueText || state.dialogueTimer <= 0) return;
  const padding = 10;
  const hasPrices = state.dialogueOptions.some(opt => typeof opt === "object" && opt.price != null);
  const rowHeight = hasPrices ? 34 : 18;
  const boxHeight = state.dialogueOptions.length
    ? 40 + (state.dialogueLayout === "row" ? rowHeight : state.dialogueOptions.length * 14)
    : 56;
  const boxY = canvas.height - boxHeight - 12;
  const boxX = 24;
  const boxW = canvas.width - 48;
  state.dialogueBox = { x: boxX, y: boxY, w: boxW, h: boxHeight };

  ctx.save();
  ctx.globalAlpha = 0.85;
  ctx.fillStyle = "#2a223a";
  ctx.fillRect(boxX, boxY, boxW, boxHeight);
  ctx.globalAlpha = 1;
  ctx.strokeStyle = "#f6e6a8";
  ctx.lineWidth = 2;
  ctx.strokeRect(boxX, boxY, boxW, boxHeight);
  ctx.restore();

  drawPixelText(state.dialogueText, boxX + padding, boxY + 16, 2, "#f6e6a8");
  state.optionRects = [];
  if (state.dialogueOptions.length) {
    const optionY = boxY + 36;
    let cursorX = boxX + padding;
    state.dialogueOptions.forEach((opt, i) => {
      const isObj = typeof opt === "object";
      const label = isObj ? opt.label : opt;
      const price = isObj && opt.price != null ? `${opt.price}c` : "";
      const line1 = `> ${label}`;
      const line2 = price ? `  ${price}` : "";
      const width = (line1.length + 2) * 6 * 2;
      const height = price ? 26 : 18;
      const rect = { x: cursorX - 4, y: optionY - 6, w: width, h: height, index: i };
      if (i === state.dialogueIndex) {
        ctx.fillStyle = "rgba(246,230,168,0.2)";
        ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
      }
      drawPixelText(line1, cursorX, optionY, 2, "#f6e6a8");
      if (price) {
        drawPixelText(line2, cursorX, optionY + 12, 2, "#f6e6a8");
      }
      state.optionRects.push(rect);
      cursorX += width + 12;
    });
  }
}

function drawFarmPlot(plot) {
  const x = plot.c * TILE;
  const y = plot.r * TILE;
  ctx.fillStyle = plot.watered ? palette.soilWet : palette.soil;
  ctx.fillRect(x, y, TILE, TILE);
  ctx.fillStyle = plot.watered ? "#9c6b4d" : "#b88863";
  ctx.fillRect(x + 4, y + 6, 24, 2);
  ctx.fillRect(x + 4, y + 18, 24, 2);

  if (plot.planted) {
    const crop = cropCatalog[plot.cropId] || cropCatalog.sprout;
    const stage = Math.min(3, Math.floor((plot.growTime / crop.growSeconds) * 3) + 1);
    ctx.fillStyle = plot.growTime >= crop.growSeconds ? palette.cropReady : palette.crop;
    const size = 6 + stage * 3;
    ctx.beginPath();
    ctx.arc(x + TILE / 2, y + TILE / 2, size / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#4f9d4f";
    ctx.fillRect(x + 14, y + 10, 2, 6);
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const currentMap = activeMap();
  if (currentScene === "village") {
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        drawTile(r, c, currentMap[r][c]);
      }
    }
    for (const plot of farmPlots) drawFarmPlot(plot);

    for (const flower of decor.flowers) drawFlower(flower.r, flower.c);
    for (const bush of decor.bushes) drawBush(bush.r, bush.c);
    for (const rock of decor.rocks) drawRock(rock.r, rock.c);
    for (const bench of decor.benches) drawBench(bench.r, bench.c);
    for (const box of decor.mailboxes) drawMailbox(box.r, box.c);
    for (const sign of decor.signs) drawSign(sign.r, sign.c);
    for (const lamp of decor.lanterns) drawLamp(lamp.r, lamp.c);
    drawWell(decor.well.r, decor.well.c);
    drawStall(decor.stall.r, decor.stall.c);

    for (const fence of fences) drawFence(fence.r, fence.c);

    for (const house of buildings) drawHouse(house);
    for (const tree of trees) drawTree(tree);

    for (const tile of bridgeTiles) {
      const [r, c] = tile.split(",").map(Number);
      drawBridgeTile(r, c);
    }

    const actors = [...npcs.map(npc => ({ ...npc, isPlayer: false })), { ...player, isPlayer: true }];
    actors.sort((a, b) => a.y - b.y);
    for (const actor of actors) {
      const x = actor.x * TILE + TILE / 2;
      const y = actor.y * TILE + TILE / 2;
      drawKawaiiSprite(x, y, actor.style, actor.isPlayer, actor.x + actor.y + (actor.blinkOffset || 0));
    }
  } else {
    const interiorW = INTERIOR_COLS * TILE;
    const interiorH = INTERIOR_ROWS * TILE;
    const interiorX = (canvas.width - interiorW) / 2;
    const interiorY = (canvas.height - interiorH) / 2;
    const offsetX = interiorX - INTERIOR_OFFSET.c * TILE;
    const offsetY = interiorY - INTERIOR_OFFSET.r * TILE;

    ctx.save();
    ctx.translate(offsetX, offsetY);

    for (let r = INTERIOR_OFFSET.r; r < INTERIOR_OFFSET.r + INTERIOR_ROWS; r++) {
      for (let c = INTERIOR_OFFSET.c; c < INTERIOR_OFFSET.c + INTERIOR_COLS; c++) {
        drawTile(r, c, currentMap[r][c]);
      }
    }

    drawInteriorDecor();
    for (const item of homeFurniture) {
      drawFurnitureItem(item);
    }
    const x = player.x * TILE + TILE / 2;
    const y = player.y * TILE + TILE / 2;
    drawKawaiiSprite(x, y, player.style, true, player.x + player.y);

    ctx.restore();

    // Brown border around interior
    ctx.save();
    ctx.strokeStyle = palette.border;
    ctx.lineWidth = 6;
    ctx.strokeRect(interiorX - 3, interiorY - 3, interiorW + 6, interiorH + 6);
    ctx.strokeStyle = palette.borderDark;
    ctx.lineWidth = 2;
    ctx.strokeRect(interiorX - 6, interiorY - 6, interiorW + 12, interiorH + 12);
    ctx.restore();
  }

  drawLighting();
  drawDialogueBox();
  drawFade();

  if (currentScene === "village") {
    for (const npc of npcs) {
      const dist = Math.hypot(player.x - npc.x, player.y - npc.y);
      if (dist < 1.4) {
        const bubble = getNpcBubble(npc);
        const x = npc.x * TILE + TILE / 2;
        const y = npc.y * TILE + TILE / 2;
        drawSpeechBubble(x, y, bubble.text, bubble.color);
      }
    }
  }
}

function getQuestForNpc(npc) {
  if (!npc.questId) return null;
  return quests[npc.questId] || null;
}

function getNpcBubble(npc) {
  const quest = getQuestForNpc(npc);
  if (quest) {
    if (!quest.accepted) return { text: "E!", color: "#fff6bf" };
    if (!quest.completed && quest.progress() >= quest.required) return { text: "E!", color: "#d7ffe4" };
    if (!quest.completed) return { text: "E...", color: "#e6f3ff" };
  }
  return { text: "E", color: "#ffffff" };
}

function getPlotAt(r, c) {
  if (currentScene !== "village") return null;
  return farmPlots.find(p => p.r === r && p.c === c);
}

function isWalkable(r, c) {
  if (r < 0 || c < 0 || r >= ROWS || c >= COLS) return false;
  if (activeSolid()[r][c]) return false;
  return true;
}

function isNpcBlocking(x, y) {
  if (currentScene !== "village") return false;
  for (const npc of npcs) {
    const dist = Math.hypot(x - npc.x, y - npc.y);
    if (dist < 0.6) return true;
  }
  return false;
}

function updatePlayer(dt) {
  let dx = 0, dy = 0;
  if (state.keys.has("ArrowUp") || state.keys.has("KeyW")) dy -= 1;
  if (state.keys.has("ArrowDown") || state.keys.has("KeyS")) dy += 1;
  if (state.keys.has("ArrowLeft") || state.keys.has("KeyA")) dx -= 1;
  if (state.keys.has("ArrowRight") || state.keys.has("KeyD")) dx += 1;

  if (dx || dy) {
    player.dir = { x: dx, y: dy };
  }

  const speed = player.speed * dt;
  const nextX = player.x + dx * speed;
  const nextY = player.y + dy * speed;

  if (isWalkable(Math.round(nextY), Math.round(nextX)) && !isNpcBlocking(nextX, nextY)) {
    player.x = nextX;
    player.y = nextY;
  }

  // Auto-enter/exit when touching door
  if (state.fadeState === "none" && state.doorCooldown <= 0) {
    const tile = getPlayerTile();
    if (currentScene === "village") {
      const door = houseDoors.find(d => d.r === tile.r && d.c === tile.c);
      if (door) {
        activeReturnDoor = { r: door.r, c: door.c };
        state.inOwnHome = door.isPlayer;
        startSceneTransition("home", homeSpawn);
        showHint(door.isPlayer ? "Welcome home!" : "You are visiting.");
        state.doorCooldown = 0.6;
      }
    } else {
      if (tile.r === homeDoor.r && tile.c === homeDoor.c) {
        const spawn = { x: activeReturnDoor.c, y: activeReturnDoor.r + 1 };
        startSceneTransition("village", spawn);
        state.inOwnHome = false;
        showHint("Back outside!");
        state.doorCooldown = 0.6;
      }
    }
  }
}

function updateNPCs(dt) {
  if (currentScene !== "village") return;
  for (const npc of npcs) {
    npc.follow = false;
    npc.x = npc.home.x;
    npc.y = npc.home.y;
  }
}

function showHint(text) {
  ui.hint.textContent = text;
  ui.hint.classList.add("show");
  clearTimeout(showHint.timeout);
  showHint.timeout = setTimeout(() => ui.hint.classList.remove("show"), 1800);
  state.dialogueText = text;
  state.dialogueTimer = 6;
}

function findNearbyNpc() {
  if (currentScene !== "village") return null;
  let closest = null;
  let minDist = 999;
  for (const npc of npcs) {
    const dist = Math.hypot(player.x - npc.x, player.y - npc.y);
    if (dist < 1.25 && dist < minDist) {
      closest = npc;
      minDist = dist;
    }
  }
  return closest;
}

function openInteraction(type, npc, text, options, layout = "list") {
  if (state.interaction) {
    state.dialogueStack.push({
      interaction: state.interaction,
      text: state.dialogueText,
      options: state.dialogueOptions,
      index: state.dialogueIndex,
      layout: state.dialogueLayout
    });
  }
  state.interaction = { type, npc: npc.name };
  state.dialogueText = text;
  state.dialogueOptions = options || [];
  state.dialogueIndex = 0;
  state.dialogueLayout = layout;
  state.dialogueTimer = 999;
  state.keys.clear();
}

function closeInteraction() {
  state.interaction = null;
  state.dialogueOptions = [];
  state.dialogueIndex = 0;
  state.dialogueLayout = "list";
  state.optionRects = [];
  state.dialogueText = "";
  state.dialogueTimer = 0;
  state.dialogueStack = [];
}

function closeDialogueOnly() {
  state.dialogueText = "";
  state.dialogueTimer = 0;
  state.dialogueOptions = [];
  state.optionRects = [];
}

function goBackDialogue() {
  const prev = state.dialogueStack.pop();
  if (!prev) {
    closeInteraction();
    return;
  }
  state.interaction = prev.interaction;
  state.dialogueText = prev.text;
  state.dialogueOptions = prev.options;
  state.dialogueIndex = prev.index;
  state.dialogueLayout = prev.layout;
  state.dialogueTimer = 999;
}

function buySeed(index) {
  const id = cropOrder[index];
  if (!id) return;
  const crop = cropCatalog[id];
  if (state.coins < crop.seedCost) {
    showHint(`${crop.name} seeds cost ${crop.seedCost} coins.`);
    return;
  }
  state.coins -= crop.seedCost;
  seedInventory[id] += 1;
  updateHud();
  showHint(`Bought ${crop.name} seeds.`);
}

function buySeedById(id) {
  const crop = cropCatalog[id];
  if (!crop) return;
  if (state.coins < crop.seedCost) {
    showHint(`${crop.name} seeds cost ${crop.seedCost} coins.`);
    return;
  }
  state.coins -= crop.seedCost;
  seedInventory[id] += 1;
  updateHud();
  showHint(`Bought ${crop.name} seeds.`);
}

function sellCrops() {
  let total = 0;
  for (const id of cropOrder) {
    const count = cropInventory[id];
    if (count > 0) {
      total += count * cropCatalog[id].sell;
      cropInventory[id] = 0;
    }
  }
  if (total === 0) {
    showHint("No crops to sell.");
    return;
  }
  state.coins += total;
  updateHud();
  showHint(`Sold crops for ${total} coins.`);
}

function buyMeal() {
  const cost = 6;
  if (state.coins < cost) {
    showHint("Meal costs 6 coins.");
    return;
  }
  state.coins -= cost;
  state.energy = Math.min(100, state.energy + 25);
  updateHud();
  showHint("Warm meal restored energy.");
}

function setOptionsForRole(role) {
  if (role === "Farmer") {
    const opts = cropOrder.map(id => ({
      label: cropCatalog[id].name,
      price: cropCatalog[id].seedCost,
      action: "seed",
      id
    }));
    opts.push({ label: "Exit", action: "exit" });
    return opts;
  }
  if (role === "Cook") {
    return ["Warm Meal (6c)", "Exit"];
  }
  if (role === "Furniture") {
    const opts = furnitureOrder.map(id => `${furnitureCatalog[id].name} (${furnitureCatalog[id].cost}c)`);
    opts.push("Exit");
    return opts;
  }
  return ["OK"];
}

function performInteractionSelection() {
  if (!state.interaction) return;
  const role = npcs.find(n => n.name === state.interaction.npc)?.role;
  const index = state.dialogueIndex;
  if (state.interaction.type === "seedShop") {
    const option = state.dialogueOptions[index];
    if (option?.action === "seed") {
      buySeedById(option.id);
      return;
    }
    closeInteraction();
    return;
  }
  if (state.interaction.type === "farmerMenu") {
    if (index === 0) {
      // Quest option
      const quest = quests.picnic;
      if (!allIntroductionsComplete()) {
        showHint("Meet the others first, then I'll have a task.");
        return;
      }
      if (!quest.accepted) {
        quest.accepted = true;
        ui.objective.textContent = `${quest.title}: Harvest ${quest.required} crops.`;
        showHint(`Hana: ${quest.intro}`);
        return;
      }
      if (!quest.completed) {
        const progress = quest.progress();
        if (progress >= quest.required) {
          quest.completed = true;
          let remaining = quest.required;
          for (const id of cropOrder) {
            const take = Math.min(remaining, cropInventory[id]);
            cropInventory[id] -= take;
            remaining -= take;
          }
          updateHud();
          ui.objective.textContent = "Picnic ready! Hana is happy.";
          showHint("Hana: Thank you! The picnic sparkles now!");
        } else {
          showHint(`Hana: We still need ${quest.required - progress} crops.`);
        }
        return;
      }
      showHint("Hana: The picnic is ready!");
      return;
    }
    if (index === 1) {
      openInteraction("seedShop", { name: "Hana" }, "Hana: Pick a seed.", setOptionsForRole("Farmer"), "row");
      return;
    }
    closeInteraction();
    return;
  }
  if (state.interaction.type === "furnitureMenu") {
    if (index === 0) {
      openInteraction("furniture", { name: "Sora" }, "Sora: Pick a furniture item.", setOptionsForRole("Furniture"), "row");
      return;
    }
    closeInteraction();
    return;
  }
  if (role === "Farmer") {
    if (index <= 2) buySeed(index);
    else closeInteraction();
    return;
  }
  if (role === "Cook") {
    if (index === 0) buyMeal();
    else closeInteraction();
    return;
  }
  if (role === "Furniture") {
    const id = furnitureOrder[index];
    if (id) buyFurniture(id);
    else closeInteraction();
    return;
  }
  closeInteraction();
}

function talkToNpc(npc) {
  if (!quests.introductions.met[npc.name]) {
    quests.introductions.met[npc.name] = true;
    updateIntroObjective();
    showHint(`${npc.name}: Nice to meet you!`);
  }

  if (npc.role === "Farmer") {
    openInteraction("farmerMenu", npc, `${npc.name}: How can I help?`, ["Quest Help", "Seed Shop", "Exit"], "row");
    return;
  }

  const quest = getQuestForNpc(npc);
  if (quest && !quest.accepted) {
    if (!allIntroductionsComplete()) {
      showHint(`${npc.name}: Meet the others first, then I'll have a task.`);
      return;
    }
    quest.accepted = true;
    ui.objective.textContent = `${quest.title}: Harvest ${quest.required} crops.`;
    showHint(`${npc.name}: ${quest.intro}`);
    openInteraction("quest", npc);
    return;
  }

  if (quest && quest.accepted && !quest.completed) {
    const progress = quest.progress();
    if (progress >= quest.required) {
      quest.completed = true;
      let remaining = quest.required;
      for (const id of cropOrder) {
        const take = Math.min(remaining, cropInventory[id]);
        cropInventory[id] -= take;
        remaining -= take;
      }
      updateHud();
      ui.objective.textContent = "Picnic ready! Hana is happy.";
      showHint(`${npc.name}: Thank you! The picnic sparkles now!`);
    } else {
      showHint(`${npc.name}: We still need ${quest.required - progress} crops.`);
    }
    return;
  }

  if (npc.role === "Furniture") {
    openInteraction("furnitureMenu", npc, `${npc.name}: Hi, how is it going?`, ["Furniture Shop", "Exit"], "list");
    return;
  }
  if (npc.role === "Cook") {
    openInteraction("cook", npc, `${npc.name}: Want a warm meal?`, setOptionsForRole("Cook"));
    return;
  }
  if (npc.role === "Pet") {
    if (!state.petAdopted) {
      state.petAdopted = true;
      showHint(`${npc.name}: The pet is yours now.`);
    } else {
      showHint(`${npc.name}: Pet is happy to see you.`);
    }
    return;
  }

  showHint(`${npc.name}: ${npc.mood}`);
}

function interact() {
  if (state.fadeState !== "none") return;

  if (isFacingStall()) {
    buyFurniture();
    return;
  }

  const npc = findNearbyNpc();
  if (npc) {
    talkToNpc(npc);
    return;
  }

  const target = getPlayerTile();
  const targetR = target.r;
  const targetC = target.c;
  const plot = getPlotAt(targetR, targetC);

  if (plot) {
    if (!plot.planted) {
      showHint("Plant with Q.");
      return;
    }
    if (!plot.watered) {
      plot.watered = true;
      state.energy = Math.max(0, state.energy - 4);
      updateHud();
      showHint("Watered!");
      return;
    }
    const crop = cropCatalog[plot.cropId] || cropCatalog.sprout;
    if (plot.growTime >= crop.growSeconds) {
      plot.planted = false;
      plot.watered = false;
      plot.growTime = 0;
      cropInventory[crop ? plot.cropId : "sprout"] += 1;
      state.energy = Math.max(0, state.energy - 2);
      updateHud();
      showHint(`Harvested ${crop.name}!`);
      return;
    }
  }

  showHint("Nothing to do here.");
}

function plantSeed() {
  const target = getPlayerTile();
  const targetR = target.r;
  const targetC = target.c;
  const plot = getPlotAt(targetR, targetC);
  if (!plot) {
    showHint("Stand on tilled soil to plant.");
    return;
  }
  if (plot.planted) {
    showHint("Already planted.");
    return;
  }
  if (seedInventory[selectedCropId] <= 0) {
    showHint("No seeds. Buy from the Farmer.");
    return;
  }
  plot.planted = true;
  plot.growTime = 0;
  plot.watered = false;
  plot.cropId = selectedCropId;
  seedInventory[selectedCropId] -= 1;
  state.energy = Math.max(0, state.energy - 3);
  updateHud();
  const crop = cropCatalog[selectedCropId];
  showHint(`Planted ${crop.name} seeds.`);
}

function advanceDay() {
  state.day += 1;
  state.energy = 100;
  updateHud();
}

function updateTime(dt) {
  state.timeAccumulator += dt;
  while (state.timeAccumulator >= REAL_SECONDS_PER_INGAME_MINUTE) {
    state.timeAccumulator -= REAL_SECONDS_PER_INGAME_MINUTE;
    state.timeMinutes += 1;
    if (state.timeMinutes >= DAY_MINUTES) {
      state.timeMinutes = 0;
      advanceDay();
    }
  }
  const hour = Math.floor(state.timeMinutes / 60);
  const minute = state.timeMinutes % 60;
  const labels = ["Morning", "Noon", "Evening", "Night"];
  const timeOfDay = hour < 6 ? 3 : hour < 12 ? 0 : hour < 17 ? 1 : hour < 21 ? 2 : 3;
  ui.time.textContent = `Day ${state.day} • ${labels[timeOfDay]} • ${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function updateHud() {
  ui.energy.style.width = `${state.energy}%`;
  state.bag = totalCrops();
  ui.bag.textContent = `${state.bag}`;
  ui.coins.textContent = `${state.coins}`;
  ui.hemisphere.textContent = state.hemisphere === "north" ? "North" : "South";
  if (ui.season) {
    ui.season.textContent = `${getSeasonLabel()} Season`;
  }
  if (ui.furniture) {
    const lines = furnitureOrder.map((id, index) => {
      const def = furnitureCatalog[id];
      const count = furnitureInventory[id];
      const selected = index === state.selectedFurnitureIndex ? " (selected)" : "";
      return `${index + 1}. ${def.name}: ${count}${selected}`;
    });
    ui.furniture.innerHTML = lines.join("<br>");
  }
}

function totalCrops() {
  return Object.values(cropInventory).reduce((sum, value) => sum + value, 0);
}
quests.picnic.progress = totalCrops;

function getSeasonLabel() {
  const month = new Date().getMonth();
  const north = state.hemisphere === "north";
  if (month >= 2 && month <= 4) return north ? "Spring" : "Autumn";
  if (month >= 5 && month <= 7) return north ? "Summer" : "Winter";
  if (month >= 8 && month <= 10) return north ? "Autumn" : "Spring";
  return north ? "Winter" : "Summer";
}

function saveGame() {
  const saveData = {
    day: state.day,
    timeMinutes: state.timeMinutes,
    energy: state.energy,
    coins: state.coins,
    hemisphere: state.hemisphere,
    selectedCropId,
    seedInventory,
    cropInventory,
    furnitureInventory,
    homeFurniture,
    quests: {
      picnic: {
        accepted: quests.picnic.accepted,
        completed: quests.picnic.completed
      },
      introductions: quests.introductions
    },
    petAdopted: state.petAdopted
  };
  localStorage.setItem("kawaiiVillageSave", JSON.stringify(saveData));
}

function loadGame() {
  const raw = localStorage.getItem("kawaiiVillageSave");
  if (!raw) return;
  try {
    const data = JSON.parse(raw);
    state.day = data.day ?? state.day;
    state.timeMinutes = data.timeMinutes ?? state.timeMinutes;
    state.energy = data.energy ?? state.energy;
    state.coins = data.coins ?? state.coins;
    state.hemisphere = data.hemisphere ?? state.hemisphere;
    setSelectedCropId(data.selectedCropId ?? selectedCropId);
    Object.assign(seedInventory, data.seedInventory || {});
    Object.assign(cropInventory, data.cropInventory || {});
    Object.assign(furnitureInventory, data.furnitureInventory || {});
    if (Array.isArray(data.homeFurniture)) {
      homeFurniture.length = 0;
      for (const item of data.homeFurniture) {
        const def = furnitureCatalog[item.id];
        if (!def) continue;
        const size = getFurnitureSize(def, item.rotation || 0);
        const minR = INTERIOR_OFFSET.r;
        const minC = INTERIOR_OFFSET.c;
        const maxR = INTERIOR_OFFSET.r + INTERIOR_ROWS - size.h;
        const maxC = INTERIOR_OFFSET.c + INTERIOR_COLS - size.w;
        const r = Math.min(Math.max(item.r, minR), maxR);
        const c = Math.min(Math.max(item.c, minC), maxC);
        homeFurniture.push({ ...item, r, c });
      }
    }
    quests.picnic.accepted = data.quests?.picnic?.accepted ?? quests.picnic.accepted;
    quests.picnic.completed = data.quests?.picnic?.completed ?? quests.picnic.completed;
    if (data.quests?.introductions?.met) {
      quests.introductions.met = { ...quests.introductions.met, ...data.quests.introductions.met };
    }
    state.petAdopted = data.petAdopted ?? state.petAdopted;
  } catch (err) {
    console.warn("Save load failed", err);
  }
}

function getSelectedFurnitureId() {
  return furnitureOrder[state.selectedFurnitureIndex] || furnitureOrder[0];
}

function selectFurniture(index) {
  state.selectedFurnitureIndex = Math.max(0, Math.min(furnitureOrder.length - 1, index));
  const def = furnitureCatalog[getSelectedFurnitureId()];
  updateHud();
  showHint(`Selected ${def.name}.`);
}

function getFacingTile() {
  return {
    r: Math.round(player.y + player.dir.y),
    c: Math.round(player.x + player.dir.x)
  };
}

function getPlayerTile() {
  return {
    r: Math.round(player.y),
    c: Math.round(player.x)
  };
}

function findFurnitureAt(r, c) {
  for (const item of homeFurniture) {
    const def = furnitureCatalog[item.id];
    const size = getFurnitureSize(def, item.rotation);
    if (r >= item.r && r < item.r + size.h && c >= item.c && c < item.c + size.w) {
      return item;
    }
  }
  return null;
}

function canPlaceFurnitureAt(r, c, def, rotation) {
  const size = getFurnitureSize(def, rotation);
  for (let rr = r; rr < r + size.h; rr++) {
    for (let cc = c; cc < c + size.w; cc++) {
      if (rr < INTERIOR_OFFSET.r || cc < INTERIOR_OFFSET.c) return false;
      if (rr >= INTERIOR_OFFSET.r + INTERIOR_ROWS || cc >= INTERIOR_OFFSET.c + INTERIOR_COLS) return false;
      if (homeMap[rr][cc] === "wall") return false;
      if (rr === homeDoor.r && cc === homeDoor.c) return false;
      if (findFurnitureAt(rr, cc)) return false;
    }
  }
  return true;
}

function placeFurniture() {
  if (currentScene !== "home") {
    showHint("Place furniture inside your home.");
    return;
  }
  if (!state.inOwnHome) {
    showHint("You can't rearrange someone else's home.");
    return;
  }
  const id = getSelectedFurnitureId();
  const def = furnitureCatalog[id];
  if (furnitureInventory[id] <= 0) {
    showHint("No more of that item. Buy at the stall.");
    return;
  }
  const target = getFacingTile();
  if (!canPlaceFurnitureAt(target.r, target.c, def, state.furnitureRotation)) {
    showHint("Can't place here.");
    return;
  }
  homeFurniture.push({ id, r: target.r, c: target.c, rotation: state.furnitureRotation });
  furnitureInventory[id] -= 1;
  buildHomeSolids();
  updateHud();
  showHint(`Placed ${def.name}.`);
}

function pickupFurniture() {
  if (currentScene !== "home") return;
  if (!state.inOwnHome) {
    showHint("You can't rearrange someone else's home.");
    return;
  }
  const target = getFacingTile();
  const item = findFurnitureAt(target.r, target.c);
  if (!item) {
    showHint("No furniture to pick up.");
    return;
  }
  const def = furnitureCatalog[item.id];
  const index = homeFurniture.indexOf(item);
  homeFurniture.splice(index, 1);
  furnitureInventory[item.id] += 1;
  buildHomeSolids();
  updateHud();
  showHint(`Picked up ${def.name}.`);
}

function rotateFurniture() {
  state.furnitureRotation = (state.furnitureRotation + 1) % 2;
  showHint("Rotation toggled.");
}

function findSafeSpawn(spawn) {
  const candidates = [
    spawn,
    { x: spawn.x, y: spawn.y + 1 },
    { x: spawn.x, y: spawn.y - 1 },
    { x: spawn.x + 1, y: spawn.y },
    { x: spawn.x - 1, y: spawn.y }
  ];
  for (const candidate of candidates) {
    if (isWalkable(Math.round(candidate.y), Math.round(candidate.x))) {
      return candidate;
    }
  }
  return spawn;
}

function changeScene(sceneName, spawn) {
  setScene(sceneName);
  if (sceneName === "village") {
    buildVillageSolids();
  } else {
    buildHomeSolids();
  }
  const safe = findSafeSpawn(spawn);
  player.x = safe.x;
  player.y = safe.y;
}

function startSceneTransition(sceneName, spawn) {
  state.fadeState = "in";
  state.fade = 0;
  state.fadeTargetScene = sceneName;
  state.fadeSpawn = spawn;
}

function getFacingDoor() {
  const target = getFacingTile();
  const current = getPlayerTile();
  if (currentScene === "village") {
    return (
      houseDoors.find(door => door.r === target.r && door.c === target.c) ||
      houseDoors.find(door => door.r === current.r && door.c === current.c) ||
      null
    );
  }
  if ((target.r === homeDoor.r && target.c === homeDoor.c) ||
      (current.r === homeDoor.r && current.c === homeDoor.c)) {
    return { r: homeDoor.r, c: homeDoor.c };
  }
  return null;
}

function isFacingStall() {
  const target = getFacingTile();
  return currentScene === "village" && target.r === decor.stall.r && target.c === decor.stall.c;
}

function buyFurniture(id = getSelectedFurnitureId()) {
  const def = furnitureCatalog[id];
  if (state.coins < def.cost) {
    showHint(`${def.name} costs ${def.cost} coins.`);
    return;
  }
  state.coins -= def.cost;
  furnitureInventory[id] += 1;
  updateHud();
  showHint(`Bought ${def.name}.`);
}

function updateQuestState() {
  const quest = quests.picnic;
  if (!quest.accepted) return;
  if (quest.completed) {
    ui.objective.textContent = "Picnic ready! Hana is happy.";
    return;
  }
  if (quest.progress() >= quest.required) {
    ui.objective.textContent = "Bring crops to Hana.";
  } else {
    ui.objective.textContent = `${quest.title}: Harvest ${quest.required} crops.`;
  }
}

function updateIntroObjective() {
  const order = quests.introductions.order;
  for (const name of order) {
    if (!quests.introductions.met[name]) {
      ui.objective.textContent = `Introduce yourself to ${name}.`;
      return;
    }
  }
  if (!quests.picnic.accepted && !quests.picnic.completed) {
    ui.objective.textContent = "Talk to Hana for your first task.";
  }
}

function allIntroductionsComplete() {
  return quests.introductions.order.every(name => quests.introductions.met[name]);
}

function updateInteraction() {
  if (!state.interaction) return;
  if (currentScene !== "village") {
    closeInteraction();
    return;
  }
  const npc = findNearbyNpc();
  if (!npc || npc.name !== state.interaction.npc) {
    closeInteraction();
  }
}

function buildVillageSolids() {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      solid[r][c] = false;
      if (map[r][c] === "water") setSolidPoint(r, c, true);
    }
  }

  for (const house of buildings) {
    setSolidRect(house.x, house.y + 1, house.w, house.h, true);
  }

  for (const tree of trees) {
    setSolidPoint(tree.y, tree.x, true);
  }

  for (const fence of fences) {
    setSolidPoint(fence.r, fence.c, true);
  }

  for (const bush of decor.bushes) setSolidPoint(bush.r, bush.c, true);
  for (const rock of decor.rocks) setSolidPoint(rock.r, rock.c, true);
  for (const lamp of decor.lanterns) setSolidPoint(lamp.r, lamp.c, true);
  for (const sign of decor.signs) setSolidPoint(sign.r, sign.c, true);
  setSolidPoint(decor.well.r, decor.well.c, true);
  setSolidPoint(decor.stall.r, decor.stall.c, true);

  for (const tile of bridgeTiles) {
    const [r, c] = tile.split(",").map(Number);
    setSolidPoint(r, c, false);
  }

  for (const tile of dockTiles) {
    const [r, c] = tile.split(",").map(Number);
    setSolidPoint(r, c, false);
  }
  for (const tile of walkableWaterTiles) {
    const [r, c] = tile.split(",").map(Number);
    setSolidPoint(r, c, false);
  }

  for (const door of houseDoors) {
    setSolidPoint(door.r, door.c, false);
  }
}

function buildHomeSolids() {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      homeSolid[r][c] = false;
      if (homeMap[r][c] === "wall") setSolidPoint(r, c, true, homeSolid);
    }
  }

  if (state.inOwnHome) {
    for (const item of homeFurniture) {
      const def = furnitureCatalog[item.id];
      const size = getFurnitureSize(def, item.rotation);
      for (let rr = item.r; rr < item.r + size.h; rr++) {
        for (let cc = item.c; cc < item.c + size.w; cc++) {
          setSolidPoint(rr, cc, true, homeSolid);
        }
      }
    }
  }

  setSolidPoint(homeDoor.r, homeDoor.c, false, homeSolid);
}

function gameLoop(timestamp) {
  const dt = Math.min(0.05, (timestamp - state.lastAction) / 1000 || 0.016);
  state.lastAction = timestamp;
  state.tick += dt;
  state.saveTimer += dt;
  state.dialogueTimer = Math.max(0, state.dialogueTimer - dt);
  state.doorCooldown = Math.max(0, state.doorCooldown - dt);
  if (state.fadeState === "in") {
    state.fade += dt * 2;
    if (state.fade >= 1) {
      changeScene(state.fadeTargetScene, state.fadeSpawn);
      state.fade = 1;
      state.fadeState = "out";
    }
  } else if (state.fadeState === "out") {
    state.fade -= dt * 2;
    if (state.fade <= 0) {
      state.fade = 0;
      state.fadeState = "none";
    }
  }

  updatePlayer(dt);
  updateNPCs(dt);
  updateTime(dt);
  updateQuestState();
  updateInteraction();
  for (const plot of farmPlots) {
    if (plot.planted && plot.watered) {
      const crop = cropCatalog[plot.cropId] || cropCatalog.sprout;
      plot.growTime = Math.min(crop.growSeconds, plot.growTime + dt);
    }
  }
  draw();
  if (state.saveTimer > 10) {
    state.saveTimer = 0;
    saveGame();
  }

  requestAnimationFrame(gameLoop);
}

window.addEventListener("keydown", (e) => {
  if (state.interaction) {
    if (e.code === "ArrowUp" || e.code === "ArrowLeft") {
      state.dialogueIndex = (state.dialogueIndex - 1 + state.dialogueOptions.length) % state.dialogueOptions.length;
      return;
    }
    if (e.code === "ArrowDown" || e.code === "ArrowRight") {
      state.dialogueIndex = (state.dialogueIndex + 1) % state.dialogueOptions.length;
      return;
    }
    if (e.code === "Enter") {
      if (state.dialogueOptions.length) {
        performInteractionSelection();
      } else {
        closeInteraction();
        closeDialogueOnly();
      }
      return;
    }
    if (e.code === "Escape" || e.code === "KeyB") {
      goBackDialogue();
      return;
    }
  }

  if (!state.interaction && e.code === "Enter" && state.dialogueText) {
    closeDialogueOnly();
    return;
  }

  state.keys.add(e.code);
  if (e.code === "KeyE") interact();
  if (e.code === "KeyQ") plantSeed();
  if (e.code === "KeyF") placeFurniture();
  if (e.code === "KeyX") pickupFurniture();
  if (e.code === "KeyR") rotateFurniture();
  if (e.code === "KeyH") {
    state.hemisphere = state.hemisphere === "north" ? "south" : "north";
    updateHud();
    showHint(`Hemisphere: ${state.hemisphere === "north" ? "North" : "South"}`);
  }
});

canvas.addEventListener("mousemove", (e) => {
  const rect = canvas.getBoundingClientRect();
  state.mouse.x = e.clientX - rect.left;
  state.mouse.y = e.clientY - rect.top;
});

canvas.addEventListener("click", () => {
  const hit = state.optionRects.find(
    rect => state.mouse.x >= rect.x && state.mouse.x <= rect.x + rect.w &&
            state.mouse.y >= rect.y && state.mouse.y <= rect.y + rect.h
  );
  if (hit) {
    state.dialogueIndex = hit.index;
    performInteractionSelection();
    return;
  }
  const box = state.dialogueBox;
  if (box &&
      state.mouse.x >= box.x && state.mouse.x <= box.x + box.w &&
      state.mouse.y >= box.y && state.mouse.y <= box.y + box.h) {
    if (state.interaction) closeInteraction();
    else closeDialogueOnly();
  }
});

window.addEventListener("keyup", (e) => state.keys.delete(e.code));

loadGame();
buildVillageSolids();
buildHomeSolids();
updateHud();
updateTime(0);
updateIntroObjective();
if (ui.dialogue && !ui.dialogue.textContent) {
  ui.dialogue.textContent = "Welcome to the island!";
}
requestAnimationFrame(gameLoop);
