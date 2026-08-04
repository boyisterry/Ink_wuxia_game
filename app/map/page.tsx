"use client";

import { useMemo, useRef, useState, type CSSProperties, type PointerEvent } from "react";
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
  lock?: string;
  /** 进出逻辑说明（防软锁 / 回程） */
  note?: string;
  /** 进入方式（可读性摘要） */
  enter?: string;
  /** 离开 / 回程方式 */
  exit?: string;
  /** 首次通关该节点后授予的能力或门印 */
  grants?: string[];
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
const PLAYER_METRICS = {
  height: 96,
  jumpHeight: 170,
  runJumpWidth: 240,
  doubleJumpHeight: 300,
  ladderGrab: 24,
  safeFall: 260,
} as const;

const ZONES: Zone[] = [
  { id: "gate", index: "01", name: "雨蚀山门", subtitle: "教学 · 起点", alias: "竹雾村缘", color: "#6e8f7c", x: 40, width: 1550, ability: "基础轻功", unlockAt: "破庙教学即可使用", boss: "无 · 精英赤枪校尉", loop: "竹影刀客教学走廊；穿插屋脊弩手；守门校场以赤枪校尉检验格挡与翻滚。" },
  { id: "town", index: "02", name: "悬灯旧城", subtitle: "枢纽 · 精英", alias: "灯市", color: "#c18b52", x: 1480, width: 1600, ability: "钩索", unlockAt: "旧钟楼精英战", boss: "无 · 精英掌灯使", loop: "街巷刀客与屋顶弩手为主；暗渠墨腹蛛；旧钟楼以分波掌灯使战发放钩索。" },
  { id: "mine", index: "03", name: "赤铁矿脉", subtitle: "纵深 · 区 Boss", alias: "剑冢牢", color: "#a95845", x: 2920, width: 1380, ability: "震地击", unlockAt: "剑冢牢底首领", boss: "剑冢狱主", loop: "墨腹蛛与链狱卒把守竖井；熔炉盾卫加压；深处剑冢狱主为第一章区 Boss。" },
  { id: "forest", index: "04", name: "孢子幽林", subtitle: "迷宫 · 区 Boss", alias: "黑松林", color: "#738f4c", x: 4280, width: 1600, ability: "闭息诀", unlockAt: "孢囊温室精英战", boss: "黑松魇兽", loop: "噬墨兽与墨羽鸦压迫走位；温室掌灯使发闭息诀；月下枯林黑松魇兽为区 Boss。" },
  { id: "cliff", index: "05", name: "断云天险", subtitle: "攀爬 · 精英", alias: "悬寺", color: "#6087a6", x: 5720, width: 1500, ability: "踏云二段跳", unlockAt: "试剑峰精英战", boss: "无 · 精英赤枪校尉", loop: "栈道弩手与墨羽鸦逼迫移动；悬寺提灯术士；试剑峰赤枪校尉精英战发放踏云，无独立首领房。" },
  { id: "palace", index: "06", name: "沉水行宫", subtitle: "水域 · 精英", alias: "黑松湖", color: "#507f8d", x: 7100, width: 1550, ability: "水行符", unlockAt: "倒影宴厅精英战", boss: "无 · 精英湖中墨姬", loop: "岸上沿用旧敌；下水后切换墨鳞游魂与沉甲水卒，湖中墨姬单体机制战收束。" },
  { id: "peak", index: "07", name: "无明绝顶", subtitle: "终局 · 区 Boss", alias: "无相殿", color: "#786786", x: 8500, width: 1500, ability: "三印祭坛", unlockAt: "悬灯 / 赤铁 / 幽林三印汇合", boss: "无相殿主", loop: "盾卫与无面剑侍检验基础战斗；殿主逐项镜像钩索、震地、闭息、踏云与水行。" },
];

