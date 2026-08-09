"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import { GATE_WALL_COLLISION } from "../../../gate-physics";
import { ADDITIONAL_GATE_CONSTRUCTION, GATE_HIDDEN_TRANSITIONS, GATE_RETURN_TRANSITIONS, GATE_SHRINE_PLACEMENTS, type ConstructionBuildingSpec } from "../construction";
import { GATE_SCREEN, GATE_SCREENS, GATE_SCREEN_NAMES } from "../screens";
import "./screen.css";

type CollisionKind = "solid" | "oneway" | "boundary";
type LayerId = "scene" | "architecture" | "collision" | "gameplay" | "camera";

type Collider = {
  id: string;
  name: string;
  kind: CollisionKind;
  /** World X on the continuous region canvas. */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Target-space top-right walkable Y for a continuous solid slope. */
  slopeEndY?: number;
  /** Entering this solid from the lower side requires an explicit jump. */
  requiresJump?: boolean;
  note: string;
  /** Zero-based screen index on the continuous canvas. */
  screen: number;
  route: "surface" | "underground";
  activation?: {
    initial: "disabled";
    enableOn: "boss-combat-start";
    disableOn: "boss-defeated";
    encounter: "s08-gate-boss" | "s11-gate-boss";
  };
};

type BuildingPart = {
  id: string;
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  material: string;
  screen: number;
  shape?: ConstructionBuildingSpec["shape"];
  /** True when one asset intentionally crosses a physical screen seam. */
  worldSpan?: true;
  route: "surface" | "underground";
};

type SeamLink = {
  id: string;
  x: number;
  fromCollider: string;
  toCollider: string;
  movement: "walk";
  bidirectional: true;
  camera: "continuous";
  route: "main" | "underground";
};

const SOURCE_STAGE = { w: 1672, h: 941 } as const;
const STAGE = GATE_SCREEN;
/** 12 continuous screens wide; 2 screen-heights for main path + lower optional loop. */
const REGION = { w: STAGE.w * GATE_SCREENS.length, h: STAGE.h * 2 } as const;
/** Finished ink passes currently cover S01–S04; later screens use the construction-derived region sketch. */
const ART_SCREEN_COUNT = GATE_SCREENS.length;
const ART_BOUNDS = { w: STAGE.w * ART_SCREEN_COUNT, h: STAGE.h } as const;
const ART_LAST_SCREEN = GATE_SCREENS[ART_SCREEN_COUNT - 1].index;
const SCALE = { x: STAGE.w / SOURCE_STAGE.w, y: STAGE.h / SOURCE_STAGE.h } as const;
const sx = (value: number) => Math.round(value * SCALE.x);
const sy = (value: number) => Math.round(value * SCALE.y);
const SOURCE_PLAYER = { w: 72, h: 96, jumpHeight: 170, runJump: 240, safeFall: 260 } as const;
const PLAYER = { w: sx(SOURCE_PLAYER.w), h: sy(SOURCE_PLAYER.h), jumpHeight: sy(SOURCE_PLAYER.jumpHeight), runJump: sx(SOURCE_PLAYER.runJump), safeFall: sy(SOURCE_PLAYER.safeFall) } as const;
/** Fallback presets; UI prefers viewport-fitted values from measureZoom(). */
const ZOOM = { region: 0.03, fit: 0.22, half: 0.5, actual: 1 } as const;
const REGION_SCREENS = GATE_SCREEN_NAMES;
/** Screens with full construction detail on this continuous canvas. */
const BUILT_SCREENS = new Set(GATE_SCREENS.map((screen) => screen.id));

/** Shared seam heights in SOURCE coordinates (must stay continuous across screens). */
const SEAM = {
  /** S01 exit / S02 entry walkable top. */
  s01ToS02: 674,
  /** S02 exit / S03 entry walkable top (gently risen for slope extensibility). */
  s02ToS03: 632,
} as const;

const SEAM_COLLIDER_PAIRS = [
  ["C04", "C09"], ["C14", "C19"], ["C23", "C26"], ["C29", "C34"], ["C38", "C42"], ["C46", "C50"],
  ["C54", "C58"], ["C63", "C67"], ["C71", "C76"], ["C80", "C85"], ["C90", "C95"],
] as const;

/** Physical welds between every pair of screen-sized construction sectors. */
const SEAM_LINKS: readonly SeamLink[] = SEAM_COLLIDER_PAIRS.map(([fromCollider, toCollider], index) => ({
  id: `J${String(index + 1).padStart(2, "0")}`,
  x: (index + 1) * STAGE.w,
  fromCollider,
  toCollider,
  movement: "walk",
  bidirectional: true,
  camera: "continuous",
  route: "main",
}));

const LOWER_SEAM_LINKS: readonly SeamLink[] = [
  { id: "U01", x: STAGE.w * 4, fromCollider: "C102", toCollider: "C103", movement: "walk", bidirectional: true, camera: "continuous", route: "underground" },
  { id: "U02", x: STAGE.w * 5, fromCollider: "C105", toCollider: "C106", movement: "walk", bidirectional: true, camera: "continuous", route: "underground" },
  { id: "U03", x: STAGE.w * 6, fromCollider: "C107", toCollider: "C116", movement: "walk", bidirectional: true, camera: "continuous", route: "underground" },
] as const;

const ALL_SEAM_LINKS: readonly SeamLink[] = [...SEAM_LINKS, ...LOWER_SEAM_LINKS];
const HIDDEN_ROUTE_LINKS = GATE_HIDDEN_TRANSITIONS;
const RETURN_ROUTE_LINKS = GATE_RETURN_TRANSITIONS;

const sourceCollider = (
  screen: number,
  id: string,
  name: string,
  kind: CollisionKind,
  x: number,
  y: number,
  w: number,
  h: number,
  note: string,
  route: "surface" | "underground" = "surface",
  activation?: Collider["activation"],
  slopeEndY?: number,
  requiresJump = false,
): Collider => ({
  id,
  name,
  kind,
  screen,
  x: sx(x) + screen * STAGE.w,
  y: sy(y),
  w: sx(x + w) - sx(x),
  h: sy(y + h) - sy(y),
  slopeEndY: slopeEndY === undefined ? undefined : sy(slopeEndY),
  requiresJump,
  note,
  route,
  activation,
});

const sourceBuilding = (
  screen: number,
  id: string,
  name: string,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  material: string,
  shape?: BuildingPart["shape"],
  route: "surface" | "underground" = "surface",
): BuildingPart => ({
  id,
  name,
  screen,
  x: sx(x0) + screen * STAGE.w,
  y: sy(y0),
  w: sx(x1) - sx(x0),
  h: sy(y1) - sy(y0),
  material,
  shape,
  route,
});

const COLLIDERS: Collider[] = [
  // —— S01 破庙残院 ——
  sourceCollider(0, "C01", "残院主地面", "solid", 0, 720, 1180, 221, "出生、神龛与基础移动的连续安全面"),
  sourceCollider(0, "C02", "东侧碎石缓坡", "solid", 1180, 700, 170, 241, "约46px高差，不触发落地硬直"),
  sourceCollider(0, "C03", "破墙前台阶", "solid", 1350, SEAM.s01ToS02, 190, 267, "约60px高差；进入破墙前台阶时必须跳跃", "surface", undefined, undefined, true),
  sourceCollider(0, "C04", "跨屏接驳地板", "solid", 1540, SEAM.s01ToS02, 132, 267, "与S02入口地板同高 Y=sy(674)，无缝拼接"),
  sourceCollider(0, "C05", "西侧封闭墙", "boundary", 0, 310, 46, 410, "出生屏不可向西离开"),
  sourceCollider(0, "C06", "坍塌木梁", "oneway", 500, 600, 230, 20, "距主地面约275px，原地跳可达"),
  sourceCollider(0, "C07", "佛龛残台", "oneway", 775, 542, 225, 20, "木梁继续上跳约133px"),
  sourceCollider(0, "C08", "东殿断檐", "oneway", 1045, 478, 250, 20, "残台继续上跳约147px；提供观察位"),

  // —— S02 竹雾村缘（本地源坐标 0–1672，世界 X = STAGE.w + sx(local)）——
  // Continuity: entry top == SEAM.s01ToS02; exit top == SEAM.s02ToS03 for S03 slope start.
  sourceCollider(1, "C09", "S02接驳入口", "solid", 0, SEAM.s01ToS02, 220, 267, "承接S01破墙出口；落脚面同高，禁止台阶缝"),
  sourceCollider(1, "C10", "村道主地面", "solid", 220, SEAM.s01ToS02, 500, 267, "民居前台活动区；低警戒刀客巡逻带"),
  sourceCollider(1, "C11", "一级抬升石阶", "solid", 720, 660, 180, 281, "向山门缓坡过渡的第一级；高差约32源px，进入时必须跳跃", "surface", undefined, undefined, true),
  sourceCollider(1, "C12", "二级抬升石阶", "solid", 900, 646, 200, 295, "错层民居落脚；高差约32源px，进入时必须跳跃", "surface", undefined, undefined, true),
  sourceCollider(1, "C13", "村道高台", "solid", 1100, SEAM.s02ToS03, 280, 309, "竹篱东段与雨蚀石涵引道；进入高台时必须跳跃", "surface", undefined, undefined, true),
  sourceCollider(1, "C14", "跨屏接驳至S03", "solid", 1380, SEAM.s02ToS03, 292, 309, "雨蚀石涵道跨越J02世界接缝；S03山门缓坡从同高程起坡"),
  sourceCollider(1, "C15", "西民居屋檐", "oneway", 260, 540, 250, 18, "可跳屋顶；与地面路线重叠，不挡主路"),
  sourceCollider(1, "C16", "东民居错层檐", "oneway", 820, 505, 270, 18, "高于西屋；观察竹雾与S03远坡"),
  sourceCollider(1, "C17", "雨水木槽", "oneway", 530, 590, 170, 16, "landmark；短跳可达，提供第二落脚"),
  ...ADDITIONAL_GATE_CONSTRUCTION.flatMap((screen) => screen.colliders.map((collider) => sourceCollider(
    screen.screen, collider.id, collider.name, collider.kind, collider.x, collider.y, collider.w, collider.h, collider.note, collider.route ?? "surface", collider.activation, collider.slopeEndY, collider.requiresJump,
  ))),
];

