import path from "node:path";
import sharp from "sharp";
import { gradeCoolInkBackground } from "./ink-color-grade.mjs";

const root = process.cwd();
const layersDir = path.join(root, "public/assets/maps/gate/s02/layers");
const outputDir = path.join(root, "public/assets/maps/gate");
const width = 1672;
const height = 941;
const neutral = { r: 255, g: 255, b: 255 };

const files = {
  s01: path.join(outputDir, "s01-ink-background-layered-1672.png"),
  s03: path.join(outputDir, "s03-ink-background-layered-1672.png"),
  seamBamboo: path.join(outputDir, "shared/s01-s02-seam-bamboo.png"),
  s02S03Bamboo: path.join(outputDir, "shared/s02-s03-seam-bamboo-world.png"),
  background: path.join(layersDir, "00-background-mountains-panorama.png"),
  architecture: path.join(layersDir, "20-architecture-source.png"),
  ground: path.join(layersDir, "50-ground-source.png"),
  sharedTransition: path.join(outputDir, "shared/s02-s03-stone-culvert-world.png"),
};

const blank = () => sharp({ create: { width, height, channels: 3, background: neutral } });

const regionMoments = async (input, left, regionWidth) => {
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const sums = [0, 0, 0];
  const squares = [0, 0, 0];
  let count = 0;
  for (let y = 0; y < info.height; y += 1) {
    for (let x = left; x < left + regionWidth; x += 1) {
      const index = (y * info.width + x) * info.channels;
      for (let channel = 0; channel < 3; channel += 1) {
        const value = data[index + channel];
        sums[channel] += value;
        squares[channel] += value * value;
      }
      count += 1;
    }
  }
  return sums.map((sum, channel) => ({
    mean: sum / count,
    stdev: Math.sqrt(Math.max(1, squares[channel] / count - (sum / count) ** 2)),
  }));
};

async function gradeRightEdgeTowardS03(input, startX = 760, sampleWidth = 480) {
  const [sourceMoments, targetMoments] = await Promise.all([
    regionMoments(input, width - sampleWidth, sampleWidth),
    regionMoments(files.s03, 0, sampleWidth),
  ]);
  const gains = sourceMoments.map((source, channel) =>
    Math.max(.86, Math.min(1.14, targetMoments[channel].stdev / source.stdev)));
  const offsets = sourceMoments.map((source, channel) =>
    Math.max(-32, Math.min(32, targetMoments[channel].mean - source.mean * gains[channel])));
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const output = Buffer.from(data);
  for (let y = 0; y < info.height; y += 1) {
    for (let x = startX; x < width; x += 1) {
      const progress = (x - startX) / Math.max(1, width - 1 - startX);
      const blend = progress * progress * (3 - 2 * progress);
      const index = (y * width + x) * info.channels;
      for (let channel = 0; channel < 3; channel += 1) {
        const original = data[index + channel];
        const graded = original * gains[channel] + offsets[channel];
        output[index + channel] = Math.round(Math.max(0, Math.min(255, original * (1 - blend) + graded * blend)));
      }
    }
  }
  return sharp(output, { raw: info }).png().toBuffer();
}

async function s03FoundationContinuation(stripWidth = 480, floorY = 632) {
  const { data, info } = await sharp(files.s03)
    .extract({ left: 0, top: floorY, width: stripWidth, height: height - floorY })
    .flop()
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const output = Buffer.from(data);
  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < stripWidth; x += 1) {
      const progress = x / Math.max(1, stripWidth - 1);
      const alpha = progress * progress * (3 - 2 * progress);
      const index = (y * stripWidth + x) * info.channels + 3;
      output[index] = Math.round(output[index] * alpha);
    }
  }
  return sharp(output, { raw: info }).png().toBuffer();
}
const sprite = async (source, target, trimArtwork = false) => {
  const extracted = await sharp(files.architecture)
    .extract(source)
    .png()
    .toBuffer();
  const artwork = trimArtwork
    ? await sharp(extracted).trim({ threshold: 18 }).png().toBuffer()
    : extracted;
  return sharp(artwork)
    .resize(target.width, target.height, { fit: "fill", kernel: sharp.kernel.lanczos3 })
    .greyscale()
    .normalize()
    .png()
    .toBuffer();
};

