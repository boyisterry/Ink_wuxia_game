import path from "node:path";
import sharp from "sharp";

const root = process.cwd();
const assetRoot = path.join(root, "public/assets/maps/gate");
const sceneDir = path.join(assetRoot, "s06-underground");
const sourceDir = path.join(sceneDir, "source");
const layersDir = path.join(sceneDir, "layers");
const width = 1672;
const height = 941;

const transparentCanvas = () => sharp({
  create: { width, height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
});

const makeFadeStrip = async (input, stripWidth, direction = "out") => {
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const rgba = Buffer.from(data);
  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      const t = x / Math.max(1, stripWidth - 1);
      const fade = direction === "out" ? 1 - t : t;
      const smooth = fade * fade * (3 - 2 * fade);
      rgba[(y * info.width + x) * info.channels + 3] = Math.round(
        rgba[(y * info.width + x) * info.channels + 3] * smooth,
      );
    }
  }
  return sharp(rgba, { raw: info }).png().toBuffer();
};

const seamFromS05 = async (layer, stripWidth) => {
  const strip = await sharp(path.join(assetRoot, `s05-underground/layers/${layer}`))
    .extract({ left: width - stripWidth, top: 0, width: stripWidth, height })
    .flop()
    .png()
    .toBuffer();
  return makeFadeStrip(strip, stripWidth);
};

const weldFirstColumn = async (input, previousLayer) => {
  const clear = await sharp({
    create: { width: 1, height, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } },
  }).png().toBuffer();
  const previousEdge = await sharp(path.join(assetRoot, `s05-underground/layers/${previousLayer}`))
    .ensureAlpha()
    .extract({ left: width - 1, top: 0, width: 1, height })
    .png()
    .toBuffer();
  return sharp(input).composite([
    { input: clear, left: 0, top: 0, blend: "dest-out" },
    { input: previousEdge, left: 0, top: 0 },
  ]).png().toBuffer();
};

const backgroundBase = await sharp(path.join(sourceDir, "00-background-generated.png"))
  .resize(width, height, { fit: "fill", kernel: sharp.kernel.lanczos3 })
  .greyscale()
  .tint({ r: 177, g: 187, b: 189 })
  .modulate({ brightness: 1.02, saturation: 0.35 })
  .png()
  .toBuffer();
const background = await sharp(backgroundBase).composite([{
  input: await seamFromS05("00-background-cavern.png", 420), left: 0, top: 0,
}]).removeAlpha().png().toBuffer();
await sharp(background).toFile(path.join(layersDir, "00-background-cavern.png"));

const architectureGenerated = await sharp(path.join(sourceDir, "20-background-architecture-transparent.png"))
  .resize(width, height, { fit: "fill", kernel: sharp.kernel.lanczos3 })
  .greyscale()
  .extract({ left: 0, top: 250, width, height: 430 })
  .png()
  .toBuffer();
const architectureBase = await transparentCanvas().composite([{
  input: architectureGenerated, left: 0, top: 360,
}]).png().toBuffer();
const architectureSeamWidth = 420;
const architectureClear = await sharp({
  create: { width: architectureSeamWidth, height, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } },
}).png().toBuffer();
const architectureWithoutSeam = await sharp(architectureBase).composite([{
  input: architectureClear, left: 0, top: 0, blend: "dest-out",
}]).png().toBuffer();
const ownArchitectureStrip = await sharp(architectureBase)
  .extract({ left: 0, top: 0, width: architectureSeamWidth, height })
  .png()
  .toBuffer();
const architectureBlended = await sharp(architectureWithoutSeam).composite([
  { input: await makeFadeStrip(ownArchitectureStrip, architectureSeamWidth, "in"), left: 0, top: 0 },
  { input: await seamFromS05("20-background-architecture.png", architectureSeamWidth), left: 0, top: 0 },
]).png().toBuffer();
const architecture = await weldFirstColumn(architectureBlended, "20-background-architecture.png");
await sharp(architecture).toFile(path.join(layersDir, "20-background-architecture.png"));

const decorationSource = await sharp(path.join(sourceDir, "30-decoration-transparent.png"))
  .resize(width, height, { fit: "fill", kernel: sharp.kernel.lanczos3 })
  .greyscale()
  .png()
  .toBuffer();
const hanging = await sharp(decorationSource).extract({ left: 0, top: 0, width, height: 360 }).png().toBuffer();
const grounded = await sharp(decorationSource).extract({ left: 0, top: 650, width, height: 230 }).png().toBuffer();
const landingClear = await sharp({
  create: { width: 470, height: 190, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } },
}).png().toBuffer();
const decorationBase = await transparentCanvas().composite([
  { input: hanging, left: 0, top: 400 },
  // Generated ground props share a Y842 baseline; align them to the canonical Y780 floor.
  { input: grounded, left: 0, top: 588 },
  // C113 and C49, including the spaces below them, stay free of decorative obstruction.
  { input: landingClear, left: 990, top: 610, blend: "dest-out" },
]).png().toBuffer();
const decorationBlended = await sharp(decorationBase).composite([{
  input: await seamFromS05("30-decoration.png", 180), left: 0, top: 0,
}]).png().toBuffer();
const decoration = await weldFirstColumn(decorationBlended, "30-decoration.png");
await sharp(decoration).toFile(path.join(layersDir, "30-decoration.png"));

