import path from "node:path";
import { mkdir } from "node:fs/promises";
import sharp from "sharp";
import { ADDITIONAL_GATE_CONSTRUCTION, GATE_SHRINE_PLACEMENTS, type ConstructionBuildingSpec, type ConstructionColliderSpec } from "../app/map/gate/construction.ts";
import { GATE_SCREENS } from "../app/map/gate/screens.ts";

const root = process.cwd();
const outputDir = path.join(root, "public/assets/maps/gate/region-sketch");
const layersDir = path.join(outputDir, "layers");
const screensDir = path.join(outputDir, "screens");
const undergroundDir = path.join(outputDir, "underground");
const undergroundLayersDir = path.join(undergroundDir, "layers");
const undergroundScreensDir = path.join(undergroundDir, "screens");
const W = 1672;
const H = 941;
const TOTAL_W = W * 12;
const sharedShrinePath = path.join(root, "public/assets/maps/gate/shared/save-shrine-v1.png");
await Promise.all([layersDir, screensDir, undergroundLayersDir, undergroundScreensDir].map((directory) => mkdir(directory, { recursive: true })));

type SketchScreen = { screen: number; colliders: readonly ConstructionColliderSpec[]; buildings: readonly ConstructionBuildingSpec[] };
const floor = (id: string, name: string, x: number, y: number, w: number, requiresJump = false): ConstructionColliderSpec => ({ id, name, kind: "solid", x, y, w, h: H - y, note: "", requiresJump });
const building = (id: string, name: string, x0: number, y0: number, x1: number, y1: number, shape: ConstructionBuildingSpec["shape"]): ConstructionBuildingSpec => ({ id, name, x0, y0, x1, y1, shape, material: "" });

const firstScreens: SketchScreen[] = [
  { screen: 0, colliders: [
    floor("C01", "残院主地面", 0, 720, 1180), floor("C02", "东侧碎石缓坡", 1180, 700, 170), floor("C03", "破墙前台阶", 1350, 674, 190, true), floor("C04", "跨屏接驳地板", 1540, 674, 132),
    { id: "C06", name: "坍塌木梁", kind: "oneway", x: 500, y: 600, w: 230, h: 20, note: "" }, { id: "C07", name: "佛龛残台", kind: "oneway", x: 775, y: 542, w: 225, h: 20, note: "" }, { id: "C08", name: "东殿断檐", kind: "oneway", x: 1045, y: 478, w: 250, h: 20, note: "" },
  ], buildings: [
    building("A01", "破庙西墙", 86, 420, 396, 720, "shed"), building("A02", "漏雨正殿", 385, 350, 905, 720, "tower"), building("A03", "东侧偏殿", 930, 405, 1290, 720, "shed"), building("A04", "破墙出口", 1390, 455, 1570, 674, "gate"),
  ] },
  { screen: 1, colliders: [
    floor("C09", "S02接驳入口", 0, 674, 220), floor("C10", "村道主地面", 220, 674, 500), floor("C11", "一级抬升石阶", 720, 660, 180, true), floor("C12", "二级抬升石阶", 900, 646, 200, true), floor("C13", "村道高台", 1100, 632, 280, true), floor("C14", "跨屏接驳至S03", 1380, 632, 292),
    { id: "C15", name: "西民居屋檐", kind: "oneway", x: 260, y: 540, w: 250, h: 18, note: "" }, { id: "C16", name: "东民居错层檐", kind: "oneway", x: 820, y: 505, w: 270, h: 18, note: "" }, { id: "C17", name: "雨水木槽", kind: "oneway", x: 530, y: 590, w: 170, h: 16, note: "" },
  ], buildings: [
    building("A05", "西侧民居", 240, 430, 520, 674, "shed"), building("A06", "东侧错层民居", 780, 390, 1120, 646, "shed"), building("A07", "雨水木槽架", 500, 560, 720, 620, "bridge"), building("A08", "竹篱走廊", 600, 400, 980, 674, "corridor"), building("A09", "村缘石桥引道", 1380, 480, 1672, 632, "bridge"),
  ] },
];

