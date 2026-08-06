import path from "node:path";
import sharp from "sharp";
import { gradeCoolInkBackground } from "./ink-color-grade.mjs";

const root = process.cwd();
const assetRoot = path.join(root, "public/assets/maps/gate");
const s04Dir = path.join(assetRoot, "s04");
const layersDir = path.join(s04Dir, "layers");
const width = 1672;
const height = 941;

const files = {
  s03: path.join(assetRoot, "s03-ink-background-layered-1672.png"),
  s03Background: path.join(assetRoot, "s03/layers/00-background-mountains.png"),
  s03Foundation: path.join(assetRoot, "s03/layers/50-foundation.png"),
  backgroundSource: path.join(s04Dir, "source/00-background-generated.png"),
  architectureSource: path.join(s04Dir, "source/20-background-architecture-keyed.png"),
  decorationSource: path.join(s04Dir, "source/30-decoration-keyed.png"),
};

const { buffer: gradedBackground, gains: backgroundGains } = await gradeCoolInkBackground(files.backgroundSource, width, height);
const continuationWidth = 360;
const { data: continuationRgb, info: continuationInfo } = await sharp(files.s03Background)
  .extract({ left: width - continuationWidth, top: 0, width: continuationWidth, height })
  .removeAlpha()
  .flop()
  .raw()
  .toBuffer({ resolveWithObject: true });
const continuationRgba = Buffer.alloc(continuationWidth * height * 4);
for (let y = 0; y < height; y += 1) {
  for (let x = 0; x < continuationWidth; x += 1) {
    const sourceIndex = (y * continuationWidth + x) * continuationInfo.channels;
    const targetIndex = (y * continuationWidth + x) * 4;
    const fade = x < 100 ? 1 : 1 - Math.min(1, (x - 100) / (continuationWidth - 100));
    continuationRgba[targetIndex] = continuationRgb[sourceIndex];
    continuationRgba[targetIndex + 1] = continuationRgb[sourceIndex + 1];
    continuationRgba[targetIndex + 2] = continuationRgb[sourceIndex + 2];
    continuationRgba[targetIndex + 3] = Math.round(255 * fade * fade * (3 - 2 * fade));
  }
}
const continuation = await sharp(continuationRgba, { raw: { width: continuationWidth, height, channels: 4 } }).png().toBuffer();
const background = await sharp(gradedBackground).composite([{ input: continuation, left: 0, top: 0 }]).png().toBuffer();
await sharp(background).toFile(path.join(layersDir, "00-background-mountains.png"));

const architecture = await sharp(files.architectureSource)
  .resize(width, height, { fit: "fill", kernel: sharp.kernel.lanczos3 })
  .greyscale()
  .png()
  .toBuffer();
await sharp(architecture).toFile(path.join(layersDir, "20-background-architecture.png"));

const decorationBase = await sharp(files.decorationSource)
  .resize(width, height, { fit: "fill", kernel: sharp.kernel.lanczos3 })
  .greyscale()
  .png()
  .toBuffer();
// The generated jars originally sat behind the Y590/Y610 step and were mostly
// occluded by Layer 5.  Keep them as one Layer 3 sprite, remove the original,
// then anchor the full silhouettes to the unobstructed Y570 ground.
const jarSource = { left: 900, top: 500, width: 240, height: 175 };
const jars = await sharp(decorationBase).extract(jarSource).png().toBuffer();
const jarRemovalMask = await sharp({ create: { width: jarSource.width, height: jarSource.height, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } } }).png().toBuffer();
const decorationWithoutOriginalJars = await sharp(decorationBase)
  .composite([{ input: jarRemovalMask, left: jarSource.left, top: jarSource.top, blend: "dest-out" }])
  .png()
  .toBuffer();
