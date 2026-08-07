import path from "node:path";
import sharp from "sharp";
import { gradeCoolInkBackground } from "./ink-color-grade.mjs";
import { buildMirroredFoundationTexture } from "./ink-foundation-texture.mjs";

const root = process.cwd();
const assetRoot = path.join(root, "public/assets/maps/gate");
const s03Dir = path.join(assetRoot, "s03");
const layersDir = path.join(s03Dir, "layers");
const width = 1672;
const height = 941;

const files = {
  s02: path.join(assetRoot, "s02-ink-background-layered-1672.png"),
  s01: path.join(assetRoot, "s01-ink-background-layered-1672.png"),
  s02Background: path.join(assetRoot, "s02/layers/00-background-mountains.png"),
  sharedTransition: path.join(assetRoot, "shared/s02-s03-stone-culvert-world.png"),
  sharedBamboo: path.join(assetRoot, "shared/s02-s03-seam-bamboo-world.png"),
  s02Foundation: path.join(assetRoot, "s02/layers/50-foundation.png"),
  backgroundSource: path.join(s03Dir, "source/00-background-generated.png"),
  architectureKeyed: path.join(layersDir, "20-background-architecture-keyed.png"),
  decorationKeyed: path.join(layersDir, "30-decoration-keyed.png"),
};

const { buffer: gradedBackground, gains: backgroundGains } = await gradeCoolInkBackground(files.backgroundSource, width, height);
const s02Background = await sharp(files.s02Background).resize(width, height, { fit: "fill" }).png().toBuffer();
const mountainContinuationWidth = 720;
const { data: mountainContinuationRgb, info: mountainContinuationInfo } = await sharp(s02Background)
  .extract({ left: width - mountainContinuationWidth, top: 0, width: mountainContinuationWidth, height })
  .removeAlpha()
  .flop()
  .raw()
  .toBuffer({ resolveWithObject: true });
const mountainContinuationRgba = Buffer.alloc(mountainContinuationWidth * height * 4);
for (let y = 0; y < height; y += 1) {
  for (let x = 0; x < mountainContinuationWidth; x += 1) {
    const sourceIndex = (y * mountainContinuationWidth + x) * mountainContinuationInfo.channels;
    const targetIndex = (y * mountainContinuationWidth + x) * 4;
    const fadeStart = 240;
    const fadeProgress = Math.max(0, Math.min(1, (x - fadeStart) / (mountainContinuationWidth - fadeStart)));
    const smoothFade = fadeProgress * fadeProgress * (3 - 2 * fadeProgress);
    mountainContinuationRgba[targetIndex] = mountainContinuationRgb[sourceIndex];
    mountainContinuationRgba[targetIndex + 1] = mountainContinuationRgb[sourceIndex + 1];
    mountainContinuationRgba[targetIndex + 2] = mountainContinuationRgb[sourceIndex + 2];
    mountainContinuationRgba[targetIndex + 3] = Math.round(255 * (1 - smoothFade));
  }
}
const mountainContinuation = await sharp(mountainContinuationRgba, {
  raw: { width: mountainContinuationWidth, height, channels: 4 },
}).png().toBuffer();
const background = await sharp(gradedBackground)
  .composite([{ input: mountainContinuation, left: 0, top: 0 }])
  .png()
  .toBuffer();
await sharp(background).toFile(path.join(layersDir, "00-background-mountains.png"));

const architectureBase = await sharp(files.architectureKeyed)
  .resize(width, height, { fit: "fill", kernel: sharp.kernel.lanczos3 })
  .png()
  .toBuffer();
const duplicateBridgeMask = await sharp(Buffer.from(`
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
  <rect x="0" y="430" width="280" height="300" fill="#fff"/>
</svg>`)).png().toBuffer();
const architectureWithoutDuplicateBridge = await sharp(architectureBase)
  .composite([{ input: duplicateBridgeMask, left: 0, top: 0, blend: "dest-out" }])
  .png()
  .toBuffer();
const exactPlatforms = Buffer.from(`
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
  <g fill="#77746d" stroke="#252724" stroke-width="4" stroke-linejoin="round">
    <path d="M620 497l34-3 42 2 38-3 44 3 42-2 40 3v15l-23 5-47-2-39 3-48-3-43 2Z"/>
    <path d="M1120 447l31-3 42 2 37-3 44 3 34-2 32 3v15l-31 5-42-2-39 3-45-3-43 2Z"/>
  </g>
  <g stroke="#aaa49a" stroke-width="2" opacity=".62"><path d="M636 500l49-1m17 1 55-1m18 1 59-1M1137 450l48-1m18 1 49-1m17 1 48-1"/></g>
  <g stroke="#353735" stroke-width="2" opacity=".7"><path d="M687 497v16m79-17v17M1191 447v16m70-17v17"/></g>
</svg>`);
const sharedTransitionS03 = await sharp(files.sharedTransition)
  .extract({ left: 620, top: 0, width: 140, height: 210 })
  .png()
  .toBuffer();
const architecture = await sharp(architectureWithoutDuplicateBridge)
  .composite([
    { input: sharedTransitionS03, left: 0, top: 422 },
    { input: await sharp(exactPlatforms).png().toBuffer(), left: 0, top: 0 },
  ])
  .greyscale()
  .png()
  .toBuffer();
await sharp(architecture).toFile(path.join(layersDir, "20-background-architecture.png"));

const decorationSource = await sharp(files.decorationKeyed)
  .resize(width, height, { fit: "fill", kernel: sharp.kernel.lanczos3 })
  .png()
  .toBuffer();
