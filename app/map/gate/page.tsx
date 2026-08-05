"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import { GATE_SCREEN, GATE_SCREENS } from "./screens";
import "./gate.css";

type LayerId = "bounds" | "architecture" | "routes" | "encounters" | "notes";
type BlockKind = "safe" | "traverse" | "combat" | "arena" | "ability" | "transition";

type SceneBlock = {
  id: string;
  index: string;
  name: string;
  x: number;
  y: number;
  kind: BlockKind;
  purpose: string;
  landmark: string;
  entry: string;
  exit: string;
  enemies: string[];
  geometry: string;
  detailPriority: string;
};

const DRAFT_SCALE = 12;
const draftPx = (value: number) => value * DRAFT_SCALE;
const DRAFT_MAP = { w: 320 * 12, h: 1180 } as const;
const SCREEN = GATE_SCREEN;
const MAP = { w: SCREEN.w * 12, h: draftPx(DRAFT_MAP.h) } as const;
const ZOOM = { overview: 0.016, design: 0.05, screen: 0.2, actual: 1 } as const;

const BLOCKS: SceneBlock[] = [
  { id: "s01", index: "01", name: GATE_SCREENS[0].name, x: 0, y: draftPx(560), kind: "safe", purpose: "醒转、移动、镜头跟随与神龛教学。", landmark: "残佛、漏雨天井、第一束远山天光", entry: "游戏出生点", exit: "穿破墙进入竹雾村缘", enemies: [], geometry: "低矮残殿 + 平整安全地板 + 无伤落差", detailPriority: "出生构图、神龛操作距离、第一眼远景" },
  { id: "s02", index: "02", name: GATE_SCREENS[1].name, x: SCREEN.w, y: draftPx(550), kind: "traverse", purpose: "用房屋、竹篱和小台阶建立村落尺度。", landmark: "两间错层民居与雨水木槽", entry: "破庙东侧缺口", exit: "村道缓坡", enemies: ["竹影刀客 ×1（低警戒）"], geometry: "民居前台 + 可跳屋檐 + 竹篱后景", detailPriority: "房屋可活动屋顶与地面路线的重叠" },
  { id: "s03", index: "03", name: GATE_SCREENS[2].name, x: SCREEN.w * 2, y: draftPx(530), kind: "traverse", purpose: "连续坡面练习跑跳、翻滚与下坡加速。", landmark: "沿山势上升的排水石阶", entry: "村缘石桥", exit: "竹篱小径", enemies: ["竹影刀客 ×1"], geometry: "三段缓坡 + 两处安全落脚 + 排水沟", detailPriority: "坡度、角色脚底贴合、镜头纵向补偿" },
  { id: "s04", index: "04", name: GATE_SCREENS[3].name, x: SCREEN.w * 3, y: draftPx(515), kind: "combat", purpose: "第一次完整近战，提供可绕背的小高台。", landmark: "风折竹林与塌陷柴棚顶", entry: "缓坡顶端", exit: "石狮甬道；或单向落入崖下柴棚", enemies: ["竹影刀客 ×2"], geometry: "上下双层交错 + 单向落口 + 非致死下层", detailPriority: "首次夹击安全距离与落口可读性" },
  { id: "s05", index: "05", name: GATE_SCREENS[4].name, x: SCREEN.w * 4, y: draftPx(500), kind: "combat", purpose: "在门框遮挡中首次引入高处弩箭。", landmark: "残缺石狮、三重门框、山门题刻", entry: "竹林东口", exit: "穿甬道到雨廊", enemies: ["竹影刀客 ×1", "屋脊弩手 ×1"], geometry: "连续门洞 + 上层射击台 + 柱后安全区", detailPriority: "弩线预警不被门柱遮挡" },
  { id: "s06", index: "06", name: GATE_SCREENS[5].name, x: SCREEN.w * 5, y: draftPx(490), kind: "traverse", purpose: "将室外坡地过渡成山门建筑群，并接回下层支路。", landmark: "长雨廊、悬钟、瀑布式檐水", entry: "石狮甬道", exit: "东出演武坪；下层木梯在西侧接回", enemies: ["屋脊弩手 ×1"], geometry: "廊下主路 + 屋檐射台 + 回程木梯", detailPriority: "前中后景遮挡与雨线层级" },
  { id: "s07", index: "07", name: GATE_SCREENS[6].name, x: SCREEN.w * 6, y: draftPx(480), kind: "safe", purpose: "战前降压、展示上层校场并提供复活锚点。", landmark: "武器架、练功木人与上方校场旗", entry: "雨廊东门 / 下层回程梯", exit: "折返石阶上行守门校场", enemies: ["竹影刀客 ×1（巡逻）"], geometry: "宽平地 + 上行折返阶 + 下层回接", detailPriority: "玩家一眼看懂“向上挑战、向右暂封”" },
  { id: "s08", index: "08", name: GATE_SCREENS[7].name, x: SCREEN.w * 7, y: draftPx(255), kind: "ability", purpose: "两波精英教学；击败赤枪校尉后获得瞬步。", landmark: "校场旗阵、铜钟和雨幕后的山门楼", entry: "演武坪折返上行", exit: "战后东门开启，下坡回到雨亭箭廊", enemies: ["W1 竹影刀客 ×2", "W2 赤枪校尉 ×1"], geometry: "3840×2160完整封锁场 + 两端防夹角 + 上层观战檐", detailPriority: "枪尖长预警、瞬步穿身空间、封门边界" },
  { id: "s09", index: "09", name: GATE_SCREENS[8].name, x: SCREEN.w * 8, y: draftPx(470), kind: "arena", purpose: "用连续箭线低风险验证刚获得的瞬步。", landmark: "三座雨亭与贯穿画面的红色箭线", entry: "校场东侧下坡", exit: "穿箭廊到山门前庭", enemies: ["屋脊弩手 ×3（分段激活）"], geometry: "三段掩体 + 等距箭线 + 失败退回而非坠落", detailPriority: "箭线节奏、掩体宽度与瞬步冷却匹配" },
  { id: "s10", index: "10", name: GATE_SCREENS[9].name, x: SCREEN.w * 9, y: draftPx(465), kind: "combat", purpose: "把瞬步、绕背和远程压力组合成毕业小战。", landmark: "双碑亭、积水庭院、关闭的主闸", entry: "雨亭箭廊", exit: "完成战斗后进入城楼闸机", enemies: ["竹影刀客 ×2", "屋脊弩手 ×1"], geometry: "开阔中庭 + 两侧半高台 + 中央积水减速带", detailPriority: "不让积水、弩箭和近战同时形成死角" },
  { id: "s11", index: "11", name: GATE_SCREENS[10].name, x: SCREEN.w * 10, y: draftPx(450), kind: "combat", purpose: "区域压轴守门战与机关操作，确认玩家掌握瞬步。", landmark: "双层城楼、巨型绞盘、雨蚀铜门", entry: "山门前庭", exit: "启动闸机后进入山门驿道", enemies: ["铁甲盾卫 ×1", "屋脊弩手 ×1"], geometry: "城楼上下层 + 中央闸机 + 盾卫绕背空间", detailPriority: "闸机操作安全窗与盾卫破局路线" },
  { id: "s12", index: "12", name: GATE_SCREENS[11].name, x: SCREEN.w * 11, y: draftPx(475), kind: "transition", purpose: "1屏降压过渡，完成湿岩到青砖旧城的材质渐变。", landmark: "驿棚、第一盏悬灯与远处旧城门楼", entry: "雨蚀铜门", exit: "无切场进入悬灯旧城过渡段", enemies: ["无封锁；远处城防敌剪影"], geometry: "下坡驿道 + 木棚遮挡流送门 + 平缓出口", detailPriority: "旧区卸载遮挡、新区地标首曝时机" },
];