const screens: SketchScreen[] = [...firstScreens, ...ADDITIONAL_GATE_CONSTRUCTION.map((screen) => ({ screen: screen.screen, colliders: screen.colliders, buildings: screen.buildings }))].sort((a, b) => a.screen - b.screen);
const svg = (body: string, opaque = false) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${TOTAL_W}" height="${H}" viewBox="0 0 ${TOTAL_W} ${H}">${opaque ? `<rect width="${TOTAL_W}" height="${H}" fill="#efe9dc"/>` : ""}${body}</svg>`);
const ridge = (base: number, amplitude: number, step: number, phase: number) => {
  const points: string[] = [];
  for (let x = 0; x <= TOTAL_W; x += step) {
    const y = base - Math.abs(Math.sin(x / 510 + phase)) * amplitude - Math.abs(Math.sin(x / 137 + phase * 1.7)) * amplitude * .42;
    points.push(`${x},${Math.round(y)}`);
  }
  return `M${points.join("L")}L${TOTAL_W},760L0,760Z`;
};

const backgroundParts = [
  `<defs><linearGradient id="paper" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#ece6d8"/><stop offset="1" stop-color="#f5efe3"/></linearGradient><filter id="soft"><feGaussianBlur stdDeviation="5"/></filter></defs>`,
  `<rect width="${TOTAL_W}" height="${H}" fill="url(#paper)"/>`,
  `<path d="${ridge(480, 150, 145, .2)}" fill="#8e9792" opacity=".16" filter="url(#soft)"/>`,
  `<path d="${ridge(550, 205, 126, 1.1)}" fill="#66736e" opacity=".18"/>`,
  `<path d="${ridge(610, 165, 112, 2.3)}" fill="#465550" opacity=".12"/>`,
];
for (let screen = 0; screen < 12; screen += 1) {
  const x = screen * W;
  const peaks = [230 + (screen % 3) * 80, 780 - (screen % 2) * 120, 1280 + (screen % 4) * 36];
  for (const [index, localX] of peaks.entries()) {
    const peakY = 150 + ((screen * 71 + index * 103) % 170);
    const half = 120 + ((screen + index) % 3) * 40;
    backgroundParts.push(`<path d="M${x + localX - half} 610Q${x + localX - half * .45} ${peakY + 130} ${x + localX} ${peakY}Q${x + localX + half * .42} ${peakY + 150} ${x + localX + half} 610Z" fill="#313f3b" opacity=".17"/>`);
    backgroundParts.push(`<path d="M${x + localX - 14} ${peakY + 45}L${x + localX - 25} ${peakY + 260}M${x + localX + 24} ${peakY + 110}L${x + localX + 8} ${peakY + 330}" fill="none" stroke="#26332f" stroke-width="10" opacity=".2" stroke-linecap="round"/>`);
  }
}
backgroundParts.push(`<rect y="650" width="${TOTAL_W}" height="291" fill="#f3ede1" opacity=".5"/>`);

const roof = (x0: number, y0: number, x1: number) => `M${x0 - 38} ${y0 + 12}Q${(x0 + x1) / 2} ${y0 - 92} ${x1 + 38} ${y0 + 12}Q${(x0 + x1) / 2} ${y0 - 42} ${x0 - 38} ${y0 + 12}`;
const architectureParts: string[] = [];
for (const screen of screens) {
  const ox = screen.screen * W;
  for (const part of screen.buildings) {
    if (part.route === "underground") continue;
    const x0 = ox + part.x0, x1 = ox + part.x1, width = x1 - x0, center = (x0 + x1) / 2;
    const body = `<rect x="${x0}" y="${part.y0}" width="${width}" height="${part.y1 - part.y0}" fill="#43433f" fill-opacity=".16" stroke="#252522" stroke-width="9"/>`;
    if (part.shape === "stairs" && part.steps?.length) {
      const profile = part.steps.map((step) => ({ x: ox + step.x, y: step.y }));
      const top = `M${profile[0].x} ${profile[0].y}${profile.slice(1).map((step) => `H${step.x}V${step.y}`).join("")}H${x1}`;
      architectureParts.push(`<path d="${top}V${part.y1}H${x0}Z" fill="#41413d" fill-opacity=".2" stroke="#262623" stroke-width="10" stroke-linejoin="round"/>`);
    } else if (part.shape === "slope") architectureParts.push(`<path d="M${x0} ${part.y1}L${x1} ${part.y0}V${part.y1}Z" fill="#41413d" fill-opacity=".2" stroke="#262623" stroke-width="10"/>`);
    else if (part.shape === "water") architectureParts.push(`<g fill="none" stroke="#596d6f" stroke-width="8" opacity=".55">${Array.from({ length: 4 }, (_, row) => `<path d="M${x0} ${part.y0 + 16 + row * 17}q55-16 110 0t110 0t110 0t110 0"/>`).join("")}</g>`);
    else {
      architectureParts.push(body);
      if (["shed", "gate", "pavilion", "tower"].includes(part.shape)) architectureParts.push(`<path d="${roof(x0, part.y0, x1)}" fill="#292a27" fill-opacity=".2" stroke="#20211f" stroke-width="12"/>`);
      if (part.shape === "corridor" || part.shape === "bridge") architectureParts.push(`<g stroke="#292a27" stroke-width="8" opacity=".72">${Array.from({ length: 6 }, (_, col) => `<line x1="${x0 + width * (col + 1) / 7}" y1="${part.y0}" x2="${x0 + width * (col + 1) / 7}" y2="${part.y1}"/>`).join("")}</g>`);
      if (part.shape === "arena") architectureParts.push(`<circle cx="${center}" cy="${part.y1 - 60}" r="42" fill="none" stroke="#292a27" stroke-width="10"/>`);
      if (part.shape === "tower") architectureParts.push(`<path d="M${x0 + 36} ${part.y0 + 105}H${x1 - 36}M${x0 + 58} ${part.y0 + 190}H${x1 - 58}" stroke="#292a27" stroke-width="9"/>`);
    }
  }
}