const decorationParts = [
  { left: 0, width: 400, dy: -8 },
  { left: 400, width: 450, dy: -5 },
  { left: 850, width: 400, dy: -40 },
  { left: 1250, width: 422, dy: -40 },
];
const decorationComposites = [];
const sharedBambooS03 = await sharp(files.sharedBamboo)
  .extract({ left: 622, top: 0, width: 622, height: 700 })
  .png()
  .toBuffer();
decorationComposites.push({ input: sharedBambooS03, left: 0, top: 0 });
for (const part of decorationParts) {
  const input = await sharp(decorationSource).extract({ left: part.left, top: 0, width: part.width, height }).png().toBuffer();
  decorationComposites.push({ input, left: part.left, top: part.dy });
}
const decoration = await sharp({ create: { width, height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
  .composite(decorationComposites)
  .greyscale()
  .png()
  .toBuffer();
await sharp(decoration).toFile(path.join(layersDir, "30-decoration.png"));

const effects = await sharp(Buffer.from(`
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
  <defs><filter id="mistBlur" x="-20%" y="-80%" width="140%" height="260%"><feGaussianBlur stdDeviation="24 10"/></filter></defs>
  <g stroke="#6d7f80" stroke-width="2.4" opacity=".18">
    ${Array.from({ length: 26 }, (_, index) => `<line x1="${20 + index * 68}" y1="${90 + (index % 5) * 29}" x2="${-25 + index * 68}" y2="${270 + (index % 5) * 29}"/>`).join("")}
  </g>
  <g fill="#d9ddda" opacity=".10" filter="url(#mistBlur)">
    <ellipse cx="260" cy="558" rx="245" ry="25"/><ellipse cx="720" cy="575" rx="290" ry="27"/>
    <ellipse cx="1190" cy="540" rx="235" ry="23"/><ellipse cx="1530" cy="520" rx="170" ry="21"/>
  </g>
  <g fill="none" stroke="#768d8e" stroke-width="5" opacity=".35">
    <path d="M260 617q90-18 180 0t180 0t180 0t180 0t180 0"/>
    <path d="M360 606q110-15 220 0t220 0t220 0"/>
  </g>
</svg>`)).greyscale().png().toBuffer();
await sharp(effects).toFile(path.join(layersDir, "40-effects.png"));

const foundationTexture = await sharp(files.s02Foundation)
  .extract({ left: 1100, top: 632, width: 572, height: 309 })
  .png()
  .toBuffer();
const continuousFoundationTexture = await buildMirroredFoundationTexture(foundationTexture, 572, width, 371);
const foundationSegments = [
  { left: 0, top: 632, width: 180, height: 309 },
  { left: 180, top: 620, width: 360, height: 321 },
  { left: 540, top: 600, width: 360, height: 341 },
  { left: 900, top: 580, width: 360, height: 361 },
  { left: 1260, top: 570, width: 412, height: 371 },
];
const foundationComposites = [];
for (const segment of foundationSegments) {
  foundationComposites.push({
    // All pieces are sampled from one world-aligned raster. The vertical crop
    // offset equals the segment's height above the lowest Y=570 surface.
    input: await sharp(continuousFoundationTexture)
      .extract({ left: segment.left, top: segment.top - 570, width: segment.width, height: segment.height })
      .png()
      .toBuffer(),
    left: segment.left,
    top: segment.top,
  });
}
const foundationCap = await sharp(Buffer.from(`
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
  <path d="M0 632H180V620H540V600H900V580H1260V570H1672" fill="none" stroke="#171b18" stroke-width="5" stroke-linejoin="round"/>
</svg>`)).png().toBuffer();
const foundation = await sharp({ create: { width, height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
  .composite([...foundationComposites, { input: foundationCap, left: 0, top: 0 }])
  .png()
  .toBuffer();
await sharp(foundation).toFile(path.join(layersDir, "50-foundation.png"));

const composite = await sharp(background)
  .composite([
    { input: architecture, blend: "over" },
    { input: decoration, blend: "over" },
    { input: effects, blend: "over" },
    { input: foundation, blend: "over" },
  ])
  .png()
  .toBuffer();
await sharp(composite).toFile(path.join(assetRoot, "s03-ink-background-layered-1672.png"));
await sharp(composite).resize(3840, 2160, { fit: "fill", kernel: sharp.kernel.lanczos3 }).png().toFile(path.join(assetRoot, "s03-ink-background-layered-4k.png"));

await sharp({ create: { width: width * 2, height, channels: 3, background: { r: 239, g: 233, b: 220 } } })
  .composite([
    { input: files.s02, left: 0, top: 0 },
    { input: composite, left: width, top: 0 },
  ])
  .png()
  .toFile(path.join(root, "tmp", "s02-s03-seam-preview.png"));

await sharp({ create: { width: width * 2, height, channels: 3, background: { r: 239, g: 233, b: 220 } } })
  .composite([{ input: s02Background, left: 0, top: 0 }, { input: background, left: width, top: 0 }])
  .png()
  .toFile(path.join(root, "tmp", "s02-s03-background-seam-preview.png"));

await sharp({ create: { width: width * 3, height, channels: 3, background: { r: 198, g: 200, b: 202 } } })
  .composite([
    { input: files.s01, left: 0, top: 0 },
    { input: files.s02, left: width, top: 0 },
    { input: composite, left: width * 2, top: 0 },
  ])
  .png()
  .toFile(path.join(root, "tmp", "s01-s03-cool-tone-preview.png"));

console.log(`S03 five-layer composite exported; background gains ${backgroundGains.map((value) => value.toFixed(4)).join(", ")}.`);