const ROOMS: Room[] = [
  // 01 gate — 竹影刀客教学 + 赤枪校尉精英
  { id: "g1", zone: "gate", name: "破庙", x: 80, y: 700, w: 150, h: 110, kind: "save" },
  { id: "g2", zone: "gate", name: "山门缓坡", x: 270, y: 690, w: 170, h: 120, kind: "room", enemies: ["bamboo_blade"] },
  { id: "g7", zone: "gate", name: "竹篱小径", x: 460, y: 685, w: 170, h: 120, kind: "room", enemies: ["bamboo_blade"] },
  { id: "g8", zone: "gate", name: "石狮甬道", x: 650, y: 680, w: 170, h: 120, kind: "room", enemies: ["bamboo_blade", "rooftop_bow"] },
  { id: "g3", zone: "gate", name: "雨廊石阶", x: 840, y: 675, w: 180, h: 130, kind: "room", enemies: ["bamboo_blade", "rooftop_bow"] },
  { id: "g9", zone: "gate", name: "演武坪", x: 1040, y: 670, w: 170, h: 120, kind: "room", enemies: ["bamboo_blade"] },
  { id: "g10", zone: "gate", name: "雨亭歇脚", x: 1230, y: 665, w: 160, h: 115, kind: "room", enemies: ["rooftop_bow"] },
  { id: "g6", zone: "gate", name: "山门闸口", x: 1410, y: 660, w: 140, h: 120, kind: "room", enemies: ["iron_shield", "rooftop_bow"] },
  { id: "g4", zone: "gate", name: "守门校场", x: 980, y: 430, w: 170, h: 140, kind: "arena", enemies: ["scarlet_captain", "bamboo_blade"], enter: "演武坪上行", exit: "原路回主廊", note: "赤枪校尉 + 刀客跟班；教学精英，无能力奖励" },
  { id: "g5", zone: "gate", name: "崖下柴棚", x: 480, y: 930, w: 180, h: 110, kind: "secret", enemies: ["bamboo_blade"], enter: "竹篱小径单向落入", exit: "不可原路；东穿崖道回廊", note: "自竹篱小径单向落入；不可原路爬回" },
  { id: "g11", zone: "gate", name: "崖道回廊", x: 720, y: 930, w: 200, h: 110, kind: "secret", enemies: ["bamboo_blade"], enter: "自崖下柴棚横穿", exit: "东端木梯 → 雨廊石阶", note: "地下横穿后，东端木梯回主廊雨廊石阶" },

  // 02 town — 屋顶弩手 / 暗渠蛛 / 钟楼掌灯使精英
  { id: "t1", zone: "town", name: "长街驿站", x: 1580, y: 660, w: 180, h: 140, kind: "hub" },
  { id: "t8", zone: "town", name: "茶摊巷口", x: 1780, y: 655, w: 170, h: 125, kind: "room", enemies: ["bamboo_blade"] },
  { id: "t2", zone: "town", name: "灯市西廊", x: 1970, y: 650, w: 170, h: 130, kind: "room", enemies: ["bamboo_blade", "rooftop_bow"] },
  { id: "t9", zone: "town", name: "灯市中市", x: 2160, y: 645, w: 180, h: 130, kind: "room", enemies: ["rooftop_bow"] },
  { id: "t3", zone: "town", name: "灯市东巷", x: 2360, y: 640, w: 170, h: 135, kind: "room", enemies: ["bamboo_blade", "rooftop_bow"] },
  { id: "t10", zone: "town", name: "戏台广场", x: 2550, y: 635, w: 180, h: 130, kind: "room", enemies: ["iron_shield", "bamboo_blade"] },
  { id: "t11", zone: "town", name: "城东闸口", x: 2750, y: 630, w: 160, h: 125, kind: "room", enemies: ["iron_shield", "rooftop_bow"] },
  { id: "t7", zone: "town", name: "商会阁楼", x: 1760, y: 400, w: 150, h: 110, kind: "room", enemies: ["lantern_mage", "rooftop_bow"], lock: "钩索" },
  { id: "t4", zone: "town", name: "灯市屋脊", x: 2100, y: 360, w: 200, h: 120, kind: "room", enemies: ["rooftop_bow", "ink_crow"], lock: "钩索" },
  { id: "t5", zone: "town", name: "旧钟楼", x: 2580, y: 250, w: 170, h: 250, kind: "arena", enemies: ["lantern_adept", "bamboo_blade", "rooftop_bow"], enter: "灯市长街 / 屋脊汇入", exit: "战后开放屋顶钩索捷径", grants: ["钩索", "悬灯印"], note: "跟班先行、掌灯使后登场；首次通关获得钩索", encounter: { lock: true, respawn: "首次清除后不刷新", budget: 8, intent: "先清理近远程基础威胁，再单独学习掌灯使的符阵与真假灯。", waves: [{ wave: 1, trigger: "踏入钟楼并落闸", units: [{ enemy: "bamboo_blade", count: 2, position: "地面" }, { enemy: "rooftop_bow", count: 1, position: "高台" }] }, { wave: 2, trigger: "第一波清除", units: [{ enemy: "lantern_adept", count: 1, position: "首领位" }] }] } },
  { id: "t6", zone: "town", name: "下城暗渠", x: 2180, y: 980, w: 220, h: 120, kind: "secret", enemies: ["ink_spider"], lock: "震地击", enter: "灯市中市脆地单向坠入", exit: "不可原路；东穿暗渠东段", note: "自灯市中市脆地单向坠入；需震地击开启，不可原路爬回" },
  { id: "t12", zone: "town", name: "暗渠东段", x: 2460, y: 980, w: 220, h: 120, kind: "secret", enemies: ["ink_spider", "bamboo_blade"], enter: "自下城暗渠横穿", exit: "回程木梯 → 戏台广场（无需能力）", note: "横穿后木梯回到戏台广场；回程无需能力" },

  // 03 mine — 墨腹蛛 / 链狱卒 → 剑冢狱主
  { id: "m1", zone: "mine", name: "矿口横坑", x: 3000, y: 640, w: 180, h: 130, kind: "room", enemies: ["iron_shield", "rooftop_bow"] },
  { id: "m7", zone: "mine", name: "矿灯岔口", x: 3200, y: 635, w: 170, h: 120, kind: "room", enemies: ["ink_spider"] },
  { id: "m8", zone: "mine", name: "运轨栈台", x: 3390, y: 630, w: 180, h: 125, kind: "room", enemies: ["chain_jailer", "rooftop_bow"] },
  { id: "m2", zone: "mine", name: "升降机井", x: 3600, y: 480, w: 160, h: 260, kind: "room", enemies: ["chain_jailer", "ink_crow"], enter: "中层运轨进入吊笼", exit: "升降梯双向回中层 / 下熔炉", note: "升降梯双向：中层运轨 ↔ 下层熔炉平台；链狱卒可悬空拦截" },
  { id: "m9", zone: "mine", name: "通风横巷", x: 3790, y: 640, w: 170, h: 120, kind: "room", enemies: ["ink_spider", "ink_crow"] },
  { id: "m3", zone: "mine", name: "轨道岔道", x: 3980, y: 650, w: 180, h: 120, kind: "room", enemies: ["ink_spider", "chain_jailer"] },
  { id: "m10", zone: "mine", name: "矿工歇所", x: 4120, y: 645, w: 150, h: 120, kind: "room", enemies: ["ink_beast"], enter: "轨道岔道东延", exit: "东接根穴隧道出林", note: "矿脉东端歇脚；东接根穴隧道出林" },
  { id: "m4", zone: "mine", name: "熔炉工坊", x: 3920, y: 860, w: 210, h: 160, kind: "arena", enemies: ["iron_shield", "ink_spider"], enter: "升降机井下行落台", exit: "原梯回中层；东可进牢底", note: "先处理洞顶伏击，再让盾卫占据熔炉主轴", encounter: { lock: true, respawn: "神龛刷新", budget: 7, intent: "把洞顶警戒与正面破盾拆成两段，避免同时遮挡反击窗口。", waves: [{ wave: 1, trigger: "升降平台落地", units: [{ enemy: "ink_spider", count: 2, position: "墙顶" }] }, { wave: 2, trigger: "靠近熔炉机关", units: [{ enemy: "iron_shield", count: 1, position: "地面" }, { enemy: "ink_spider", count: 1, position: "墙顶" }] }] } },
  { id: "m5", zone: "mine", name: "废弃矿底", x: 3280, y: 1020, w: 200, h: 120, kind: "secret", enemies: ["ink_spider", "chain_jailer"], enter: "运轨栈台脆地单向坠入", exit: "不可原路；东穿矿底横巷", note: "自运轨栈台脆地单向坠入；不可原路爬回" },
  { id: "m11", zone: "mine", name: "矿底横巷", x: 3540, y: 1020, w: 210, h: 120, kind: "secret", enemies: ["ink_spider"], enter: "自废弃矿底横穿", exit: "木梯 → 通风横巷；或东接熔炉下层", note: "横穿后木梯回到通风横巷；亦可东接熔炉下层" },
  { id: "m6", zone: "mine", name: "剑冢牢底", x: 4140, y: 1000, w: 190, h: 150, kind: "boss", enemies: ["tomb_warden"], enter: "熔炉东侧进入", exit: "侧井升降回中层", grants: ["震地击", "赤铁印"], note: "区 Boss：剑冢狱主；战后获得震地击，并经侧井升降回中层", encounter: { lock: true, respawn: "首次清除后不刷新", budget: 12, intent: "单体两阶段首领，以场地兵器和脆地变化承担复杂度。", waves: [{ wave: 1, trigger: "进入牢底并封门", units: [{ enemy: "tomb_warden", count: 1, position: "首领位" }] }] } },

  // 04 forest — 噬墨兽 / 墨羽鸦 → 黑松魇兽
  { id: "f12", zone: "forest", name: "根穴隧道", x: 4300, y: 640, w: 200, h: 120, kind: "room", enter: "矿工歇所东行", exit: "东出菌光入口", note: "矿→林连续过渡：洞口遮挡，无切场；西接矿工歇所，东接菌光入口" },
  { id: "f1", zone: "forest", name: "菌光入口", x: 4540, y: 620, w: 150, h: 130, kind: "save", enter: "根穴隧道东口", exit: "东接苔径西廊", note: "幽林正式入口；神龛可存档" },
  { id: "f7", zone: "forest", name: "苔径西廊", x: 4720, y: 615, w: 160, h: 120, kind: "room", enemies: ["ink_beast"] },
  { id: "f2", zone: "forest", name: "雾径环廊", x: 4910, y: 600, w: 170, h: 140, kind: "room", enemies: ["ink_crow", "lantern_mage"] },
  { id: "f8", zone: "forest", name: "荧光菌圃", x: 5110, y: 595, w: 160, h: 125, kind: "room", enemies: ["lantern_mage"] },
  { id: "f9", zone: "forest", name: "朽木栈道", x: 5300, y: 590, w: 170, h: 125, kind: "room", enemies: ["ink_crow"] },
  { id: "f10", zone: "forest", name: "雾桥中段", x: 5500, y: 585, w: 160, h: 120, kind: "room", enemies: ["ink_crow", "ink_beast"] },
  { id: "f3", zone: "forest", name: "倒生树庭", x: 5260, y: 390, w: 180, h: 150, kind: "room", enemies: ["ink_crow"] },
  { id: "f4", zone: "forest", name: "孢囊温室", x: 5280, y: 800, w: 200, h: 140, kind: "arena", enemies: ["lantern_adept", "ink_beast"], enter: "荧光菌圃 / 朽木栈道下行", exit: "原梯回主廊", grants: ["闭息诀"], note: "先诱导噬墨兽撞壁，再由掌灯使开启毒孢阶段", encounter: { lock: true, respawn: "首次清除后不刷新", budget: 9, intent: "第一波学习利用温室墙体，第二波把毒孢环境与精英施法绑定。", waves: [{ wave: 1, trigger: "踏入温室中央", units: [{ enemy: "ink_beast", count: 2, position: "地面" }] }, { wave: 2, trigger: "兽群清除并释放毒孢", units: [{ enemy: "lantern_adept", count: 1, position: "首领位" }, { enemy: "ink_beast", count: 1, position: "地面" }] }] } },
  { id: "f5", zone: "forest", name: "月下枯林", x: 5680, y: 520, w: 150, h: 210, kind: "boss", enemies: ["pine_nightmare"], lock: "闭息诀", enter: "雾桥中段 · 闭息门", exit: "战后回主廊", grants: ["幽林印"], note: "区 Boss：黑松魇兽；需先完成孢囊温室", encounter: { lock: true, respawn: "首次清除后不刷新", budget: 13, intent: "单体虚实辨识首领；倒影和破角承担机制，不追加杂兵。", waves: [{ wave: 1, trigger: "进入月下枯林", units: [{ enemy: "pine_nightmare", count: 1, position: "首领位" }] }] } },
  { id: "f6", zone: "forest", name: "毒雾盲道", x: 4620, y: 920, w: 180, h: 110, kind: "secret", enemies: ["ink_beast", "lantern_mage"], lock: "闭息诀", enter: "苔径西廊闭息门（实线支路）", exit: "东穿盲道东口", note: "自苔径西廊以闭息诀开门进入（实线支路，非捷径）" },
  { id: "f11", zone: "forest", name: "盲道东口", x: 4840, y: 920, w: 180, h: 110, kind: "secret", enemies: ["ink_beast"], lock: "闭息诀", enter: "自毒雾盲道横穿", exit: "木梯 → 雾径环廊", note: "横穿后木梯回雾径环廊；与孢囊温室左右错开" },

  // 05 cliff — 栈道弩手 / 墨鸦 → 赤枪校尉精英
  { id: "c1", zone: "cliff", name: "风蚀栈道", x: 5800, y: 560, w: 180, h: 120, kind: "room", enemies: ["rooftop_bow"] },
  { id: "c7", zone: "cliff", name: "断云短桥", x: 6000, y: 550, w: 170, h: 115, kind: "room", enemies: ["ink_crow"] },
  { id: "c2", zone: "cliff", name: "云隙长桥", x: 6190, y: 540, w: 190, h: 120, kind: "room", enemies: ["ink_crow", "rooftop_bow"] },
  { id: "c8", zone: "cliff", name: "风铃栈台", x: 6400, y: 535, w: 170, h: 115, kind: "room", enemies: ["rooftop_bow"] },
  { id: "c9", zone: "cliff", name: "崖侧佛龛", x: 6590, y: 530, w: 170, h: 120, kind: "room", enemies: ["lantern_mage", "ink_crow"] },
  { id: "c10", zone: "cliff", name: "云廊尽头", x: 6780, y: 525, w: 170, h: 120, kind: "room", enemies: ["rooftop_bow"] },
  { id: "c3", zone: "cliff", name: "悬空寺", x: 6300, y: 300, w: 180, h: 150, kind: "save" },
  { id: "c4", zone: "cliff", name: "鹰巢平台", x: 6620, y: 260, w: 160, h: 120, kind: "room", enemies: ["ink_crow"] },
  { id: "c5", zone: "cliff", name: "试剑峰", x: 6840, y: 100, w: 180, h: 140, kind: "arena", enemies: ["scarlet_captain", "rooftop_bow", "ink_crow"], lock: "钩索", enter: "钩索登峰", exit: "战后沿栈道下行", grants: ["踏云二段跳"], note: "先夺取制高点，再与赤枪校尉单独决斗", encounter: { lock: true, respawn: "首次清除后不刷新", budget: 10, intent: "避免对空精英与空中/远程单位同时封死跳跃；把空间争夺和精英决斗拆波。", waves: [{ wave: 1, trigger: "钩索登顶", units: [{ enemy: "rooftop_bow", count: 1, position: "高台" }, { enemy: "ink_crow", count: 2, position: "空中" }] }, { wave: 2, trigger: "第一波清除", units: [{ enemy: "scarlet_captain", count: 1, position: "首领位" }] }] } },
  { id: "c6", zone: "cliff", name: "崩崖捷径", x: 5920, y: 780, w: 170, h: 110, kind: "secret", enemies: ["bamboo_blade"], enter: "断云短桥单向坠入", exit: "不可原路；东穿崖底暗径", note: "自断云短桥单向坠入；不可原路爬回" },
  { id: "c11", zone: "cliff", name: "崖底暗径", x: 6160, y: 780, w: 200, h: 110, kind: "secret", enemies: ["bamboo_blade"], enter: "自崩崖捷径横穿", exit: "木梯 → 云隙长桥", note: "横穿后木梯回到云隙长桥，略超前主线" },

  // 06 palace — 岸上过渡 → 湖中墨姬精英
  { id: "p1", zone: "palace", name: "淹没回廊", x: 7200, y: 560, w: 180, h: 130, kind: "room", enemies: ["bamboo_blade", "ink_crow"] },
  { id: "p7", zone: "palace", name: "潮声回廊", x: 7400, y: 555, w: 170, h: 120, kind: "room", enemies: ["rooftop_bow"] },
  { id: "p2", zone: "palace", name: "潮汐侧厅", x: 7590, y: 545, w: 180, h: 130, kind: "room", enemies: ["lantern_mage", "rooftop_bow"] },
  { id: "p8", zone: "palace", name: "锦鲤池廊", x: 7790, y: 540, w: 180, h: 125, kind: "room", enemies: ["bamboo_blade"] },
  { id: "p9", zone: "palace", name: "水镜长廊", x: 7990, y: 535, w: 180, h: 125, kind: "room", enemies: ["ink_crow", "rooftop_bow"] },
  { id: "p10", zone: "palace", name: "龙柱前厅", x: 8190, y: 530, w: 170, h: 130, kind: "room", enemies: ["iron_shield"] },
  { id: "p3", zone: "palace", name: "倒影宴厅", x: 7880, y: 310, w: 200, h: 160, kind: "arena", enemies: ["lantern_adept", "iron_shield"], enter: "主廊梯上行", exit: "原梯回主廊", grants: ["水行符"], note: "盾卫先封路，掌灯使随后利用镜面符阵守护水行符", encounter: { lock: true, respawn: "首次清除后不刷新", budget: 9, intent: "先验证绕后破盾，再单独呈现镜面符阵；不让盾击与符阵同时压制。", waves: [{ wave: 1, trigger: "宴厅门关闭", units: [{ enemy: "iron_shield", count: 2, position: "地面" }] }, { wave: 2, trigger: "盾卫清除", units: [{ enemy: "lantern_adept", count: 1, position: "首领位" }] }] } },
  { id: "p6", zone: "palace", name: "泄洪闸房", x: 7180, y: 760, w: 160, h: 110, kind: "room", enemies: ["iron_shield", "chain_jailer"] },
  { id: "p4", zone: "palace", name: "水下长廊", x: 7480, y: 900, w: 280, h: 130, kind: "room", enemies: ["ink_eel", "drowned_guard"], lock: "水行符", enter: "泄洪闸 / 主廊下水口（需水行符）", exit: "原路浮出或东进祭坛", note: "游魂控制中层转向，水卒锚定池底；两组错位触发", encounter: { lock: false, respawn: "神龛刷新", budget: 6, intent: "建立水中层与水底两条压力带，保留上浮换气通道。", waves: [{ wave: 1, trigger: "游入长廊西半", units: [{ enemy: "ink_eel", count: 2, position: "水中层" }] }, { wave: 2, trigger: "接近东侧祭坛门", units: [{ enemy: "drowned_guard", count: 1, position: "水底" }, { enemy: "ink_eel", count: 1, position: "水中层" }] }] } },
  { id: "p5", zone: "palace", name: "月下祭坛", x: 8080, y: 920, w: 220, h: 150, kind: "arena", enemies: ["lake_maiden"], lock: "水行符", enter: "水下长廊东延", exit: "战后浮出主廊 / 捷径", grants: ["水镜信物"], note: "湖中墨姬以幻身承担杂兵压力；辨认本体红簪后输出", encounter: { lock: true, respawn: "首次清除后不刷新", budget: 10, intent: "保持单体精英机制焦点；分身来自本体技能，不再额外加入空中跟班。", waves: [{ wave: 1, trigger: "进入祭坛水镜范围", units: [{ enemy: "lake_maiden", count: 1, position: "首领位" }] }] } },

  // 07 peak — 无面剑侍 → 无相殿主
  { id: "k1", zone: "peak", name: "问心长阶", x: 8600, y: 520, w: 180, h: 130, kind: "room", enemies: ["iron_shield", "bamboo_blade"] },
  { id: "k7", zone: "peak", name: "云阶中亭", x: 8800, y: 500, w: 170, h: 120, kind: "room", enemies: ["rooftop_bow"] },
  { id: "k8", zone: "peak", name: "望月石台", x: 8990, y: 480, w: 170, h: 120, kind: "room", enemies: ["faceless_sword"] },
  { id: "k2", zone: "peak", name: "祭坛前廊", x: 9180, y: 450, w: 180, h: 130, kind: "room", enemies: ["faceless_sword", "iron_shield"] },
  { id: "k9", zone: "peak", name: "碑林侧廊", x: 9380, y: 430, w: 170, h: 120, kind: "room", enemies: ["rooftop_bow", "bamboo_blade"] },
  { id: "k5", zone: "peak", name: "望台回廊", x: 9570, y: 410, w: 160, h: 110, kind: "room", enemies: ["rooftop_bow"] },
  { id: "k10", zone: "peak", name: "终局前廊", x: 9750, y: 390, w: 170, h: 120, kind: "room", enemies: ["faceless_sword", "iron_shield"] },
  { id: "k3", zone: "peak", name: "三印祭坛", x: 9400, y: 230, w: 180, h: 150, kind: "save", lock: "三枚门印", enter: "集齐悬灯 / 赤铁 / 幽林三印", exit: "开启终局前廊", note: "三印汇合点；非物理捷径" },
  { id: "k4", zone: "peak", name: "无相殿顶", x: 9780, y: 110, w: 180, h: 150, kind: "boss", enemies: ["formless_lord"], enter: "终局前廊", exit: "战后可用回城传送", grants: ["归途传送权限"], note: "终局 Boss：依次复测五种已获能力；通关后激活绝顶↔旧城传送对", encounter: { lock: true, respawn: "首次清除后不刷新", budget: 16, intent: "单体三阶段终局战；每阶段只增加一种能力组合，最终用闭息/水行改变场地。", waves: [{ wave: 1, trigger: "踏入殿顶并完成三印开门", units: [{ enemy: "formless_lord", count: 1, position: "首领位" }] }] } },
  { id: "k6", zone: "peak", name: "回城捷径口", x: 8680, y: 780, w: 180, h: 110, kind: "secret", lock: "归途传送权限", enter: "终局后传送端点 / 升降", exit: "传送至旧城屋脊端", note: "配对传送，不是实体长隧道；两端均有「门」标记" },
];

