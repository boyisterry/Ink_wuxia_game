"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import {
  ENEMY_META,
  ENEMY_ORDER,
  ENEMY_TIER_LABEL,
  type EnemyId,
  type EnemyTier,
} from "./enemies";
import "./map.css";

type MarkerKind =
  | "shrine"
  | "mechanism"
  | "breakable"
  | "oneway"
  | "lift"
  | "underwater"
  | "portal"
  | "ability";

type Zone = {
  id: string;
  index: string;
  name: string;
  subtitle: string;
  alias: string;
  color: string;
  x: number;
  width: number;
  ability: string;
  /** 该区能力的实际获取点 */
  unlockAt: string;
  /** 区域首领；无首领时写明精英压轴 */
  boss: string;
  loop: string;
};

type EncounterUnit = {
  enemy: EnemyId;
  count: number;
  position: "地面" | "高台" | "空中" | "墙顶" | "水中层" | "水底" | "首领位";
};

type EncounterWave = {
  wave: number;
  trigger: string;
  units: EncounterUnit[];
};

type EncounterPlan = {
  lock: boolean;
  respawn: "重进刷新" | "神龛刷新" | "首次清除后不刷新";
  budget: number;
  intent: string;
  waves: EncounterWave[];
};

type ProgressionId =
  | "instant_step"
  | "cross_slash"
  | "ground_slam"
  | "breath_control"
  | "water_talisman"
  | "lantern_seal"
  | "iron_seal"
  | "forest_seal"
  | "water_memento"
  | "return_portal";

const PROGRESSION_LABELS: Record<ProgressionId, string> = {
  instant_step: "瞬步",
  cross_slash: "十字斩",
  ground_slam: "震地击",
  breath_control: "闭息诀",
  water_talisman: "水行符",
  lantern_seal: "悬灯印",
  iron_seal: "赤铁印",
  forest_seal: "幽林印",
  water_memento: "水镜信物",
  return_portal: "归途传送权限",
};

type ProgressionKind = "technique" | "ability" | "seal" | "access";

const PROGRESSION_KINDS: Record<ProgressionId, ProgressionKind> = {
  instant_step: "technique",
  cross_slash: "technique",
  ground_slam: "ability",
  breath_control: "ability",
  water_talisman: "ability",
  lantern_seal: "seal",
  iron_seal: "seal",
  forest_seal: "seal",
  water_memento: "seal",
  return_portal: "access",
};

const PROGRESSION_KIND_LABELS: Record<ProgressionKind, string> = {
  technique: "战斗招式",
  ability: "环境能力",
  seal: "剧情凭证",
  access: "通关权限",
};

type Room = {
  id: string;
  zone: string;
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  kind: "room" | "arena" | "save" | "secret" | "boss" | "hub";
  enemies?: EnemyId[];
  /** 进入该节点所需的能力或关键道具 */
  requires?: ProgressionId[];
  /** 进出逻辑说明（防软锁 / 回程） */
  note?: string;
  /** 进入方式（可读性摘要） */
  enter?: string;
  /** 离开 / 回程方式 */
  exit?: string;
  /** 首次通关该节点后授予的能力或门印 */
  grants?: ProgressionId[];
  /** 在此节点重点验证、但不作为硬门槛的招式或能力 */
  tests?: ProgressionId[];
  /** 关键战斗节点的数量、波次、触发与站位草案 */
  encounter?: EncounterPlan;
};

type Marker = {
  id: string;
  kind: MarkerKind;
  x: number;
  y: number;
  label: string;
  zone: string;
};

const MAP_W = 10100;
const MAP_H = 1520;
/** Combat-controller measurements in rendered pixels. */
const PLAYER_METRICS_PX = {
  height: 96,
  jumpHeight: 170,
  runJumpWidth: 240,
  ladderGrab: 24,
  safeFall: 260,
} as const;

/** Combat prototype stage art / max playable camera (px). */
const GAME_STAGE_PX = { w: 1672, h: 941 } as const;
/**
 * Map language: one room node ≈ one playable screen.
 * At "game scene" zoom, this width fills the combat stage width.
 */
const GAME_SCREEN_UNITS = {
  w: 180,
  h: Math.round((180 * GAME_STAGE_PX.h) / GAME_STAGE_PX.w),
} as const;

const GAME_PX_PER_UNIT = GAME_STAGE_PX.w / GAME_SCREEN_UNITS.w;
const pxToMapUnits = (pixels: number) =>
  Number((pixels / GAME_PX_PER_UNIT).toFixed(1));
const PLAYER_METRICS = {
  height: pxToMapUnits(PLAYER_METRICS_PX.height),
  jumpHeight: pxToMapUnits(PLAYER_METRICS_PX.jumpHeight),
  runJumpWidth: pxToMapUnits(PLAYER_METRICS_PX.runJumpWidth),
  ladderGrab: pxToMapUnits(PLAYER_METRICS_PX.ladderGrab),
  safeFall: pxToMapUnits(PLAYER_METRICS_PX.safeFall),
} as const;

type ZoomMode = "design" | "game";

const ZOOM_DESIGN = 1;
const ZOOM_GAME = Number(GAME_PX_PER_UNIT.toFixed(2)); // ~9.29 px/u
const ZOOM_MIN = 0.38;
const ZOOM_MAX = Math.max(1.15, ZOOM_GAME);

const ZONES: Zone[] = [
  { id: "gate", index: "01", name: "雨蚀山门", subtitle: "教学 · 起点", alias: "竹雾村缘", color: "#6e8f7c", x: 40, width: 1550, ability: "瞬步", unlockAt: "守门校场精英战", boss: "无 · 精英赤枪校尉", loop: "主廊教授移动、翻滚与基础剑式；校场习得瞬步，随后以雨亭箭线完成低风险验证。" },
  { id: "town", index: "02", name: "悬灯旧城", subtitle: "枢纽 · 精英", alias: "灯市", color: "#c18b52", x: 1480, width: 1600, ability: "十字斩 · 悬灯印", unlockAt: "旧钟楼精英战", boss: "无 · 精英掌灯使", loop: "街巷、屋脊与暗渠构成三层枢纽；旧钟楼学习十字斩并取得悬灯印，开启东闸与后续回溯。" },
  { id: "mine", index: "03", name: "赤铁矿脉", subtitle: "纵深 · 区 Boss", alias: "剑冢牢", color: "#a95845", x: 2920, width: 1380, ability: "震地击", unlockAt: "剑冢牢底首领", boss: "剑冢狱主", loop: "墨腹蛛与链狱卒把守竖井；熔炉盾卫加压；深处剑冢狱主为第一章区 Boss。" },
  { id: "forest", index: "04", name: "孢子幽林", subtitle: "迷宫 · 区 Boss", alias: "黑松林", color: "#738f4c", x: 4280, width: 1600, ability: "闭息诀", unlockAt: "孢囊温室精英战", boss: "黑松魇兽", loop: "树庭分岔形成树冠高路与根谷低路，两路从不同侧进入温室；取得闭息诀后再开启毒雾外环。" },
  { id: "cliff", index: "05", name: "断云天险", subtitle: "攀爬 · 精英", alias: "悬寺", color: "#6087a6", x: 5720, width: 1500, ability: "瞬步 · 十字斩精炼", unlockAt: "试剑峰综合试炼", boss: "无 · 精英赤枪校尉", loop: "横风长桥是快速高风险路线，背风石窟是慢速安全路线；升风与阵风继续改变上攀方式和战斗站位。" },
  { id: "palace", index: "06", name: "沉水行宫", subtitle: "水域 · 精英", alias: "黑松湖", color: "#507f8d", x: 7100, width: 1550, ability: "水行符", unlockAt: "倒影宴厅精英战", boss: "无 · 精英湖中墨姬", loop: "高水位只开放柱顶主廊；宴厅取得水行符并降水后，闸房、检修廊、回水梯与祭坛升流组成新的下层回环。" },
  { id: "peak", index: "07", name: "无明绝顶", subtitle: "终局 · 区 Boss", alias: "无相殿", color: "#786786", x: 8500, width: 1500, ability: "三印 · 水镜汇合", unlockAt: "悬灯 / 赤铁 / 幽林三印与水镜信物", boss: "无相殿主", loop: "登顶路线三次折返并在碑林高台受控回落；望台开启永久云梯回接第一折，终局前形成短回程。" },
];

