export const TILE = 32;
export const COLS = 30;
export const ROWS = 16;

export const INTERIOR_COLS = 10;
export const INTERIOR_ROWS = 10;
export const INTERIOR_OFFSET = {
  c: Math.floor((COLS - INTERIOR_COLS) / 2),
  r: Math.floor((ROWS - INTERIOR_ROWS) / 2)
};

export const REAL_SECONDS_PER_INGAME_MINUTE = 20;
export const DAY_MINUTES = 24 * 60;

export const ui = {
  time: document.getElementById("time"),
  season: document.getElementById("season"),
  coins: document.getElementById("coins"),
  hemisphere: document.getElementById("hemisphere"),
  energy: document.getElementById("energyFill"),
  bag: document.getElementById("bag"),
  hint: document.getElementById("hint"),
  dialogue: document.getElementById("dialogue"),
  objective: document.getElementById("objective"),
  furniture: document.getElementById("furniture")
};

export const state = {
  day: 1,
  timeMinutes: 8 * 60,
  energy: 100,
  bag: 0,
  coins: 30,
  inOwnHome: false,
  hemisphere: "north",
  timeAccumulator: 0,
  petAdopted: false,
  interaction: null,
  saveTimer: 0,
  dialogueText: "",
  dialogueTimer: 0,
  dialogueOptions: [],
  dialogueIndex: 0,
  dialogueLayout: "list",
  optionRects: [],
  dialogueBox: null,
  mouse: { x: 0, y: 0, down: false },
  dialogueStack: [],
  fade: 0,
  fadeState: "none",
  fadeTargetScene: null,
  fadeSpawn: null,
  doorCooldown: 0,
  keys: new Set(),
  lastAction: 0,
  tick: 0,
  selectedFurnitureIndex: 0,
  furnitureRotation: 0
};

export let currentScene = "village";
export function setScene(name) {
  currentScene = name;
}
