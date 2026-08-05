import path from "node:path";
import sharp from "sharp";

const root = process.cwd();
const layersDir = path.join(root, "public/assets/maps/gate/s01/layers");
const outputDir = path.join(root, "public/assets/maps/gate");
const width = 1672;
const height = 941;
const neutral = { r: 255, g: 255, b: 255 };

const files = {
  background: path.join(layersDir, "00-background-mountains.png"),
  architecture: path.join(layersDir, "20-architecture.png"),
  platforms: path.join(layersDir, "40-platforms-source.png"),
  ground: path.join(layersDir, "50-ground-source.png"),
};

const neutralized = (input) =>
  sharp(input)
    .resize(width, height, { fit: "fill" })
    .linear(1.08, -12)
    .png()
    .toBuffer();

const architecture = await neutralized(files.architecture);
const platformSource = await sharp(files.platforms)
  .resize(width, height, { fit: "fill" })
  .png()
  .toBuffer();

const platformSpecs = [
  { id: "C06", source: { left: 55, top: 515, width: 525, height: 390 }, target: { left: 500, top: 600, width: 230, height: 120 } },
  { id: "C07", source: { left: 590, top: 390, width: 530, height: 500 }, target: { left: 775, top: 542, width: 225, height: 178 } },
  { id: "C08", source: { left: 1110, top: 330, width: 530, height: 520 }, target: { left: 1045, top: 478, width: 250, height: 242 } },
];

const platformComposites = [];
for (const spec of platformSpecs) {
  const extracted = await sharp(platformSource)
    .extract(spec.source)
    .png()
    .toBuffer();
  const trimmed = await sharp(extracted)
    .trim({ background: neutral, threshold: 22 })
    .png()
    .toBuffer();
  const sprite = await sharp(trimmed)
    .resize(spec.target.width, spec.target.height, { fit: "fill" })
    .linear(1.08, -12)
    .png()
    .toBuffer();

  platformComposites.push({
    input: sprite,
    left: spec.target.left,
    top: spec.target.top,
    blend: "multiply",
  });
}

const platformLayer = await sharp({ create: { width, height, channels: 3, background: neutral } })
  .composite(platformComposites)
  .png()
  .toBuffer();

const groundSource = await sharp(files.ground)
  .resize(width, height, { fit: "fill" })
  .png()
  .toBuffer();
const groundSegments = [
  { source: { left: 0, top: 0, width: 1124, height: 935 }, target: { left: 0, top: 6, width: 1180, height: 935 } },
  { source: { left: 1124, top: 0, width: 218, height: 931 }, target: { left: 1180, top: 10, width: 170, height: 931 } },
  { source: { left: 1342, top: 0, width: 330, height: 934 }, target: { left: 1350, top: 7, width: 322, height: 934 } },
];

const groundComposites = [];
for (const segment of groundSegments) {
  const image = await sharp(groundSource)
    .extract(segment.source)
    .resize(segment.target.width, segment.target.height, { fit: "fill" })
    .linear(1.08, -12)
    .png()
    .toBuffer();

  groundComposites.push({ input: image, left: segment.target.left, top: segment.target.top });
}

const westMask = await sharp({
  create: { width: 52, height: 310, channels: 3, background: neutral },
}).png().toBuffer();

const groundLayer = await sharp({ create: { width, height, channels: 3, background: neutral } })
  .composite([...groundComposites, { input: westMask, left: 0, top: 0 }])
  .png()
  .toBuffer();

const background = await sharp(files.background)
  .resize(width, height, { fit: "fill" })
  .png()
  .toBuffer();

const composite = await sharp(background)
  .composite([
    { input: architecture, blend: "multiply" },
    { input: platformLayer, blend: "multiply" },
    { input: groundLayer, blend: "multiply" },
  ])
  .png()
  .toBuffer();

await sharp(composite).toFile(path.join(outputDir, "s01-ink-background-layered-1672.png"));
await sharp(composite)
  .resize(3840, 2160, { fit: "fill", kernel: sharp.kernel.lanczos3 })
  .png()
  .toFile(path.join(outputDir, "s01-ink-background-layered-4k.png"));

console.log("S01 layered composite exported at 1672x941 and 3840x2160.");