const ROOMS: Room[] = [
  // 01 gate — 竹影刀客教学 + 赤枪校尉精英
  { id: "g1", zone: "gate", name: "破庙", x: 80, y: 700, w: 150, h: 110, kind: "save" },
  { id: "g2", zone: "gate", name: "山门缓坡", x: 270, y: 690, w: 170, h: 120, kind: "room", enemies: ["bamboo_blade"] },
  { id: "g7", zone: "gate", name: "竹篱小径", x: 460, y: 685, w: 170, h: 120, kind: "room", enemies: ["bamboo_blade"] },
  { id: "g8", zone: "gate", name: "石狮甬道", x: 650, y: 680, w: 170, h: 120, kind: "room", enemies: ["bamboo_blade", "rooftop_bow"] },
  { id: "g3", zone: "gate", name: "雨廊石阶", x: 840, y: 675, w: 180, h: 130, kind: "room", enemies: ["bamboo_blade", "rooftop_bow"] },
  { id: "g9", zone: "gate", name: "演武坪", x: 1040, y: 670, w: 170, h: 120, kind: "room", enemies: ["bamboo_blade"] },
  { id: "g10", zone: "gate", name: "雨亭箭廊", x: 1230, y: 665, w: 160, h: 115, kind: "room", enemies: ["rooftop_bow"], requires: ["instant_step"], tests: ["instant_step"], enter: "校场习得瞬步后穿越连续箭线", exit: "东接山门闸口", note: "低伤害、长预警的瞬步教学；失败只退回雨廊，不坠落" },
  { id: "g6", zone: "gate", name: "山门闸口", x: 1410, y: 660, w: 140, h: 120, kind: "room", enemies: ["iron_shield", "rooftop_bow"] },
  { id: "g4", zone: "gate", name: "守门校场", x: 980, y: 430, w: 170, h: 140, kind: "arena", enemies: ["scarlet_captain", "bamboo_blade"], enter: "演武坪上行", exit: "战后回主廊并开放雨亭箭廊", grants: ["instant_step"], note: "先处理刀客，再以枪尖预警学习瞬步；通关取得第一项战斗招式", encounter: { lock: true, respawn: "首次清除后不刷新", budget: 6, intent: "用单一近战压力教学瞬步穿身、取消后摇与脱离长枪攻击线。", waves: [{ wave: 1, trigger: "踏入校场", units: [{ enemy: "bamboo_blade", count: 2, position: "地面" }] }, { wave: 2, trigger: "刀客清除", units: [{ enemy: "scarlet_captain", count: 1, position: "首领位" }] }] } },
  { id: "g5", zone: "gate", name: "崖下柴棚", x: 480, y: 930, w: 180, h: 110, kind: "secret", enemies: ["bamboo_blade"], enter: "竹篱小径单向落入", exit: "不可原路；东穿崖道回廊", note: "自竹篱小径单向落入；不可原路爬回" },
  { id: "g11", zone: "gate", name: "崖道回廊", x: 720, y: 930, w: 200, h: 110, kind: "secret", enemies: ["bamboo_blade"], enter: "自崖下柴棚横穿", exit: "东端木梯 → 雨廊石阶", note: "地下横穿后，东端木梯回主廊雨廊石阶" },

  // 02 town — 屋顶弩手 / 暗渠蛛 / 钟楼掌灯使精英
  { id: "t1", zone: "town", name: "长街驿站", x: 1580, y: 660, w: 180, h: 140, kind: "hub" },
  { id: "t8", zone: "town", name: "茶摊巷口", x: 1780, y: 655, w: 170, h: 125, kind: "room", enemies: ["bamboo_blade"] },
  { id: "t2", zone: "town", name: "灯市西廊", x: 1970, y: 650, w: 170, h: 130, kind: "room", enemies: ["bamboo_blade", "rooftop_bow"] },
  { id: "t9", zone: "town", name: "灯市中市", x: 2160, y: 645, w: 180, h: 130, kind: "room", enemies: ["rooftop_bow"] },
  { id: "t3", zone: "town", name: "灯市东巷", x: 2360, y: 640, w: 170, h: 135, kind: "room", enemies: ["bamboo_blade", "rooftop_bow"] },
  { id: "t10", zone: "town", name: "戏台广场", x: 2550, y: 635, w: 180, h: 130, kind: "room", enemies: ["iron_shield", "bamboo_blade"] },
  { id: "t11", zone: "town", name: "城东印闸", x: 2750, y: 630, w: 160, h: 125, kind: "room", enemies: ["iron_shield", "rooftop_bow"], requires: ["lantern_seal"], tests: ["cross_slash"], enter: "旧钟楼悬灯印开启城闸", exit: "东出赤铁矿脉", note: "用盾卫验证十字斩破势；印闸只验证区域完成度，不消耗门印" },
  { id: "t7", zone: "town", name: "商会阁楼", x: 1760, y: 400, w: 150, h: 110, kind: "room", enemies: ["lantern_mage", "rooftop_bow"], enter: "茶摊巷口木梯上行", exit: "原梯回长街", note: "屋顶层补给/远程压制房；木梯直达，无需特殊能力" },
  { id: "t4", zone: "town", name: "灯市屋脊", x: 2100, y: 360, w: 200, h: 120, kind: "room", enemies: ["rooftop_bow", "ink_crow"], enter: "灯市中市木梯上行", exit: "原梯回主街或东连钟楼", note: "屋脊弩手与墨鸦练走位；木梯可达" },
  { id: "t5", zone: "town", name: "旧钟楼", x: 2580, y: 250, w: 170, h: 250, kind: "arena", enemies: ["lantern_adept", "bamboo_blade", "rooftop_bow"], enter: "灯市长街 / 屋脊汇入", exit: "战后开放屋顶通路与城东印闸", grants: ["cross_slash", "lantern_seal"], note: "跟班先行、掌灯使后登场；识破真假灯后习得十字斩并取得悬灯印", encounter: { lock: true, respawn: "首次清除后不刷新", budget: 8, intent: "第一波用瞬步处理高低差火力；第二波以真假灯破绽教学十字斩的交叉命中与破势。", waves: [{ wave: 1, trigger: "踏入钟楼并落闸", units: [{ enemy: "bamboo_blade", count: 2, position: "地面" }, { enemy: "rooftop_bow", count: 1, position: "高台" }] }, { wave: 2, trigger: "第一波清除", units: [{ enemy: "lantern_adept", count: 1, position: "首领位" }] }] } },
  { id: "t6", zone: "town", name: "下城暗渠", x: 2180, y: 980, w: 220, h: 120, kind: "secret", enemies: ["ink_spider"], requires: ["ground_slam"], enter: "灯市中市脆地单向坠入", exit: "不可原路；东穿暗渠东段", note: "自灯市中市脆地单向坠入；需震地击开启，不可原路爬回" },
  { id: "t12", zone: "town", name: "暗渠东段", x: 2460, y: 980, w: 220, h: 120, kind: "secret", enemies: ["ink_spider", "bamboo_blade"], enter: "自下城暗渠横穿", exit: "回程木梯 → 戏台广场（无需能力）", note: "横穿后木梯回到戏台广场；回程无需能力" },

  // 03 mine — 墨腹蛛 / 链狱卒 → 剑冢狱主
  { id: "m1", zone: "mine", name: "矿口横坑", x: 3000, y: 640, w: 180, h: 130, kind: "room", enemies: ["iron_shield", "rooftop_bow"] },
  { id: "m7", zone: "mine", name: "矿灯岔口", x: 3200, y: 635, w: 170, h: 120, kind: "room", enemies: ["ink_spider"] },
  { id: "m8", zone: "mine", name: "运轨栈台", x: 3390, y: 630, w: 180, h: 125, kind: "room", enemies: ["chain_jailer", "rooftop_bow"] },
  { id: "m2", zone: "mine", name: "升降机井", x: 3600, y: 480, w: 160, h: 260, kind: "room", enemies: ["chain_jailer", "ink_crow"], enter: "中层运轨进入吊笼", exit: "升降梯双向回中层 / 下熔炉", note: "升降梯双向：中层运轨 ↔ 下层熔炉平台；链狱卒可悬空拦截" },
  { id: "m9", zone: "mine", name: "通风横巷", x: 3790, y: 640, w: 170, h: 120, kind: "room", enemies: ["ink_spider", "ink_crow"] },
  { id: "m3", zone: "mine", name: "轨道岔道", x: 3980, y: 650, w: 180, h: 120, kind: "room", enemies: ["ink_spider", "chain_jailer"] },
  { id: "m10", zone: "mine", name: "赤铁封门", x: 4120, y: 645, w: 150, h: 120, kind: "room", enemies: ["ink_beast"], requires: ["iron_seal"], tests: ["ground_slam"], enter: "击败狱主后由侧井返回中层", exit: "震碎封岩后东接根穴隧道", note: "区域出口同时验证赤铁印与震地击，确保矿区首领不可绕过" },
  { id: "m4", zone: "mine", name: "熔炉工坊", x: 3920, y: 860, w: 210, h: 160, kind: "arena", enemies: ["iron_shield", "ink_spider"], enter: "升降机井下行落台", exit: "原梯回中层；东可进牢底", note: "先处理洞顶伏击，再让盾卫占据熔炉主轴", encounter: { lock: true, respawn: "神龛刷新", budget: 7, intent: "把洞顶警戒与正面破盾拆成两段，避免同时遮挡反击窗口。", waves: [{ wave: 1, trigger: "升降平台落地", units: [{ enemy: "ink_spider", count: 2, position: "墙顶" }] }, { wave: 2, trigger: "靠近熔炉机关", units: [{ enemy: "iron_shield", count: 1, position: "地面" }, { enemy: "ink_spider", count: 1, position: "墙顶" }] }] } },
  { id: "m5", zone: "mine", name: "废弃矿底", x: 3280, y: 1020, w: 200, h: 120, kind: "secret", enemies: ["ink_spider", "chain_jailer"], requires: ["ground_slam"], enter: "取得震地击后震碎运轨栈台脆地", exit: "不可原路；东穿矿底横巷", note: "矿区通关后的即时回溯支路；奖励稀有强化材料与牢房旁路" },
  { id: "m11", zone: "mine", name: "矿底横巷", x: 3540, y: 1020, w: 210, h: 120, kind: "secret", enemies: ["ink_spider"], enter: "自废弃矿底横穿", exit: "木梯 → 通风横巷；或东接熔炉下层", note: "横穿后木梯回到通风横巷；亦可东接熔炉下层" },
  { id: "m6", zone: "mine", name: "剑冢牢底", x: 4140, y: 1000, w: 190, h: 150, kind: "boss", enemies: ["tomb_warden"], enter: "熔炉东侧进入", exit: "侧井升降回中层赤铁封门", grants: ["ground_slam", "iron_seal"], tests: ["instant_step", "cross_slash"], note: "区 Boss：剑冢狱主；战后获得震地击与赤铁印，并经侧井回到出口验证区", encounter: { lock: true, respawn: "首次清除后不刷新", budget: 12, intent: "瞬步躲链、十字斩破兵器阵；二阶段引导 Boss 震裂场地，为玩家取得震地击建立因果。", waves: [{ wave: 1, trigger: "进入牢底并封门", units: [{ enemy: "tomb_warden", count: 1, position: "首领位" }] }] } },

  // 04 forest — 噬墨兽 / 墨羽鸦 → 黑松魇兽
  { id: "f1", zone: "forest", name: "菌光入口", x: 4540, y: 620, w: 150, h: 130, kind: "save", enter: "根穴隧道东口", exit: "东接苔径西廊", note: "幽林正式入口；神龛可存档" },
  { id: "f7", zone: "forest", name: "苔径西廊", x: 4720, y: 615, w: 160, h: 120, kind: "room", enemies: ["ink_beast"] },
  { id: "f2", zone: "forest", name: "树庭分岔", x: 4910, y: 600, w: 170, h: 140, kind: "hub", enemies: ["ink_crow", "lantern_mage"], enter: "菌光主径", exit: "上攀倒生树冠或下行荧光根谷", note: "环形树庭分岔点；上下两路都能到达孢囊温室，首次探索不形成死路" },
  { id: "f8", zone: "forest", name: "荧光根谷", x: 5080, y: 805, w: 180, h: 130, kind: "room", enemies: ["lantern_mage"], enter: "树庭分岔下行", exit: "沿根桥从温室西侧进入", note: "低路较安全但经过孢子洼地；提供温室的西侧入口" },
  { id: "f9", zone: "forest", name: "朽木冠桥", x: 5350, y: 390, w: 180, h: 135, kind: "room", enemies: ["ink_crow"], enter: "倒生树冠东行", exit: "树腔梯下至温室东侧", note: "高路更短但受墨鸦俯冲；可从温室东侧先处理术士" },
  { id: "f10", zone: "forest", name: "雾桥中段", x: 5530, y: 585, w: 150, h: 120, kind: "room", enemies: ["ink_crow", "ink_beast"], enter: "温室战后升根桥返回主路", exit: "东接月下枯林", note: "上下环路在温室合流后重新回到主推进层" },
  { id: "f3", zone: "forest", name: "倒生树冠", x: 5110, y: 365, w: 190, h: 155, kind: "room", enemies: ["ink_crow"], enter: "树庭分岔攀根上行", exit: "东接朽木冠桥", note: "高路视野开阔、落点清楚；失足会落到荧光根谷而非死亡" },
  { id: "f4", zone: "forest", name: "孢囊温室", x: 5320, y: 780, w: 210, h: 150, kind: "arena", enemies: ["lantern_adept", "ink_beast"], enter: "荧光根谷西门 / 朽木冠桥树腔梯东门", exit: "战后升起中央根桥通往雾桥中段", grants: ["breath_control"], note: "双入口允许先处理不同敌组；战斗封锁后两门关闭，胜利开启中央升根桥", encounter: { lock: true, respawn: "首次清除后不刷新", budget: 9, intent: "第一波学习利用温室墙体，第二波把毒孢环境与精英施法绑定；双入口只改变开场站位，不改变战斗预算。", waves: [{ wave: 1, trigger: "踏入温室中央", units: [{ enemy: "ink_beast", count: 2, position: "地面" }] }, { wave: 2, trigger: "兽群清除并释放毒孢", units: [{ enemy: "lantern_adept", count: 1, position: "首领位" }, { enemy: "ink_beast", count: 1, position: "地面" }] }] } },
  { id: "f5", zone: "forest", name: "月下枯林", x: 5680, y: 520, w: 150, h: 210, kind: "boss", enemies: ["pine_nightmare"], requires: ["breath_control"], enter: "雾桥中段 · 闭息门", exit: "战后开启东侧断崖索桥", grants: ["forest_seal"], tests: ["instant_step", "breath_control"], note: "区 Boss：黑松魇兽；需先完成孢囊温室，幽林印负责开启下一地区域出口", encounter: { lock: true, respawn: "首次清除后不刷新", budget: 13, intent: "闭息维持毒雾生存，瞬步穿越实体冲锋；倒影与破角承担辨识机制。", waves: [{ wave: 1, trigger: "进入月下枯林", units: [{ enemy: "pine_nightmare", count: 1, position: "首领位" }] }] } },
  { id: "f6", zone: "forest", name: "毒雾盲道", x: 4620, y: 920, w: 180, h: 110, kind: "secret", enemies: ["ink_beast", "lantern_mage"], requires: ["breath_control"], enter: "苔径西廊闭息门（实线支路）", exit: "东穿盲道东口", note: "自苔径西廊以闭息诀开门进入（实线支路，非捷径）" },
  { id: "f11", zone: "forest", name: "盲道东口", x: 4840, y: 920, w: 180, h: 110, kind: "secret", enemies: ["ink_beast"], requires: ["breath_control"], enter: "自毒雾盲道横穿", exit: "木梯 → 雾径环廊", note: "横穿后木梯回雾径环廊；与孢囊温室左右错开" },

  // 05 cliff — 栈道弩手 / 墨鸦 → 赤枪校尉精英
  { id: "c1", zone: "cliff", name: "幽林索桥", x: 5800, y: 560, w: 180, h: 120, kind: "room", enemies: ["rooftop_bow"], requires: ["forest_seal"], enter: "幽林印解除索桥孢雾封锁", exit: "东入断云天险", note: "强制确认幽林主目标已完成，避免把缺印问题拖到终局" },
  { id: "c7", zone: "cliff", name: "断云短桥", x: 6000, y: 550, w: 170, h: 115, kind: "room", enemies: ["ink_crow"] },
  { id: "c2", zone: "cliff", name: "云隙长桥", x: 6190, y: 540, w: 190, h: 120, kind: "room", enemies: ["ink_crow", "rooftop_bow"] },
  { id: "c8", zone: "cliff", name: "风铃栈台", x: 6400, y: 535, w: 170, h: 115, kind: "room", enemies: ["rooftop_bow"] },
  { id: "c9", zone: "cliff", name: "崖侧佛龛", x: 6590, y: 530, w: 170, h: 120, kind: "room", enemies: ["lantern_mage", "ink_crow"] },
  { id: "c10", zone: "cliff", name: "云廊尽头", x: 6780, y: 525, w: 170, h: 120, kind: "room", enemies: ["rooftop_bow"] },
  { id: "c3", zone: "cliff", name: "悬空寺", x: 6300, y: 300, w: 180, h: 150, kind: "save" },
  { id: "c4", zone: "cliff", name: "鹰巢平台", x: 6620, y: 260, w: 160, h: 120, kind: "room", enemies: ["ink_crow"] },
  { id: "c5", zone: "cliff", name: "试剑峰", x: 6840, y: 100, w: 180, h: 140, kind: "arena", enemies: ["scarlet_captain", "rooftop_bow", "ink_crow"], enter: "悬寺 / 鹰巢平台栈道上行", exit: "校尉认可以后开放下山云梯", tests: ["instant_step", "cross_slash"], note: "区域必经综合试炼；先夺取制高点，再以瞬步贴身、十字斩破枪势", encounter: { lock: true, respawn: "首次清除后不刷新", budget: 10, intent: "第一波复测瞬步处理高台与空敌；第二波用十字斩破完整枪术，不再发放新的位移能力。", waves: [{ wave: 1, trigger: "登顶", units: [{ enemy: "rooftop_bow", count: 1, position: "高台" }, { enemy: "ink_crow", count: 2, position: "空中" }] }, { wave: 2, trigger: "第一波清除", units: [{ enemy: "scarlet_captain", count: 1, position: "首领位" }] }] } },
  { id: "c6", zone: "cliff", name: "崩崖捷径", x: 5920, y: 780, w: 170, h: 110, kind: "secret", enemies: ["bamboo_blade"], enter: "断云短桥单向坠入", exit: "不可原路；东穿崖底暗径", note: "自断云短桥单向坠入；不可原路爬回" },
  { id: "c11", zone: "cliff", name: "背风石窟", x: 6160, y: 780, w: 220, h: 110, kind: "secret", enemies: ["bamboo_blade"], enter: "短桥下行避开横风", exit: "石窟东梯 → 风铃栈台", note: "无风安全路线，路程更长；与上层横风长桥形成明确风险选择" },

  // 06 palace — 岸上过渡 → 湖中墨姬精英
  { id: "p1", zone: "palace", name: "淹没回廊", x: 7200, y: 560, w: 180, h: 130, kind: "room", enemies: ["bamboo_blade", "ink_crow"], enter: "云瀑泄洪道", exit: "高水位时沿柱顶进入潮声回廊；低水位时可下到闸房", note: "水位切换的观察室：墙面水痕和闸尺提示上下层连通变化" },
  { id: "p7", zone: "palace", name: "潮声回廊", x: 7400, y: 555, w: 170, h: 120, kind: "room", enemies: ["rooftop_bow"] },
  { id: "p2", zone: "palace", name: "潮汐侧厅", x: 7590, y: 545, w: 180, h: 130, kind: "hub", enemies: ["lantern_mage", "rooftop_bow"], enter: "高水位柱廊", exit: "上行宴厅；低水位后露出回水梯直达水下长廊", note: "同一侧厅在高水位是上层枢纽，低水位时增加下层回程口" },
  { id: "p8", zone: "palace", name: "锦鲤池廊", x: 7790, y: 540, w: 180, h: 125, kind: "room", enemies: ["bamboo_blade"] },
  { id: "p9", zone: "palace", name: "水镜长廊", x: 7990, y: 535, w: 180, h: 125, kind: "room", enemies: ["ink_crow", "rooftop_bow"] },
  { id: "p10", zone: "palace", name: "龙柱前厅", x: 8190, y: 530, w: 170, h: 130, kind: "room", enemies: ["iron_shield"] },
  { id: "p3", zone: "palace", name: "倒影宴厅", x: 7880, y: 310, w: 200, h: 160, kind: "arena", enemies: ["lantern_adept", "iron_shield"], enter: "主廊梯上行；区域主线必经", exit: "战后取得水行符并转动水镜总闸，行宫由高水位降为低水位", grants: ["water_talisman"], tests: ["cross_slash"], note: "盾卫先封路，掌灯使随后利用镜面符阵守护水行符；奖励机关会改变侧厅与下层的连通关系", encounter: { lock: true, respawn: "首次清除后不刷新", budget: 9, intent: "十字斩破盾后单独呈现镜面符阵；水行符奖励直接改变下半区路线。", waves: [{ wave: 1, trigger: "宴厅门关闭", units: [{ enemy: "iron_shield", count: 2, position: "地面" }] }, { wave: 2, trigger: "盾卫清除", units: [{ enemy: "lantern_adept", count: 1, position: "首领位" }] }] } },
  { id: "p6", zone: "palace", name: "泄洪闸房", x: 7180, y: 760, w: 220, h: 120, kind: "room", enemies: ["iron_shield", "chain_jailer"], requires: ["water_talisman"], enter: "总闸降水后由淹没回廊下行", exit: "开启下层检修门，步行进入半淹长廊", note: "低水位新增连接；高水位时整间闸房被封在水幕之后" },
  { id: "p4", zone: "palace", name: "水下长廊", x: 7480, y: 900, w: 280, h: 130, kind: "room", enemies: ["ink_eel", "drowned_guard"], requires: ["water_talisman"], enter: "泄洪闸 / 主廊下水口（需水行符）", exit: "原路浮出或东进祭坛", note: "游魂控制中层转向，水卒锚定池底；两组错位触发", encounter: { lock: false, respawn: "神龛刷新", budget: 6, intent: "建立水中层与水底两条压力带，保留上浮换气通道。", waves: [{ wave: 1, trigger: "游入长廊西半", units: [{ enemy: "ink_eel", count: 2, position: "水中层" }] }, { wave: 2, trigger: "接近东侧祭坛门", units: [{ enemy: "drowned_guard", count: 1, position: "水底" }, { enemy: "ink_eel", count: 1, position: "水中层" }] }] } },
  { id: "p5", zone: "palace", name: "月下祭坛", x: 8080, y: 920, w: 220, h: 150, kind: "arena", enemies: ["lake_maiden"], requires: ["water_talisman"], enter: "水下长廊东延", exit: "战后以水镜升流返回龙柱前厅并开启绝顶水门", grants: ["water_memento"], tests: ["instant_step", "water_talisman"], note: "湖中墨姬以幻身承担杂兵压力；辨认红簪、瞬步穿袖、借水行符换层", encounter: { lock: true, respawn: "首次清除后不刷新", budget: 10, intent: "保持单体精英焦点；水镜信物是行宫完成凭证，也是绝顶入口钥匙。", waves: [{ wave: 1, trigger: "进入祭坛水镜范围", units: [{ enemy: "lake_maiden", count: 1, position: "首领位" }] }] } },

  // 07 peak — 无面剑侍 → 无相殿主
  { id: "k1", zone: "peak", name: "水镜天门", x: 8600, y: 690, w: 180, h: 130, kind: "room", enemies: ["iron_shield", "bamboo_blade"], requires: ["water_memento"], tests: ["water_talisman"], enter: "水镜信物升起通往绝顶的水阶", exit: "东接第一折云阶", note: "绝顶最低层入口；从此开始按右上、左上、右上的折返节奏登山" },
  { id: "k7", zone: "peak", name: "云阶中亭", x: 8820, y: 640, w: 170, h: 120, kind: "room", enemies: ["rooftop_bow"], enter: "天门东侧第一折", exit: "右上攀至望月石台；后期永久捷径在此回接" },
  { id: "k8", zone: "peak", name: "望月石台", x: 9060, y: 505, w: 170, h: 120, kind: "room", enemies: ["faceless_sword"], enter: "云阶右上折", exit: "转向左上进入问招前廊" },
  { id: "k2", zone: "peak", name: "问招前廊", x: 8820, y: 360, w: 180, h: 130, kind: "room", enemies: ["faceless_sword", "iron_shield"], tests: ["instant_step", "cross_slash"], enter: "望月石台折返向左上", exit: "再折向右上碑林", note: "折返中段的战斗门；玩家能从此回望天门与第一折云阶" },
  { id: "k9", zone: "peak", name: "碑林高台", x: 9120, y: 235, w: 180, h: 125, kind: "room", enemies: ["rooftop_bow", "bamboo_blade"], enter: "问招前廊右上折", exit: "东侧单向分段回落到望台回廊", note: "全区最高的开放平台之一；向东不是继续上攀，而是一次受控回落" },
  { id: "k5", zone: "peak", name: "望台回廊", x: 9320, y: 410, w: 200, h: 120, kind: "room", enemies: ["rooftop_bow"], enter: "碑林高台分段回落", exit: "上行三印祭坛；启动折返云梯可永久回到云阶中亭", note: "高处回落的安全落点，也是终局前永久捷径的控制端" },
  { id: "k10", zone: "peak", name: "终局前廊", x: 9650, y: 330, w: 180, h: 130, kind: "room", enemies: ["faceless_sword", "iron_shield"] },
  { id: "k3", zone: "peak", name: "三印祭坛", x: 9370, y: 150, w: 190, h: 150, kind: "save", requires: ["lantern_seal", "iron_seal", "forest_seal"], enter: "望台回廊最后上攀；集齐悬灯 / 赤铁 / 幽林三印", exit: "东侧折返下行至终局前廊", note: "终局整备点；启动祭坛旁折返云梯，永久连回云阶中亭" },
  { id: "k4", zone: "peak", name: "无相殿顶", x: 9780, y: 110, w: 180, h: 150, kind: "boss", enemies: ["formless_lord"], requires: ["instant_step", "cross_slash", "ground_slam", "breath_control", "water_talisman"], enter: "终局前廊 · 五式问心门", exit: "战后可用回城传送", grants: ["return_portal"], tests: ["instant_step", "cross_slash", "ground_slam", "breath_control", "water_talisman"], note: "终局 Boss：完整复测两项战斗招式与三项环境能力；通关后激活绝顶↔旧城传送对", encounter: { lock: true, respawn: "首次清除后不刷新", budget: 16, intent: "一阶段瞬步与十字斩对剑；二阶段震地改变平台；三阶段闭息毒雾与水行镜面交替。", waves: [{ wave: 1, trigger: "踏入殿顶并完成五式问心", units: [{ enemy: "formless_lord", count: 1, position: "首领位" }] }] } },
  { id: "k6", zone: "peak", name: "折返云梯台", x: 9140, y: 690, w: 190, h: 120, kind: "secret", enter: "望台回廊启动永久云梯后开放", exit: "西接云阶中亭；终局后兼作回城传送台", note: "中段永久捷径：把高处回落后的望台回廊与第一折云阶相连；通关后同时激活旧城传送" },
];

const MARKERS: Marker[] = [
  { id: "mk1", kind: "shrine", x: 155, y: 755, label: "破庙神龛", zone: "gate" },
  { id: "mk2", kind: "mechanism", x: 1470, y: 700, label: "山门闸机", zone: "gate" },
  { id: "mk3", kind: "oneway", x: 545, y: 820, label: "柴棚单向落口", zone: "gate" },
  { id: "mk22", kind: "mechanism", x: 920, y: 850, label: "柴棚回程木梯", zone: "gate" },
  { id: "mk35", kind: "ability", x: 1065, y: 500, label: "校场传授·瞬步", zone: "gate" },
  { id: "mk4", kind: "shrine", x: 1670, y: 720, label: "驿站神龛", zone: "town" },
  { id: "mk5", kind: "ability", x: 2665, y: 520, label: "精英传授·十字斩 / 悬灯印", zone: "town" },
  { id: "mk6", kind: "breakable", x: 2250, y: 820, label: "暗渠脆地落口", zone: "town" },
  { id: "mk24", kind: "oneway", x: 2250, y: 900, label: "暗渠单向坠入", zone: "town" },
  { id: "mk25", kind: "mechanism", x: 2640, y: 850, label: "暗渠回程木梯", zone: "town" },
  { id: "mk7", kind: "lift", x: 3680, y: 620, label: "矿井升降（双向）", zone: "mine" },
  { id: "mk8", kind: "ability", x: 4230, y: 1060, label: "首领奖励·震地击（狱主）", zone: "mine" },
  { id: "mk9", kind: "breakable", x: 3480, y: 780, label: "矿底脆地落口", zone: "mine" },
  { id: "mk26", kind: "oneway", x: 3480, y: 900, label: "矿底单向坠入", zone: "mine" },
  { id: "mk27", kind: "mechanism", x: 3750, y: 880, label: "矿底回程木梯", zone: "mine" },
  { id: "mk28", kind: "lift", x: 4200, y: 900, label: "牢底侧井升降", zone: "mine" },
  { id: "mk10", kind: "shrine", x: 4615, y: 680, label: "菌光神龛", zone: "forest" },
  { id: "mk11", kind: "ability", x: 5740, y: 600, label: "闭息诀门", zone: "forest" },
  { id: "mk12", kind: "mechanism", x: 4995, y: 650, label: "树庭上下分岔", zone: "forest" },
  { id: "mk29", kind: "ability", x: 4800, y: 840, label: "盲道闭息门", zone: "forest" },
  { id: "mk30", kind: "mechanism", x: 4930, y: 840, label: "盲道回程木梯", zone: "forest" },
  { id: "mk31", kind: "ability", x: 5380, y: 860, label: "温室奖励·闭息诀", zone: "forest" },
  { id: "mk13", kind: "shrine", x: 6390, y: 360, label: "悬寺神龛", zone: "cliff" },
  { id: "mk14", kind: "oneway", x: 6050, y: 680, label: "崩崖单向", zone: "cliff" },
  { id: "mk23", kind: "mechanism", x: 6390, y: 700, label: "背风石窟回程梯", zone: "cliff" },
  { id: "mk36", kind: "mechanism", x: 6250, y: 570, label: "横风风铃·读风向", zone: "cliff" },
  { id: "mk37", kind: "mechanism", x: 6390, y: 500, label: "悬寺升风闸", zone: "cliff" },
  { id: "mk16", kind: "underwater", x: 7620, y: 960, label: "水下长廊", zone: "palace" },
  { id: "mk17", kind: "ability", x: 8180, y: 980, label: "墨姬祭坛·水镜信物", zone: "palace" },
  { id: "mk18", kind: "mechanism", x: 7260, y: 800, label: "泄洪石闸", zone: "palace" },
  { id: "mk32", kind: "ability", x: 7980, y: 390, label: "宴厅奖励·水行符", zone: "palace" },
  { id: "mk38", kind: "mechanism", x: 7620, y: 760, label: "低水位回水梯", zone: "palace" },
  { id: "mk39", kind: "lift", x: 8260, y: 760, label: "祭坛水镜升流", zone: "palace" },
  { id: "mk19", kind: "shrine", x: 9470, y: 220, label: "三印祭坛", zone: "peak" },
  { id: "mk20", kind: "lift", x: 9330, y: 650, label: "折返云梯·永久捷径", zone: "peak" },
  { id: "mk21", kind: "ability", x: 9860, y: 170, label: "殿主奖励·归途传送", zone: "peak" },
  { id: "mk33", kind: "portal", x: 9230, y: 745, label: "回城传送·绝顶端", zone: "peak" },
  { id: "mk34", kind: "portal", x: 2200, y: 430, label: "回城传送·旧城端", zone: "town" },
];

