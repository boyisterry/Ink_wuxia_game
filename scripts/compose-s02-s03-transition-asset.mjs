import path from "node:path";
import sharp from "sharp";

const root = process.cwd();
const sharedDir = path.join(root, "public/assets/maps/gate/shared");
const source = path.join(sharedDir, "s02-s03-stone-culvert.png");
const output = path.join(sharedDir, "s02-s03-stone-culvert-world.png");

const trimmed = await sharp(source)
  .trim({ threshold: 8 })
  .greyscale()
  .normalize()
  .linear(0.9, 20)
  .png()
  .toBuffer();

const { data, info } = await sharp(trimmed)
  .resize(760, 210, { fit: "fill", kernel: sharp.kernel.lanczos3 })
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });

for (let y = 0; y < info.height; y += 1) {
  const bottomFade = y <= 176 ? 1 : Math.max(0, 1 - (y - 176) / 34);
  for (let x = 0; x < info.width; x += 1) {
    const alphaIndex = (y * info.width + x) * 4 + 3;
    data[alphaIndex] = Math.round(data[alphaIndex] * 0.86 * bottomFade);
  }
}

await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
  .png()
  .toFile(output);

console.log("S02-S03 shared stone culvert exported at 760x210.");
