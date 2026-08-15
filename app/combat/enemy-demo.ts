/**
 * Enemy demonstration roster and combat tuning.
 *
 * Coordinates use tutorial-stage percentages on the horizontal axis. Timing
 * values are milliseconds. `hitAtMs` is measured from the beginning of the
 * active phase, not from the beginning of the windup.
 */

export type DemoEnemyId =
  | "bamboo_blade"
  | "rooftop_bow"
  | "ink_crow"
  | "ink_spider"
  | "iron_shield"
  | "lantern_mage"
  | "ink_beast"
  | "chain_jailer"
  | "ink_eel"
  | "drowned_guard"
  | "bridge_nightmare"
  | "lantern_adept"
  | "scarlet_captain"
  | "faceless_sword"
  | "lake_maiden"
  | "tomb_warden"
  | "pine_nightmare"
  | "formless_lord";

export type DemoTier = "normal" | "elite" | "boss";

export type DemoEffectOrigin =
  | "weapon"
  | "hand"
  | "head"
  | "mouth"
  | "body"
  | "ground-self"
  | "ground-target"
  | "target-body"
  | "target-air"
  | "arena-center";

export type DemoAttack = {
  readonly id: string;
  readonly name: string;
  readonly kind: "light" | "heavy";
  readonly frequency: "common" | "secondary" | "rare";
  /** Relative selection weight. Attack weights for every enemy total 100. */
  readonly weight: number;
  readonly timing: {
    readonly windupMs: number;
    readonly activeMs: number;
    readonly followThroughMs: number;
    readonly recoveryMs: number;
    readonly hitAtMs: number;
  };
  readonly damage: number;
  /** Attack eligibility and hit-band data, expressed in stage percentages. */
  readonly range: {
    readonly minX: number;
    readonly maxX: number;
    readonly vertical: "ground" | "air" | "any";
  };
  readonly cooldownMs: number;
  readonly motion: {
    readonly kind:
      | "stationary"
      | "lunge"
      | "dash"
      | "projectile"
      | "ground-target"
      | "teleport"
      | "pull"
      | "arena"
      | "leap";
    /** Signed travel is resolved from facing at runtime; this is magnitude. */
    readonly distanceX: number;
    /** Horizontal stage-percent travel per second; zero means no translation. */
    readonly speedX: number;
  };
  readonly telegraph: string;
  readonly counterplay: string;
  readonly effectPath: string;
  /** Visual socket where the VFX is born; it is not inferred from hit range. */
  readonly effectOrigin: DemoEffectOrigin;
};

export type DemoEnemy = {
  readonly id: DemoEnemyId;
  readonly name: string;
  readonly tier: DemoTier;
  readonly hp: number;
  /** Spawn center in tutorial-stage horizontal percent coordinates. */
  readonly spawnX: number;
  /** Multiplier applied to the shared enemy render width. */
  readonly renderScale: number;
  /** Transparent padding below the visible body, measured from the source. */
  readonly footOffset: number;
  readonly spritePath: string;
  readonly behavior: {
    readonly mode:
      | "chase"
      | "kite"
      | "hold"
      | "hover"
      | "ambush"
      | "orbit"
      | "teleport";
    readonly preferredRange: readonly [minX: number, maxX: number];
    readonly moveSpeed: number;
    readonly decisionIntervalMs: number;
    readonly aggression: number;
    readonly description: string;
  };
  readonly attacks: readonly DemoAttack[];
};

const effectPath = (enemyId: DemoEnemyId, attackId?: string) => {
  // Keep the optional attack id in the call contract so validation can pair an
  // attack with its asset while all attacks reuse the enemy-level VFX master.
  void attackId;
  return `/assets/enemies/effects/combat/${enemyId}.webp`;
};

export const DEMO_ENEMY_ORDER = [
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
  "bridge_nightmare",
  "lantern_adept",
  "scarlet_captain",
  "faceless_sword",
  "lake_maiden",
  "tomb_warden",
  "pine_nightmare",
  "formless_lord",
] as const satisfies readonly DemoEnemyId[];

export const DEMO_TIER_LABELS: Readonly<Record<DemoTier, string>> = {
  normal: "普通敌人",
  elite: "精英怪",
  boss: "Boss",
};