const MARKER_META: Record<MarkerKind, { label: string; glyph: string; color: string; hint: string }> = {
  shrine: { label: "存档神龛", glyph: "龛", color: "#7dcea0", hint: "安全休息 / 重生点" },
  mechanism: { label: "捷径/机关", glyph: "机", color: "#f0b27a", hint: "闸门、回程梯、永久捷径开关" },
  breakable: { label: "可破坏墙", glyph: "破", color: "#e59866", hint: "需震地击等能力开启" },
  oneway: { label: "单向掉落", glyph: "落", color: "#85929e", hint: "只能落下；回程另寻路径" },
  lift: { label: "升降梯", glyph: "梯", color: "#76d7c4", hint: "默认可双向往返" },
  underwater: { label: "水下区域", glyph: "水", color: "#5dade2", hint: "需水行符；注意换气" },
  portal: { label: "传送端点", glyph: "门", color: "#bb8fce", hint: "配对瞬移，非实体长隧道" },
  ability: { label: "能力点", glyph: "能", color: "#f5b041", hint: "获取或验证能力的位置" },
};

const ROOM_KIND_META: Record<Room["kind"], { label: string; hint: string }> = {
  room: { label: "连续活动区", hint: "主廊普通节点，无切场" },
  arena: { label: "战斗封锁区", hint: "精英 + 跟班小怪；常附带能力奖励" },
  save: { label: "存档安全区", hint: "神龛 / 休息点" },
  secret: { label: "秘密支路", hint: "可选探索；注意回程" },
  boss: { label: "独立首领房", hint: "仅矿脉 / 幽林 / 绝顶三处区 Boss" },
  hub: { label: "枢纽节点", hint: "NPC / 补给 / 多向分叉" },
};

const ABILITY_CHAIN = [
  { id: "instant_step", zone: "gate", kind: "战斗招式", ability: "瞬步", at: "01 守门校场", unlocks: "雨亭箭廊 · 高压走位" },
  { id: "cross_slash", zone: "town", kind: "战斗招式", ability: "十字斩", at: "02 旧钟楼精英", unlocks: "盾卫破势 · 双点弱点击破" },
  { id: "lantern_seal", zone: "town", kind: "剧情凭证", ability: "悬灯印", at: "02 旧钟楼精英", unlocks: "城东印闸 · 三印之一" },
  { id: "ground_slam", zone: "mine", kind: "环境能力", ability: "震地击", at: "03 剑冢牢底", unlocks: "暗渠脆地 · 废弃矿底" },
  { id: "iron_seal", zone: "mine", kind: "剧情凭证", ability: "赤铁印", at: "03 剑冢牢底", unlocks: "赤铁封门 · 三印之一" },
  { id: "breath_control", zone: "forest", kind: "环境能力", ability: "闭息诀", at: "04 孢囊温室", unlocks: "毒雾盲道 · 月下枯林" },
  { id: "forest_seal", zone: "forest", kind: "剧情凭证", ability: "幽林印", at: "04 黑松魇兽", unlocks: "幽林索桥 · 三印之一" },
  { id: "water_talisman", zone: "palace", kind: "环境能力", ability: "水行符", at: "06 倒影宴厅", unlocks: "水下长廊 · 月下祭坛" },
  { id: "water_memento", zone: "palace", kind: "剧情凭证", ability: "水镜信物", at: "06 月下祭坛", unlocks: "绝顶水镜天门" },
  { id: "return_portal", zone: "peak", kind: "通关权限", ability: "归途传送", at: "07 无相殿主", unlocks: "绝顶 ↔ 旧城传送对" },
] as const;

type RoomLink = {
  from: string;
  to: string;
  kind: "main" | "branch" | "oneway" | "portal";
  oneWay?: boolean;
  state?: "water_high" | "water_low";
  transitionId?: string;
};

type PointU = { x: number; y: number };
const point = (x: number, y: number): PointU => ({ x, y });
type MovementMode =
  | "walk"
  | "jump"
  | "stairs"
  | "ladder"
  | "elevator"
  | "drop"
  | "smash_drop"
  | "wind"
  | "swim"
  | "portal";

type PhysicalStep = {
  mode: MovementMode;
  from: PointU;
  to: PointU;
  requires?: ProgressionId[];
  deviceX?: number;
  note?: string;
};

type PhysicalOverride = {
  steps: PhysicalStep[];
  returnVia?: string;
};

type PhysicalIssue = {
  severity: "warning" | "error";
  message: string;
};

type PhysicalLink = RoomLink & {
  steps: PhysicalStep[];
  horizontalDistance: number;
  verticalDelta: number;
  issues: PhysicalIssue[];
  returnVia?: string;
};

const MOVEMENT_LABELS: Record<MovementMode, string> = {
  walk: "步行",
  jump: "跑跳",
  stairs: "坡道 / 台阶",
  ladder: "梯子",
  elevator: "升降梯",
  drop: "单向落下",
  smash_drop: "震地破口",
  wind: "借风跃迁",
  swim: "游泳 / 水路",
  portal: "传送",
};

const connectChain = (
  ids: string[],
  kind: RoomLink["kind"] = "main",
): RoomLink[] =>
  ids.slice(1).map((to, index) => ({ from: ids[index], to, kind }));

/** Logical topology. Visual polylines below remain presentation-only geometry. */
const ROOM_LINKS: RoomLink[] = [
  ...connectChain(["g1", "g2", "g7", "g8", "g3", "g9", "g10", "g6"]),
  ...connectChain(["g7", "g5", "g11", "g3"], "oneway").map((link, index) => ({ ...link, oneWay: index === 0 })),
  { from: "g9", to: "g4", kind: "branch" },
  { from: "g6", to: "t1", kind: "main", transitionId: "gate-town" },
  ...connectChain(["t1", "t8", "t2", "t9", "t3", "t10", "t11"]),
  { from: "t8", to: "t7", kind: "branch" },
  { from: "t9", to: "t4", kind: "branch" },
  { from: "t10", to: "t5", kind: "branch" },
  ...connectChain(["t9", "t6", "t12", "t10"], "oneway").map((link, index) => ({ ...link, oneWay: index === 0 })),
  { from: "t11", to: "m1", kind: "main", transitionId: "town-mine" },
  ...connectChain(["m1", "m7", "m8", "m2", "m9", "m3", "m10"]),
  ...connectChain(["m2", "m4", "m6"], "branch"),
  ...connectChain(["m8", "m5", "m11", "m9"], "oneway").map((link, index) => ({ ...link, oneWay: index === 0 })),
  { from: "m11", to: "m4", kind: "branch" },
  { from: "m10", to: "f1", kind: "main", transitionId: "mine-forest" },
  ...connectChain(["f1", "f7", "f2"]),
  ...connectChain(["f2", "f3", "f9", "f4"], "branch"),
  ...connectChain(["f2", "f8", "f4"], "branch"),
  ...connectChain(["f4", "f10", "f5"]),
  ...connectChain(["f7", "f6", "f11", "f2"], "branch"),
  { from: "f5", to: "c1", kind: "main", transitionId: "forest-cliff" },
  ...connectChain(["c1", "c7", "c2", "c8", "c3", "c4", "c5", "c9", "c10"]),
  ...connectChain(["c7", "c6", "c11", "c8"], "oneway").map((link, index) => ({ ...link, oneWay: index === 0 })),
  { from: "c10", to: "p1", kind: "main", transitionId: "cliff-palace" },
  ...connectChain(["p1", "p7", "p2", "p8", "p9", "p10"]).map((link) => ({ ...link, state: "water_high" as const })),
  { from: "p8", to: "p3", kind: "branch" },
  { from: "p1", to: "p6", kind: "branch", state: "water_low" },
  { from: "p6", to: "p4", kind: "branch", state: "water_low" },
  { from: "p2", to: "p4", kind: "branch", state: "water_low" },
  { from: "p4", to: "p5", kind: "main" },
  { from: "p5", to: "p10", kind: "branch", state: "water_low" },
  { from: "p5", to: "k1", kind: "main", transitionId: "palace-peak" },
  ...connectChain(["k1", "k7", "k8", "k2", "k9"]),
  { from: "k9", to: "k5", kind: "oneway", oneWay: true },
  ...connectChain(["k5", "k3", "k10", "k4"]),
  { from: "k5", to: "k6", kind: "branch" },
  { from: "k6", to: "k7", kind: "branch" },
  { from: "k6", to: "t4", kind: "portal" },
];

function validateMapModel() {
  const errors: string[] = [];
  const zoneIds = new Set(ZONES.map((item) => item.id));
  const progressionIds = new Set(Object.keys(PROGRESSION_LABELS));
  const roomById = new Map<string, Room>();

  for (const room of ROOMS) {
    if (roomById.has(room.id)) errors.push(`重复房间 ID: ${room.id}`);
    roomById.set(room.id, room);
    if (!zoneIds.has(room.zone)) errors.push(`${room.id} 引用了未知区域 ${room.zone}`);
    if (room.x < 0 || room.y < 0 || room.x + room.w > MAP_W || room.y + room.h > MAP_H) {
      errors.push(`${room.id} 超出地图边界`);
    }
    for (const id of [...(room.requires ?? []), ...(room.grants ?? []), ...(room.tests ?? [])]) {
      if (!progressionIds.has(id)) errors.push(`${room.id} 引用了未知进度 ID ${id}`);
    }
  }

  const grantedIds = new Set(ROOMS.flatMap((room) => room.grants ?? []));
  for (const room of ROOMS) {
    for (const required of room.requires ?? []) {
      if (!grantedIds.has(required)) {
        errors.push(`${room.id} 要求 ${required}，但地图中没有对应获取点`);
      }
    }
  }

  const requiredExitMilestones: Array<[string, ProgressionId]> = [
    ["g10", "instant_step"],
    ["t11", "lantern_seal"],
    ["m10", "iron_seal"],
    ["c1", "forest_seal"],
    ["k1", "water_memento"],
  ];
  for (const [roomId, required] of requiredExitMilestones) {
    if (!roomById.get(roomId)?.requires?.includes(required)) {
      errors.push(`${roomId} 缺少区域出口里程碑 ${required}`);
    }
  }

  const finalRequired: ProgressionId[] = [
    "instant_step",
    "cross_slash",
    "ground_slam",
    "breath_control",
    "water_talisman",
  ];
  const finalRoom = roomById.get("k4");
  for (const required of finalRequired) {
    if (!finalRoom?.requires?.includes(required)) {
      errors.push(`终局缺少五式校验: ${required}`);
    }
  }

  for (const technique of ["instant_step", "cross_slash"] as ProgressionId[]) {
    const testCount = ROOMS.filter((room) => room.tests?.includes(technique)).length;
    if (testCount < 3) errors.push(`${technique} 仅有 ${testCount} 个验证节点`);
  }

  for (const state of ["water_high", "water_low"] as const) {
    if (!ROOM_LINKS.some((link) => link.state === state)) errors.push(`沉水行宫缺少 ${state} 状态连接`);
  }
  if (!ROOM_LINKS.some((link) => link.from === "f2" && link.to === "f3") || !ROOM_LINKS.some((link) => link.from === "f2" && link.to === "f8")) {
    errors.push("幽林树庭没有形成上下双路分岔");
  }
  if (!ROOM_LINKS.some((link) => link.from === "k9" && link.to === "k5" && link.oneWay)) {
    errors.push("绝顶缺少碑林高处回落");
  }

  const linkIds = new Set<string>();
  for (const link of ROOM_LINKS) {
    const linkId = `${link.from}>${link.to}`;
    if (linkIds.has(linkId)) errors.push(`重复连接: ${linkId}`);
    linkIds.add(linkId);
    if (!roomById.has(link.from)) errors.push(`连接起点不存在: ${link.from}`);
    if (!roomById.has(link.to)) errors.push(`连接终点不存在: ${link.to}`);
    if (link.from === link.to) errors.push(`房间不能连接自身: ${link.from}`);
  }

  const reachable = new Set<string>(["g1"]);
  const inventory = new Set<ProgressionId>();
  let changed = true;
  while (changed) {
    changed = false;
    for (const id of reachable) {
      for (const grant of roomById.get(id)?.grants ?? []) {
        if (!inventory.has(grant)) {
          inventory.add(grant);
          changed = true;
        }
      }
    }
    const canEnter = (id: string) =>
      (roomById.get(id)?.requires ?? []).every((required) => inventory.has(required));
    for (const link of ROOM_LINKS) {
      if (reachable.has(link.from) && canEnter(link.to) && !reachable.has(link.to)) {
        reachable.add(link.to);
        changed = true;
      }
      if (!link.oneWay && reachable.has(link.to) && canEnter(link.from) && !reachable.has(link.from)) {
        reachable.add(link.from);
        changed = true;
      }
    }
  }

  const unreachable = ROOMS.filter((room) => !reachable.has(room.id));
  if (unreachable.length) {
    errors.push(`不可达房间: ${unreachable.map((room) => room.id).join(", ")}`);
  }
  if (errors.length) throw new Error(`地图数据校验失败:\n${errors.join("\n")}`);

  return { rooms: ROOMS.length, links: ROOM_LINKS.length } as const;
}

const CONNECTION_SEGMENTS = [
  // gate mid spine
  [155, 755, 355, 750], [440, 745, 555, 740], [635, 740, 735, 740],
  [820, 740, 930, 740], [1020, 730, 1125, 730], [1215, 720, 1310, 720], [1390, 720, 1480, 720],
  [1065, 670, 1065, 570],
  // gate oneway drop → underground traverse → climb back ahead
  [545, 805, 570, 930], [670, 985, 820, 985], [920, 930, 920, 740],
  // into town
  [1760, 720, 1865, 720], [1950, 715, 2055, 715],
  [2140, 710, 2250, 710], [2335, 705, 2450, 700], [2530, 700, 2640, 700], [2730, 695, 2830, 695],
  [1860, 655, 1835, 510], [2200, 645, 2200, 480], [2665, 500, 2665, 780],
  // town sewer: breakable drop → traverse → climb back to plaza
  [2250, 775, 2290, 980], [2400, 1040, 2570, 1040], [2640, 980, 2640, 700],
  // town to mine
  [3180, 700, 3290, 695], [3370, 695, 3480, 690],
  [3570, 690, 3680, 620], [3760, 620, 3875, 700], [3960, 710, 4070, 710], [4160, 705, 4260, 705],
  // mine elevator ↔ furnace ↔ boss (lifts bidirectional)
  [3680, 740, 3680, 980], [3680, 980, 4020, 980], [4120, 940, 4230, 1070],
  // mine secret: drop from haulage → bottom traverse → climb back to mid
  [3480, 755, 3380, 1020], [3480, 1080, 3650, 1080], [3750, 1020, 3750, 700],
  // optional east link bottom → furnace undercroft
  [3750, 1080, 4020, 1020],
  // mine to forest — clear junction: 歇所 → 根穴隧道 → 菌光入口
  [4690, 675, 4800, 670], [4890, 670, 4995, 665],
  // forest ring: upper canopy and lower root valley converge at greenhouse
  [5050, 600, 5050, 520], [5050, 520, 5205, 455], [5300, 455, 5440, 458], [5430, 525, 5430, 780],
  [5070, 700, 5070, 805], [5080, 870, 5260, 870], [5260, 870, 5320, 855],
  [5530, 855, 5530, 650], [5530, 650, 5605, 645], [5680, 625, 5760, 620],
  // forest poison blind path
  [4800, 735, 4710, 920], [4800, 975, 4930, 975], [4930, 920, 4995, 670],
  // forest to cliff
  [5980, 605, 6085, 600], [6170, 595, 6285, 590],
  [6370, 585, 6485, 580], [6570, 575, 6675, 575], [6760, 570, 6865, 570],
  [6390, 540, 6390, 450], [6700, 390, 6700, 340], [6860, 280, 6930, 240],
  // cliff oneway drop → traverse → climb back
  [6050, 665, 6005, 780], [6090, 835, 6260, 835], [6390, 780, 6390, 650],
  // cliff to palace
  [7980, 545, 7980, 470],
  // palace to peak
  [8780, 760, 8905, 700], [8990, 680, 9145, 565],
  [9060, 545, 8910, 425], [9000, 415, 9210, 300], [9300, 300, 9370, 470],
  [9470, 410, 9470, 300], [9560, 245, 9740, 395], [9830, 395, 9820, 260],
  [8770, 820, 8770, 890],
] as const;

const SHORTCUT_SEGMENTS = [
  [1410, 500, 2100, 420], [2665, 300, 3680, 520], [2665, 1040, 3380, 1080],
  // mine nest ↔ forest greenhouse undercroft (optional inter-zone), not the blind-path access
  [4230, 1070, 5380, 940], [5680, 720, 5920, 820], [6930, 220, 7880, 370],
  [8180, 1040, 8770, 820], [9430, 530, 9330, 810], [9140, 810, 8990, 760],
] as const;