if (BLOCKS.length !== GATE_SCREENS.length || BLOCKS.some((block, index) => block.name !== GATE_SCREENS[index].name || block.id !== GATE_SCREENS[index].id)) {
  throw new Error("场景总图 BLOCKS 与 GATE_SCREENS 名称/顺序不一致");
}

const LOWER_BLOCKS = [
  { id: "l1", name: "崖下柴棚", x: draftPx(1010), y: draftPx(850), w: draftPx(300), note: "S04单向落下；材料奖励" },
  { id: "l2", name: "排水涵洞", x: draftPx(1310), y: draftPx(875), w: draftPx(310), note: "低矮横穿；1名刀客" },
  { id: "l3", name: "崖道回廊", x: draftPx(1620), y: draftPx(855), w: draftPx(330), note: "东端木梯回S07" },
] as const;

const FLOOR_SEGMENTS = [
  [40, 760, 250], [320, 750, 285], [640, 735, 290], [960, 720, 300], [1280, 705, 300], [1600, 695, 300],
  [1920, 685, 280], [2200, 620, 110], [2240, 435, 290], [2500, 520, 110], [2560, 665, 290], [2880, 655, 290],
  [3200, 645, 290], [3520, 655, 300], [1010, 950, 300], [1310, 975, 310], [1620, 955, 330],
] as const;

