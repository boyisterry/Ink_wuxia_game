/** 敌人图鉴 · 地图与文档共用数据源。完整设定见 docs/enemies.md */

export type EnemyTier = "basic" | "elite" | "boss";

export type EnemyId =
  | "bamboo_blade"
  | "rooftop_bow"
  | "ink_crow"
  | "ink_spider"
  | "iron_shield"
  | "lantern_mage"
  | "lantern_adept"
  | "ink_beast"
  | "chain_jailer"
  | "ink_eel"
  | "drowned_guard"
  | "scarlet_captain"
  | "faceless_sword"
  | "lake_maiden"
  | "tomb_warden"
  | "pine_nightmare"
  | "formless_lord";

export type EnemyMeta = {
  id: EnemyId;
  label: string;
  glyph: string;
  color: string;
  tier: EnemyTier;
  /** 侧栏一行摘要 */
  summary: string;
  /** 外形与气质 */
  look: string;
  /** 设定出现区域（文案） */
  loreZones: string[];
  /** 地图分区 id */
  mapZones: string[];
  /** 主要动作 */
  moves: string[];
  /** 应对窗口 / 弱点 */
  window: string;
  /** 玩法定位 */
  role: string;
  /** Boss 阶段等扩展说明 */
  phases?: string[];
  /** 击败奖励（能力/叙事） */
  reward?: string;
};

export const ENEMY_ORDER: EnemyId[] = [
  "bamboo_blade",
  "rooftop_bow",
  "ink_crow",
  "ink_spider",
  "iron_shield",
  "lantern_mage",
  "ink_beast",
  "chain_jailer",
  "ink_eel",
  "drowned_guard",
  "lantern_adept",
  "scarlet_captain",
  "faceless_sword",
  "lake_maiden",
  "tomb_warden",
  "pine_nightmare",
  "formless_lord",
];

export const ENEMY_TIER_LABEL: Record<EnemyTier, string> = {
  basic: "基础",
  elite: "精英",
  boss: "区 Boss",
};