const MARKERS: Marker[] = [
  { id: "mk1", kind: "shrine", x: 155, y: 755, label: "破庙神龛", zone: "gate" },
  { id: "mk2", kind: "mechanism", x: 1470, y: 700, label: "山门闸机", zone: "gate" },
  { id: "mk3", kind: "oneway", x: 545, y: 820, label: "柴棚单向落口", zone: "gate" },
  { id: "mk22", kind: "mechanism", x: 920, y: 850, label: "柴棚回程木梯", zone: "gate" },
  { id: "mk4", kind: "shrine", x: 1670, y: 720, label: "驿站神龛", zone: "town" },
  { id: "mk5", kind: "ability", x: 2665, y: 520, label: "精英奖励·钩索", zone: "town" },
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
  { id: "mk12", kind: "mechanism", x: 4995, y: 650, label: "雾径机关", zone: "forest" },
  { id: "mk29", kind: "ability", x: 4800, y: 840, label: "盲道闭息门", zone: "forest" },
  { id: "mk30", kind: "mechanism", x: 4930, y: 840, label: "盲道回程木梯", zone: "forest" },
  { id: "mk31", kind: "ability", x: 5380, y: 860, label: "温室奖励·闭息诀", zone: "forest" },
  { id: "mk13", kind: "shrine", x: 6390, y: 360, label: "悬寺神龛", zone: "cliff" },
  { id: "mk14", kind: "oneway", x: 6050, y: 680, label: "崩崖单向", zone: "cliff" },
  { id: "mk23", kind: "mechanism", x: 6360, y: 700, label: "崖底回程木梯", zone: "cliff" },
  { id: "mk15", kind: "ability", x: 6920, y: 150, label: "精英奖励·踏云二段跳", zone: "cliff" },
  { id: "mk16", kind: "underwater", x: 7620, y: 960, label: "水下长廊", zone: "palace" },
  { id: "mk17", kind: "ability", x: 8180, y: 980, label: "墨姬祭坛·水镜信物", zone: "palace" },
  { id: "mk18", kind: "mechanism", x: 7260, y: 800, label: "泄洪石闸", zone: "palace" },
  { id: "mk32", kind: "ability", x: 7980, y: 390, label: "宴厅奖励·水行符", zone: "palace" },
  { id: "mk19", kind: "shrine", x: 9490, y: 290, label: "三印祭坛", zone: "peak" },
  { id: "mk20", kind: "lift", x: 8760, y: 820, label: "回城升降捷径", zone: "peak" },
  { id: "mk21", kind: "ability", x: 9860, y: 170, label: "殿主奖励·归途传送", zone: "peak" },
  { id: "mk33", kind: "portal", x: 9700, y: 350, label: "回城传送·绝顶端", zone: "peak" },
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
  { ability: "钩索", at: "02 旧钟楼精英", unlocks: "屋顶捷径 · 试剑峰登顶" },
  { ability: "震地击", at: "03 剑冢牢底", unlocks: "暗渠脆地 · 矿底破墙" },
  { ability: "闭息诀", at: "04 孢囊温室", unlocks: "毒雾盲道 · 月下枯林" },
  { ability: "踏云二段跳", at: "05 试剑峰精英", unlocks: "高空捷径与回溯平台" },
  { ability: "水行符", at: "06 倒影宴厅", unlocks: "水下长廊 · 月下祭坛" },
  { ability: "三印祭坛", at: "07 三印汇合", unlocks: "终局前廊 · 无相殿顶" },
  { ability: "归途传送", at: "07 无相殿主", unlocks: "绝顶 ↔ 旧城传送对" },
] as const;

