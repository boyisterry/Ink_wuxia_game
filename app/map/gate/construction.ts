import type { GateScreenId } from "./screens";

export type ConstructionColliderSpec = {
  id: string;
  name: string;
  kind: "solid" | "oneway" | "boundary";
  x: number;
  y: number;
  w: number;
  h: number;
  /** Optional top-right walkable Y for a continuous solid slope. */
  slopeEndY?: number;
  note: string;
  route?: "surface" | "underground";
  activation?: {
    initial: "disabled";
    enableOn: "boss-combat-start";
    disableOn: "boss-defeated";
    encounter: "s08-gate-boss" | "s11-gate-boss";
  };
};

export type ConstructionBuildingSpec = {
  id: string;
  name: string;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  material: string;
  shape: "slope" | "shed" | "gate" | "corridor" | "pavilion" | "arena" | "tower" | "water" | "bridge";
  route?: "surface" | "underground";
};

export type ConstructionEncounterSpec = {
  x: number;
  y: number;
  label: string;
  tone: "basic" | "range" | "elite" | "wave" | "safe" | "system";
  route?: "surface" | "underground";
};

export type ConstructionLayerTransitionSpec = {
  id: `H${string}`;
  screen: number;
  localX: number;
  surfaceCollider: string;
  undergroundCollider: string;
  movement: "investigate-then-drop";
  direction: "surface-to-underground";
  camera: "layer-switch";
  returnVia: "S07-ladder";
  channelWidth: number;
  openingDurationMs: number;
  collisionReleaseMs: number;
  landingRecoveryMs: number;
  note: string;
};

export type ConstructionReturnTransitionSpec = {
  id: `R${string}`;
  screen: number;
  localX: number;
  undergroundFloor: string;
  middlePlatform: string;
  surfaceCap: string;
  movement: "climb-ladder";
  direction: "underground-to-surface";
  camera: "layer-switch";
  bidirectional: false;
  destination: "respawn-anchor";
  note: string;
};

export type GateConstructionSpec = {
  id: GateScreenId;
  screen: number;
  name: string;
  role: string;
  entryY: number;
  exitY: number;
  entryCollider: string;
  exitCollider: string;
  mainPath: string;
  upperPaths?: readonly string[];
  lowerPath?: string;
  gameplayNote: string;
  colliders: readonly ConstructionColliderSpec[];
  buildings: readonly ConstructionBuildingSpec[];
  encounters: readonly ConstructionEncounterSpec[];
};

const floor = (id: string, name: string, x: number, y: number, w: number, note: string): ConstructionColliderSpec => ({
  id, name, kind: "solid", x, y, w, h: 941 - y, note,
});

const slab = (id: string, name: string, x: number, y: number, w: number, note: string, h = 48): ConstructionColliderSpec => ({
  id, name, kind: "solid", x, y, w, h, note,
});

const slopeFloor = (id: string, name: string, x: number, y: number, endY: number, w: number, note: string): ConstructionColliderSpec => ({
  id, name, kind: "solid", x, y, w, h: 941 - y, slopeEndY: endY, note,
});

export const GATE_HIDDEN_TRANSITIONS: readonly ConstructionLayerTransitionSpec[] = [{
  id: "H01",
  screen: 3,
  localX: 790,
  surfaceCollider: "C31",
  undergroundCollider: "C32",
  movement: "investigate-then-drop",
  direction: "surface-to-underground",
  camera: "layer-switch",
  returnVia: "S07-ladder",
  channelWidth: 140,
  openingDurationMs: 650,
  collisionReleaseMs: 280,
  landingRecoveryMs: 180,
  note: "H01-A为S04柴棚伪装暗板；H01-B为同世界X地下安全落脚点。调查后暗板在280ms释放碰撞、650ms完成开启动画，单向下落，回程经S07西侧永久梯井，爬出后直接看见复活锚点。",
}] as const;

export const GATE_RETURN_TRANSITIONS: readonly ConstructionReturnTransitionSpec[] = [{
  id: "R01",
  screen: 6,
  localX: 170,
  undergroundFloor: "C116",
  middlePlatform: "C117",
  surfaceCap: "C121",
  movement: "climb-ladder",
  direction: "underground-to-surface",
  camera: "layer-switch",
  bidirectional: false,
  destination: "respawn-anchor",
  note: "S07西侧永久梯井；从地下单向上爬，穿过单向井盖切回地表摄影机，出口正对复活锚点。",
}] as const;

