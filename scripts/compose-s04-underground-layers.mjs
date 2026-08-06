import path from "node:path";
import sharp from "sharp";

const root = process.cwd();
const assetRoot = path.join(root, "public/assets/maps/gate");
const sceneDir = path.join(assetRoot, "s04-underground");
const sourceDir = path.join(sceneDir, "source");
const layersDir = path.join(sceneDir, "layers");
const transitionDir = path.join(assetRoot, "s04/transition");
const width = 1672;
const height = 941;

const transparentCanvas = () => sharp({
  create: { width, height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
});

const background = await sharp(path.join(sourceDir, "00-background-generated.png"))
  .resize(width, height, { fit: "fill", kernel: sharp.kernel.lanczos3 })
  .greyscale()
  .tint({ r: 181, g: 190, b: 192 })
  .modulate({ brightness: 1.04, saturation: 0.42 })
  .png()
  .toBuffer();
await sharp(background).toFile(path.join(layersDir, "00-background-cavern.png"));

// The generated architecture contains the right visual language, but its
// opening is not pixel-exact. Rebuild it as two pieces around H01's canonical
// x=720..860 shaft and shift the masonry baseline to the Y780 floor.
const architectureSource = await sharp(path.join(sourceDir, "20-background-architecture-transparent.png"))
  .resize(width, height, { fit: "fill", kernel: sharp.kernel.lanczos3 })
  .greyscale()
  .png()
  .toBuffer();
const leftPier = await sharp(architectureSource)
  .extract({ left: 414, top: 350, width: 172, height: 391 })
  .resize(100, 391, { fit: "fill", kernel: sharp.kernel.lanczos3 })
  .png()
  .toBuffer();
const rightGallery = await sharp(architectureSource)
  .extract({ left: 724, top: 350, width: 948, height: 391 })
  .resize(812, 391, { fit: "fill", kernel: sharp.kernel.lanczos3 })
  .png()
  .toBuffer();
const architecture = await transparentCanvas().composite([
  { input: leftPier, left: 620, top: 400 },
  { input: rightGallery, left: 860, top: 400 },
]).png().toBuffer();
await sharp(architecture).toFile(path.join(layersDir, "20-background-architecture.png"));

const decorationSource = await sharp(path.join(sourceDir, "30-decoration-transparent.png"))
  .resize(width, height, { fit: "fill", kernel: sharp.kernel.lanczos3 })
  .greyscale()
  .png()
  .toBuffer();
const hangingDecoration = await sharp(decorationSource)
  .extract({ left: 0, top: 0, width, height: 575 })
  .png()
  .toBuffer();
const groundedDecoration = await sharp(decorationSource)
  .extract({ left: 620, top: 575, width: width - 620, height: 185 })
  .png()
  .toBuffer();
const landingClearMask = await sharp({
  create: { width: 180, height: 210, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } },
}).png().toBuffer();
const decoration = await transparentCanvas().composite([
  { input: hangingDecoration, left: 0, top: 0 },
  { input: groundedDecoration, left: 620, top: 665 },
  // H01's 140px channel plus 20px safety on both sides must remain empty.
  { input: landingClearMask, left: 700, top: 570, blend: "dest-out" },
]).png().toBuffer();
await sharp(decoration).toFile(path.join(layersDir, "30-decoration.png"));

const effects = await sharp(Buffer.from(`
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
  <defs>
    <filter id="mist"><feGaussianBlur stdDeviation="24 8"/></filter>
    <filter id="drop"><feGaussianBlur stdDeviation="1.2"/></filter>
  </defs>
  <g fill="#dce4e4" opacity=".12" filter="url(#mist)">
    <ellipse cx="840" cy="770" rx="260" ry="18"/><ellipse cx="1320" cy="780" rx="330" ry="20"/>
  </g>
  <g fill="none" stroke="#779194" stroke-linecap="round" opacity=".42" filter="url(#drop)">
    <path d="M684 455q-4 72 0 144" stroke-width="3"/><path d="M910 456q5 54 0 112" stroke-width="2"/>
    <path d="M1280 463q-6 48 0 94" stroke-width="2.5"/><path d="M1530 458q5 74 0 126" stroke-width="2"/>
  </g>
  <g fill="none" stroke="#6e898c" stroke-width="3" opacity=".36">
    <path d="M650 798q90-16 180 0t180 0t180 0t180 0t180 0"/>
    <path d="M720 811q65-10 130 0M1050 808q75-12 150 0M1390 812q70-10 140 0"/>
  </g>
  <g fill="#d9dfdf" opacity=".18" filter="url(#mist)"><ellipse cx="790" cy="760" rx="78" ry="26"/></g>
</svg>`)).png().toBuffer();
await sharp(effects).toFile(path.join(layersDir, "40-effects.png"));

const surfaceFoundationPath = path.join(assetRoot, "s04/layers/50-foundation.png");
const floorTexture = await sharp(surfaceFoundationPath)
  .extract({ left: 0, top: 570, width: 420, height: 371 })
  .png()
  .toBuffer();