export const ENEMY_META: Record<EnemyId, EnemyMeta> = {
  bamboo_blade: {
    id: "bamboo_blade",
    label: "竹影刀客",
    glyph: "刀",
    color: "#d7a95c",
    tier: "basic",
    summary: "近战教学：格挡距离与收刀硬直",
    look: "穿破旧短衫，戴斗笠，使用单刀。平时缓慢巡逻，发现玩家后压低身体接近。",
    loreZones: ["竹雾村", "山道", "废弃驿站"],
    mapZones: ["gate", "town", "cliff", "palace", "peak"],
    moves: ["横向快斩：速度快、范围短", "蓄力下劈：刀身短暂红光，威力高", "后撤闪身：连续受击时后撤", "两刀连击：中后期横斩接反手斩"],
    window: "攻击结束后有明显收刀硬直，是主要反击窗口。",
    role: "让玩家学习格挡距离、翻滚时机和普通攻击节奏。最常见的近战敌人。",
  },
  rooftop_bow: {
    id: "rooftop_bow",
    label: "屋脊弩手",
    glyph: "弩",
    color: "#dd6b58",
    tier: "basic",
    summary: "高台压制，逼迫移动",
    look: "身形瘦长，披蓑衣，使用长弩，占据高台或远处平台。",
    loreZones: ["竹雾村屋顶", "悬崖栈道", "无相殿城墙"],
    mapZones: ["gate", "town", "mine", "cliff", "palace", "peak"],
    moves: ["单发弩箭：瞄准时细长红线", "三连速射：三支短间隔箭", "穿透重箭：蓄力久，可穿部分木质掩体", "后跳换位：玩家靠近后撤向后方平台"],
    window: "弩箭可被劈砍击落，也可翻滚穿过。",
    role: "迫使玩家移动，避免站桩与近战敌人反复换血。",
  },
  ink_crow: {
    id: "ink_crow",
    label: "墨羽鸦",
    glyph: "鸦",
    color: "#66b8b1",
    tier: "basic",
    summary: "俯冲与散射，脆弱可坠地",
    look: "由乌鸦、墨雾和残破符纸形成的飞行敌人，翅缘不断散落墨点。",
    loreZones: ["竹林上空", "断崖", "黑松湖"],
    mapZones: ["town", "mine", "forest", "cliff", "palace"],
    moves: ["俯冲啄击：斜上方高速冲向玩家", "墨羽散射：向下发射三至五片墨羽", "群体盘旋：多只交替攻击", "濒死自爆：高阶个体死亡留下小范围墨雾"],
    window: "生命值低、移速快；上挑、跳跃斩或弩箭可使其坠地，短时间无法行动。",
    role: "打断跳跃与攀爬节奏，制造立体压力。",
  },
  ink_spider: {
    id: "ink_spider",
    label: "墨腹蛛",
    glyph: "蛛",
    color: "#8e6bb5",
    tier: "basic",
    summary: "洞顶突袭与吐丝减速",
    look: "身体由湿润墨块与白骨关节构成，可在地面、墙壁和洞顶移动。",
    loreZones: ["墨骨窟", "剑冢牢地下层", "秘密通道"],
    mapZones: ["town", "mine"],
    moves: ["墙顶突袭：隐藏洞顶，经过时垂直落下", "吐丝束缚：降低移动与翻滚速度", "毒墨喷射：地面持续污染区", "幼蛛孵化：大型个体死亡可能释放两只幼蛛"],
    window: "腹部暗红光＝即将吐丝。攻击腹部可造成额外伤害，需等其翻身或跃下。",
    role: "地下与暗渠的伏击单位，训练警戒与弱点瞄准。",
  },
  iron_shield: {
    id: "iron_shield",
    label: "铁甲盾卫",
    glyph: "盾",
    color: "#9aa0a6",
    tier: "basic",
    summary: "正面强防，需绕后或破盾",
    look: "身材高大，穿残破重甲，使用方形铁盾与短刀。正面防御极强。",
    loreZones: ["剑冢牢", "无相殿外围", "重要机关门前"],
    mapZones: ["gate", "town", "mine", "palace", "peak"],
    moves: ["盾牌格挡：抵挡大部分正面普攻", "盾击：近距离击退并短暂硬直", "冲撞：举盾向前快速推进", "反手斩：绕后过程中突然回身"],
    window: "翻滚到身后、引诱冲撞撞墙，或后期重击破盾。盾破后进入攻击更快、防御极低的狂暴。",
    role: "门卫与关卡加压，惩罚无脑正面砍。",
  },
  lantern_mage: {
    id: "lantern_mage",
    label: "提灯术士",
    glyph: "灯",
    color: "#e07a5f",
    tier: "basic",
    summary: "符阵与墨火；施法硬直可打",
    look: "穿宽大道袍，脸被符纸遮住，手持散发红光的旧灯笼。",
    loreZones: ["悬寺", "地下祭坛", "黑松湖祠堂"],
    mapZones: ["town", "forest", "cliff", "palace"],
    moves: ["地面符阵：脚下红印延迟爆发", "墨火弹：缓慢追踪，可被攻击打散", "召唤墨影：一至两个低生命影子", "灯灭隐身：熄灯融入背景，再从他处出现"],
    window: "施法时不能移动，是最佳输出窗。击碎灯笼中断法术并进入较长失衡。",
    role: "普通远程法术单位；负责用符阵切割地面空间，不承担能力奖励精英职责。",
  },
  lantern_adept: {
    id: "lantern_adept",
    label: "掌灯使",
    glyph: "使",
    color: "#f08b65",
    tier: "elite",
    summary: "精英术士：控场、转阶段与能力守门",
    look: "提灯术士中的掌灯者，灯笼外套三层铜环，背后悬着可独立移动的符灯。",
    loreZones: ["悬灯旧城钟楼", "孢囊温室", "沉水行宫宴厅"],
    mapZones: ["town", "forest", "palace"],
    moves: ["三灯符阵：依次封锁左、中、右地面", "追魂墨火：两枚错时追踪弹，可劈散", "移灯换位：与悬灯互换位置并留下爆符", "熄灯阶段：生命过半后短暂暗场，击碎真灯结束阶段"],
    window: "移灯结束与三灯符阵最后一灯落下后有长施法硬直；真灯灯芯为朱红色。",
    role: "能力奖励精英。通过分波或单独登场保持机制焦点，和普通提灯术士明确区分。",
  },
  ink_beast: {
    id: "ink_beast",
    label: "噬墨兽",
    glyph: "兽",
    color: "#6b8f71",
    tier: "basic",
    summary: "高攻扑咬，扑空撞墙眩晕",
    look: "四足妖兽，外形介于狼、獒与墨团之间，奔跑时拖出大量墨迹。",
    loreZones: ["黑松森林", "墨骨窟深层", "被污染的村落"],
    mapZones: ["mine", "forest", "palace"],
    moves: ["连续扑咬：两次快扑接撕咬", "低姿冲锋：贴地高速冲过", "墨雾咆哮：短暂遮挡视野并召集同类", "残血狂暴：低血时速度提升"],
    window: "扑空撞墙后眩晕，是主要反击机会。",
    role: "高攻击欲望近战，常与弩手/术士组合制造近远程压力。",
  },
  chain_jailer: {
    id: "chain_jailer",
    label: "链狱卒",
    glyph: "链",
    color: "#c9a227",
    tier: "basic",
    summary: "长链横扫与钩拉",
    look: "身体瘦高，拖着断裂锁链，武器是一端带钩的长链。",
    loreZones: ["剑冢牢", "刑台", "垂直升降井"],
    mapZones: ["mine", "palace"],
    moves: ["横扫锁链：大范围，需跳跃躲避", "低位扫腿：贴地攻击，需原地跳", "锁钩抓取：把远处玩家拉到面前", "悬空拦截：竖井跳跃时侧面甩链"],
    window: "锁链末端红光＝即将抓取。锁链伸直瞬间可劈砍，短暂弹开并使其失衡。",
    role: "竖井与牢房特色敌人，训练跳跃时机与锁链破招。",
  },
  ink_eel: {
    id: "ink_eel",
    label: "墨鳞游魂",
    glyph: "鳞",
    color: "#55b9c5",
    tier: "basic",
    summary: "水中环游与直线突刺",
    look: "由细长鱼骨与墨带组成，在水层中画圆巡游，转向前鳞光会短暂变亮。",
    loreZones: ["黑松湖水下", "沉水行宫回廊"],
    mapZones: ["palace"],
    moves: ["环游盯防：绕玩家保持半屏距离", "鳞光突刺：闪蓝光后直线贯穿", "尾墨残留：突刺路径留下短时减速墨带"],
    window: "鳞光亮起后方向锁定；侧向游开并在其撞墙回旋时反击。",
    role: "基础水栖追击单位，用水中转向代替空中敌人的坠地逻辑。",
  },
  drowned_guard: {
    id: "drowned_guard",
    label: "沉甲水卒",
    glyph: "沉",
    color: "#6f9fb4",
    tier: "basic",
    summary: "贴底推进与上冲水柱",
    look: "被青苔和锁链缠住的行宫卫兵，重甲令其只能沿水底缓慢行走。",
    loreZones: ["泄洪闸底", "沉水行宫水下长廊"],
    mapZones: ["palace"],
    moves: ["沉盾推进：沿池底稳定逼近", "水柱上冲：盾击地面后在玩家脚下喷发", "锚链回收：把远离水底的玩家拉回中层"],
    window: "水柱位置出现气泡后延迟爆发；锚链落空时背部气囊暴露。",
    role: "水下空间锚点，与游动单位形成底层/中层双高度压力。",
  },
  scarlet_captain: {
    id: "scarlet_captain",
    label: "赤枪校尉",
    glyph: "枪",
    color: "#c0392b",
    tier: "elite",
    summary: "完整枪术；精英压轴",
    look: "高大武将，黑甲上仅枪缨与腰带为朱红。攻击距离长，招式完整。",
    loreZones: ["竹雾村关隘", "悬寺演武场", "无相殿前庭"],
    mapZones: ["gate", "cliff"],
    moves: ["三段枪术：直刺、横扫、回身挑击", "冲锋贯穿：跨越大半场地", "对空挑杀：惩罚随意跳跃", "枪尾震地：向两侧扩散的地面冲击波"],
    window: "观察枪尖方向决定跳、撤或翻滚。躲过完整枪术后有明显收枪硬直。",
    role: "小型 Boss 级精英；山门教学检验、试剑峰发放踏云。",
  },
  faceless_sword: {
    id: "faceless_sword",
    label: "无面剑侍",
    glyph: "侍",
    color: "#a77ad1",
    tier: "elite",
    summary: "模仿招式，检验战斗理解",
    look: "衣着近似主角的黑衣，面部完全空白，使用细长双刃剑。会模仿玩家部分招式。",
    loreZones: ["无相殿内部", "隐藏剑室", "后期回访区域"],
    mapZones: ["peak"],
    moves: ["模仿普攻：复制一段或二段连斩", "墨影翻滚：穿过玩家并从背后反击", "对峙架势：玩家主动攻击时立即招架", "残影突刺：短距离留下两个假身"],
    window: "不能无脑连攻。用移动或假动作骗出招架，再打侧后方。",
    role: "后期检验战斗理解的镜像精英。",
  },
  lake_maiden: {
    id: "lake_maiden",
    label: "湖中墨姬",
    glyph: "姬",
    color: "#5dade2",
    tier: "elite",
    summary: "幻身与漩涡；辨红簪",
    look: "上半身如披长发女子，下半身融入水面与墨雾。平时只露头发与灯影。",
    loreZones: ["黑松湖", "水下遗迹", "月下祭坛"],
    mapZones: ["palace"],
    moves: ["水袖横扫：长距离弧形攻击", "水镜幻身：两个只执行一次攻击的分身", "墨水漩涡：缓慢拉向中心", "潜水换位：沉入水中，从脚下或远处出现"],
    window: "攻击前本体短暂露出红色发簪。击破分身不造成伤害，但恢复少量灵力。",
    role: "行宫水域精英压轴，以幻身承担杂兵压力；通关发放水镜信物。",
    reward: "水镜信物",
  },
  tomb_warden: {
    id: "tomb_warden",
    label: "剑冢狱主",
    glyph: "狱",
    color: "#f05252",
    tier: "boss",
    summary: "区 Boss · 剑冢牢底",
    look: "由废弃兵器、锁链与历代囚犯残甲组成，身体中央是被封印的巨大断剑。",
    loreZones: ["剑冢牢最深处"],
    mapZones: ["mine"],
    moves: ["一阶段：锁链与断剑横扫", "二阶段：扯断锁链，吸附散落兵器形成多臂剑阵"],
    window: "断剑中央的朱红封印是弱点。可引导其劈断牢门与脆弱地面。",
    role: "矿脉区 Boss。攻击改变场地武器位置，鼓励环境互动。",
    phases: ["锁链断剑横扫", "多臂剑阵"],
    reward: "震地击 · 赤铁印",
  },
  pine_nightmare: {
    id: "pine_nightmare",
    label: "黑松魇兽",
    glyph: "魇",
    color: "#e74c3c",
    tier: "boss",
    summary: "区 Boss · 月下枯林",
    look: "巨大鹿狼混合妖兽，头生枯树角，身体在实体与墨雾间变化。",
    loreZones: ["黑松湖尽头的月下枯林"],
    mapZones: ["forest"],
    moves: ["一阶段：扑击、角撞、踏地", "二阶段：墨雾形态，黑松幻影与多向冲锋"],
    window: "仅实体化时可正常造成伤害。根据水面倒影判断冲锋方向。破坏角部可缩短部分招式范围。",
    role: "幽林区 Boss，虚实辨识考验。",
    phases: ["实体扑击", "墨雾幻影冲锋"],
    reward: "幽林印",
  },
  formless_lord: {
    id: "formless_lord",
    label: "无相殿主",
    glyph: "相",
    color: "#ff6b6b",
    tier: "boss",
    summary: "终局 Boss · 能力镜像",
    look: "纯白长袍，面部如未落墨宣纸，持与主角同型双刃剑。战斗中身体逐渐被黑墨侵蚀。",
    loreZones: ["无相殿最高层"],
    mapZones: ["peak"],
    moves: ["剑术阶段：精准格挡、突刺、二段连斩", "化境阶段：钩索追身、震地墨波、踏云二段追斩", "无相阶段：毒雾与水镜交替覆盖场地，要求闭息诀和水行符处理环境"],
    window: "钩索追身落点、震地墨波收势和水镜换层后均有明确输出窗；玩家需组合已获得的五种能力。",
    role: "篇章最终 Boss：逐项复测钩索、震地击、闭息诀、踏云二段跳与水行符。",
    phases: ["剑术校验", "钩索 / 震地 / 踏云镜像", "闭息毒雾 / 水行镜面"],
    reward: "归途传送权限",
  },
};

/** 兼容地图侧栏旧字段名 */
export function enemyDesc(id: EnemyId): string {
  return ENEMY_META[id].summary;
}