const CONNECTIONS = [
  // gate mid spine
  [155, 755, 355, 750], [440, 745, 555, 740], [635, 740, 735, 740],
  [820, 740, 930, 740], [1020, 730, 1125, 730], [1215, 720, 1310, 720], [1390, 720, 1480, 720],
  [1065, 670, 1065, 570],
  // gate oneway drop → underground traverse → climb back ahead
  [545, 805, 570, 930], [670, 985, 820, 985], [920, 930, 920, 740],
  // into town
  [1550, 720, 1670, 730], [1760, 720, 1865, 720], [1950, 715, 2055, 715],
  [2140, 710, 2250, 710], [2335, 705, 2450, 700], [2530, 700, 2640, 700], [2730, 695, 2830, 695],
  [1860, 655, 1835, 510], [2200, 645, 2200, 480], [2665, 500, 2665, 780],
  // town sewer: breakable drop → traverse → climb back to plaza
  [2250, 775, 2290, 980], [2400, 1040, 2570, 1040], [2640, 980, 2640, 700],
  // town to mine
  [2910, 695, 3090, 705], [3180, 700, 3290, 695], [3370, 695, 3480, 690],
  [3570, 690, 3680, 620], [3760, 620, 3875, 700], [3960, 710, 4070, 710], [4160, 705, 4260, 705],
  // mine elevator ↔ furnace ↔ boss (lifts bidirectional)
  [3680, 740, 3680, 980], [3680, 980, 4020, 980], [4120, 940, 4230, 1070],
  // mine secret: drop from haulage → bottom traverse → climb back to mid
  [3480, 755, 3380, 1020], [3480, 1080, 3650, 1080], [3750, 1020, 3750, 700],
  // optional east link bottom → furnace undercroft
  [3750, 1080, 4020, 1020],
  // mine to forest — clear junction: 歇所 → 根穴隧道 → 菌光入口
  [4100, 705, 4195, 705], [4270, 700, 4400, 700], [4500, 700, 4615, 685],
  [4690, 675, 4800, 670], [4890, 670, 4995, 665],
  [5080, 655, 5190, 650], [5270, 650, 5385, 645], [5470, 640, 5580, 640],
  [5350, 590, 5350, 540], [5380, 650, 5380, 800], [5580, 580, 5680, 620],
  // forest poison blind path
  [4800, 735, 4710, 920], [4800, 975, 4930, 975], [4930, 920, 4995, 670],
  // forest to cliff
  [5660, 620, 5890, 610], [5980, 605, 6085, 600], [6170, 595, 6285, 590],
  [6370, 585, 6485, 580], [6570, 575, 6675, 575], [6760, 570, 6865, 570],
  [6390, 540, 6390, 450], [6700, 390, 6700, 340], [6860, 280, 6930, 240],
  // cliff oneway drop → traverse → climb back
  [6050, 665, 6005, 780], [6090, 835, 6260, 835], [6360, 780, 6285, 600],
  // cliff to palace
  [6950, 580, 7290, 620], [7380, 615, 7485, 610], [7570, 605, 7680, 600],
  [7770, 595, 7880, 590], [7970, 585, 8080, 580], [8170, 575, 8275, 575],
  [7980, 545, 7980, 470], [7280, 690, 7260, 800], [7620, 800, 7620, 900], [7980, 960, 8080, 980],
  // palace to peak
  [8360, 575, 8690, 585], [8780, 560, 8885, 540], [8970, 520, 9075, 500],
  [9160, 500, 9270, 490], [9350, 470, 9465, 460], [9540, 450, 9650, 440], [9730, 430, 9835, 420],
  [9490, 430, 9490, 390], [9860, 320, 9870, 260], [8770, 650, 8770, 780],
] as const;