const REGION_SHAPES = [
  { id: "gate", d: "M40 650 H300 V610 H900 V760 H1560 V820 H900 V980 H420 V1040 H70 V860 H40 Z M900 610 V410 H1160 V560 H1080 V610 Z M450 900 H950 V1060 H450 Z" },
  { id: "town", d: "M1480 610 H1800 V560 H2600 V620 H3080 V760 H2900 V1120 H2100 V900 H1600 V820 H1480 Z M1720 560 V360 H2400 V560 Z M2520 250 V560 H2800 V250 Z M2140 940 H2720 V1120 H2140 Z" },
  { id: "mine", d: "M2920 590 H3400 V520 H3900 V720 H4280 V760 H4280 V920 H4380 V1160 H3900 V1120 H3200 V980 H2920 Z M3580 720 V980 H3800 V720 Z M3240 980 H3800 V1140 H3240 Z" },
  { id: "forest", d: "M4280 600 H4700 V500 H5000 V560 H5060 V340 H5550 V560 H5740 V760 H5560 V980 H5050 V960 H4680 V920 H4320 V780 H4280 Z M4880 560 H5080 V760 H4880 Z M5050 760 H5560 V960 H5050 Z M4500 880 H4960 V1050 H4500 Z" },
  { id: "cliff", d: "M5720 510 H6200 V470 H6700 V320 H7100 V140 H7220 V620 H7000 V700 H6400 V840 H5720 Z M6200 470 V280 H6600 V470 Z M5880 760 H6400 V900 H5880 Z" },
  { id: "palace", d: "M7100 500 H7600 V450 H8300 V700 H8650 V1120 H8060 V1080 H7400 V1040 H7100 Z M7700 450 V280 H8300 V500 H8200 V450 Z M7120 700 H7420 V920 H7100 Z M7400 860 H8400 V1120 H7400 Z" },
  { id: "peak", d: "M8500 620 H9000 V580 H9280 V470 H8740 V320 H9320 V180 H9600 V360 H9860 V260 H10000 V90 H10080 V620 H9700 V520 H9520 V590 H9340 V840 H9000 V820 H8700 V900 H8500 Z" },
] as const;

type TransitionModule = {
  id: string;
  fromZone: string;
  toZone: string;
  sourceRoom: string;
  targetRoom: string;
  orientation: "horizontal" | "compound";
  x: number;
  y: number;
  width: number;
  height: number;
  title: string;
  note: string;
  landmark: string;
  materialPhases: readonly [string, string, string];
  gameplayPhases: readonly [string, string, string];
  enemyPolicy: string;
  camera: string;
  streaming: string;
  segments: readonly [TransitionSceneSegment, TransitionSceneSegment];
};

type TransitionSceneSegment = {
  id: string;
  name: string;
  bounds: { x: number; y: number; w: number; h: number };
  floors: readonly { x: number; y: number; w: number }[];
  bridges?: readonly { x1: number; x2: number; y: number; type: "stone" | "timber" | "suspension" | "chain" }[];
  ladders?: readonly { x: number; y1: number; y2: number }[];
  elevators?: readonly { x: number; y: number; h: number }[];
  route: readonly PhysicalStep[];
  safeRespawn: PointU;
  cameraRail: readonly PointU[];
  material: string;
  gameplay: string;
  streamingChunk: string;
};

/** Each module occupies 1–2 base camera widths and blends both zones in three readable phases. */
const TRANSITIONS: TransitionModule[] = [
  {
    id: "gate-town",
    fromZone: "gate",
    toZone: "town",
    sourceRoom: "g6",
    targetRoom: "t1",
    orientation: "horizontal",
    x: 1370,
    y: 610,
    width: 360,
    height: 260,
    title: "山门驿道",
    note: "雨蚀山门 → 悬灯旧城 · 2屏步行连续进入",
    landmark: "城门楼与第一盏悬灯同时入镜",
    materialPhases: ["湿岩、竹篱、泥坡", "石砌挡墙、排水沟、木棚", "青砖路、瓦檐、悬灯柱"],
    gameplayPhases: ["离开山门战斗区，坡度放缓", "穿过驿道补给棚，允许回望山门", "灯市守卫形成低压新敌预告"],
    enemyPolicy: "第一屏不刷怪；第二屏只放1名旧敌与1名城防敌，不封锁。",
    camera: "横向跟随，前视量由山门40%平滑增至旧城48%。",
    streaming: "木棚遮挡时卸载山门远景；看见城门楼后预载灯市屋顶层。",
    segments: [
      { id: "gt-a", name: "雨石下坡", bounds: { x: 1370, y: 650, w: 180, h: 220 }, floors: [{ x: 1370, y: 780, w: 100 }, { x: 1470, y: 790, w: 80 }], route: [{ mode: "stairs", from: point(1410, 780), to: point(1500, 785) }, { mode: "stairs", from: point(1500, 785), to: point(1550, 790), note: "湿岩缓坡与排水沟" }], safeRespawn: point(1450, 780), cameraRail: [point(1410, 730), point(1550, 740)], material: "湿岩、竹篱、泥坡", gameplay: "离开山门战斗区，坡度放缓", streamingChunk: "tr-gate-town-a" },
      { id: "gt-b", name: "城门驿棚", bounds: { x: 1550, y: 650, w: 180, h: 220 }, floors: [{ x: 1550, y: 790, w: 90 }, { x: 1640, y: 800, w: 90 }], route: [{ mode: "stairs", from: point(1550, 790), to: point(1640, 795) }, { mode: "stairs", from: point(1640, 795), to: point(1730, 800), note: "木棚与青砖路连续落脚" }], safeRespawn: point(1600, 790), cameraRail: [point(1550, 740), point(1730, 750)], material: "石挡墙、木棚、青砖路", gameplay: "木棚遮挡流送，城防敌只在末端预告", streamingChunk: "tr-gate-town-b" },
    ],
  },
  {
    id: "town-mine",
    fromZone: "town",
    toZone: "mine",
    sourceRoom: "t11",
    targetRoom: "m1",
    orientation: "horizontal",
    x: 2800,
    y: 585,
    width: 360,
    height: 300,
    title: "东闸采石坡",
    note: "悬灯旧城 → 赤铁矿脉 · 2屏由城防转入工业矿道",
    landmark: "东闸绞盘、废弃矿车与赤铁矿壁形成三层纵深",
    materialPhases: ["青砖城墙、铜灯、石闸", "木脚手、滑轮、碎砖", "赤铁岩壁、矿轨、支护梁"],
    gameplayPhases: ["印闸开启后的安全确认区", "沿矿车缓坡练习上下层观察", "洞顶蛛丝预告矿区伏击，但不立刻出怪"],
    enemyPolicy: "城防敌在闸门前止步；矿区敌从第二屏末端才激活。",
    camera: "轻微下压18u，洞口遮挡期间收窄前视并锁定地面层。",
    streaming: "穿过城闸门洞时卸载旧城NPC；矿灯点亮后预载矿井竖井。",
    segments: [
      { id: "tm-a", name: "城墙闸洞", bounds: { x: 2800, y: 585, w: 180, h: 300 }, floors: [{ x: 2800, y: 755, w: 90 }, { x: 2890, y: 765, w: 90 }], route: [{ mode: "stairs", from: point(2800, 755), to: point(2890, 760) }, { mode: "stairs", from: point(2890, 760), to: point(2980, 765), note: "闸洞内安全确认坡" }], safeRespawn: point(2845, 755), cameraRail: [point(2800, 705), point(2980, 715)], material: "青砖城墙、铜灯、石闸", gameplay: "印闸开启后的安全确认区", streamingChunk: "tr-town-mine-a" },
      { id: "tm-b", name: "采石矿车坡", bounds: { x: 2980, y: 585, w: 180, h: 300 }, floors: [{ x: 2980, y: 765, w: 90 }, { x: 3070, y: 770, w: 90 }], route: [{ mode: "stairs", from: point(2980, 765), to: point(3070, 770) }, { mode: "walk", from: point(3070, 770), to: point(3160, 770), note: "废矿车轨道与支护梁" }], safeRespawn: point(3030, 765), cameraRail: [point(2980, 715), point(3160, 720)], material: "木脚手、矿轨、赤铁岩壁", gameplay: "矿区敌在第二段末端才激活", streamingChunk: "tr-town-mine-b" },
    ],
  },
  {
    id: "mine-forest",
    fromZone: "mine",
    toZone: "forest",
    sourceRoom: "m10",
    targetRoom: "f1",
    orientation: "horizontal",
    x: 4180,
    y: 570,
    width: 360,
    height: 300,
    title: "根蚀矿穴",
    note: "赤铁矿脉 → 孢子幽林 · 2屏洞穴内无缝换景",
    landmark: "巨根穿透废弃矿梁，菌光取代矿灯",
    materialPhases: ["赤铁矿壁、铁轨、焦木", "锈轨被根系顶起、滴水苔藓", "湿土、巨根、荧光菌簇"],
    gameplayPhases: ["矿区出口能力确认", "跨越被根系抬起的两级安全台阶", "用无害孢子和兽爪痕预告幽林生态"],
    enemyPolicy: "完整2屏不封锁；仅以远处兽影和飞散墨鸦做非战斗预告。",
    camera: "洞穴横向rail；中段巨根遮挡时把视觉中心上移10u。",
    streaming: "巨根遮挡构成天然卸载门；菌光达到50%后切换环境音与雾参数。",
    segments: [
      { id: "mf-a", name: "废轨根穴", bounds: { x: 4180, y: 570, w: 180, h: 300 }, floors: [{ x: 4180, y: 765, w: 90 }, { x: 4270, y: 760, w: 90 }], route: [{ mode: "walk", from: point(4180, 765), to: point(4270, 760) }, { mode: "walk", from: point(4270, 760), to: point(4360, 760), note: "废轨被根系抬起" }], safeRespawn: point(4230, 760), cameraRail: [point(4180, 710), point(4360, 705)], material: "赤铁矿壁、铁轨、焦木", gameplay: "离开矿区战斗并确认回程", streamingChunk: "tr-mine-forest-a" },
      { id: "mf-b", name: "巨根菌洞", bounds: { x: 4360, y: 570, w: 180, h: 300 }, floors: [{ x: 4360, y: 760, w: 90 }, { x: 4450, y: 750, w: 90 }], route: [{ mode: "stairs", from: point(4360, 760), to: point(4450, 755) }, { mode: "stairs", from: point(4450, 755), to: point(4540, 750), note: "巨根两级安全台阶" }], safeRespawn: point(4410, 755), cameraRail: [point(4360, 705), point(4540, 695)], material: "湿土、巨根、荧光菌簇", gameplay: "以无害孢子和兽爪痕预告幽林", streamingChunk: "tr-mine-forest-b" },
    ],
  },
  {
    id: "forest-cliff",
    fromZone: "forest",
    toZone: "cliff",
    sourceRoom: "f5",
    targetRoom: "c1",
    orientation: "horizontal",
    x: 5580,
    y: 490,
    width: 360,
    height: 300,
    title: "枯林断崖索桥",
    note: "孢子幽林 → 断云天险 · 2屏由封闭林地过渡到开阔高空",
    landmark: "枯松门框、索桥锚塔和第一座远山寺檐",
    materialPhases: ["黑松根、孢子泥、朽木", "枯木锚桩、绳索、裸岩", "青灰崖石、风铃、悬空栈板"],
    gameplayPhases: ["树林逐渐稀疏并降低地面敌压力", "安全桥段教学风场但不推落玩家", "桥尾以单只墨鸦预告空中威胁"],
    enemyPolicy: "桥面不设置近战夹击；墨鸦必须从正前方长预警入场。",
    camera: "从林地紧跟切换为宽前视；桥中央允许远景视差完全展开。",
    streaming: "枯松门后卸载森林深层粒子；锚塔后预载悬寺上层轮廓。",
    segments: [
      { id: "fc-a", name: "枯松锚台", bounds: { x: 5580, y: 490, w: 180, h: 300 }, floors: [{ x: 5580, y: 730, w: 100 }, { x: 5680, y: 700, w: 80 }], route: [{ mode: "stairs", from: point(5680, 730), to: point(5740, 710) }, { mode: "stairs", from: point(5740, 710), to: point(5800, 690), note: "枯根收束到裸岩锚台" }], safeRespawn: point(5700, 720), cameraRail: [point(5680, 675), point(5800, 640)], material: "黑松根、朽木、裸岩锚桩", gameplay: "林地敌退出，风铃开始提示风向", streamingChunk: "tr-forest-cliff-a" },
      { id: "fc-b", name: "安全风桥", bounds: { x: 5760, y: 490, w: 180, h: 300 }, floors: [{ x: 5760, y: 690, w: 40 }, { x: 5800, y: 680, w: 140 }], bridges: [{ x1: 5800, x2: 5940, y: 680, type: "suspension" }], route: [{ mode: "stairs", from: point(5800, 690), to: point(5840, 680) }, { mode: "walk", from: point(5840, 680), to: point(5940, 680), note: "弱风索桥；两端安全落脚" }], safeRespawn: point(5820, 680), cameraRail: [point(5800, 640), point(5940, 630)], material: "绳索、青灰崖石、悬空栈板", gameplay: "弱风只修正跳跃，不直接推落玩家", streamingChunk: "tr-forest-cliff-b" },
    ],
  },
  {
    id: "cliff-palace",
    fromZone: "cliff",
    toZone: "palace",
    sourceRoom: "c10",
    targetRoom: "p1",
    orientation: "horizontal",
    x: 6940,
    y: 500,
    width: 360,
    height: 310,
    title: "云瀑泄洪道",
    note: "断云天险 → 沉水行宫 · 2屏顺坡进入水工建筑",
    landmark: "崖壁瀑布穿过巨大石闸，远处出现行宫飞檐倒影",
    materialPhases: ["裸岩、云雾、悬索", "引水槽、闸链、湿石阶", "白石柱、琉璃瓦、水镜地面"],
    gameplayPhases: ["试剑峰后降压下坡", "用两段缓坡介绍湿滑地面与浅水", "闸后恢复正常移动并进入行宫主廊"],
    enemyPolicy: "两屏均不封锁；只在行宫端放1名远程敌作为视线教学。",
    camera: "分两段下压共25u；闸门下方短暂锁定，避免看见未加载水面。",
    streaming: "瀑布水幕承担遮挡；穿水幕后切换反射、混响与水面模拟。",
    segments: [
      { id: "cp-a", name: "崖壁泄水坡", bounds: { x: 6940, y: 500, w: 180, h: 310 }, floors: [{ x: 6940, y: 645, w: 70 }, { x: 7010, y: 665, w: 110 }], route: [{ mode: "stairs", from: point(6940, 645), to: point(7030, 665) }, { mode: "stairs", from: point(7030, 665), to: point(7120, 680), note: "分段泄水坡" }], safeRespawn: point(6990, 655), cameraRail: [point(6940, 595), point(7120, 625)], material: "裸岩、云雾、引水槽", gameplay: "试剑峰后降压并介绍湿滑坡面", streamingChunk: "tr-cliff-palace-a" },
      { id: "cp-b", name: "石闸水幕", bounds: { x: 7120, y: 500, w: 180, h: 310 }, floors: [{ x: 7120, y: 680, w: 90 }, { x: 7210, y: 690, w: 90 }], route: [{ mode: "stairs", from: point(7120, 680), to: point(7210, 690) }, { mode: "walk", from: point(7210, 690), to: point(7300, 690), note: "水幕前后安全平台" }], safeRespawn: point(7170, 685), cameraRail: [point(7120, 625), point(7300, 640)], material: "闸链、湿石阶、白石柱", gameplay: "穿水幕后恢复正常移动并进入行宫", streamingChunk: "tr-cliff-palace-b" },
    ],
  },
  {
    id: "palace-peak",
    fromZone: "palace",
    toZone: "peak",
    sourceRoom: "p5",
    targetRoom: "k1",
    orientation: "compound",
    x: 8300,
    y: 450,
    width: 470,
    height: 500,
    title: "水镜登天阶",
    note: "沉水行宫 → 无明绝顶 · 2屏能力门与垂直升景",
    landmark: "破碎宫门、水镜阶和云上天门沿同一轴线抬升",
    materialPhases: ["淹水宫墙、龙纹柱、碎瓦", "水镜阶、升流、悬浮石片", "白岩云台、碑刻、无相殿剪影"],
    gameplayPhases: ["水镜信物开启破碎宫门", "沿水镜阶连续上升并复测水行符", "云台安全落脚后交还完整移动控制"],
    enemyPolicy: "能力门内不刷普通敌；登顶后延迟一屏再放无面剑侍。",
    camera: "横向前视逐步转为垂直rail，上升结束后柔和吸附到绝顶主廊。",
    streaming: "宫门关闭后卸载行宫水下层；云雾覆盖70%画面时预载绝顶远景。",
    segments: [
      { id: "pk-a", name: "破碎宫门水镜阶", bounds: { x: 8300, y: 800, w: 235, h: 300 }, floors: [{ x: 8300, y: 1070, w: 80 }, { x: 8380, y: 1020, w: 80 }, { x: 8460, y: 970, w: 75 }], route: [{ mode: "stairs", from: point(8300, 1070), to: point(8380, 1020), requires: ["water_memento"] }, { mode: "stairs", from: point(8380, 1020), to: point(8460, 970), requires: ["water_memento"] }, { mode: "stairs", from: point(8460, 970), to: point(8535, 920), requires: ["water_memento"], note: "三段水镜台阶" }], safeRespawn: point(8340, 1050), cameraRail: [point(8300, 1010), point(8420, 960), point(8535, 865)], material: "碎宫墙、水镜阶、悬浮石片", gameplay: "连续复测水行符与水镜信物", streamingChunk: "tr-palace-peak-a" },
      { id: "pk-b", name: "云雾升流平台", bounds: { x: 8535, y: 450, w: 235, h: 470 }, floors: [{ x: 8535, y: 920, w: 85 }, { x: 8620, y: 870, w: 150 }, { x: 8700, y: 820, w: 70 }], elevators: [{ x: 8770, y: 800, h: 100 }], route: [{ mode: "stairs", from: point(8535, 920), to: point(8620, 870), requires: ["water_memento"] }, { mode: "walk", from: point(8620, 870), to: point(8770, 870), requires: ["water_memento"] }, { mode: "elevator", from: point(8770, 870), to: point(8770, 820), deviceX: 8770, requires: ["water_memento"], note: "云雾升流接绝顶安全台" }], safeRespawn: point(8580, 900), cameraRail: [point(8535, 865), point(8680, 820), point(8770, 770)], material: "水镜升流、白岩云台、碑刻", gameplay: "垂直rail结束后恢复横向前视", streamingChunk: "tr-palace-peak-b" },
    ],
  },
];