const effectsBase = await sharp(Buffer.from(`
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
  <defs><filter id="mist"><feGaussianBlur stdDeviation="25 8"/></filter><filter id="drop"><feGaussianBlur stdDeviation="1.1"/></filter></defs>
  <g fill="#dce4e4" opacity=".1" filter="url(#mist)">
    <ellipse cx="300" cy="770" rx="240" ry="18"/><ellipse cx="820" cy="766" rx="330" ry="22"/><ellipse cx="1390" cy="771" rx="260" ry="19"/>
  </g>
  <g fill="none" stroke="#789194" stroke-linecap="round" opacity=".48" filter="url(#drop)">
    <path d="M198 468q-5 72 0 148" stroke-width="2"/><path d="M548 468q5 54 0 118" stroke-width="2.5"/>
    <path d="M902 468q-4 78 0 154" stroke-width="2"/><path d="M1194 468q7 62 0 142" stroke-width="3"/>
    <path d="M1368 468q-6 88 0 170" stroke-width="3.5"/><path d="M1552 468q4 54 0 118" stroke-width="2"/>
  </g>
  <g fill="none" stroke="#6f898c" stroke-width="3" opacity=".43">
    <path d="M0 789q84-15 168 0t168 0t168 0t168 0t168 0t168 0t168 0t168 0t168 0t168 0"/>
    <path d="M110 805q65-10 130 0M480 807q80-12 160 0M850 804q75-10 150 0M1420 806q76-12 152 0"/>
  </g>
</svg>`)).png().toBuffer();
const effectsBlended = await sharp(effectsBase).composite([{
  input: await seamFromS05("40-effects.png", 240), left: 0, top: 0,
}]).png().toBuffer();
const effects = await weldFirstColumn(effectsBlended, "40-effects.png");
await sharp(effects).toFile(path.join(layersDir, "40-effects.png"));

const floorTexture = await sharp(path.join(assetRoot, "s05-underground/layers/50-foundation.png"))
  .extract({ left: 900, top: 780, width: 360, height: 161 })
  .resize(width, 161, { fit: "fill", kernel: sharp.kernel.lanczos3 })
  .png()
  .toBuffer();
const slabSvg = (slabWidth, slabHeight) => Buffer.from(`
<svg xmlns="http://www.w3.org/2000/svg" width="${slabWidth}" height="${slabHeight}">
  <rect x="1.5" y="2" width="${slabWidth - 3}" height="${slabHeight - 5}" rx="2" fill="#424744" stroke="#171b18" stroke-width="3"/>
  <path d="M2 ${Math.min(17, slabHeight - 4)}H${slabWidth - 2}" stroke="#9ba09d" stroke-width="2" opacity=".55"/>
  ${Array.from({ length: Math.ceil(slabWidth / 84) }, (_, index) => `<path d="M${42 + index * 84} 3l${index % 2 ? 5 : -4} ${Math.max(4, slabHeight - 8)}" stroke="#222724" stroke-width="2" opacity=".7"/>`).join("")}
</svg>`);
const roof = await sharp(slabSvg(width, 48)).png().toBuffer();
const bracketPlatform = async (platformWidth, timber = false) => sharp(Buffer.from(`
<svg xmlns="http://www.w3.org/2000/svg" width="${platformWidth}" height="72">
  <path d="M2 2H${platformWidth - 2}V18H2Z" fill="${timber ? "#343b38" : "#454a47"}" stroke="#171b18" stroke-width="3"/>
  <path d="M22 18h42L34 64H16ZM${platformWidth - 64} 18h42l6 46h-18Z" fill="${timber ? "#303633" : "#3b403d"}" stroke="#1f2421" stroke-width="3"/>
  <path d="M8 8H${platformWidth - 8}" fill="none" stroke="#9ba09d" stroke-width="2" opacity=".55"/>
</svg>`)).png().toBuffer();
const westPlatform = await bracketPlatform(180);
const eastPlatform = await bracketPlatform(180, true);
const collisionCaps = await sharp(Buffer.from(`
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
  <g fill="none" stroke="#171b18" stroke-linejoin="round">
    <path d="M0 420H1672M0 780H1672" stroke-width="5"/>
    <path d="M1040 650H1220M1230 690H1410" stroke-width="4"/>
  </g>
</svg>`)).png().toBuffer();
const foundationBase = await transparentCanvas().composite([
  { input: roof, left: 0, top: 420 },
  { input: floorTexture, left: 0, top: 780 },
  { input: westPlatform, left: 1040, top: 650 },
  { input: eastPlatform, left: 1230, top: 690 },
  { input: collisionCaps, left: 0, top: 0 },
]).png().toBuffer();
const foundationBlended = await sharp(foundationBase).composite([{
  input: await seamFromS05("50-foundation.png", 420), left: 0, top: 0,
}]).png().toBuffer();
const foundation = await weldFirstColumn(foundationBlended, "50-foundation.png");
await sharp(foundation).toFile(path.join(layersDir, "50-foundation.png"));

const composite = await sharp(background).composite([
  { input: architecture, blend: "over" },
  { input: decoration, blend: "over" },
  { input: effects, blend: "over" },
  { input: foundation, blend: "over" },
]).png().toBuffer();
await sharp(composite).toFile(path.join(assetRoot, "s06-underground-ink-layered-1672.png"));
await sharp(composite).resize(3840, 2160, { fit: "fill", kernel: sharp.kernel.lanczos3 }).png().toFile(path.join(assetRoot, "s06-underground-ink-layered-4k.png"));
await sharp({ create: { width: width * 2, height, channels: 3, background: { r: 186, g: 190, b: 191 } } })
  .composite([
    { input: path.join(assetRoot, "s05-underground-ink-layered-1672.png"), left: 0, top: 0 },
    { input: composite, left: width, top: 0 },
  ])
  .png()
  .toFile(path.join(root, "tmp", "s05-s06-underground-seam-preview.png"));

console.log("S06 underground five-layer art and S05-S06 seam preview exported.");