const SHORTCUTS = [
  [1410, 500, 2100, 420], [2665, 300, 3680, 520], [2665, 1040, 3380, 1080],
  // mine nest ↔ forest greenhouse undercroft (optional inter-zone), not the blind-path access
  [4230, 1070, 5380, 940], [5680, 720, 5920, 820], [6930, 220, 7880, 370],
  [8180, 1040, 8770, 820],
] as const;

const REGION_SHAPES = [
  { id: "gate", d: "M40 650 H300 V610 H900 V760 H1560 V820 H900 V980 H420 V1040 H70 V860 H40 Z M900 610 V410 H1160 V560 H1080 V610 Z M450 900 H950 V1060 H450 Z" },
  { id: "town", d: "M1480 610 H1800 V560 H2600 V620 H3080 V760 H2900 V1120 H2100 V900 H1600 V820 H1480 Z M1720 560 V360 H2400 V560 Z M2520 250 V560 H2800 V250 Z M2140 940 H2720 V1120 H2140 Z" },
  { id: "mine", d: "M2920 590 H3400 V520 H3900 V720 H4280 V760 H4280 V920 H4380 V1160 H3900 V1120 H3200 V980 H2920 Z M3580 720 V980 H3800 V720 Z M3240 980 H3800 V1140 H3240 Z" },
  { id: "forest", d: "M4280 600 H4700 V500 H5300 V560 H5700 V760 H5600 V980 H4680 V920 H4320 V780 H4280 Z M5000 500 V360 H5400 V560 H5300 V500 Z M4500 880 H4960 V1050 H4500 Z M5140 780 H5420 V960 H5140 Z" },
  { id: "cliff", d: "M5720 510 H6200 V470 H6700 V320 H7100 V140 H7220 V620 H7000 V700 H6400 V840 H5720 Z M6200 470 V280 H6600 V470 Z M5880 760 H6400 V900 H5880 Z" },
  { id: "palace", d: "M7100 500 H7600 V450 H8300 V700 H8650 V1080 H8200 V1120 H7400 V980 H7100 Z M7700 450 V280 H8300 V500 H8200 V450 Z M7400 860 H8400 V1080 H7400 Z" },
  { id: "peak", d: "M8500 470 H9000 V400 H9600 V280 H10000 V110 H10080 V620 H9800 V560 H9300 V720 H8700 V900 H8500 Z" },
] as const;