const floorTile = await sharp(floorTexture).resize(420, 161, { fit: "fill" }).png().toBuffer();
const continuousFloor = await sharp({
  create: { width: 1052, height: 161, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
}).composite([{ input: floorTile, tile: true }]).png().toBuffer();
const slabSvg = (slabWidth, slabHeight) => Buffer.from(`
<svg xmlns="http://www.w3.org/2000/svg" width="${slabWidth}" height="${slabHeight}">
  <rect x="1.5" y="2" width="${slabWidth - 3}" height="${slabHeight - 5}" rx="2" fill="#424744" stroke="#171b18" stroke-width="3"/>
  <path d="M2 ${Math.min(17, slabHeight - 4)}H${slabWidth - 2}" stroke="#9ba09d" stroke-width="2" opacity=".55"/>
  ${Array.from({ length: Math.ceil(slabWidth / 84) }, (_, index) => {
    const x = 42 + index * 84;
    return `<path d="M${x} 3l${index % 2 ? 5 : -4} ${Math.max(4, slabHeight - 8)}" stroke="#222724" stroke-width="2" opacity=".7"/>`;
  }).join("")}
  <path d="M18 ${slabHeight - 10}l18-8 15 7M${Math.max(16, slabWidth - 96)} 8l17 10 22-8" fill="none" stroke="#242925" stroke-width="2" opacity=".75"/>
</svg>`);
const roofLeft = await sharp(slabSvg(100, 48)).png().toBuffer();
const roofRight = await sharp(slabSvg(812, 48)).png().toBuffer();
const shrinePlatform = await sharp(Buffer.from(`
<svg xmlns="http://www.w3.org/2000/svg" width="260" height="72">
  <path d="M2 2H258V18H2Z" fill="#454a47" stroke="#171b18" stroke-width="3"/>
  <path d="M22 18h42L34 64H16ZM196 18h42l6 46h-18Z" fill="#3b403d" stroke="#1f2421" stroke-width="3"/>
  <path d="M8 8H252M46 3l6 15M112 3l-4 15M184 3l5 15" fill="none" stroke="#9ba09d" stroke-width="2" opacity=".55"/>
  <path d="M25 27l24 8M214 28l18 9" fill="none" stroke="#79807c" stroke-width="2" opacity=".55"/>
</svg>`)).png().toBuffer();
const collisionCaps = await sharp(Buffer.from(`
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
  <g fill="none" stroke="#171b18" stroke-linejoin="round">
    <path d="M620 780H1672" stroke-width="5"/>
    <path d="M620 420H720M860 420H1672" stroke-width="5"/>
    <path d="M1210 650H1470" stroke-width="4"/>
  </g>
</svg>`)).png().toBuffer();
const foundation = await transparentCanvas().composite([
  { input: continuousFloor, left: 620, top: 780 },
  { input: roofLeft, left: 620, top: 420 },
  { input: roofRight, left: 860, top: 420 },
  { input: shrinePlatform, left: 1210, top: 650 },
  { input: collisionCaps, left: 0, top: 0 },
]).png().toBuffer();
await sharp(foundation).toFile(path.join(layersDir, "50-foundation.png"));

const composite = await sharp(background).composite([
  { input: architecture, blend: "over" },
  { input: decoration, blend: "over" },
  { input: effects, blend: "over" },
  { input: foundation, blend: "over" },
]).png().toBuffer();
await sharp(composite).toFile(path.join(assetRoot, "s04-underground-ink-layered-1672.png"));
await sharp(composite)
  .resize(3840, 2160, { fit: "fill", kernel: sharp.kernel.lanczos3 })
  .png()
  .toFile(path.join(assetRoot, "s04-underground-ink-layered-4k.png"));

// Static scene effects remain in Layer 4. The H01 opening is a separate
// four-frame strip so gameplay can release collision at frame 3 (280ms)
// without baking an open hatch into the resting map.
const hatchFx = Buffer.from(`
<svg xmlns="http://www.w3.org/2000/svg" width="560" height="220" viewBox="0 0 560 220">
  <defs><filter id="dust"><feGaussianBlur stdDeviation="5"/></filter></defs>
  <g stroke="#202421" fill="#555b57" stroke-linejoin="round" stroke-linecap="round">
    <g transform="translate(0 18)"><path d="M4 8l64-5 68 5v20l-66 5-66-5Z" stroke-width="4"/><path d="M70 3v30" fill="none" stroke-width="3"/></g>
    <g transform="translate(140 18)"><path d="M4 8l64-5 68 5v20l-66 5-66-5Z" stroke-width="4"/><path d="M20 9l20 9 21-12 22 14 19-13 22 12M70 3v30" fill="none" stroke-width="3"/></g>
    <g transform="translate(280 18)"><path d="M8 7l58-4 2 20-57 24Z" stroke-width="4"/><path d="M74 3l60 5-4 38-58-23Z" stroke-width="4"/><path d="M37 48l9 70M108 47l-13 86" fill="none" stroke-width="5"/></g>
    <g transform="translate(420 18)"><path d="M27 78l32 16-13 61-28-22Z" stroke-width="4"/><path d="M108 73L77 94l16 62 25-29Z" stroke-width="4"/></g>
  </g>
  <g fill="#d4d9d7" opacity=".4" filter="url(#dust)">
    <ellipse cx="350" cy="92" rx="48" ry="18"/><ellipse cx="490" cy="124" rx="58" ry="22"/>
  </g>
  <g fill="none" stroke="#718b8d" opacity=".55" stroke-width="3">
    <path d="M331 42q12 42 0 86M382 42q-10 48 0 95M474 38q10 55 0 130M526 40q-8 62 0 140"/>
  </g>
</svg>`);
await sharp(hatchFx).png().toFile(path.join(transitionDir, "h01-opening-fx-strip.png"));

console.log("S04 underground five-layer art and H01 four-frame opening FX exported.");