export const DEMO_ENEMIES = {
  bamboo_blade: {
    id: "bamboo_blade",
    name: "竹影刀客",
    tier: "normal",
    hp: 100,
    spawnX: 72,
    renderScale: 1,
    footOffset: 6.6,
    spritePath: "/assets/enemies/sprites/idle/bamboo_blade.webp",
    behavior: {
      mode: "chase",
      preferredRange: [5, 10],
      moveSpeed: 7,
      decisionIntervalMs: 720,
      aggression: 0.78,
      description: "缓步逼近，在短刀距离停步试探；挥刀后停顿收刀。",
    },
    attacks: [
      {
        id: "bamboo_sweep",
        name: "竹影横斩",
        kind: "light",
        frequency: "common",
        weight: 75,
        timing: { windupMs: 300, activeMs: 120, followThroughMs: 120, recoveryMs: 520, hitAtMs: 60 },
        damage: 28,
        range: { minX: 0, maxX: 11, vertical: "ground" },
        cooldownMs: 1050,
        motion: { kind: "lunge", distanceX: 3.5, speedX: 18 },
        telegraph: "刀客压低斗笠，刀鞘边缘闪出一线冷白。",
        counterplay: "后撤离开短刀范围，或向刀客身后翻滚；收刀时反击。",
        effectPath: effectPath("bamboo_blade", "bamboo_sweep"),
        effectOrigin: "weapon",
      },
      {
        id: "scarlet_cleaver",
        name: "赤刃下劈",
        kind: "heavy",
        frequency: "rare",
        weight: 25,
        timing: { windupMs: 900, activeMs: 180, followThroughMs: 180, recoveryMs: 900, hitAtMs: 90 },
        damage: 48,
        range: { minX: 0, maxX: 14, vertical: "ground" },
        cooldownMs: 2900,
        motion: { kind: "lunge", distanceX: 4.5, speedX: 14 },
        telegraph: "刀客双手举刀停顿，刀背朱红由刀镡一路亮至刀尖，脚前出现短红线。",
        counterplay: "红线定向后向其身后翻滚；重劈嵌地后的拔刀动作是长反击窗。",
        effectPath: effectPath("bamboo_blade", "scarlet_cleaver"),
        effectOrigin: "weapon",
      },
    ],
  },
  rooftop_bow: {
    id: "rooftop_bow",
    name: "屋脊弩手",
    tier: "normal",
    hp: 85,
    spawnX: 75,
    renderScale: 1.12,
    footOffset: 11.3,
    spritePath: "/assets/enemies/sprites/idle/rooftop_bow.webp",
    behavior: {
      mode: "kite",
      preferredRange: [22, 36],
      moveSpeed: 5,
      decisionIntervalMs: 900,
      aggression: 0.62,
      description: "保持远距架弩；玩家逼近时后撤，重新拉开射线。",
    },
    attacks: [
      {
        id: "scarlet_bolt",
        name: "朱线穿弩",
        kind: "light",
        frequency: "common",
        weight: 75,
        timing: { windupMs: 650, activeMs: 650, followThroughMs: 100, recoveryMs: 850, hitAtMs: 325 },
        damage: 30,
        range: { minX: 14, maxX: 70, vertical: "any" },
        cooldownMs: 1700,
        motion: { kind: "projectile", distanceX: 70, speedX: 42 },
        telegraph: "弩机前伸，朱红瞄准线从箭槽落到玩家身上。",
        counterplay: "在线条锁定后跳跃或翻滚穿过；近身也可打断上弦。",
        effectPath: effectPath("rooftop_bow", "scarlet_bolt"),
        effectOrigin: "weapon",
      },
      {
        id: "timberpiercer_bolt",
        name: "贯梁重矢",
        kind: "heavy",
        frequency: "rare",
        weight: 25,
        timing: { windupMs: 1100, activeMs: 900, followThroughMs: 160, recoveryMs: 1200, hitAtMs: 450 },
        damage: 50,
        range: { minX: 18, maxX: 78, vertical: "any" },
        cooldownMs: 3800,
        motion: { kind: "projectile", distanceX: 78, speedX: 48 },
        telegraph: "弩手踩住弩臂绞紧弦索，粗朱红射线贯穿整条路径并在发射前锁定。",
        counterplay: "射线锁定后跳离路径或翻滚穿矢；长装填期间可直接近身压制。",
        effectPath: effectPath("rooftop_bow", "timberpiercer_bolt"),
        effectOrigin: "weapon",
      },
    ],
  },
  ink_crow: {
    id: "ink_crow",
    name: "墨羽鸦",
    tier: "normal",
    hp: 75,
    spawnX: 70,
    renderScale: 0.78,
    footOffset: 5.6,
    spritePath: "/assets/enemies/sprites/idle/ink_crow.webp",
    behavior: {
      mode: "hover",
      preferredRange: [10, 23],
      moveSpeed: 9,
      decisionIntervalMs: 650,
      aggression: 0.82,
      description: "在斜上方盘旋，锁定玩家后折翼俯冲，再升空拉开。",
    },
    attacks: [
      {
        id: "folded_wing_dive",
        name: "折羽俯啄",
        kind: "light",
        frequency: "common",
        weight: 75,
        timing: { windupMs: 400, activeMs: 320, followThroughMs: 200, recoveryMs: 750, hitAtMs: 160 },
        damage: 24,
        range: { minX: 4, maxX: 25, vertical: "any" },
        cooldownMs: 1300,
        motion: { kind: "leap", distanceX: 20, speedX: 38 },
        telegraph: "双翼突然合拢，鸦眼与喙尖同时泛红。",
        counterplay: "在俯冲方向锁定后横移或翻滚，让墨鸦撞地失衡。",
        effectPath: effectPath("ink_crow", "folded_wing_dive"),
        effectOrigin: "head",
      },
      {
        id: "inkfeather_barrage",
        name: "墨羽暴雨",
        kind: "heavy",
        frequency: "rare",
        weight: 25,
        timing: { windupMs: 900, activeMs: 720, followThroughMs: 220, recoveryMs: 950, hitAtMs: 360 },
        damage: 46,
        range: { minX: 6, maxX: 38, vertical: "any" },
        cooldownMs: 3200,
        motion: { kind: "projectile", distanceX: 34, speedX: 28 },
        telegraph: "墨鸦悬停张满双翼，羽尖逐排染红，玩家一侧出现扇形落羽预警。",
        counterplay: "预警扇面固定后冲向墨鸦下方或翻滚出边缘；散射结束后可跳斩打落。",
        effectPath: effectPath("ink_crow", "inkfeather_barrage"),
        effectOrigin: "body",
      },
    ],
  },
  ink_spider: {
    id: "ink_spider",
    name: "墨腹蛛",
    tier: "normal",
    hp: 90,
    spawnX: 70,
    renderScale: 1.14,
    footOffset: 11.1,
    spritePath: "/assets/enemies/sprites/idle/ink_spider.webp",
    behavior: {
      mode: "ambush",
      preferredRange: [4, 14],
      moveSpeed: 6,
      decisionIntervalMs: 950,
      aggression: 0.7,
      description: "贴伏上方等待玩家接近，垂丝坠落后沿地面短暂追击。",
    },
    attacks: [
      {
        id: "silk_drop",
        name: "垂丝坠袭",
        kind: "light",
        frequency: "common",
        weight: 75,
        timing: { windupMs: 550, activeMs: 220, followThroughMs: 180, recoveryMs: 800, hitAtMs: 110 },
        damage: 26,
        range: { minX: 0, maxX: 13, vertical: "ground" },
        cooldownMs: 1650,
        motion: { kind: "leap", distanceX: 5, speedX: 20 },
        telegraph: "玩家脚下落下一滴暗红墨丝，蛛腹随即鼓起。",
        counterplay: "看见落点后持续横移；坠地扑空时攻击翻出的腹部。",
        effectPath: effectPath("ink_spider", "silk_drop"),
        effectOrigin: "target-air",
      },
      {
        id: "venom_ink_web",
        name: "毒墨覆网",
        kind: "heavy",
        frequency: "rare",
        weight: 25,
        timing: { windupMs: 1000, activeMs: 520, followThroughMs: 180, recoveryMs: 1050, hitAtMs: 260 },
        damage: 48,
        range: { minX: 3, maxX: 34, vertical: "ground" },
        cooldownMs: 3500,
        motion: { kind: "ground-target", distanceX: 0, speedX: 0 },
        telegraph: "蛛腹高高鼓起并透出朱红纹路，目标地面铺开一圈紫黑蛛网边界。",
        counterplay: "蛛网边界闭合前跳离锁定区；喷吐后的翻腹硬直可造成高额反击。",
        effectPath: effectPath("ink_spider", "venom_ink_web"),
        effectOrigin: "ground-target",
      },
    ],
  },
  iron_shield: {
    id: "iron_shield",
    name: "铁甲盾卫",
    tier: "normal",
    hp: 150,
    spawnX: 72,
    renderScale: 1.08,
    footOffset: 4.5,
    spritePath: "/assets/enemies/sprites/idle/iron_shield.webp",
    behavior: {
      mode: "chase",
      preferredRange: [5, 12],
      moveSpeed: 4,
      decisionIntervalMs: 820,
      aggression: 0.72,
      description: "举盾稳定推进，将玩家逼到桥边后直线冲撞。",
    },
    attacks: [
      {
        id: "ironwall_charge",
        name: "铁壁冲城",
        kind: "light",
        frequency: "common",
        weight: 75,
        timing: { windupMs: 550, activeMs: 650, followThroughMs: 180, recoveryMs: 1000, hitAtMs: 325 },
        damage: 36,
        range: { minX: 3, maxX: 24, vertical: "ground" },
        cooldownMs: 1950,
        motion: { kind: "dash", distanceX: 21, speedX: 27 },
        telegraph: "盾卫沉肩压盾，盾面朱痕由下向上亮起。",
        counterplay: "跳过或贴身翻滚绕后；冲撞落空后的扶盾动作是输出窗。",
        effectPath: effectPath("iron_shield", "ironwall_charge"),
        effectOrigin: "body",
      },
      {
        id: "mountainbreaker_slam",
        name: "镇岳盾砸",
        kind: "heavy",
        frequency: "rare",
        weight: 25,
        timing: { windupMs: 1100, activeMs: 260, followThroughMs: 220, recoveryMs: 1250, hitAtMs: 130 },
        damage: 58,
        range: { minX: 0, maxX: 16, vertical: "ground" },
        cooldownMs: 3900,
        motion: { kind: "stationary", distanceX: 0, speedX: 0 },
        telegraph: "盾卫将巨盾举过头顶，盾面朱痕全部点亮，脚前地面浮出扇形裂纹。",
        counterplay: "离开裂纹或在盾落下时翻滚穿身；巨盾陷地后从背面重击。",
        effectPath: effectPath("iron_shield", "mountainbreaker_slam"),
        effectOrigin: "body",
      },
    ],
  },
  lantern_mage: {
    id: "lantern_mage",
    name: "提灯术士",
    tier: "normal",
    hp: 100,
    spawnX: 75,
    renderScale: 1,
    footOffset: 1.7,
    spritePath: "/assets/enemies/sprites/idle/lantern_mage.webp",
    behavior: {
      mode: "kite",
      preferredRange: [18, 32],
      moveSpeed: 4.5,
      decisionIntervalMs: 980,
      aggression: 0.6,
      description: "保持施法距离，在玩家脚下布置延迟灯符后缓慢换位。",
    },
    attacks: [
      {
        id: "delayed_lantern_sigill",
        name: "迟燃灯符",
        kind: "light",
        frequency: "common",
        weight: 75,
        timing: { windupMs: 700, activeMs: 250, followThroughMs: 150, recoveryMs: 850, hitAtMs: 125 },
        damage: 32,
        range: { minX: 7, maxX: 62, vertical: "ground" },
        cooldownMs: 2100,
        motion: { kind: "ground-target", distanceX: 0, speedX: 0 },
        telegraph: "灯芯收暗，玩家脚下浮出三圈由淡到浓的朱红符线。",
        counterplay: "符线闭合前离开落点；术士施法期间无法移动，可主动打断。",
        effectPath: effectPath("lantern_mage", "delayed_lantern_sigill"),
        effectOrigin: "ground-target",
      },
      {
        id: "lanternburst_domain",
        name: "灯爆焚界",
        kind: "heavy",
        frequency: "rare",
        weight: 25,
        timing: { windupMs: 1050, activeMs: 680, followThroughMs: 220, recoveryMs: 1150, hitAtMs: 340 },
        damage: 54,
        range: { minX: 8, maxX: 48, vertical: "ground" },
        cooldownMs: 3900,
        motion: { kind: "ground-target", distanceX: 0, speedX: 0 },
        telegraph: "术士双手托灯，灯芯转为朱红，玩家脚下展开两层反向旋转的焚烧符环。",
        counterplay: "第二层符环开始闭合时离开目标区；灯火爆开后的熄灭阶段可打碎灯笼。",
        effectPath: effectPath("lantern_mage", "lanternburst_domain"),
        effectOrigin: "ground-target",
      },
    ],
  },
  ink_beast: {
    id: "ink_beast",
    name: "噬墨兽",
    tier: "normal",
    hp: 125,
    spawnX: 70,
    renderScale: 1.18,
    footOffset: 0,
    spritePath: "/assets/enemies/sprites/idle/ink_beast.webp",
    behavior: {
      mode: "chase",
      preferredRange: [5, 14],
      moveSpeed: 9,
      decisionIntervalMs: 560,
      aggression: 0.9,
      description: "低姿高速追猎，短暂停步蓄力后连续扑咬，不主动拉开。",
    },
    attacks: [
      {
        id: "rending_bite",
        name: "裂墨扑咬",
        kind: "light",
        frequency: "common",
        weight: 75,
        timing: { windupMs: 380, activeMs: 320, followThroughMs: 200, recoveryMs: 750, hitAtMs: 160 },
        damage: 38,
        range: { minX: 2, maxX: 17, vertical: "ground" },
        cooldownMs: 1400,
        motion: { kind: "lunge", distanceX: 10, speedX: 30 },
        telegraph: "前爪刨地并拖出两道墨沟，口部裂开朱红细缝。",
        counterplay: "朝其身后翻滚；扑空后的刹步会让其短暂失衡。",
        effectPath: effectPath("ink_beast", "rending_bite"),
        effectOrigin: "mouth",
      },
      {
        id: "groundripper_charge",
        name: "裂阵狂冲",
        kind: "heavy",
        frequency: "rare",
        weight: 25,
        timing: { windupMs: 900, activeMs: 620, followThroughMs: 240, recoveryMs: 1100, hitAtMs: 310 },
        damage: 56,
        range: { minX: 4, maxX: 32, vertical: "ground" },
        cooldownMs: 3400,
        motion: { kind: "dash", distanceX: 28, speedX: 40 },
        telegraph: "噬墨兽贴地刨出三道朱红抓痕，背部墨雾收束成一条笔直冲锋路径。",
        counterplay: "路径锁定后起跳或朝其身后翻滚；诱导撞到场地边缘可获得长眩晕。",
        effectPath: effectPath("ink_beast", "groundripper_charge"),
        effectOrigin: "body",
      },
    ],
  },
  chain_jailer: {
    id: "chain_jailer",
    name: "链狱卒",
    tier: "normal",
    hp: 120,
    spawnX: 74,
    renderScale: 1.02,
    footOffset: 2.9,
    spritePath: "/assets/enemies/sprites/idle/chain_jailer.webp",
    behavior: {
      mode: "hold",
      preferredRange: [13, 24],
      moveSpeed: 5,
      decisionIntervalMs: 800,
      aggression: 0.68,
      description: "守住长链优势距离，玩家远离或起跳时甩钩拘回。",
    },
    attacks: [
      {
        id: "scarlet_hook",
        name: "赤钩拘魂",
        kind: "light",
        frequency: "common",
        weight: 75,
        timing: { windupMs: 520, activeMs: 300, followThroughMs: 350, recoveryMs: 950, hitAtMs: 150 },
        damage: 30,
        range: { minX: 9, maxX: 36, vertical: "any" },
        cooldownMs: 1850,
        motion: { kind: "pull", distanceX: 30, speedX: 32 },
        telegraph: "钩端由黑转红，狱卒后臂拉满，锁链绷成直线。",
        counterplay: "在钩端发红后跳过或劈开锁链；落空时贴身反击。",
        effectPath: effectPath("chain_jailer", "scarlet_hook"),
        effectOrigin: "weapon",
      },
      {
        id: "prisonchain_sweep",
        name: "锁狱横扫",
        kind: "heavy",
        frequency: "rare",
        weight: 25,
        timing: { windupMs: 1000, activeMs: 600, followThroughMs: 240, recoveryMs: 1150, hitAtMs: 300 },
        damage: 52,
        range: { minX: 3, maxX: 34, vertical: "ground" },
        cooldownMs: 3600,
        motion: { kind: "stationary", distanceX: 0, speedX: 0 },
        telegraph: "狱卒将长链绕身两周，钩尖和地面半圆路径同时泛出朱红。",
        counterplay: "原地跳过低位链扫或贴身翻滚；锁链绕回身体时是最长收招窗口。",
        effectPath: effectPath("chain_jailer", "prisonchain_sweep"),
        effectOrigin: "weapon",
      },
    ],
  },
  ink_eel: {
    id: "ink_eel",
    name: "墨鳞游魂",
    tier: "normal",
    hp: 90,
    spawnX: 70,
    renderScale: 1.32,
    footOffset: 17.8,
    spritePath: "/assets/enemies/sprites/idle/ink_eel.webp",
    behavior: {
      mode: "orbit",
      preferredRange: [12, 25],
      moveSpeed: 8,
      decisionIntervalMs: 720,
      aggression: 0.74,
      description: "围绕玩家保持中距游弋，鳞光锁向后直线贯穿。",
    },
    attacks: [
      {
        id: "scaleglint_dash",
        name: "鳞光贯游",
        kind: "light",
        frequency: "common",
        weight: 75,
        timing: { windupMs: 420, activeMs: 450, followThroughMs: 200, recoveryMs: 800, hitAtMs: 225 },
        damage: 28,
        range: { minX: 5, maxX: 30, vertical: "any" },
        cooldownMs: 1650,
        motion: { kind: "dash", distanceX: 26, speedX: 44 },
        telegraph: "全身鳞片依次泛蓝，最后一片朱鳞指向冲刺方向。",
        counterplay: "鳞光锁定后立即侧移或翻滚；其冲过头回旋时追击。",
        effectPath: effectPath("ink_eel", "scaleglint_dash"),
        effectOrigin: "head",
      },
      {
        id: "inktail_undertow",
        name: "尾墨回潮",
        kind: "heavy",
        frequency: "rare",
        weight: 25,
        timing: { windupMs: 950, activeMs: 700, followThroughMs: 220, recoveryMs: 1050, hitAtMs: 350 },
        damage: 50,
        range: { minX: 0, maxX: 36, vertical: "any" },
        cooldownMs: 3500,
        motion: { kind: "arena", distanceX: 0, speedX: 0 },
        telegraph: "游魂盘成圆环，尾端朱鳞点亮，周围水纹向内收缩并标出回潮边界。",
        counterplay: "回潮边界出现后向外拉开或用翻滚穿过波峰；盘身展开时追击头部。",
        effectPath: effectPath("ink_eel", "inktail_undertow"),
        effectOrigin: "arena-center",
      },
    ],
  },
  drowned_guard: {
    id: "drowned_guard",
    name: "沉甲水卒",
    tier: "normal",
    hp: 145,
    spawnX: 73,
    renderScale: 1.08,
    footOffset: 4.4,
    spritePath: "/assets/enemies/sprites/idle/drowned_guard.webp",
    behavior: {
      mode: "hold",
      preferredRange: [10, 20],
      moveSpeed: 3.5,
      decisionIntervalMs: 920,
      aggression: 0.64,
      description: "沿底层沉重推进，用盾击引导水柱封锁玩家脚下。",
    },
    attacks: [
      {
        id: "sunken_shield_geyser",
        name: "沉盾涌泉",
        kind: "light",
        frequency: "common",
        weight: 75,
        timing: { windupMs: 650, activeMs: 300, followThroughMs: 180, recoveryMs: 900, hitAtMs: 150 },
        damage: 34,
        range: { minX: 4, maxX: 52, vertical: "ground" },
        cooldownMs: 2200,
        motion: { kind: "ground-target", distanceX: 0, speedX: 0 },
        telegraph: "盾沿砸地，玩家脚下先冒出一串由小到大的青黑气泡。",
        counterplay: "气泡聚拢前离开原位或起跳；水柱结束后攻击其背部。",
        effectPath: effectPath("drowned_guard", "sunken_shield_geyser"),
        effectOrigin: "ground-target",
      },
      {
        id: "anchorchain_drag",
        name: "锚链沉拖",
        kind: "heavy",
        frequency: "rare",
        weight: 25,
        timing: { windupMs: 1100, activeMs: 560, followThroughMs: 300, recoveryMs: 1250, hitAtMs: 280 },
        damage: 58,
        range: { minX: 10, maxX: 54, vertical: "any" },
        cooldownMs: 4100,
        motion: { kind: "pull", distanceX: 46, speedX: 34 },
        telegraph: "水卒拔出背后锚链，锚尖转红，目标与锚尖之间浮现粗重水墨拉线。",
        counterplay: "拉线锁定后跳起或劈开锚链；拖拽落空时绕后攻击暴露的气囊。",
        effectPath: effectPath("drowned_guard", "anchorchain_drag"),
        effectOrigin: "weapon",
      },
    ],
  },
  bridge_nightmare: {
    id: "bridge_nightmare",
    name: "桥魇",
    tier: "elite",
    hp: 260,
    spawnX: 70,
    renderScale: 1,
    footOffset: 3.7,
    spritePath: "/assets/enemy.webp",
    behavior: {
      mode: "chase",
      preferredRange: [6, 16],
      moveSpeed: 6.5,
      decisionIntervalMs: 680,
      aggression: 0.82,
      description: "守住断桥中央，以墨爪压迫近身，再用扑击追赶撤退者。",
    },
    attacks: [
      {
        id: "ink_claw_sweep",
        name: "墨爪横掠",
        kind: "light",
        frequency: "common",
        weight: 42,
        timing: { windupMs: 360, activeMs: 160, followThroughMs: 150, recoveryMs: 550, hitAtMs: 80 },
        damage: 45,
        range: { minX: 0, maxX: 14, vertical: "ground" },
        cooldownMs: 1200,
        motion: { kind: "lunge", distanceX: 4, speedX: 20 },
        telegraph: "右爪墨锋外张，爪尖依次亮起三点朱红。",
        counterplay: "离开爪长或翻滚穿身；横掠结束后的垂爪是反击窗口。",
        effectPath: effectPath("bridge_nightmare", "ink_claw_sweep"),
        effectOrigin: "hand",
      },
      {
        id: "shadow_maul",
        name: "影噬扑身",
        kind: "light",
        frequency: "common",
        weight: 42,
        timing: { windupMs: 520, activeMs: 420, followThroughMs: 180, recoveryMs: 750, hitAtMs: 210 },
        damage: 42,
        range: { minX: 5, maxX: 25, vertical: "any" },
        cooldownMs: 1500,
        motion: { kind: "dash", distanceX: 18, speedX: 34 },
        telegraph: "桥魇伏地缩成墨团，地面影子先一步扑向玩家。",
        counterplay: "等影子方向固定后反向翻滚；扑空落地时可连续输出。",
        effectPath: effectPath("bridge_nightmare", "shadow_maul"),
        effectOrigin: "mouth",
      },
      {
        id: "broken_bridge_tide",
        name: "断桥墨潮",
        kind: "heavy",
        frequency: "rare",
        weight: 16,
        timing: { windupMs: 950, activeMs: 850, followThroughMs: 200, recoveryMs: 1250, hitAtMs: 425 },
        damage: 72,
        range: { minX: 0, maxX: 70, vertical: "ground" },
        cooldownMs: 7000,
        motion: { kind: "arena", distanceX: 0, speedX: 0 },
        telegraph: "桥面裂纹被朱墨填满，桥魇双臂高举并出现重击“危”印。",
        counterplay: "观察墨潮起点后跳过波峰；落潮后的长时间塌肩可重击反制。",
        effectPath: effectPath("bridge_nightmare", "broken_bridge_tide"),
        effectOrigin: "ground-self",
      },
    ],
  },
  lantern_adept: {
    id: "lantern_adept",
    name: "掌灯使",
    tier: "elite",
    hp: 240,
    spawnX: 74,
    renderScale: 1.08,
    footOffset: 3.8,
    spritePath: "/assets/enemies/sprites/idle/lantern_adept.webp",
    behavior: {
      mode: "teleport",
      preferredRange: [18, 32],
      moveSpeed: 4,
      decisionIntervalMs: 860,
      aggression: 0.68,
      description: "以双焰牵制，在玩家接近时移灯换位，偶尔展开三灯封界。",
    },
    attacks: [
      {
        id: "soulseeking_twin_flames",
        name: "追魂双焰",
        kind: "light",
        frequency: "common",
        weight: 42,
        timing: { windupMs: 450, activeMs: 500, followThroughMs: 300, recoveryMs: 650, hitAtMs: 250 },
        damage: 48,
        range: { minX: 10, maxX: 68, vertical: "any" },
        cooldownMs: 1900,
        motion: { kind: "projectile", distanceX: 70, speedX: 26 },
        telegraph: "两盏悬灯错时点亮，一蓝一红两枚墨火先后锁定。",
        counterplay: "改变移动节奏让双焰错开，挥剑可提前劈散墨火。",
        effectPath: effectPath("lantern_adept", "soulseeking_twin_flames"),
        effectOrigin: "hand",
      },
      {
        id: "lantern_swap_burst",
        name: "移灯爆符",
        kind: "light",
        frequency: "common",
        weight: 42,
        timing: { windupMs: 350, activeMs: 250, followThroughMs: 150, recoveryMs: 700, hitAtMs: 125 },
        damage: 38,
        range: { minX: 0, maxX: 50, vertical: "ground" },
        cooldownMs: 1750,
        motion: { kind: "teleport", distanceX: 24, speedX: 0 },
        telegraph: "本体灯芯熄灭，远处悬灯变为朱红，原地留下爆符。",
        counterplay: "不要追逐消失的本体，先离开原地爆符，再向真灯贴近。",
        effectPath: effectPath("lantern_adept", "lantern_swap_burst"),
        effectOrigin: "body",
      },
      {
        id: "three_lantern_seal",
        name: "三灯封界",
        kind: "heavy",
        frequency: "rare",
        weight: 16,
        timing: { windupMs: 950, activeMs: 1050, followThroughMs: 250, recoveryMs: 1350, hitAtMs: 700 },
        damage: 64,
        range: { minX: 0, maxX: 70, vertical: "ground" },
        cooldownMs: 7000,
        motion: { kind: "arena", distanceX: 0, speedX: 0 },
        telegraph: "三盏符灯依次悬停在左、中、右，地面封线逐段闭合。",
        counterplay: "沿尚未闭合的一侧移动；第三灯落下后掌灯使会长时间僵直。",
        effectPath: effectPath("lantern_adept", "three_lantern_seal"),
        effectOrigin: "arena-center",
      },
    ],
  },
  scarlet_captain: {
    id: "scarlet_captain",
    name: "赤枪校尉",
    tier: "elite",
    hp: 300,
    spawnX: 71,
    renderScale: 1.15,
    footOffset: 3.8,
    spritePath: "/assets/enemies/sprites/idle/scarlet_captain.webp",
    behavior: {
      mode: "chase",
      preferredRange: [9, 18],
      moveSpeed: 6,
      decisionIntervalMs: 620,
      aggression: 0.86,
      description: "以枪尖控制中距，追刺与挑击交替；远距时蓄势贯阵。",
    },
    attacks: [
      {
        id: "star_chasing_thrusts",
        name: "追星连刺",
        kind: "light",
        frequency: "common",
        weight: 42,
        timing: { windupMs: 280, activeMs: 440, followThroughMs: 120, recoveryMs: 550, hitAtMs: 220 },
        damage: 48,
        range: { minX: 3, maxX: 19, vertical: "ground" },
        cooldownMs: 1350,
        motion: { kind: "lunge", distanceX: 8, speedX: 28 },
        telegraph: "枪尖抖出两点白芒，第三点朱芒停在玩家胸口高度。",
        counterplay: "保持枪尖外距离或向前翻滚穿过；第三刺后立即反击。",
        effectPath: effectPath("scarlet_captain", "star_chasing_thrusts"),
        effectOrigin: "weapon",
      },
      {
        id: "returning_moon_lift",
        name: "回锋挑月",
        kind: "light",
        frequency: "common",
        weight: 42,
        timing: { windupMs: 420, activeMs: 240, followThroughMs: 150, recoveryMs: 650, hitAtMs: 120 },
        damage: 42,
        range: { minX: 2, maxX: 16, vertical: "air" },
        cooldownMs: 1600,
        motion: { kind: "stationary", distanceX: 0, speedX: 0 },
        telegraph: "枪尾点地，枪尖由低向高画出一弯红月。",
        counterplay: "不要在枪尾点地时起跳；留在地面后撤即可避开挑击。",
        effectPath: effectPath("scarlet_captain", "returning_moon_lift"),
        effectOrigin: "weapon",
      },
      {
        id: "scarlet_tassel_charge",
        name: "赤缨贯阵",
        kind: "heavy",
        frequency: "rare",
        weight: 16,
        timing: { windupMs: 950, activeMs: 700, followThroughMs: 200, recoveryMs: 1250, hitAtMs: 350 },
        damage: 76,
        range: { minX: 8, maxX: 58, vertical: "ground" },
        cooldownMs: 7000,
        motion: { kind: "dash", distanceX: 44, speedX: 48 },
        telegraph: "校尉后撤压枪，枪缨燃成朱线并贯穿半个场地。",
        counterplay: "等冲锋方向完全锁定后跳过或迎面翻滚；收枪跪地时重击。",
        effectPath: effectPath("scarlet_captain", "scarlet_tassel_charge"),
        effectOrigin: "weapon",
      },
    ],
  },
  faceless_sword: {
    id: "faceless_sword",
    name: "无面剑侍",
    tier: "elite",
    hp: 260,
    spawnX: 70,
    renderScale: 1.05,
    footOffset: 6.1,
    spritePath: "/assets/enemies/sprites/idle/faceless_sword.webp",
    behavior: {
      mode: "chase",
      preferredRange: [5, 13],
      moveSpeed: 7.5,
      decisionIntervalMs: 600,
      aggression: 0.76,
      description: "模仿玩家的近战节奏，穿身换侧，并用镜返惩罚抢攻。",
    },
    attacks: [
      {
        id: "mirrored_double_cut",
        name: "镜式双斩",
        kind: "light",
        frequency: "common",
        weight: 42,
        timing: { windupMs: 240, activeMs: 400, followThroughMs: 100, recoveryMs: 550, hitAtMs: 200 },
        damage: 52,
        range: { minX: 0, maxX: 13, vertical: "ground" },
        cooldownMs: 1300,
        motion: { kind: "lunge", distanceX: 5, speedX: 24 },
        telegraph: "空白面孔浮出主角残影，双刃呈相反方向交叉。",
        counterplay: "挡开或退出第二斩范围；双刃交叉收回时从侧后攻击。",
        effectPath: effectPath("faceless_sword", "mirrored_double_cut"),
        effectOrigin: "weapon",
      },
      {
        id: "inkshadow_pass",
        name: "墨影穿身",
        kind: "light",
        frequency: "common",
        weight: 42,
        timing: { windupMs: 380, activeMs: 240, followThroughMs: 160, recoveryMs: 700, hitAtMs: 120 },
        damage: 44,
        range: { minX: 3, maxX: 25, vertical: "any" },
        cooldownMs: 1650,
        motion: { kind: "teleport", distanceX: 18, speedX: 0 },
        telegraph: "剑侍身体分成前后两层淡墨残影，脚边墨线穿过玩家。",
        counterplay: "不要朝原位置出剑；向前移动，让背后反击落空后转身追击。",
        effectPath: effectPath("faceless_sword", "inkshadow_pass"),
        effectOrigin: "weapon",
      },
      {
        id: "faceless_reflection",
        name: "无面镜返",
        kind: "heavy",
        frequency: "rare",
        weight: 16,
        timing: { windupMs: 950, activeMs: 550, followThroughMs: 180, recoveryMs: 1100, hitAtMs: 275 },
        damage: 72,
        range: { minX: 0, maxX: 18, vertical: "any" },
        cooldownMs: 7000,
        motion: { kind: "stationary", distanceX: 0, speedX: 0 },
        telegraph: "双刃收于胸前形成镜框，空白面上出现一笔竖直朱痕。",
        counterplay: "架势期间停止攻击，以移动骗出镜返；落空后的碎镜硬直很长。",
        effectPath: effectPath("faceless_sword", "faceless_reflection"),
        effectOrigin: "weapon",
      },
    ],
  },
  lake_maiden: {
    id: "lake_maiden",
    name: "湖中墨姬",
    tier: "elite",
    hp: 280,
    spawnX: 72,
    renderScale: 1.12,
    footOffset: 4.9,
    spritePath: "/assets/enemies/sprites/idle/lake_maiden.webp",
    behavior: {
      mode: "teleport",
      preferredRange: [12, 25],
      moveSpeed: 5,
      decisionIntervalMs: 780,
      aggression: 0.7,
      description: "沿水镜换位，以长袖和幻身维持中距，低频漩涡封锁全场。",
    },
    attacks: [
      {
        id: "water_sleeve_moon",
        name: "水袖扫月",
        kind: "light",
        frequency: "common",
        weight: 42,
        timing: { windupMs: 360, activeMs: 240, followThroughMs: 200, recoveryMs: 650, hitAtMs: 120 },
        damage: 42,
        range: { minX: 2, maxX: 22, vertical: "ground" },
        cooldownMs: 1450,
        motion: { kind: "stationary", distanceX: 0, speedX: 0 },
        telegraph: "红簪先亮，右袖吸水变重并在身侧勾出半月。",
        counterplay: "贴近袖根翻滚或退到弧线外；扫月结束后本体短暂显形。",
        effectPath: effectPath("lake_maiden", "water_sleeve_moon"),
        effectOrigin: "hand",
      },
      {
        id: "watermirror_twins",
        name: "水镜双姝",
        kind: "light",
        frequency: "common",
        weight: 42,
        timing: { windupMs: 580, activeMs: 900, followThroughMs: 200, recoveryMs: 800, hitAtMs: 450 },
        damage: 48,
        range: { minX: 7, maxX: 58, vertical: "any" },
        cooldownMs: 2200,
        motion: { kind: "projectile", distanceX: 52, speedX: 22 },
        telegraph: "水面升起左右两面圆镜，仅本体镜中有一枚朱红发簪。",
        counterplay: "辨认红簪本体；击破无簪幻身可恢复灵力并打开安全侧。",
        effectPath: effectPath("lake_maiden", "watermirror_twins"),
        effectOrigin: "hand",
      },
      {
        id: "moonburying_vortex",
        name: "漩涡葬月",
        kind: "heavy",
        frequency: "rare",
        weight: 16,
        timing: { windupMs: 950, activeMs: 1250, followThroughMs: 250, recoveryMs: 1200, hitAtMs: 1000 },
        damage: 72,
        range: { minX: 0, maxX: 68, vertical: "ground" },
        cooldownMs: 7000,
        motion: { kind: "pull", distanceX: 34, speedX: 18 },
        telegraph: "场地中央水墨逆时针聚拢，月影被朱红圆环逐层吞没。",
        counterplay: "持续向外移动并在吸力最强时翻滚；漩涡消散后贴近本体。",
        effectPath: effectPath("lake_maiden", "moonburying_vortex"),
        effectOrigin: "ground-target",
      },
    ],
  },
  tomb_warden: {
    id: "tomb_warden",
    name: "剑冢狱主",
    tier: "boss",
    hp: 600,
    spawnX: 69,
    renderScale: 1.36,
    footOffset: 4.8,
    spritePath: "/assets/enemies/sprites/idle/tomb_warden.webp",
    behavior: {
      mode: "hold",
      preferredRange: [9, 22],
      moveSpeed: 3.8,
      decisionIntervalMs: 640,
      aggression: 0.82,
      description: "占据场地中段，以链刃控制距离；重击改变地面安全区。",
    },
    attacks: [
      {
        id: "prison_chain_sever",
        name: "狱链横断",
        kind: "light",
        frequency: "common",
        weight: 25,
        timing: { windupMs: 380, activeMs: 280, followThroughMs: 220, recoveryMs: 580, hitAtMs: 140 },
        damage: 42,
        range: { minX: 3, maxX: 28, vertical: "ground" },
        cooldownMs: 1550,
        motion: { kind: "stationary", distanceX: 0, speedX: 0 },
        telegraph: "左右锁链同时绷直，链节朱印从内向外依次亮起。",
        counterplay: "跳过低位横链或翻滚穿过链端；链条回收时攻击胸前封印。",
        effectPath: effectPath("tomb_warden", "prison_chain_sever"),
        effectOrigin: "weapon",
      },
      {
        id: "broken_blade_sentence",
        name: "断剑坠刑",
        kind: "light",
        frequency: "common",
        weight: 25,
        timing: { windupMs: 550, activeMs: 240, followThroughMs: 220, recoveryMs: 720, hitAtMs: 120 },
        damage: 48,
        range: { minX: 0, maxX: 18, vertical: "ground" },
        cooldownMs: 1750,
        motion: { kind: "ground-target", distanceX: 0, speedX: 0 },
        telegraph: "中央断剑被锁链吊起，剑尖下方出现逐渐收紧的红圈。",
        counterplay: "离开红圈，不要过早翻滚；断剑入地后封印暴露。",
        effectPath: effectPath("tomb_warden", "broken_blade_sentence"),
        effectOrigin: "target-air",
      },
      {
        id: "relic_weapon_volley",
        name: "残兵飞射",
        kind: "light",
        frequency: "secondary",
        weight: 14,
        timing: { windupMs: 620, activeMs: 700, followThroughMs: 200, recoveryMs: 780, hitAtMs: 350 },
        damage: 54,
        range: { minX: 13, maxX: 70, vertical: "any" },
        cooldownMs: 3600,
        motion: { kind: "projectile", distanceX: 70, speedX: 34 },
        telegraph: "三件残兵依次升空，刃尖按上、中、下三层标出红光。",
        counterplay: "根据刃尖高度选择蹲位、跳跃或翻滚，不要连续同向移动。",
        effectPath: effectPath("tomb_warden", "relic_weapon_volley"),
        effectOrigin: "body",
      },
      {
        id: "riven_prison_gate",
        name: "裂地狱门",
        kind: "heavy",
        frequency: "common",
        weight: 25,
        timing: { windupMs: 1000, activeMs: 650, followThroughMs: 250, recoveryMs: 1400, hitAtMs: 325 },
        damage: 82,
        range: { minX: 0, maxX: 62, vertical: "ground" },
        cooldownMs: 5500,
        motion: { kind: "ground-target", distanceX: 0, speedX: 0 },
        telegraph: "狱主双臂插地，裂纹形成两扇向外张开的朱红牢门。",
        counterplay: "站到裂纹间隙并在狱门合拢前跳离；拔臂阶段是输出窗。",
        effectPath: effectPath("tomb_warden", "riven_prison_gate"),
        effectOrigin: "ground-self",
      },
      {
        id: "myriad_blades_return",
        name: "万刃归冢",
        kind: "heavy",
        frequency: "rare",
        weight: 11,
        timing: { windupMs: 1350, activeMs: 1400, followThroughMs: 300, recoveryMs: 1800, hitAtMs: 700 },
        damage: 96,
        range: { minX: 0, maxX: 72, vertical: "any" },
        cooldownMs: 11000,
        motion: { kind: "arena", distanceX: 0, speedX: 0 },
        telegraph: "全场残兵悬停成环，胸前朱红封印扩大为旋转剑冢。",
        counterplay: "跟随地面唯一的无刃墨白区移动；万刃坠落后直攻封印。",
        effectPath: effectPath("tomb_warden", "myriad_blades_return"),
        effectOrigin: "arena-center",
      },
    ],
  },
  pine_nightmare: {
    id: "pine_nightmare",
    name: "黑松魇兽",
    tier: "boss",
    hp: 650,
    spawnX: 68,
    renderScale: 1.4,
    footOffset: 0,
    spritePath: "/assets/enemies/sprites/idle/pine_nightmare.webp",
    behavior: {
      mode: "chase",
      preferredRange: [7, 19],
      moveSpeed: 8,
      decisionIntervalMs: 540,
      aggression: 0.9,
      description: "高速追猎并反复换边；重击前实体化，墨雾阶段制造方向误导。",
    },
    attacks: [
      {
        id: "nightmare_claw_pounce",
        name: "魇爪扑杀",
        kind: "light",
        frequency: "common",
        weight: 25,
        timing: { windupMs: 350, activeMs: 400, followThroughMs: 180, recoveryMs: 580, hitAtMs: 200 },
        damage: 44,
        range: { minX: 2, maxX: 18, vertical: "ground" },
        cooldownMs: 1400,
        motion: { kind: "lunge", distanceX: 12, speedX: 34 },
        telegraph: "前爪压地，肩背墨毛逆立并浮出三道朱红爪痕。",
        counterplay: "向魇兽身下翻滚，让其扑过头；落地扬尘结束后追击。",
        effectPath: effectPath("pine_nightmare", "nightmare_claw_pounce"),
        effectOrigin: "hand",
      },
      {
        id: "withered_antler_charge",
        name: "枯角横冲",
        kind: "light",
        frequency: "common",
        weight: 25,
        timing: { windupMs: 520, activeMs: 750, followThroughMs: 200, recoveryMs: 780, hitAtMs: 375 },
        damage: 50,
        range: { minX: 7, maxX: 46, vertical: "ground" },
        cooldownMs: 1850,
        motion: { kind: "dash", distanceX: 40, speedX: 46 },
        telegraph: "枯树角向前压低，角枝尖端从根部向外点亮。",
        counterplay: "方向锁定后跳过角尖或迎面翻滚；撞到边界会短暂眩晕。",
        effectPath: effectPath("pine_nightmare", "withered_antler_charge"),
        effectOrigin: "head",
      },
      {
        id: "inktail_return",
        name: "墨尾回林",
        kind: "light",
        frequency: "secondary",
        weight: 14,
        timing: { windupMs: 400, activeMs: 280, followThroughMs: 150, recoveryMs: 620, hitAtMs: 140 },
        damage: 38,
        range: { minX: 0, maxX: 26, vertical: "any" },
        cooldownMs: 3300,
        motion: { kind: "stationary", distanceX: 0, speedX: 0 },
        telegraph: "魇兽突然背对玩家，长尾吸入周围松针墨影。",
        counterplay: "不要追身抢攻，退离尾部圆弧；回扫后从头侧切入。",
        effectPath: effectPath("pine_nightmare", "inktail_return"),
        effectOrigin: "body",
      },
      {
        id: "moonstep_forest_quake",
        name: "踏月震林",
        kind: "heavy",
        frequency: "common",
        weight: 25,
        timing: { windupMs: 850, activeMs: 800, followThroughMs: 220, recoveryMs: 1150, hitAtMs: 400 },
        damage: 80,
        range: { minX: 0, maxX: 62, vertical: "ground" },
        cooldownMs: 5500,
        motion: { kind: "ground-target", distanceX: 0, speedX: 0 },
        telegraph: "前蹄高举遮住月影，水面倒影先出现同心朱红震纹。",
        counterplay: "在蹄落地瞬间起跳越过震波；实体收势时攻击角部。",
        effectPath: effectPath("pine_nightmare", "moonstep_forest_quake"),
        effectOrigin: "ground-self",
      },
      {
        id: "hundred_nightmares_stampede",
        name: "百魇夜奔",
        kind: "heavy",
        frequency: "rare",
        weight: 11,
        timing: { windupMs: 1250, activeMs: 1500, followThroughMs: 300, recoveryMs: 1600, hitAtMs: 750 },
        damage: 96,
        range: { minX: 0, maxX: 72, vertical: "any" },
        cooldownMs: 11000,
        motion: { kind: "arena", distanceX: 0, speedX: 0 },
        telegraph: "本体化为墨雾，水面倒影提前映出一条朱红实体冲锋线。",
        counterplay: "只相信水面倒影，站到实体线外；最后一次冲锋后本体长时间显形。",
        effectPath: effectPath("pine_nightmare", "hundred_nightmares_stampede"),
        effectOrigin: "arena-center",
      },
    ],
  },
  formless_lord: {
    id: "formless_lord",
    name: "无相殿主",
    tier: "boss",
    hp: 720,
    spawnX: 70,
    renderScale: 1.25,
    footOffset: 4.7,
    spritePath: "/assets/enemies/sprites/idle/formless_lord.webp",
    behavior: {
      mode: "teleport",
      preferredRange: [8, 22],
      moveSpeed: 7,
      decisionIntervalMs: 520,
      aggression: 0.88,
      description: "瞬步控制近中距，以镜兵牵制；重击在场地中心重构安全区。",
    },
    attacks: [
      {
        id: "formless_flash_cut",
        name: "无相瞬斩",
        kind: "light",
        frequency: "common",
        weight: 25,
        timing: { windupMs: 260, activeMs: 150, followThroughMs: 140, recoveryMs: 480, hitAtMs: 75 },
        damage: 38,
        range: { minX: 0, maxX: 36, vertical: "any" },
        cooldownMs: 1200,
        motion: { kind: "teleport", distanceX: 28, speedX: 0 },
        telegraph: "白袍边缘先化墨消失，玩家背后出现一道极细朱线。",
        counterplay: "看朱线而非本体，在残影消散瞬间反向翻滚并回身攻击。",
        effectPath: effectPath("formless_lord", "formless_flash_cut"),
        effectOrigin: "weapon",
      },
      {
        id: "cross_ink_scar",
        name: "十字墨痕",
        kind: "light",
        frequency: "common",
        weight: 25,
        timing: { windupMs: 420, activeMs: 380, followThroughMs: 120, recoveryMs: 580, hitAtMs: 190 },
        damage: 48,
        range: { minX: 3, maxX: 34, vertical: "any" },
        cooldownMs: 1750,
        motion: { kind: "projectile", distanceX: 38, speedX: 30 },
        telegraph: "双刃在胸前交叉，横竖两笔墨痕先后出现且交点泛红。",
        counterplay: "离开十字交点，沿两道墨痕之间的斜角翻滚切入。",
        effectPath: effectPath("formless_lord", "cross_ink_scar"),
        effectOrigin: "weapon",
      },
      {
        id: "mirror_weapon_thrust",
        name: "镜兵对刺",
        kind: "light",
        frequency: "secondary",
        weight: 14,
        timing: { windupMs: 550, activeMs: 250, followThroughMs: 150, recoveryMs: 680, hitAtMs: 125 },
        damage: 42,
        range: { minX: 10, maxX: 68, vertical: "any" },
        cooldownMs: 3500,
        motion: { kind: "projectile", distanceX: 68, speedX: 36 },
        telegraph: "玩家两侧各展开一面水墨兵镜，镜中剑尖同时染红。",
        counterplay: "先向一侧诱导镜兵，再改变方向穿过另一侧空隙。",
        effectPath: effectPath("formless_lord", "mirror_weapon_thrust"),
        effectOrigin: "target-body",
      },
      {
        id: "palaceheart_inkquake",
        name: "殿心震墨",
        kind: "heavy",
        frequency: "common",
        weight: 25,
        timing: { windupMs: 950, activeMs: 700, followThroughMs: 220, recoveryMs: 1200, hitAtMs: 350 },
        damage: 78,
        range: { minX: 0, maxX: 65, vertical: "ground" },
        cooldownMs: 5500,
        motion: { kind: "ground-target", distanceX: 0, speedX: 0 },
        telegraph: "殿主落到场地中心，脚下殿纹向外拓印成三重朱红圆环。",
        counterplay: "按圆环先后顺序连续跳越，不要一次翻滚耗尽无敌时间。",
        effectPath: effectPath("formless_lord", "palaceheart_inkquake"),
        effectOrigin: "ground-self",
      },
      {
        id: "formless_domain",
        name: "无相覆境",
        kind: "heavy",
        frequency: "rare",
        weight: 11,
        timing: { windupMs: 1300, activeMs: 1500, followThroughMs: 300, recoveryMs: 1550, hitAtMs: 750 },
        damage: 96,
        range: { minX: 0, maxX: 72, vertical: "any" },
        cooldownMs: 11000,
        motion: { kind: "arena", distanceX: 0, speedX: 0 },
        telegraph: "白袍彻底染墨，场地一半升毒雾、一半化水镜，分界线朱红。",
        counterplay: "跟随墨白安全层换边，越过分界时保留翻滚；覆境结束后全力输出。",
        effectPath: effectPath("formless_lord", "formless_domain"),
        effectOrigin: "arena-center",
      },
    ],
  },
} as const satisfies Readonly<Record<DemoEnemyId, DemoEnemy>>;

