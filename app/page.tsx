"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import {
  DEMO_ENEMIES,
  DEMO_ENEMIES_BY_TIER,
  DEMO_TIER_LABELS,
  type DemoAttack,
  type DemoEffectOrigin,
  type DemoEnemyId,
  type DemoTier,
} from "./combat/enemy-demo";
import { ADDITIONAL_GATE_CONSTRUCTION } from "./map/gate/construction";
import { GATE_SCREENS } from "./map/gate/screens";

type Phase = "chapters" | "intro" | "playing" | "victory" | "defeat";
type Chapter = "tutorial" | "gate";
type AirState = "grounded" | "rising" | "falling";
type Facing = "left" | "right";
type Locomotion = "idle" | "starting" | "running" | "stopping";
type EnemyAttackPhase = "idle" | "windup" | "active" | "recover";
type HeavyAttackPhase = "idle" | "charging" | "release";

const clamp = (n: number, min: number, max: number) =>
  Math.min(max, Math.max(min, n));

const DEMO_TIER_ORDER: readonly DemoTier[] = ["normal", "elite", "boss"];
const DEFAULT_DEMO_ENEMY_ID: DemoEnemyId = "bridge_nightmare";

type EffectOriginPreset = {
  readonly reference: "enemy" | "target" | "stage";
  /** Horizontal offset in multiples of the reference actor's visual width. */
  readonly forward: number;
  /** Vertical offset in multiples of actor height, or stage height for stage effects. */
  readonly height: number;
  readonly scale: number;
  readonly align: "forward" | "center";
  readonly vertical: "center" | "ground";
};

/**
 * Shared combat sockets. Attack data names the semantic socket; this table is
 * the single place that turns it into a stage coordinate.
 */
const EFFECT_ORIGIN_PRESETS: Readonly<Record<DemoEffectOrigin, EffectOriginPreset>> = {
  weapon: {
    reference: "enemy",
    forward: 0.22,
    height: 0.58,
    scale: 0.9,
    align: "forward",
    vertical: "center",
  },
  hand: {
    reference: "enemy",
    forward: 0.18,
    height: 0.56,
    scale: 0.95,
    align: "forward",
    vertical: "center",
  },
  head: {
    reference: "enemy",
    forward: 0.12,
    height: 0.72,
    scale: 0.92,
    align: "forward",
    vertical: "center",
  },
  mouth: {
    reference: "enemy",
    forward: 0.2,
    height: 0.6,
    scale: 0.94,
    align: "forward",
    vertical: "center",
  },
  body: {
    reference: "enemy",
    forward: 0,
    height: 0.48,
    scale: 1,
    align: "center",
    vertical: "center",
  },
  "ground-self": {
    reference: "enemy",
    forward: 0.12,
    height: 0,
    scale: 1.15,
    align: "forward",
    vertical: "ground",
  },
  "ground-target": {
    reference: "target",
    forward: 0,
    height: 0,
    scale: 1.2,
    align: "center",
    vertical: "ground",
  },
  "target-body": {
    reference: "target",
    forward: 0,
    height: 0.5,
    scale: 1.1,
    align: "center",
    vertical: "center",
  },
  "target-air": {
    reference: "target",
    forward: 0,
    height: 1.2,
    scale: 1.05,
    align: "center",
    vertical: "center",
  },
  "arena-center": {
    reference: "stage",
    forward: 0,
    height: 0.04,
    scale: 1.6,
    align: "center",
    vertical: "ground",
  },
};

const chooseWeightedAttack = (attacks: readonly DemoAttack[]) => {
  const totalWeight = attacks.reduce((sum, attack) => sum + attack.weight, 0);
  let roll = Math.random() * totalWeight;
  for (const attack of attacks) {
    roll -= attack.weight;
    if (roll <= 0) return attack;
  }
  return attacks[attacks.length - 1];
};

const ATTACK_DAMAGE = 22;
const COMBO_DAMAGE = 28;
const EXHAUSTED_DAMAGE_RATIO = 0.3;
const ROLL_DURATION_MS = 620;
const ROLL_MOVE_PER_FRAME = 0.76;
const LIGHT_ATTACK_ONE_HIT_MS = 205;
const LIGHT_ATTACK_COMBO_OPENS_MS = 330;
const LIGHT_ATTACK_COMBO_GRACE_MS = 720;
const LIGHT_ATTACK_TWO_HIT_MS = 185;
const LIGHT_ATTACK_TWO_DURATION_MS = 460;
const HEAVY_SPIRIT_COST = 20;
const HEAVY_MIN_DAMAGE = 54;
const HEAVY_MAX_DAMAGE = 86;
const HEAVY_MIN_RANGE = 30;
const HEAVY_MAX_RANGE = 40;
const HEAVY_FULL_CHARGE_MS = 1100;
const HEAVY_AUTO_RELEASE_MS = 1500;
const HEAVY_RELEASE_HIT_MS = 420;
const HEAVY_RELEASE_DURATION_MS = 900;
const ACTION_ASSET_URLS = [
  "/assets/player.png",
  "/assets/player-idle.png",
  "/assets/player-run-start.webp",
  "/assets/player-run-loop.webp",
  "/assets/player-run-stop.webp",
  "/assets/player-attack-1.webp",
  "/assets/player-attack-2.webp",
  "/assets/player-heavy-charge.webp",
  "/assets/player-heavy-release.webp",
  "/assets/player-jump-rise.webp",
  "/assets/player-jump-fall.webp",
  "/assets/player-jump-land.webp",
  "/assets/player-run-jump-rise.webp",
  "/assets/player-run-jump-fall.webp",
  "/assets/player-run-jump-land.webp",
  "/assets/player-dash-roll.webp",
] as const;

const GATE_SOURCE = { width: 1672, height: 941, screens: 12 } as const;
const GATE_WORLD_WIDTH = GATE_SOURCE.width * GATE_SOURCE.screens;
const GATE_START_X = 120;
const GATE_END_X = GATE_WORLD_WIDTH - 100;
/** Walking step onto/off nearby ledges. Must stay well below a standing jump (~180px). */
const GATE_AUTO_STEP_HEIGHT = 36;
const GATE_JUMP_VELOCITY = -18.5;
const GATE_GRAVITY = 0.9;
/** Theoretical apex: v^2 / 2g ≈ 190px; discrete integration peaks nearer ~180px. */
const GATE_MAX_JUMP_HEIGHT =
  (GATE_JUMP_VELOCITY * GATE_JUMP_VELOCITY) / (2 * GATE_GRAVITY);
/** A jump pressed this long before touching down still fires on touchdown. */
const JUMP_BUFFER_MS = 160;
/** Grace window for jumping just after walking off a ledge. */
const COYOTE_MS = 110;
/** Landing recovery only applies to a dead stop; running touchdowns keep momentum. */
const LANDING_LOCK_MS = 200;
const GATE_ART_VERSION = "gate-art-full-12-20260808";
const GATE_ART_URLS = GATE_SCREENS.map(
  (screen) =>
    `/assets/maps/gate/${screen.id}-ink-background-layered-1672.png?v=${GATE_ART_VERSION}`,
);

type RuntimeGround = {
  x: number;
  y: number;
  w: number;
  h: number;
  kind: "solid" | "oneway";
  slopeEndY?: number;
  requiresJump?: boolean;
};

const solidGround = (
  x: number,
  y: number,
  w: number,
  slopeEndY?: number,
  requiresJump = false,
): RuntimeGround => ({
  x,
  y,
  w,
  h: GATE_SOURCE.height - y,
  kind: "solid",
  slopeEndY,
  requiresJump,
});

const GATE_SURFACE_GROUND: readonly RuntimeGround[] = [
  solidGround(0, 720, 1180),
  solidGround(1180, 700, 170),
  solidGround(1350, 674, 322, undefined, true),
  solidGround(500, 600, 230),
  solidGround(775, 542, 225),
  solidGround(1045, 478, 250),
  solidGround(1672, 674, 720),
  solidGround(2392, 660, 180, undefined, true),
  solidGround(2572, 646, 200, undefined, true),
  solidGround(2772, 632, 572, undefined, true),
  solidGround(1932, 540, 250),
  solidGround(2492, 505, 270),
  solidGround(2202, 590, 170),
  ...ADDITIONAL_GATE_CONSTRUCTION.flatMap((screen) =>
    screen.colliders
      .filter(
        (collider) =>
          collider.route !== "underground" &&
          collider.kind !== "boundary" &&
          collider.id !== "C75" &&
          !collider.activation,
      )
      .map((collider) => ({
        x: screen.screen * GATE_SOURCE.width + collider.x,
        y: collider.y,
        w: collider.w,
        h: collider.h,
        kind: collider.kind === "oneway" ? ("oneway" as const) : ("solid" as const),
        slopeEndY: collider.slopeEndY,
        requiresJump: collider.requiresJump,
      })),
  ),
] as const;

const groundTopAt = (ground: RuntimeGround, x: number) => {
  if (ground.slopeEndY === undefined || ground.w === 0) return ground.y;
  const progress = clamp((x - ground.x) / ground.w, 0, 1);
  return ground.y + (ground.slopeEndY - ground.y) * progress;
};

const gateGroundAt = (x: number) => {
  const matches = GATE_SURFACE_GROUND.filter(
    (ground) => x >= ground.x && x <= ground.x + ground.w,
  );
  if (matches.length > 0) {
    return Math.max(...matches.map((ground) => groundTopAt(ground, x)));
  }
  const nearest = GATE_SURFACE_GROUND.reduce((best, ground) => {
    const distance = Math.min(
      Math.abs(x - ground.x),
      Math.abs(x - (ground.x + ground.w)),
    );
    return distance < best.distance ? { ground, distance } : best;
  }, { ground: GATE_SURFACE_GROUND[0], distance: Number.POSITIVE_INFINITY });
  return groundTopAt(nearest.ground, clamp(x, nearest.ground.x, nearest.ground.x + nearest.ground.w));
};

const gatePlatformTopsAt = (x: number) =>
  GATE_SURFACE_GROUND.filter(
    (ground) => x >= ground.x && x <= ground.x + ground.w,
  ).map((ground) => groundTopAt(ground, x));

