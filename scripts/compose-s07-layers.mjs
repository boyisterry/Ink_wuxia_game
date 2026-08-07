import path from "node:path";
import sharp from "sharp";
import { gradeCoolInkBackground } from "./ink-color-grade.mjs";
import { buildMirroredFoundationTexture } from "./ink-foundation-texture.mjs";

const root = process.cwd();
const assetRoot = path.join(root, "public/assets/maps/gate");
const s07Dir = path.join(assetRoot, "s07");
const layersDir = path.join(s07Dir, "layers");
const width = 1672;
const height = 941;

const files = {
  s06: path.join(assetRoot, "s06-ink-background-layered-1672.png"),
  s06Background: path.join(assetRoot, "s06/layers/00-background-mountains.png"),
  s06Foundation: path.join(assetRoot, "s06/layers/50-foundation.png"),
  backgroundSource: path.join(s07Dir, "source/00-background-generated.png"),
  architectureSource: path.join(s07Dir, "source/20-background-architecture-supported-v3.png"),
  decorationSource: path.join(s07Dir, "source/30-decoration-keyed.png"),
  s08Decoration: path.join(assetRoot, "s08/layers/30-decoration.png"),
};

const blank = () => sharp({
  create: { width, height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
});

async function fadedContinuation(source, stripWidth, solidWidth = 82) {
  const { data, info } = await sharp(source)
    .extract({ left: width - stripWidth, top: 0, width: stripWidth, height })
    .ensureAlpha()
    .flop()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const rgba = Buffer.alloc(stripWidth * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < stripWidth; x += 1) {
      const sourceIndex = (y * stripWidth + x) * info.channels;
      const targetIndex = (y * stripWidth + x) * 4;
      const t = x <= solidWidth ? 0 : Math.min(1, (x - solidWidth) / (stripWidth - solidWidth));
      const fade = 1 - t * t * (3 - 2 * t);
      rgba[targetIndex] = data[sourceIndex];
      rgba[targetIndex + 1] = data[sourceIndex + 1];
      rgba[targetIndex + 2] = data[sourceIndex + 2];
      rgba[targetIndex + 3] = Math.round(data[sourceIndex + 3] * fade);
    }
  }
  return sharp(rgba, { raw: { width: stripWidth, height, channels: 4 } }).png().toBuffer();
}

const { buffer: gradedBackground, gains } = await gradeCoolInkBackground(files.backgroundSource, width, height);
const neutralBackground = await sharp(gradedBackground).greyscale().linear(0.9, 20).png().toBuffer();
const backgroundContinuation = await fadedContinuation(files.s06Background, 540, 100);
const background = await sharp(neutralBackground)
  .composite([{ input: backgroundContinuation, left: 0, top: 0 }])
  .removeAlpha()
  .png()
  .toBuffer();
await sharp(background).toFile(path.join(layersDir, "00-background-mountains.png"));

const gateRemovalMask = await sharp(Buffer.from(`
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
  <rect x="1270" y="0" width="402" height="225" fill="#fff"/>
</svg>`)).png().toBuffer();
const architecture = await sharp(files.architectureSource)
  .resize(width, height, { fit: "fill", kernel: sharp.kernel.lanczos3 })
  .greyscale()
  .composite([{ input: gateRemovalMask, blend: "dest-out" }])
  .png()
  .toBuffer();
await sharp(architecture).toFile(path.join(layersDir, "20-background-architecture.png"));

const decorationSource = await sharp(files.decorationSource)
  .resize(width, height, { fit: "fill", kernel: sharp.kernel.lanczos3 })
  .greyscale()
  .png()
  .toBuffer();
const decorationSpecs = [
  { crop: { left: 45, top: 40, width: 470, height: 395 }, left: 365, top: 490, width: 120, height: 100 },
  { crop: { left: 570, top: 20, width: 335, height: 430 }, left: 705, top: 390, width: 55, height: 130 },
  { crop: { left: 940, top: 45, width: 310, height: 405 }, left: 820, top: 305, width: 105, height: 135 },
  { crop: { left: 1320, top: 190, width: 270, height: 270 }, left: 1125, top: 220, width: 90, height: 80 },
  { crop: { left: 1160, top: 490, width: 445, height: 100 }, left: 910, top: 360, width: 360, height: 80 },
  { crop: { left: 125, top: 745, width: 205, height: 170 }, left: 1080, top: 280, width: 85, height: 70 },
];
const decorationInputs = [];
for (const spec of decorationSpecs) {
  decorationInputs.push({
    input: await sharp(decorationSource)
      .extract(spec.crop)
      .resize(spec.width, spec.height, { fit: "fill", kernel: sharp.kernel.lanczos3 })
      .png()
      .toBuffer(),
    left: spec.left,
    top: spec.top,
  });
}
// A25's redundant gate was removed. Two grounded flags keep the summit wall
// readable without rebuilding a doorway or introducing a new collision shape.
const summitFlagSpecs = [
  { crop: { left: 140, top: 50, width: 155, height: 255 }, left: 1390, top: 50, width: 95, height: 175 },
  { crop: { left: 285, top: 85, width: 115, height: 220 }, left: 1530, top: 80, width: 75, height: 145 },
];
for (const spec of summitFlagSpecs) {
  decorationInputs.push({
    input: await sharp(files.s08Decoration)
      .extract(spec.crop)
      .resize(spec.width, spec.height, { fit: "fill", kernel: sharp.kernel.lanczos3 })
      .png()
      .toBuffer(),
    left: spec.left,
    top: spec.top,
  });
}
const decoration = await blank().composite(decorationInputs).png().toBuffer();
await sharp(decoration).toFile(path.join(layersDir, "30-decoration.png"));

