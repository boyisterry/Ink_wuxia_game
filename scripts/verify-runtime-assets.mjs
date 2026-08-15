import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = process.cwd();
const publicAssets = path.join(root, "public/assets");

async function walk(directory, prefix = "") {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const relativePath = path.posix.join(prefix, entry.name);
    if (entry.isDirectory()) {
      files.push(...await walk(path.join(directory, entry.name), relativePath));
    } else {
      files.push(relativePath);
    }
  }
  return files;
}

const publicFiles = await walk(publicAssets);
const rawRuntimeFiles = publicFiles.filter((file) => /\.(?:png|jpe?g)$/i.test(file));
if (rawRuntimeFiles.length > 0) {
  throw new Error(`Unoptimized raster files remain in public/assets:\n${rawRuntimeFiles.join("\n")}`);
}

const sceneIds = Array.from({ length: 12 }, (_, index) =>
  `s${String(index + 1).padStart(2, "0")}`,
);
const undergroundIds = ["s04", "s05", "s06"];
const enemyIds = [
  "bamboo_blade", "rooftop_bow", "ink_crow", "ink_spider", "iron_shield",
  "lantern_mage", "ink_beast", "chain_jailer", "ink_eel", "drowned_guard",
  "lantern_adept", "scarlet_captain", "faceless_sword", "lake_maiden",
  "tomb_warden", "pine_nightmare", "formless_lord",
];
const effectIds = [...enemyIds, "bridge_nightmare"];
const required = new Set([
  "player.webp", "player-idle.webp", "enemy.webp", "stage-background.webp",
  "maps/gate/shared/s01-s02-seam-bamboo.webp",
  ...sceneIds.flatMap((id) => [
    `maps/gate/${id}-ink-background-layered-1672.webp`,
    `maps/gate/${id}-ink-background-layered-4k.webp`,
    `maps/gate/region-sketch/screens/${id}.webp`,
  ]),
  ...undergroundIds.flatMap((id) => [
    `maps/gate/${id}-underground-ink-layered-1672.webp`,
    `maps/gate/${id}-underground-ink-layered-4k.webp`,
  ]),
  ...["s04", "s05", "s06", "s07"].map(
    (id) => `maps/gate/region-sketch/underground/screens/${id}.webp`,
  ),
  ...enemyIds.map((id) => `enemies/sprites/idle/${id}.webp`),
  ...effectIds.map((id) => `enemies/effects/combat/${id}.webp`),
]);

const missing = [...required].filter((file) => !publicFiles.includes(file));
if (missing.length > 0) {
  throw new Error(`Required runtime assets are missing:\n${missing.join("\n")}`);
}

const appFiles = (await walk(path.join(root, "app"))).filter((file) =>
  /\.(?:css|ts|tsx)$/.test(file),
);
const literalReferences = new Set();
for (const relativePath of appFiles) {
  const source = await readFile(path.join(root, "app", relativePath), "utf8");
  for (const match of source.matchAll(/\/assets\/[^\s"'`?})]+\.webp/g)) {
    literalReferences.add(match[0].slice("/assets/".length));
  }
}
const missingReferences = [...literalReferences].filter((file) => !publicFiles.includes(file));
if (missingReferences.length > 0) {
  throw new Error(`App references missing assets:\n${missingReferences.join("\n")}`);
}

const webpFiles = publicFiles.filter((file) => file.endsWith(".webp"));
let totalBytes = 0;
for (const file of webpFiles) {
  const absolutePath = path.join(publicAssets, file);
  const [metadata, fileInfo] = await Promise.all([sharp(absolutePath).metadata(), stat(absolutePath)]);
  if (metadata.format !== "webp" || !metadata.width || !metadata.height) {
    throw new Error(`Invalid WebP derivative: ${file}`);
  }
  totalBytes += fileInfo.size;
}

console.log(
  `Verified ${webpFiles.length} WebP runtime assets (${(totalBytes / 1024 / 1024).toFixed(2)} MiB); ` +
  "no raw PNG/JPEG files remain in public/assets.",
);
