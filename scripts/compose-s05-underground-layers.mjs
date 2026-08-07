import path from "node:path";
import sharp from "sharp";

const root = process.cwd();
const assetRoot = path.join(root, "public/assets/maps/gate");
const sceneDir = path.join(assetRoot, "s05-underground");
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

const backgroundBase = await sharp(path.join(sourceDir, "00-background-generated.png"))
  .resize(width, height, { fit: "fill", kernel: sharp.kernel.lanczos3 })
  .greyscale()
  .tint({ r: 180, g: 189, b: 191 })
  .modulate({ brightness: 1.03, saturation: 0.4 })
  .png()
  .toBuffer();
const seamWidth = 420;
const s04BackgroundStrip = await sharp(path.join(assetRoot, "s04-underground/layers/00-background-cavern.png"))
  .extract({ left: width - seamWidth, top: 0, width: seamWidth, height })
  .flop()
  .png()
  .toBuffer();
const background = await sharp(backgroundBase).composite([{
  input: await makeFadeStrip(s04BackgroundStrip, seamWidth), left: 0, top: 0,
}]).removeAlpha().png().toBuffer();
await sharp(background).toFile(path.join(layersDir, "00-background-cavern.png"));

const architectureGenerated = await sharp(path.join(sourceDir, "20-background-architecture-transparent.png"))
  .resize(width, height, { fit: "fill", kernel: sharp.kernel.lanczos3 })
  .greyscale()
  .extract({ left: 0, top: 250, width, height: 420 })
  .png()
  .toBuffer();
const architectureBase = await transparentCanvas().composite([{
  input: architectureGenerated, left: 0, top: 370,
}]).png().toBuffer();
const architectureSeamWidth = 420;
const s04ArchitectureStrip = await sharp(path.join(assetRoot, "s04-underground/layers/20-background-architecture.png"))
  .extract({ left: width - architectureSeamWidth, top: 0, width: architectureSeamWidth, height })
  .flop()
  .png()
  .toBuffer();
const s05ArchitectureStrip = await sharp(architectureBase)
  .extract({ left: 0, top: 0, width: architectureSeamWidth, height })
  .png()
  .toBuffer();
const architectureClearMask = await sharp({
  create: { width: architectureSeamWidth, height, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } },
}).png().toBuffer();
const architectureWithoutSeam = await sharp(architectureBase).composite([{
  input: architectureClearMask, left: 0, top: 0, blend: "dest-out",
}]).png().toBuffer();
const architecture = await sharp(architectureWithoutSeam).composite([
  { input: await makeFadeStrip(s05ArchitectureStrip, architectureSeamWidth, "in"), left: 0, top: 0 },
  { input: await makeFadeStrip(s04ArchitectureStrip, architectureSeamWidth), left: 0, top: 0 },
]).png().toBuffer();
await sharp(architecture).toFile(path.join(layersDir, "20-background-architecture.png"));

const decorationSource = await sharp(path.join(sourceDir, "30-decoration-transparent.png"))
  .resize(width, height, { fit: "fill", kernel: sharp.kernel.lanczos3 })
  .greyscale()
  .png()
  .toBuffer();
const hanging = await sharp(decorationSource).extract({ left: 0, top: 0, width, height: 330 }).png().toBuffer();
const wallDetails = await sharp(decorationSource)
  .extract({ left: 0, top: 350, width, height: 270 })
  .modulate({ brightness: 0.62, saturation: 0.3 })
  .png()
  .toBuffer();
const grounded = await sharp(decorationSource).extract({ left: 0, top: 620, width, height: 230 }).png().toBuffer();
const clearLeftSeam = await sharp({
  create: { width: 180, height: 260, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } },
}).png().toBuffer();
const clearEastPlatform = await sharp({
  create: { width: 270, height: 180, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } },
}).png().toBuffer();
const decorationBase = await transparentCanvas().composite([
  { input: hanging, left: 0, top: 405 },
  { input: wallDetails, left: 0, top: 350 },
  // Generated props use a Y825 baseline. Lift them to the canonical Y780 floor.
  { input: grounded, left: 0, top: 575 },
  { input: clearLeftSeam, left: 0, top: 681, blend: "dest-out" },
  // Keep C111's landing and the space below it visually clean.
  { input: clearEastPlatform, left: 965, top: 610, blend: "dest-out" },
]).png().toBuffer();
const decorationSeamWidth = 180;
const s04DecorationStrip = await sharp(path.join(assetRoot, "s04-underground/layers/30-decoration.png"))
  .extract({ left: width - decorationSeamWidth, top: 0, width: decorationSeamWidth, height })
  .flop()
  .png()
  .toBuffer();
const decoration = await sharp(decorationBase).composite([{
  input: await makeFadeStrip(s04DecorationStrip, decorationSeamWidth), left: 0, top: 0,
}]).png().toBuffer();
await sharp(decoration).toFile(path.join(layersDir, "30-decoration.png"));