const TRANSITIONS = [
  { x: 1520, y: 720, title: "山门缓坡", note: "步行连续进入 · 无切场" },
  { x: 2960, y: 700, title: "矿口横坑", note: "同场景横向转入" },
  { x: 4400, y: 560, title: "根穴隧道", note: "矿脉出口 → 幽林入口 · 洞口过渡无切场" },
  { x: 5760, y: 600, title: "断崖索桥", note: "长桥连续横移" },
  { x: 7140, y: 600, title: "泄洪石闸", note: "机关开启后永久连通" },
  { x: 8540, y: 570, title: "登天梯", note: "三印能力门" },
] as const;

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
  [4380, 740, 180], [4520, 740, 170], [4700, 730, 180], [4890, 725, 190], [5090, 720, 180],
  [5280, 715, 190], [5480, 710, 180], [5240, 530, 200], [5260, 930, 230], [5660, 720, 180],
  [4600, 1020, 200], [4820, 1020, 200],
  // cliff
  [5780, 670, 200], [5980, 660, 190], [6170, 650, 210], [6380, 645, 190], [6570, 640, 190],
  [6760, 635, 190], [6280, 440, 210], [6600, 370, 190], [6820, 230, 210], [5900, 880, 190], [6140, 880, 220],
  // palace
  [7180, 680, 200], [7380, 670, 190], [7570, 665, 200], [7770, 660, 200], [7970, 655, 200],
  [8170, 650, 190], [7860, 460, 230], [7460, 1020, 320], [8060, 1060, 250], [7160, 860, 180],
  // peak
  [8580, 640, 200], [8780, 615, 190], [8970, 595, 190], [9160, 570, 200], [9360, 545, 190],
  [9550, 515, 180], [9730, 500, 190], [9380, 370, 220], [9760, 250, 210], [8660, 880, 200],
] as const;

