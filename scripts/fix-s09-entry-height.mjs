import { mkdir, access } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = process.cwd();
const assetRoot = path.join(root, "public/assets/maps/gate");
const sourceDir = path.join(assetRoot, "s09/source");
const source = path.join(sourceDir, "00-before-entry-height-fix.png");
const output1672 = path.join(assetRoot, "s09-ink-background-layered-1672.png");
const output4k = path.join(assetRoot, "s09-ink-background-layered-4k.png");
const width = 1672;
const height = 941;
const seamWidth = 260;

await mkdir(sourceDir, { recursive: true });
try {
  await access(source);
} catch {
  await sharp(output1672).png().toFile(source);
}

const { data, info } = await sharp(source)
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });
const fixed = Buffer.from(data);

const copyPixel = (targetX, targetY, sourceX, sourceY) => {
  const target = (targetY * width + targetX) * info.channels;
  const from = (sourceY * width + sourceX) * info.channels;
  for (let channel = 0; channel < info.channels; channel += 1) fixed[target + channel] = data[from + channel];
};

for (let x = 0; x < seamWidth; x += 1) {
  const progress = x / seamWidth;
  const oldSurface = Math.round(260 + 100 * progress);
  const offset = Math.round(40 * (1 - progress));

  for (let y = oldSurface; y < height; y += 1) {
    if (y < oldSurface + offset) {
      const textureY = Math.max(0, oldSurface - 1 - ((y - oldSurface) % 9));
      copyPixel(x, y, x, textureY);
    } else {
      copyPixel(x, y, x, y - offset);
    }
  }
}

const fixedImage = await sharp(fixed, {
  raw: { width, height, channels: info.channels },
}).png().toBuffer();
await sharp(fixedImage).toFile(output1672);
await sharp(fixedImage)
  .resize(3840, 2160, { fit: "fill", kernel: sharp.kernel.lanczos3 })
  .png()
  .toFile(output4k);

const s08 = path.join(assetRoot, "s08-ink-background-layered-1672.png");
await sharp({ create: { width: width * 2, height, channels: 3, background: { r: 198, g: 200, b: 202 } } })
  .composite([{ input: s08, left: 0, top: 0 }, { input: fixedImage, left: width, top: 0 }])
  .png()
  .toFile(path.join(root, "tmp/s08-s09-flat-seam-preview.png"));

console.log("S09 entry corrected from Y260 to Y300; S08/S09 seam preview exported.");