const effects = await sharp(Buffer.from(`
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
  <defs><filter id="mist"><feGaussianBlur stdDeviation="22 8"/></filter></defs>
  <g stroke="#687d82" stroke-width="2" opacity=".16">
    ${Array.from({ length: 29 }, (_, i) => `<line x1="${15 + i * 61}" y1="${56 + (i % 7) * 29}" x2="${-28 + i * 61}" y2="${235 + (i % 7) * 29}"/>`).join("")}
  </g>
  <g fill="#dce3e2" opacity=".12" filter="url(#mist)">
    <ellipse cx="280" cy="580" rx="250" ry="23"/><ellipse cx="690" cy="510" rx="190" ry="18"/>
    <ellipse cx="930" cy="430" rx="180" ry="17"/><ellipse cx="1190" cy="340" rx="160" ry="15"/><ellipse cx="1490" cy="250" rx="150" ry="14"/>
  </g>
  <g fill="none" stroke="#71898d" stroke-width="2.5" opacity=".4">
    <path d="M250 582q30 9 60 0"/><path d="M650 512q24 7 48 0"/><path d="M890 432q20 6 40 0"/><path d="M1150 342q18 5 36 0"/>
  </g>
</svg>`)).png().toBuffer();
await sharp(effects).toFile(path.join(layersDir, "40-effects.png"));

const foundationTexture = await sharp(files.s06Foundation)
  .extract({ left: 1260, top: 590, width: 412, height: 351 })
  .png()
  .toBuffer();
const continuousFoundation = await buildMirroredFoundationTexture(foundationTexture, 412, width, 681);
const foundationSegments = [
  { left: 0, top: 590, width: 520, height: 351 },
  { left: 520, top: 520, width: 240, height: 421 },
  { left: 760, top: 440, width: 270, height: 501 },
  { left: 1030, top: 350, width: 290, height: 591 },
  { left: 1320, top: 300, width: 352, height: 641 },
];
const foundationInputs = [];
for (const segment of foundationSegments) {
  foundationInputs.push({
    input: await sharp(continuousFoundation)
      .extract({ left: segment.left, top: segment.top - 260, width: segment.width, height: segment.height })
      .png()
      .toBuffer(),
    left: segment.left,
    top: segment.top,
  });
}
const foundationCap = await sharp(Buffer.from(`
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
  <path d="M0 590H520V520H760V440H1030V350H1320V300H1672" fill="none" stroke="#151a19" stroke-width="6" stroke-linejoin="round"/>
</svg>`)).png().toBuffer();
const foundationBase = await blank().composite([
  ...foundationInputs,
  { input: foundationCap, left: 0, top: 0 },
]).png().toBuffer();
const foundationContinuation = await fadedContinuation(files.s06Foundation, 360, 72);
const foundation = await sharp(foundationBase)
  .composite([{ input: foundationContinuation, left: 0, top: 0 }])
  .png()
  .toBuffer();
await sharp(foundation).toFile(path.join(layersDir, "50-foundation.png"));

const composite = await sharp(background).composite([
  { input: architecture },
  { input: decoration },
  { input: effects },
  { input: foundation },
]).png().toBuffer();
await sharp(composite).toFile(path.join(assetRoot, "s07-ink-background-layered-1672.png"));
await sharp(composite).resize(3840, 2160, { fit: "fill", kernel: sharp.kernel.lanczos3 }).png().toFile(path.join(assetRoot, "s07-ink-background-layered-4k.png"));
await sharp(composite).toFile(path.join(assetRoot, "s07-ink-background-grounded-1672.png"));
await sharp(composite).resize(3840, 2160, { fit: "fill", kernel: sharp.kernel.lanczos3 }).png().toFile(path.join(assetRoot, "s07-ink-background-grounded-4k.png"));
await sharp({ create: { width: width * 2, height, channels: 3, background: { r: 198, g: 200, b: 202 } } })
  .composite([{ input: files.s06, left: 0, top: 0 }, { input: composite, left: width, top: 0 }])
  .png()
  .toFile(path.join(root, "tmp", "s06-s07-surface-seam-preview.png"));

console.log(`S07 surface five-layer composite exported; background gains ${gains.map((value) => value.toFixed(4)).join(", ")}.`);