const hatchCue = await sharp(Buffer.from(`
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
  <g transform="translate(720 570)" fill="#565a56" stroke="#202421" stroke-linejoin="round">
    <path d="M0 0l69-5 71 5v18l-68 5-72-5Z" stroke-width="4"/>
    <path d="M69-5v28M18 2l24 8 20-12 25 13 25-10" fill="none" stroke="#171b18" stroke-width="3"/>
  </g>
  <g fill="#303a36" opacity=".76"><path d="M728 568q10-32 21 0q8-26 17 0M788 569q9-28 18 0"/></g>
</svg>`)).png().toBuffer();
const decoration = await sharp(decorationWithoutOriginalJars).composite([
  // Sink the sprite 25px into Layer 5 so the ceramic bases, rather than the
  // surrounding grass alpha, visually meet the Y570 collision cap.
  { input: jars, left: 460, top: 420, blend: "over" },
  { input: hatchCue },
]).png().toBuffer();
await sharp(decoration).toFile(path.join(layersDir, "30-decoration.png"));

const effects = await sharp(Buffer.from(`
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
  <defs><filter id="mist"><feGaussianBlur stdDeviation="22 9"/></filter></defs>
  <g stroke="#667b7e" stroke-width="2.2" opacity=".16">
    ${Array.from({ length: 28 }, (_, index) => `<line x1="${16 + index * 64}" y1="${70 + (index % 6) * 31}" x2="${-28 + index * 64}" y2="${248 + (index % 6) * 31}"/>`).join("")}
  </g>
  <g fill="#dbe0df" opacity=".12" filter="url(#mist)">
    <ellipse cx="300" cy="552" rx="250" ry="24"/><ellipse cx="850" cy="574" rx="330" ry="26"/><ellipse cx="1420" cy="584" rx="250" ry="22"/>
  </g>
  <g fill="none" stroke="#748d90" stroke-width="3" opacity=".42"><path d="M744 585q25 10 50 0"/><path d="M754 596q16 7 32 0"/></g>
</svg>`)).png().toBuffer();
await sharp(effects).toFile(path.join(layersDir, "40-effects.png"));

const foundationTexture = await sharp(files.s03Foundation)
  .extract({ left: 1260, top: 570, width: 412, height: 371 })
  .png()
  .toBuffer();
const foundationSegments = [
  { left: 0, top: 570, width: 860, height: 371 },
  { left: 860, top: 590, width: 400, height: 351 },
  { left: 1260, top: 610, width: 412, height: 331 },
];
const foundationComposites = [];
for (const segment of foundationSegments) {
  foundationComposites.push({
    input: await sharp(foundationTexture).resize(segment.width, segment.height, { fit: "fill", kernel: sharp.kernel.lanczos3 }).png().toBuffer(),
    left: segment.left,
    top: segment.top,
  });
}
const foundationCaps = await sharp(Buffer.from(`
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
  <g fill="none" stroke="#171b18" stroke-width="5" stroke-linejoin="round">
    <path d="M0 570H860V590H1260V610H1672"/>
  </g>
</svg>`)).png().toBuffer();
const foundation = await sharp({ create: { width, height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
  .composite([...foundationComposites, { input: foundationCaps, left: 0, top: 0 }])
  .png()
  .toBuffer();
await sharp(foundation).toFile(path.join(layersDir, "50-foundation.png"));

const composite = await sharp(background).composite([
  { input: architecture, blend: "over" },
  { input: decoration, blend: "over" },
  { input: effects, blend: "over" },
  { input: foundation, blend: "over" },
]).png().toBuffer();
await sharp(composite).toFile(path.join(assetRoot, "s04-ink-background-layered-1672.png"));
await sharp(composite).resize(3840, 2160, { fit: "fill", kernel: sharp.kernel.lanczos3 }).png().toFile(path.join(assetRoot, "s04-ink-background-layered-4k.png"));
await sharp({ create: { width: width * 2, height, channels: 3, background: { r: 198, g: 200, b: 202 } } })
  .composite([{ input: files.s03, left: 0, top: 0 }, { input: composite, left: width, top: 0 }])
  .png()
  .toFile(path.join(root, "tmp", "s03-s04-seam-preview.png"));

console.log(`S04 five-layer composite exported; cool background gains ${backgroundGains.map((value) => value.toFixed(4)).join(", ")}.`);