/**
 * Solid floors include a retaining-wall body under their walkable top.
 * Walking into that body from the side must stop, instead of slipping under
 * the ledge and freefalling through the hollow stair core.
 */
const gateSolidWallClamp = (
  fromX: number,
  toX: number,
  footY: number,
): number | null => {
  if (toX === fromX) return null;
  const movingRight = toX > fromX;
  let blocked: number | null = null;

  for (const ground of GATE_SURFACE_GROUND) {
    if (ground.kind !== "solid") continue;
    const faceX = movingRight ? ground.x : ground.x + ground.w;
    const crosses = movingRight
      ? fromX <= faceX && toX > faceX
      : fromX >= faceX && toX < faceX;
    if (!crosses) continue;

    const top = groundTopAt(
      ground,
      clamp(faceX, ground.x, ground.x + ground.w),
    );
    // Already on / able to auto-step onto this top, or entirely under a short slab.
    if (!ground.requiresJump && footY <= top + GATE_AUTO_STEP_HEIGHT) continue;
    if (footY >= top + ground.h) continue;

    const stopX = movingRight ? faceX - 0.01 : faceX + 0.01;
    blocked =
      blocked === null
        ? stopX
        : movingRight
          ? Math.min(blocked, stopX)
          : Math.max(blocked, stopX);
  }

  return blocked;
};

declare global {
  interface Window {
    render_game_to_text?: () => string;
    advanceTime?: (ms: number) => void;
    set_gate_pose?: (worldX: number, footY?: number) => void;
  }
}