const houseSpecs = [
  {
    id: "A05-west-house",
    source: { left: 36, top: 322, width: 438, height: 416 },
    target: { left: 204, top: 318, width: 352, height: 356 },
    trimArtwork: false,
  },
  {
    id: "A06-east-house",
    source: { left: 760, top: 246, width: 572, height: 494 },
    // Anchor the visible wall to the lowest terrain step (Y=660). The Layer 5
    // foundation masks the lower 14/28px where the terrain rises to Y=646/632.
    target: { left: 738, top: 284, width: 422, height: 376 },
    trimArtwork: true,
  },
];

const houseComposites = [];
for (const spec of houseSpecs) {
  houseComposites.push({
    input: await sprite(spec.source, spec.target, spec.trimArtwork),
    left: spec.target.left,
    top: spec.target.top,
    blend: "multiply",
  });
}

const architectureLayer = await blank().composite(houseComposites).png().toBuffer();
await sharp(architectureLayer).toFile(path.join(layersDir, "20-architecture.png"));

const propSpecs = [
  {
    id: "A07-rain-trough",
    source: { left: 438, top: 466, width: 310, height: 272 },
    target: { left: 480, top: 528, width: 260, height: 146 },
    opacity: 1,
    trimArtwork: false,
  },
  {
    id: "A08-bamboo-fence",
    source: { left: 544, top: 458, width: 260, height: 280 },
    target: { left: 600, top: 400, width: 380, height: 274 },
    opacity: 0.58,
    trimArtwork: true,
  },
];

const structureComposites = [];
const decorationComposites = [];
for (const spec of propSpecs) {
  const composite = {
    input: await sprite(spec.source, spec.target, spec.trimArtwork),
    left: spec.target.left,
    top: spec.target.top,
    blend: "multiply",
    opacity: spec.opacity,
  };
  if (spec.id === "A07-rain-trough") {
    structureComposites.push(composite);
  } else {
    decorationComposites.push(composite);
  }
}

const backgroundArchitectureLayer = await sharp(architectureLayer)
  .composite([
    ...structureComposites,
    {
      input: await sharp(files.sharedTransition)
        .extract({ left: 0, top: 0, width: 620, height: 210 })
        .png()
        .toBuffer(),
      left: 1052,
      top: 422,
      blend: "over",
    },
  ])
  .png()
  .toBuffer();
await sharp(backgroundArchitectureLayer).toFile(path.join(layersDir, "20-background-architecture.png"));
const s02S03Bamboo = await sharp(files.s02S03Bamboo)
  .extract({ left: 0, top: 0, width: 622, height: 700 })
  .png()
  .toBuffer();