const HOUSES = [
  { x: 90, y: 700, w: 130, h: 110, roof: "gable" },
  { x: 990, y: 430, w: 150, h: 120, roof: "temple" },
  { x: 1600, y: 660, w: 150, h: 130, roof: "gable" },
  { x: 1980, y: 650, w: 160, h: 125, roof: "temple" },
  { x: 1780, y: 400, w: 140, h: 110, roof: "gable" },
  { x: 2590, y: 250, w: 160, h: 120, roof: "tower" },
  { x: 3930, y: 860, w: 180, h: 130, roof: "organic" },
  { x: 5260, y: 390, w: 160, h: 120, roof: "organic" },
  { x: 6320, y: 300, w: 160, h: 130, roof: "temple" },
  { x: 6840, y: 110, w: 150, h: 110, roof: "tower" },
  { x: 7890, y: 310, w: 200, h: 130, roof: "palace" },
  { x: 9410, y: 230, w: 170, h: 130, roof: "temple" },
  { x: 9780, y: 110, w: 180, h: 130, roof: "palace" },
] as const;

const BRIDGES = [
  { x1: 1480, x2: 1580, y: 740, type: "stone" },
  { x1: 2880, x2: 3000, y: 710, type: "timber" },
  { x1: 4270, x2: 4300, y: 700, type: "timber" },
  { x1: 4500, x2: 4540, y: 700, type: "timber" },
  { x1: 5680, x2: 5800, y: 600, type: "suspension" },
  { x1: 6980, x2: 7200, y: 590, type: "chain" },
  { x1: 8360, x2: 8600, y: 570, type: "stone" },
  { x1: 6180, x2: 6400, y: 560, type: "suspension" },
  { x1: 3680, x2: 3920, y: 1010, type: "timber" },
] as const;

const LADDERS = [
  { x: 1065, y1: 560, y2: 780 }, { x: 920, y1: 740, y2: 980 },
  { x: 1835, y1: 510, y2: 780 }, { x: 2665, y1: 250, y2: 700 },
  { x: 2640, y1: 700, y2: 1040 }, { x: 3680, y1: 620, y2: 980 }, { x: 3750, y1: 700, y2: 1080 },
  { x: 4930, y1: 725, y2: 1020 }, { x: 5380, y1: 650, y2: 930 }, { x: 6390, y1: 360, y2: 600 },
  { x: 6700, y1: 220, y2: 390 }, { x: 6360, y1: 600, y2: 840 },
  { x: 7980, y1: 460, y2: 655 },
  { x: 7260, y1: 700, y2: 860 }, { x: 9490, y1: 370, y2: 530 },
  { x: 8770, y1: 650, y2: 820 },
] as const;

