import path from "node:path";
import sharp from "sharp";

const root = process.cwd();
const sourceDir = path.join(root, "local-art-source/editable/maps/gate/shared/source");
const sharedDir = path.join(root, "local-art-source/runtime-originals/assets/maps/gate/shared");
const s01Layers = path.join(root, "local-art-source/editable/maps/gate/s01/layers");
const s02Layers = path.join(root, "local-art-source/editable/maps/gate/s02/layers");
const screenWidth = 1672;
const height = 941;
const overlap = 256;
const panelWidth = screenWidth + overlap / 2;

const files = {
  left: path.join(sourceDir, "s01-mountains-reference-pass.png"),
  right: path.join(sourceDir, "s02-mountains-continuation-pass.png"),
};

const leftColor = await sharp(files.left)
  .resize(panelWidth, height, { fit: "fill", kernel: sharp.kernel.lanczos3 })
  .png()
  .toBuffer();
const rightColor = await sharp(files.right)
  .resize(panelWidth, height, { fit: "fill", kernel: sharp.kernel.lanczos3 })
  .png()
  .toBuffer();

// Separate paper and ink. A single paper field spans both screens; generated
// mountain passes contribute neutral ink only, so their source paper textures
// cannot form a vertical color/texture boundary.
const paper = await sharp(leftColor)
  .extract({ left: 0, top: 720, width: panelWidth, height: 221 })
  .resize(screenWidth * 2, height, { fit: "fill", kernel: sharp.kernel.lanczos3 })
  .blur(0.3)
  .png()
  .toBuffer();
const inkify = (input) => sharp(input)
  .greyscale()
  .linear(1.08, -8)
  .png()
  .toBuffer();
const [left, right] = await Promise.all([inkify(leftColor), inkify(rightColor)]);

const alphaMask = async (direction) => sharp(Buffer.from(`
  <svg xmlns="http://www.w3.org/2000/svg" width="${panelWidth}" height="${height}">
    <defs>
      <linearGradient id="a" x1="0%" x2="100%">
        ${direction === "left"
          ? `<stop offset="0%" stop-color="white"/><stop offset="${((screenWidth - overlap / 2) / panelWidth) * 100}%" stop-color="white"/><stop offset="100%" stop-color="black"/>`
          : `<stop offset="0%" stop-color="black"/><stop offset="${(overlap / panelWidth) * 100}%" stop-color="white"/><stop offset="100%" stop-color="white"/>`}
      </linearGradient>
    </defs>
    <rect width="100%" height="100%" fill="url(#a)"/>
  </svg>`)).extractChannel("red").toBuffer();

const [leftAlpha, rightAlpha] = await Promise.all([alphaMask("left"), alphaMask("right")]);
const leftPanel = await sharp(left).removeAlpha().joinChannel(leftAlpha).png().toBuffer();
const rightPanel = await sharp(right).removeAlpha().joinChannel(rightAlpha).png().toBuffer();
const inkPanorama = await sharp({
  create: { width: screenWidth * 2, height, channels: 3, background: { r: 255, g: 255, b: 255 } },
})
  .composite([
    { input: leftPanel, left: 0, top: 0, blend: "over" },
    { input: rightPanel, left: screenWidth - overlap / 2, top: 0, blend: "over" },
  ])
  .png()
  .toBuffer();
const panorama = await sharp(paper)
  .composite([{ input: inkPanorama, left: 0, top: 0, blend: "multiply" }])
  .png()
  .toBuffer();

await sharp(panorama).toFile(path.join(sharedDir, "s01-s02-mountains-panorama.png"));
await sharp(panorama).extract({ left: 0, top: 0, width: screenWidth, height }).png()
  .toFile(path.join(s01Layers, "00-background-mountains-panorama.png"));
await sharp(panorama).extract({ left: screenWidth, top: 0, width: screenWidth, height }).png()
  .toFile(path.join(s02Layers, "00-background-mountains-panorama.png"));

console.log(`S01–S02 mountain panorama exported at ${screenWidth * 2}x${height} with one continuous paper field.`);
