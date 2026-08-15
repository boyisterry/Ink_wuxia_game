import path from "node:path";
import sharp from "sharp";
import { buildMirroredFoundationTexture } from "./ink-foundation-texture.mjs";

const root = process.cwd();
const assetRoot = path.join(root, "local-art-source/runtime-originals/assets/maps/gate");
const artRoot = path.join(root, "local-art-source/editable/maps/gate");
const sceneDir = path.join(artRoot, "s11");
const sourceDir = path.join(sceneDir, "source");
const layersDir = path.join(sceneDir, "layers");
const width = 1672;
const height = 941;
const blank = () => sharp({ create: { width, height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } });

const background = await sharp(path.join(sourceDir, "00-background-generated.png"))
  .resize(width, height, { fit: "fill", kernel: sharp.kernel.lanczos3 })
  .greyscale().tint({ r: 196, g: 201, b: 200 }).linear(.94, 8).removeAlpha().png().toBuffer();
await sharp(background).toFile(path.join(layersDir, "00-background-mountains.png"));

const architectureFull = await sharp(path.join(sourceDir, "20-background-architecture-transparent.png"))
  .resize(width, height, { fit: "fill", kernel: sharp.kernel.lanczos3 })
  .greyscale()
  .png().toBuffer();
const architectureSource = await sharp(architectureFull)
  .extract({ left: 0, top: 160, width, height: 610 })
  .resize(width, 420, { fit: "fill", kernel: sharp.kernel.lanczos3 })
  .png().toBuffer();
const architectureCue = await sharp(Buffer.from(`
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
  <g fill="none" stroke-linecap="round"><path d="M260 390H720M960 370H1420" stroke="#1a1f1e" stroke-width="5"/><path d="M264 386H716M964 366H1416" stroke="#aeb5b2" stroke-width="2" opacity=".28"/></g>
</svg>`)).png().toBuffer();
const architecture = await blank().composite([{ input: architectureSource, left: 0, top: 200 }, { input: architectureCue, left: 0, top: 0 }]).png().toBuffer();
await sharp(architecture).toFile(path.join(layersDir, "20-background-architecture.png"));

const decorationSource = await sharp(path.join(sourceDir, "30-decoration-transparent.png"))
  .resize(width, height, { fit: "fill", kernel: sharp.kernel.lanczos3 }).greyscale().png().toBuffer();
const decorationStrip = await sharp(decorationSource)
  .extract({ left: 0, top: 245, width, height: 500 })
  .resize(width, 185, { fit: "fill", kernel: sharp.kernel.lanczos3 })
  .png().toBuffer();
const centerClear = await sharp({ create: { width: 520, height: 230, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } } }).png().toBuffer();
const barrierClear = await sharp({ create: { width: 100, height: 360, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } } }).png().toBuffer();
const decoration = await blank().composite([
  { input: decorationStrip, left: 0, top: 405 },
  { input: centerClear, left: 600, top: 360, blend: "dest-out" },
  { input: barrierClear, left: 1415, top: 260, blend: "dest-out" },
]).png().toBuffer();
await sharp(decoration).toFile(path.join(layersDir, "30-decoration.png"));

const effects = await sharp(Buffer.from(`
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
  <defs><filter id="mist"><feGaussianBlur stdDeviation="25 8"/></filter><filter id="runoff"><feGaussianBlur stdDeviation="1 .5"/></filter></defs>
  <g stroke="#63797e" stroke-width="2" opacity=".2">${Array.from({ length: 32 }, (_, i) => `<line x1="${15 + i * 55}" y1="${22 + (i % 9) * 24}" x2="${-38 + i * 55}" y2="${220 + (i % 9) * 24}"/>`).join("")}</g>
  <g fill="#d7dfdf" opacity=".12" filter="url(#mist)"><ellipse cx="300" cy="580" rx="250" ry="18"/><ellipse cx="840" cy="575" rx="320" ry="22"/><ellipse cx="1420" cy="605" rx="230" ry="18"/></g>
  <g fill="none" stroke="#9db1b4" stroke-linecap="round" filter="url(#runoff)" opacity=".34"><path d="M240 300q-5 86 0 170" stroke-width="4"/><path d="M690 290q4 76 0 150" stroke-width="3"/><path d="M1080 270q-5 90 0 170" stroke-width="4"/><path d="M1460 280q4 96 0 180" stroke-width="5"/></g>
</svg>`)).png().toBuffer();
await sharp(effects).toFile(path.join(layersDir, "40-effects.png"));

const foundationTexture = await sharp(path.join(artRoot, "s10/layers/50-foundation.png"))
  .extract({ left: 1110, top: 590, width: 360, height: 351 }).png().toBuffer();
const continuousFoundation = await buildMirroredFoundationTexture(foundationTexture, 360, width, 351);
const foundationCanvas = await blank().composite([{ input: continuousFoundation, left: 0, top: 590 }]).png().toBuffer();
const foundationMask = await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><path d="M0 590H1320L1480 620H1672V941H0Z" fill="white"/></svg>`)).png().toBuffer();
const maskedFoundation = await sharp(foundationCanvas).composite([{ input: foundationMask, left: 0, top: 0, blend: "dest-in" }]).png().toBuffer();
const platform = async (platformWidth) => sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${platformWidth}" height="32"><path d="M2 2H${platformWidth - 2}V17H2Z" fill="#3e4542" stroke="#171b18" stroke-width="3"/><path d="M8 8H${platformWidth - 8}" stroke="#a4aaa7" stroke-width="2" opacity=".46"/></svg>`)).png().toBuffer();
const westUpper = await platform(460);
const eastUpper = await platform(460);
const collisionArt = await sharp(Buffer.from(`
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
  <path d="M0 590H1320L1480 620H1672" fill="none" stroke="#151a19" stroke-width="6" stroke-linejoin="round"/>
  <path d="M770 590V500H950V590M778 508H942" fill="none" stroke="#202623" stroke-width="12" stroke-linejoin="round"/><path d="M784 506H936" stroke="#a1a8a4" stroke-width="2" opacity=".48"/>
</svg>`)).png().toBuffer();
const foundation = await sharp(maskedFoundation).composite([
  { input: westUpper, left: 260, top: 390 }, { input: eastUpper, left: 960, top: 370 }, { input: collisionArt, left: 0, top: 0 },
]).png().toBuffer();
await sharp(foundation).toFile(path.join(layersDir, "50-foundation.png"));

let composite = await sharp(background).composite([{ input: architecture }, { input: decoration }, { input: effects }, { input: foundation }]).png().toBuffer();
const previousEdge = await sharp(path.join(assetRoot, "s10-ink-background-layered-1672.png")).extract({ left: width - 1, top: 0, width: 1, height }).png().toBuffer();
composite = await sharp(composite).composite([{ input: previousEdge, left: 0, top: 0 }]).png().toBuffer();
await sharp(composite).toFile(path.join(assetRoot, "s11-ink-background-layered-1672.png"));
await sharp(composite).resize(3840, 2160, { fit: "fill", kernel: sharp.kernel.lanczos3 }).png().toFile(path.join(assetRoot, "s11-ink-background-layered-4k.png"));
await sharp({ create: { width: width * 2, height, channels: 3, background: { r: 198, g: 200, b: 202 } } }).composite([
  { input: path.join(assetRoot, "s10-ink-background-layered-1672.png"), left: 0, top: 0 }, { input: composite, left: width, top: 0 },
]).png().toFile(path.join(root, "tmp", "s10-s11-surface-seam-preview.png"));

console.log("S11 surface five-layer art and S10-S11 seam preview exported.");