const bamboo = (x: number, y: number, scale = 1) => `<g fill="none" stroke="#26332d" stroke-linecap="round" opacity=".72"><path d="M${x} ${y}Q${x - 10 * scale} ${y - 150 * scale} ${x + 16 * scale} ${y - 310 * scale}" stroke-width="${13 * scale}"/><path d="M${x + 16 * scale} ${y - 220 * scale}l${95 * scale}-${55 * scale}M${x + 5 * scale} ${y - 160 * scale}l-${78 * scale}-${42 * scale}" stroke-width="${7 * scale}"/></g>`;
const flag = (x: number, y: number) => `<g stroke="#342521" stroke-width="8" fill="#743b32" fill-opacity=".52"><line x1="${x}" y1="${y}" x2="${x}" y2="${y + 235}"/><path d="M${x} ${y}q85 18 130 0v105q-70 25-130 0Z"/></g>`;
const decorationParts: string[] = [];
for (const screen of [1, 2, 3, 4]) { const ox = screen * W; decorationParts.push(bamboo(ox + 150, 690, .86), bamboo(ox + 520, 660, .7), bamboo(ox + 1490, 640, .76)); }
decorationParts.push(
  `<g transform="translate(${3 * W + 720} 570)" fill="none" stroke="#2b3331" stroke-linecap="round"><path d="M0 0H100" stroke-width="16"/><path d="M18-7l19 13l16-15l18 14l14-12" stroke-width="5"/><path d="M10-18q18-34 36-9M82-16q-16-30-28-6" stroke-width="4" opacity=".7"/><path d="M50 10v34m-13-18l13 18l13-18" stroke="#756284" stroke-width="5" stroke-dasharray="8 6" opacity=".72"/></g>`,
  `<g transform="translate(${4 * W + 210} 548)" fill="#373531" stroke="#24231f" stroke-width="8"><circle cx="0" cy="0" r="38"/><rect x="-48" y="34" width="96" height="78"/><circle cx="1180" cy="0" r="38"/><rect x="1132" y="34" width="96" height="78"/></g>`,
  `<g transform="translate(${5 * W + 820} 430)" stroke="#282622" stroke-width="9" fill="none"><path d="M-80 0H80M-55 0q10 150 55 170q45-20 55-170"/><circle cy="90" r="38"/></g>`,
  `<g transform="translate(${6 * W + 260} 560)" stroke="#2a2925" stroke-width="8"><path d="M0 0v-120m65 120v-150m65 150v-100"/><path d="M-30-120h210"/></g>`,
  flag(7 * W + 430, 55), flag(7 * W + 760, 40), flag(7 * W + 1120, 60),
  `<g transform="translate(${9 * W + 760} 590)" stroke="#405a5c" stroke-width="7" opacity=".7">${Array.from({ length: 8 }, (_, i) => `<path d="M${i * 55} 0q28-16 55 0"/>`).join("")}</g>`,
  `<g transform="translate(${10 * W + 850} 520)" stroke="#2b2925" stroke-width="10" fill="none"><circle r="70"/><circle r="24"/><path d="M0-70V-180M-70 0h-110M70 0h110"/></g>`,
  `<g transform="translate(${11 * W + 1280} 420)" stroke="#2c2924" stroke-width="8" fill="#8b4a3c" fill-opacity=".5"><path d="M0-90v90"/><rect x="-32" width="64" height="80" rx="14"/><path d="M-22 80l22 28l22-28"/></g>`,
);