export const ADDITIONAL_GATE_CONSTRUCTION: readonly GateConstructionSpec[] = [
  {
    id: "s03", screen: 2, name: "山门缓坡", role: "移动 / 建筑", entryY: 632, exitY: 570, entryCollider: "C19", exitCollider: "C23",
    mainPath: "M0 632H180L540 620L900 600L1260 580L1672 570", upperPaths: ["M620 500H860", "M1120 450H1340"],
    gameplayNote: "三段缓坡控制在可持续奔跑角度；排水沟只影响脚步反馈，不形成卡脚凹槽。",
    colliders: [
      floor("C19", "石涵接坡入口", 0, 632, 180, "承接跨屏雨蚀石涵道，同高进入缓坡"), floor("C20", "一级排水缓坡", 180, 620, 360, "首段轻抬升，建立坡面移动"),
      floor("C21", "二级排水缓坡", 540, 600, 360, "中段连续跑跳，无隐形台阶"), floor("C22", "三级山门缓坡", 900, 580, 360, "末段抬升并展开远景"),
      floor("C23", "竹篱口接驳地基", 1260, 570, 412, "实体地基铺至画布底部，贴齐S04入口并保留战斗前观察距离"),
      { id: "C24", name: "排水沟检修板", kind: "oneway", x: 620, y: 500, w: 240, h: 18, note: "短跳可达的安全落脚，不截断主坡" },
      { id: "C25", name: "坡顶观察石台", kind: "oneway", x: 1120, y: 450, w: 220, h: 18, note: "观察S04敌人部署的上层预览位" },
    ],
    buildings: [
      { id: "A12", name: "三段排水石阶", x0: 180, y0: 420, x1: 1260, y1: 620, material: "雨蚀青石 / 明沟", shape: "slope" },
      { id: "A13", name: "坡顶竹篱门", x0: 1260, y0: 360, x1: 1560, y1: 570, material: "竹篱 / 山门界碑", shape: "gate" },
    ], encounters: [{ x: 1080, y: 580, label: "竹影刀客 ×1", tone: "basic" }],
  },
  {
    id: "s04", screen: 3, name: "竹篱小径", role: "常规战斗", entryY: 570, exitY: 610, entryCollider: "C26", exitCollider: "C29",
    mainPath: "M0 570H720H860L1260 590V610H1672", upperPaths: ["M360 455H720", "M900 480H1210"], lowerPath: "M790 570V780H1672",
    gameplayNote: "主路形成第一次双敌战；柴棚暗板仅在近距交互后显露，下落后进入独立摄影机承载的S04–S07隐藏排水地域。",
    colliders: [
      floor("C26", "小径西口", 0, 570, 300, "承接S03坡顶并提供敌情观察；实体地基延伸至画布底部，与J03两侧完整焊接"), slab("C27", "竹径主战地板", 300, 570, 420, "两名刀客不同时在出生边缘激活；东端留出下层落口"),
      slab("C28", "柴棚回接地板", 860, 590, 400, "与西段保留140px源宽暗板区，仍低于安全助跑跨度"), slab("C29", "石狮甬道接驳", 1260, 610, 412, "贴齐S05入口并退出战斗锁"),
      { id: "C30", name: "风折竹上层台", kind: "oneway", x: 360, y: 455, w: 360, h: 18, note: "上层绕背路线" },
      { id: "C31", name: "柴棚伪装暗板", kind: "oneway", x: 720, y: 570, w: 140, h: 18, note: "默认伪装为连续地面；近距调查后播放650ms开启特效，并在280ms释放碰撞" },
      { id: "C32", name: "隐井落脚地域", kind: "solid", x: 620, y: 780, w: 600, h: 161, note: "隐藏层首个宽落脚区；净高足够完整起跳和小型遭遇", route: "underground" },
      { id: "C33", name: "供奉龛检修台", kind: "oneway", x: 1210, y: 650, w: 260, h: 18, note: "移至右侧供奉龛下方，以墙体石托臂承重；地面罐子上方保持完整净空", route: "underground" },
      { ...floor("C102", "柴棚地穴东口", 1220, 780, 452, "地下隐藏地域贴齐S05西侧排水道"), route: "underground" },
      { id: "C114", name: "隐井西侧洞顶", kind: "solid", x: 620, y: 420, w: 100, h: 48, note: "暗板竖井左侧洞顶，阻止穿出地下画布", route: "underground" },
      { id: "C115", name: "隐井东侧洞顶", kind: "solid", x: 860, y: 420, w: 812, h: 48, note: "保留140px竖井开口，其余洞顶形成明确地下边界", route: "underground" },
    ],
    buildings: [
      { id: "A14", name: "风折竹门", x0: 40, y0: 350, x1: 330, y1: 570, material: "折竹 / 低篱", shape: "gate" },
      { id: "A15", name: "塌陷柴棚", x0: 820, y0: 420, x1: 1240, y1: 780, material: "腐木 / 草顶", shape: "shed" },
      { id: "A16", name: "隐井材料侧室", x0: 620, y0: 430, x1: 1220, y1: 780, material: "湿木架 / 布罩 / 暗龛", shape: "shed", route: "underground" },
      { id: "A41", name: "柴棚地穴出口", x0: 1220, y0: 430, x1: 1672, y1: 780, material: "岩洞 / 排水砖 / 拱形顶梁", shape: "corridor", route: "underground" },
    ], encounters: [{ x: 520, y: 570, label: "竹影刀客 A", tone: "basic" }, { x: 1040, y: 610, label: "竹影刀客 B", tone: "basic" }],
  },
  {
    id: "s05", screen: 4, name: "石狮甬道", role: "常规战斗", entryY: 610, exitY: 600, entryCollider: "C34", exitCollider: "C38",
    mainPath: "M0 610H1672", upperPaths: ["M520 475H790", "M1050 445H1360"], lowerPath: "M0 780H1672",
    gameplayNote: "地表三重门框保留完整弩线预警；隐藏层独立绘制为一整屏宽的排水地域，包含上下落脚、暗龛和完整跳跃净空。",
    colliders: [
      slab("C34", "甬道西口", 0, 610, 260, "承接竹篱小径；下方为连续排水道"), slab("C35", "第一门洞结构板", 260, 610, 400, "石狮后安全区与涵洞顶板"),
      slab("C36", "第二门洞结构板", 660, 610, 420, "近战与弩线交汇区，下方保持净空"), slab("C37", "第三门洞结构板", 1080, 600, 340, "离开交火区前的小抬升"),
      slab("C38", "雨廊接驳结构板", 1420, 600, 252, "贴齐S06入口并保持地下通道净空"),
      { id: "C39", name: "西门楼射台", kind: "oneway", x: 520, y: 475, w: 270, h: 18, note: "可反击弩手的中层台" },
      { id: "C40", name: "东门楼弩台", kind: "oneway", x: 1050, y: 445, w: 310, h: 18, note: "屋脊弩手部署位" },
      { ...floor("C103", "排水道西接驳", 0, 780, 400, "承接S04隐藏地域，保持同高"), route: "underground" },
      { ...floor("C104", "石狮地下排水地域", 400, 780, 800, "完整一屏宽探索区；允许奔跑、起跳与小型战斗"), route: "underground" },
      { ...floor("C105", "排水道东接驳", 1200, 780, 472, "贴齐S06涵洞西口"), route: "underground" },
      { id: "C109", name: "排水地域洞顶", kind: "solid", x: 0, y: 420, w: 1672, h: 48, note: "洞顶与地面美术完全分层；地板至洞顶净空312px源尺寸", route: "underground" },
      { id: "C110", name: "西侧检修台", kind: "oneway", x: 470, y: 650, w: 260, h: 18, note: "第一段完整跳跃落脚", route: "underground" },
      { id: "C111", name: "东侧暗龛台", kind: "oneway", x: 980, y: 620, w: 240, h: 18, note: "隐藏奖励与绕背位置", route: "underground" },
    ],
    buildings: [
      { id: "A17", name: "西侧残石狮门", x0: 160, y0: 360, x1: 500, y1: 610, material: "残石狮 / 青砖门框", shape: "gate" },
      { id: "A18", name: "中段题刻门", x0: 620, y0: 300, x1: 1010, y1: 610, material: "山门题刻 / 断匾", shape: "gate" },
      { id: "A19", name: "东侧弩手门楼", x0: 1050, y0: 280, x1: 1400, y1: 600, material: "灰瓦 / 射孔", shape: "tower" },
      { id: "A42", name: "石狮地下排水地域", x0: 0, y0: 420, x1: 1672, y1: 780, material: "拱券青砖 / 排水沟 / 检修孔 / 暗龛", shape: "corridor", route: "underground" },
    ], encounters: [{ x: 760, y: 610, label: "竹影刀客 ×1", tone: "basic" }, { x: 1200, y: 445, label: "屋脊弩手 ×1", tone: "range" }, { x: 820, y: 780, label: "隐藏层守卫 ×1", tone: "elite", route: "underground" }],
  },
  {
    id: "s06", screen: 5, name: "雨廊石阶", role: "移动 / 建筑", entryY: 600, exitY: 590, entryCollider: "C42", exitCollider: "C46",
    mainPath: "M0 600H420L720 590H1672", upperPaths: ["M300 420H1320"], lowerPath: "M0 780H1672",
    gameplayNote: "长雨廊承担室外到建筑群的过渡；隐藏层保持完整跳跃净空并向东穿过U03，进入S07西侧永久梯井。",
    colliders: [
      slab("C42", "雨廊西阶结构板", 0, 600, 300, "承接石狮甬道；下方接续涵洞"), slab("C43", "长雨廊主结构板", 300, 600, 520, "廊柱不进入实际碰撞，地下保持净空"),
      slab("C44", "檐水石槽结构板", 820, 590, 400, "瀑布式檐水通过处"), slab("C45", "雨廊东端检修地板", 1220, 590, 220, "地表保持连续；永久回程出口已迁至S07西侧安全坪"),
      slab("C46", "演武坪接驳结构板", 1440, 590, 232, "贴齐S07入口"),
      { id: "C47", name: "雨廊屋檐射台", kind: "oneway", x: 300, y: 420, w: 1020, h: 18, note: "弩手巡逻与观察平台" },
      { id: "C48", name: "排水涵洞地板", kind: "solid", x: 340, y: 780, w: 840, h: 161, note: "隐藏地域向东延伸，保持完整奔跑空间", route: "underground" },
      { id: "C49", name: "涵洞东段检修台", kind: "oneway", x: 1230, y: 690, w: 180, h: 18, note: "通往S07回程梯前的地下落脚", route: "underground" },
      { ...floor("C106", "涵洞西接驳", 0, 780, 340, "承接S05地下排水道，保持同高"), route: "underground" },
      { ...floor("C107", "涵洞东接驳", 1180, 780, 492, "地下通道贴齐S07西侧回程支路，形成U03连续接缝"), route: "underground" },
      { id: "C112", name: "雨廊地下洞顶", kind: "solid", x: 0, y: 420, w: 1672, h: 48, note: "保证312px源尺寸净空并封闭S06顶面；上行出口位于S07", route: "underground" },
      { id: "C113", name: "涵洞东段起跳台", kind: "oneway", x: 1040, y: 650, w: 180, h: 18, note: "地下东段的节奏落脚，不再承担回到地表的功能", route: "underground" },
    ],
    buildings: [
      { id: "A20", name: "长雨廊", x0: 180, y0: 330, x1: 1360, y1: 600, material: "深檐 / 木柱 / 檐水帘", shape: "corridor" },
      { id: "A21", name: "悬钟架", x0: 720, y0: 360, x1: 940, y1: 590, material: "铜钟 / 湿绳", shape: "pavilion" },
      { id: "A22", name: "涵洞东段木支架", x0: 1180, y0: 420, x1: 1440, y1: 780, material: "湿木支架 / 排水涵洞", shape: "bridge", route: "underground" },
      { id: "A43", name: "涵洞连续地域", x0: 0, y0: 420, x1: 1672, y1: 780, material: "拱券青砖 / 湿苔 / 排水槽", shape: "corridor", route: "underground" },
      { id: "A44", name: "雨廊东端值房门", x0: 1220, y0: 500, x1: 1420, y1: 590, material: "闭合木门 / 普通值房入口", shape: "gate" },
    ], encounters: [{ x: 980, y: 420, label: "屋脊弩手 ×1", tone: "range" }],
  },
  {
    id: "s07", screen: 6, name: "演武坪", role: "安全 / 叙事", entryY: 590, exitY: 300, entryCollider: "C50", exitCollider: "C54",
    mainPath: "M0 590H100H240H520L760 520L1030 440L1320 350L1540 300H1672", lowerPath: "M0 780H170V590",
    gameplayNote: "地下支路从西侧U03进入永久梯井，在X100–240的单向井盖下攀回地表；出口面向X420复活锚点。后半屏以四段折返山阶持续登高。",
    colliders: [
      slab("C50", "演武坪西口", 0, 590, 100, "承接S06雨廊结构板；进入安全坪后立即看见回程梯井与复活锚点"), floor("C51", "折返石阶一段", 520, 520, 240, "第一段抬升"),
      floor("C52", "折返石阶二段", 760, 440, 270, "第二段抬升"), floor("C53", "折返石阶三段", 1030, 350, 290, "第三段抬升"),
      floor("C54", "校场齐平接驳", 1320, 300, 352, "降低末级高差，与S08校场主地面保持齐平"),
      { ...slab("C116", "演武坪地下西接驳", 0, 780, 320, "承接S06涵洞东口并通向永久梯井", 161), route: "underground" },
      { id: "C117", name: "永久梯井中段踏板", kind: "oneway", x: 100, y: 680, w: 140, h: 18, note: "梯井中段安全复位踏板", route: "underground" },
      { id: "C118", name: "演武坪地下西洞顶", kind: "solid", x: 0, y: 420, w: 100, h: 48, note: "梯井左侧封闭洞顶", route: "underground" },
      { id: "C119", name: "演武坪地下东洞顶", kind: "solid", x: 240, y: 420, w: 280, h: 48, note: "梯井右侧封闭洞顶并形成140px上行井道", route: "underground" },
      { id: "C122", name: "回程廊东侧封闭墙", kind: "boundary", x: 320, y: 468, w: 24, h: 312, note: "阻止玩家越过回程梯井进入未施工地下空间", route: "underground" },
      slab("C120", "复活坪连续地板", 240, 590, 280, "梯井东缘至折返石阶之间的安全地面"),
      { id: "C121", name: "永久梯井单向井盖", kind: "oneway", x: 100, y: 590, w: 140, h: 18, note: "允许玩家从下方爬出并在地表站立；出口正对复活锚点" },
    ],
    buildings: [
      { id: "A23", name: "演武坪武器架", x0: 260, y0: 430, x1: 520, y1: 590, material: "武器架 / 练功木人", shape: "shed" },
      { id: "A24", name: "高地折返石阶", x0: 520, y0: 120, x1: 1420, y1: 590, material: "连续青石阶 / 雨蚀护栏 / 实体挡土墙；禁止空洞、断柱和悬空栈台", shape: "slope" },
      { id: "A45", name: "演武坪地下回程廊", x0: 0, y0: 420, x1: 320, y1: 780, material: "排水青砖 / 湿苔 / 梯井基座", shape: "corridor", route: "underground" },
      { id: "A46", name: "S07永久回程梯井", x0: 100, y0: 420, x1: 240, y1: 780, material: "石砌井壁 / 木梯 / 单向井盖", shape: "bridge", route: "underground" },
      { id: "A47", name: "复活坪梯井出口", x0: 80, y0: 518, x1: 260, y1: 590, material: "雨蚀青石井沿 / 暗井 / 湿木梯", shape: "gate" },
    ], encounters: [{ x: 420, y: 590, label: "复活锚点", tone: "safe" }, { x: 900, y: 440, label: "竹影刀客 ×1（巡逻）", tone: "basic" }],
  },
  {
    id: "s08", screen: 7, name: "守门校场", role: "精英 / 能力", entryY: 300, exitY: 260, entryCollider: "C58", exitCollider: "C63",
    mainPath: "M0 300H1220L1440 280L1672 260", upperPaths: ["M280 170H1390"],
    gameplayNote: "校场整体位于高地平台；全屏封锁只在战斗中启用，获瞬步后从东门保持高程进入S09下山箭廊。",
    colliders: [
      floor("C58", "校场西侧齐平入口", 0, 300, 240, "与S07末段及校场主战平面完全齐平"), floor("C59", "校场西侧平地", 240, 300, 180, "入口不再设置额外落差"),
      floor("C60", "高地校场主战地板", 420, 300, 800, "完整精英战空间，禁止中央障碍"), floor("C61", "校场东侧缓阶", 1220, 280, 220, "战后回到高地出口"),
      floor("C62", "高地东门缓冲", 1440, 260, 120, "开门后的安全缓冲"), floor("C63", "下山箭廊接驳", 1560, 260, 112, "保持高程进入S09，再由箭廊逐段下山"),
      { id: "C64", name: "校场观战檐", kind: "oneway", x: 280, y: 170, w: 1110, h: 18, note: "高地上层观战轮廓，不允许敌人落入" },
      { id: "C65", name: "西侧Boss战封门", kind: "boundary", x: 250, y: 70, w: 24, h: 230, note: "默认无碰撞；Boss战开始启用，击杀Boss后解除", activation: { initial: "disabled", enableOn: "boss-combat-start", disableOn: "boss-defeated", encounter: "s08-gate-boss" } },
      { id: "C66", name: "东侧Boss战封门", kind: "boundary", x: 1410, y: 60, w: 24, h: 220, note: "默认无碰撞；Boss战开始启用，击杀Boss后解除", activation: { initial: "disabled", enableOn: "boss-combat-start", disableOn: "boss-defeated", encounter: "s08-gate-boss" } },
    ],
    buildings: [
      { id: "A26", name: "高地校场西门楼", x0: 20, y0: 40, x1: 300, y1: 260, material: "旗门 / 铜钉木门 / 山壁基座", shape: "gate" },
      { id: "A27", name: "守门高地校场旗阵", x0: 320, y0: 70, x1: 1360, y1: 300, material: "战旗 / 铜钟 / 高地排水砖", shape: "arena" },
      { id: "A28", name: "高地校场东门楼", x0: 1390, y0: 40, x1: 1660, y1: 260, material: "开启式闸门 / 能力刻印 / 下山门", shape: "tower" },
    ], encounters: [{ x: 680, y: 300, label: "W1 刀客 ×2", tone: "wave" }, { x: 1030, y: 300, label: "W2 赤枪校尉", tone: "elite" }, { x: 1320, y: 280, label: "获得：瞬步", tone: "system" }],
  },
  {
    id: "s09", screen: 8, name: "雨亭箭廊", role: "能力验证", entryY: 260, exitY: 600, entryCollider: "C67", exitCollider: "C71",
    mainPath: "M0 260L260 360H680L720 470H1100L1180 560H1460L1672 600", upperPaths: ["M260 160H500", "M720 270H960", "M1180 380H1420"],
    gameplayNote: "从S08高地出门后立即沿连续斜面下山，不设置入口台阶；三座雨亭同时提供弩线掩体和安全落脚，最终回到前庭常规高程。",
    colliders: [
      slopeFloor("C67", "箭廊入口连续下坡", 0, 260, 360, 260, "承接S08高地东门并立即下坡；取消入口水平台阶"), floor("C68", "第一下山箭线地板", 260, 360, 420, "承接入口斜面并验证瞬步"),
      floor("C69", "第二下山箭线地板", 680, 470, 420, "第二段下降并增加交错射线"), floor("C70", "第三下山箭线地板", 1100, 560, 360, "最后一段回到前庭高程"),
      floor("C71", "前庭接驳地板", 1460, 600, 212, "贴齐S10入口"),
      { id: "C72", name: "高地西雨亭屋面", kind: "oneway", x: 260, y: 160, w: 240, h: 18, note: "第一弩手平台" },
      { id: "C73", name: "山腰中雨亭屋面", kind: "oneway", x: 720, y: 270, w: 240, h: 18, note: "第二弩手平台" },
      { id: "C74", name: "山脚东雨亭屋面", kind: "oneway", x: 1180, y: 380, w: 240, h: 18, note: "第三弩手平台" },
      { id: "C75", name: "箭廊防坠底板", kind: "solid", x: 180, y: 760, w: 1320, h: 181, note: "跌落后回到安全梯，不进入死亡区" },
    ],
    buildings: [
      { id: "A29", name: "高地西雨亭", x0: 220, y0: 80, x1: 520, y1: 360, material: "青瓦亭 / 高地石墙", shape: "pavilion" },
      { id: "A30", name: "山腰中雨亭", x0: 680, y0: 190, x1: 1000, y1: 470, material: "长檐 / 箭痕柱 / 山阶", shape: "pavilion" },
      { id: "A31", name: "山脚东雨亭", x0: 1140, y0: 300, x1: 1460, y1: 600, material: "破瓦 / 前庭远景", shape: "pavilion" },
    ], encounters: [{ x: 380, y: 160, label: "弩手 1", tone: "range" }, { x: 840, y: 270, label: "弩手 2", tone: "range" }, { x: 1300, y: 380, label: "弩手 3", tone: "range" }],
  },
  {
    id: "s10", screen: 9, name: "山门前庭", role: "常规战斗", entryY: 600, exitY: 590, entryCollider: "C76", exitCollider: "C80",
    mainPath: "M0 600H1672", upperPaths: ["M220 470H500", "M1170 455H1460"],
    gameplayNote: "积水只占中央三分之一并降低移速；两侧干地保证玩家不会同时被近战、弩线和减速锁死。",
    colliders: [
      floor("C76", "前庭西口", 0, 600, 300, "承接箭廊"), floor("C77", "西侧干地", 300, 600, 360, "近战绕背区"),
      floor("C78", "中央积水基底", 660, 610, 420, "浅水减速但不改变角色落脚高度"), floor("C79", "东侧干地", 1080, 590, 360, "通向闸口的安全线"),
      floor("C80", "城楼接驳地板", 1440, 590, 232, "贴齐S11入口"),
      { id: "C81", name: "西碑亭屋面", kind: "oneway", x: 220, y: 470, w: 280, h: 18, note: "躲避弩线的上层选择" },
      { id: "C82", name: "东碑亭屋面", kind: "oneway", x: 1170, y: 455, w: 290, h: 18, note: "出口侧弩手平台" },
      { id: "C83", name: "积水西沿", kind: "oneway", x: 620, y: 585, w: 70, h: 12, note: "浅水边缘视觉台阶，不阻挡移动" },
      { id: "C84", name: "积水东沿", kind: "oneway", x: 1050, y: 575, w: 70, h: 12, note: "离开减速区的清晰边缘" },
    ],
    buildings: [
      { id: "A32", name: "西碑亭", x0: 180, y0: 390, x1: 540, y1: 600, material: "断碑 / 雨亭", shape: "pavilion" },
      { id: "A33", name: "中央积水庭院", x0: 620, y0: 570, x1: 1120, y1: 650, material: "浅水 / 青砖倒影", shape: "water" },
      { id: "A34", name: "东碑亭", x0: 1130, y0: 380, x1: 1490, y1: 590, material: "完整碑亭 / 闸门前景", shape: "pavilion" },
    ], encounters: [{ x: 470, y: 600, label: "刀客 A", tone: "basic" }, { x: 900, y: 610, label: "刀客 B", tone: "basic" }, { x: 1310, y: 455, label: "弩手", tone: "range" }],
  },
  {
    id: "s11", screen: 10, name: "城楼闸口", role: "常规战斗", entryY: 590, exitY: 620, entryCollider: "C85", exitCollider: "C90",
    mainPath: "M0 590H1320L1480 620H1672", upperPaths: ["M260 390H720", "M960 370H1420"],
    gameplayNote: "盾卫Boss战保留两侧绕背空间；C93战前无碰撞、开战时封闭、击杀后解除。绞盘仅负责铜门开启动画，不再控制通行碰撞。",
    colliders: [
      floor("C85", "城楼西口", 0, 590, 260, "承接前庭"), floor("C86", "盾卫战西地板", 260, 590, 430, "西侧绕背空间"),
      floor("C87", "闸机中央地板", 690, 590, 360, "绞盘安全操作区"), floor("C88", "盾卫战东地板", 1050, 590, 270, "东侧破盾空间"),
      floor("C89", "铜门下坡", 1320, 620, 180, "闸门开启后的下行"), floor("C90", "驿道接驳地板", 1500, 620, 172, "贴齐S12入口"),
      { id: "C91", name: "西城楼二层", kind: "oneway", x: 260, y: 390, w: 460, h: 18, note: "观察与绕行平台" },
      { id: "C92", name: "东城楼弩台", kind: "oneway", x: 960, y: 370, w: 460, h: 18, note: "屋脊弩手站位" },
      { id: "C93", name: "城楼Boss战封门", kind: "boundary", x: 1450, y: 280, w: 30, h: 340, note: "默认无碰撞；Boss战开始启用，击杀Boss后解除", activation: { initial: "disabled", enableOn: "boss-combat-start", disableOn: "boss-defeated", encounter: "s11-gate-boss" } },
      { id: "C94", name: "绞盘基座", kind: "solid", x: 770, y: 500, w: 180, h: 90, note: "机关轮廓实体，不形成死角" },
    ],
    buildings: [
      { id: "A35", name: "西侧双层城楼", x0: 120, y0: 230, x1: 720, y1: 590, material: "青砖 / 射孔 / 木楼", shape: "tower" },
      { id: "A36", name: "中央巨型绞盘", x0: 700, y0: 360, x1: 1040, y1: 590, material: "铜轴 / 铁链 / 操作台", shape: "arena" },
      { id: "A37", name: "雨蚀铜门城楼", x0: 960, y0: 200, x1: 1500, y1: 620, material: "铜门 / 闸槽 / 城楼檐", shape: "tower" },
    ], encounters: [{ x: 720, y: 590, label: "铁甲盾卫 Boss", tone: "elite" }, { x: 1200, y: 370, label: "屋脊弩手", tone: "range" }, { x: 860, y: 500, label: "绞盘开门演出", tone: "system" }],
  },
  {
    id: "s12", screen: 11, name: "山门驿道", role: "区域过渡", entryY: 620, exitY: 650, entryCollider: "C95", exitCollider: "C99",
    mainPath: "M0 620L360 625L760 635L1180 645L1672 650", upperPaths: ["M420 500H760"],
    gameplayNote: "全屏不封锁；驿棚遮挡承担旧区卸载，青砖比例和悬灯密度由西向东平滑增加。",
    colliders: [
      floor("C95", "驿道西口", 0, 620, 300, "承接雨蚀铜门"), floor("C96", "湿岩驿道", 300, 625, 380, "湿岩与青砖混合段"),
      floor("C97", "驿棚遮挡地板", 680, 635, 420, "流送遮挡主段，不改变速度"), floor("C98", "青砖旧道", 1100, 645, 360, "旧城材质占主导"),
      floor("C99", "旧城连续出口", 1460, 650, 212, "无切场进入悬灯旧城过渡带"),
      { id: "C100", name: "驿棚屋面", kind: "oneway", x: 420, y: 500, w: 340, h: 18, note: "可选观察位，不放置封锁敌人" },
    ],
    buildings: [
      { id: "A38", name: "山门驿棚", x0: 360, y0: 410, x1: 820, y1: 635, material: "湿木棚 / 行囊架", shape: "shed" },
      { id: "A39", name: "流送遮挡门洞", x0: 760, y0: 330, x1: 1120, y1: 645, material: "布幔 / 车架 / 门洞", shape: "gate" },
      { id: "A40", name: "旧城悬灯廊", x0: 1100, y0: 390, x1: 1650, y1: 650, material: "青砖 / 第一盏悬灯", shape: "corridor" },
    ], encounters: [{ x: 1320, y: 500, label: "远处城防剪影", tone: "safe" }, { x: 980, y: 600, label: "STREAMING", tone: "system" }],
  },
] as const;
