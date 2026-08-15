import path from "node:path";
import sharp from "sharp";
import { buildMirroredFoundationTexture } from "./ink-foundation-texture.mjs";

const root = process.cwd();
const assetRoot = path.join(root, "local-art-source/runtime-originals/assets/maps/gate");
const artRoot = path.join(root, "local-art-source/editable/maps/gate");
const sceneDir = path.join(artRoot, "s10");
const sourceDir = path.join(sceneDir, "source");
const layersDir = path.join(sceneDir, "layers");
const width = 1672;
const height = 941;

const blank = () => sharp({ create: { width, height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } });

async function fadedPreviousComposite(stripWidth = 320, solidWidth = 48) {
  const { data, info } = await sharp(path.join(assetRoot, "s09-ink-background-layered-1672.png"))
    .extract({ left: width - stripWidth, top: 0, width: stripWidth, height })
    .ensureAlpha()
    .flop()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const rgba = Buffer.from(data);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < stripWidth; x += 1) {
      const t = x <= solidWidth ? 0 : (x - solidWidth) / Math.max(1, stripWidth - solidWidth);
      const fade = 1 - Math.min(1, t) ** 2 * (3 - 2 * Math.min(1, t));
      rgba[(y * stripWidth + x) * info.channels + 3] = Math.round(rgba[(y * stripWidth + x) * info.channels + 3] * fade);
    }
  }
  return sharp(rgba, { raw: info }).png().toBuffer();
}

async function matchCompositeColor(input, reference) {
  const [sourceStats, referenceStats] = await Promise.all([sharp(input).removeAlpha().stats(), sharp(reference).removeAlpha().stats()]);
  const gains = sourceStats.channels.slice(0, 3).map((channel, index) =>
    Math.max(.88, Math.min(1.12, referenceStats.channels[index].stdev / Math.max(1, channel.stdev))));
  const offsets = sourceStats.channels.slice(0, 3).map((channel, index) =>
    Math.max(-30, Math.min(30, referenceStats.channels[index].mean - channel.mean * gains[index])));
  return sharp(input).linear([...gains, 1], [...offsets, 0]).png().toBuffer();
}

const background = await sharp(path.join(sourceDir, "00-background-generated.png"))
  .resize(width, height, { fit: "fill", kernel: sharp.kernel.lanczos3 })
  .greyscale()
  .tint({ r: 203, g: 199, b: 194 })
  .linear(.96, 5)
  .removeAlpha()
  .png()
  .toBuffer();
await sharp(background).toFile(path.join(layersDir, "00-background-mountains.png"));

const architectureSource = await sharp(path.join(sourceDir, "20-background-architecture-transparent.png"))
  .resize(width, height, { fit: "fill", kernel: sharp.kernel.lanczos3 })
  .greyscale()
  .png()
  .toBuffer();
const westPavilion = await sharp(architectureSource)
  .extract({ left: 0, top: 220, width: 810, height: 510 })
  .resize(400, 210, { fit: "fill", kernel: sharp.kernel.lanczos3 })
  .png().toBuffer();
const eastPavilion = await sharp(architectureSource)
  .extract({ left: 960, top: 220, width: 712, height: 510 })
  .resize(400, 210, { fit: "fill", kernel: sharp.kernel.lanczos3 })
  .png().toBuffer();
const roofWalkCue = await sharp(Buffer.from(`
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
  <g fill="none" stroke-linecap="round"><path d="M220 470H500M1170 455H1460" stroke="#1b201f" stroke-width="5"/><path d="M224 466H496M1174 451H1456" stroke="#aeb5b2" stroke-width="2" opacity=".3"/></g>
</svg>`)).png().toBuffer();
const architecture = await blank().composite([
  { input: westPavilion, left: 160, top: 390 },
  { input: eastPavilion, left: 1110, top: 380 },
  { input: roofWalkCue, left: 0, top: 0 },
]).png().toBuffer();
await sharp(architecture).toFile(path.join(layersDir, "20-background-architecture.png"));

const decorationSource = await sharp(path.join(sourceDir, "30-decoration-transparent.png"))
  .resize(width, height, { fit: "fill", kernel: sharp.kernel.lanczos3 })
  .greyscale().png().toBuffer();