const decorationLayer = await blank().composite([
  ...decorationComposites,
  { input: s02S03Bamboo, left: 1050, top: 0, blend: "over" },
]).png().toBuffer();
await sharp(decorationLayer).toFile(path.join(layersDir, "30-decoration.png"));
const effectsLayer = await sharp({ create: { width, height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
  .png()
  .toBuffer();
await sharp(effectsLayer).toFile(path.join(layersDir, "40-effects.png"));

const groundSpecs = [
  {
    id: "C09-C10",
    source: { left: 0, top: 640, width: 780, height: 301 },
    target: { left: 0, top: 674, width: 720, height: 267 },
  },
  {
    id: "C11",
    source: { left: 780, top: 610, width: 260, height: 331 },
    target: { left: 720, top: 660, width: 180, height: 281 },
  },
  {
    id: "C12",
    source: { left: 1040, top: 580, width: 235, height: 361 },
    target: { left: 900, top: 646, width: 200, height: 295 },
  },
  {
    id: "C13-C14",
    source: { left: 1275, top: 550, width: 397, height: 391 },
    target: { left: 1100, top: 632, width: 572, height: 309 },
  },
];

const groundComposites = [];
for (const spec of groundSpecs) {
  const input = await sharp(files.ground)
    .extract(spec.source)
    .resize(spec.target.width, spec.target.height, { fit: "fill", kernel: sharp.kernel.lanczos3 })
    .greyscale()
    .normalize()
    .png()
    .toBuffer();
  groundComposites.push({ input, left: spec.target.left, top: spec.target.top });
}

const capSpecs = [
  { source: { left: 0, top: 650, width: 780, height: 22 }, target: { left: 0, top: 674, width: 720, height: 18 } },
  { source: { left: 800, top: 623, width: 240, height: 22 }, target: { left: 720, top: 660, width: 180, height: 18 } },
  { source: { left: 1040, top: 598, width: 235, height: 22 }, target: { left: 900, top: 646, width: 200, height: 18 } },
  { source: { left: 1275, top: 565, width: 397, height: 22 }, target: { left: 1100, top: 632, width: 572, height: 18 } },
];

for (const spec of capSpecs) {
  const input = await sharp(files.ground)
    .extract(spec.source)
    .resize(spec.target.width, spec.target.height, { fit: "fill", kernel: sharp.kernel.lanczos3 })
    .greyscale()
    .normalize()
    .png()
    .toBuffer();
  groundComposites.push({ input, left: spec.target.left, top: spec.target.top });
}

const collisionContour = Buffer.from(`
  <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <path d="M0 675H720V661H900V647H1100V633H1672" fill="none" stroke="#1c1b19" stroke-width="2" stroke-linejoin="miter"/>
  </svg>
`);
groundComposites.push({ input: await sharp(collisionContour).png().toBuffer(), left: 0, top: 0 });

const rawGroundLayer = await blank().composite(groundComposites).png().toBuffer();
const groundLayer = await sharp(rawGroundLayer)
  .greyscale()
  .normalize()
  .png()
  .toBuffer();
await sharp(groundLayer).toFile(path.join(layersDir, "50-ground.png"));
await sharp(groundLayer).toFile(path.join(layersDir, "50-foundation.png"));

const { buffer: background, gains: backgroundGains } = await gradeCoolInkBackground(files.background, width, height);
await sharp(background).toFile(path.join(layersDir, "00-background-mountains.png"));

const baseComposite = await sharp(background)
  .composite([
    { input: backgroundArchitectureLayer, blend: "multiply" },
    { input: decorationLayer, blend: "multiply" },
    { input: effectsLayer, blend: "over" },
    { input: groundLayer, blend: "multiply" },
  ])
  .png()
  .toBuffer();

// S02's background was generated as the forward continuation of S01. Do not
// mirror S01's edge here: the mirrored strip doubled the bamboo and produced a
// visibly clipped symmetry at the physical screen seam.
const gradedTowardS03 = await gradeRightEdgeTowardS03(baseComposite);
const finalComposite = await sharp(gradedTowardS03).composite([
  { input: await s03FoundationContinuation(), left: width - 480, top: 632 },
  { input: await sharp(files.s03).extract({ left: 0, top: 0, width: 1, height }).png().toBuffer(), left: width - 1, top: 0 },
]).png().toBuffer();

await sharp(finalComposite).toFile(path.join(outputDir, "s02-ink-background-layered-1672.png"));
await sharp(finalComposite)
  .resize(3840, 2160, { fit: "fill", kernel: sharp.kernel.lanczos3 })
  .png()
  .toFile(path.join(outputDir, "s02-ink-background-layered-4k.png"));
await sharp(finalComposite).toFile(path.join(outputDir, "s02-ink-background-layered-seam-v2-1672.png"));
await sharp(finalComposite)
  .resize(3840, 2160, { fit: "fill", kernel: sharp.kernel.lanczos3 })
  .png()
  .toFile(path.join(outputDir, "s02-ink-background-layered-seam-v2-4k.png"));

const previewBamboo = await sharp(files.seamBamboo)
  .resize(1244, 700, { fit: "fill", kernel: sharp.kernel.lanczos3 })
  .png()
  .toBuffer();
await sharp({ create: { width: width * 2, height, channels: 3, background: neutral } })
  .composite([
    { input: files.s01, left: 0, top: 0 },
    { input: finalComposite, left: width, top: 0 },
    { input: previewBamboo, left: width - 622, top: 10 },
  ])
  .png()
  .toFile(path.join(root, "tmp", "s01-s02-seam-preview.png"));

console.log(`S02 layered composite exported; cool background gains ${backgroundGains.map((value) => value.toFixed(4)).join(", ")}.`);