const HOUSES = [
  { x: 70, y: 615, w: 170, h: 145, roof: "ruin" },
  { x: 360, y: 635, w: 120, h: 115, roof: "gable" },
  { x: 495, y: 650, w: 90, h: 100, roof: "gable" },
  { x: 1340, y: 585, w: 175, h: 120, roof: "gate" },
  { x: 1635, y: 580, w: 235, h: 115, roof: "corridor" },
  { x: 2290, y: 300, w: 205, h: 135, roof: "arena" },
  { x: 2620, y: 555, w: 170, h: 110, roof: "pavilion" },
  { x: 3260, y: 400, w: 220, h: 245, roof: "tower" },
  { x: 3565, y: 550, w: 150, h: 105, roof: "gable" },
] as const;

const MAIN_ROUTE = "M40 760 L320 750 L640 735 L960 720 L1280 705 L1600 695 L1920 685 L2100 685 L2240 610 L2240 435 L2530 435 L2560 590 L2560 665 L2880 655 L3200 645 L3520 655 L3810 655";
const LOWER_ROUTE = "M1100 720 L1130 950 L1310 950 L1620 975 L1900 955 L1950 685";

const ENCOUNTERS = [
  { x: 510, y: 720, label: "刀", tone: "basic" }, { x: 820, y: 700, label: "刀", tone: "basic" },
  { x: 1080, y: 685, label: "刀×2", tone: "basic" }, { x: 1420, y: 665, label: "刀", tone: "basic" },
  { x: 1510, y: 610, label: "弩", tone: "range" }, { x: 1810, y: 610, label: "弩", tone: "range" },
  { x: 2070, y: 650, label: "刀", tone: "basic" }, { x: 2350, y: 405, label: "W1", tone: "wave" },
  { x: 2450, y: 405, label: "枪", tone: "elite" }, { x: 2670, y: 625, label: "弩", tone: "range" },
  { x: 2760, y: 625, label: "弩", tone: "range" }, { x: 2990, y: 615, label: "刀×2", tone: "basic" },
  { x: 3110, y: 580, label: "弩", tone: "range" }, { x: 3330, y: 605, label: "盾", tone: "elite" },
  { x: 3410, y: 520, label: "弩", tone: "range" }, { x: 1450, y: 935, label: "刀", tone: "basic" },
] as const;

const KIND_LABEL: Record<BlockKind, string> = {
  safe: "安全 / 叙事", traverse: "移动 / 建筑", combat: "常规战斗", arena: "能力验证", ability: "精英 / 能力", transition: "区域过渡",
};