const westGrounded = await sharp(decorationSource).extract({ left: 0, top: 540, width: 620, height: 300 }).png().toBuffer();
const eastGrounded = await sharp(decorationSource).extract({ left: 1120, top: 540, width: 552, height: 300 }).png().toBuffer();
const westChain = await sharp(decorationSource).extract({ left: 360, top: 130, width: 130, height: 370 }).resize(70, 170).png().toBuffer();
const eastChain = await sharp(decorationSource).extract({ left: 1160, top: 130, width: 130, height: 370 }).resize(70, 170).png().toBuffer();
const decoration = await blank().composite([
  // Generated props share a Y780 baseline. Align each dry-ground group to its authored floor.
  { input: westGrounded, left: 0, top: 352 },
  { input: eastGrounded, left: 1120, top: 336 },
  { input: westChain, left: 300, top: 390 },
  { input: eastChain, left: 1270, top: 380 },
]).png().toBuffer();
await sharp(decoration).toFile(path.join(layersDir, "30-decoration.png"));

const effects = await sharp(Buffer.from(`
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
  <defs><filter id="mist"><feGaussianBlur stdDeviation="24 7"/></filter></defs>
  <g stroke="#667b80" stroke-width="2" opacity=".18">${Array.from({ length: 31 }, (_, i) => `<line x1="${20 + i * 57}" y1="${35 + (i % 8) * 27}" x2="${-32 + i * 57}" y2="${218 + (i % 8) * 27}"/>`).join("")}</g>
  <g fill="#d8e0e0" opacity=".13" filter="url(#mist)"><ellipse cx="300" cy="590" rx="250" ry="18"/><ellipse cx="850" cy="595" rx="330" ry="22"/><ellipse cx="1390" cy="582" rx="230" ry="17"/></g>
</svg>`)).png().toBuffer();
await sharp(effects).toFile(path.join(layersDir, "40-effects.png"));

const foundationTexture = await sharp(path.join(artRoot, "s08/layers/50-foundation.png"))
  .extract({ left: 520, top: 300, width: 360, height: 641 })
  .png().toBuffer();
const continuousFoundation = await buildMirroredFoundationTexture(foundationTexture, 360, width, 351);
const foundationSegments = [
  { left: 0, top: 600, width: 660 },
  { left: 660, top: 610, width: 420 },
  { left: 1080, top: 590, width: 592 },
];
const foundationInputs = [];
for (const segment of foundationSegments) {
  foundationInputs.push({
    input: await sharp(continuousFoundation).extract({ left: segment.left, top: segment.top - 590, width: segment.width, height: height - segment.top }).png().toBuffer(),
    left: segment.left, top: segment.top,
  });
}
const foundationCap = await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><path d="M0 600H660V610H1080V590H1672" fill="none" stroke="#151a19" stroke-width="6" stroke-linejoin="round"/><path d="M620 585H690M1050 575H1120" fill="none" stroke="#313a38" stroke-width="5"/></svg>`)).png().toBuffer();
const foundation = await blank().composite([...foundationInputs, { input: foundationCap, left: 0, top: 0 }]).png().toBuffer();
await sharp(foundation).toFile(path.join(layersDir, "50-foundation.png"));

const compositeBase = await sharp(background).composite([{ input: architecture }, { input: decoration }, { input: effects }, { input: foundation }]).png().toBuffer();
const colorMatched = await matchCompositeColor(compositeBase, path.join(assetRoot, "s09-ink-background-layered-1672.png"));
const composite = await sharp(colorMatched).composite([{ input: await fadedPreviousComposite(), left: 0, top: 0 }]).png().toBuffer();
await sharp(composite).toFile(path.join(assetRoot, "s10-ink-background-layered-1672.png"));
await sharp(composite).resize(3840, 2160, { fit: "fill", kernel: sharp.kernel.lanczos3 }).png().toFile(path.join(assetRoot, "s10-ink-background-layered-4k.png"));
// Keep an immutable revisioned pair for browsers/CDNs that retain the old
// canonical file despite a query-string change.
await sharp(composite).toFile(path.join(assetRoot, "s10-ink-background-layered-1672.png"));
await sharp(composite).resize(3840, 2160, { fit: "fill", kernel: sharp.kernel.lanczos3 }).png().toFile(path.join(assetRoot, "s10-ink-background-layered-4k.png"));
await sharp({ create: { width: width * 2, height, channels: 3, background: { r: 198, g: 200, b: 202 } } }).composite([
  { input: path.join(assetRoot, "s09-ink-background-layered-1672.png"), left: 0, top: 0 }, { input: composite, left: width, top: 0 },
]).png().toFile(path.join(root, "tmp", "s09-s10-surface-seam-preview.png"));

console.log("S10 surface five-layer art and S09-S10 seam preview exported.");