const validateTransitions = () => {
  const errors: string[] = [];
  const zoneById = new Map(ZONES.map((zone) => [zone.id, zone]));
  const roomById = new Map(ROOMS.map((room) => [room.id, room]));
  const pointInside = (at: PointU, box: { x: number; y: number; w: number; h: number }, padding = PLAYER_METRICS.height) =>
    at.x >= box.x - padding && at.x <= box.x + box.w + padding && at.y >= box.y - padding && at.y <= box.y + box.h + padding;
  for (let index = 0; index < ZONES.length - 1; index += 1) {
    const from = ZONES[index];
    const to = ZONES[index + 1];
    const transition = TRANSITIONS.find((item) => item.fromZone === from.id && item.toZone === to.id);
    if (!transition) {
      errors.push(`${from.id}>${to.id} 缺少过渡模块`);
      continue;
    }
    if (transition.orientation === "horizontal" && (transition.width < GAME_SCREEN_UNITS.w || transition.width > GAME_SCREEN_UNITS.w * 2)) {
      errors.push(`${transition.id} 宽度必须保持在1–2屏`);
    }
    if (transition.orientation === "compound" && transition.width > GAME_SCREEN_UNITS.w * 3) {
      errors.push(`${transition.id} 复合过渡水平跨度超过3屏`);
    }
    if (transition.x > from.x + from.width || transition.x + transition.width < to.x) {
      errors.push(`${transition.id} 没有同时覆盖两个区域边界`);
    }
    if (!zoneById.has(transition.fromZone) || !zoneById.has(transition.toZone)) {
      errors.push(`${transition.id} 引用了未知区域`);
    }
    const sourceRoom = roomById.get(transition.sourceRoom);
    const targetRoom = roomById.get(transition.targetRoom);
    if (!sourceRoom || !targetRoom) {
      errors.push(`${transition.id} 缺少来源或目标房间`);
      continue;
    }
    const route = transition.segments.flatMap((segment) => segment.route);
    if (!route.length || !pointInside(route[0].from, sourceRoom)) errors.push(`${transition.id} 入口锚点不在来源房间`);
    if (!route.length || !pointInside(route[route.length - 1].to, targetRoom)) errors.push(`${transition.id} 出口锚点不在目标房间`);
    for (let routeIndex = 1; routeIndex < route.length; routeIndex += 1) {
      const previous = route[routeIndex - 1].to;
      const current = route[routeIndex].from;
      if (Math.hypot(previous.x - current.x, previous.y - current.y) > PLAYER_METRICS.ladderGrab) {
        errors.push(`${transition.id} 第${routeIndex + 1}段物理路线不连续`);
      }
    }
    for (const segment of transition.segments) {
      if (!pointInside(segment.safeRespawn, segment.bounds, 0)) errors.push(`${segment.id} 安全重生点超出场景段`);
      if (!segment.floors.length) errors.push(`${segment.id} 缺少真实地板`);
      if (segment.cameraRail.length < 2) errors.push(`${segment.id} 摄影机轨道不足2点`);
    }
  }
  if (errors.length) throw new Error(`区域过渡校验失败:\n${errors.join("\n")}`);
  return { count: TRANSITIONS.length, screens: TRANSITIONS.reduce((sum, item) => sum + (item.orientation === "compound" ? 2 : item.width / GAME_SCREEN_UNITS.w), 0) } as const;
};

const TRANSITION_VALIDATION = validateTransitions();

const TRANSITION_FLOORS = TRANSITIONS.flatMap((transition) => transition.segments.flatMap((segment) => segment.floors));
const TRANSITION_BRIDGES = TRANSITIONS.flatMap((transition) => transition.segments.flatMap((segment) => segment.bridges ?? []));
const TRANSITION_LADDERS = TRANSITIONS.flatMap((transition) => transition.segments.flatMap((segment) => segment.ladders ?? []));
const TRANSITION_ELEVATORS = TRANSITIONS.flatMap((transition) => transition.segments.flatMap((segment) => segment.elevators ?? []));

const FLOORS = [
  // gate mid long
  [70, 810, 180], [250, 800, 190], [440, 795, 190], [630, 790, 190], [820, 790, 200],
  [1020, 785, 190], [1210, 780, 180], [1400, 780, 160], [960, 560, 210], [460, 1030, 200], [700, 1030, 220],
  // town mid long + roof + sewer
  [1560, 790, 200], [1760, 780, 190], [1950, 775, 190], [2140, 770, 200], [2340, 765, 190],
  [2530, 760, 200], [2730, 755, 180], [1740, 510, 180], [2080, 470, 240], [2560, 490, 200],
  [2180, 1090, 240], [2440, 1090, 240],
  // mine
  [2980, 760, 200], [3180, 755, 190], [3370, 750, 200], [3580, 720, 180], [3770, 755, 190],
  [3960, 760, 200], [4120, 755, 160], [3650, 1010, 270], [3900, 1010, 230], [3260, 1130, 220], [3520, 1130, 230], [4120, 1140, 220],
  // junction tunnel floor
  [4280, 750, 240],
  // forest
  [4380, 740, 180], [4520, 740, 170], [4700, 730, 180], [4890, 740, 190],
  [5030, 520, 270], [5340, 525, 200], [5070, 935, 190], [5310, 930, 240], [5520, 705, 170], [5660, 730, 180],
  [4600, 1020, 200], [4820, 1020, 200],
  // cliff
  [5780, 670, 200], [5980, 660, 190], [6170, 650, 210], [6380, 645, 190], [6570, 640, 190],
  [6760, 635, 190], [6280, 440, 210], [6600, 370, 190], [6820, 230, 210], [5900, 880, 190], [6140, 890, 260],
  // palace
  [7180, 680, 200], [7380, 670, 190], [7570, 665, 200], [7770, 660, 200], [7970, 655, 200],
  [8170, 650, 190], [7860, 460, 230], [7460, 1020, 320], [8060, 1060, 250], [7160, 880, 250],
  // peak
  [8580, 820, 210], [8720, 890, 100], [8810, 760, 190], [9050, 625, 190], [8810, 490, 200], [9110, 360, 200],
  [9310, 530, 220], [9640, 460, 200], [9360, 300, 210], [9770, 260, 210], [9130, 810, 210],
] as const;

const HOUSES = [
  { x: 90, y: 700, w: 130, h: 110, roof: "gable" },
  { x: 990, y: 430, w: 150, h: 120, roof: "temple" },
  { x: 1600, y: 660, w: 150, h: 130, roof: "gable" },
  { x: 1980, y: 650, w: 160, h: 125, roof: "temple" },
  { x: 1780, y: 400, w: 140, h: 110, roof: "gable" },
  { x: 2590, y: 250, w: 160, h: 120, roof: "tower" },
  { x: 3930, y: 860, w: 180, h: 130, roof: "organic" },
  { x: 5120, y: 365, w: 170, h: 130, roof: "organic" },
  { x: 6320, y: 300, w: 160, h: 130, roof: "temple" },
  { x: 6840, y: 110, w: 150, h: 110, roof: "tower" },
  { x: 7890, y: 310, w: 200, h: 130, roof: "palace" },
  { x: 9380, y: 150, w: 170, h: 130, roof: "temple" },
  { x: 9780, y: 110, w: 180, h: 130, roof: "palace" },
] as const;

const BRIDGES = [
  { x1: 6180, x2: 6400, y: 560, type: "suspension" },
  { x1: 3680, x2: 3920, y: 1010, type: "timber" },
  { x1: 4130, x2: 4200, y: 1010, type: "timber" },
  { x1: 3750, x2: 3790, y: 755, type: "timber" },
  { x1: 6660, x2: 6740, y: 230, type: "timber" },
  { x1: 9490, x2: 9570, y: 520, type: "stone" },
  { x1: 660, x2: 720, y: 1030, type: "timber" },
  { x1: 2400, x2: 2460, y: 1090, type: "stone" },
  { x1: 3480, x2: 3540, y: 1130, type: "timber" },
  { x1: 4880, x2: 4910, y: 730, type: "timber" },
  { x1: 5270, x2: 5300, y: 715, type: "timber" },
  { x1: 5470, x2: 5500, y: 710, type: "timber" },
  { x1: 5270, x2: 5380, y: 720, type: "timber" },
  { x1: 4800, x2: 4840, y: 1020, type: "timber" },
  { x1: 6090, x2: 6160, y: 880, type: "suspension" },
  { x1: 5300, x2: 5350, y: 525, type: "timber" },
  { x1: 5260, x2: 5320, y: 930, type: "timber" },
  { x1: 7400, x2: 7480, y: 1020, type: "stone" },
] as const;

const LADDERS = [
  { x: 1065, y1: 560, y2: 785 }, { x: 920, y1: 790, y2: 1030 },
  { x: 1835, y1: 510, y2: 780 }, { x: 2200, y1: 470, y2: 770 }, { x: 2665, y1: 250, y2: 760 },
  { x: 2640, y1: 700, y2: 1090 }, { x: 3680, y1: 620, y2: 980 }, { x: 3750, y1: 755, y2: 1130 },
  { x: 4930, y1: 725, y2: 1020 }, { x: 5050, y1: 520, y2: 740 }, { x: 5070, y1: 740, y2: 935 },
  { x: 5430, y1: 525, y2: 930 }, { x: 5530, y1: 705, y2: 930 }, { x: 6390, y1: 440, y2: 890 },
  { x: 6700, y1: 230, y2: 370 },
  { x: 7980, y1: 460, y2: 655 }, { x: 7400, y1: 880, y2: 1020 }, { x: 7620, y1: 675, y2: 1020 },
  { x: 7260, y1: 690, y2: 880 }, { x: 9470, y1: 300, y2: 530 },
  { x: 8770, y1: 650, y2: 890 }, { x: 9820, y1: 260, y2: 460 },
] as const;

const ELEVATORS = [
  { x: 3680, y: 520, h: 490 }, { x: 4200, y: 760, h: 380 }, { x: 8260, y: 560, h: 510 },
  { x: 8760, y: 560, h: 330 }, { x: 9330, y: 510, h: 300 },
] as const;

const WIND_FIELDS = [
  { id: "crosswind-bridge", x: 6170, y: 500, w: 250, h: 180, direction: "east", title: "横风长桥", rule: "顺风8秒 / 逆风4秒；顺风可借势越桥，逆风时退入石柱背风面。" },
  { id: "temple-updraft", x: 6325, y: 300, w: 120, h: 350, direction: "up", title: "悬寺升风", rule: "持续上升气流；可快速升到悬寺，失误落回风铃栈台。" },
  { id: "summit-gust", x: 6620, y: 120, w: 330, h: 260, direction: "west", title: "试剑峰阵风", rule: "阵风推动空中单位和玩家；佛龛、岩柱后形成安全驻足区。" },
] as const;

const WATER_ROUTE_SEGMENTS = {
  high: [
    [7380, 615, 7485, 610], [7570, 605, 7680, 600], [7770, 595, 7880, 590],
    [7970, 585, 8080, 580], [8170, 575, 8275, 575],
  ],
  low: [
    [7280, 690, 7260, 800], [7400, 880, 7400, 1020], [7400, 1020, 7480, 1020],
    [7620, 675, 7620, 1020], [7760, 1030, 8080, 1060], [8260, 1060, 8260, 660],
  ],
} as const;

const physicalKey = (from: string, to: string) => `${from}>${to}`;

/** Explicit routes for vertical, one-way, water and compound transitions. */
const PHYSICAL_OVERRIDES: Record<string, PhysicalOverride> = {
  "g7>g5": { steps: [{ mode: "drop", from: point(545, 805), to: point(570, 1030), note: "柴棚落口" }], returnVia: "g5 → g11 → g3" },
  "g11>g3": { steps: [{ mode: "ladder", from: point(920, 1030), to: point(920, 790), deviceX: 920 }] },
  "g9>g4": { steps: [{ mode: "ladder", from: point(1065, 785), to: point(1065, 560), deviceX: 1065 }] },
  "t8>t7": { steps: [{ mode: "ladder", from: point(1835, 780), to: point(1835, 510), deviceX: 1835 }] },
  "t9>t4": { steps: [{ mode: "ladder", from: point(2200, 770), to: point(2200, 470), deviceX: 2200 }] },
  "t10>t5": { steps: [{ mode: "ladder", from: point(2665, 760), to: point(2665, 490), deviceX: 2665 }] },
  "t9>t6": { steps: [{ mode: "smash_drop", from: point(2250, 770), to: point(2250, 1090), requires: ["ground_slam"], note: "脆地单向坠入" }], returnVia: "t6 → t12 → t10" },
  "t12>t10": { steps: [{ mode: "ladder", from: point(2640, 1090), to: point(2640, 760), deviceX: 2640 }] },
  "m2>m4": {
    steps: [
      { mode: "elevator", from: point(3680, 720), to: point(3680, 1010), deviceX: 3680 },
      { mode: "walk", from: point(3680, 1010), to: point(3920, 1010), note: "熔炉下层栈桥" },
    ],
  },
  "m4>m6": {
    steps: [
      { mode: "walk", from: point(4130, 1010), to: point(4200, 1010), note: "侧井停靠桥" },
      { mode: "elevator", from: point(4200, 1010), to: point(4200, 1140), deviceX: 4200 },
    ],
  },
  "m8>m5": { steps: [{ mode: "smash_drop", from: point(3480, 750), to: point(3480, 1130), requires: ["ground_slam"], note: "矿底脆地" }], returnVia: "m5 → m11 → m9" },
  "m11>m9": {
    steps: [
      { mode: "ladder", from: point(3750, 1130), to: point(3750, 755), deviceX: 3750 },
      { mode: "walk", from: point(3750, 755), to: point(3790, 755), note: "通风横巷落脚台" },
    ],
  },
  "m11>m4": { steps: [{ mode: "stairs", from: point(3750, 1130), to: point(3920, 1010), note: "矿底斜坡接熔炉下层" }] },
  "f2>f3": {
    steps: [
      { mode: "ladder", from: point(5050, 740), to: point(5050, 520), deviceX: 5050 },
      { mode: "walk", from: point(5050, 520), to: point(5110, 520), note: "倒生树根上层落脚" },
    ],
  },
  "f3>f9": { steps: [{ mode: "walk", from: point(5300, 520), to: point(5350, 525), note: "树冠横桥" }] },
  "f9>f4": { steps: [{ mode: "ladder", from: point(5430, 525), to: point(5430, 930), deviceX: 5430, note: "树腔梯进入温室东门" }] },
  "f2>f8": { steps: [{ mode: "ladder", from: point(5070, 740), to: point(5070, 935), deviceX: 5070, note: "根谷垂梯" }] },
  "f8>f4": { steps: [{ mode: "walk", from: point(5260, 935), to: point(5320, 930), note: "低路根桥进入温室西门" }] },
  "f4>f10": { steps: [{ mode: "ladder", from: point(5530, 930), to: point(5530, 705), deviceX: 5530, note: "战后升根桥" }] },
  "f7>f6": {
    steps: [
      { mode: "stairs", from: point(4800, 730), to: point(4680, 850), requires: ["breath_control"] },
      { mode: "stairs", from: point(4680, 850), to: point(4800, 970), requires: ["breath_control"] },
      { mode: "stairs", from: point(4800, 970), to: point(4750, 1020), requires: ["breath_control"] },
      { mode: "walk", from: point(4750, 1020), to: point(4800, 1020), requires: ["breath_control"] },
    ],
  },
  "f11>f2": { steps: [{ mode: "ladder", from: point(4930, 1020), to: point(4930, 725), deviceX: 4930 }] },
  "c7>c6": { steps: [{ mode: "drop", from: point(6050, 665), to: point(6050, 880), note: "崩崖单向落口" }], returnVia: "c6 → c11 → c2" },
  "c2>c8": { steps: [{ mode: "wind", from: point(6190, 660), to: point(6400, 650), note: "横风长桥：观察风铃后借顺风跃迁" }] },
  "c11>c8": { steps: [{ mode: "ladder", from: point(6390, 890), to: point(6390, 650), deviceX: 6390, note: "背风石窟回到风铃栈台" }] },
  "c8>c3": { steps: [{ mode: "ladder", from: point(6400, 650), to: point(6390, 440), deviceX: 6390 }] },
  "c3>c4": { steps: [{ mode: "stairs", from: point(6480, 440), to: point(6620, 370), note: "悬寺东侧上山阶" }] },
  "c4>c5": {
    steps: [
      { mode: "ladder", from: point(6700, 370), to: point(6700, 230), deviceX: 6700 },
      { mode: "stairs", from: point(6700, 230), to: point(6840, 240), note: "鹰巢顶层接试剑峰" },
    ],
  },
  "c5>c9": {
    steps: [
      { mode: "stairs", from: point(7020, 240), to: point(6900, 360) },
      { mode: "stairs", from: point(6900, 360), to: point(6780, 480) },
      { mode: "stairs", from: point(6780, 480), to: point(6660, 600) },
      { mode: "stairs", from: point(6660, 600), to: point(6760, 650), note: "试剑峰下山回主廊" },
    ],
  },
  "p8>p3": { steps: [{ mode: "ladder", from: point(7970, 665), to: point(7980, 460), deviceX: 7980 }] },
  "p1>p6": { steps: [{ mode: "ladder", from: point(7260, 690), to: point(7260, 880), deviceX: 7260, requires: ["water_talisman"], note: "低水位露出的闸尺梯" }] },
  "p6>p4": {
    steps: [
      { mode: "ladder", from: point(7400, 880), to: point(7400, 1020), deviceX: 7400, requires: ["water_talisman"], note: "排水检修梯" },
      { mode: "walk", from: point(7400, 1020), to: point(7480, 1020), requires: ["water_talisman"], note: "低水位露出的检修廊" },
    ],
  },
  "p2>p4": { steps: [{ mode: "ladder", from: point(7620, 675), to: point(7620, 1020), deviceX: 7620, requires: ["water_talisman"], note: "低水位回水梯" }] },
  "p4>p5": { steps: [{ mode: "swim", from: point(7760, 1030), to: point(8080, 1060), requires: ["water_talisman"] }] },
  "p5>p10": { steps: [{ mode: "elevator", from: point(8260, 1060), to: point(8260, 660), deviceX: 8260, requires: ["water_talisman"], note: "祭坛水镜升流回主廊" }] },
  "k5>k3": {
    steps: [
      { mode: "walk", from: point(9470, 530), to: point(9470, 530), note: "望台云梯控制端" },
      { mode: "ladder", from: point(9470, 530), to: point(9470, 300), deviceX: 9470 },
    ],
  },
  "k3>k10": { steps: [{ mode: "stairs", from: point(9560, 300), to: point(9650, 370) }, { mode: "stairs", from: point(9650, 370), to: point(9590, 420) }, { mode: "stairs", from: point(9590, 420), to: point(9650, 460), note: "祭坛折返下行至终局前廊" }] },
  "k10>k4": { steps: [{ mode: "ladder", from: point(9820, 460), to: point(9820, 260), deviceX: 9820 }] },
  "k1>k7": { steps: [{ mode: "stairs", from: point(8780, 820), to: point(8830, 760), note: "水镜天门第一折" }] },
  "k7>k8": { steps: [{ mode: "stairs", from: point(8990, 760), to: point(9060, 700) }, { mode: "stairs", from: point(9060, 700), to: point(9000, 650) }, { mode: "stairs", from: point(9000, 650), to: point(9060, 625), note: "云阶右上折" }] },
  "k8>k2": { steps: [{ mode: "stairs", from: point(9060, 625), to: point(9000, 575) }, { mode: "stairs", from: point(9000, 575), to: point(9060, 525) }, { mode: "stairs", from: point(9060, 525), to: point(9000, 490), note: "望月台折返向左上" }] },
  "k9>k5": {
    steps: [
      { mode: "drop", from: point(9300, 360), to: point(9310, 384) }, { mode: "drop", from: point(9310, 384), to: point(9320, 408) },
      { mode: "drop", from: point(9320, 408), to: point(9330, 432) }, { mode: "drop", from: point(9330, 432), to: point(9340, 456) },
      { mode: "drop", from: point(9340, 456), to: point(9350, 480) }, { mode: "drop", from: point(9350, 480), to: point(9360, 504) },
      { mode: "drop", from: point(9360, 504), to: point(9370, 530), note: "碑林东侧七级受控回落" },
    ],
    returnVia: "k5 → k6 → k7 → k8 → k2 → k9",
  },
  "k5>k6": { steps: [{ mode: "elevator", from: point(9330, 530), to: point(9330, 810), deviceX: 9330, note: "启动后永久开放的折返云梯" }] },
  "k6>k7": { steps: [{ mode: "stairs", from: point(9140, 810), to: point(8990, 760), note: "捷径回接第一折云阶" }] },
  "k6>t4": { steps: [{ mode: "portal", from: point(9230, 810), to: point(2200, 470), requires: ["return_portal"] }] },
};

const roomFloorY = (room: Room) => room.y + room.h;