export default function GateSceneMap() {
  const [zoom, setZoom] = useState(ZOOM.design);
  const [selectedId, setSelectedId] = useState("s01");
  const [layers, setLayers] = useState<Set<LayerId>>(new Set(["bounds", "architecture", "routes", "encounters", "notes"]));
  const viewportRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef({ active: false, x: 0, y: 0, left: 0, top: 0 });
  const selected = useMemo(() => BLOCKS.find((block) => block.id === selectedId) ?? BLOCKS[0], [selectedId]);

  const focusBlock = (id: string, nextZoom = zoom) => {
    const block = BLOCKS.find((item) => item.id === id);
    if (!block) return;
    setSelectedId(id);
    requestAnimationFrame(() => viewportRef.current?.scrollTo({
      left: Math.max(0, (block.x + SCREEN.w / 2) * nextZoom - (viewportRef.current?.clientWidth ?? 0) / 2),
      top: Math.max(0, (block.y + SCREEN.h / 2) * nextZoom - (viewportRef.current?.clientHeight ?? 0) / 2),
      behavior: "smooth",
    }));
  };

  const setZoomAndFocus = (next: number) => {
    const normalized = Math.max(0.012, Math.min(1, Number(next.toFixed(3))));
    setZoom(normalized);
    focusBlock(selectedId, normalized);
  };

  const toggleLayer = (layer: LayerId) => setLayers((current) => {
    const next = new Set(current);
    if (next.has(layer)) next.delete(layer); else next.add(layer);
    return next;
  });

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    dragRef.current = { active: true, x: event.clientX, y: event.clientY, left: viewport.scrollLeft, top: viewport.scrollTop };
    viewport.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current.active || !viewportRef.current) return;
    viewportRef.current.scrollLeft = dragRef.current.left - (event.clientX - dragRef.current.x);
    viewportRef.current.scrollTop = dragRef.current.top - (event.clientY - dragRef.current.y);
  };

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      viewportRef.current?.scrollTo({ left: 0, top: 96 });
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <main className="gate-map-app" data-scene-blocks={BLOCKS.length} data-main-screens={MAP.w / SCREEN.w} data-map-pixel-width={MAP.w} data-screen-pixels={`${SCREEN.w}x${SCREEN.h}`}>
      <header className="gate-header">
        <div>
          <span>SCENE 01 / MASTER LEVEL MAP</span>
          <h1>雨蚀山门 <b>完整场景总图</b></h1>
        </div>
        <nav aria-label="场景地图导航">
          <span>12屏主线 · 3段下层支路 · 1个能力战</span>
          <Link href="/map">返回世界地图 ↗</Link>
        </nav>
      </header>

      <div className="gate-workspace">
        <aside className="gate-block-list">
          <div className="gate-panel-title"><span>横向区块</span><b>12 / 12</b></div>
          <div className="gate-block-buttons">
            {BLOCKS.map((block) => (
              <button key={block.id} type="button" className={selectedId === block.id ? "active" : ""} onClick={() => focusBlock(block.id)}>
                <i>{block.index}</i><span><b>{block.name}</b><small>{KIND_LABEL[block.kind]}</small></span>
              </button>
            ))}
          </div>
          <div className="gate-lower-summary">
            <b>下层可选回环</b>
            <span>S04 单向落下 → 柴棚 → 涵洞 → 回廊 → S07 木梯回主路</span>
          </div>
        </aside>

        <section className="gate-map-main">
          <div className="gate-toolbar">
            <span className="gate-drag-note">拖拽平移 · 点击区块查看施工信息</span>
            <div className="gate-layer-controls" aria-label="地图图层">
              {(["bounds", "architecture", "routes", "encounters", "notes"] as LayerId[]).map((layer) => (
                <button key={layer} type="button" className={layers.has(layer) ? "active" : ""} onClick={() => toggleLayer(layer)}>
                  {{ bounds: "活动区", architecture: "建筑", routes: "路线", encounters: "敌人", notes: "标注" }[layer]}
                </button>
              ))}
            </div>
            <div className="gate-zoom-presets" aria-label="缩放预设">
              <button type="button" className={zoom === ZOOM.overview ? "active" : ""} onClick={() => setZoomAndFocus(ZOOM.overview)}>总览</button>
              <button type="button" className={zoom === ZOOM.design ? "active" : ""} onClick={() => setZoomAndFocus(ZOOM.design)}>设计</button>
              <button type="button" className={zoom === ZOOM.screen ? "active" : ""} onClick={() => setZoomAndFocus(ZOOM.screen)}>单屏适配</button>
              <button type="button" className={zoom === ZOOM.actual ? "active" : ""} onClick={() => setZoomAndFocus(ZOOM.actual)}>1:1</button>
              <button type="button" aria-label="缩小" onClick={() => setZoomAndFocus(zoom - 0.08)}>−</button>
              <span>{Math.round(zoom * 100)}%</span>
              <button type="button" aria-label="放大" onClick={() => setZoomAndFocus(zoom + 0.08)}>＋</button>
            </div>
          </div>

          <div
            className="gate-viewport"
            ref={viewportRef}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={() => { dragRef.current.active = false; }}
            onPointerCancel={() => { dragRef.current.active = false; }}
          >
            <div className="gate-canvas" style={{ width: MAP.w * zoom, height: MAP.h * zoom, "--scaled-height": `${MAP.h * zoom}px` } as CSSProperties}>
              <div className="gate-scale" style={{ width: MAP.w, height: MAP.h, transform: `scale(${zoom})`, "--inverse": 1 / zoom } as CSSProperties}>
                <svg className="gate-scene-svg" viewBox={`0 0 ${MAP.w} ${MAP.h}`} role="img" aria-label="雨蚀山门十二个4K屏幕横向关卡剖面">
                  <defs>
                    <pattern id="gate-grid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M40 0H0V40" /></pattern>
                    <linearGradient id="gate-mist" x1="0" x2="1"><stop offset="0" stopColor="#628276" stopOpacity=".2"/><stop offset=".7" stopColor="#8d735b" stopOpacity=".12"/><stop offset="1" stopColor="#c28a59" stopOpacity=".16"/></linearGradient>
                  </defs>
                  <g transform={`scale(${DRAFT_SCALE})`}>
                  <rect width={DRAFT_MAP.w} height={DRAFT_MAP.h} fill="url(#gate-grid)" />
                  <path className="gate-mountain-back" d="M0 620 L300 420 L610 500 L920 330 L1260 460 L1620 280 L2030 400 L2440 210 L2850 390 L3260 240 L3840 360 L3840 1120 L0 1120Z" />
                  <path className="gate-terrain" d="M0 780 L320 770 L640 755 L960 740 L1280 725 L1600 715 L1920 705 L2180 705 L2240 640 L2240 455 L2530 455 L2580 685 L2880 675 L3200 665 L3520 675 L3840 675 L3840 1120 L0 1120Z" />
                  <rect x="0" y="0" width={DRAFT_MAP.w} height={DRAFT_MAP.h} fill="url(#gate-mist)" />

                  {layers.has("bounds") && Array.from({ length: 12 }).map((_, index) => (
                    <g key={index} className={`screen-boundary ${selectedId === `s${String(index + 1).padStart(2, "0")}` ? "selected" : ""}`}>
                      <rect x={index * 320} y="120" width="320" height="850" />
                      <text x={index * 320 + 18} y="155">S{String(index + 1).padStart(2, "0")} · 3840×2160px</text>
                    </g>
                  ))}

                  {layers.has("architecture") && (
                    <g className="architecture">
                      {FLOOR_SEGMENTS.map(([x, y, w], index) => <g key={index} className="floor"><line x1={x} y1={y} x2={x + w} y2={y}/><line x1={x} y1={y + 14} x2={x + w} y2={y + 14}/></g>)}
                      {HOUSES.map((house) => (
                        <g key={`${house.x}-${house.y}`} className={`house house-${house.roof}`}>
                          <rect x={house.x} y={house.y} width={house.w} height={house.h}/>
                          <path d={`M${house.x - 18} ${house.y} Q${house.x + house.w / 2} ${house.y - (house.roof === "tower" ? 70 : 36)} ${house.x + house.w + 18} ${house.y}`}/>
                          <rect className="door" x={house.x + house.w / 2 - 18} y={house.y + house.h - 58} width="36" height="58"/>
                        </g>
                      ))}
                      <g className="stone-stairs"><path d="M2100 685 h35 v-35 h35 v-35 h35 v-35 h35 v-35 h35 v-35 h35 v-35 h35"/><path d="M2530 435 l30 230"/></g>
                      <g className="gate-ladder"><line x1="1936" y1="685" x2="1936" y2="955"/><line x1="1956" y1="685" x2="1956" y2="955"/>{Array.from({length:10}).map((_,i)=><line key={i} x1="1936" y1={710+i*24} x2="1956" y2={710+i*24}/>)}</g>
                      <g className="fence-line">{[980,1040,1100,1160,1215].map(x=><path key={x} d={`M${x} 720 v-74 m-14 18 h28 m-28 28 h28`}/>)}</g>
                      <g className="gate-mechanism"><circle cx="3370" cy="520" r="30"/><circle cx="3370" cy="520" r="10"/><path d="M3370 482v76M3332 520h76M3344 494l52 52M3396 494l-52 52"/></g>
                      <g className="rain-lines">{Array.from({length:42}).map((_,i)=><line key={i} x1={i*92+20} y1={210+(i%5)*40} x2={i*92-8} y2={300+(i%5)*40}/>)}</g>
                    </g>
                  )}

                  {layers.has("routes") && <g className="routes"><path className="main-route" d={MAIN_ROUTE}/><path className="secret-route" d={LOWER_ROUTE}/><circle cx="2390" cy="435" r="26" className="ability-node"/><text x="2390" y="441">瞬</text><path className="arrow-line" d="M2580 610h210M2670 580l30 30-30 30"/></g>}

                  {layers.has("encounters") && <g className="encounters">{ENCOUNTERS.map((enemy,index)=><g key={index} className={`scene-enemy scene-enemy-${enemy.tone}`}><circle cx={enemy.x} cy={enemy.y} r={enemy.label.length > 1 ? 22 : 17}/><text x={enemy.x} y={enemy.y+4}>{enemy.label}</text></g>)}</g>}

                  {layers.has("notes") && <g className="scene-notes"><g><path d="M1110 780v120"/><text x="1025" y="805">单向落口</text></g><g><path d="M1946 820h120"/><text x="1980" y="845">回程木梯</text></g><g><path d="M2240 465h290"/><text x="2300" y="490">封锁式精英场</text></g><g><path d="M3560 520h170"/><text x="3580" y="545">流送遮挡门</text></g></g>}
                  </g>
                </svg>

                {layers.has("bounds") && BLOCKS.map((block) => (
                  <button
                    key={block.id}
                    type="button"
                    className={`scene-block scene-${block.kind} ${selectedId === block.id ? "selected" : ""}`}
                    style={{ left: block.x + draftPx(12), top: Math.max(draftPx(170), block.y - draftPx(82)), width: SCREEN.w - draftPx(24) }}
                    onClick={(event) => { event.stopPropagation(); focusBlock(block.id); }}
                  >
                    <span>{block.index}</span><b>{block.name}</b><small>{KIND_LABEL[block.kind]}</small>
                  </button>
                ))}

                {layers.has("notes") && LOWER_BLOCKS.map((block) => (
                  <div key={block.id} className="lower-block" style={{ left: block.x, top: block.y - draftPx(55), width: block.w }}><b>{block.name}</b><span>{block.note}</span></div>
                ))}
              </div>
            </div>
          </div>

          <div className="gate-minimap" aria-label="十二屏地图概览">
            <span>WEST / 破庙</span>
            <div>{BLOCKS.map((block) => <button key={block.id} type="button" aria-label={`${block.index} ${block.name}`} className={`${selectedId === block.id ? "active" : ""} mini-${block.kind}`} onClick={() => focusBlock(block.id)} />)}</div>
            <span>EAST / 旧城</span>
          </div>
        </section>

        <aside className="gate-detail">
          <div className="gate-detail-index">{selected.index}</div>
          <small>BLOCK {selected.id.toUpperCase()} · {KIND_LABEL[selected.kind]}</small>
          <h2>{selected.name}</h2>
          <p>{selected.purpose}</p>
          <dl>
            <div><dt>范围</dt><dd>3840 × 2160px · 1个4K操作屏</dd></div>
            <div><dt>入口</dt><dd>{selected.entry}</dd></div>
            <div><dt>出口</dt><dd>{selected.exit}</dd></div>
            <div><dt>建筑几何</dt><dd>{selected.geometry}</dd></div>
          </dl>
          <section>
            <small>LANDMARK</small><b>{selected.landmark}</b>
          </section>
          <section>
            <small>ENCOUNTER</small>{selected.enemies.length ? selected.enemies.map(enemy => <b key={enemy}>{enemy}</b>) : <b>无敌人 · 安全观察</b>}
          </section>
          <section className="detail-next">
            <small>NEXT DETAIL PASS</small><b>{selected.detailPriority}</b><span>后续按此区块编号逐屏绘制地板碰撞、前后景建筑、敌人出生点与摄影机边界。</span>
          </section>
          <Link className="block-detail-link" href="/map/gate/s01">打开一区连续施工图（已建 S01–S12） ↗</Link>
          <div className="scene-rules">
            <b>总图硬规则</b>
            <span>主线全程无切场</span><span>所有跌落均非致死</span><span>能力战后立即设置安全验证</span><span>S12承担材质与流送渐变</span>
          </div>
        </aside>
      </div>
    </main>
  );
}
