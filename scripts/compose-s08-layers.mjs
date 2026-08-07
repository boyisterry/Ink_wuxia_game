import path from "node:path";
import sharp from "sharp";
import { gradeCoolInkBackground } from "./ink-color-grade.mjs";
import { buildMirroredFoundationTexture } from "./ink-foundation-texture.mjs";

const root = process.cwd();
const assetRoot = path.join(root, "public/assets/maps/gate");
const s08Dir = path.join(assetRoot, "s08");
const layersDir = path.join(s08Dir, "layers");
const width = 1672;
const height = 941;

const files = {
  s07: path.join(assetRoot, "s07-ink-background-grounded-1672.png"),
  s07Background: path.join(assetRoot, "s07/layers/00-background-mountains.png"),
  s07Foundation: path.join(assetRoot, "s07/layers/50-foundation.png"),
  backgroundSource: path.join(s08Dir, "source/00-background-generated.png"),
  architectureSource: path.join(s08Dir, "source/20-background-architecture-magenta.png"),
  decorationSource: path.join(s08Dir, "source/30-decoration-magenta.png"),
};

const blank = () => sharp({
  create: { width, height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
});

async function removeMagenta(input) {
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const rgba = Buffer.alloc(info.width * info.height * 4);

  for (let pixel = 0; pixel < info.width * info.height; pixel += 1) {
    const sourceIndex = pixel * info.channels;
    const targetIndex = pixel * 4;
    const r = data[sourceIndex];
    const g = data[sourceIndex + 1];
    const b = data[sourceIndex + 2];
    const magentaStrength = Math.min(r, b) - g;
    const keyed = Math.max(0, Math.min(1, (magentaStrength - 52) / 92));
    const luminance = Math.round(.2126 * r + .7152 * g + .0722 * b);

    rgba[targetIndex] = luminance;
    rgba[targetIndex + 1] = luminance;
    rgba[targetIndex + 2] = luminance;
    rgba[targetIndex + 3] = Math.round((data[sourceIndex + 3] ?? 255) * (1 - keyed));
  }

  return sharp(rgba, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer();
}

async function fadedContinuation(source, stripWidth, solidWidth = 88) {
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
const neutralBackground = await sharp(gradedBackground).greyscale().linear(.92, 17).png().toBuffer();
const backgroundContinuation = await fadedContinuation(files.s07Background, 520, 110);
const background = await sharp(neutralBackground)
  .composite([{ input: backgroundContinuation, left: 0, top: 0 }])
  .removeAlpha()
  .png()
  .toBuffer();
await sharp(background).toFile(path.join(layersDir, "00-background-mountains.png"));

const keyedArchitecture = await removeMagenta(files.architectureSource);
const architectureStrip = await sharp(keyedArchitecture)
  .extract({ left: 0, top: 220, width, height: 440 })
  .resize(width, 300, { fit: "fill", kernel: sharp.kernel.lanczos3 })
  .linear(.88, 9)
  .png()
  .toBuffer();
const architecture = await blank().composite([{ input: architectureStrip, left: 0, top: 0 }]).png().toBuffer();
await sharp(architecture).toFile(path.join(layersDir, "20-background-architecture.png"));

const keyedDecoration = await removeMagenta(files.decorationSource);
const decorationStrip = await sharp(keyedDecoration)
  .extract({ left: 0, top: 145, width, height: 620 })
  .resize(width, 250, { fit: "fill", kernel: sharp.kernel.lanczos3 })
  .linear(.9, 8)
  .png()
  .toBuffer();
const decoration = await blank().composite([{ input: decorationStrip, left: 0, top: 52 }]).png().toBuffer();
await sharp(decoration).toFile(path.join(layersDir, "30-decoration.png"));

const effects = await sharp(Buffer.from(`
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
  <defs><filter id="mist"><feGaussianBlur stdDeviation="24 7"/></filter></defs>
  <g stroke="#667b80" stroke-width="2" opacity=".17">
    ${Array.from({ length: 31 }, (_, i) => `<line x1="${20 + i * 57}" y1="${35 + (i % 8) * 27}" x2="${-32 + i * 57}" y2="${218 + (i % 8) * 27}"/>`).join("")}
  </g>
  <g fill="#d8e0e0" opacity=".13" filter="url(#mist)">
    <ellipse cx="215" cy="250" rx="230" ry="18"/>
    <ellipse cx="615" cy="288" rx="255" ry="20"/>
    <ellipse cx="1060" cy="286" rx="265" ry="20"/>
    <ellipse cx="1490" cy="250" rx="210" ry="17"/>
  </g>
  <g fill="none" stroke="#73898d" stroke-width="2" opacity=".34">
    <path d="M48 264q42 8 84 0M485 303q38 7 76 0M930 301q36 7 72 0M1450 264q30 6 60 0"/>
  </g>
</svg>`)).png().toBuffer();
await sharp(effects).toFile(path.join(layersDir, "40-effects.png"));

const foundationTexture = await sharp(files.s07Foundation)
  .extract({ left: 1320, top: 260, width: 352, height: 681 })
  .png()
  .toBuffer();
const continuousFoundation = await buildMirroredFoundationTexture(foundationTexture, 352, width, 681);
const foundationSegments = [
  { left: 0, top: 300, width: 240, height: 641 },
  { left: 240, top: 300, width: 180, height: 641 },
  { left: 420, top: 300, width: 800, height: 641 },
  { left: 1220, top: 280, width: 220, height: 661 },
  { left: 1440, top: 260, width: 120, height: 681 },
  { left: 1560, top: 260, width: 112, height: 681 },
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
  <path d="M0 300H1220V280H1440V260H1672" fill="none" stroke="#151a19" stroke-width="6" stroke-linejoin="round"/>
</svg>`)).png().toBuffer();
const foundationBase = await blank().composite([
  ...foundationInputs,
  { input: foundationCap, left: 0, top: 0 },
]).png().toBuffer();
const foundationContinuation = await fadedContinuation(files.s07Foundation, 340, 82);
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
await sharp(composite).toFile(path.join(assetRoot, "s08-ink-background-layered-1672.png"));
await sharp(composite)
  .resize(3840, 2160, { fit: "fill", kernel: sharp.kernel.lanczos3 })
  .png()
  .toFile(path.join(assetRoot, "s08-ink-background-layered-4k.png"));
await sharp({ create: { width: width * 2, height, channels: 3, background: { r: 198, g: 200, b: 202 } } })
  .composite([{ input: files.s07, left: 0, top: 0 }, { input: composite, left: width, top: 0 }])
  .png()
  .toFile(path.join(root, "tmp", "s07-s08-surface-seam-preview.png"));

console.log(`S08 surface five-layer composite exported; background gains ${gains.map((value) => value.toFixed(4)).join(", ")}.`);