const defaultPhysicalStep = (link: RoomLink, fromRoom: Room, toRoom: Room): PhysicalStep => {
  if (link.kind === "portal") {
    return { mode: "portal", from: point(fromRoom.x + fromRoom.w / 2, roomFloorY(fromRoom)), to: point(toRoom.x + toRoom.w / 2, roomFloorY(toRoom)) };
  }

  const fromCenterX = fromRoom.x + fromRoom.w / 2;
  const toCenterX = toRoom.x + toRoom.w / 2;
  const towardRight = toCenterX >= fromCenterX;
  const from = point(towardRight ? fromRoom.x + fromRoom.w : fromRoom.x, roomFloorY(fromRoom));
  const to = point(towardRight ? toRoom.x : toRoom.x + toRoom.w, roomFloorY(toRoom));
  const dx = Math.abs(to.x - from.x);
  const dy = to.y - from.y;

  if (link.oneWay) {
    return { mode: toRoom.requires?.includes("ground_slam") ? "smash_drop" : "drop", from, to, requires: toRoom.requires };
  }
  if (Math.abs(dy) <= PLAYER_METRICS.height) return { mode: "walk", from, to, requires: toRoom.requires };
  if (dx <= PLAYER_METRICS.runJumpWidth && -dy <= PLAYER_METRICS.jumpHeight && dy <= PLAYER_METRICS.safeFall) {
    return { mode: "jump", from, to, requires: toRoom.requires };
  }
  return { mode: "stairs", from, to, requires: toRoom.requires, note: "自动推断；需检查中间台阶" };
};

const hasHorizontalSupport = (from: PointU, to: PointU) => {
  const minX = Math.min(from.x, to.x);
  const maxX = Math.max(from.x, to.x);
  const targetY = (from.y + to.y) / 2;
  const intervals = [
    ...FLOORS.map(([x, y, w]) => ({ x1: x, x2: x + w, y })),
    ...TRANSITION_FLOORS.map((floor) => ({ x1: floor.x, x2: floor.x + floor.w, y: floor.y })),
    ...BRIDGES.map((bridge) => ({ x1: bridge.x1, x2: bridge.x2, y: bridge.y })),
    ...TRANSITION_BRIDGES.map((bridge) => ({ x1: bridge.x1, x2: bridge.x2, y: bridge.y })),
  ]
    .filter((segment) => Math.abs(segment.y - targetY) <= PLAYER_METRICS.height * 1.5 && segment.x2 >= minX && segment.x1 <= maxX)
    .sort((a, b) => a.x1 - b.x1);
  let coveredTo = minX;
  for (const interval of intervals) {
    if (interval.x1 > coveredTo + PLAYER_METRICS.ladderGrab * 2) return false;
    coveredTo = Math.max(coveredTo, interval.x2);
    if (coveredTo >= maxX) return true;
  }
  return coveredTo >= maxX;
};

const hasLanding = (at: PointU) =>
  FLOORS.some(([x, y, w]) => at.x >= x - PLAYER_METRICS.ladderGrab && at.x <= x + w + PLAYER_METRICS.ladderGrab && Math.abs(y - at.y) <= PLAYER_METRICS.height * 1.5)
  || TRANSITION_FLOORS.some((floor) => at.x >= floor.x - PLAYER_METRICS.ladderGrab && at.x <= floor.x + floor.w + PLAYER_METRICS.ladderGrab && Math.abs(floor.y - at.y) <= PLAYER_METRICS.height * 1.5)
  || BRIDGES.some((bridge) => at.x >= bridge.x1 - PLAYER_METRICS.ladderGrab && at.x <= bridge.x2 + PLAYER_METRICS.ladderGrab && Math.abs(bridge.y - at.y) <= PLAYER_METRICS.height * 1.5)
  || TRANSITION_BRIDGES.some((bridge) => at.x >= bridge.x1 - PLAYER_METRICS.ladderGrab && at.x <= bridge.x2 + PLAYER_METRICS.ladderGrab && Math.abs(bridge.y - at.y) <= PLAYER_METRICS.height * 1.5);

const pointInRoom = (at: PointU, room: Room, padding = PLAYER_METRICS.height) =>
  at.x >= room.x - padding && at.x <= room.x + room.w + padding && at.y >= room.y - padding && at.y <= room.y + room.h + padding;

const auditPhysicalStep = (step: PhysicalStep, link: RoomLink): PhysicalIssue[] => {
  const issues: PhysicalIssue[] = [];
  const dx = Math.abs(step.to.x - step.from.x);
  const dy = step.to.y - step.from.y;

  if (step.mode === "walk") {
    if (Math.abs(dy) > PLAYER_METRICS.height) issues.push({ severity: "error", message: `步行高差 ${Math.abs(dy).toFixed(0)}u 超过 1 个角色高度` });
    if (dx > PLAYER_METRICS.runJumpWidth && !hasHorizontalSupport(step.from, step.to)) issues.push({ severity: "error", message: `步行跨度 ${dx.toFixed(0)}u 缺少连续地板或桥面` });
  }
  if (step.mode === "jump") {
    if (dx > PLAYER_METRICS.runJumpWidth) issues.push({ severity: "error", message: `跑跳跨度 ${dx.toFixed(0)}u > ${PLAYER_METRICS.runJumpWidth}u` });
    if (-dy > PLAYER_METRICS.jumpHeight) issues.push({ severity: "error", message: `上跳高度 ${(-dy).toFixed(0)}u > ${PLAYER_METRICS.jumpHeight}u` });
    if (dy > PLAYER_METRICS.safeFall) issues.push({ severity: "error", message: `落差 ${dy.toFixed(0)}u > 安全落差 ${PLAYER_METRICS.safeFall}u` });
  }
  if (step.mode === "stairs") {
    const slope = dx === 0 ? Infinity : Math.abs(dy) / dx;
    if (slope > 1.2) issues.push({ severity: "error", message: `台阶坡度 ${slope.toFixed(2)} 过陡` });
    if (Math.hypot(dx, dy) > GAME_SCREEN_UNITS.w * 1.25) issues.push({ severity: "warning", message: "单段台阶超过一屏，建议增加中间锚点" });
  }
  if (step.mode === "ladder") {
    const ladder = [...LADDERS, ...TRANSITION_LADDERS].find((item) => Math.abs(item.x - (step.deviceX ?? step.from.x)) <= PLAYER_METRICS.ladderGrab);
    if (!ladder) issues.push({ severity: "error", message: `未找到 x=${step.deviceX ?? step.from.x}u 的梯子` });
    else {
      const low = Math.min(step.from.y, step.to.y);
      const high = Math.max(step.from.y, step.to.y);
      if (ladder.y1 > low + PLAYER_METRICS.height * 1.5 || ladder.y2 < high - PLAYER_METRICS.height * 1.5) {
        issues.push({ severity: "error", message: "梯子长度未覆盖两个出入口" });
      }
      if (!hasLanding(step.from)) issues.push({ severity: "error", message: "梯子起点没有可站立地板" });
      if (!hasLanding(step.to)) issues.push({ severity: "error", message: "梯子终点没有可站立地板" });
    }
  }
  if (step.mode === "elevator") {
    const elevator = [...ELEVATORS, ...TRANSITION_ELEVATORS].find((item) => Math.abs(item.x - (step.deviceX ?? step.from.x)) <= PLAYER_METRICS.ladderGrab * 2);
    if (!elevator) issues.push({ severity: "error", message: `未找到 x=${step.deviceX ?? step.from.x}u 的升降梯` });
    else {
      const low = Math.min(step.from.y, step.to.y);
      const high = Math.max(step.from.y, step.to.y);
      if (low < elevator.y - PLAYER_METRICS.height * 2 || high > elevator.y + elevator.h + PLAYER_METRICS.height * 2) {
        issues.push({ severity: "error", message: "升降梯行程未覆盖两个停靠层" });
      }
      if (!hasLanding(step.from)) issues.push({ severity: "warning", message: "升降梯起点需补停靠平台" });
      if (!hasLanding(step.to)) issues.push({ severity: "warning", message: "升降梯终点需补停靠平台" });
    }
  }
  if (step.mode === "drop" || step.mode === "smash_drop") {
    if (!link.oneWay) issues.push({ severity: "error", message: "坠落连接必须标记为单向" });
    if (dy <= 0) issues.push({ severity: "error", message: "坠落终点必须低于起点" });
    if (dy > PLAYER_METRICS.safeFall) issues.push({ severity: "warning", message: `落差 ${dy.toFixed(0)}u 超过安全值，需布置分段落脚或无伤落地` });
    if (step.mode === "smash_drop" && !step.requires?.includes("ground_slam")) issues.push({ severity: "error", message: "震地破口缺少震地击条件" });
  }
  if (step.mode === "wind") {
    const field = WIND_FIELDS.find((item) =>
      step.from.x >= item.x && step.from.x <= item.x + item.w
      && step.to.x >= item.x && step.to.x <= item.x + item.w
      && step.from.y >= item.y && step.from.y <= item.y + item.h
      && step.to.y >= item.y && step.to.y <= item.y + item.h);
    if (!field) issues.push({ severity: "error", message: "借风连接没有对应风场范围" });
    if (Math.hypot(dx, dy) > GAME_SCREEN_UNITS.w * 1.5) issues.push({ severity: "error", message: "单次借风跃迁超过1.5屏" });
    if (!hasLanding(step.from) || !hasLanding(step.to)) issues.push({ severity: "error", message: "风场起点或终点缺少安全落脚面" });
  }
  if (step.mode === "swim") {
    if (!step.requires?.includes("water_talisman")) issues.push({ severity: "error", message: "水路缺少水行符条件" });
    if (Math.hypot(dx, dy) > GAME_SCREEN_UNITS.w * 2) issues.push({ severity: "warning", message: "单段水路超过两屏，建议增加换气锚点" });
  }
  if (step.mode === "portal" && link.kind !== "portal") issues.push({ severity: "error", message: "传送移动必须使用 portal 连接" });
  return issues;
};

const buildPhysicalLinks = (): PhysicalLink[] => {
  const roomById = new Map(ROOMS.map((room) => [room.id, room]));
  return ROOM_LINKS.map((link) => {
    const fromRoom = roomById.get(link.from)!;
    const toRoom = roomById.get(link.to)!;
    const override = PHYSICAL_OVERRIDES[physicalKey(link.from, link.to)];
    const transition = link.transitionId ? TRANSITIONS.find((item) => item.id === link.transitionId) : undefined;
    const steps = transition?.segments.flatMap((segment) => [...segment.route]) ?? override?.steps ?? [defaultPhysicalStep(link, fromRoom, toRoom)];
    const issues = steps.flatMap((step) => auditPhysicalStep(step, link));
    if (!pointInRoom(steps[0].from, fromRoom)) issues.push({ severity: "error", message: "起点锚点不在起始房间边界附近" });
    if (!pointInRoom(steps[steps.length - 1].to, toRoom)) issues.push({ severity: "error", message: "终点锚点不在目标房间边界附近" });
    if (link.oneWay && !override?.returnVia) issues.push({ severity: "error", message: "单向连接缺少明确回程链" });
    const horizontalDistance = steps.reduce((sum, step) => sum + Math.abs(step.to.x - step.from.x), 0);
    const verticalDelta = steps[steps.length - 1].to.y - steps[0].from.y;
    return { ...link, steps, horizontalDistance, verticalDelta, issues, returnVia: override?.returnVia };
  });
};

const PHYSICAL_LINKS = buildPhysicalLinks();
const PHYSICAL_ERRORS = PHYSICAL_LINKS.flatMap((link) => link.issues.filter((issue) => issue.severity === "error"));
const PHYSICAL_WARNINGS = PHYSICAL_LINKS.flatMap((link) => link.issues.filter((issue) => issue.severity === "warning"));
const MAP_VALIDATION = {
  ...validateMapModel(),
  transitionModules: TRANSITION_VALIDATION.count,
  transitionScreens: TRANSITION_VALIDATION.screens,
  physicalLinks: PHYSICAL_LINKS.length,
  physicalErrors: PHYSICAL_ERRORS.length,
  physicalWarnings: PHYSICAL_WARNINGS.length,
} as const;

const ALL_MARKERS = Object.keys(MARKER_META) as MarkerKind[];

const roomEnemyIds = (room: Room): EnemyId[] => {
  const ids = room.encounter
    ? room.encounter.waves.flatMap((wave) => wave.units.map((unit) => unit.enemy))
    : (room.enemies ?? []);
  return [...new Set(ids)];
};

const encounterUnitCount = (encounter: EncounterPlan) =>
  encounter.waves.reduce(
    (total, wave) => total + wave.units.reduce((waveTotal, unit) => waveTotal + unit.count, 0),
    0,
  );

