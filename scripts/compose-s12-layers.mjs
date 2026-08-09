import path from "node:path";
import sharp from "sharp";
import { buildMirroredFoundationTexture } from "./ink-foundation-texture.mjs";

const root = process.cwd();
const assetRoot = path.join(root, "public/assets/maps/gate");
const sceneDir = path.join(assetRoot, "s12");
const sourceDir = path.join(sceneDir, "source");
const layersDir = path.join(sceneDir, "layers");
const width = 1672;
const height = 941;
const blank = () => sharp({ create: { width, height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } });

const background = await sharp(path.join(sourceDir, "00-background-generated.png"))
  .resize(width, height, { fit: "fill", kernel: sharp.kernel.lanczos3 })
  .greyscale().tint({ r: 195, g: 201, b: 200 }).linear(.95, 7).removeAlpha().png().toBuffer();
await sharp(background).toFile(path.join(layersDir, "00-background-mountains-city.png"));

const architectureFull = await sharp(path.join(sourceDir, "20-background-architecture-transparent.png"))
  .resize(width, height, { fit: "fill", kernel: sharp.kernel.lanczos3 }).greyscale().png().toBuffer();
const architectureStrip = await sharp(architectureFull)
  .extract({ left: 0, top: 140, width, height: 550 })
  .resize(1332, 320, { fit: "fill", kernel: sharp.kernel.lanczos3 })
  .png().toBuffer();
const roofCue = await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><path d="M420 500H760" fill="none" stroke="#1a1f1e" stroke-width="5"/><path d="M424 496H756" fill="none" stroke="#acb3b0" stroke-width="2" opacity=".3"/></svg>`)).png().toBuffer();
const architecture = await blank().composite([{ input: architectureStrip, left: 340, top: 330 }, { input: roofCue, left: 0, top: 0 }]).png().toBuffer();
await sharp(architecture).toFile(path.join(layersDir, "20-background-architecture.png"));

const decorationFull = await sharp(path.join(sourceDir, "30-decoration-transparent.png"))
  .resize(width, height, { fit: "fill", kernel: sharp.kernel.lanczos3 }).greyscale().png().toBuffer();
const decorationStrip = await sharp(decorationFull)
  .extract({ left: 0, top: 290, width, height: 450 })
  .resize(width, 225, { fit: "fill", kernel: sharp.kernel.lanczos3 })
  .png().toBuffer();
const passageClear = await sharp({ create: { width: 260, height: 150, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } } }).png().toBuffer();
const decoration = await blank().composite([
  { input: decorationStrip, left: 0, top: 415 },
  { input: passageClear, left: 820, top: 510, blend: "dest-out" },
]).png().toBuffer();
await sharp(decoration).toFile(path.join(layersDir, "30-decoration.png"));

const effects = await sharp(Buffer.from(`
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
  <defs><filter id="mist"><feGaussianBlur stdDeviation="26 8"/></filter><filter id="glow"><feGaussianBlur stdDeviation="18"/></filter></defs>
  <g stroke="#647a7f" stroke-width="2">${Array.from({ length: 31 }, (_, i) => `<line x1="${18 + i * 57}" y1="${35 + (i % 8) * 27}" x2="${-32 + i * 57}" y2="${218 + (i % 8) * 27}" opacity="${(0.2 - i * 0.0027).toFixed(3)}"/>`).join("")}</g>
  <g fill="#d7dfdf" opacity=".12" filter="url(#mist)"><ellipse cx="280" cy="615" rx="240" ry="18"/><ellipse cx="820" cy="630" rx="330" ry="22"/><ellipse cx="1430" cy="640" rx="240" ry="18"/></g>
  <g fill="#c4b6a1" opacity=".1" filter="url(#glow)"><circle cx="1325" cy="500" r="36"/><circle cx="1485" cy="490" r="42"/></g>
  <g fill="none" stroke="#70878a" stroke-width="2.5" opacity=".38"><path d="M90 625q55 10 110 0M520 638q70 11 140 0M1160 649q64 10 128 0M1440 654q58 9 116 0"/></g>
</svg>`)).png().toBuffer();
await sharp(effects).toFile(path.join(layersDir, "40-effects.png"));

const foundationTexture = await sharp(path.join(assetRoot, "s11/layers/50-foundation.png"))
  .extract({ left: 1060, top: 590, width: 360, height: 351 }).png().toBuffer();
const continuousFoundation = await buildMirroredFoundationTexture(foundationTexture, 360, width, 321);
const foundationCanvas = await blank().composite([{ input: continuousFoundation, left: 0, top: 620 }]).png().toBuffer();
const foundationMask = await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><path d="M0 620L360 625L760 635L1180 645L1672 650V941H0Z" fill="white"/></svg>`)).png().toBuffer();
const maskedFoundation = await sharp(foundationCanvas).composite([{ input: foundationMask, left: 0, top: 0, blend: "dest-in" }]).png().toBuffer();
const roofPlatform = await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="340" height="34"><path d="M2 2H338V18H2Z" fill="#3d4441" stroke="#171b18" stroke-width="3"/><path d="M8 8H332" stroke="#a2a8a5" stroke-width="2" opacity=".45"/></svg>`)).png().toBuffer();
const foundationCap = await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><path d="M0 620L360 625L760 635L1180 645L1672 650" fill="none" stroke="#151a19" stroke-width="6" stroke-linejoin="round"/></svg>`)).png().toBuffer();
const foundation = await sharp(maskedFoundation).composite([{ input: roofPlatform, left: 420, top: 500 }, { input: foundationCap, left: 0, top: 0 }]).png().toBuffer();
await sharp(foundation).toFile(path.join(layersDir, "50-foundation.png"));

let composite = await sharp(background).composite([{ input: architecture }, { input: decoration }, { input: effects }, { input: foundation }]).png().toBuffer();
const previousEdge = await sharp(path.join(assetRoot, "s11-ink-background-layered-1672.png")).extract({ left: width - 1, top: 0, width: 1, height }).png().toBuffer();
composite = await sharp(composite).composite([{ input: previousEdge, left: 0, top: 0 }]).png().toBuffer();
await sharp(composite).toFile(path.join(assetRoot, "s12-ink-background-layered-1672.png"));
await sharp(composite).resize(3840, 2160, { fit: "fill", kernel: sharp.kernel.lanczos3 }).png().toFile(path.join(assetRoot, "s12-ink-background-layered-4k.png"));
await sharp({ create: { width: width * 2, height, channels: 3, background: { r: 198, g: 200, b: 202 } } }).composite([
  { input: path.join(assetRoot, "s11-ink-background-layered-1672.png"), left: 0, top: 0 }, { input: composite, left: width, top: 0 },
]).png().toFile(path.join(root, "tmp", "s11-s12-surface-seam-preview.png"));

console.log("S12 surface five-layer art and S11-S12 seam preview exported.");
