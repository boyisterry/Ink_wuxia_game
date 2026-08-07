import path from "node:path";
import sharp from "sharp";
import { gradeCoolInkBackground } from "./ink-color-grade.mjs";
import { buildMirroredFoundationTexture } from "./ink-foundation-texture.mjs";

const root = process.cwd();
const assetRoot = path.join(root, "public/assets/maps/gate");
const s06Dir = path.join(assetRoot, "s06");
const layersDir = path.join(s06Dir, "layers");
const width = 1672;
const height = 941;

const files = {
  s05: path.join(assetRoot, "s05-ink-background-layered-1672.png"),
  s05Background: path.join(assetRoot, "s05/layers/00-background-mountains.png"),
  s05Foundation: path.join(assetRoot, "s05/layers/50-foundation.png"),
  backgroundSource: path.join(s06Dir, "source/00-background-generated.png"),
  architectureSource: path.join(s06Dir, "source/20-background-architecture-keyed.png"),
  decorationSource: path.join(s06Dir, "source/30-decoration-keyed.png"),
};

const blank = () => sharp({
  create: { width, height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
});

async function fadedContinuation(source, stripWidth, solidWidth = 70) {
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
const neutralBackground = await sharp(gradedBackground)
  .greyscale()
  .linear(0.82, 38)
  .png()
  .toBuffer();
const backgroundContinuation = await fadedContinuation(files.s05Background, 520, 96);
const background = await sharp(neutralBackground)
  .composite([{ input: backgroundContinuation, left: 0, top: 0 }])
  .removeAlpha()
  .png()
  .toBuffer();
await sharp(background).toFile(path.join(layersDir, "00-background-mountains.png"));

const architectureSource = await sharp(files.architectureSource)
  .resize(width, height, { fit: "fill", kernel: sharp.kernel.lanczos3 })
  .greyscale()
  .png()
  .toBuffer();
// Source bbox 37,204–1634,685. Mapping this inner crop to y347–600 makes
// the long lower roof ridge land at the authored C47 platform Y=420.
const corridor = await sharp(architectureSource)
  .extract({ left: 37, top: 204, width: 1597, height: 481 })
  .resize(1240, 253, { fit: "fill", kernel: sharp.kernel.lanczos3 })
  .png()
  .toBuffer();
const roofWalkCue = await sharp(Buffer.from(`
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
  <path d="M300 420H1320" fill="none" stroke="#202524" stroke-width="5" opacity=".78"/>
  <path d="M304 416H1316" fill="none" stroke="#aeb5b2" stroke-width="2" opacity=".28"/>
</svg>`)).png().toBuffer();
const architecture = await blank().composite([
  { input: corridor, left: 180, top: 347 },
  { input: roofWalkCue, left: 0, top: 0 },
]).png().toBuffer();
await sharp(architecture).toFile(path.join(layersDir, "20-background-architecture.png"));

const decorationSource = await sharp(files.decorationSource)
  .resize(width, height, { fit: "fill", kernel: sharp.kernel.lanczos3 })
  .greyscale()
  .png()
  .toBuffer();
const decorationSpecs = [
  { crop: { left: 150, top: 625, width: 650, height: 132 }, left: 180, top: 468, width: 650, height: 132 },
  { crop: { left: 875, top: 645, width: 445, height: 112 }, left: 815, top: 478, width: 445, height: 112 },
  { crop: { left: 1325, top: 640, width: 220, height: 117 }, left: 1190, top: 473, width: 220, height: 117 },
  // Bracket beams are intentionally overlapped with the C47 eave at Y=420.
  { crop: { left: 356, top: 274, width: 112, height: 205 }, left: 330, top: 398, width: 104, height: 190 },
  { crop: { left: 1218, top: 274, width: 112, height: 205 }, left: 1100, top: 398, width: 104, height: 190 },
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
const decoration = await blank().composite(decorationInputs).png().toBuffer();
await sharp(decoration).toFile(path.join(layersDir, "30-decoration.png"));

const effects = await sharp(Buffer.from(`
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
  <defs><filter id="mist"><feGaussianBlur stdDeviation="22 8"/></filter><filter id="water"><feGaussianBlur stdDeviation="1.4 .4"/></filter></defs>
  <g stroke="#657c82" stroke-width="2" opacity=".17">
    ${Array.from({ length: 31 }, (_, i) => `<line x1="${18 + i * 57}" y1="${55 + (i % 7) * 27}" x2="${-28 + i * 57}" y2="${238 + (i % 7) * 27}"/>`).join("")}
  </g>
  <!-- Every heavy runoff stream begins on the visible C47 eave at Y=420. -->
  <g fill="none" stroke="#a9bdc0" stroke-linecap="round" filter="url(#water)">
    <path d="M520 420q-4 52 2 106t-3 70" stroke-width="5" opacity=".42"/>
    <path d="M842 420q5 42-2 84t3 84" stroke-width="8" opacity=".38"/>
    <path d="M875 420q-3 45 2 86t-2 82" stroke-width="5" opacity=".32"/>
    <path d="M1080 420q4 52-2 104t3 64" stroke-width="6" opacity=".38"/>
    <path d="M1300 420q-3 44 2 88t-2 78" stroke-width="4" opacity=".34"/>
  </g>
  <g fill="#dce3e2" opacity=".12" filter="url(#mist)"><ellipse cx="330" cy="592" rx="260" ry="22"/><ellipse cx="860" cy="582" rx="350" ry="25"/><ellipse cx="1390" cy="580" rx="240" ry="20"/></g>
  <g fill="none" stroke="#71898e" stroke-width="2.5" opacity=".42"><path d="M480 592q30 9 60 0"/><path d="M815 582q38 11 76 0"/><path d="M1270 582q28 8 56 0"/></g>
</svg>`)).png().toBuffer();
await sharp(effects).toFile(path.join(layersDir, "40-effects.png"));

const foundationTexture = await sharp(files.s05Foundation)
  .extract({ left: 1260, top: 600, width: 412, height: 341 })
  .png()
  .toBuffer();
const continuousFoundation = await buildMirroredFoundationTexture(foundationTexture, 412, width, 351);
const groundLeft = await sharp(continuousFoundation)
  .extract({ left: 0, top: 10, width: 820, height: 341 })
  .png()
  .toBuffer();
const groundRight = await sharp(continuousFoundation)
  .extract({ left: 820, top: 0, width: 852, height: 351 })
  .png()
  .toBuffer();
const foundationCap = await sharp(Buffer.from(`
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
  <path d="M0 600H820V590H1672" fill="none" stroke="#151a19" stroke-width="6" stroke-linejoin="round"/>
</svg>`)).png().toBuffer();
const foundationBase = await blank().composite([
  { input: groundLeft, left: 0, top: 600 },
  { input: groundRight, left: 820, top: 590 },
  { input: foundationCap, left: 0, top: 0 },
]).png().toBuffer();
const foundationContinuation = await fadedContinuation(files.s05Foundation, 360, 72);
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
await sharp(composite).toFile(path.join(assetRoot, "s06-ink-background-layered-1672.png"));
await sharp(composite).resize(3840, 2160, { fit: "fill", kernel: sharp.kernel.lanczos3 }).png().toFile(path.join(assetRoot, "s06-ink-background-layered-4k.png"));
await sharp({ create: { width: width * 2, height, channels: 3, background: { r: 198, g: 200, b: 202 } } })
  .composite([{ input: files.s05, left: 0, top: 0 }, { input: composite, left: width, top: 0 }])
  .png()
  .toFile(path.join(root, "tmp", "s05-s06-surface-seam-preview.png"));

console.log(`S06 surface five-layer composite exported; background gains ${gains.map((value) => value.toFixed(4)).join(", ")}.`);