export default function MapDemo() {
  const [zoom, setZoom] = useState(ZOOM_DESIGN);
  const [selectedZone, setSelectedZone] = useState("town");
  const [selectedRoom, setSelectedRoom] = useState<string | null>(null);
  const [visibleEnemies, setVisibleEnemies] = useState<Set<EnemyId>>(new Set(ENEMY_ORDER));
  const [selectedEnemy, setSelectedEnemy] = useState<EnemyId | null>(null);
  const [visibleMarkers, setVisibleMarkers] = useState<Set<MarkerKind>>(new Set(ALL_MARKERS));
  const [waterLevel, setWaterLevel] = useState<"high" | "low">("high");
  const viewportRef = useRef<HTMLDivElement>(null);
  const drag = useRef({ active: false, x: 0, y: 0, left: 0, top: 0 });

  const zone = ZONES.find((item) => item.id === selectedZone) ?? ZONES[0];
  const nextTransition = TRANSITIONS.find((item) => item.fromZone === selectedZone);
  const room = ROOMS.find((item) => item.id === selectedRoom);
  const enemy = selectedEnemy ? ENEMY_META[selectedEnemy] : null;
  const enemyRooms = useMemo(
    () => (selectedEnemy ? ROOMS.filter((item) => roomEnemyIds(item).includes(selectedEnemy)) : []),
    [selectedEnemy],
  );
  const regionRooms = useMemo(() => ROOMS.filter((item) => item.zone === selectedZone), [selectedZone]);
  const regionMarkers = useMemo(
    () => MARKERS.filter((item) => item.zone === selectedZone && visibleMarkers.has(item.kind)),
    [selectedZone, visibleMarkers],
  );
  const roomPhysicalLinks = useMemo(
    () => selectedRoom
      ? PHYSICAL_LINKS.filter((link) => link.from === selectedRoom || link.to === selectedRoom)
      : [],
    [selectedRoom],
  );
  const isDesignZoom = Math.abs(zoom - ZOOM_DESIGN) < 0.05;
  const isGameZoom = Math.abs(zoom - ZOOM_GAME) < 0.05;

  const updateZoom = (next: number) => {
    setZoom(Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Number(next.toFixed(2)))));
  };

  const focusZoneAtZoom = (id: string, nextZoom: number) => {
    const target = ZONES.find((item) => item.id === id);
    if (!target) return;
    const focusTop = id === "peak" || id === "cliff" ? 0 : 280 * nextZoom;
    setSelectedZone(id);
    setSelectedRoom(null);
    // Defer scroll until canvas size updates with the new zoom.
    requestAnimationFrame(() => {
      viewportRef.current?.scrollTo({
        left: Math.max(0, target.x * nextZoom - 140),
        top: focusTop,
        behavior: "smooth",
      });
    });
  };

  const focusZone = (id: string) => focusZoneAtZoom(id, zoom);

  useEffect(() => {
    const target = ZONES.find((item) => item.id === "town");
    const frame = requestAnimationFrame(() => {
      viewportRef.current?.scrollTo({
        left: Math.max(0, (target?.x ?? 0) * ZOOM_DESIGN - 140),
        top: 280 * ZOOM_DESIGN,
      });
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  const applyZoomMode = (mode: ZoomMode) => {
    const nextZoom = mode === "game" ? ZOOM_GAME : ZOOM_DESIGN;
    setZoom(nextZoom);
    focusZoneAtZoom(selectedZone, nextZoom);
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    const el = viewportRef.current;
    if (!el) return;
    drag.current = { active: true, x: event.clientX, y: event.clientY, left: el.scrollLeft, top: el.scrollTop };
    el.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!drag.current.active || !viewportRef.current) return;
    viewportRef.current.scrollLeft = drag.current.left - (event.clientX - drag.current.x);
    viewportRef.current.scrollTop = drag.current.top - (event.clientY - drag.current.y);
  };

  const toggleEnemy = (type: EnemyId) => {
    setVisibleEnemies((current) => {
      const next = new Set(current);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  };

  const toggleMarker = (kind: MarkerKind) => {
    setVisibleMarkers((current) => {
      const next = new Set(current);
      if (next.has(kind)) next.delete(kind);
      else next.add(kind);
      return next;
    });
  };

  return (
    <main
      className="map-app"
      data-map-validation={MAP_VALIDATION.physicalErrors ? "invalid" : MAP_VALIDATION.physicalWarnings ? "warning" : "valid"}
      data-map-rooms={MAP_VALIDATION.rooms}
      data-map-links={MAP_VALIDATION.links}
      data-map-transitions={MAP_VALIDATION.transitionModules}
      data-map-transition-screens={MAP_VALIDATION.transitionScreens}
      data-palace-water-level={waterLevel}
      data-map-physical-links={MAP_VALIDATION.physicalLinks}
      data-map-physical-errors={MAP_VALIDATION.physicalErrors}
      data-map-physical-warnings={MAP_VALIDATION.physicalWarnings}
      data-map-physical-error-links={PHYSICAL_LINKS.filter((link) => link.issues.some((issue) => issue.severity === "error")).map((link) => `${link.from}>${link.to}:${link.issues.filter((issue) => issue.severity === "error").map((issue) => issue.message).join("/")}`).join("|")}
      data-map-physical-warning-links={PHYSICAL_LINKS.filter((link) => link.issues.some((issue) => issue.severity === "warning")).map((link) => `${link.from}>${link.to}:${link.issues.filter((issue) => issue.severity === "warning").map((issue) => issue.message).join("/")}`).join("|")}
    >
      <header className="map-header">
        <div className="map-title-block">
          <span className="prototype-tag">LEVEL DESIGN / v0.9 · PHYSICAL TRANSITIONS</span>
          <h1>
            墨境行者 <b>世界地图模拟器</b>
          </h1>
        </div>
        <nav className="header-actions" aria-label="页面导航">
          <span className="status-dot">
            <i />
            可读性细化
          </span>
          <Link href="/">返回战斗原型 ↗</Link>
        </nav>
      </header>

      <section className="map-workspace">
        <aside className="map-sidebar">
          <div className="sidebar-heading">
            <span>世界分区</span>
            <b>07</b>
          </div>
          <div className="zone-list">
            {ZONES.map((item) => (
              <button
                key={item.id}
                className={selectedZone === item.id ? "active" : ""}
                onClick={() => focusZone(item.id)}
              >
                <i style={{ background: item.color }} />
                <span>
                  <small>
                    {item.index} / {item.subtitle}
                  </small>
                  {item.name}
                  <em className="zone-alias">{item.alias}</em>
                </span>
                <em>{item === zone ? "—" : "›"}</em>
              </button>
            ))}
          </div>

          <div className="sidebar-section">
            <div className="sidebar-heading compact">
              <span>图例图标</span>
              <b>
                {visibleMarkers.size}/{ALL_MARKERS.length}
              </b>
            </div>
            <div className="marker-filters">
              {ALL_MARKERS.map((kind) => {
                const meta = MARKER_META[kind];
                return (
                  <button
                    key={kind}
                    className={visibleMarkers.has(kind) ? "on" : ""}
                    onClick={() => toggleMarker(kind)}
                    title={meta.hint}
                  >
                    <i style={{ color: meta.color, borderColor: meta.color }}>{meta.glyph}</i>
                    <span>
                      {meta.label}
                      <small>{meta.hint}</small>
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="route-glossary">
              <b>路线语义</b>
              <span>
                <i className="route main" />
                主路 · 推进顺序实线
              </span>
              <span>
                <i className="route shortcut" />
                捷径 · 能力/机关后虚线
              </span>
              <span>
                <i className="portal-sample" />
                传送 · 配对端点，非隧道
              </span>
            </div>
          </div>

          <div className="sidebar-section">
            <div className="sidebar-heading compact">
              <span>敌人图鉴</span>
              <b>
                {visibleEnemies.size}/{ENEMY_ORDER.length}
              </b>
            </div>
            <div className="enemy-tier-toggles">
              {(["basic", "elite", "boss"] as EnemyTier[]).map((tier) => {
                const ids = ENEMY_ORDER.filter((id) => ENEMY_META[id].tier === tier);
                const allOn = ids.every((id) => visibleEnemies.has(id));
                return (
                  <button
                    key={tier}
                    className={allOn ? "on" : ""}
                    onClick={() => {
                      setVisibleEnemies((prev) => {
                        const next = new Set(prev);
                        if (allOn) ids.forEach((id) => next.delete(id));
                        else ids.forEach((id) => next.add(id));
                        return next;
                      });
                    }}
                  >
                    {ENEMY_TIER_LABEL[tier]}
                  </button>
                );
              })}
            </div>
            <div className="enemy-filters">
              {(["basic", "elite", "boss"] as EnemyTier[]).map((tier) => (
                <div key={tier} className="enemy-tier-group">
                  <small className="enemy-tier-label">{ENEMY_TIER_LABEL[tier]}</small>
                  {ENEMY_ORDER.filter((id) => ENEMY_META[id].tier === tier).map((type) => {
                    const meta = ENEMY_META[type];
                    return (
                      <button
                        key={type}
                        className={`${visibleEnemies.has(type) ? "on" : ""} ${selectedEnemy === type ? "selected" : ""}`}
                        onClick={() => setSelectedEnemy(type)}
                        title={`${meta.summary}（点击查看档案）`}
                      >
                        <i style={{ color: meta.color, borderColor: meta.color }}>{meta.glyph}</i>
                        <span>
                          {meta.label}
                          <small>{meta.summary}</small>
                        </span>
                        <em
                          role="presentation"
                          title={visibleEnemies.has(type) ? "隐藏地图标记" : "显示地图标记"}
                          onClick={(event) => {
                            event.stopPropagation();
                            toggleEnemy(type);
                          }}
                        />
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </aside>

        <div className="map-main">
          <div className="map-toolbar">
            <div className="tool-note">
              <kbd>拖拽</kbd> 平移 <kbd>点击区域</kbd> 详情 · 剖面布局
            </div>
            <div className="map-legend">
              <span>
                <i className="range-sample" />
                活动区
              </span>
              <span>
                <i className="building-sample" />
                建筑
              </span>
              <span>
                <i className="route main" />
                主路
              </span>
              <span>
                <i className="route shortcut" />
                捷径
              </span>
              <span>
                <i className="portal-sample" />
                传送
              </span>
              <span>
                <i className="marker-sample" />
                图例点
              </span>
            </div>
            <div className="zoom-control">
              <div className="environment-control" role="group" aria-label="行宫水位模拟">
                <button type="button" className={waterLevel === "high" ? "active" : ""} onClick={() => setWaterLevel("high")}>高水位</button>
                <button type="button" className={waterLevel === "low" ? "active" : ""} onClick={() => setWaterLevel("low")}>低水位</button>
              </div>
              <div className="zoom-presets" role="group" aria-label="缩放预设">
                <button
                  type="button"
                  className={isDesignZoom ? "active" : ""}
                  onClick={() => applyZoomMode("design")}
                  title="设计画布 1u = 1px"
                >
                  设计 1:1
                </button>
                <button
                  type="button"
                  className={isGameZoom ? "active" : ""}
                  onClick={() => applyZoomMode("game")}
                  title={`真实战斗一屏 ${GAME_STAGE_PX.w}×${GAME_STAGE_PX.h}px ≈ 地图 ${GAME_SCREEN_UNITS.w}×${GAME_SCREEN_UNITS.h}u`}
                >
                  真实场景
                </button>
              </div>
              <button onClick={() => updateZoom(zoom - 0.08)} aria-label="缩小">
                −
              </button>
              <span>{Math.round(zoom * 100)}%</span>
              <button onClick={() => updateZoom(zoom + 0.08)} aria-label="放大">
                ＋
              </button>
            </div>
          </div>

          <div
            className="map-viewport"
            ref={viewportRef}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={() => {
              drag.current.active = false;
            }}
            onPointerCancel={() => {
              drag.current.active = false;
            }}
          >
            <div className="map-canvas" style={{ width: MAP_W * zoom, height: MAP_H * zoom }}>
              <div
                className={`map-scale water-${waterLevel} ${zoom < 0.65 ? "low-detail" : ""}`}
                style={
                  {
                    width: MAP_W,
                    height: MAP_H,
                    transform: `scale(${zoom})`,
                    "--inverse-zoom": 1 / zoom,
                  } as CSSProperties
                }
              >
                <svg className="mountain-layer" viewBox={`0 0 ${MAP_W} ${MAP_H}`} aria-hidden="true">
                  <path
                    className="mountain-silhouette"
                    d="M20 1180 L280 980 L700 1020 L1400 820 L2200 880 L3000 700 L4000 760 L5000 540 L6000 600 L7000 420 L8000 480 L9000 260 L10080 300 L10080 1400 L20 1400 Z"
                  />
                </svg>

                {ZONES.map((item) => (
                  <div
                    key={item.id}
                    className={`zone-band ${selectedZone === item.id ? "selected" : ""}`}
                    style={{ left: item.x, width: item.width, borderTopColor: item.color, height: MAP_H }}
                  >
                    <div className="zone-caption">
                      <b>{item.index}</b>
                      <span>
                        {item.name}
                        <small>
                          {item.subtitle} · {item.alias}
                        </small>
                      </span>
                    </div>
                  </div>
                ))}

                <svg className="terrain-layer" viewBox={`0 0 ${MAP_W} ${MAP_H}`} aria-label="连续关卡可活动范围">
                  {REGION_SHAPES.map((shape) => {
                    const region = ZONES.find((item) => item.id === shape.id)!;
                    return (
                      <path
                        key={shape.id}
                        d={shape.d}
                        className={`region-shape ${selectedZone === shape.id ? "selected" : ""}`}
                        style={{ "--shape-color": region.color } as CSSProperties}
                      />
                    );
                  })}
                  <path
                    className="continuous-spine"
                    d="M80 760 C600 740 1200 730 2000 720 C3200 700 4200 680 5200 650 C6500 620 7800 580 9000 480 C9500 440 9900 400 10050 360"
                  />
                </svg>

                <svg className="architecture-layer" viewBox={`0 0 ${MAP_W} ${MAP_H}`} aria-label="地板与建筑结构白模">
                  {FLOORS.map(([x, y, w], index) => (
                    <g key={`floor-${index}`} className="floor-outline">
                      <line x1={x} y1={y} x2={x + w} y2={y} />
                      <line x1={x} y1={y + 12} x2={x + w} y2={y + 12} />
                      {Array.from({ length: Math.max(2, Math.floor(w / 48)) }).map((_, tick) => (
                        <line
                          key={tick}
                          x1={x + tick * 48 + 12}
                          y1={y}
                          x2={x + tick * 48 + 24}
                          y2={y + 12}
                        />
                      ))}
                    </g>
                  ))}

                  {TRANSITION_FLOORS.map((floor, index) => (
                    <g key={`transition-floor-${index}`} className="floor-outline transition-floor-outline">
                      <line x1={floor.x} y1={floor.y} x2={floor.x + floor.w} y2={floor.y} />
                      <line x1={floor.x} y1={floor.y + 12} x2={floor.x + floor.w} y2={floor.y + 12} />
                    </g>
                  ))}

                  {HOUSES.map((house, index) => (
                    <g key={`house-${index}`} className={`building-outline roof-${house.roof}`}>
                      <rect x={house.x} y={house.y} width={house.w} height={house.h} />
                      <path
                        d={`M${house.x - 14} ${house.y} Q${house.x + house.w / 2} ${house.y - (house.roof === "tower" ? 58 : 35)} ${house.x + house.w + 14} ${house.y}`}
                      />
                      {(house.roof === "temple" || house.roof === "palace" || house.roof === "tower") && (
                        <path d={`M${house.x - 7} ${house.y + 34} H${house.x + house.w + 7}`} />
                      )}
                      <rect
                        className="door-outline"
                        x={house.x + house.w / 2 - 16}
                        y={house.y + house.h - 48}
                        width="32"
                        height="48"
                      />
                      <line x1={house.x + 18} y1={house.y + 18} x2={house.x + 18} y2={house.y + house.h} />
                      <line
                        x1={house.x + house.w - 18}
                        y1={house.y + 18}
                        x2={house.x + house.w - 18}
                        y2={house.y + house.h}
                      />
                    </g>
                  ))}

                  {BRIDGES.map((bridge, index) => (
                    <g key={`bridge-${index}`} className={`bridge-outline bridge-${bridge.type}`}>
                      <line x1={bridge.x1} y1={bridge.y} x2={bridge.x2} y2={bridge.y} className="bridge-deck" />
                      <line x1={bridge.x1} y1={bridge.y + 12} x2={bridge.x2} y2={bridge.y + 12} />
                      <path
                        d={`M${bridge.x1} ${bridge.y - 20} Q${(bridge.x1 + bridge.x2) / 2} ${bridge.y + 28} ${bridge.x2} ${bridge.y - 20}`}
                      />
                      {Array.from({ length: 5 }).map((_, beam) => {
                        const bx = bridge.x1 + ((bridge.x2 - bridge.x1) / 6) * (beam + 1);
                        return <line key={beam} x1={bx} y1={bridge.y} x2={bx} y2={bridge.y + 30} />;
                      })}
                    </g>
                  ))}

                  {TRANSITION_BRIDGES.map((bridge, index) => (
                    <g key={`transition-bridge-${index}`} className={`bridge-outline bridge-${bridge.type} transition-bridge-outline`}>
                      <line x1={bridge.x1} y1={bridge.y} x2={bridge.x2} y2={bridge.y} className="bridge-deck" />
                      <line x1={bridge.x1} y1={bridge.y + 12} x2={bridge.x2} y2={bridge.y + 12} />
                      <path d={`M${bridge.x1} ${bridge.y - 20} Q${(bridge.x1 + bridge.x2) / 2} ${bridge.y + 28} ${bridge.x2} ${bridge.y - 20}`} />
                    </g>
                  ))}

                  {LADDERS.map((ladder, index) => (
                    <g key={`ladder-${index}`} className="ladder-outline">
                      <line x1={ladder.x - 9} y1={ladder.y1} x2={ladder.x - 9} y2={ladder.y2} />
                      <line x1={ladder.x + 9} y1={ladder.y1} x2={ladder.x + 9} y2={ladder.y2} />
                      {Array.from({ length: Math.floor((ladder.y2 - ladder.y1) / 24) }).map((_, rung) => (
                        <line
                          key={rung}
                          x1={ladder.x - 9}
                          y1={ladder.y1 + 15 + rung * 24}
                          x2={ladder.x + 9}
                          y2={ladder.y1 + 15 + rung * 24}
                        />
                      ))}
                    </g>
                  ))}

                  {TRANSITION_LADDERS.map((ladder, index) => (
                    <g key={`transition-ladder-${index}`} className="ladder-outline transition-device-outline">
                      <line x1={ladder.x - 9} y1={ladder.y1} x2={ladder.x - 9} y2={ladder.y2} />
                      <line x1={ladder.x + 9} y1={ladder.y1} x2={ladder.x + 9} y2={ladder.y2} />
                    </g>
                  ))}

                  {ELEVATORS.map((lift, index) => (
                    <g key={`lift-${index}`} className="elevator-outline">
                      <rect x={lift.x - 34} y={lift.y} width="68" height={lift.h} />
                      <line x1={lift.x} y1={lift.y} x2={lift.x} y2={lift.y + lift.h} />
                      <rect className="lift-platform" x={lift.x - 29} y={lift.y + lift.h * 0.54} width="58" height="12" />
                      <circle cx={lift.x} cy={lift.y + 16} r="9" />
                    </g>
                  ))}

                  {TRANSITION_ELEVATORS.map((lift, index) => (
                    <g key={`transition-lift-${index}`} className="elevator-outline transition-device-outline">
                      <rect x={lift.x - 34} y={lift.y} width="68" height={lift.h} />
                      <line x1={lift.x} y1={lift.y} x2={lift.x} y2={lift.y + lift.h} />
                      <rect className="lift-platform" x={lift.x - 29} y={lift.y + lift.h * 0.54} width="58" height="12" />
                    </g>
                  ))}

                  <g className="cave-outline">
                    {/* 矿→林：根穴隧道水平廊道（两侧洞口） */}
                    <path d="M4270 760 V640 Q4300 600 4330 640 V760" />
                    <path className="tunnel-bore" d="M4330 640 H4500 V760 H4330 Z" />
                    <path d="M4500 760 V640 Q4530 600 4560 640 V760" />
                    {/* 毒雾盲道入口门洞 */}
                    <path d="M4620 1000 V900 Q4710 820 4800 900 V1000" />
                    {/* 绝顶回城洞口 */}
                    <path d="M8600 720 V630 Q8680 550 8760 630 V720" />
                  </g>
                  <g className="water-outline">
                    <path d={waterLevel === "high" ? "M7120 680 Q7300 665 7480 680 T7840 680 T8200 680 T8500 680" : "M7400 980 Q7520 965 7640 980 T7880 980 T8120 980 T8360 980"} />
                    <path d={waterLevel === "high" ? "M7120 695 Q7300 680 7480 695 T7840 695 T8200 695 T8500 695" : "M7400 995 Q7520 980 7640 995 T7880 995 T8120 995 T8360 995"} />
                    <rect x={waterLevel === "high" ? 7120 : 7400} y={waterLevel === "high" ? 695 : 995} width={waterLevel === "high" ? 1380 : 1000} height={waterLevel === "high" ? 450 : 150} />
                    <text x="7145" y={waterLevel === "high" ? 730 : 1035}>{waterLevel === "high" ? "高水位 · 柱顶主廊开放" : "低水位 · 闸房与检修廊开放"}</text>
                  </g>
                  <g className={`wind-field-layer ${selectedZone === "cliff" ? "selected" : ""}`}>
                    {WIND_FIELDS.map((field) => (
                      <g key={field.id} className={`wind-field wind-${field.direction}`}>
                        <rect x={field.x} y={field.y} width={field.w} height={field.h} />
                        <path d={field.direction === "up"
                          ? `M${field.x + field.w / 2} ${field.y + field.h - 18} V${field.y + 35} M${field.x + field.w / 2} ${field.y + 35} l-12 18 M${field.x + field.w / 2} ${field.y + 35} l12 18`
                          : `M${field.direction === "east" ? field.x + 18 : field.x + field.w - 18} ${field.y + field.h / 2} H${field.direction === "east" ? field.x + field.w - 30 : field.x + 30}`}
                        />
                        <text x={field.x + 10} y={field.y + 18}>{field.title}</text>
                      </g>
                    ))}
                  </g>
                </svg>

                <svg className="route-layer" viewBox={`0 0 ${MAP_W} ${MAP_H}`} aria-hidden="true">
                  {CONNECTION_SEGMENTS.map((line, i) => (
                    <line key={`m${i}`} x1={line[0]} y1={line[1]} x2={line[2]} y2={line[3]} className="main-route" />
                  ))}
                  {TRANSITIONS.flatMap((transition) => transition.segments.flatMap((segment) => segment.route.map((step, index) => (
                    <line key={`${segment.id}-route-${index}`} x1={step.from.x} y1={step.from.y} x2={step.to.x} y2={step.to.y} className="transition-physical-route" />
                  ))))}
                  {SHORTCUT_SEGMENTS.map((line, i) => (
                    <line
                      key={`s${i}`}
                      x1={line[0]}
                      y1={line[1]}
                      x2={line[2]}
                      y2={line[3]}
                      className="shortcut-route"
                    />
                  ))}
                  {WATER_ROUTE_SEGMENTS[waterLevel].map((line, i) => (
                    <line key={`water-${waterLevel}-${i}`} x1={line[0]} y1={line[1]} x2={line[2]} y2={line[3]} className={`water-state-route ${waterLevel}`} />
                  ))}
                  {TRANSITIONS.flatMap((transition) => transition.segments.map((segment) => (
                    <g key={`${segment.id}-camera`} className={`transition-camera-rail ${transition.fromZone === selectedZone || transition.toZone === selectedZone ? "selected" : ""}`}>
                      <polyline points={segment.cameraRail.map((anchor) => `${anchor.x},${anchor.y}`).join(" ")} />
                      <circle cx={segment.safeRespawn.x} cy={segment.safeRespawn.y} r="6" />
                      <text x={segment.safeRespawn.x + 9} y={segment.safeRespawn.y - 8}>SAFE</text>
                    </g>
                  )))}
                </svg>

                <div className={`water-state-card ${waterLevel}`} style={{ left: 7440, top: waterLevel === "high" ? 730 : 1080 }}>
                  <b>{waterLevel === "high" ? "高水位" : "低水位"}</b>
                  <span>{waterLevel === "high" ? "柱顶主廊通行 · 下层闸房封闭" : "闸房 / 检修廊 / 回水梯开放"}</span>
                </div>

                {roomPhysicalLinks.length > 0 && (
                  <svg className="physical-link-layer" viewBox={`0 0 ${MAP_W} ${MAP_H}`} aria-label="选中房间物理出入口">
                    {roomPhysicalLinks.flatMap((link) => link.steps.map((step, index) => {
                      const hasError = link.issues.some((issue) => issue.severity === "error");
                      const hasWarning = link.issues.some((issue) => issue.severity === "warning");
                      return (
                        <g key={`${link.from}-${link.to}-${index}`} className={hasError ? "error" : hasWarning ? "warning" : "valid"}>
                          <line x1={step.from.x} y1={step.from.y} x2={step.to.x} y2={step.to.y} />
                          <circle cx={step.from.x} cy={step.from.y} r="5" />
                          <circle cx={step.to.x} cy={step.to.y} r="5" />
                          <text x={(step.from.x + step.to.x) / 2} y={(step.from.y + step.to.y) / 2 - 8}>
                            {MOVEMENT_LABELS[step.mode]}
                          </text>
                        </g>
                      );
                    }))}
                  </svg>
                )}

                {TRANSITIONS.map((item) => {
                  const fromColor = ZONES.find((candidate) => candidate.id === item.fromZone)?.color;
                  const toColor = ZONES.find((candidate) => candidate.id === item.toZone)?.color;
                  const isSelected = item.fromZone === selectedZone || item.toZone === selectedZone;
                  return (
                    <div
                      key={`${item.id}-band`}
                      className={`transition-band ${isSelected ? "selected" : ""}`}
                      style={
                        {
                          left: item.x,
                          top: item.y,
                          width: item.width,
                          height: item.height,
                          "--transition-from": fromColor,
                          "--transition-to": toColor,
                        } as CSSProperties
                      }
                      aria-label={`${item.title}，${item.orientation === "compound" ? "约2屏复合路径" : `${item.width / GAME_SCREEN_UNITS.w}屏`}连续过渡`}
                    >
                      {item.materialPhases.map((material, index) => (
                        <div className="transition-phase" key={material}>
                          <b>{["旧区收束", "混合区", "新区预告"][index]}</b>
                          <small>{material}</small>
                        </div>
                      ))}
                    </div>
                  );
                })}

                {TRANSITIONS.flatMap((transition) => transition.segments.map((segment, index) => (
                  <div
                    key={segment.id}
                    className={`transition-scene-segment ${transition.fromZone === selectedZone || transition.toZone === selectedZone ? "selected" : ""}`}
                    style={{ left: segment.bounds.x, top: segment.bounds.y, width: segment.bounds.w, height: segment.bounds.h }}
                    title={`${segment.id} · ${segment.streamingChunk}`}
                  >
                    <b>{index === 0 ? "T-A" : "T-B"} · {segment.name}</b>
                    <small>{segment.id} / {segment.streamingChunk}</small>
                  </div>
                )))}

                {TRANSITIONS.map((item) => (
                  <div
                    key={item.id}
                    className={`transition-node ${item.id === "mine-forest" ? "junction" : ""}`}
                    style={{ left: item.x + item.width / 2, top: item.y + item.height / 2 }}
                  >
                    <i />
                    <span>
                      <b>{item.title} · {item.orientation === "compound" ? "约2屏复合" : `${item.width / GAME_SCREEN_UNITS.w}屏`}</b>
                      <small>{item.note}</small>
                    </span>
                  </div>
                ))}

                <div className="altitude-label top">上层 / 屋顶与峰顶</div>
                <div className="altitude-label middle">中层 / 主探索长廊</div>
                <div className="altitude-label bottom">下层 / 暗道与水脉</div>

                {ROOMS.map((item) => {
                  const zoneColor = ZONES.find((z) => z.id === item.zone)?.color;
                  const itemEnemies = roomEnemyIds(item);
                  const waterLocked = waterLevel === "high" && ["p6", "p4", "p5"].includes(item.id);
                  return (
                    <button
                      key={item.id}
                      className={`map-room kind-${item.kind} ${["boss", "arena", "secret"].includes(item.kind) ? "instance" : "seamless"} ${waterLocked ? "state-inactive" : ""} ${selectedRoom === item.id ? "active" : ""}`}
                      style={
                        {
                          left: item.x,
                          top: item.y,
                          width: item.w,
                          height: item.h,
                          "--zone-color": zoneColor,
                        } as CSSProperties
                      }
                      onPointerDown={(event) => event.stopPropagation()}
                      onClick={() => {
                        setSelectedRoom(item.id);
                        setSelectedZone(item.zone);
                      }}
                    >
                      <span className="room-name">{item.name}</span>
                      <span className="room-meta">{ROOM_KIND_META[item.kind].label}</span>
                      {waterLocked && <span className="state-lock">高水位封闭</span>}
                      {item.requires && (
                        <span className="ability-lock">
                          ◇ {item.requires.map((id) => PROGRESSION_LABELS[id]).join(" + ")}
                        </span>
                      )}
                      {item.grants && zoom >= 0.6 && (
                        <span className="ability-grant">
                          ＋ {item.grants.map((id) => PROGRESSION_LABELS[id]).join(" / ")}
                        </span>
                      )}
                      {item.encounter && zoom >= 0.6 && (
                        <span className="encounter-badge">
                          W{item.encounter.waves.length} · B{item.encounter.budget}
                        </span>
                      )}
                      {itemEnemies.length > 0 && (
                        <span className="enemy-dots">
                          {itemEnemies
                            .filter((type) => visibleEnemies.has(type))
                            .map((type) => (
                              <i
                                key={type}
                                style={{ background: ENEMY_META[type].color }}
                                title={`${ENEMY_META[type].label} · 点击查看档案`}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setSelectedEnemy(type);
                                }}
                              >
                                {ENEMY_META[type].glyph}
                              </i>
                            ))}
                        </span>
                      )}
                    </button>
                  );
                })}

                {MARKERS.filter((marker) => visibleMarkers.has(marker.kind)).map((marker) => {
                  const meta = MARKER_META[marker.kind];
                  return (
                    <div
                      key={marker.id}
                      className={`map-marker kind-${marker.kind}`}
                      style={{ left: marker.x, top: marker.y, color: meta.color }}
                      title={`${meta.label} · ${marker.label}`}
                    >
                      <i>{meta.glyph}</i>
                      <span>{marker.label}</span>
                    </div>
                  );
                })}

                <div className="start-marker">
                  起
                  <br />
                  点
                </div>
                <div className="end-marker">
                  终
                  <br />
                  局
                </div>
                <div
                  className="player-scale-marker"
                  style={{
                    left: zone.x + 95,
                    top: 860,
                    width: PLAYER_METRICS.height * 0.75,
                    height: PLAYER_METRICS.height,
                  }}
                >
                  <span>{PLAYER_METRICS.height}u</span>
                  <img src="/assets/player.png" alt="玩家物理尺寸参照" />
                </div>
                <div
                  className="camera-frame-guide"
                  style={{
                    left: zone.x + 220,
                    top: 780,
                    width: GAME_SCREEN_UNITS.w,
                    height: GAME_SCREEN_UNITS.h,
                  }}
                  title="战斗原型一屏取景框"
                >
                  <b>战斗一屏</b>
                  <small>
                    {GAME_STAGE_PX.w}×{GAME_STAGE_PX.h}px
                  </small>
                </div>
                <div className="scroll-hint vertical">
                  剖面支路
                  <br />
                  可上下拖动
                </div>
                <div className="structure-key">
                  <b>读图</b>
                  <span>金实线：主路</span>
                  <span>青虚线：捷径</span>
                  <span>紫门：传送对</span>
                  <span>◇锁 / ＋奖：能力门与奖励</span>
                </div>
              </div>
            </div>
          </div>

          <div className="map-minimap" aria-label="地图概览">
            <span className="mini-title">WORLD OVERVIEW</span>
            <div className="mini-track">
              {ZONES.map((item) => (
                <button
                  key={item.id}
                  onClick={() => focusZone(item.id)}
                  className={selectedZone === item.id ? "active" : ""}
                  style={{ flex: item.width, background: item.color }}
                  aria-label={item.name}
                />
              ))}
            </div>
          </div>
        </div>

        <aside className="detail-panel">
          <div className="detail-index" style={{ color: zone.color }}>
            {zone.index}
          </div>
          <small className="eyebrow">CURRENT REGION · {zone.alias}</small>
          <h2>{zone.name}</h2>
          <p>{zone.loop}</p>

          {zone.id === "gate" && (
            <Link className="region-detail-link" href="/map/gate">
              打开场景01完整大地图 ↗
            </Link>
          )}

          <dl>
            <div>
              <dt>核心能力</dt>
              <dd>{zone.ability}</dd>
            </div>
            <div>
              <dt>获取点</dt>
              <dd>{zone.unlockAt}</dd>
            </div>
            <div>
              <dt>压轴敌人</dt>
              <dd>{zone.boss}</dd>
            </div>
            <div>
              <dt>房间数量</dt>
              <dd>{regionRooms.length} 个设计节点</dd>
            </div>
            <div>
              <dt>图例点</dt>
              <dd>{regionMarkers.length} 个可见</dd>
            </div>
          </dl>

          <div className="progression-card">
            <span>探索节奏</span>
            <div>
              <i style={{ width: `${44 + Number(zone.index) * 6}%`, background: zone.color }} />
            </div>
            <small>进入 → 零散小怪 → 精英(+跟班) → 能力验证 →（矿/林/顶）区 Boss</small>
          </div>

          <div className="ability-chain-card">
            <small>GROWTH PATH</small>
            <ol>
              {ABILITY_CHAIN.map((step) => (
                <li key={step.id} className={zone.id === step.zone ? "current" : ""}>
                  <b>{step.ability}</b>
                  <small>{step.kind}</small>
                  <span>{step.at}</span>
                  <em>→ {step.unlocks}</em>
                </li>
              ))}
            </ol>
          </div>

          <div className="connection-card">
            <small>SCENE CONNECTION · MATERIAL / PLAY GRADIENT</small>
            <b>{nextTransition?.title ?? "终局封闭区域"}</b>
            <span>{nextTransition?.note ?? "击败最终首领后，用传送端点返回世界探索"}</span>
            {nextTransition ? (
              <>
                <p className="transition-landmark">视觉锚点：{nextTransition.landmark}</p>
                <div className="transition-physical-summary">
                  <b>PHYSICAL SCENE DATA · {nextTransition.segments.length}段</b>
                  {nextTransition.segments.map((segment) => (
                    <p key={segment.id}>
                      <strong>{segment.id} · {segment.name}</strong>
                      <span>{segment.floors.length}地板 · {segment.route.length}移动段 · SAFE({segment.safeRespawn.x},{segment.safeRespawn.y})</span>
                      <em>{segment.streamingChunk}</em>
                    </p>
                  ))}
                </div>
                <ol className="transition-phase-list">
                  {nextTransition.materialPhases.map((material, index) => (
                    <li key={material}>
                      <i>{index + 1}</i>
                      <div>
                        <b>{["旧区收束", "混合区", "新区预告"][index]} · {material}</b>
                        <span>{nextTransition.gameplayPhases[index]}</span>
                      </div>
                    </li>
                  ))}
                </ol>
                <div className="transition-rule-list">
                  <p><b>敌人</b><span>{nextTransition.enemyPolicy}</span></p>
                  <p><b>镜头</b><span>{nextTransition.camera}</span></p>
                  <p><b>流送</b><span>{nextTransition.streaming}</span></p>
                </div>
              </>
            ) : null}
            <em>区界均为连续场景；每个模块占2屏，并在地标遮挡内完成资源流送，不触发操作层切场。</em>
          </div>

          {enemy && (
            <div className="enemy-dossier">
              <small>ENEMY DOSSIER · {ENEMY_TIER_LABEL[enemy.tier]}</small>
              <div className="enemy-dossier-head">
                <i style={{ background: enemy.color }}>{enemy.glyph}</i>
                <div>
                  <h3>{enemy.label}</h3>
                  <span>{enemy.summary}</span>
                </div>
                <button type="button" className="dossier-close" onClick={() => setSelectedEnemy(null)} aria-label="关闭档案">
                  ×
                </button>
              </div>
              <p className="dossier-look">{enemy.look}</p>
              <dl className="dossier-meta">
                <div>
                  <dt>设定区域</dt>
                  <dd>{enemy.loreZones.join(" · ")}</dd>
                </div>
                <div>
                  <dt>地图落点</dt>
                  <dd>
                    {enemyRooms.length
                      ? enemyRooms.map((item) => item.name).join(" · ")
                      : "尚未挂房间"}
                  </dd>
                </div>
                {enemy.reward && (
                  <div>
                    <dt>通关奖励</dt>
                    <dd>{enemy.reward}</dd>
                  </div>
                )}
              </dl>
              <div className="dossier-moves">
                <b>主要动作</b>
                <ul>
                  {enemy.moves.map((move) => (
                    <li key={move}>{move}</li>
                  ))}
                </ul>
              </div>
              {enemy.phases && (
                <div className="dossier-moves">
                  <b>阶段</b>
                  <ul>
                    {enemy.phases.map((phase) => (
                      <li key={phase}>{phase}</li>
                    ))}
                  </ul>
                </div>
              )}
              <p className="dossier-window">
                <b>反击窗口</b>
                {enemy.window}
              </p>
              <p className="dossier-role">
                <b>玩法定位</b>
                {enemy.role}
              </p>
              <p className="dossier-doc">完整文档：docs/enemies.md · 数据源 app/map/enemies.ts</p>
            </div>
          )}

          {room ? (
            <div className="room-detail">
              <small>SELECTED ROOM</small>
              <h3>{room.name}</h3>
              <span className="room-type" title={ROOM_KIND_META[room.kind].hint}>
                {ROOM_KIND_META[room.kind].label}
              </span>
              <p className="room-kind-hint">{ROOM_KIND_META[room.kind].hint}</p>
              {room.requires && (
                <p>
                  进入条件：
                  <b>
                    {room.requires
                      .map((id) => PROGRESSION_LABELS[id])
                      .join(" · ")}
                  </b>
                </p>
              )}
              {room.grants && (
                <p className="room-grants">
                  通关奖励：
                  <b>
                    {room.grants
                      .map((id) => PROGRESSION_LABELS[id])
                      .join(" · ")}
                  </b>
                </p>
              )}
              {room.tests && (
                <p className="room-tests">
                  重点验证：
                  <b>
                    {room.tests
                      .map((id) => `${PROGRESSION_LABELS[id]}（${PROGRESSION_KIND_LABELS[PROGRESSION_KINDS[id]]}）`)
                      .join(" · ")}
                  </b>
                </p>
              )}
              {(room.enter || room.exit || room.note) && (
                <div className="room-access">
                  {room.enter && (
                    <p>
                      <span>进入</span>
                      {room.enter}
                    </p>
                  )}
                  {room.exit && (
                    <p>
                      <span>离开</span>
                      {room.exit}
                    </p>
                  )}
                  {room.note && (
                    <p className="room-note">
                      <span>说明</span>
                      {room.note}
                    </p>
                  )}
                </div>
              )}
              <div className="physical-access-card">
                <div className="physical-access-head">
                  <span>PHYSICAL ACCESS</span>
                  <b>
                    {roomPhysicalLinks.filter((link) => link.issues.some((issue) => issue.severity === "error")).length
                      ? "需要修正"
                      : roomPhysicalLinks.some((link) => link.issues.length)
                        ? "可达 · 有施工提醒"
                        : "物理可达"}
                  </b>
                </div>
                <ol>
                  {roomPhysicalLinks.map((link) => {
                    const outgoing = link.from === room.id;
                    const otherRoom = ROOMS.find((item) => item.id === (outgoing ? link.to : link.from));
                    const severity = link.issues.some((issue) => issue.severity === "error")
                      ? "error"
                      : link.issues.length
                        ? "warning"
                        : "valid";
                    const requirementIds = [...new Set(link.steps.flatMap((step) => step.requires ?? []))];
                    return (
                      <li key={`${link.from}-${link.to}`} className={severity}>
                        <div>
                          <b>{outgoing ? "出" : "入"} · {otherRoom?.name}</b>
                          <em>{link.steps.map((step) => MOVEMENT_LABELS[step.mode]).join(" → ")}</em>
                        </div>
                        <span>
                          ({link.steps[0].from.x.toFixed(0)}, {link.steps[0].from.y.toFixed(0)}) → ({link.steps.at(-1)!.to.x.toFixed(0)}, {link.steps.at(-1)!.to.y.toFixed(0)})
                          · 横移 {link.horizontalDistance.toFixed(0)}u · 高差 {link.verticalDelta > 0 ? "+" : ""}{link.verticalDelta.toFixed(0)}u
                        </span>
                        {requirementIds.length > 0 && <small>条件：{requirementIds.map((id) => PROGRESSION_LABELS[id]).join(" · ")}</small>}
                        {link.oneWay && <small>单向 · 回程：{link.returnVia ?? "未定义"}</small>}
                        {link.issues.map((issue, index) => <small key={index} className={issue.severity}>{issue.message}</small>)}
                      </li>
                    );
                  })}
                </ol>
              </div>
              {room.encounter && (
                <div className="encounter-plan">
                  <div className="encounter-plan-head">
                    <span>ENCOUNTER PLAN</span>
                    <b>
                      W{room.encounter.waves.length} · {encounterUnitCount(room.encounter)} 只 · B{room.encounter.budget}
                    </b>
                  </div>
                  <p>{room.encounter.intent}</p>
                  <div className="encounter-rules">
                    <em>{room.encounter.lock ? "封锁战" : "开放遭遇"}</em>
                    <em>{room.encounter.respawn}</em>
                  </div>
                  <ol>
                    {room.encounter.waves.map((wave) => (
                      <li key={wave.wave}>
                        <div>
                          <b>W{wave.wave}</b>
                          <span>{wave.trigger}</span>
                        </div>
                        <ul>
                          {wave.units.map((unit) => (
                            <li key={`${wave.wave}-${unit.enemy}-${unit.position}`}>
                              <i style={{ background: ENEMY_META[unit.enemy].color }}>{ENEMY_META[unit.enemy].glyph}</i>
                              <span>{ENEMY_META[unit.enemy].label}</span>
                              <em>×{unit.count} · {unit.position}</em>
                            </li>
                          ))}
                        </ul>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
              <div className="room-enemies">
                {roomEnemyIds(room).map((type) => (
                  <button
                    key={type}
                    type="button"
                    className={selectedEnemy === type ? "active" : ""}
                    title={ENEMY_META[type].summary}
                    onClick={() => setSelectedEnemy(type)}
                  >
                    <i style={{ background: ENEMY_META[type].color }}>{ENEMY_META[type].glyph}</i>
                    {ENEMY_META[type].label}
                    <em>{ENEMY_TIER_LABEL[ENEMY_META[type].tier]}</em>
                  </button>
                ))}
                {roomEnemyIds(room).length === 0 && <em>安全房间 / 无敌人</em>}
              </div>
            </div>
          ) : (
            <div className="room-placeholder">
              {enemy ? "可继续点房间查看部署节点" : (
                <>
                  点击侧栏敌人查看档案
                  <br />
                  或点地图房间查看进出 / 奖励
                </>
              )}
            </div>
          )}

          <div className="design-rule">
            <b>读图约定</b>
            <span>实线＝主推进；虚线＝能力/机关捷径；单向落必有回程；传送只成对出现。</span>
          </div>
          <div className="design-rule">
            <b>设计原则 03</b>
            <span>每获得一种新能力，至少回溯解锁 2 条旧区域路径，避免能力只服务于单一区域。</span>
          </div>
          <div className="physics-card">
            <small>PLAYER PHYSICS · P0</small>
            <b>1 角色高 = {PLAYER_METRICS.height}u / {PLAYER_METRICS_PX.height}px</b>
            <div><span>物理连接</span><em>{MAP_VALIDATION.physicalLinks} 条</em></div>
            <div><span>校验结果</span><em>{MAP_VALIDATION.physicalErrors} 错误 / {MAP_VALIDATION.physicalWarnings} 提醒</em></div>
            <div><span>原地跳高</span><em>{PLAYER_METRICS.jumpHeight}u</em></div>
            <div><span>跑跳跨度</span><em>{PLAYER_METRICS.runJumpWidth}u</em></div>
            <div><span>抓梯范围</span><em>±{PLAYER_METRICS.ladderGrab}u</em></div>
            <div><span>安全落差</span><em>{PLAYER_METRICS.safeFall}u</em></div>
            <div><span>战斗一屏</span><em>{GAME_SCREEN_UNITS.w}×{GAME_SCREEN_UNITS.h}u</em></div>
            <div><span>单位换算</span><em>1u = {GAME_PX_PER_UNIT.toFixed(2)}px</em></div>
          </div>
        </aside>
      </section>
    </main>
  );
}