const effectsBase = await sharp(Buffer.from(`
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
  <defs>
    <filter id="mist"><feGaussianBlur stdDeviation="25 8"/></filter>
    <filter id="drop"><feGaussianBlur stdDeviation="1.1"/></filter>
  </defs>
  <g fill="#dce4e4" opacity=".1" filter="url(#mist)">
    <ellipse cx="330" cy="770" rx="260" ry="18"/><ellipse cx="850" cy="765" rx="330" ry="22"/><ellipse cx="1390" cy="772" rx="250" ry="18"/>
  </g>
  <g fill="none" stroke="#789194" stroke-linecap="round" opacity=".45" filter="url(#drop)">
    <path d="M164 468q-5 68 0 148" stroke-width="2"/><path d="M412 468q6 48 0 105" stroke-width="2.5"/>
    <path d="M826 468q-4 82 0 156" stroke-width="2"/><path d="M1262 468q5 58 0 128" stroke-width="2.5"/><path d="M1548 468q-5 65 0 116" stroke-width="2"/>
  </g>
  <g fill="none" stroke="#6f898c" stroke-width="3" opacity=".42">
    <path d="M0 789q84-15 168 0t168 0t168 0t168 0t168 0t168 0t168 0t168 0t168 0t168 0"/>
    <path d="M90 804q70-10 140 0M520 807q85-12 170 0M1080 804q75-10 150 0M1430 808q70-12 140 0"/>
  </g>
</svg>`)).png().toBuffer();
const effectsSeamWidth = 240;
const s04EffectsStrip = await sharp(path.join(assetRoot, "s04-underground/layers/40-effects.png"))
  .extract({ left: width - effectsSeamWidth, top: 0, width: effectsSeamWidth, height })
  .flop()
  .png()
  .toBuffer();
const effects = await sharp(effectsBase).composite([{
  input: await makeFadeStrip(s04EffectsStrip, effectsSeamWidth), left: 0, top: 0,
}]).png().toBuffer();
await sharp(effects).toFile(path.join(layersDir, "40-effects.png"));

const floorTexture = await sharp(path.join(assetRoot, "s04-underground/layers/50-foundation.png"))
  // Sample within one continuous S04 foundation segment; avoid its segment
  // boundaries so horizontal scaling cannot magnify a pale weld line.
  .extract({ left: 960, top: 780, width: 360, height: 161 })
  .png()
  .toBuffer();
const continuousFloor = await sharp(floorTexture)
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
const bracketPlatform = async (platformWidth) => sharp(Buffer.from(`
<svg xmlns="http://www.w3.org/2000/svg" width="${platformWidth}" height="72">
  <path d="M2 2H${platformWidth - 2}V18H2Z" fill="#454a47" stroke="#171b18" stroke-width="3"/>
  <path d="M22 18h42L34 64H16ZM${platformWidth - 64} 18h42l6 46h-18Z" fill="#3b403d" stroke="#1f2421" stroke-width="3"/>
  <path d="M8 8H${platformWidth - 8}" fill="none" stroke="#9ba09d" stroke-width="2" opacity=".55"/>
</svg>`)).png().toBuffer();
const westPlatform = await bracketPlatform(260);
const eastPlatform = await bracketPlatform(240);
const collisionCaps = await sharp(Buffer.from(`
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
  <g fill="none" stroke="#171b18" stroke-linejoin="round">
    <path d="M0 420H1672M0 780H1672" stroke-width="5"/>
    <path d="M470 650H730M980 620H1220" stroke-width="4"/>
  </g>
</svg>`)).png().toBuffer();
const foundationBase = await transparentCanvas().composite([
  { input: roof, left: 0, top: 420 },
  { input: continuousFloor, left: 0, top: 780 },
  { input: westPlatform, left: 470, top: 650 },
  { input: eastPlatform, left: 980, top: 620 },
  { input: collisionCaps, left: 0, top: 0 },
]).png().toBuffer();
const foundationSeamWidth = 420;
const s04FoundationStrip = await sharp(path.join(assetRoot, "s04-underground/layers/50-foundation.png"))
  .extract({ left: width - foundationSeamWidth, top: 0, width: foundationSeamWidth, height })
  .flop()
  .png()
  .toBuffer();
const foundation = await sharp(foundationBase).composite([{
  input: await makeFadeStrip(s04FoundationStrip, foundationSeamWidth), left: 0, top: 0,
}]).png().toBuffer();
await sharp(foundation).toFile(path.join(layersDir, "50-foundation.png"));

const composite = await sharp(background).composite([
  { input: architecture, blend: "over" },
  { input: decoration, blend: "over" },
  { input: effects, blend: "over" },
  { input: foundation, blend: "over" },
]).png().toBuffer();
await sharp(composite).toFile(path.join(assetRoot, "s05-underground-ink-layered-1672.png"));
await sharp(composite).resize(3840, 2160, { fit: "fill", kernel: sharp.kernel.lanczos3 }).png().toFile(path.join(assetRoot, "s05-underground-ink-layered-4k.png"));
await sharp({ create: { width: width * 2, height, channels: 3, background: { r: 186, g: 190, b: 191 } } })
  .composite([
    { input: path.join(assetRoot, "s04-underground-ink-layered-1672.png"), left: 0, top: 0 },
    { input: composite, left: width, top: 0 },
  ])
  .png()
  .toFile(path.join(root, "tmp", "s04-s05-underground-seam-preview.png"));

console.log("S05 underground five-layer art and S04-S05 seam preview exported.");