const effectsParts: string[] = [];
for (let screen = 0; screen < 12; screen += 1) { const ox = screen * W; effectsParts.push(`<g stroke="#66787b" stroke-width="3" opacity=".16">${Array.from({ length: 20 }, (_, i) => `<line x1="${ox + 40 + i * 84}" y1="${100 + (i % 5) * 37}" x2="${ox - 15 + i * 84}" y2="${290 + (i % 5) * 37}"/>`).join("")}</g>`); }
const foundationParts: string[] = [];
for (const screen of screens) {
  const ox = screen.screen * W;
  for (const collider of screen.colliders) {
    if (collider.route === "underground") continue;
    const x = ox + collider.x;
    if (collider.kind === "solid") {
      const visualHeight = screen.screen >= 3 && screen.screen <= 5 ? H - collider.y : collider.h;
      if (collider.slopeEndY !== undefined) {
        foundationParts.push(`<path d="M${x} ${collider.y}L${x + collider.w} ${collider.slopeEndY}V${H}H${x}Z" fill="#1d211f" fill-opacity=".72"/><path d="M${x} ${collider.y}L${x + collider.w} ${collider.slopeEndY}" stroke="#111412" stroke-width="13"/>`);
      } else {
        foundationParts.push(`<rect x="${x}" y="${collider.y}" width="${collider.w}" height="${visualHeight}" fill="#1d211f" fill-opacity=".72"/><path d="M${x} ${collider.y}H${x + collider.w}" stroke="#111412" stroke-width="13"/>`);
      }
      if (visualHeight > 90) foundationParts.push(`<path d="M${x + 20} ${collider.y + 34}q${collider.w * .25} 25 ${collider.w * .5} 0t${collider.w * .5} 0" fill="none" stroke="#53605b" stroke-width="5" opacity=".45"/>`);
    } else if (collider.kind === "oneway") {
      foundationParts.push(`<path d="M${x} ${collider.y}H${x + collider.w}" stroke="#171b19" stroke-width="15"/><path d="M${x + 18} ${collider.y + 11}l18 30m45-30l14 42m52-42l18 28" stroke="#343d39" stroke-width="5"/>`);
      if (collider.id === "C31") foundationParts.push(`<rect x="${x}" y="${collider.y + collider.h}" width="${collider.w}" height="${H - collider.y - collider.h}" fill="#1d211f" fill-opacity=".72"/>`);
    }
    else foundationParts.push(`<path d="M${x} ${collider.y}V${collider.y + collider.h}" stroke="#4c332e" stroke-width="8" stroke-dasharray="20 13" opacity=".72"/>`);
  }
}

const renderLayer = async (name: string, parts: string[], opaque = false) => {
  const buffer = await sharp(svg(parts.join(""), opaque)).png().toBuffer();
  await sharp(buffer).toFile(path.join(layersDir, name));
  return buffer;
};
const background = await renderLayer("00-background.png", backgroundParts, true);
const architecture = await renderLayer("20-background-architecture.png", architectureParts);
const decorationBase = await renderLayer("30-decoration.png", decorationParts);
const surfaceShrines: Array<{ input: Buffer; left: number; top: number }> = [];
for (const shrine of GATE_SHRINE_PLACEMENTS.filter((item) => item.route === "surface")) {
  surfaceShrines.push({
    input: await sharp(sharedShrinePath)
      .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 }, threshold: 2 })
      .resize(shrine.w, shrine.h, { fit: "fill", kernel: sharp.kernel.lanczos3 })
      .png()
      .toBuffer(),
    left: shrine.screen * W + shrine.x,
    top: shrine.y,
  });
}
const decoration = await sharp(decorationBase).composite(surfaceShrines).png().toBuffer();
await sharp(decoration).toFile(path.join(layersDir, "30-decoration.png"));
const effects = await renderLayer("40-effects.png", effectsParts);
const foundation = await renderLayer("50-foundation.png", foundationParts);
const composite = await sharp(background).composite([{ input: architecture }, { input: decoration }, { input: effects }, { input: foundation }]).png().toBuffer();
await sharp(composite).toFile(path.join(outputDir, "s01-s12-concept-sketch.png"));
for (const [index, meta] of GATE_SCREENS.entries()) await sharp(composite).extract({ left: index * W, top: 0, width: W, height: H }).png().toFile(path.join(screensDir, `${meta.id}.png`));