const BUILDING_PARTS: BuildingPart[] = [
  sourceBuilding(0, "A01", "破庙西墙", 86, 420, 396, 720, "雨蚀夯土 / 断裂木柱"),
  sourceBuilding(0, "A02", "漏雨正殿", 385, 350, 905, 720, "灰瓦 / 腐木梁 / 残佛背光"),
  sourceBuilding(0, "A03", "东侧偏殿", 930, 405, 1290, 720, "半塌屋檐 / 排水石槽"),
  sourceBuilding(0, "A04", "破墙出口", 1390, 455, 1570, SEAM.s01ToS02, "断墙 / 竹雾透景"),

  sourceBuilding(1, "A05", "西侧民居", 240, 430, 520, SEAM.s01ToS02, "错层木屋 / 可活动屋顶"),
  sourceBuilding(1, "A06", "东侧错层民居", 780, 390, 1120, 646, "抬高台基 / 灰瓦檐口"),
  sourceBuilding(1, "A07", "雨水木槽架", 500, 560, 720, 620, "竹节槽 / 滴水链"),
  sourceBuilding(1, "A08", "竹篱走廊", 600, 400, 980, SEAM.s01ToS02, "风折竹林后景 / 半透明遮挡"),
  {
    id: "A09",
    name: "J02雨蚀石墙背景建筑",
    screen: 1,
    x: STAGE.w * 2 - sx(620),
    y: sy(422),
    w: sx(760),
    h: sy(210),
    material: "第二层背景建筑 / 雨蚀青石 / 方形泄水孔 / 界碑；单一世界坐标资产",
    shape: "corridor",
    worldSpan: true,
    route: "surface",
  },
  ...ADDITIONAL_GATE_CONSTRUCTION.flatMap((screen) => screen.buildings.map((building) => sourceBuilding(
    screen.screen, building.id, building.name, building.x0, building.y0, building.x1, building.y1, building.material, building.shape, building.route ?? "surface",
  ))),
];

const screenRange = (screen: number) => ({
  x0: screen * STAGE.w,
  x1: (screen + 1) * STAGE.w,
});

const validateScreen = () => {
  if (REGION_SCREENS.length !== GATE_SCREENS.length) {
    throw new Error("施工图屏数与总图 GATE_SCREENS 不一致");
  }
  for (let index = 0; index < GATE_SCREENS.length; index += 1) {
    if (REGION_SCREENS[index] !== GATE_SCREENS[index].name) {
      throw new Error(`施工图 S${GATE_SCREENS[index].index} 名称「${REGION_SCREENS[index]}」与总图「${GATE_SCREENS[index].name}」不一致`);
    }
  }
  if (REGION.w !== STAGE.w * REGION_SCREENS.length) {
    throw new Error("一区连续画布宽度与十二个4K场景不一致");
  }
  for (const spec of ADDITIONAL_GATE_CONSTRUCTION) {
    const master = GATE_SCREENS[spec.screen];
    if (!master || master.id !== spec.id || master.name !== spec.name) {
      throw new Error(`施工数据 ${spec.id} 与场景总图名称/顺序不一致`);
    }
    const entry = COLLIDERS.find((collider) => collider.id === spec.entryCollider);
    const exit = COLLIDERS.find((collider) => collider.id === spec.exitCollider);
    const { x0, x1 } = screenRange(spec.screen);
    if (!entry || !exit || entry.x !== x0 || exit.x + exit.w !== x1) {
      throw new Error(`${spec.id} 入口或出口未贴齐3840px屏界`);
    }
    const entryTop = entry.y;
    const exitTop = exit.slopeEndY ?? exit.y;
    if (entryTop !== sy(spec.entryY) || exitTop !== sy(spec.exitY)) {
      throw new Error(`${spec.id} 入口或出口高程与施工规格不一致`);
    }
  }

  for (const collider of COLLIDERS) {
    const { x0, x1 } = screenRange(collider.screen);
    if (collider.x < x0 || collider.y < 0 || collider.x + collider.w > x1 || collider.y + collider.h > STAGE.h) {
      throw new Error(`${collider.id} 超出 S${String(collider.screen + 1).padStart(2, "0")} 画布`);
    }
    if (collider.requiresJump && (collider.kind !== "solid" || collider.slopeEndY !== undefined)) {
      throw new Error(`${collider.id} 的跳跃台阶必须是水平实体踏面，不能是单向板或连续斜坡`);
    }
  }
  const requiredJumpStairs = ["C03", "C11", "C12", "C13", "C37", "C44", "C51", "C52", "C53", "C53S"];
  const missingJumpStairs = requiredJumpStairs.filter((id) => !COLLIDERS.find((collider) => collider.id === id)?.requiresJump);
  if (missingJumpStairs.length > 0) {
    throw new Error(`施工台阶缺少必须跳跃标记：${missingJumpStairs.join(", ")}`);
  }

  for (const building of BUILDING_PARTS) {
    if (building.worldSpan) {
      if (building.x < 0 || building.y < 0 || building.x + building.w > REGION.w || building.y + building.h > STAGE.h) {
        throw new Error(`${building.id} 超出连续世界建筑画布`);
      }
      continue;
    }
    const { x0, x1 } = screenRange(building.screen);
    if (building.x < x0 || building.y < 0 || building.x + building.w > x1 || building.y + building.h > STAGE.h) {
      throw new Error(`${building.id} 超出 S${String(building.screen + 1).padStart(2, "0")} 建筑画布`);
    }
  }

  if (SEAM_LINKS.length !== GATE_SCREENS.length - 1) {
    throw new Error("连续施工图必须为十二屏建立十一条物理接缝");
  }
  for (const [index, seamLink] of SEAM_LINKS.entries()) {
    const left = COLLIDERS.find((collider) => collider.id === seamLink.fromCollider);
    const right = COLLIDERS.find((collider) => collider.id === seamLink.toCollider);
    if (!left || !right) throw new Error(`${seamLink.id} 缺少左右接驳碰撞体`);
    if (left.screen !== index || right.screen !== index + 1 || seamLink.x !== (index + 1) * STAGE.w) {
      throw new Error(`${seamLink.id} 屏幕归属或世界X错误`);
    }
    if (left.x + left.w !== seamLink.x || right.x !== seamLink.x) {
      throw new Error(`${seamLink.id} 顶面、底面或边界未焊接`);
    }
    const leftTop = left.slopeEndY ?? left.y;
    const rightTop = right.y;
    if (leftTop !== rightTop || left.y + left.h !== right.y + right.h) {
      throw new Error(`${seamLink.id} 顶面、底面或边界未焊接`);
    }
    if (seamLink.movement !== "walk" || !seamLink.bidirectional || seamLink.camera !== "continuous" || seamLink.route !== "main") {
      throw new Error(`${seamLink.id} 必须允许双向步行并保持摄影机连续`);
    }
  }

  if (LOWER_SEAM_LINKS.length !== 3) throw new Error("S04–S07 地下通道必须建立三条跨屏接缝");
  for (const seamLink of LOWER_SEAM_LINKS) {
    const left = COLLIDERS.find((collider) => collider.id === seamLink.fromCollider);
    const right = COLLIDERS.find((collider) => collider.id === seamLink.toCollider);
    if (!left || !right) throw new Error(`${seamLink.id} 缺少地下通道接驳碰撞体`);
    if (right.screen !== left.screen + 1 || left.x + left.w !== seamLink.x || right.x !== seamLink.x || left.y !== right.y || left.y + left.h !== right.y + right.h) {
      throw new Error(`${seamLink.id} 地下通道顶面、底面或世界X未焊接`);
    }
    if (seamLink.route !== "underground" || seamLink.movement !== "walk" || !seamLink.bidirectional || seamLink.camera !== "continuous") {
      throw new Error(`${seamLink.id} 必须是双向连续地下通道`);
    }
  }

  const expectedBossGateIds = new Set(["C65", "C66", "C93"]);
  const bossGates = COLLIDERS.filter((collider) => collider.activation);
  if (bossGates.length !== expectedBossGateIds.size || bossGates.some((collider) => !expectedBossGateIds.has(collider.id))) {
    throw new Error("Boss战动态封门必须且只能是 C65、C66、C93");
  }
  for (const gate of bossGates) {
    if (gate.kind !== "boundary" || gate.route !== "surface" || gate.activation?.initial !== "disabled" || gate.activation.enableOn !== "boss-combat-start" || gate.activation.disableOn !== "boss-defeated") {
      throw new Error(`${gate.id} 必须在Boss战前无碰撞、开战时启用、击杀后解除`);
    }
  }
  const unintendedPermanentWalls = COLLIDERS.filter((collider) => collider.kind === "boundary" && collider.route === "surface" && !collider.activation && collider.id !== "C05");
  if (unintendedPermanentWalls.length > 0) {
    throw new Error(`主路线存在未声明状态的永久边界墙：${unintendedPermanentWalls.map((collider) => collider.id).join(", ")}`);
  }

  for (let screen = 0; screen < GATE_SCREENS.length; screen += 1) {
    if (!COLLIDERS.some((collider) => collider.screen === screen) || !BUILDING_PARTS.some((building) => building.screen === screen)) {
      throw new Error(`S${String(screen + 1).padStart(2, "0")} 缺少完整碰撞或建筑施工数据`);
    }
  }
  if (new Set(COLLIDERS.map((collider) => collider.id)).size !== COLLIDERS.length || new Set(BUILDING_PARTS.map((building) => building.id)).size !== BUILDING_PARTS.length) {
    throw new Error("碰撞体或建筑施工编号重复");
  }

  const dropLeft = COLLIDERS.find((collider) => collider.id === "C27")!;
  const dropRight = COLLIDERS.find((collider) => collider.id === "C28")!;
  const lowerLanding = COLLIDERS.find((collider) => collider.id === "C32")!;
  const dropGap = dropRight.x - (dropLeft.x + dropLeft.w);
  const dropHeight = lowerLanding.y - Math.max(dropLeft.y, dropRight.y);
  if (dropGap <= PLAYER.w || dropGap > PLAYER.runJump * .65 || dropHeight > PLAYER.safeFall) {
    throw new Error("S04 地下落口必须可辨识、可跳过且落差安全");
  }

  const tunnelRoof = COLLIDERS.find((collider) => collider.id === "C109")!;
  const tunnelFloor = COLLIDERS.find((collider) => collider.id === "C104")!;
  const tunnelClearance = tunnelFloor.y - (tunnelRoof.y + tunnelRoof.h);
  if (tunnelClearance < PLAYER.h + PLAYER.jumpHeight + sy(20)) {
    throw new Error("S05 地下排水地域必须容纳角色完整起跳并保留顶部余量");
  }
  const undergroundStart = COLLIDERS.find((collider) => collider.id === "C32")!;
  const undergroundEnd = COLLIDERS.find((collider) => collider.id === "C116")!;
  const undergroundSpan = undergroundEnd.x + undergroundEnd.w - undergroundStart.x;
  if (undergroundSpan < STAGE.w * 2.8) throw new Error("S04–S07 隐藏地域横向探索范围不足");
  for (const link of HIDDEN_ROUTE_LINKS) {
    const surface = COLLIDERS.find((item) => item.id === link.surfaceCollider)!;
    const underground = COLLIDERS.find((item) => item.id === link.undergroundCollider)!;
    const worldX = link.screen * STAGE.w + sx(link.localX);
    if (surface.route !== "surface" || underground.route !== "underground" || worldX < surface.x || worldX > surface.x + surface.w || worldX < underground.x || worldX > underground.x + underground.w) {
      throw new Error(`${link.id} 地表暗板与地下安全落脚区未按同一世界X对齐`);
    }
    if (underground.y - surface.y > PLAYER.safeFall || link.movement !== "investigate-then-drop" || link.camera !== "layer-switch") {
      throw new Error(`${link.id} 必须是调查后开启、安全单向下落并切换地下摄影机`);
    }
    const scaledChannelWidth = sx(link.channelWidth);
    if (Math.abs(surface.w - scaledChannelWidth) > 2 || surface.w - PLAYER.w < sx(48) || link.collisionReleaseMs >= link.openingDurationMs) {
      throw new Error(`${link.id} 下落通道宽度、角色侧向余量或碰撞释放时序不安全`);
    }
  }

  const returnLink = RETURN_ROUTE_LINKS[0];
  const returnFloor = COLLIDERS.find((collider) => collider.id === returnLink.undergroundFloor)!;
  const returnStep = COLLIDERS.find((collider) => collider.id === returnLink.middlePlatform)!;
  const returnCap = COLLIDERS.find((collider) => collider.id === returnLink.surfaceCap)!;
  const respawn = ADDITIONAL_GATE_CONSTRUCTION.find((screen) => screen.id === "s07")!.encounters.find((encounter) => encounter.tone === "safe")!;
  if (returnFloor.route !== "underground" || returnStep.route !== "underground" || returnCap.kind !== "oneway" || returnLink.movement !== "climb-ladder" || returnLink.direction !== "underground-to-surface" || returnLink.camera !== "layer-switch" || returnLink.bidirectional) {
    throw new Error("S07 永久梯井必须由地下地板、中段踏板和可向上穿越的单向井盖组成");
  }
  if (returnStep.y >= returnFloor.y || returnCap.y >= returnStep.y || returnStep.y - returnCap.y > PLAYER.jumpHeight) {
    throw new Error("S07 永久梯井的垂直落差不可达");
  }
  if (Math.abs(sx(respawn.x) - (returnCap.x - STAGE.w * 6 + returnCap.w / 2)) > sx(260)) {
    throw new Error("S07 回程梯出口必须直接看见复活锚点");
  }

  const highlandFloor = COLLIDERS.find((collider) => collider.id === "C60")!;
  const normalFloor = COLLIDERS.find((collider) => collider.id === "C76")!;
  const highlandRise = normalFloor.y - highlandFloor.y;
  if (highlandRise <= PLAYER.safeFall) {
    throw new Error("S08 高地与常规地面的垂直差异不足");
  }
  const climbSteps = ["C50", "C121", "C120", "C51", "C52", "C53", "C53S", "C54"].map((id) => COLLIDERS.find((collider) => collider.id === id)!);
  const s07StepSurfaces = ["C51", "C52", "C53", "C53S"].map((id) => COLLIDERS.find((collider) => collider.id === id)!);
  const s07StepApproaches = ["C120", "C51", "C52", "C53"].map((id) => COLLIDERS.find((collider) => collider.id === id)!);
  const s07StepRises = s07StepSurfaces.map((step, index) => s07StepApproaches[index].y - step.y);
  if (s07StepSurfaces.some((step) => step.slopeEndY !== undefined) || s07StepRises.length !== 4 || s07StepRises.some((rise) => rise <= sy(36) || rise > PLAYER.jumpHeight)) {
    throw new Error("S07 必须是四级需要跳跃的水平踏面；不得使用连续斜坡或可自动跨上的低台阶");
  }
  if (climbSteps.some((step, index) => {
    if (index === 0) return false;
    const previous = climbSteps[index - 1];
    const previousEnd = previous.slopeEndY ?? previous.y;
    const horizontalGap = step.x - (previous.x + previous.w);
    const rise = previousEnd - step.y;
    return Math.abs(horizontalGap) > 1 || rise < 0 || rise > PLAYER.jumpHeight;
  })) {
    throw new Error("S07 登高石阶存在不可达高差");
  }
  const s07BlockingBoundaries = COLLIDERS.filter((collider) => collider.screen === 6 && collider.route === "surface" && collider.kind === "boundary" && collider.x < climbSteps.at(-1)!.x + climbSteps.at(-1)!.w && collider.x + collider.w > climbSteps[0].x);
  if (s07BlockingBoundaries.length > 0) {
    throw new Error(`S07 登高主路线被边界碰撞阻断：${s07BlockingBoundaries.map((collider) => collider.id).join(", ")}`);
  }
  const descentSteps = ["C67", "C68", "C68S", "C69", "C69S", "C70", "C70S", "C71"].map((id) => COLLIDERS.find((collider) => collider.id === id)!);
  if (descentSteps.some((step, index) => {
    if (index === 0) return false;
    const previous = descentSteps[index - 1];
    const previousEnd = previous.slopeEndY ?? previous.y;
    return Math.abs(previousEnd - step.y) > 1 || (step.slopeEndY ?? step.y) - previousEnd > PLAYER.safeFall;
  })) {
    throw new Error("S09 下山箭廊存在不安全落差");
  }
  if (descentSteps[0].slopeEndY !== descentSteps[1].y) {
    throw new Error("S09 入口斜面必须直接衔接第一段箭线地板，不得形成水平台阶");
  }

  return { colliders: COLLIDERS.length, buildings: BUILDING_PARTS.length, seams: SEAM_LINKS.length, lowerSeams: LOWER_SEAM_LINKS.length, bossGates: bossGates.length, hiddenEntrances: HIDDEN_ROUTE_LINKS.length, dropGap, tunnelClearance, undergroundSpan, highlandRise, built: [...BUILT_SCREENS] } as const;
};

