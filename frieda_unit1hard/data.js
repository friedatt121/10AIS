import { INTERIOR_COLS, INTERIOR_ROWS, INTERIOR_OFFSET } from "./core.js";

export const palette = {
  grass: "#c9f6b7",
  grassDark: "#b6eaa6",
  path: "#f2d7a6",
  pathBrick: "#eec6a8",
  pathEdge: "#e7be90",
  dock: "#b8d8ff",
  dockEdge: "#8bb7e6",
  water: "#8fd3ff",
  waterDeep: "#6aaee8",
  soil: "#cfa37e",
  soilWet: "#a57756",
  crop: "#7bd67b",
  cropReady: "#ff9cc8",
  fence: "#f2c6d9",
  fenceShadow: "#dca9c0",
  roof: "#ffb2c8",
  house: "#fff2f8",
  trim: "#ffd3e7",
  tree: "#8cd8a5",
  trunk: "#b37a54",
  rock: "#b7c1d6",
  bush: "#8ddbb0",
  lamp: "#ffd88a",
  lantern: "#ffb37e",
  floor: "#f7e8d5",
  floorAccent: "#eed9c3",
  wall: "#f2c3d8",
  wallShadow: "#d9a6be",
  rug: "#ffb3c9",
  wood: "#d9a06b",
  woodDark: "#c28756",
  trimDark: "#a66b45",
  fireplace: "#8a4b2f",
  fireplaceGlow: "#ffb37e",
  metal: "#c6c9d8",
  leaf: "#6ec59b",
  chest: "#c97b4f",
  door: "#b86e4c",
  doorDark: "#8b5e3c",
  border: "#9c6a45",
  borderDark: "#7a4e32"
};

export const quests = {
  picnic: {
    title: "Picnic Prep",
    giver: "Hana",
    accepted: false,
    completed: false,
    required: 1,
    intro: "Could you grow 1 crop for the village picnic?",
    progress: () => 0
  },
  introductions: {
    order: ["Hana", "Kumo", "Sora", "Poko"],
    met: { Hana: false, Kumo: false, Sora: false, Poko: false }
  }
};

export const furnitureCatalog = {
  stool: { name: "Stool", w: 1, h: 1, color: "#d9b38c", accent: "#b27c52", cost: 2 },
  table: { name: "Table", w: 2, h: 1, color: "#f2c79d", accent: "#d8a97f", cost: 4 },
  bed: { name: "Bed", w: 2, h: 1, color: "#ffd7ea", accent: "#ffb3c9", cost: 6 }
};

export const furnitureOrder = ["stool", "table", "bed"];
export const furnitureInventory = { stool: 1, table: 0, bed: 0 };

export const homeFurniture = [
  { id: "bed", r: INTERIOR_OFFSET.r + 6, c: INTERIOR_OFFSET.c + 6, rotation: 0 }
];

export const cropCatalog = {
  sprout: { name: "Sprout", growSeconds: 10, sell: 6, seedCost: 3 },
  carrot: { name: "Carrot", growSeconds: 10, sell: 10, seedCost: 5 },
  berry: { name: "Berry", growSeconds: 10, sell: 16, seedCost: 8 }
};
export const cropOrder = ["sprout", "carrot", "berry"];
export let selectedCropId = "sprout";
export function setSelectedCropId(id) {
  selectedCropId = id;
}
export const seedInventory = { sprout: 3, carrot: 0, berry: 0 };
export const cropInventory = { sprout: 0, carrot: 0, berry: 0 };

export const player = {
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

export const npcs = [
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

export const buildings = [
  { x: 3, y: 1, w: 4, h: 3, roof: "#ffb3c9", trim: "#ffd8ea", door: "#ff9fbf" },
  { x: 10, y: 1, w: 4, h: 3, roof: "#ffc7a5", trim: "#ffe5d4", door: "#f2a36b" },
  { x: 18, y: 1, w: 5, h: 3, roof: "#9ad8ff", trim: "#d7f1ff", door: "#6aaee8", type: "hall" },
  { x: 22, y: 8, w: 4, h: 3, roof: "#b9b6ff", trim: "#e5e4ff", door: "#8b88d8" }
];