const labels = svg(GATE_SCREENS.map((screen, index) => {
  const x = index * W;
  const extra = index === 7 ? " · 高地" : index >= 3 && index <= 5 ? " · 地下通道" : "";
  return `<g><rect x="${x + 18}" y="18" width="${W - 36}" height="88" fill="#efe9dc" fill-opacity=".88" stroke="#8b3028" stroke-width="4"/><text x="${x + 56}" y="76" font-family="serif" font-size="46" fill="#292622">S${screen.index} · ${screen.name}${extra}</text><line x1="${x}" y1="0" x2="${x}" y2="${H}" stroke="#8b3028" stroke-width="5" stroke-dasharray="24 18" opacity=".55"/></g>`;
}).join(""));
const labelled = await sharp(composite).composite([{ input: labels }]).png().toBuffer();
await sharp(labelled).resize(6020, 282, { fit: "fill" }).png().toFile(path.join(outputDir, "s01-s12-overview.png"));
const tileW = 1200, tileH = 675;
const sheetComposites: Array<{ input: Buffer; left: number; top: number }> = [];
for (const [index] of GATE_SCREENS.entries()) {
  const tile = await sharp(labelled).extract({ left: index * W, top: 0, width: W, height: H }).resize(tileW, tileH, { fit: "fill" }).png().toBuffer();
  sheetComposites.push({ input: tile, left: (index % 4) * tileW, top: Math.floor(index / 4) * tileH });
}
await sharp({ create: { width: tileW * 4, height: tileH * 3, channels: 3, background: { r: 239, g: 233, b: 220 } } }).composite(sheetComposites).png().toFile(path.join(outputDir, "s01-s12-contact-sheet.png"));