const ELEVATORS = [
  { x: 3680, y: 520, h: 460 }, { x: 4200, y: 760, h: 320 }, { x: 8760, y: 560, h: 340 },
] as const;

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
  const [zoom, setZoom] = useState(0.55);
  const [selectedZone, setSelectedZone] = useState("town");
  const [selectedRoom, setSelectedRoom] = useState<string | null>(null);
  const [visibleEnemies, setVisibleEnemies] = useState<Set<EnemyId>>(new Set(ENEMY_ORDER));
  const [selectedEnemy, setSelectedEnemy] = useState<EnemyId | null>(null);
  const [visibleMarkers, setVisibleMarkers] = useState<Set<MarkerKind>>(new Set(ALL_MARKERS));
  const viewportRef = useRef<HTMLDivElement>(null);
  const drag = useRef({ active: false, x: 0, y: 0, left: 0, top: 0 });

  const zone = ZONES.find((item) => item.id === selectedZone) ?? ZONES[0];
  const zoneIndex = ZONES.findIndex((item) => item.id === selectedZone);
  const nextTransition = TRANSITIONS[zoneIndex];
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

  const updateZoom = (next: number) => setZoom(Math.min(1.15, Math.max(0.38, Number(next.toFixed(2)))));

  const focusZone = (id: string) => {
    const target = ZONES.find((item) => item.id === id);
    if (!target) return;
    const focusTop = id === "peak" || id === "cliff" ? 0 : 280 * zoom;
    setSelectedZone(id);
    setSelectedRoom(null);
    viewportRef.current?.scrollTo({
      left: Math.max(0, target.x * zoom - 140),
      top: focusTop,
      behavior: "smooth",
    });
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
    <main className="map-app">
      <header className="map-header">
        <div className="map-title-block">
          <span className="prototype-tag">LEVEL DESIGN / v0.5 · ENCOUNTER PLAN</span>
          <h1>
            墨境行者 <b>世界地图模拟器</b>
          </h1>
        </div>
        <nav className="header-actions" aria-label="页面导航">
          <span className="status-dot">
            <i />
            可读性细化
          </span>
          <a href="/">返回战斗原型 ↗</a>
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
              <div className={`map-scale ${zoom < 0.65 ? "low-detail" : ""}`} style={{ width: MAP_W, height: MAP_H, transform: `scale(${zoom})` }}>
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

                  {ELEVATORS.map((lift, index) => (
                    <g key={`lift-${index}`} className="elevator-outline">
                      <rect x={lift.x - 34} y={lift.y} width="68" height={lift.h} />
                      <line x1={lift.x} y1={lift.y} x2={lift.x} y2={lift.y + lift.h} />
                      <rect className="lift-platform" x={lift.x - 29} y={lift.y + lift.h * 0.54} width="58" height="12" />
                      <circle cx={lift.x} cy={lift.y + 16} r="9" />
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
                    <path d="M7400 980 Q7520 965 7640 980 T7880 980 T8120 980 T8360 980" />
                    <path d="M7400 995 Q7520 980 7640 995 T7880 995 T8120 995 T8360 995" />
                    <rect x="7400" y="995" width="1000" height="150" />
                  </g>
                </svg>

                <svg className="route-layer" viewBox={`0 0 ${MAP_W} ${MAP_H}`} aria-hidden="true">
                  {CONNECTIONS.map((line, i) => (
                    <line key={`m${i}`} x1={line[0]} y1={line[1]} x2={line[2]} y2={line[3]} className="main-route" />
                  ))}
                  {SHORTCUTS.map((line, i) => (
                    <line
                      key={`s${i}`}
                      x1={line[0]}
                      y1={line[1]}
                      x2={line[2]}
                      y2={line[3]}
                      className="shortcut-route"
                    />
                  ))}
                </svg>

                {TRANSITIONS.map((item) => (
                  <div
                    key={item.x}
                    className={`transition-node ${item.title === "根穴隧道" ? "junction" : ""}`}
                    style={{ left: item.x, top: item.y }}
                  >
                    <i />
                    <span>
                      <b>{item.title}</b>
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
                  return (
                    <button
                      key={item.id}
                      className={`map-room kind-${item.kind} ${["boss", "arena", "secret"].includes(item.kind) ? "instance" : "seamless"} ${selectedRoom === item.id ? "active" : ""}`}
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
                      {item.lock && <span className="ability-lock">◇ {item.lock}</span>}
                      {item.grants && zoom >= 0.6 && (
                        <span className="ability-grant">＋ {item.grants[0]}</span>
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
                <div className="player-scale-marker" style={{ left: zone.x + 95, top: 860 }}>
                  <span>{PLAYER_METRICS.height}u</span>
                  <img src="/assets/player.png" alt="玩家物理尺寸参照" />
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
            <small>ABILITY CHAIN</small>
            <ol>
              {ABILITY_CHAIN.map((step) => (
                <li key={step.ability} className={zone.ability === step.ability || (zone.id === "peak" && step.ability === "归途传送") ? "current" : ""}>
                  <b>{step.ability}</b>
                  <span>{step.at}</span>
                  <em>→ {step.unlocks}</em>
                </li>
              ))}
            </ol>
          </div>

          <div className="connection-card">
            <small>SCENE CONNECTION</small>
            <b>{nextTransition?.title ?? "终局封闭区域"}</b>
            <span>{nextTransition?.note ?? "击败最终首领后，用传送端点返回世界探索"}</span>
            <em>区界默认连续场景无切场；紫「门」为配对传送，勿当成实体长隧道</em>
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
              {room.lock && (
                <p>
                  进入条件：<b>{room.lock}</b>
                </p>
              )}
              {room.grants && (
                <p className="room-grants">
                  通关奖励：<b>{room.grants.join(" · ")}</b>
                </p>
              )}
              {(room.enter || room.exit) && (
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
                </div>
              )}
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
              {room.note && !room.enter && (
                <p className="room-note">
                  进出逻辑：{room.note}
                </p>
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
            <b>1 角色高 = {PLAYER_METRICS.height}u</b>
            <div><span>原地跳高</span><em>{PLAYER_METRICS.jumpHeight}u</em></div>
            <div><span>跑跳跨度</span><em>{PLAYER_METRICS.runJumpWidth}u</em></div>
            <div><span>二段跳高</span><em>{PLAYER_METRICS.doubleJumpHeight}u</em></div>
            <div><span>抓梯范围</span><em>±{PLAYER_METRICS.ladderGrab}u</em></div>
            <div><span>安全落差</span><em>{PLAYER_METRICS.safeFall}u</em></div>
          </div>
        </aside>
      </section>
    </main>
  );
}
