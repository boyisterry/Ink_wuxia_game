import { mkdir, readdir, rename, stat } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = process.cwd();
const sourceRoot = path.join(root, "local-art-source/runtime-originals/assets");
const outputRoot = path.join(root, "public/assets");
const force = process.argv.includes("--force");

const runtimePatterns = [
  /^(?:player|player-idle|enemy|stage-background)\.png$/,
  /^enemies\/(?:sprites\/idle|effects\/combat)\/[^/]+\.png$/,
  /^maps\/gate\/s\d{2}(?:-underground)?-ink-[^/]+-(?:1672|4k)\.png$/,
  /^maps\/gate\/region-sketch\/(?:underground\/)?screens\/s\d{2}\.png$/,
  /^maps\/gate\/shared\/s01-s02-seam-bamboo\.png$/,
];

const isRuntimeAsset = (relativePath) =>
  runtimePatterns.some((pattern) => pattern.test(relativePath));

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

function webpOptions(relativePath) {
  if (relativePath.includes("/region-sketch/")) {
    return { quality: 82, alphaQuality: 100, effort: 6, smartSubsample: true };
  }
  if (relativePath.includes("/sprites/") || relativePath.includes("/effects/")) {
    return { quality: 88, alphaQuality: 100, effort: 6, smartSubsample: true };
  }
  return { quality: 84, alphaQuality: 100, effort: 6, smartSubsample: true };
}

const sourceFiles = (await walk(sourceRoot))
  .filter((relativePath) => relativePath.endsWith(".png") && isRuntimeAsset(relativePath))
  .sort();

if (sourceFiles.length === 0) {
  throw new Error(`No runtime originals found under ${sourceRoot}`);
}

let sourceBytes = 0;
let outputBytes = 0;
let written = 0;
let skipped = 0;

for (const relativePath of sourceFiles) {
  const sourcePath = path.join(sourceRoot, relativePath);
  const outputRelativePath = relativePath.replace(/\.png$/i, ".webp");
  const outputPath = path.join(outputRoot, outputRelativePath);
  const sourceInfo = await stat(sourcePath);
  sourceBytes += sourceInfo.size;

  let outputInfo = null;
  try {
    outputInfo = await stat(outputPath);
  } catch {
    // Missing derivatives are generated below.
  }

  if (!force && outputInfo && outputInfo.mtimeMs >= sourceInfo.mtimeMs) {
    outputBytes += outputInfo.size;
    skipped += 1;
    continue;
  }

  await mkdir(path.dirname(outputPath), { recursive: true });
  const temporaryPath = `${outputPath}.tmp.webp`;
  await sharp(sourcePath)
    .rotate()
    .webp(webpOptions(relativePath))
    .toFile(temporaryPath);
  await rename(temporaryPath, outputPath);
  outputInfo = await stat(outputPath);
  outputBytes += outputInfo.size;
  written += 1;
}

const mib = (bytes) => (bytes / 1024 / 1024).toFixed(2);
const reduction = ((1 - outputBytes / sourceBytes) * 100).toFixed(1);
console.log(
  `Runtime assets: ${sourceFiles.length} files, ${written} written, ${skipped} current; ` +
  `${mib(sourceBytes)} MiB PNG -> ${mib(outputBytes)} MiB WebP (${reduction}% smaller).`,
);
