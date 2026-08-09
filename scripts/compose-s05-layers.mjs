import path from "node:path";
import sharp from "sharp";
import { gradeCoolInkBackground } from "./ink-color-grade.mjs";
import { buildMirroredFoundationTexture } from "./ink-foundation-texture.mjs";

const root = process.cwd();
const assetRoot = path.join(root, "public/assets/maps/gate");
const s05Dir = path.join(assetRoot, "s05");
const layersDir = path.join(s05Dir, "layers");
const width = 1672;
const height = 941;

const files = {
  s04: path.join(assetRoot, "s04-ink-background-layered-1672.png"),
  s04Background: path.join(assetRoot, "s04/layers/00-background-mountains.png"),
  s04Architecture: path.join(assetRoot, "s04/layers/20-background-architecture.png"),
  s04Decoration: path.join(assetRoot, "s04/layers/30-decoration.png"),
  s04Foundation: path.join(assetRoot, "s04/layers/50-foundation.png"),
  backgroundSource: path.join(s05Dir, "source/00-background-generated.png"),
  architectureSource: path.join(s05Dir, "source/20-background-architecture-keyed.png"),
  decorationSource: path.join(s05Dir, "source/30-decoration-keyed.png"),
};

const blank = () => sharp({
  create: { width, height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
});

async function fadedContinuation(source, stripWidth, solidWidth = 56) {
  const { data, info } = await sharp(source)
    .extract({ left: width - stripWidth, top: 0, width: stripWidth, height })
    .ensureAlpha()
    .flop()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const rgba = Buffer.alloc(stripWidth * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < stripWidth; x += 1) {
      const si = (y * stripWidth + x) * info.channels;
      const ti = (y * stripWidth + x) * 4;
      const t = x <= solidWidth ? 0 : Math.min(1, (x - solidWidth) / (stripWidth - solidWidth));
      const alpha = 1 - t * t * (3 - 2 * t);
      rgba[ti] = data[si];
      rgba[ti + 1] = data[si + 1];
      rgba[ti + 2] = data[si + 2];
      rgba[ti + 3] = Math.round(data[si + 3] * alpha);
    }
  }
  return sharp(rgba, { raw: { width: stripWidth, height, channels: 4 } }).png().toBuffer();
}

const { buffer: gradedBackground, gains } = await gradeCoolInkBackground(files.backgroundSource, width, height);
const backgroundContinuation = await fadedContinuation(files.s04Background, 330, 72);
const background = await sharp(gradedBackground)
  .composite([{ input: backgroundContinuation, left: 0, top: 0 }])
  .png()
  .toBuffer();
await sharp(background).removeAlpha().toFile(path.join(layersDir, "00-background-mountains.png"));

const sourceArchitecture = await sharp(files.architectureSource)
  .resize(width, height, { fit: "fill", kernel: sharp.kernel.lanczos3 })
  .greyscale()
  .png()
  .toBuffer();
const architecturePieces = [
  // The chroma source places its three buildings close together. Crop inside
  // each silhouette so neighboring roof tips cannot survive as floating scraps.
  { crop: { left: 129, top: 410, width: 400, height: 318 }, place: { left: 150, top: 360, width: 380, height: 250 } },
  { crop: { left: 545, top: 310, width: 465, height: 418 }, place: { left: 600, top: 300, width: 430, height: 310 } },
  { crop: { left: 1050, top: 218, width: 525, height: 510 }, place: { left: 1035, top: 280, width: 385, height: 320 } },
];
const architectureInputs = [];
for (const { crop, place } of architecturePieces) {
  architectureInputs.push({
    input: await sharp(sourceArchitecture).extract(crop).resize(place.width, place.height, { fit: "fill" }).png().toBuffer(),
    left: place.left,
    top: place.top,
  });
}
const architecture = await blank().composite(architectureInputs).png().toBuffer();
await sharp(architecture).toFile(path.join(layersDir, "20-background-architecture.png"));

const decorationSource = await sharp(files.decorationSource)
  .resize(width, height, { fit: "fill", kernel: sharp.kernel.lanczos3 })
  .greyscale()
  .png()
  .toBuffer();