export const DEMO_ENEMIES_BY_TIER: Readonly<
  Record<DemoTier, readonly DemoEnemy[]>
> = {
  normal: DEMO_ENEMY_ORDER.filter(
    (id) => DEMO_ENEMIES[id].tier === "normal",
  ).map((id) => DEMO_ENEMIES[id]),
  elite: DEMO_ENEMY_ORDER.filter(
    (id) => DEMO_ENEMIES[id].tier === "elite",
  ).map((id) => DEMO_ENEMIES[id]),
  boss: DEMO_ENEMY_ORDER.filter(
    (id) => DEMO_ENEMIES[id].tier === "boss",
  ).map((id) => DEMO_ENEMIES[id]),
};

function assertDemoData(
  condition: unknown,
  message: string,
): asserts condition {
  if (!condition) throw new Error(`[enemy-demo] ${message}`);
}

const DEMO_EFFECT_ORIGINS = new Set<DemoEffectOrigin>([
  "weapon",
  "hand",
  "head",
  "mouth",
  "body",
  "ground-self",
  "ground-target",
  "target-body",
  "target-air",
  "arena-center",
]);

export function validateDemoEnemies(
  enemies: Readonly<Record<DemoEnemyId, DemoEnemy>> = DEMO_ENEMIES,
  order: readonly DemoEnemyId[] = DEMO_ENEMY_ORDER,
): true {
  const configuredIds = Object.keys(enemies) as DemoEnemyId[];
  assertDemoData(order.length === 18, `expected 18 ordered enemies, got ${order.length}`);
  assertDemoData(
    new Set(order).size === order.length,
    "DEMO_ENEMY_ORDER contains duplicate ids",
  );
  assertDemoData(
    configuredIds.length === order.length,
    `expected ${order.length} enemy records, got ${configuredIds.length}`,
  );

  const orderedIdSet = new Set<DemoEnemyId>(order);
  configuredIds.forEach((id) =>
    assertDemoData(orderedIdSet.has(id), `${id} is configured but missing from order`),
  );

  const tierCounts: Record<DemoTier, number> = { normal: 0, elite: 0, boss: 0 };
  const globalAttackIds = new Set<string>();
  let attackTotal = 0;

  order.forEach((id) => {
    const enemy = enemies[id];
    assertDemoData(enemy !== undefined, `${id} is ordered but not configured`);
    assertDemoData(enemy.id === id, `${id} record has mismatched id ${enemy.id}`);
    assertDemoData(enemy.name.trim().length > 0, `${id} has no display name`);
    assertDemoData(enemy.hp > 0, `${id} hp must be positive`);
    assertDemoData(enemy.spawnX >= 0 && enemy.spawnX <= 100, `${id} spawnX is invalid`);
    assertDemoData(enemy.renderScale > 0, `${id} renderScale must be positive`);
    assertDemoData(
      enemy.footOffset >= 0 && enemy.footOffset <= 30,
      `${id} footOffset is outside the supported range`,
    );
    assertDemoData(
      enemy.spritePath.startsWith("/assets/") && enemy.spritePath.endsWith(".webp"),
      `${id} has an invalid spritePath`,
    );
    const [preferredMin, preferredMax] = enemy.behavior.preferredRange;
    assertDemoData(
      preferredMin >= 0 && preferredMax >= preferredMin && preferredMax <= 100,
      `${id} has an invalid preferredRange`,
    );
    assertDemoData(enemy.behavior.moveSpeed >= 0, `${id} moveSpeed cannot be negative`);
    assertDemoData(
      enemy.behavior.decisionIntervalMs > 0,
      `${id} decisionIntervalMs must be positive`,
    );
    assertDemoData(
      enemy.behavior.aggression >= 0 && enemy.behavior.aggression <= 1,
      `${id} aggression must be within 0..1`,
    );
    assertDemoData(
      enemy.behavior.description.trim().length > 0,
      `${id} is missing a behavior description`,
    );

    tierCounts[enemy.tier] += 1;
    attackTotal += enemy.attacks.length;

    const expectedCount = enemy.tier === "normal" ? 2 : enemy.tier === "elite" ? 3 : 5;
    assertDemoData(
      enemy.attacks.length === expectedCount,
      `${id} (${enemy.tier}) must have ${expectedCount} attacks`,
    );

    const expectedWeights =
      enemy.tier === "normal"
        ? [75, 25]
        : enemy.tier === "elite"
          ? [42, 42, 16]
          : [25, 25, 14, 25, 11];
    const actualWeights = enemy.attacks.map((attack) => attack.weight);
    assertDemoData(
      actualWeights.every((weight, index) => weight === expectedWeights[index]),
      `${id} weights must be ${expectedWeights.join("/")}, got ${actualWeights.join("/")}`,
    );
    assertDemoData(
      actualWeights.reduce((sum, weight) => sum + weight, 0) === 100,
      `${id} attack weights must total 100`,
    );

    const commonLightCount = enemy.attacks.filter(
      (attack) => attack.kind === "light" && attack.frequency === "common",
    ).length;
    const rareLightCount = enemy.attacks.filter(
      (attack) => attack.kind === "light" && attack.frequency === "rare",
    ).length;
    const secondaryLightCount = enemy.attacks.filter(
      (attack) => attack.kind === "light" && attack.frequency === "secondary",
    ).length;
    const commonHeavyCount = enemy.attacks.filter(
      (attack) => attack.kind === "heavy" && attack.frequency === "common",
    ).length;
    const rareHeavyCount = enemy.attacks.filter(
      (attack) => attack.kind === "heavy" && attack.frequency === "rare",
    ).length;

    if (enemy.tier === "normal") {
      assertDemoData(
        commonLightCount === 1 && secondaryLightCount === 0 && rareLightCount === 0 && commonHeavyCount === 0 && rareHeavyCount === 1,
        `${id} normal composition must be one common light attack and one rare heavy attack`,
      );
    } else if (enemy.tier === "elite") {
      assertDemoData(
        commonLightCount === 2 && secondaryLightCount === 0 && rareLightCount === 0 && commonHeavyCount === 0 && rareHeavyCount === 1,
        `${id} elite composition must be two common light attacks and one rare heavy attack`,
      );
    } else {
      assertDemoData(
        commonLightCount === 2 && secondaryLightCount === 1 && rareLightCount === 0 && commonHeavyCount === 1 && rareHeavyCount === 1,
        `${id} boss composition must be 2 common light, 1 secondary light, 1 common heavy and 1 rare heavy`,
      );
    }

    const localAttackIds = new Set<string>();
    enemy.attacks.forEach((attack) => {
      assertDemoData(attack.id.trim().length > 0, `${id} has an attack without id`);
      assertDemoData(attack.name.trim().length > 0, `${id}/${attack.id} has no name`);
      assertDemoData(!localAttackIds.has(attack.id), `${id} repeats attack id ${attack.id}`);
      assertDemoData(
        !globalAttackIds.has(attack.id),
        `attack id ${attack.id} must be globally unique`,
      );
      localAttackIds.add(attack.id);
      globalAttackIds.add(attack.id);

      assertDemoData(attack.weight > 0, `${id}/${attack.id} weight must be positive`);
      assertDemoData(attack.timing.windupMs > 0, `${id}/${attack.id} windup must be positive`);
      assertDemoData(attack.timing.activeMs > 0, `${id}/${attack.id} active time must be positive`);
      assertDemoData(
        attack.timing.followThroughMs >= 0,
        `${id}/${attack.id} follow-through cannot be negative`,
      );
      assertDemoData(attack.timing.recoveryMs > 0, `${id}/${attack.id} recovery must be positive`);
      assertDemoData(
        attack.timing.hitAtMs >= 0 && attack.timing.hitAtMs <= attack.timing.activeMs,
        `${id}/${attack.id} hitAtMs must fall within its active phase`,
      );
      assertDemoData(attack.damage > 0, `${id}/${attack.id} damage must be positive`);
      assertDemoData(
        attack.range.minX >= 0 &&
          attack.range.maxX >= attack.range.minX &&
          attack.range.maxX <= 100,
        `${id}/${attack.id} has an invalid range`,
      );
      assertDemoData(attack.cooldownMs > 0, `${id}/${attack.id} cooldown must be positive`);
      assertDemoData(
        attack.motion.distanceX >= 0 && attack.motion.speedX >= 0,
        `${id}/${attack.id} motion values cannot be negative`,
      );
      assertDemoData(
        attack.telegraph.trim().length > 0 && attack.counterplay.trim().length > 0,
        `${id}/${attack.id} must include telegraph and counterplay text`,
      );
      assertDemoData(
        attack.effectPath === effectPath(id, attack.id),
        `${id}/${attack.id} effectPath must match the shared asset convention`,
      );
      assertDemoData(
        DEMO_EFFECT_ORIGINS.has(attack.effectOrigin),
        `${id}/${attack.id} has an invalid effect origin`,
      );
    });
  });

  assertDemoData(tierCounts.normal === 10, `expected 10 normal enemies, got ${tierCounts.normal}`);
  assertDemoData(tierCounts.elite === 5, `expected 5 elite enemies, got ${tierCounts.elite}`);
  assertDemoData(tierCounts.boss === 3, `expected 3 bosses, got ${tierCounts.boss}`);
  assertDemoData(
    enemies.bridge_nightmare.tier === "elite",
    "bridge_nightmare must be classified as elite",
  );
  assertDemoData(attackTotal === 50, `expected 50 attacks, got ${attackTotal}`);
  assertDemoData(
    DEMO_ENEMIES_BY_TIER.normal.length === 10 &&
      DEMO_ENEMIES_BY_TIER.elite.length === 5 &&
      DEMO_ENEMIES_BY_TIER.boss.length === 3,
    "DEMO_ENEMIES_BY_TIER does not match the required 10/5/3 split",
  );

  return true;
}

validateDemoEnemies();