// S04-S07 hidden region is a separate one-screen-high art strip.  It is never
// baked into the surface images, so the surface camera cannot reveal it.
const undergroundScreens = screens.filter((screen) => screen.screen >= 3 && screen.screen <= 6);
const UNDERGROUND_W = W * undergroundScreens.length;
const undergroundSvg = (body: string, opaque = false) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${UNDERGROUND_W}" height="${H}" viewBox="0 0 ${UNDERGROUND_W} ${H}">${opaque ? `<rect width="${UNDERGROUND_W}" height="${H}" fill="#d9dddc"/>` : ""}${body}</svg>`);
const undergroundBackgroundParts = [
  `<defs><linearGradient id="cave-paper" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#cfd5d5"/><stop offset=".48" stop-color="#aeb9b9"/><stop offset="1" stop-color="#7f8c8d"/></linearGradient></defs>`,
  `<rect width="${UNDERGROUND_W}" height="${H}" fill="url(#cave-paper)"/>`,
  `<path d="M0 420Q180 350 360 420T720 420T1080 420T1440 420T1800 420T2160 420T2520 420T2880 420T3240 420T3600 420T3960 420T4320 420T${UNDERGROUND_W} 420V0H0Z" fill="#344143" opacity=".72"/>`,
];
const undergroundArchitectureParts: string[] = [];
const undergroundFoundationParts: string[] = [];
const undergroundDecorationParts: string[] = [];
const undergroundEffectsParts: string[] = [];
for (const screen of undergroundScreens) {
  const ox = (screen.screen - 3) * W;
  for (const part of screen.buildings.filter((item) => item.route === "underground")) {
    const x0 = ox + part.x0, x1 = ox + part.x1, partWidth = x1 - x0;
    undergroundArchitectureParts.push(`<rect x="${x0}" y="${part.y0}" width="${partWidth}" height="${part.y1 - part.y0}" fill="#596668" fill-opacity=".16" stroke="#263234" stroke-width="9"/>`);
    if (part.shape === "corridor" || part.shape === "bridge") undergroundArchitectureParts.push(`<g stroke="#334143" stroke-width="8" opacity=".72">${Array.from({ length: 7 }, (_, col) => `<line x1="${x0 + partWidth * (col + 1) / 8}" y1="${part.y0}" x2="${x0 + partWidth * (col + 1) / 8}" y2="${part.y1}"/>`).join("")}</g>`);
  }
  for (const collider of screen.colliders.filter((item) => item.route === "underground")) {
    const x = ox + collider.x;
    if (collider.kind === "solid") undergroundFoundationParts.push(`<rect x="${x}" y="${collider.y}" width="${collider.w}" height="${collider.h}" fill="#1e292a" fill-opacity=".82"/><path d="M${x} ${collider.y}H${x + collider.w}" stroke="#0e1718" stroke-width="13"/>`);
    else if (collider.kind === "oneway") undergroundFoundationParts.push(`<path d="M${x} ${collider.y}H${x + collider.w}" stroke="#172324" stroke-width="15"/>`);
  }
  undergroundDecorationParts.push(`<g transform="translate(${ox + 180} 720)" stroke="#324547" stroke-width="7" opacity=".7"><path d="M0 0q30-100 62-170M35 0q48-72 94-118M${W - 330} 0q-18-120-70-190"/></g>`);
  if (screen.screen === 3) undergroundDecorationParts.push(`<g transform="translate(${ox + 720} 250)" fill="#202b2d" fill-opacity=".58" stroke="#303d3f" stroke-width="9"><path d="M0 0H140V530H0Z"/><path d="M14 0v500m112-500v500"/><path d="M70 80v380" stroke="#87719a" stroke-dasharray="20 14" opacity=".72"/><path d="M54 440l16 20l16-20" fill="none" stroke="#b39ac6"/></g>`);
  if (screen.screen === 6) undergroundDecorationParts.push(`<g transform="translate(${ox + 100} 420)" fill="none" stroke="#202a2b" stroke-linecap="round"><path d="M18 350V35M122 350V35" stroke-width="13"/>${Array.from({ length: 10 }, (_, rung) => `<path d="M20 ${330 - rung * 29}H120" stroke-width="8"/>`).join("")}<path d="M0 170H140" stroke="#7a8e8f" stroke-width="9"/><path d="M0 0H140" stroke="#a4b2b1" stroke-width="13"/></g><g transform="translate(${ox + 330} 730)" stroke="#607778" fill="none" opacity=".8"><circle r="28" stroke-width="7"/><path d="M0-28V-70M-28 0H-65M28 0H65" stroke-width="6"/></g>`);
  undergroundEffectsParts.push(`<g stroke="#718f92" fill="none" stroke-width="7" opacity=".5">${Array.from({ length: 5 }, (_, row) => `<path d="M${ox} ${815 + row * 18}q110-20 220 0t220 0t220 0t220 0t220 0t220 0t220 0"/>`).join("")}</g>`);
}
const renderUndergroundLayer = async (name: string, parts: string[], opaque = false) => {
  const buffer = await sharp(undergroundSvg(parts.join(""), opaque)).png().toBuffer();
  await sharp(buffer).toFile(path.join(undergroundLayersDir, name));
  return buffer;
};
const undergroundBackground = await renderUndergroundLayer("00-background.png", undergroundBackgroundParts, true);
const undergroundArchitecture = await renderUndergroundLayer("20-background-architecture.png", undergroundArchitectureParts);
const undergroundDecorationBase = await renderUndergroundLayer("30-decoration.png", undergroundDecorationParts);
const undergroundShrines: Array<{ input: Buffer; left: number; top: number }> = [];
for (const shrine of GATE_SHRINE_PLACEMENTS.filter((item) => item.route === "underground")) {
  undergroundShrines.push({
    input: await sharp(sharedShrinePath)
      .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 }, threshold: 2 })
      .resize(shrine.w, shrine.h, { fit: "fill", kernel: sharp.kernel.lanczos3 })
      .png()
      .toBuffer(),
    left: (shrine.screen - 3) * W + shrine.x,
    top: shrine.y,
  });
}
const undergroundDecoration = await sharp(undergroundDecorationBase).composite(undergroundShrines).png().toBuffer();
await sharp(undergroundDecoration).toFile(path.join(undergroundLayersDir, "30-decoration.png"));
const undergroundEffects = await renderUndergroundLayer("40-effects.png", undergroundEffectsParts);
const undergroundFoundation = await renderUndergroundLayer("50-foundation.png", undergroundFoundationParts);
const undergroundComposite = await sharp(undergroundBackground).composite([
  { input: undergroundArchitecture }, { input: undergroundDecoration }, { input: undergroundEffects }, { input: undergroundFoundation },
]).png().toBuffer();
await sharp(undergroundComposite).toFile(path.join(undergroundDir, "s04-s07-hidden-region.png"));
for (const [index, screen] of undergroundScreens.entries()) {
  await sharp(undergroundComposite).extract({ left: index * W, top: 0, width: W, height: H }).png().toFile(path.join(undergroundScreensDir, `${GATE_SCREENS[screen.screen].id}.png`));
}

console.log(`Gate region sketch exported: surface ${TOTAL_W}x${H}; hidden S04-S07 ${UNDERGROUND_W}x${H}; both use 5 separate layers.`);