const decorationSpecs = [
  // Bamboo transition, then low non-collision lion and tablet group.
  { crop: { left: 32, top: 450, width: 120, height: 343 }, left: 0, top: 267, width: 120, height: 343 },
  { crop: { left: 210, top: 615, width: 225, height: 178 }, left: 205, top: 475, width: 170, height: 135 },
  { crop: { left: 468, top: 640, width: 125, height: 153 }, left: 405, top: 457, width: 125, height: 153 },
  // Rain chains begin directly beneath a visible eave corner. Their shortened
  // silhouettes stop above the walkable plane/platform instead of crossing it.
  { crop: { left: 160, top: 176, width: 38, height: 405 }, left: 452, top: 405, width: 24, height: 160 },
  { crop: { left: 875, top: 176, width: 40, height: 405 }, left: 992, top: 380, width: 25, height: 195 },
  { crop: { left: 1015, top: 665, width: 105, height: 128 }, left: 920, top: 482, width: 105, height: 128 },
  { crop: { left: 1165, top: 680, width: 120, height: 113 }, left: 925, top: 497, width: 120, height: 113 },
  { crop: { left: 1310, top: 585, width: 205, height: 208 }, left: 1330, top: 455, width: 143, height: 145 },
  { crop: { left: 1425, top: 176, width: 40, height: 405 }, left: 1372, top: 350, width: 24, height: 190 },
];
const decorationInputs = [];
for (const spec of decorationSpecs) {
  const { crop, left, top, width: targetWidth, height: targetHeight } = spec;
  decorationInputs.push({
    input: await sharp(decorationSource).extract(crop).resize(targetWidth, targetHeight, { fit: "fill" }).png().toBuffer(),
    left,
    top,
  });
}
const decoration = await blank().composite([
  ...decorationInputs,
]).png().toBuffer();
await sharp(decoration).toFile(path.join(layersDir, "30-decoration.png"));

const effects = await sharp(Buffer.from(`
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
  <defs><filter id="mist"><feGaussianBlur stdDeviation="23 8"/></filter></defs>
  <g stroke="#647b80" stroke-width="2" opacity=".17">
    ${Array.from({ length: 31 }, (_, i) => `<line x1="${12 + i * 57}" y1="${58 + (i % 7) * 29}" x2="${-30 + i * 57}" y2="${240 + (i % 7) * 29}"/>`).join("")}
  </g>
  <g fill="#dce3e2" opacity=".12" filter="url(#mist)">
    <ellipse cx="235" cy="595" rx="230" ry="21"/><ellipse cx="790" cy="593" rx="320" ry="24"/><ellipse cx="1340" cy="585" rx="285" ry="22"/>
  </g>
  <g fill="none" stroke="#6e8589" stroke-width="2.5" opacity=".42">
    <path d="M300 600q24 8 48 0M307 607q17 6 34 0"/><path d="M847 600q26 8 52 0"/><path d="M1470 591q22 7 44 0"/>
  </g>
</svg>`)).png().toBuffer();
await sharp(effects).toFile(path.join(layersDir, "40-effects.png"));

const foundationTexture = await sharp(files.s04Foundation)
  .extract({ left: 1260, top: 610, width: 412, height: 331 })
  .png()
  .toBuffer();
// Resize the stone wash once across the complete screen, then cut both height
// regions from that same raster. At world Y=610 both slices therefore sample
// row 10 of one continuous texture and cannot form a vertical image seam.
const continuousGroundTexture = await buildMirroredFoundationTexture(foundationTexture, 412, width, 341);
const groundLeft = await sharp(continuousGroundTexture)
  .extract({ left: 0, top: 10, width: 1080, height: 331 })
  .png()
  .toBuffer();
const groundRight = await sharp(continuousGroundTexture)
  .extract({ left: 1080, top: 0, width: 592, height: 341 })
  .png()
  .toBuffer();
const groundCap = await sharp(Buffer.from(`
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
  <path d="M0 610H1080V600H1672" fill="none" stroke="#121716" stroke-width="6" stroke-linejoin="round"/>
</svg>`)).png().toBuffer();
const foundationBase = await blank().composite([
  { input: groundLeft, left: 0, top: 610 },
  { input: groundRight, left: 1080, top: 600 },
  { input: groundCap, left: 0, top: 0 },
]).png().toBuffer();
// S05 starts with a mirrored sample of S04's final ground pixels. This keeps
// the exact boundary texels while fading into S05's continuous texture.
const foundationContinuation = await fadedContinuation(files.s04Foundation, 360, 70);
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
await sharp(composite).toFile(path.join(assetRoot, "s05-ink-background-layered-1672.png"));
await sharp(composite).resize(3840, 2160, { fit: "fill", kernel: sharp.kernel.lanczos3 }).png().toFile(path.join(assetRoot, "s05-ink-background-layered-4k.png"));
await sharp({ create: { width: width * 2, height, channels: 3, background: { r: 198, g: 200, b: 202 } } })
  .composite([{ input: files.s04, left: 0, top: 0 }, { input: composite, left: width, top: 0 }])
  .png()
  .toFile(path.join(root, "tmp", "s04-s05-surface-seam-preview.png"));

console.log(`S05 surface five-layer composite exported; cool background gains ${gains.map((value) => value.toFixed(4)).join(", ")}.`);