export default function Home() {
  const [phase, setPhase] = useState<Phase>("chapters");
  const [chapter, setChapter] = useState<Chapter>("gate");
  const [x, setX] = useState(18);
  const [y, setY] = useState(0);
  const [gateX, setGateX] = useState(GATE_START_X);
  const [gateFootY, setGateFootY] = useState(() => gateGroundAt(GATE_START_X));
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 });
  const [hp, setHp] = useState(360);
  const [spirit, setSpirit] = useState(120);
  const [selectedTier, setSelectedTier] = useState<DemoTier>("elite");
  const [selectedEnemyId, setSelectedEnemyId] =
    useState<DemoEnemyId>(DEFAULT_DEMO_ENEMY_ID);
  const [enemyHp, setEnemyHp] = useState<number>(
    DEMO_ENEMIES[DEFAULT_DEMO_ENEMY_ID].hp,
  );
  const [enemyX, setEnemyX] = useState<number>(
    DEMO_ENEMIES[DEFAULT_DEMO_ENEMY_ID].spawnX,
  );
  const [enemyFacing, setEnemyFacing] = useState<Facing>("left");
  const [enemyAttackPhase, setEnemyAttackPhase] =
    useState<EnemyAttackPhase>("idle");
  const [currentEnemyAttack, setCurrentEnemyAttack] =
    useState<DemoAttack | null>(null);
  const [enemyAttackTargetX, setEnemyAttackTargetX] = useState(18);
  const [locomotion, setLocomotion] = useState<Locomotion>("idle");
  const [facing, setFacing] = useState<Facing>("right");
  const [airState, setAirState] = useState<AirState>("grounded");
  const [runningJump, setRunningJump] = useState(false);
  const [rolling, setRolling] = useState(false);
  const [attackStep, setAttackStep] = useState(0);
  const [heavyAttackPhase, setHeavyAttackPhase] =
    useState<HeavyAttackPhase>("idle");
  const [heavyChargeRatio, setHeavyChargeRatio] = useState(0);
  const [heavyImpact, setHeavyImpact] = useState(false);
  const [landing, setLanding] = useState(false);
  const [enemyHit, setEnemyHit] = useState(false);
  const [playerHit, setPlayerHit] = useState(false);
  const [muted, setMuted] = useState(false);
  const [loadedActionAssets, setLoadedActionAssets] = useState(0);
  const [actionAssetsReady, setActionAssetsReady] = useState(false);
  const [actionAssetsFailed, setActionAssetsFailed] = useState(false);
  const selectedEnemy = DEMO_ENEMIES[selectedEnemyId];

  const keys = useRef(new Set<string>());
  const stageRef = useRef<HTMLDivElement>(null);
  const xRef = useRef(18);
  const yRef = useRef(0);
  const gateXRef = useRef(GATE_START_X);
  const gateFootYRef = useRef(gateGroundAt(GATE_START_X));
  const gateVelocityYRef = useRef(0);
  const gateGroundedRef = useRef(true);
  const gateJumpOriginYRef = useRef(gateGroundAt(GATE_START_X));
  const gateJumpPeakRef = useRef(0);
  /** Smallest foot Y while airborne (highest point reached). */
  const gateMinFootYRef = useRef(gateGroundAt(GATE_START_X));
  const velocity = useRef(0);
  const hpRef = useRef(360);
  const spiritRef = useRef(120);
  const selectedEnemyIdRef = useRef<DemoEnemyId>(DEFAULT_DEMO_ENEMY_ID);
  const enemyRef = useRef<number>(DEMO_ENEMIES[DEFAULT_DEMO_ENEMY_ID].hp);
  const enemyXRef = useRef<number>(
    DEMO_ENEMIES[DEFAULT_DEMO_ENEMY_ID].spawnX,
  );
  const enemyFacingRef = useRef<Facing>("left");
  const enemyAttackPhaseRef = useRef<EnemyAttackPhase>("idle");
  const currentEnemyAttackRef = useRef<DemoAttack | null>(null);
  const enemyPhaseEndsAtRef = useRef(0);
  const enemyHitAtRef = useRef(0);
  const enemyHitAppliedRef = useRef(false);
  const enemyNextDecisionAtRef = useRef(0);
  const enemyAttackTargetXRef = useRef(18);
  const enemyLastFrameAtRef = useRef(0);
  const enemyMotionRemainingRef = useRef(0);
  const enemyMotionDirectionRef = useRef(-1);
  const phaseRef = useRef<Phase>("chapters");
  const chapterRef = useRef<Chapter>("gate");
  const movingRef = useRef(false);
  const locomotionToken = useRef(0);
  const facingRef = useRef<Facing>("right");
  const runningJumpRef = useRef(false);
  const rollingRef = useRef(false);
  const rollDirection = useRef(1);
  const attackRef = useRef(false);
  const landingRef = useRef(false);
  const attackPendingRef = useRef(false);
  const currentAttackStep = useRef(0);
  const comboQueuedRef = useRef(false);
  const comboWindowOpenRef = useRef(false);
  const chainAttackRef = useRef<(() => void) | null>(null);
  const attackToken = useRef(0);
  const heavyAttackPhaseRef = useRef<HeavyAttackPhase>("idle");
  const heavyChargeStartedAtRef = useRef(0);
  const heavyChargeRatioRef = useRef(0);
  const releaseHeavyAttackRef = useRef<(() => void) | null>(null);
  const timers = useRef<number[]>([]);
  const landingUntilRef = useRef(0);
  const landingToken = useRef(0);
  const jumpBufferUntilRef = useRef(0);
  const coyoteUntilRef = useRef(0);
  const rollingUntilRef = useRef(0);
  const attackPendingUntilRef = useRef(0);
  const attackUntilRef = useRef(0);
  const controlRecoveryCountRef = useRef(0);

  const clearTimers = useCallback(() => {
    timers.current.forEach((timer) => window.clearTimeout(timer));
    timers.current = [];
  }, []);

  const isHoldingDirection = useCallback(() => {
    const left = keys.current.has("a") || keys.current.has("arrowleft");
    const right = keys.current.has("d") || keys.current.has("arrowright");
    return left !== right;
  }, []);

  const later = useCallback((fn: () => void, delay: number) => {
    const timer = window.setTimeout(() => {
      timers.current = timers.current.filter((id) => id !== timer);
      fn();
    }, delay);
    timers.current.push(timer);
    return timer;
  }, []);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  useEffect(() => {
    chapterRef.current = chapter;
  }, [chapter]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const measure = () =>
      setStageSize({ width: stage.clientWidth, height: stage.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(stage);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;

    const preload = (src: string) =>
      new Promise<void>((resolve, reject) => {
        const image = new Image();
        image.decoding = "async";
        image.onload = async () => {
          try {
            await image.decode();
          } catch {
            // Some Safari versions reject decode() after load even though the
            // decoded image is already usable, so load remains authoritative.
          }
          if (!cancelled) setLoadedActionAssets((count) => count + 1);
          resolve();
        };
        image.onerror = () => reject(new Error(`Failed to preload ${src}`));
        image.src = src;
      });

    void Promise.all(ACTION_ASSET_URLS.map(preload))
      .then(() => {
        if (!cancelled) setActionAssetsReady(true);
      })
      .catch(() => {
        if (!cancelled) setActionAssetsFailed(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => () => clearTimers(), [clearTimers]);

  const resetEnemyAttackState = useCallback((nextDecisionAt = 0) => {
    enemyAttackPhaseRef.current = "idle";
    currentEnemyAttackRef.current = null;
    enemyPhaseEndsAtRef.current = 0;
    enemyHitAtRef.current = 0;
    enemyHitAppliedRef.current = false;
    enemyNextDecisionAtRef.current = nextDecisionAt;
    enemyAttackTargetXRef.current = 18;
    enemyLastFrameAtRef.current = 0;
    enemyMotionRemainingRef.current = 0;
    enemyMotionDirectionRef.current = -1;
    setEnemyAttackPhase("idle");
    setCurrentEnemyAttack(null);
    setEnemyAttackTargetX(18);
  }, []);

  const resetActions = useCallback(() => {
    clearTimers();
    keys.current.clear();
    movingRef.current = false;
    locomotionToken.current += 1;
    facingRef.current = "right";
    runningJumpRef.current = false;
    rollingRef.current = false;
    attackRef.current = false;
    landingRef.current = false;
    attackPendingRef.current = false;
    currentAttackStep.current = 0;
    comboQueuedRef.current = false;
    comboWindowOpenRef.current = false;
    chainAttackRef.current = null;
    attackToken.current += 1;
    heavyAttackPhaseRef.current = "idle";
    heavyChargeStartedAtRef.current = 0;
    heavyChargeRatioRef.current = 0;
    releaseHeavyAttackRef.current = null;
    resetEnemyAttackState();
    landingUntilRef.current = 0;
    landingToken.current += 1;
    jumpBufferUntilRef.current = 0;
    coyoteUntilRef.current = 0;
    rollingUntilRef.current = 0;
    attackPendingUntilRef.current = 0;
    attackUntilRef.current = 0;
    setLocomotion("idle");
    setFacing("right");
    setAirState("grounded");
    setRunningJump(false);
    setRolling(false);
    setAttackStep(0);
    setHeavyAttackPhase("idle");
    setHeavyChargeRatio(0);
    setHeavyImpact(false);
    setLanding(false);
  }, [clearTimers, resetEnemyAttackState]);

  const recoverExpiredControlLocks = useCallback((now = performance.now()) => {
    let recovered = false;

    if (
      landingRef.current &&
      landingUntilRef.current > 0 &&
      now >= landingUntilRef.current
    ) {
      landingToken.current += 1;
      landingRef.current = false;
      landingUntilRef.current = 0;
      runningJumpRef.current = false;
      setLanding(false);
      setRunningJump(false);
      recovered = true;
    }

    if (
      rollingRef.current &&
      rollingUntilRef.current > 0 &&
      now >= rollingUntilRef.current
    ) {
      rollingRef.current = false;
      rollingUntilRef.current = 0;
      setRolling(false);
      recovered = true;
    }

    if (
      attackPendingRef.current &&
      attackPendingUntilRef.current > 0 &&
      now >= attackPendingUntilRef.current
    ) {
      attackPendingRef.current = false;
      attackPendingUntilRef.current = 0;
      locomotionToken.current += 1;
      setLocomotion("idle");
      recovered = true;
    }

    if (
      attackRef.current &&
      attackUntilRef.current > 0 &&
      now >= attackUntilRef.current
    ) {
      attackToken.current += 1;
      attackRef.current = false;
      attackUntilRef.current = 0;
      currentAttackStep.current = 0;
      comboQueuedRef.current = false;
      comboWindowOpenRef.current = false;
      chainAttackRef.current = null;
      heavyAttackPhaseRef.current = "idle";
      heavyChargeStartedAtRef.current = 0;
      heavyChargeRatioRef.current = 0;
      releaseHeavyAttackRef.current = null;
      setAttackStep(0);
      setHeavyAttackPhase("idle");
      setHeavyChargeRatio(0);
      setHeavyImpact(false);
      recovered = true;
    }

    if (recovered) controlRecoveryCountRef.current += 1;
  }, []);

  const spendSpirit = useCallback((cost: number) => {
    const next = Math.max(0, spiritRef.current - cost);
    spiritRef.current = next;
    setSpirit(next);
  }, []);

  const finishGame = useCallback(
    (outcome: "victory" | "defeat", delay = 0) => {
      if (phaseRef.current !== "playing") return;

      phaseRef.current = outcome;
      attackToken.current += 1;
      locomotionToken.current += 1;
      attackRef.current = false;
      attackPendingRef.current = false;
      comboQueuedRef.current = false;
      comboWindowOpenRef.current = false;
      chainAttackRef.current = null;
      movingRef.current = false;
      heavyAttackPhaseRef.current = "idle";
      heavyChargeStartedAtRef.current = 0;
      heavyChargeRatioRef.current = 0;
      releaseHeavyAttackRef.current = null;
      resetEnemyAttackState();
      landingUntilRef.current = 0;
      rollingUntilRef.current = 0;
      attackPendingUntilRef.current = 0;
      attackUntilRef.current = 0;
      clearTimers();
      setHeavyAttackPhase("idle");
      setHeavyChargeRatio(0);
      setHeavyImpact(false);

      if (delay > 0) later(() => setPhase(outcome), delay);
      else setPhase(outcome);
    },
    [clearTimers, later, resetEnemyAttackState],
  );

  const start = useCallback(() => {
    if (!actionAssetsReady) return;
    const enemy = DEMO_ENEMIES[selectedEnemyIdRef.current];
    xRef.current = 18;
    gateXRef.current = GATE_START_X;
    gateFootYRef.current = gateGroundAt(GATE_START_X);
    gateVelocityYRef.current = 0;
    gateGroundedRef.current = true;
    gateJumpOriginYRef.current = gateGroundAt(GATE_START_X);
    gateJumpPeakRef.current = 0;
    gateMinFootYRef.current = gateGroundAt(GATE_START_X);
    yRef.current = 0;
    velocity.current = 0;
    hpRef.current = 360;
    spiritRef.current = 120;
    enemyRef.current = enemy.hp;
    enemyXRef.current = enemy.spawnX;
    enemyFacingRef.current = "left";
    resetActions();
    setX(18);
    setY(0);
    setGateX(GATE_START_X);
    setGateFootY(gateGroundAt(GATE_START_X));
    setHp(360);
    setSpirit(120);
    setEnemyHp(enemy.hp);
    setEnemyX(enemy.spawnX);
    setEnemyFacing("left");
    setEnemyHit(false);
    setPlayerHit(false);
    phaseRef.current = "playing";
    setPhase("playing");
  }, [actionAssetsReady, resetActions]);

  const chooseChapter = useCallback((nextChapter: Chapter) => {
    chapterRef.current = nextChapter;
    setChapter(nextChapter);
    if (nextChapter === "tutorial") {
      const enemy = DEMO_ENEMIES[selectedEnemyIdRef.current];
      hpRef.current = 360;
      spiritRef.current = 120;
      enemyRef.current = enemy.hp;
      enemyXRef.current = enemy.spawnX;
      enemyFacingRef.current = "left";
      setHp(360);
      setSpirit(120);
      setEnemyHp(enemy.hp);
      setEnemyX(enemy.spawnX);
      setEnemyFacing("left");
      setEnemyHit(false);
      setPlayerHit(false);
    }
    phaseRef.current = "intro";
    setPhase("intro");
  }, []);

  const returnToChapters = useCallback(() => {
    resetActions();
    phaseRef.current = "chapters";
    setPhase("chapters");
  }, [resetActions]);

  const chooseEnemy = useCallback(
    (enemyId: DemoEnemyId) => {
      const enemy = DEMO_ENEMIES[enemyId];
      selectedEnemyIdRef.current = enemyId;
      enemyRef.current = enemy.hp;
      enemyXRef.current = enemy.spawnX;
      const nextFacing = xRef.current > enemy.spawnX ? "right" : "left";
      enemyFacingRef.current = nextFacing;
      resetEnemyAttackState();
      setSelectedEnemyId(enemyId);
      setSelectedTier(enemy.tier);
      setEnemyHp(enemy.hp);
      setEnemyX(enemy.spawnX);
      setEnemyFacing(nextFacing);
      setEnemyHit(false);
    },
    [resetEnemyAttackState],
  );

  const chooseEnemyTier = useCallback(
    (tier: DemoTier) => {
      setSelectedTier(tier);
      const firstEnemy = DEMO_ENEMIES_BY_TIER[tier][0];
      if (firstEnemy) chooseEnemy(firstEnemy.id);
    },
    [chooseEnemy],
  );

  const returnToEnemyPicker = useCallback(() => {
    resetActions();
    const enemy = DEMO_ENEMIES[selectedEnemyIdRef.current];
    hpRef.current = 360;
    spiritRef.current = 120;
    enemyRef.current = enemy.hp;
    enemyXRef.current = enemy.spawnX;
    enemyFacingRef.current = "left";
    setHp(360);
    setSpirit(120);
    setEnemyHp(enemy.hp);
    setEnemyX(enemy.spawnX);
    setEnemyFacing("left");
    setEnemyHit(false);
    setPlayerHit(false);
    phaseRef.current = "intro";
    setPhase("intro");
  }, [resetActions]);

  const stepGatePhysics = useCallback(
    (delta: number, horizontalSpeed: number) => {
      let nextX = gateXRef.current;
      let footY = gateFootYRef.current;
      let grounded = gateGroundedRef.current;

      if (horizontalSpeed !== 0) {
        const candidateX = clamp(
          gateXRef.current + horizontalSpeed * delta,
          GATE_START_X,
          GATE_END_X,
        );
        const tops = gatePlatformTopsAt(candidateX);

        if (!grounded) {
          // Air control is free: elevated ledges must not act as magnetic walls.
          nextX = candidateX;
        } else if (tops.length === 0) {
          nextX = candidateX;
          grounded = false;
          coyoteUntilRef.current = performance.now() + COYOTE_MS;
          gateJumpOriginYRef.current = footY;
          gateVelocityYRef.current = 0;
          gateMinFootYRef.current = footY;
        } else {
          const currentFootY = footY;
          const withinStep = tops.filter(
            (top) => Math.abs(top - currentFootY) <= GATE_AUTO_STEP_HEIGHT,
          );
          if (withinStep.length > 0) {
            nextX = candidateX;
            // Stay on the nearest standable surface; never leap to a high ledge.
            footY = withinStep.reduce((closest, top) =>
              Math.abs(top - currentFootY) < Math.abs(closest - currentFootY)
                ? top
                : closest,
            );
          } else {
            // Raised solid stairs expose a retaining wall: stop instead of
            // walking into the hollow under the next tread.
            const wallX = gateSolidWallClamp(
              gateXRef.current,
              candidateX,
              currentFootY,
            );
            if (wallX !== null) {
              nextX = wallX;
            } else {
              // Floor dropped away past a ledge — fall, do not teleport upward.
              nextX = candidateX;
              grounded = false;
              coyoteUntilRef.current = performance.now() + COYOTE_MS;
              gateJumpOriginYRef.current = currentFootY;
              gateVelocityYRef.current = 0;
              gateMinFootYRef.current = currentFootY;
            }
          }
        }
      }

      gateXRef.current = nextX;

      if (!grounded) {
        const previousFootY = footY;
        gateVelocityYRef.current += GATE_GRAVITY * delta;
        footY += gateVelocityYRef.current * delta;
        gateMinFootYRef.current = Math.min(
          gateMinFootYRef.current,
          previousFootY,
          footY,
        );
        gateJumpPeakRef.current = Math.max(
          gateJumpPeakRef.current,
          gateJumpOriginYRef.current - gateMinFootYRef.current,
        );

        if (gateVelocityYRef.current > 0) {
          setAirState("falling");
          // Land only by falling through a surface the jump actually reached.
          // No upward teleport / ledge magnet.
          const landingTop = gatePlatformTopsAt(nextX)
            .filter(
              (top) =>
                previousFootY <= top &&
                footY >= top &&
                gateMinFootYRef.current <= top &&
                top >= gateJumpOriginYRef.current - GATE_MAX_JUMP_HEIGHT - 1,
            )
            .sort((a, b) => a - b)[0];
          if (landingTop !== undefined) {
            footY = landingTop;
            grounded = true;
            gateVelocityYRef.current = 0;
            gateMinFootYRef.current = landingTop;
            coyoteUntilRef.current = 0;
            setAirState("grounded");
            if (isHoldingDirection()) {
              // Touching down mid-run keeps the run loop going: no recovery pose,
              // no locomotion restart, so run-jump-run chains read as one motion.
              runningJumpRef.current = false;
              setRunningJump(false);
            } else {
              const token = ++landingToken.current;
              landingRef.current = true;
              landingUntilRef.current = performance.now() + LANDING_LOCK_MS + 250;
              setLanding(true);
              later(() => {
                if (token !== landingToken.current) return;
                landingRef.current = false;
                landingUntilRef.current = 0;
                setLanding(false);
                runningJumpRef.current = false;
                setRunningJump(false);
              }, LANDING_LOCK_MS);
            }
          }
        }

        if (footY > GATE_SOURCE.height - 12) {
          footY = gateGroundAt(nextX);
          grounded = true;
          gateVelocityYRef.current = 0;
          gateMinFootYRef.current = footY;
          setAirState("grounded");
        }
      }

      gateGroundedRef.current = grounded;
      gateFootYRef.current = footY;
      setGateX(nextX);
      setGateFootY(footY);
    },
    [isHoldingDirection, later],
  );

  const tryJump = useCallback(
    (now = performance.now()) => {
      recoverExpiredControlLocks(now);
      const inGate = chapterRef.current === "gate";
      if (
        phaseRef.current !== "playing" ||
        rollingRef.current ||
        attackPendingRef.current ||
        attackRef.current
      )
        return false;
      const canLeaveGround = inGate
        ? gateGroundedRef.current ||
          (gateVelocityYRef.current >= 0 && now < coyoteUntilRef.current)
        : yRef.current <= 1;
      if (!canLeaveGround) return false;

      // A queued jump cancels the landing recovery instead of being swallowed.
      landingToken.current += 1;
      landingRef.current = false;
      landingUntilRef.current = 0;
      setLanding(false);
      coyoteUntilRef.current = 0;

      const fromRun = movingRef.current || isHoldingDirection();
      runningJumpRef.current = fromRun;
      setRunningJump(fromRun);
      if (inGate) {
        gateJumpOriginYRef.current = gateFootYRef.current;
        gateJumpPeakRef.current = 0;
        gateMinFootYRef.current = gateFootYRef.current;
        gateGroundedRef.current = false;
        gateVelocityYRef.current = GATE_JUMP_VELOCITY;
      } else {
        velocity.current = 18;
      }
      setAirState("rising");
      return true;
    },
    [isHoldingDirection, recoverExpiredControlLocks],
  );

  const jump = useCallback(() => {
    const now = performance.now();
    // Presses made just before touchdown are held briefly rather than dropped,
    // so tapping jump repeatedly chains instead of skipping a beat.
    if (tryJump(now)) jumpBufferUntilRef.current = 0;
    else if (phaseRef.current === "playing")
      jumpBufferUntilRef.current = now + JUMP_BUFFER_MS;
  }, [tryJump]);

  const roll = useCallback(() => {
    recoverExpiredControlLocks();
    if (
      phaseRef.current !== "playing" ||
      (chapterRef.current === "gate"
        ? !gateGroundedRef.current
        : yRef.current > 1) ||
      rollingRef.current ||
      landingRef.current ||
      attackPendingRef.current ||
      attackRef.current ||
      spiritRef.current <= 0
    )
      return;
    rollingRef.current = true;
    rollingUntilRef.current = performance.now() + 900;
    rollDirection.current = facingRef.current === "right" ? 1 : -1;
    setRolling(true);
    spendSpirit(8);
    later(() => {
      rollingRef.current = false;
      rollingUntilRef.current = 0;
      setRolling(false);
      const left = keys.current.has("a") || keys.current.has("arrowleft");
      const right = keys.current.has("d") || keys.current.has("arrowright");
      if (left !== right) {
        movingRef.current = true;
        locomotionToken.current += 1;
        setLocomotion("running");
      }
    }, ROLL_DURATION_MS);
  }, [later, recoverExpiredControlLocks, spendSpirit]);

  const beginAttack = useCallback(() => {
    if (
      phaseRef.current !== "playing" ||
      rollingRef.current ||
      landingRef.current
    )
      return;

    const exhausted = spiritRef.current <= 0;
    const token = ++attackToken.current;
    attackPendingRef.current = false;
    attackPendingUntilRef.current = 0;
    attackRef.current = true;
    attackUntilRef.current = performance.now() + 1050;
    currentAttackStep.current = 1;
    comboQueuedRef.current = false;
    comboWindowOpenRef.current = false;
    setLocomotion("idle");
    setAttackStep(1);
    if (!exhausted) spendSpirit(4);

    const dealDamage = (damage: number, range: number) => {
      if (
        phaseRef.current !== "playing" ||
        Math.abs(xRef.current - enemyXRef.current) >= range ||
        enemyRef.current <= 0
      )
        return;
      const next = Math.max(0, enemyRef.current - damage);
      enemyRef.current = next;
      setEnemyHp(next);
      setEnemyHit(true);
      if (next === 0) {
        finishGame("victory", 560);
        later(() => setEnemyHit(false), 170);
      } else {
        later(() => setEnemyHit(false), 170);
      }
    };

    const firstDamage = exhausted
      ? Math.max(1, Math.round(ATTACK_DAMAGE * EXHAUSTED_DAMAGE_RATIO))
      : ATTACK_DAMAGE;

    const finishAttack = () => {
      if (token !== attackToken.current) return;
      attackRef.current = false;
      attackUntilRef.current = 0;
      currentAttackStep.current = 0;
      comboQueuedRef.current = false;
      comboWindowOpenRef.current = false;
      chainAttackRef.current = null;
      setAttackStep(0);
    };

    const startSecondStrike = () => {
      if (
        token !== attackToken.current ||
        currentAttackStep.current !== 1 ||
        exhausted ||
        spiritRef.current <= 0
      )
        return;

      comboQueuedRef.current = false;
      comboWindowOpenRef.current = false;
      chainAttackRef.current = null;
      currentAttackStep.current = 2;
      attackUntilRef.current = performance.now() + 800;
      setAttackStep(2);
      spendSpirit(4);
      later(() => {
        if (token === attackToken.current) dealDamage(COMBO_DAMAGE, 27);
      }, LIGHT_ATTACK_TWO_HIT_MS);
      later(finishAttack, LIGHT_ATTACK_TWO_DURATION_MS);
    };

    chainAttackRef.current = startSecondStrike;

    later(() => {
      if (token === attackToken.current) dealDamage(firstDamage, 24);
    }, LIGHT_ATTACK_ONE_HIT_MS);

    later(() => {
      if (token !== attackToken.current || currentAttackStep.current !== 1)
        return;
      comboWindowOpenRef.current = true;
      if (comboQueuedRef.current) startSecondStrike();
    }, LIGHT_ATTACK_COMBO_OPENS_MS);

    later(() => {
      if (currentAttackStep.current === 1) finishAttack();
    }, LIGHT_ATTACK_COMBO_GRACE_MS);
  }, [finishGame, later, spendSpirit]);

  const attack = useCallback(() => {
    recoverExpiredControlLocks();
    if (
      phaseRef.current !== "playing" ||
      rollingRef.current ||
      landingRef.current
    )
      return;

    if (attackRef.current || attackPendingRef.current) {
      if (currentAttackStep.current === 1 && spiritRef.current > 0) {
        if (comboWindowOpenRef.current) chainAttackRef.current?.();
        else comboQueuedRef.current = true;
      }
      return;
    }

    comboQueuedRef.current = false;
    if (movingRef.current || locomotion !== "idle") {
      attackPendingRef.current = true;
      attackPendingUntilRef.current = performance.now() + 900;
      movingRef.current = false;
      const token = ++locomotionToken.current;
      setLocomotion("stopping");
      later(() => {
        if (token !== locomotionToken.current || !attackPendingRef.current)
          return;
        attackPendingUntilRef.current = 0;
        beginAttack();
      }, 460);
      return;
    }

    beginAttack();
  }, [beginAttack, later, locomotion, recoverExpiredControlLocks]);

  const releaseHeavyAttack = useCallback(() => {
    if (heavyAttackPhaseRef.current !== "charging") return;

    const now = performance.now();
    const token = attackToken.current;
    const heldMs = Math.max(0, now - heavyChargeStartedAtRef.current);
    const chargeRatio = clamp(heldMs / HEAVY_FULL_CHARGE_MS, 0, 1);
    const damage = Math.round(
      HEAVY_MIN_DAMAGE + (HEAVY_MAX_DAMAGE - HEAVY_MIN_DAMAGE) * chargeRatio,
    );
    const range =
      HEAVY_MIN_RANGE + (HEAVY_MAX_RANGE - HEAVY_MIN_RANGE) * chargeRatio;

    heavyChargeRatioRef.current = chargeRatio;
    heavyAttackPhaseRef.current = "release";
    attackUntilRef.current = now + HEAVY_RELEASE_DURATION_MS + 350;
    setHeavyChargeRatio(chargeRatio);
    setHeavyAttackPhase("release");

    later(() => {
      if (
        token !== attackToken.current ||
        heavyAttackPhaseRef.current !== "release" ||
        phaseRef.current !== "playing"
      )
        return;

      setHeavyImpact(true);
      later(() => setHeavyImpact(false), 180);

      if (chapterRef.current !== "tutorial" || enemyRef.current <= 0) return;
      const signedDistance =
        facingRef.current === "right"
          ? enemyXRef.current - xRef.current
          : xRef.current - enemyXRef.current;
      if (signedDistance < -1.5 || signedDistance > range) return;

      const next = Math.max(0, enemyRef.current - damage);
      enemyRef.current = next;
      setEnemyHp(next);
      setEnemyHit(true);
      later(() => setEnemyHit(false), 260);
      if (next === 0) finishGame("victory", 620);
    }, HEAVY_RELEASE_HIT_MS);

    later(() => {
      if (token !== attackToken.current) return;
      attackRef.current = false;
      attackUntilRef.current = 0;
      currentAttackStep.current = 0;
      heavyAttackPhaseRef.current = "idle";
      heavyChargeStartedAtRef.current = 0;
      heavyChargeRatioRef.current = 0;
      releaseHeavyAttackRef.current = null;
      setAttackStep(0);
      setHeavyAttackPhase("idle");
      setHeavyChargeRatio(0);
      setHeavyImpact(false);
    }, HEAVY_RELEASE_DURATION_MS);
  }, [finishGame, later]);

  const beginHeavyAttack = useCallback(() => {
    recoverExpiredControlLocks();
    const grounded =
      chapterRef.current === "gate"
        ? gateGroundedRef.current
        : yRef.current <= 1;
    if (
      phaseRef.current !== "playing" ||
      !grounded ||
      rollingRef.current ||
      landingRef.current ||
      attackPendingRef.current ||
      attackRef.current ||
      spiritRef.current < HEAVY_SPIRIT_COST
    )
      return;

    const now = performance.now();
    attackToken.current += 1;
    attackRef.current = true;
    attackUntilRef.current =
      now + HEAVY_AUTO_RELEASE_MS + HEAVY_RELEASE_DURATION_MS + 600;
    currentAttackStep.current = 3;
    heavyAttackPhaseRef.current = "charging";
    heavyChargeStartedAtRef.current = now;
    heavyChargeRatioRef.current = 0;
    releaseHeavyAttackRef.current = releaseHeavyAttack;
    movingRef.current = false;
    locomotionToken.current += 1;
    setLocomotion("idle");
    setAttackStep(3);
    setHeavyAttackPhase("charging");
    setHeavyChargeRatio(0);
    spendSpirit(HEAVY_SPIRIT_COST);
  }, [recoverExpiredControlLocks, releaseHeavyAttack, spendSpirit]);

  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (
        [
          "a",
          "d",
          "w",
          " ",
          "j",
          "l",
          "k",
          "shift",
          "arrowleft",
          "arrowright",
          "arrowup",
          "f",
        ].includes(key)
      )
        event.preventDefault();
      keys.current.add(key);
      if ([" ", "w", "arrowup"].includes(key) && !event.repeat) jump();
      if (key === "j" && !event.repeat) attack();
      if (key === "l" && !event.repeat) beginHeavyAttack();
      if (["k", "shift"].includes(key) && !event.repeat) roll();
      if (key === "enter" && ["intro", "victory", "defeat"].includes(phaseRef.current)) start();
      if (key === "escape" && phaseRef.current === "intro") returnToChapters();
      if (key === "f" && !event.repeat) {
        if (document.fullscreenElement) void document.exitFullscreen();
        else void document.documentElement.requestFullscreen();
      }
    };
    const up = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      keys.current.delete(key);
      if (key === "l") releaseHeavyAttack();
    };
    const blur = () => {
      keys.current.clear();
      releaseHeavyAttackRef.current?.();
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
  }, [attack, beginHeavyAttack, jump, releaseHeavyAttack, returnToChapters, roll, start]);

  useEffect(() => {
    let frame = 0;
    let before = performance.now();
    const tick = (now: number) => {
      const delta = Math.min(2, (now - before) / 16.67);
      before = now;
      if (phaseRef.current === "playing") {
        recoverExpiredControlLocks(now);
        if (heavyAttackPhaseRef.current === "charging") {
          const heldMs = now - heavyChargeStartedAtRef.current;
          const chargeRatio = clamp(heldMs / HEAVY_FULL_CHARGE_MS, 0, 1);
          if (Math.abs(chargeRatio - heavyChargeRatioRef.current) >= 0.015) {
            heavyChargeRatioRef.current = chargeRatio;
            setHeavyChargeRatio(chargeRatio);
          }
          if (heldMs >= HEAVY_AUTO_RELEASE_MS)
            releaseHeavyAttackRef.current?.();
        }
        if (jumpBufferUntilRef.current > 0) {
          if (now >= jumpBufferUntilRef.current || tryJump(now))
            jumpBufferUntilRef.current = 0;
        }
        const left = keys.current.has("a") || keys.current.has("arrowleft");
        const right = keys.current.has("d") || keys.current.has("arrowright");
        // Landing no longer freezes horizontal control: a run that goes through a
        // jump stays a run, both for the sprite state and for the world speed.
        const walking =
          left !== right &&
          !attackRef.current &&
          !attackPendingRef.current &&
          !rollingRef.current;

        if (walking !== movingRef.current) {
          movingRef.current = walking;
          const token = ++locomotionToken.current;
          if (walking) {
            setLocomotion("starting");
            later(() => {
              if (token === locomotionToken.current && movingRef.current)
                setLocomotion("running");
            }, 420);
          } else {
            setLocomotion("stopping");
            later(() => {
              if (token === locomotionToken.current && !movingRef.current)
                setLocomotion("idle");
            }, 460);
          }
        }
        if (walking) {
          const direction: Facing = right ? "right" : "left";
          if (facingRef.current !== direction) {
            facingRef.current = direction;
            setFacing(direction);
          }
          if (chapterRef.current !== "gate") {
            xRef.current = clamp(
              xRef.current + (right ? 0.5 : -0.5) * delta,
              6,
              82,
            );
            setX(xRef.current);
          }
        }

        if (rollingRef.current && chapterRef.current !== "gate") {
            xRef.current = clamp(
              xRef.current + rollDirection.current * ROLL_MOVE_PER_FRAME * delta,
              6,
              82,
            );
            setX(xRef.current);
        }

        if (chapterRef.current === "gate") {
          const gateHorizontalSpeed = rollingRef.current
            ? rollDirection.current * 11.5
            : walking
              ? right
                ? 7.2
                : -7.2
              : 0;
          stepGatePhysics(delta, gateHorizontalSpeed);
        } else if (yRef.current > 0 || velocity.current !== 0) {
          yRef.current += velocity.current * delta;
          velocity.current -= 1.05 * delta;
          if (velocity.current < -1) setAirState("falling");
          if (yRef.current <= 0) {
            yRef.current = 0;
            velocity.current = 0;
            setAirState("grounded");
            if (isHoldingDirection()) {
              runningJumpRef.current = false;
              setRunningJump(false);
            } else {
              const token = ++landingToken.current;
              landingRef.current = true;
              landingUntilRef.current = now + LANDING_LOCK_MS + 250;
              setLanding(true);
              later(() => {
                if (token !== landingToken.current) return;
                landingRef.current = false;
                landingUntilRef.current = 0;
                setLanding(false);
                runningJumpRef.current = false;
                setRunningJump(false);
              }, LANDING_LOCK_MS);
            }
          }
          setY(yRef.current);
        }
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [
    isHoldingDirection,
    later,
    recoverExpiredControlLocks,
    stepGatePhysics,
    tryJump,
  ]);

  useEffect(() => {
    let frame = 0;

    const enterEnemyPhase = (nextPhase: EnemyAttackPhase) => {
      if (enemyAttackPhaseRef.current === nextPhase) return;
      enemyAttackPhaseRef.current = nextPhase;
      setEnemyAttackPhase(nextPhase);
    };

    const moveEnemy = (amount: number) => {
      if (!Number.isFinite(amount) || amount === 0) return;
      const nextX = clamp(enemyXRef.current + amount, 10, 90);
      if (Math.abs(nextX - enemyXRef.current) < 0.001) return;
      enemyXRef.current = nextX;
      setEnemyX(nextX);
    };

    const applyEnemyHit = (attack: DemoAttack) => {
      if (
        phaseRef.current !== "playing" ||
        chapterRef.current !== "tutorial" ||
        enemyRef.current <= 0 ||
        rollingRef.current
      )
        return;

      const horizontalDistance = Math.abs(xRef.current - enemyXRef.current);
      const verticalMatches =
        attack.range.vertical === "any" ||
        (attack.range.vertical === "ground" && yRef.current < 34) ||
        (attack.range.vertical === "air" && yRef.current >= 18);
      const inRange =
        horizontalDistance >= attack.range.minX &&
        horizontalDistance <= attack.range.maxX;
      if (!verticalMatches || !inRange) return;

      const nextHp = Math.max(0, hpRef.current - attack.damage);
      hpRef.current = nextHp;
      setHp(nextHp);
      setPlayerHit(true);
      later(() => setPlayerHit(false), attack.kind === "heavy" ? 300 : 210);
      if (nextHp === 0) finishGame("defeat");
    };

    const tickEnemy = (now: number) => {
      const previousFrame = enemyLastFrameAtRef.current || now;
      const deltaSeconds = Math.min(0.05, Math.max(0, now - previousFrame) / 1000);
      enemyLastFrameAtRef.current = now;

      if (
        phaseRef.current === "playing" &&
        chapterRef.current === "tutorial" &&
        enemyRef.current > 0
      ) {
        const enemy = DEMO_ENEMIES[selectedEnemyIdRef.current];
        const distance = Math.abs(xRef.current - enemyXRef.current);
        const facingNext: Facing = xRef.current >= enemyXRef.current ? "right" : "left";
        if (facingNext !== enemyFacingRef.current) {
          enemyFacingRef.current = facingNext;
          setEnemyFacing(facingNext);
        }

        if (enemyAttackPhaseRef.current === "idle") {
          const [preferredMin, preferredMax] = enemy.behavior.preferredRange;
          let moveDirection = 0;
          if (distance > preferredMax) {
            moveDirection = xRef.current > enemyXRef.current ? 1 : -1;
          } else if (distance < preferredMin) {
            moveDirection = xRef.current > enemyXRef.current ? -1 : 1;
          }
          if (moveDirection !== 0) {
            moveEnemy(moveDirection * enemy.behavior.moveSpeed * deltaSeconds);
          }

          const refreshedDistance = Math.abs(xRef.current - enemyXRef.current);
          const eligibleAttacks = enemy.attacks.filter(
            (attack) =>
              refreshedDistance >= attack.range.minX &&
              refreshedDistance <= attack.range.maxX,
          );
          if (
            now >= enemyNextDecisionAtRef.current &&
            eligibleAttacks.length > 0
          ) {
            const nextAttack = chooseWeightedAttack(eligibleAttacks);
            enemyAttackTargetXRef.current = xRef.current;
            setEnemyAttackTargetX(xRef.current);
            currentEnemyAttackRef.current = nextAttack;
            enemyHitAppliedRef.current = false;
            enemyPhaseEndsAtRef.current = now + nextAttack.timing.windupMs;
            enemyMotionRemainingRef.current = Math.abs(
              nextAttack.motion.distanceX,
            );
            enemyMotionDirectionRef.current =
              xRef.current >= enemyXRef.current ? 1 : -1;
            setCurrentEnemyAttack(nextAttack);
            enterEnemyPhase("windup");
          }
        } else if (enemyAttackPhaseRef.current === "windup") {
          const attack = currentEnemyAttackRef.current;
          if (attack && now >= enemyPhaseEndsAtRef.current) {
            enterEnemyPhase("active");
            enemyPhaseEndsAtRef.current = now + attack.timing.activeMs;
            enemyHitAtRef.current = now + attack.timing.hitAtMs;
          }
        } else if (enemyAttackPhaseRef.current === "active") {
          const attack = currentEnemyAttackRef.current;
          if (attack) {
            if (
              ["lunge", "dash", "leap"].includes(attack.motion.kind) &&
              enemyMotionRemainingRef.current > 0
            ) {
              const derivedSpeed =
                attack.motion.speedX > 0
                  ? attack.motion.speedX
                  : Math.abs(attack.motion.distanceX) /
                    Math.max(0.08, attack.timing.activeMs / 1000);
              const step = Math.min(
                enemyMotionRemainingRef.current,
                derivedSpeed * deltaSeconds,
              );
              moveEnemy(enemyMotionDirectionRef.current * step);
              enemyMotionRemainingRef.current -= step;
            } else if (
              attack.motion.kind === "teleport" &&
              enemyMotionRemainingRef.current > 0
            ) {
              moveEnemy(
                enemyMotionDirectionRef.current * attack.motion.distanceX,
              );
              enemyMotionRemainingRef.current = 0;
            }

            if (!enemyHitAppliedRef.current && now >= enemyHitAtRef.current) {
              enemyHitAppliedRef.current = true;
              applyEnemyHit(attack);
            }
            if (now >= enemyPhaseEndsAtRef.current) {
              enterEnemyPhase("recover");
              enemyPhaseEndsAtRef.current =
                now +
                attack.timing.followThroughMs +
                attack.timing.recoveryMs;
            }
          } else {
            enterEnemyPhase("idle");
          }
        } else if (enemyAttackPhaseRef.current === "recover") {
          const attack = currentEnemyAttackRef.current;
          if (now >= enemyPhaseEndsAtRef.current) {
            enterEnemyPhase("idle");
            currentEnemyAttackRef.current = null;
            setCurrentEnemyAttack(null);
            const cadence =
              enemy.behavior.decisionIntervalMs /
              Math.max(0.55, enemy.behavior.aggression);
            enemyNextDecisionAtRef.current =
              now + Math.max(cadence, attack?.cooldownMs ?? 0);
          }
        }
      } else {
        enemyLastFrameAtRef.current = 0;
      }

      frame = window.requestAnimationFrame(tickEnemy);
    };

    frame = window.requestAnimationFrame(tickEnemy);
    return () => window.cancelAnimationFrame(frame);
  }, [finishGame, later]);

  useEffect(() => {
    window.render_game_to_text = () => {
      const gateScreen = clamp(
        Math.floor(gateXRef.current / GATE_SOURCE.width),
        0,
        GATE_SCREENS.length - 1,
      );
      return JSON.stringify({
        coordinateSystem:
          chapterRef.current === "gate"
            ? "雨蚀山门世界坐标：原点在连续施工图左上角，x向右，y向下；角色位置为脚底坐标"
            : "试玩关卡坐标：x为舞台宽度百分比，jumpY向上",
        mode: phaseRef.current,
        chapter: chapterRef.current,
        player:
          chapterRef.current === "gate"
              ? {
                worldX: Math.round(gateXRef.current),
                groundY: Math.round(gateGroundAt(gateXRef.current)),
                footY: Math.round(gateFootYRef.current),
                jumpY: Math.max(
                  0,
                  Math.round(
                    gateGroundAt(gateXRef.current) - gateFootYRef.current,
                  ),
                ),
                verticalVelocity: Number(gateVelocityYRef.current.toFixed(1)),
                jumpPeak: Math.round(gateJumpPeakRef.current),
                grounded: gateGroundedRef.current,
                screen: gateScreen + 1,
                screenName: GATE_SCREENS[gateScreen].name,
                facing: facingRef.current,
              }
            : {
                xPercent: Number(xRef.current.toFixed(1)),
                jumpY: Math.round(yRef.current),
                facing: facingRef.current,
              },
        hp: hpRef.current,
        spirit: spiritRef.current,
        enemyHp: chapterRef.current === "tutorial" ? enemyRef.current : null,
        enemy:
          chapterRef.current === "tutorial"
            ? {
                id: selectedEnemyIdRef.current,
                name: DEMO_ENEMIES[selectedEnemyIdRef.current].name,
                tier: DEMO_ENEMIES[selectedEnemyIdRef.current].tier,
                xPercent: Number(enemyXRef.current.toFixed(1)),
                hp: enemyRef.current,
                maxHp: DEMO_ENEMIES[selectedEnemyIdRef.current].hp,
                attackPhase: enemyAttackPhaseRef.current,
                currentAttack: currentEnemyAttackRef.current
                  ? {
                      id: currentEnemyAttackRef.current.id,
                      name: currentEnemyAttackRef.current.name,
                      kind: currentEnemyAttackRef.current.kind,
                      frequency: currentEnemyAttackRef.current.frequency,
                      effectOrigin: currentEnemyAttackRef.current.effectOrigin,
                      targetXPercent: Number(
                        enemyAttackTargetXRef.current.toFixed(1),
                      ),
                    }
                  : null,
              }
            : null,
        actionState: {
          locomotion,
          airState,
          landing: landingRef.current,
          rolling: rollingRef.current,
          attacking: attackRef.current,
          attackPending: attackPendingRef.current,
          heavyAttack: {
            phase: heavyAttackPhase,
            chargePercent: Math.round(heavyChargeRatio * 100),
            damage: Math.round(
              HEAVY_MIN_DAMAGE +
                (HEAVY_MAX_DAMAGE - HEAVY_MIN_DAMAGE) *
                  heavyChargeRatio,
            ),
            forwardRange: Number(
              (
                HEAVY_MIN_RANGE +
                (HEAVY_MAX_RANGE - HEAVY_MIN_RANGE) *
                  heavyChargeRatio
              ).toFixed(1),
            ),
          },
          automaticRecoveries: controlRecoveryCountRef.current,
          heldKeys: [...keys.current],
          focusedControl:
            document.activeElement instanceof HTMLElement
              ? document.activeElement.className || document.activeElement.tagName
              : null,
        },
        controls: "A/D移动，空格跳跃，K或Shift翻滚，J连斩，按住L蓄力重击，F全屏",
      });
    };
    window.advanceTime = (ms: number) => {
      if (phaseRef.current !== "playing") return;
      const frames = Math.max(1, Math.round(ms / (1000 / 60)));
      const left = keys.current.has("a") || keys.current.has("arrowleft");
      const right = keys.current.has("d") || keys.current.has("arrowright");
      if (chapterRef.current === "gate") {
        const horizontalSpeed = left === right ? 0 : right ? 7.2 : -7.2;
        if (horizontalSpeed !== 0) {
          const direction: Facing = right ? "right" : "left";
          facingRef.current = direction;
          setFacing(direction);
        }
        for (let frame = 0; frame < frames; frame += 1) {
          stepGatePhysics(1, horizontalSpeed);
        }
      } else if (left !== right) {
        const direction: Facing = right ? "right" : "left";
        facingRef.current = direction;
        setFacing(direction);
        xRef.current = clamp(
          xRef.current + (right ? 0.5 : -0.5) * frames,
          6,
          82,
        );
        setX(xRef.current);
      }
    };
    window.set_gate_pose = (worldX: number, footY?: number) => {
      const x = clamp(worldX, GATE_START_X, GATE_END_X);
      const groundedY = footY ?? gateGroundAt(x);
      gateXRef.current = x;
      gateFootYRef.current = groundedY;
      gateVelocityYRef.current = 0;
      gateGroundedRef.current = true;
      gateJumpOriginYRef.current = groundedY;
      gateMinFootYRef.current = groundedY;
      coyoteUntilRef.current = 0;
      setGateX(x);
      setGateFootY(groundedY);
      setAirState("grounded");
    };
    return () => {
      delete window.render_game_to_text;
      delete window.advanceTime;
      delete window.set_gate_pose;
    };
  }, [airState, heavyAttackPhase, heavyChargeRatio, locomotion, stepGatePhysics]);

  const hold = (key: string, pressed: boolean) => {
    if (pressed) keys.current.add(key);
    else keys.current.delete(key);
  };

  const actionClass = rolling
    ? "rolling"
    : attackStep
      ? `attacking combo-${attackStep}${attackStep === 3 ? ` heavy-${heavyAttackPhase}` : ""}${heavyChargeRatio >= 0.99 ? " heavy-full" : ""}`
      : airState === "rising"
        ? "jumping"
        : airState === "falling"
          ? "falling"
          : locomotion;

  const actionLabel = rolling
    ? "翻滚"
    : attackStep
      ? attackStep === 3
        ? heavyAttackPhase === "charging"
          ? `蓄势 ${Math.round(heavyChargeRatio * 100)}%`
          : "破墨重斩"
        : spirit <= 0
          ? "轻击"
          : `剑式 ${attackStep}`
      : airState === "rising"
        ? "踏墨"
        : airState === "falling"
          ? "落势"
          : landing
            ? "落定"
            : locomotion === "starting"
              ? "起势"
              : locomotion === "running"
                ? "疾行"
                : locomotion === "stopping"
                  ? "收势"
                  : "凝神";

  const gateScale = stageSize.height > 0 ? stageSize.height / GATE_SOURCE.height : 1;
  const gateWorldWidth = GATE_WORLD_WIDTH * gateScale;
  const gateCameraX = clamp(
    gateX * gateScale - stageSize.width * 0.34,
    0,
    Math.max(0, gateWorldWidth - stageSize.width),
  );
  const gatePlayerLeft = gateX * gateScale - gateCameraX;
  const gateGroundBottom = Math.max(
    0,
    stageSize.height - gateFootY * gateScale,
  );
  const gateScreenIndex = clamp(
    Math.floor(gateX / GATE_SOURCE.width),
    0,
    GATE_SCREENS.length - 1,
  );
  const playerStyle =
    chapter === "gate"
      ? ({
          left: `${gatePlayerLeft}px`,
          ["--air-y"]: "0px",
          ["--ground-bottom"]: `${gateGroundBottom}px`,
          ["--heavy-charge"]: `${Math.round(heavyChargeRatio * 100)}%`,
        } as CSSProperties)
      : ({
          left: `${x}%`,
          ["--air-y"]: `${y}px`,
          ["--heavy-charge"]: `${Math.round(heavyChargeRatio * 100)}%`,
        } as CSSProperties);
  const tierEnemies = DEMO_ENEMIES_BY_TIER[selectedTier];
  const enemyHealthPercent =
    selectedEnemy.hp > 0 ? (enemyHp / selectedEnemy.hp) * 100 : 0;
  const enemyBaseWidth = clamp(
    stageSize.width > 0 ? stageSize.width * 0.245 : 290,
    190,
    365,
  );
  const enemyVisualWidth = enemyBaseWidth * selectedEnemy.renderScale;
  const enemyVisualHeight = enemyVisualWidth / 1.5;
  const playerVisualWidth = clamp(
    stageSize.width > 0 ? stageSize.width * 0.24 : 270,
    190,
    360,
  );
  const playerVisualHeight = playerVisualWidth / 1.6;
  const enemyStyle = {
    left: `${enemyX}%`,
    width: `${enemyVisualWidth}px`,
    ["--enemy-foot-offset"]: `${selectedEnemy.footOffset}%`,
  } as CSSProperties;
  const effectOriginPreset = currentEnemyAttack
    ? EFFECT_ORIGIN_PRESETS[currentEnemyAttack.effectOrigin]
    : null;
  const effectFacingSign = enemyFacing === "right" ? 1 : -1;
  const effectOriginX = effectOriginPreset
    ? effectOriginPreset.reference === "stage"
      ? 50
      : effectOriginPreset.reference === "target"
        ? enemyAttackTargetX
        : enemyX +
          effectFacingSign *
            effectOriginPreset.forward *
            (enemyVisualWidth / Math.max(stageSize.width, 1)) *
            100
    : enemyX;
  const effectOriginBottom = effectOriginPreset
    ? effectOriginPreset.reference === "stage"
      ? stageSize.height * effectOriginPreset.height
      : (effectOriginPreset.reference === "target"
          ? playerVisualHeight
          : enemyVisualHeight) * effectOriginPreset.height
    : 0;
  const enemyEffectStyle = currentEnemyAttack && effectOriginPreset
    ? ({
        left: `${effectOriginX}%`,
        bottom: `calc(var(--stage-ground) + ${effectOriginBottom}px)`,
        width: `${enemyVisualWidth * 1.35 * effectOriginPreset.scale}px`,
        ["--effect-travel-x"]: `${
          ((effectOriginPreset.reference === "enemy"
            ? effectFacingSign * currentEnemyAttack.motion.distanceX
            : 0) /
            100) *
          stageSize.width
        }px`,
        ["--effect-active-ms"]: `${currentEnemyAttack.timing.activeMs}ms`,
      } as CSSProperties)
    : undefined;
  const enemyMotionClass = currentEnemyAttack
    ? `motion-${currentEnemyAttack.motion.kind}`
    : "";
  const intentKindLabel = currentEnemyAttack?.kind === "heavy" ? "重" : "轻";
  return (
    <main className="game-shell">
      <div className="paper-noise" aria-hidden="true" />
      <section className="game-frame" aria-label="墨境行者游戏区域">
        <header className="hud">
          <div className="brand-mark" aria-label="墨境行者">
            <span>墨境</span>
            <span>行者</span>
            <i>开卷</i>
          </div>
          <div className="vitals">
            <div className={`portrait ${playerHit ? "hit" : ""}`}>
              <img src="/assets/player.png" alt="水墨剑客头像" />
            </div>
            <div className="bars">
              <div className="bar health-bar">
                <span style={{ width: `${hp / 3.6}%` }} />
                <b>{hp} / 360</b>
              </div>
              <div className="bar spirit-bar">
                <span style={{ width: `${spirit / 1.2}%` }} />
                <b>{spirit} / 120</b>
              </div>
            </div>
          </div>
          <div className="resources">
            <div>
              <span>◉</span>
              <b>1250</b>
            </div>
            <div>
              <span>◌</span>
              <b>3</b>
            </div>
            <div>
              <span>♟</span>
              <b>2</b>
            </div>
          </div>
          <div className="quest-card">
            <small>当前目标</small>
            <strong>
              {chapter === "gate"
                ? `穿行雨蚀山门 · S${String(gateScreenIndex + 1).padStart(2, "0")}`
                : currentEnemyAttack
                  ? `${intentKindLabel}击 · ${currentEnemyAttack.name}`
                  : `${DEMO_TIER_LABELS[selectedEnemy.tier]} · ${selectedEnemy.name}`}
            </strong>
            <div className="seal-row">
              <i className="found">壹</i>
              <i>贰</i>
              <i>叁</i>
              <i>肆</i>
            </div>
          </div>
          <button
            className="sound-button"
            type="button"
            aria-label={muted ? "开启声音" : "关闭声音"}
            onClick={() => setMuted(!muted)}
          >
            {muted ? "静" : "声"}
          </button>
        </header>

        <div
          ref={stageRef}
          className={`stage ${chapter === "gate" ? "gate-stage" : "tutorial-stage"} ${heavyImpact ? "heavy-impacting" : ""}`}
        >
          {chapter === "gate" && (
            <div
              className="gate-world"
              aria-label="雨蚀山门连续十二屏实际场景"
              style={{
                width: `${gateWorldWidth}px`,
                transform: `translate3d(${-gateCameraX}px, 0, 0)`,
              }}
            >
              {GATE_ART_URLS.map((src, index) => (
                <img
                  key={src}
                  src={src}
                  alt={`S${String(index + 1).padStart(2, "0")} ${GATE_SCREENS[index].name}`}
                  draggable={false}
                  style={{ width: `${GATE_SOURCE.width * gateScale}px` }}
                />
              ))}
            </div>
          )}
          <div className="mist one" />
          <div className="mist two" />
          <div className="ink-specks">
            <i />
            <i />
            <i />
            <i />
            <i />
          </div>
          <div
            className={`player facing-${facing} ${actionClass} ${runningJump ? "running-jump" : ""} ${landing ? "landing" : ""} ${playerHit ? "damaged" : ""}`}
            style={playerStyle}
          >
            <div className="actor-visual">
              <img
                src="/assets/player-idle.png"
                alt="持剑的墨境行者"
                draggable={false}
              />
              <span className="run-sprite" aria-hidden="true" />
              <span className="attack-sprite" aria-hidden="true" />
              <span className="jump-sprite" aria-hidden="true" />
              <span className="roll-sprite" aria-hidden="true" />
              <span className="slash primary" />
              <span className="slash echo" />
              <span className="heavy-aura" aria-hidden="true" />
              <span className="heavy-shockwave" aria-hidden="true" />
            </div>
            <span className="roll-echo one" />
            <span className="roll-echo two" />
            <span className="landing-ink" />
            <span className="heavy-charge-meter" aria-hidden="true"><i /></span>
            <b className="action-label">{actionLabel}</b>
          </div>
          {chapter === "tutorial" && (
            <div
              className={`enemy demo-enemy enemy-facing-${enemyFacing} phase-${enemyAttackPhase} ${enemyMotionClass} ${enemyAttackPhase === "windup" ? "winding-up" : ""} ${enemyHit ? "hit" : ""} ${enemyHp === 0 ? "vanquished" : ""}`}
              data-enemy-id={selectedEnemy.id}
              data-enemy-tier={selectedEnemy.tier}
              style={enemyStyle}
            >
              <div className="enemy-bar">
                <span style={{ width: `${enemyHealthPercent}%` }} />
                <b>
                  {selectedEnemy.name} · {enemyHp} / {selectedEnemy.hp}
                </b>
              </div>
              <div
                className="enemy-intent"
                role="status"
                aria-live="polite"
                aria-atomic="true"
                data-kind={currentEnemyAttack?.kind ?? "none"}
              >
                {currentEnemyAttack && enemyAttackPhase !== "idle" ? (
                  <>
                    <span>{intentKindLabel}</span>
                    <strong>{currentEnemyAttack.name}</strong>
                    <small>{currentEnemyAttack.counterplay}</small>
                  </>
                ) : (
                  <span className="intent-idle">观察中</span>
                )}
              </div>
              <div className="enemy-visual">
                <img
                  key={selectedEnemy.id}
                  className="enemy-sprite"
                  src={selectedEnemy.spritePath}
                  alt={`${DEMO_TIER_LABELS[selectedEnemy.tier]} ${selectedEnemy.name}`}
                  draggable={false}
                />
              </div>
            </div>
          )}
          {chapter === "tutorial" &&
            currentEnemyAttack &&
            effectOriginPreset &&
            enemyAttackPhase === "active" && (
              <div
                key={`${selectedEnemy.id}-${currentEnemyAttack.id}`}
                className={`enemy-effect ${enemyMotionClass}`}
                style={enemyEffectStyle}
                data-origin={currentEnemyAttack.effectOrigin}
                data-align={effectOriginPreset.align}
                data-vertical={effectOriginPreset.vertical}
                data-facing={enemyFacing}
                aria-hidden="true"
              >
                <img src={currentEnemyAttack.effectPath} alt="" draggable={false} />
              </div>
            )}
          <div className="stage-caption">
            <span>{chapter === "gate" ? `S${String(gateScreenIndex + 1).padStart(2, "0")}` : "试玩"}</span>
            <strong>
              {chapter === "gate"
                ? `雨蚀山门 · ${GATE_SCREENS[gateScreenIndex].name}`
                : `敌人演武场 · ${selectedEnemy.name}`}
            </strong>
            {chapter === "gate" && gateScreenIndex >= 9 && <em>施工草图</em>}
          </div>

          {phase === "chapters" && (
            <div className="game-overlay chapter-overlay">
              <p className="eyebrow">墨境行者 · 章节选择</p>
              <h1>择卷入境</h1>
              <div className="chapter-list">
                <button type="button" className="chapter-card primary" onClick={() => chooseChapter("gate")}>
                  <small>第一卷 · 已开放</small>
                  <strong>雨蚀山门</strong>
                  <span>十二屏分层水墨实装 · S01–S12 可步行探索</span>
                  <i>进入章节</i>
                </button>
                <button type="button" className="chapter-card" onClick={() => chooseChapter("tutorial")}>
                  <small>独立练习</small>
                  <strong>敌人演武场</strong>
                  <span>十八名敌人可选 · 普通、精英与 Boss 攻击演示</span>
                  <i>选择对手</i>
                </button>
              </div>
            </div>
          )}
          {phase === "intro" && chapter === "gate" && (
            <div className="game-overlay intro-overlay">
              <button type="button" className="chapter-back" onClick={returnToChapters}>← 返回选卷</button>
              <p className="eyebrow">第一卷 · 场景 01</p>
              <h1>雨蚀山门</h1>
              <p>从破庙残院启程，沿施工图铺设的山道向东穿行。</p>
              <button
                type="button"
                className="start-button"
                onClick={start}
                disabled={!actionAssetsReady}
                aria-busy={!actionAssetsReady}
              >
                <span aria-live="polite">
                  {actionAssetsFailed
                    ? "动作素材载入失败"
                    : actionAssetsReady
                      ? "踏入山门"
                      : `研墨中 ${loadedActionAssets}/${ACTION_ASSET_URLS.length}`}
                </span>
                <small>{actionAssetsReady ? "ENTER" : "LOADING"}</small>
              </button>
              <div className="keyboard-guide">
                <span>
                  <kbd>A</kbd>
                  <kbd>D</kbd> 移动
                </span>
                <span>
                  <kbd>空格</kbd> 跳跃
                </span>
                <span>
                  <kbd>K</kbd> 翻滚
                </span>
                <span>
                  <kbd>J</kbd> 连斩
                </span>
                <span>
                  <kbd>L</kbd> 蓄力重击
                </span>
                <span>
                  <kbd>F</kbd> 全屏
                </span>
              </div>
            </div>
          )}
          {phase === "intro" && chapter === "tutorial" && (
            <div
              className="game-overlay enemy-select-overlay"
              aria-labelledby="enemy-select-title"
            >
              <button
                type="button"
                className="chapter-back"
                onClick={returnToChapters}
              >
                ← 返回选卷
              </button>
              <div className="enemy-select-heading">
                <p className="eyebrow">独立练习 · 十八敌演武</p>
                <h1 id="enemy-select-title">敌人演武场</h1>
                <p>择一对手，观察其行动、轻重预警与反击窗口。</p>
              </div>
              <div className="enemy-picker-drawer">
                <section className="enemy-picker" aria-label="选择演武对手">
                  <div
                    className="enemy-tier-tabs"
                    role="tablist"
                    aria-label="敌人类别"
                  >
                    {DEMO_TIER_ORDER.map((tier) => (
                      <button
                        key={tier}
                        id={`enemy-tier-${tier}`}
                        type="button"
                        role="tab"
                        aria-selected={selectedTier === tier}
                        aria-controls="enemy-option-panel"
                        className={selectedTier === tier ? "selected" : ""}
                        onClick={() => chooseEnemyTier(tier)}
                      >
                        <span>{DEMO_TIER_LABELS[tier]}</span>
                        <b>{DEMO_ENEMIES_BY_TIER[tier].length}</b>
                      </button>
                    ))}
                  </div>
                  <div
                    id="enemy-option-panel"
                    className="enemy-option-grid"
                    role="tabpanel"
                    aria-labelledby={`enemy-tier-${selectedTier}`}
                  >
                    {tierEnemies.map((enemy) => {
                      const isSelected = enemy.id === selectedEnemyId;
                      return (
                        <button
                          key={enemy.id}
                          type="button"
                          className={`enemy-option ${isSelected ? "selected" : ""}`}
                          aria-pressed={isSelected}
                          onClick={() => chooseEnemy(enemy.id)}
                        >
                          <i aria-hidden="true">{enemy.name.slice(0, 1)}</i>
                          <span>{enemy.name}</span>
                          {isSelected && <small>已选</small>}
                        </button>
                      );
                    })}
                  </div>
                </section>
                <aside className="enemy-selection-summary" aria-label="当前敌人说明">
                  <div className="enemy-summary-title">
                    <span>{DEMO_TIER_LABELS[selectedEnemy.tier]}</span>
                    <h2>{selectedEnemy.name}</h2>
                    <b>{selectedEnemy.attacks.length} 招</b>
                  </div>
                  <p>{selectedEnemy.behavior.description}</p>
                  <ul className="enemy-attack-list">
                    {selectedEnemy.attacks.map((attack) => (
                      <li key={attack.id} data-kind={attack.kind}>
                        <span>{attack.kind === "heavy" ? "重" : "轻"}</span>
                        <strong>{attack.name}</strong>
                        <small>
                          {attack.frequency === "common"
                            ? "常见"
                            : attack.frequency === "secondary"
                              ? "次常"
                              : "低频"} · {attack.weight}%
                        </small>
                      </li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    className="start-button enemy-start-button"
                    onClick={start}
                    disabled={!actionAssetsReady}
                    aria-busy={!actionAssetsReady}
                  >
                    <span aria-live="polite">
                      {actionAssetsFailed
                        ? "动作素材载入失败"
                        : actionAssetsReady
                          ? `挑战 ${selectedEnemy.name}`
                          : `研墨中 ${loadedActionAssets}/${ACTION_ASSET_URLS.length}`}
                    </span>
                    <small>{actionAssetsReady ? "ENTER" : "LOADING"}</small>
                  </button>
                </aside>
              </div>
            </div>
          )}
          {(phase === "victory" || phase === "defeat") && (
            <div className={`game-overlay result-overlay ${phase}`}>
              <div className="result-seal">
                {phase === "victory" ? "胜" : "败"}
              </div>
              <p>
                {phase === "victory"
                  ? chapter === "tutorial"
                    ? `${selectedEnemy.name}招式演示完成`
                    : "墨魇消散 · 获得「坎水墨印」"
                  : "心墨已竭 · 山河仍待重绘"}
              </p>
              <div className="result-actions">
                <button
                  type="button"
                  className="start-button compact"
                  onClick={start}
                >
                  {chapter === "tutorial"
                    ? "再战此敌"
                    : phase === "victory"
                      ? "再战一卷"
                      : "重整笔锋"}
                </button>
                {chapter === "tutorial" && (
                  <button
                    type="button"
                    className="result-secondary-button"
                    onClick={returnToEnemyPicker}
                  >
                    换一名敌人
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        <footer className="control-strip">
          <div className="desktop-controls">
            <span>
              <kbd>A</kbd>
              <kbd>D</kbd> 移动
            </span>
            <span>
              <kbd>SPACE</kbd> 跳跃
            </span>
            <span>
              <kbd>K</kbd> / <kbd>SHIFT</kbd> 翻滚
            </span>
            <span>
              <kbd>J</kbd> 二段连斩
            </span>
            <span>
              <kbd>L</kbd> 蓄力重击
            </span>
          </div>
          <p>
            {chapter === "gate"
              ? "角色脚底跟随施工图主路高程，镜头会跨越十二屏连续跟随。"
              : `${selectedEnemy.name} · ${selectedEnemy.behavior.description}`}
          </p>
          {phase === "playing" && (
            <button
              type="button"
              className={`chapter-menu-button ${chapter === "tutorial" ? "tutorial-switch" : ""}`}
              onClick={
                chapter === "tutorial" ? returnToEnemyPicker : returnToChapters
              }
            >
              {chapter === "tutorial" ? "换敌" : "选卷"}
            </button>
          )}
          <div
            className={`touch-controls ${phase !== "playing" ? "inactive" : ""}`}
            aria-label="触控操作"
            aria-hidden={phase !== "playing"}
          >
            <button
              type="button"
              aria-label="向左移动"
              disabled={phase !== "playing"}
              onPointerDown={() => hold("a", true)}
              onPointerUp={() => hold("a", false)}
              onPointerCancel={() => hold("a", false)}
              onPointerLeave={() => hold("a", false)}
            >
              ←
            </button>
            <button
              type="button"
              aria-label="向右移动"
              disabled={phase !== "playing"}
              onPointerDown={() => hold("d", true)}
              onPointerUp={() => hold("d", false)}
              onPointerCancel={() => hold("d", false)}
              onPointerLeave={() => hold("d", false)}
            >
              →
            </button>
            <button type="button" onClick={jump} disabled={phase !== "playing"}>
              跃
            </button>
            <button type="button" className="roll-touch" onClick={roll} disabled={phase !== "playing"}>
              闪
            </button>
            <button type="button" className="attack-touch" onClick={attack} disabled={phase !== "playing"}>
              斩
            </button>
            <button
              type="button"
              className="heavy-touch"
              disabled={phase !== "playing" || spirit < HEAVY_SPIRIT_COST}
              onPointerDown={beginHeavyAttack}
              onPointerUp={releaseHeavyAttack}
              onPointerCancel={releaseHeavyAttack}
              onPointerLeave={releaseHeavyAttack}
            >
              重
            </button>
          </div>
        </footer>
      </section>
    </main>
  );
}