const SCREEN_VALIDATION = validateScreen();
/** The construction view is also the runtime collision trace: this list is derived from the same flags consumed by gateSolidWallClamp(). */
const RUNTIME_JUMP_COLLIDERS = COLLIDERS.filter((item) => item.requiresJump);

export default function GateScreenS01() {
  const [zoom, setZoom] = useState(ZOOM.fit);
  const [zoomMode, setZoomMode] = useState<"region" | "seam" | "fit" | "half" | "actual" | "custom">("fit");
  const [focusScreen, setFocusScreen] = useState(0);
  const [focusSeam, setFocusSeam] = useState<string | null>(null);
  const [selectedCollider, setSelectedCollider] = useState("C01");
  const [layers, setLayers] = useState<Set<LayerId>>(new Set(["scene", "architecture", "collision", "gameplay", "camera"]));
  const [artPreview, setArtPreview] = useState(false);
  const [constructionPlane, setConstructionPlane] = useState<"surface" | "underground">("surface");
  /** Pure-art focus: full finished strip, or one of the screens that have ink art. */
  const [artFocus, setArtFocus] = useState<"all" | number>("all");
  const [cursor, setCursor] = useState({ x: 0, y: 0 });
  const viewportRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef({ active: false, x: 0, y: 0, left: 0, top: 0 });

  const collider = useMemo(() => COLLIDERS.find((item) => item.id === selectedCollider) ?? COLLIDERS[0], [selectedCollider]);
  const buildingsForDetail = useMemo(
    () => {
      const { x0, x1 } = screenRange(collider.screen);
      return BUILDING_PARTS.filter((part) => part.route === collider.route && (part.screen === collider.screen || (part.worldSpan && part.x < x1 && part.x + part.w > x0)));
    },
    [collider.screen, collider.route],
  );
  const constructionDetail = useMemo(
    () => ADDITIONAL_GATE_CONSTRUCTION.find((screen) => screen.screen === collider.screen),
    [collider.screen],
  );
  const hiddenTransitionDetail = useMemo(
    () => HIDDEN_ROUTE_LINKS.find((link) => link.surfaceCollider === collider.id || link.undergroundCollider === collider.id),
    [collider.id],
  );
  const visibleColliders = useMemo(() => COLLIDERS.filter((item) => item.route === constructionPlane), [constructionPlane]);
  const canvasBounds = artPreview ? ART_BOUNDS : { w: REGION.w, h: STAGE.h };
  const switchConstructionPlane = (plane: "surface" | "underground") => {
    setConstructionPlane(plane);
    setArtPreview(false);
    const targetScreen = plane === "underground" ? 3 : focusScreen;
    const target = COLLIDERS.find((item) => item.screen === targetScreen && item.route === plane);
    if (target) setSelectedCollider(target.id);
    requestAnimationFrame(() => focusBuiltScreen(targetScreen, "fit"));
  };
  const focusHiddenTransition = (plane: "surface" | "underground") => {
    const link = HIDDEN_ROUTE_LINKS[0];
    const targetId = plane === "surface" ? link.surfaceCollider : link.undergroundCollider;
    const target = COLLIDERS.find((item) => item.id === targetId)!;
    setConstructionPlane(plane);
    setArtPreview(false);
    setSelectedCollider(target.id);
    setFocusScreen(link.screen);
    setFocusSeam(null);
    requestAnimationFrame(() => setZoomCentered(measureZoom("fit", false), {
      x: link.screen * STAGE.w + sx(link.localX),
      y: target.y,
    }, "fit"));
  };
  const toggleLayer = (layer: LayerId) => setLayers((current) => {
    const next = new Set(current);
    if (next.has(layer)) next.delete(layer); else next.add(layer);
    return next;
  });

  /** Fit zooms from the real viewport so each screen keeps readable width. */
  const measureZoom = (mode: "region" | "fit", preview = artPreview, focus: "all" | number = artFocus) => {
    const viewport = viewportRef.current;
    if (!viewport) return mode === "region" ? ZOOM.region : ZOOM.fit;
    const pad = 24;
    const availW = Math.max(320, viewport.clientWidth - pad);
    const availH = Math.max(240, viewport.clientHeight - pad);
    if (preview) {
      if (mode === "region" || focus === "all") {
        return Math.min(1, Number(Math.min(availW / ART_BOUNDS.w, availH / ART_BOUNDS.h).toFixed(4)));
      }
      return Math.min(1, Number(Math.min(availW / STAGE.w, availH / STAGE.h).toFixed(4)));
    }
    if (mode === "region") {
      return Math.min(1, Number((availW / REGION.w).toFixed(4)));
    }
    return Math.min(1, Number(Math.min(availW / STAGE.w, availH / STAGE.h).toFixed(4)));
  };

  const focusArtView = (focus: "all" | number = artFocus) => {
    setArtFocus(focus);
    setFocusSeam(null);
    if (focus === "all") {
      setZoomCentered(measureZoom("region", true, "all"), { x: ART_BOUNDS.w / 2, y: ART_BOUNDS.h / 2 }, "region");
      return;
    }
    setFocusScreen(focus);
    setZoomCentered(measureZoom("fit", true, focus), { x: focus * STAGE.w + STAGE.w / 2, y: STAGE.h / 2 }, "fit");
  };

  const toggleArtPreview = () => {
    const next = !artPreview;
    setArtPreview(next);
    setFocusSeam(null);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (next) {
        setArtFocus("all");
        const centered = measureZoom("region", true, "all");
        setZoomMode("region");
        setZoom(centered);
        viewportRef.current?.scrollTo({ left: 0, top: 0 });
        return;
      }
      // Explicit preview=false: this closure still sees the pre-toggle artPreview value.
      const screen = Math.min(focusScreen, ART_SCREEN_COUNT - 1);
      setFocusScreen(screen);
      setZoomCentered(measureZoom("fit", false), { x: screen * STAGE.w + STAGE.w / 2, y: STAGE.h / 2 }, "fit");
    }));
  };

  const setZoomCentered = (next: number, focus?: { x: number; y: number }, mode: typeof zoomMode = "custom") => {
    const normalized = Math.max(0.008, Math.min(1, Number(next.toFixed(4))));
    const viewport = viewportRef.current;
    const centerX = focus?.x ?? (viewport ? (viewport.scrollLeft + viewport.clientWidth / 2) / zoom : STAGE.w * focusScreen + STAGE.w / 2);
    const centerY = focus?.y ?? (viewport ? (viewport.scrollTop + viewport.clientHeight / 2) / zoom : STAGE.h / 2);
    setZoomMode(mode);
    setZoom(normalized);
    requestAnimationFrame(() => viewport?.scrollTo({
      left: Math.max(0, centerX * normalized - viewport.clientWidth / 2),
      top: Math.max(0, centerY * normalized - viewport.clientHeight / 2),
    }));
  };

  const focusBuiltScreen = (screen: number, mode: "fit" | "half" | "actual" = "fit") => {
    setFocusScreen(screen);
    setFocusSeam(null);
    const center = { x: screen * STAGE.w + STAGE.w / 2, y: STAGE.h / 2 };
    if (mode === "fit") {
      setZoomCentered(measureZoom("fit"), center, "fit");
      return;
    }
    setZoomCentered(mode === "half" ? ZOOM.half : ZOOM.actual, center, mode);
  };

  const focusBuiltSeam = (link: SeamLink) => {
    const viewport = viewportRef.current;
    const pad = 24;
    const seamSpan = STAGE.w * 1.7;
    const next = viewport
      ? Math.min((viewport.clientWidth - pad) / seamSpan, (viewport.clientHeight - pad) / STAGE.h)
      : 0.11;
    setFocusSeam(link.id);
    const left = COLLIDERS.find((item) => item.id === link.fromCollider);
    setZoomCentered(next, { x: link.x, y: left ? Math.min(STAGE.h / 2, left.y) : STAGE.h / 2 }, "seam");
  };

  const applyPreset = (mode: "region" | "fit" | "half" | "actual") => {
    if (artPreview) {
      if (mode === "region" || (mode === "fit" && artFocus === "all")) {
        focusArtView("all");
        return;
      }
      if (mode === "fit") {
        focusArtView(artFocus);
        return;
      }
      const centerX = artFocus === "all" ? ART_BOUNDS.w / 2 : artFocus * STAGE.w + STAGE.w / 2;
      setZoomCentered(mode === "half" ? ZOOM.half : ZOOM.actual, { x: centerX, y: STAGE.h / 2 }, mode);
      return;
    }
    if (mode === "region") {
      setZoomCentered(measureZoom("region"), { x: REGION.w / 2, y: STAGE.h / 2 }, "region");
      return;
    }
    focusBuiltScreen(focusScreen, mode === "fit" ? "fit" : mode);
  };

  useEffect(() => {
    const frame = requestAnimationFrame(() => focusBuiltScreen(0, "fit"));
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount on the first screen with finished scene art
  }, []);

  useEffect(() => {
    const onResize = () => {
      if (artPreview) {
        if (zoomMode === "region" || (zoomMode === "fit" && artFocus === "all")) focusArtView("all");
        else if (zoomMode === "fit" && artFocus !== "all") focusArtView(artFocus);
        return;
      }
      if (zoomMode === "region") applyPreset("region");
      if (zoomMode === "seam") focusBuiltSeam(ALL_SEAM_LINKS.find((link) => link.id === focusSeam) ?? SEAM_LINKS[0]);
      if (zoomMode === "fit") focusBuiltScreen(focusScreen, "fit");
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoomMode, focusScreen, focusSeam, artPreview, artFocus]);

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    dragRef.current = { active: true, x: event.clientX, y: event.clientY, left: viewport.scrollLeft, top: viewport.scrollTop };
    viewport.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const rect = viewport.getBoundingClientRect();
    setCursor({
      x: Math.max(0, Math.min(canvasBounds.w, Math.round((event.clientX - rect.left + viewport.scrollLeft) / zoom))),
      y: Math.max(0, Math.min(canvasBounds.h, Math.round((event.clientY - rect.top + viewport.scrollTop) / zoom))),
    });
    if (!dragRef.current.active) return;
    viewport.scrollLeft = dragRef.current.left - (event.clientX - dragRef.current.x);
    viewport.scrollTop = dragRef.current.top - (event.clientY - dragRef.current.y);
  };

  return (
    <main
      className={`screen-map-app ${artPreview ? "art-preview" : ""}`}
      data-art-preview={artPreview ? "active" : "inactive"}
      data-art-screens={ART_SCREEN_COUNT}
      data-art-width={ART_BOUNDS.w}
      data-art-height={ART_BOUNDS.h}
      data-stage-width={STAGE.w}
      data-stage-height={STAGE.h}
      data-region-width={REGION.w}
      data-region-height={REGION.h}
      data-region-screens={REGION_SCREENS.length}
      data-colliders={SCREEN_VALIDATION.colliders}
      data-buildings={SCREEN_VALIDATION.buildings}
      data-seam-links={SCREEN_VALIDATION.seams}
      data-lower-seam-links={SCREEN_VALIDATION.lowerSeams}
      data-hidden-entrances={SCREEN_VALIDATION.hiddenEntrances}
      data-runtime-physics="live"
      data-runtime-jump-colliders={RUNTIME_JUMP_COLLIDERS.length}
      data-construction-plane={constructionPlane}
    >
      <header className="screen-header">
        <div><span>REGION 01 · CONTINUOUS CONSTRUCTION MAP</span><h1>雨蚀山门 <b>S01–S12 全区施工图</b></h1></div>
        <nav><span>地表 {REGION.w}×{STAGE.h}px · RUNTIME PHYSICS LOG · LIVE · 已施工 {SCREEN_VALIDATION.built.length}/12屏</span><Link href="/map/gate">返回场景总图 ↗</Link></nav>
      </header>

      <div className="screen-workspace">
        <aside className="screen-left-panel">
          <div className="screen-panel-heading"><span>真实标尺</span><b>PX</b></div>
          <dl className="metric-list">
            <div><dt>游戏一屏</dt><dd>{STAGE.w} × {STAGE.h}</dd></div>
            <div><dt>一区总宽</dt><dd>{REGION.w}px / 12屏</dd></div>
            <div><dt>角色碰撞</dt><dd>{PLAYER.w} × {PLAYER.h}</dd></div>
            <div><dt>跳跃高度</dt><dd>{PLAYER.jumpHeight}px</dd></div>
            <div><dt>助跑跨度</dt><dd>{PLAYER.runJump}px</dd></div>
            <div><dt>安全落差</dt><dd>≤ {PLAYER.safeFall}px</dd></div>
            <div><dt>墙面扫掠胶囊</dt><dd>{GATE_WALL_COLLISION.playerHalfWidth * 2}px · LIVE</dd></div>
            <div><dt>连续接缝</dt><dd>{SEAM_LINKS.length} / 11</dd></div>
            <div><dt>地下接缝</dt><dd>{LOWER_SEAM_LINKS.length} / 3</dd></div>
            <div><dt>隐藏入口</dt><dd>{SCREEN_VALIDATION.hiddenEntrances} / 1</dd></div>
            <div><dt>S04暗板宽</dt><dd>{SCREEN_VALIDATION.dropGap}px</dd></div>
            <div><dt>涵洞净空</dt><dd>{SCREEN_VALIDATION.tunnelClearance}px</dd></div>
            <div><dt>隐藏层跨度</dt><dd>{Math.round(SCREEN_VALIDATION.undergroundSpan / STAGE.w * 10) / 10} 屏</dd></div>
            <div><dt>S08高差</dt><dd>{SCREEN_VALIDATION.highlandRise}px</dd></div>
            <div><dt>接缝方式</dt><dd>步行 ↔ / 无锁镜头</dd></div>
          </dl>

          <div className="screen-panel-heading compact"><span>运行时日志</span><b>LIVE · {RUNTIME_JUMP_COLLIDERS.length}</b></div>
          <div className="runtime-log-list">
            {RUNTIME_JUMP_COLLIDERS.map((item) => (
              <button
                key={item.id}
                type="button"
                className={selectedCollider === item.id ? "active" : ""}
                onClick={() => {
                  setConstructionPlane(item.route);
                  setSelectedCollider(item.id);
                  focusBuiltScreen(item.screen);
                }}
              >
                <b>{item.id}</b><span>JUMP_REQUIRED · S{String(item.screen + 1).padStart(2, "0")} · Y{item.y}</span>
              </button>
            ))}
          </div>

          <div className="screen-panel-heading compact"><span>聚焦屏</span><b>S01–S12</b></div>
          <div className="screen-focus-controls">
            {GATE_SCREENS.map((screen, index) => {
              const firstCollider = COLLIDERS.find((item) => item.screen === index && item.route === constructionPlane)?.id;
              return <button key={screen.id} type="button" disabled={!firstCollider} className={focusScreen === index && zoomMode !== "seam" ? "active" : ""} onClick={() => { if (firstCollider) setSelectedCollider(firstCollider); focusBuiltScreen(index); }}>S{screen.index} {screen.name}</button>;
            })}
          </div>
          <div className="screen-panel-heading compact"><span>物理接缝</span><b>J01–J11 / U01–U03</b></div>
          <div className="seam-focus-controls">
            {constructionPlane === "surface" && SEAM_LINKS.map((link) => <button key={link.id} type="button" className={zoomMode === "seam" && focusSeam === link.id ? "active" : ""} onClick={() => { setSelectedCollider(link.fromCollider); focusBuiltSeam(link); }}>{link.id}</button>)}
            {constructionPlane === "underground" && LOWER_SEAM_LINKS.map((link) => <button key={link.id} type="button" className={`underground ${zoomMode === "seam" && focusSeam === link.id ? "active" : ""}`} onClick={() => { setSelectedCollider(link.fromCollider); focusBuiltSeam(link); }}>{link.id}</button>)}
          </div>

          <div className="screen-panel-heading compact"><span>跨层出入口</span><b>H01 / R01</b></div>
          <div className="hidden-transition-controls">
            <button type="button" className={constructionPlane === "surface" && selectedCollider === "C31" ? "active" : ""} onClick={() => focusHiddenTransition("surface")}><b>H01-A</b><span>地表调查暗板</span></button>
            <button type="button" className={constructionPlane === "underground" && selectedCollider === "C32" ? "active" : ""} onClick={() => focusHiddenTransition("underground")}><b>H01-B</b><span>地下安全落脚</span></button>
            <button type="button" className={constructionPlane === "underground" && selectedCollider === "C116" ? "active" : ""} onClick={() => { setConstructionPlane("underground"); setSelectedCollider("C116"); focusBuiltScreen(6); }}><b>R01-B</b><span>S07地下梯井</span></button>
            <button type="button" className={constructionPlane === "surface" && selectedCollider === "C121" ? "active" : ""} onClick={() => { setConstructionPlane("surface"); setSelectedCollider("C121"); focusBuiltScreen(6); }}><b>R01-A</b><span>复活坪出口</span></button>
          </div>

          <div className="screen-panel-heading compact"><span>{constructionPlane === "surface" ? "地表碰撞体" : "隐藏层碰撞体"}</span><b>{visibleColliders.length}</b></div>
          <div className="collider-list">
            {visibleColliders.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`${item.kind} ${item.requiresJump ? "jump-required" : ""} ${item.activation ? "conditional" : ""} ${selectedCollider === item.id ? "active" : ""}`}
                onClick={() => {
                  setSelectedCollider(item.id);
                  setFocusScreen(item.screen);
                  focusBuiltScreen(item.screen, zoomMode === "half" || zoomMode === "actual" ? zoomMode : "fit");
                }}
              >
                <i>{item.id}</i><span><b>{item.name}</b><small>S{String(item.screen + 1).padStart(2, "0")} · {item.x},{item.y} · {item.w}×{item.h}</small></span>
              </button>
            ))}
          </div>

          <div className="screen-legend">
            <span><i className="solid"/>实体碰撞</span><span><i className="oneway"/>单向平台</span><span><i className="boundary"/>边界碰撞</span><span><i className="jump-required"/>橙色：必须跳跃的台阶</span>
          </div>
        </aside>

        <section className="screen-main">
          <div className="screen-toolbar">
            <span>
              {artPreview
                ? (artFocus === "all"
                  ? `S01–S${ART_LAST_SCREEN} 连续美术草图 · ${ART_BOUNDS.w}×${ART_BOUNDS.h}px`
                  : `S${GATE_SCREENS[artFocus].index} ${GATE_SCREENS[artFocus].name} · 无施工叠层`)
                : `坐标 X ${cursor.x} / Y ${cursor.y}`}
            </span>
            <div className="construction-plane-controls" role="group" aria-label="施工图空间层级">
              <button type="button" className={constructionPlane === "surface" ? "active" : ""} onClick={() => switchConstructionPlane("surface")}>地表施工</button>
              <button type="button" className={constructionPlane === "underground" ? "active underground" : "underground"} onClick={() => switchConstructionPlane("underground")}>隐藏地下</button>
            </div>
            <button
              type="button"
              className={`art-preview-toggle ${artPreview ? "active" : ""}`}
              aria-pressed={artPreview}
              onClick={toggleArtPreview}
            >
              {artPreview ? "退出纯美术" : "纯美术预览"}
            </button>
            {artPreview && (
              <div className="art-focus-controls" role="group" aria-label="美术预览范围">
                <button type="button" className={artFocus === "all" ? "active" : ""} onClick={() => focusArtView("all")}>整段</button>
                {Array.from({ length: ART_SCREEN_COUNT }, (_, index) => (
                  <button
                    key={GATE_SCREENS[index].id}
                    type="button"
                    className={artFocus === index ? "active" : ""}
                    onClick={() => focusArtView(index)}
                  >
                    S{GATE_SCREENS[index].index}
                  </button>
                ))}
              </div>
            )}
            <div className="screen-layer-controls">
              {(["scene", "architecture", "collision", "gameplay", "camera"] as LayerId[]).map((layer) => (
                <button key={layer} type="button" disabled={artPreview} className={layers.has(layer) ? "active" : ""} onClick={() => toggleLayer(layer)}>
                  {{ scene: "场景图", architecture: "建筑", collision: "碰撞", gameplay: "玩法点", camera: "摄影机" }[layer]}
                </button>
              ))}
            </div>
            <div className="screen-zoom-controls">
              <button type="button" className={zoomMode === "region" || (artPreview && artFocus === "all" && zoomMode === "fit") ? "active" : ""} onClick={() => applyPreset("region")}>{artPreview ? "整段适配" : "一区总宽"}</button>
              <button type="button" className={zoomMode === "fit" && !(artPreview && artFocus === "all") ? "active" : ""} onClick={() => applyPreset("fit")}>单屏适配</button>
              <button type="button" className={zoomMode === "half" ? "active" : ""} onClick={() => applyPreset("half")}>1:2</button>
              <button type="button" className={zoomMode === "actual" ? "active" : ""} onClick={() => applyPreset("actual")}>1:1</button>
              <button type="button" aria-label="缩小" onClick={() => setZoomCentered(zoom - 0.08)}>−</button><span>{Math.round(zoom * 100)}%</span><button type="button" aria-label="放大" onClick={() => setZoomCentered(zoom + 0.08)}>＋</button>
            </div>
          </div>

          <div
            className="screen-viewport"
            ref={viewportRef}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={() => { dragRef.current.active = false; }}
            onPointerCancel={() => { dragRef.current.active = false; }}
          >
            <div className="screen-canvas" style={{ width: canvasBounds.w * zoom, height: canvasBounds.h * zoom }}>
              <div className="screen-scale" style={{ width: canvasBounds.w, height: canvasBounds.h, transform: `scale(${zoom})`, "--inverse": 1 / zoom } as CSSProperties}>
                <svg className="screen-drawing" viewBox={`0 0 ${canvasBounds.w} ${canvasBounds.h}`} role="img" aria-label={artPreview ? `雨蚀山门 S01–S${ART_LAST_SCREEN} 连续纯美术草图` : "雨蚀山门十二屏连续实际尺寸施工图，当前细化S01破庙残院与S02竹雾村缘"}>
                  <defs>
                    <pattern id="pixel-grid" width="100" height="100" patternUnits="userSpaceOnUse"><path d="M100 0H0V100"/></pattern>
                    <pattern id="region-grid" width="480" height="480" patternUnits="userSpaceOnUse"><path d="M480 0H0V480"/></pattern>
                    <linearGradient id="built-mist" gradientUnits="userSpaceOnUse" x1="0" x2={REGION.w}><stop offset="0" stopColor="#6f8f82" stopOpacity=".14"/><stop offset=".48" stopColor="#789886" stopOpacity=".13"/><stop offset=".52" stopColor="#7e9d85" stopOpacity=".13"/><stop offset="1" stopColor="#c29364" stopOpacity=".08"/></linearGradient>
                    <clipPath id="seam-decoration-clip"><rect x={STAGE.w - sx(622)} y="0" width={sx(1244)} height={sy(SEAM.s01ToS02)}/></clipPath>
                  </defs>
                  <rect width={REGION.w} height={REGION.h} className="region-paper"/>
                  <rect className="construction-grid region-grid" width={REGION.w} height={REGION.h} fill="url(#region-grid)"/>
                  <g className="construction-screens">
                    {GATE_SCREENS.map((screen, index) => {
                      const x = index * STAGE.w;
                      const built = BUILT_SCREENS.has(screen.id);
                      const stubFloorY = index >= 2 ? sy(SEAM.s02ToS03) : sy(SEAM.s01ToS02);
                      return <g key={screen.id} className={built ? "current" : "future"}>
                        {/* Full region-height columns so overview reads as 12 equal screen widths */}
                        <rect className={built ? "built-sector" : undefined} x={x} y="0" width={STAGE.w} height={REGION.h}/>
                        {built && index > 0 && <line className="built-screen-divider" x1={x} y1="0" x2={x} y2={REGION.h}/>} 
                        <line className="camera-band" x1={x} y1={STAGE.h} x2={x + STAGE.w} y2={STAGE.h}/>
                        <text x={x + 120} y="145">S{screen.index} · {screen.name}</text>
                        <text className="screen-size-label" x={x + STAGE.w / 2} y={STAGE.h - 80}>{STAGE.w}×{STAGE.h}px · 1屏</text>
                        {!built && <>
                          <text className="future-state" x={x + STAGE.w / 2} y={STAGE.h / 2}>待施工</text>
                          <line x1={x} y1={stubFloorY} x2={x + STAGE.w} y2={stubFloorY}/>
                        </>}
                        <text className="lower-reserve" x={x + STAGE.w / 2} y={STAGE.h + (REGION.h - STAGE.h) / 2}>下层支路预留</text>
                      </g>;
                    })}
                  </g>
                  {/* —— S01 source-space art (world X 0) —— */}
                  <g className="route-surface" transform={`scale(${SCALE.x} ${SCALE.y})`}>
                    <rect width={SOURCE_STAGE.w} height={SOURCE_STAGE.h} className="screen-paper"/><rect className="construction-grid" width={SOURCE_STAGE.w} height={SOURCE_STAGE.h} fill="url(#pixel-grid)"/>
                    <path className="far-mountains" d="M0 580L180 390L330 470L520 280L720 440L930 230L1160 390L1370 250L1672 420V760H0Z"/>
                    {(artPreview || layers.has("scene")) && <image
                      className="scene-art-layer"
                      href="/assets/maps/gate/s01-ink-background-layered-4k.png?v=land-god-shrine-1"
                      x="0"
                      y="0"
                      width={SOURCE_STAGE.w}
                      height={SOURCE_STAGE.h}
                      preserveAspectRatio="none"
                    />}

                    {layers.has("camera") && <g className="camera-layer"><rect x="24" y="24" width="1624" height="893"/><rect className="camera-deadzone" x="502" y="250" width="668" height="420"/><text x="42" y="58">CAMERA SAFE · 24px</text><text x="520" y="282">PLAYER DEAD ZONE</text><line x1="836" y1="24" x2="836" y2="917"/></g>}

                    {layers.has("architecture") && <g className="building-layer">
                      <g className="ruin west"><rect x="86" y="420" width="310" height="300"/><path d="M58 420Q230 312 424 420"/><path d="M110 470h240M140 470v250M335 470v250"/><rect className="door" x="210" y="584" width="78" height="136"/></g>
                      <g className="ruin hall"><rect x="385" y="350" width="520" height="370"/><path d="M340 350Q630 190 950 350"/><path d="M410 420h470M455 420v300M815 420v300"/><path className="broken-roof" d="M340 350l145-82 80 45 110-94 90 68 185 63"/><circle cx="640" cy="500" r="72"/><path d="M610 572v148M670 572v148"/></g>
                      <g className="ruin east"><rect x="930" y="405" width="360" height="315"/><path d="M900 405q190-105 420 0"/><path d="M970 470h285M1000 470v250M1235 470v250"/><path d="M1290 520l100-65v219"/></g>
                      <g className="broken-exit"><path d="M1390 674V455h180v219M1390 455l56 48 44-58 80 10"/><path d="M1450 674v-132h120"/></g>
                      <g className="rain-water">{Array.from({length:24}).map((_,index)=><line key={index} x1={index*72+25} y1={160+(index%4)*35} x2={index*72-15} y2={290+(index%4)*35}/>)}</g>
                    </g>}
                  </g>

                  {/* —— S02 source-space art (world X = STAGE.w) —— */}
                  <g className="route-surface" transform={`translate(${STAGE.w} 0) scale(${SCALE.x} ${SCALE.y})`}>
                    <rect width={SOURCE_STAGE.w} height={SOURCE_STAGE.h} className="screen-paper"/><rect className="construction-grid" width={SOURCE_STAGE.w} height={SOURCE_STAGE.h} fill="url(#pixel-grid)"/>
                    <path className="far-mountains" d="M0 420L140 360L280 430L460 260L640 400L820 220L1040 360L1260 240L1480 350L1672 420V760H0Z"/>
                    {(artPreview || layers.has("scene")) && <image
                      className="scene-art-layer"
                      href="/assets/maps/gate/s02-ink-background-layered-seam-v2-4k.png"
                      x="0"
                      y="0"
                      width={SOURCE_STAGE.w}
                      height={SOURCE_STAGE.h}
                      preserveAspectRatio="none"
                    />}

                    {layers.has("camera") && <g className="camera-layer"><rect x="24" y="24" width="1624" height="893"/><rect className="camera-deadzone" x="502" y="250" width="668" height="420"/><text x="42" y="58">CAMERA SAFE · 24px</text><text x="520" y="282">PLAYER DEAD ZONE</text><line x1="836" y1="24" x2="836" y2="917"/></g>}

                    {layers.has("architecture") && <g className="building-layer">
                      <g className="village west-house">
                        <rect x="240" y="430" width="280" height="244"/>
                        <path d="M210 430Q380 320 540 430"/>
                        <path d="M270 480h220M300 480v194M480 480v194"/>
                        <rect className="door" x="340" y="560" width="64" height="114"/>
                        <path className="eave" d="M250 540H500"/>
                      </g>
                      <g className="village east-house">
                        <rect x="780" y="390" width="340" height="256"/>
                        <path d="M750 390Q950 270 1140 390"/>
                        <path d="M820 450h260M850 450v196M1060 450v196"/>
                        <rect className="door" x="920" y="520" width="70" height="126"/>
                        <path className="eave" d="M800 505H1100"/>
                        <path d="M780 646H1120"/>
                      </g>
                      <g className="village rain-trough">
                        <path d="M500 560H720"/>
                        <path d="M520 560V620M700 560V620"/>
                        <path className="drip" d="M560 590V640M610 590V650M660 590V635"/>
                      </g>
                      <g className="village bamboo-fence">
                        {Array.from({ length: 14 }).map((_, index) => (
                          <line key={index} x1={600 + index * 28} y1={400 + (index % 3) * 12} x2={600 + index * 28} y2={SEAM.s01ToS02}/>
                        ))}
                        <path d="M600 430H980M600 520H980"/>
                      </g>
                      <g className="rain-water">{Array.from({ length: 22 }).map((_, index) => <line key={index} x1={index * 78 + 40} y1={140 + (index % 5) * 28} x2={index * 78 - 10} y2={270 + (index % 5) * 28}/>)}</g>
                    </g>}
                  </g>

                  {(artPreview || layers.has("scene")) && <image
                    className="scene-art-layer seam-bamboo-layer route-surface"
                    href="/assets/maps/gate/shared/s01-s02-seam-bamboo.png?v=1"
                    clipPath="url(#seam-decoration-clip)"
                    x={STAGE.w - sx(622)}
                    y={sy(10)}
                    width={sx(1244)}
                    height={sy(700)}
                    preserveAspectRatio="none"
                  />}

                  {ADDITIONAL_GATE_CONSTRUCTION.map((screen) => <g key={screen.id} transform={`translate(${screen.screen * STAGE.w} 0) scale(${SCALE.x} ${SCALE.y})`}>
                    <rect width={SOURCE_STAGE.w} height={SOURCE_STAGE.h} className="screen-paper"/><rect className="construction-grid" width={SOURCE_STAGE.w} height={SOURCE_STAGE.h} fill="url(#pixel-grid)"/>
                    <path className="far-mountains route-surface" d={`M0 420L180 ${330 - (screen.screen % 3) * 28}L350 430L560 ${245 + (screen.screen % 2) * 34}L760 410L980 ${215 + (screen.screen % 4) * 22}L1210 380L1450 300L1672 420V760H0Z`}/>
                    {(artPreview || layers.has("scene")) && (constructionPlane === "surface" || (screen.screen >= 3 && screen.screen <= 6)) && <image
                      className="scene-art-layer region-sketch-layer"
                      href={constructionPlane === "underground"
                        ? screen.id === "s04"
                          ? "/assets/maps/gate/s04-underground-ink-layered-4k.png?v=land-god-shrine-1"
                          : screen.id === "s05"
                            ? "/assets/maps/gate/s05-underground-ink-layered-4k.png?v=s05-underground-five-layer-2"
                          : screen.id === "s06"
                            ? "/assets/maps/gate/s06-underground-ink-layered-4k.png?v=s06-underground-five-layer-1"
                          : `/assets/maps/gate/region-sketch/underground/screens/${screen.id}.png?v=hidden-region-s07-return-1`
                        : screen.id === "s03"
                          ? "/assets/maps/gate/s03-ink-background-layered-seam-v2-4k.png"
                          : screen.id === "s04"
                            ? "/assets/maps/gate/s04-ink-background-layered-4k.png?v=seam-ground-4"
                            : screen.id === "s05"
                              ? "/assets/maps/gate/s05-ink-background-layered-4k.png?v=natural-floor-collision-6"
                              : screen.id === "s06"
                                ? "/assets/maps/gate/s06-ink-background-layered-4k.png?v=s06-surface-five-layer-1"
                                : screen.id === "s07"
                                  ? "/assets/maps/gate/s07-ink-background-grounded-4k.png?v=land-god-shrine-1"
                                  : screen.id === "s08"
                                    ? "/assets/maps/gate/s08-ink-background-layered-4k.png?v=s08-flat-y300"
                                    : screen.id === "s09"
                                      ? "/assets/maps/gate/s09-ink-background-layered-4k.png?v=s09-entry-y300"
                                      : screen.id === "s10"
                                        ? "/assets/maps/gate/s10-ink-background-layered-v2-4k.png"
                                        : screen.id === "s11"
                                          ? "/assets/maps/gate/s11-ink-background-layered-4k.png?v=s11-five-layer-1"
                                          : screen.id === "s12"
                                            ? "/assets/maps/gate/s12-ink-background-layered-4k.png?v=s12-five-layer-1"
                            : `/assets/maps/gate/region-sketch/screens/${screen.id}.png?v=hidden-region-1`}
                      x="0"
                      y="0"
                      width={SOURCE_STAGE.w}
                      height={SOURCE_STAGE.h}
                      preserveAspectRatio="none"
                    />}
                    {layers.has("camera") && <g className="camera-layer"><rect x="24" y="24" width="1624" height="893"/><rect className="camera-deadzone" x="502" y="250" width="668" height="420"/><text x="42" y="58">CAMERA SAFE · 24px</text><text x="520" y="282">PLAYER DEAD ZONE</text><line x1="836" y1="24" x2="836" y2="917"/></g>}
                    {layers.has("architecture") && <g className="building-layer construction-parts">
                      {screen.buildings.filter((part) => (part.route ?? "surface") === constructionPlane).map((part) => {
                        const width = part.x1 - part.x0;
                        const height = part.y1 - part.y0;
                        const center = part.x0 + width / 2;
                        const stairPath = part.steps?.length
                          ? `M${part.steps[0].x} ${part.steps[0].y}${part.steps.slice(1).map((step) => `H${step.x}V${step.y}`).join("")}H${part.x1}V${part.y1}H${part.x0}Z`
                          : `M${part.x0} ${part.y1}H${part.x1}V${part.y0}H${part.x0}Z`;
                        return <g key={part.id} className={`construction-part part-${part.shape}`}>
                          {part.shape === "stairs"
                            ? <path className="part-body" d={stairPath}/>
                            : part.shape === "slope"
                            ? <path className="part-body" d={`M${part.x0} ${part.y1}L${part.x1} ${part.y0}V${part.y1}Z`}/>
                            : <rect className="part-body" x={part.x0} y={part.y0} width={width} height={height}/>} 
                          {(part.shape === "gate" || part.shape === "pavilion" || part.shape === "shed" || part.shape === "tower") && <path className="part-roof" d={`M${part.x0 - 24} ${part.y0}Q${center} ${part.y0 - Math.min(90, height * .38)} ${part.x1 + 24} ${part.y0}`}/>} 
                          {(part.shape === "corridor" || part.shape === "bridge") && <>{Array.from({ length: 5 }).map((_, column) => <line key={column} x1={part.x0 + width * (column + 1) / 6} y1={part.y0} x2={part.x0 + width * (column + 1) / 6} y2={part.y1}/>)}</>}
                          {part.shape === "water" && <path className="water-lines" d={`M${part.x0} ${part.y0 + 18}Q${part.x0 + width * .25} ${part.y0} ${part.x0 + width * .5} ${part.y0 + 18}T${part.x1} ${part.y0 + 18}`}/>} 
                          {part.shape === "prop" && <><ellipse className="prop-vessel" cx={part.x0 + width * .34} cy={part.y1 - height * .36} rx={width * .18} ry={height * .36}/><path className="prop-rubble" d={`M${part.x0 + width * .58} ${part.y1}l${width * .12} ${-height * .5}l${width * .11} ${height * .5}m${-width * .05} 0l${width * .12} ${-height * .3}`}/><line className="prop-baseline" x1={part.x0} y1={part.y1} x2={part.x1} y2={part.y1}/></>}
                          {part.shape === "arena" && <><line x1={part.x0 + width * .2} y1={part.y0} x2={part.x0 + width * .2} y2={part.y1}/><line x1={part.x1 - width * .2} y1={part.y0} x2={part.x1 - width * .2} y2={part.y1}/></>}
                          <text x={center} y={part.y0 - 16}>{part.id} · {part.name}</text>
                        </g>;
                      })}
                      <g className="rain-water">{Array.from({ length: 22 }).map((_, index) => <line key={index} x1={index * 78 + 40} y1={130 + (index % 5) * 30} x2={index * 78 - 8} y2={260 + (index % 5) * 30}/>)}</g>
                    </g>}
                  </g>)}

                  <rect width={REGION.w} height={STAGE.h} fill="url(#built-mist)" className="built-atmosphere route-surface"/>

                  {layers.has("architecture") && <g className="seam-architecture">{ALL_SEAM_LINKS.filter((link) => link.route === (constructionPlane === "surface" ? "main" : "underground")).map((link) => {
                    const left = COLLIDERS.find((item) => item.id === link.fromCollider)!;
                    const right = COLLIDERS.find((item) => item.id === link.toCollider)!;
                    const roadPath = right.slopeEndY === undefined
                      ? `M${link.x - sx(132)} ${left.y}H${link.x + sx(220)}`
                      : `M${link.x - sx(132)} ${left.y}H${link.x}L${link.x + right.w} ${right.slopeEndY}`;
                    return <g key={link.id}><path className="seam-road" d={roadPath}/><path className="seam-drain" d={`M${link.x - sx(80)} ${left.y}v${sy(28)}M${link.x} ${left.y}v${sy(22)}M${link.x + sx(80)} ${left.y}v${sy(28)}`}/><text x={link.x} y={left.y - sy(44)}>{link.id === "J02" ? "J02 · 雨蚀石涵道 · WORLD ASSET" : `${link.id} · 连续引道`}</text></g>;
                  })}</g>}

                  {layers.has("camera") && <g className="continuous-camera-layer">
                    <rect x={sx(24)} y={sy(24)} width={REGION.w - sx(48)} height={sy(893)}/>
                    {(constructionPlane === "surface" ? SEAM_LINKS : LOWER_SEAM_LINKS).map((link) => <g key={link.id}><rect className="camera-seam-zone" x={link.x - sx(180)} y={sy(190)} width={sx(360)} height={sy(540)}/><text x={link.x} y={sy(176)}>{link.id} · CAMERA CONTINUOUS</text></g>)}
                  </g>}

                  {layers.has("collision") && <g className="collision-layer">{COLLIDERS.filter((item) => item.route === constructionPlane).map((item) => {
                   const lowerCollider = item.requiresJump
                      ? COLLIDERS.filter((candidate) => candidate.id !== item.id && candidate.route === item.route && candidate.screen === item.screen && candidate.x + candidate.w <= item.x && (candidate.slopeEndY ?? candidate.y) > item.y).sort((left, right) => right.x + right.w - (left.x + left.w))[0]
                     : undefined;
                    const lowerTop = lowerCollider ? lowerCollider.slopeEndY ?? lowerCollider.y : undefined;
                    return <g key={item.id} className={`collider collider-${item.kind} ${item.requiresJump ? "jump-required" : ""} ${item.activation ? "conditional" : ""} ${selectedCollider === item.id ? "selected" : ""}`} onClick={() => { setSelectedCollider(item.id); setFocusScreen(item.screen); }}>
                      {item.slopeEndY === undefined
                        ? <rect x={item.x} y={item.y} width={item.w} height={item.h}/>
                        : <path className="collider-shape" d={`M${item.x} ${item.y}L${item.x + item.w} ${item.slopeEndY}V${item.y + item.h}H${item.x}Z`}/>}
                      {lowerCollider && lowerTop !== undefined && <g className="jump-required-marker"><path d={`M${item.x} ${lowerTop}V${item.y}m${-sx(16)} ${sy(20)}L${item.x} ${item.y - sy(2)}l${sx(16)} ${-sy(20)}M${item.x} ${item.y}H${item.x + item.w}`}/><text x={item.x + item.w / 2} y={item.y - sy(30)}>JUMP ↑</text></g>}
                      <text x={item.x + 10} y={item.y + 22}>{item.id} · {item.w}×{item.h}</text>
                    </g>;
                  })}</g>}

                  {layers.has("collision") && <g className="seam-weld-layer">{ALL_SEAM_LINKS.filter((link) => link.route === (constructionPlane === "surface" ? "main" : "underground")).map((link) => {
                    const left = COLLIDERS.find((item) => item.id === link.fromCollider)!;
                    const right = COLLIDERS.find((item) => item.id === link.toCollider)!;
                    const weldPath = right.slopeEndY === undefined
                      ? `M${link.x - sx(132)} ${left.y}H${link.x + sx(180)}`
                      : `M${link.x - sx(132)} ${left.y}H${link.x}L${link.x + right.w} ${right.slopeEndY}`;
                    return <g key={link.id}><rect x={link.x - 8} y={left.y} width="16" height={STAGE.h - left.y}/><path d={weldPath}/><text x={link.x} y={left.y - 54}>{link.id} · WALK ↔ · PHYSICS WELD</text></g>;
                  })}</g>}

                  {layers.has("gameplay") && <>
                    {constructionPlane === "surface" && <g className="gameplay-layer" transform={`scale(${SCALE.x} ${SCALE.y})`}>
                      <path className="main-path" d="M150 720H1672"/><path className="upper-path" d="M500 600H730L775 542H1000L1045 478H1295"/>
                      <g className="player-spawn"><rect x="150" y="624" width={SOURCE_PLAYER.w} height={SOURCE_PLAYER.h}/><text x="186" y="610">SPAWN</text></g>
                      <g className="player-metric"><rect x="465" y="624" width={SOURCE_PLAYER.w} height={SOURCE_PLAYER.h}/><path d="M501 624V454"/><path d="M489 466l12-12 12 12"/><text x="520" y="480">跳高 {PLAYER.jumpHeight}px</text></g>
                      <g className="shrine-zone"><rect x="255" y="545" width="170" height="175"/><path d="M310 695v-95h60v95M296 600q44-55 88 0"/><text x="272" y="530">神龛交互区</text></g>
                      <g className="safe-point"><circle cx="222" cy="720" r="12"/><text x="238" y="700">SAFE RESPAWN (222,720)</text></g>
                      <g className="exit-trigger"><rect x="1574" y="520" width="98" height="154"/><text x="1560" y="505">TO S02</text></g>
                    </g>}
                    {constructionPlane === "surface" && <g className="gameplay-layer" transform={`translate(${STAGE.w} 0) scale(${SCALE.x} ${SCALE.y})`}>
                      <path className="main-path" d={`M0 ${SEAM.s01ToS02}H720L900 646H1100L1380 ${SEAM.s02ToS03}H1672`}/>
                      <path className="upper-path" d="M260 540H510M530 590H700M820 505H1090"/>
                      <g className="patrol-zone"><rect x="280" y="520" width="380" height="154"/><text x="300" y="505">刀客巡逻带</text></g>
                      <g className="landmark-zone"><rect x="500" y="540" width="220" height="90"/><text x="520" y="525">雨水木槽</text></g>
                      <g className="safe-point"><circle cx="120" cy={SEAM.s01ToS02} r="12"/><text x="140" y={SEAM.s01ToS02 - 20}>SAFE · SEAM S01</text></g>
                      <g className="exit-trigger"><rect x="1540" y="480" width="110" height="152"/><text x="1520" y="465">TO S03</text></g>
                      <g className="slope-hint"><path d={`M1500 ${SEAM.s02ToS03}L1672 600`}/><text x="1480" y="590">S03缓坡起势</text></g>
                    </g>}
                    {ADDITIONAL_GATE_CONSTRUCTION.map((screen) => <g key={screen.id} className="gameplay-layer" transform={`translate(${screen.screen * STAGE.w} 0) scale(${SCALE.x} ${SCALE.y})`}>
                      {constructionPlane === "surface" && <path className="main-path" d={screen.mainPath}/>}
                      {constructionPlane === "surface" && screen.upperPaths?.map((path, index) => <path key={index} className="upper-path" d={path}/>)}
                      {constructionPlane === "underground" && screen.lowerPath && <path className="lower-path" d={screen.lowerPath}/>}
                      {screen.encounters.filter((encounter) => (encounter.route ?? "surface") === constructionPlane).map((encounter, index) => <g key={`${encounter.label}-${index}`} className={`encounter-marker encounter-${encounter.tone}`} transform={`translate(${encounter.x} ${encounter.y})`}><circle r="16"/><path d="M-22 0H22M0-22V22"/><text x="0" y="-30">{encounter.label}</text></g>)}
                      {GATE_SHRINE_PLACEMENTS.filter((shrine) => shrine.screen === screen.screen && shrine.route === constructionPlane).map((shrine) => <g key={shrine.id} className="shrine-zone"><rect x={shrine.x} y={shrine.y} width={shrine.w} height={shrine.h}/><text x={shrine.x} y={shrine.y - 16}>{shrine.id} · {shrine.label}</text></g>)}
                      <g className="screen-role"><text x="836" y="110">{screen.role} · {screen.gameplayNote}</text></g>
                    </g>)}
                  </>}

                  <g className="hidden-route-layer">
                    {HIDDEN_ROUTE_LINKS.map((link) => {
                      const x = link.screen * STAGE.w + sx(link.localX);
                      const surface = COLLIDERS.find((item) => item.id === link.surfaceCollider)!;
                      const underground = COLLIDERS.find((item) => item.id === link.undergroundCollider)!;
                      return constructionPlane === "surface"
                        ? <g key={`${link.id}-surface`} className="hidden-route-entry"><rect x={surface.x} y={surface.y - sy(34)} width={surface.w} height={sy(52)}/><path d={`M${x} ${surface.y - sy(86)}V${surface.y - sy(16)}m${-sx(16)} ${-sy(18)}l${sx(16)} ${sy(18)}l${sx(16)} ${-sy(18)}`}/><text x={x} y={surface.y - sy(102)}>{link.id}-A · 隐藏入口 · 调查后向下穿落</text><text className="hidden-route-note" x={x} y={surface.y + sy(58)}>触发范围 {surface.w}px · 单向下落 · 摄影机切换</text></g>
                        : <g key={`${link.id}-underground`} className="hidden-route-landing"><circle cx={x} cy={underground.y} r={sx(18)}/><path d={`M${x} ${underground.y - sy(150)}V${underground.y - sy(24)}`}/><text x={x} y={underground.y - sy(166)}>{link.id}-B · 地下安全落脚点</text><text className="hidden-route-note" x={x} y={underground.y + sy(58)}>与H01-A同世界X · 回程经S07永久梯井并直达复活点</text></g>;
                    })}
                    {RETURN_ROUTE_LINKS.map((link) => {
                      const x = link.screen * STAGE.w + sx(link.localX);
                      const floor = COLLIDERS.find((item) => item.id === link.undergroundFloor)!;
                      const cap = COLLIDERS.find((item) => item.id === link.surfaceCap)!;
                      return constructionPlane === "surface"
                        ? <g key={`${link.id}-surface`} className="hidden-route-entry"><rect x={cap.x} y={cap.y - sy(42)} width={cap.w} height={sy(60)}/><path d={`M${x} ${cap.y + sy(28)}V${cap.y - sy(76)}m${-sx(16)} ${sy(18)}l${sx(16)} ${-sy(18)}l${sx(16)} ${sy(18)}`}/><text x={x} y={cap.y - sy(94)}>{link.id}-A · S07永久梯井出口</text><text className="hidden-route-note" x={x} y={cap.y + sy(62)}>单向爬出 · 切回地表 · 复活锚点 X{sx(420)}</text></g>
                        : <g key={`${link.id}-underground`} className="hidden-route-landing"><path d={`M${x - sx(24)} ${floor.y}V${cap.y}M${x + sx(24)} ${floor.y}V${cap.y}${Array.from({ length: 6 }, (_, rung) => `M${x - sx(24)} ${floor.y - sy(24 + rung * 25)}H${x + sx(24)}`).join("")}`}/><text x={x} y={cap.y - sy(28)}>{link.id}-B · CLIMB LADDER ↑</text><text className="hidden-route-note" x={x} y={floor.y + sy(58)}>U03后上爬 · 单向井盖 · 出口直见复活点</text></g>;
                    })}
                  </g>

                  {GATE_SCREENS.map((screen, screenIndex) => <g key={screen.id} transform={`translate(${screenIndex * STAGE.w} 0) scale(${SCALE.x} ${SCALE.y})`}>
                    <g className="ruler x-ruler">{Array.from({length:17}).map((_,index)=><g key={index}><line x1={index*100} y1="0" x2={index*100} y2="18"/><text x={index*100+4} y="34">{sx(index*100) + screenIndex * STAGE.w}</text></g>)}</g>
                    {screenIndex === 0 && <g className="ruler y-ruler">{Array.from({length:10}).map((_,index)=><g key={index}><line x1="0" y1={index*100} x2="18" y2={index*100}/><text x="24" y={index*100+14}>{sy(index*100)}</text></g>)}</g>}
                  </g>)}
                </svg>
              </div>
            </div>
          </div>

          <div className="screen-status">
            <span>当前施工 S{String(collider.screen + 1).padStart(2, "0")} · 已建 12/12 · X {collider.screen * STAGE.w}–{(collider.screen + 1) * STAGE.w}</span>
            <b>绿色：实际碰撞 · 橙色：JUMP_REQUIRED / WALL_CLAMP · 青色：单向平台 · 接缝 {SCREEN_VALIDATION.seams}/11 + 地下 {SCREEN_VALIDATION.lowerSeams}/3</b>
            <span>一区总宽 {REGION.w}px</span>
          </div>
        </section>

        <aside className="screen-right-panel">
          <div className="screen-detail-index">{collider.id}</div>
          <small>{collider.kind.toUpperCase()} · S{String(collider.screen + 1).padStart(2, "0")}{collider.activation ? " · DYNAMIC BOSS GATE" : ""}</small>
          <h2>{collider.name}</h2>
          <p>{collider.note}</p>
          <dl>
            <div><dt>左上坐标</dt><dd>X {collider.x} / Y {collider.y}</dd></div>
            <div><dt>尺寸</dt><dd>{collider.w} × {collider.h}px</dd></div>
            <div><dt>落脚面</dt><dd>{collider.slopeEndY === undefined ? `Y ${collider.y}px` : `Y ${collider.y} → ${collider.slopeEndY}px`}</dd></div>
            <div><dt>进入方式</dt><dd>{collider.requiresJump ? "必须跳跃" : "可正常移动"}</dd></div>
            <div><dt>所属屏</dt><dd>S{String(collider.screen + 1).padStart(2, "0")} · {REGION_SCREENS[collider.screen]}</dd></div>
            <div><dt>类型</dt><dd>{collider.activation ? "Boss战动态封门" : { solid: "实体地形", oneway: "单向穿越平台", boundary: "不可穿越边界" }[collider.kind]}</dd></div>
            {collider.activation && <><div><dt>战前</dt><dd>碰撞解除</dd></div><div><dt>开战</dt><dd>碰撞启用</dd></div><div><dt>击杀后</dt><dd>碰撞解除</dd></div></>}
          </dl>
          <section className={`runtime-log ${collider.requiresJump ? "jump" : ""}`}>
            <small>RUNTIME LOG · COLLISION TRACE</small>
            <b>{collider.requiresJump ? "JUMP_REQUIRED / WALL_CLAMP" : collider.slopeEndY !== undefined ? "SURFACE_FOLLOW / SLOPE" : "SURFACE_CONTACT / WALK"}</b>
            <span>[COLLIDER] {collider.id} · {collider.route.toUpperCase()} · X {collider.x}–{collider.x + collider.w}</span>
            <span>[SWEEP] foot capsule ±{GATE_WALL_COLLISION.playerHalfWidth}px · ground + air</span>
            {collider.requiresJump
              ? <><span>[BLOCK] lower-side entry stops at riser</span><span>[INPUT] jump → [LAND] tread top Y {collider.y}</span></>
              : <><span>[CONTACT] walkable top registered at Y {collider.y}</span><span>[MOVE] continuous surface / auto-step rules</span></>}
          </section>
          <section>
            <small>BUILDING PARTS · S{String(collider.screen + 1).padStart(2, "0")}</small>
            {buildingsForDetail.map((part) => (
              <p key={part.id}><b>{part.id} · {part.name}</b><span>{part.x},{part.y} · {part.w}×{part.h}</span><em>{part.material}</em></p>
            ))}
          </section>
          {hiddenTransitionDetail && <section className="hidden-transition-detail">
            <small>CROSS-LAYER TRANSITION · {hiddenTransitionDetail.id}</small>
            <b>{collider.route === "surface" ? `${hiddenTransitionDetail.id}-A · 地表入口` : `${hiddenTransitionDetail.id}-B · 地下落脚`}</b>
            <span>世界 X {hiddenTransitionDetail.screen * STAGE.w + sx(hiddenTransitionDetail.localX)}</span>
            <span>调查后开启 · {hiddenTransitionDetail.collisionReleaseMs}ms释放碰撞 · {hiddenTransitionDetail.openingDurationMs}ms完成特效</span>
            <span>回程：S07 西侧永久梯井 → 复活锚点</span>
          </section>}
          <section className="implementation-notes">
            <small>IMPLEMENTATION NOTES</small>
            <b>连续坐标：S0n 世界 X = (n−1)×{STAGE.w} + 本地</b>
            <span>J01–J11 主路与 U01–U03 地下通道均验证左右碰撞顶面、底面和世界X一致；H01-A/H01-B 验证同一世界X、安全落差与摄影机切层，S07梯井验证爬出后可直接看见复活锚点。</span>
            {constructionDetail
              ? <><span><b>{constructionDetail.role}</b>：{constructionDetail.gameplayNote}</span><span>入口 Y={sy(constructionDetail.entryY)} / 出口 Y={sy(constructionDetail.exitY)}；主路线从本地 X0 连续绘制至 X1672。</span></>
              : <span>S01–S02 保留已确认的破庙—村缘引道、同高地板和连续雾层。</span>}
            <span>建筑、敌人和玩法标记均使用与场景总图相同的屏幕编号及名称；每屏保持完整 3840×2160px 施工范围。</span>
          </section>
        </aside>
      </div>
    </main>
  );
}
