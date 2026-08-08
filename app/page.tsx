"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { ADDITIONAL_GATE_CONSTRUCTION } from "./map/gate/construction";
import { GATE_SCREENS } from "./map/gate/screens";

type Phase = "chapters" | "intro" | "playing" | "victory" | "defeat";
type Chapter = "tutorial" | "gate";
type AirState = "grounded" | "rising" | "falling";
type Facing = "left" | "right";
type Locomotion = "idle" | "starting" | "running" | "stopping";

const clamp = (n: number, min: number, max: number) =>
  Math.min(max, Math.max(min, n));

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
const ACTION_ASSET_URLS = [
  "/assets/player.png",
  "/assets/player-idle.png",
  "/assets/player-run-start.webp",
  "/assets/player-run-loop.webp",
  "/assets/player-run-stop.webp",
  "/assets/player-attack-1.webp",
  "/assets/player-attack-2.webp",
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
/** Walking step-up only. Must stay well below a standing jump (~180px). */
const GATE_AUTO_STEP_HEIGHT = 28;
const GATE_JUMP_VELOCITY = -18.5;
const GATE_GRAVITY = 0.9;
/** Theoretical apex: v^2 / 2g ≈ 190px; discrete integration peaks nearer ~180px. */
const GATE_MAX_JUMP_HEIGHT =
  (GATE_JUMP_VELOCITY * GATE_JUMP_VELOCITY) / (2 * GATE_GRAVITY);
const GATE_ART_URLS = GATE_SCREENS.map((screen, index) =>
  index < 9
    ? `/assets/maps/gate/${screen.id}-ink-background-layered-1672.png${screen.id === "s09" ? "?v=s09-art-v1" : ""}`
    : `/assets/maps/gate/region-sketch/screens/${screen.id}.png`,
);

type RuntimeGround = {
  x: number;
  y: number;
  w: number;
  slopeEndY?: number;
};

const GATE_SURFACE_GROUND: readonly RuntimeGround[] = [
  { x: 0, y: 720, w: 1180 },
  { x: 1180, y: 700, w: 170 },
  { x: 1350, y: 674, w: 322 },
  { x: 500, y: 600, w: 230 },
  { x: 775, y: 542, w: 225 },
  { x: 1045, y: 478, w: 250 },
  { x: 1672, y: 674, w: 720 },
  { x: 2392, y: 660, w: 180 },
  { x: 2572, y: 646, w: 200 },
  { x: 2772, y: 632, w: 572 },
  { x: 1932, y: 540, w: 250 },
  { x: 2492, y: 505, w: 270 },
  { x: 2202, y: 590, w: 170 },
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
        slopeEndY: collider.slopeEndY,
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

declare global {
  interface Window {
    render_game_to_text?: () => string;
    advanceTime?: (ms: number) => void;
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
  const [enemyHp, setEnemyHp] = useState(100);
  const [locomotion, setLocomotion] = useState<Locomotion>("idle");
  const [facing, setFacing] = useState<Facing>("right");
  const [airState, setAirState] = useState<AirState>("grounded");
  const [runningJump, setRunningJump] = useState(false);
  const [rolling, setRolling] = useState(false);
  const [attackStep, setAttackStep] = useState(0);
  const [landing, setLanding] = useState(false);
  const [enemyHit, setEnemyHit] = useState(false);
  const [playerHit, setPlayerHit] = useState(false);
  const [enemyWindingUp, setEnemyWindingUp] = useState(false);
  const [muted, setMuted] = useState(false);
  const [loadedActionAssets, setLoadedActionAssets] = useState(0);
  const [actionAssetsReady, setActionAssetsReady] = useState(false);
  const [actionAssetsFailed, setActionAssetsFailed] = useState(false);

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
  const enemyRef = useRef(100);
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
  const enemyAttackingRef = useRef(false);
  const timers = useRef<number[]>([]);
  const landingUntilRef = useRef(0);
  const rollingUntilRef = useRef(0);
  const attackPendingUntilRef = useRef(0);
  const attackUntilRef = useRef(0);
  const controlRecoveryCountRef = useRef(0);

  const clearTimers = useCallback(() => {
    timers.current.forEach((timer) => window.clearTimeout(timer));
    timers.current = [];
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
    enemyAttackingRef.current = false;
    landingUntilRef.current = 0;
    rollingUntilRef.current = 0;
    attackPendingUntilRef.current = 0;
    attackUntilRef.current = 0;
    setLocomotion("idle");
    setFacing("right");
    setAirState("grounded");
    setRunningJump(false);
    setRolling(false);
    setAttackStep(0);
    setLanding(false);
    setEnemyWindingUp(false);
  }, [clearTimers]);

  const recoverExpiredControlLocks = useCallback((now = performance.now()) => {
    let recovered = false;

    if (
      landingRef.current &&
      landingUntilRef.current > 0 &&
      now >= landingUntilRef.current
    ) {
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
      setAttackStep(0);
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
      enemyAttackingRef.current = false;
      landingUntilRef.current = 0;
      rollingUntilRef.current = 0;
      attackPendingUntilRef.current = 0;
      attackUntilRef.current = 0;
      clearTimers();
      setEnemyWindingUp(false);

      if (delay > 0) later(() => setPhase(outcome), delay);
      else setPhase(outcome);
    },
    [clearTimers, later],
  );

  const start = useCallback(() => {
    if (!actionAssetsReady) return;
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
    enemyRef.current = 100;
    resetActions();
    setX(18);
    setY(0);
    setGateX(GATE_START_X);
    setGateFootY(gateGroundAt(GATE_START_X));
    setHp(360);
    setSpirit(120);
    setEnemyHp(100);
    setEnemyHit(false);
    setPlayerHit(false);
    setPhase("playing");
  }, [actionAssetsReady, resetActions]);

  const chooseChapter = useCallback((nextChapter: Chapter) => {
    chapterRef.current = nextChapter;
    setChapter(nextChapter);
    setPhase("intro");
  }, []);

  const returnToChapters = useCallback(() => {
    resetActions();
    phaseRef.current = "chapters";
    setPhase("chapters");
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
            // Floor dropped away, or only high ledges exist ahead.
            // Fall under those ledges — do not walk-teleport upward onto them.
            nextX = candidateX;
            grounded = false;
            gateVelocityYRef.current = 0;
            gateMinFootYRef.current = currentFootY;
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
            setAirState("grounded");
            landingRef.current = true;
            landingUntilRef.current = performance.now() + 450;
            setLanding(true);
            later(() => {
              landingRef.current = false;
              landingUntilRef.current = 0;
              setLanding(false);
              runningJumpRef.current = false;
              setRunningJump(false);
            }, 220);
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
    [later],
  );

  const jump = useCallback(() => {
    recoverExpiredControlLocks();
    const inGate = chapterRef.current === "gate";
    if (
      phaseRef.current !== "playing" ||
      (inGate ? !gateGroundedRef.current : yRef.current > 1) ||
      rollingRef.current ||
      landingRef.current ||
      attackPendingRef.current ||
      attackRef.current
    )
      return;
    const left = keys.current.has("a") || keys.current.has("arrowleft");
    const right = keys.current.has("d") || keys.current.has("arrowright");
    const fromRun = movingRef.current || left !== right;
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
  }, [recoverExpiredControlLocks]);

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
        Math.abs(xRef.current - 68) >= range ||
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
      if (["k", "shift"].includes(key) && !event.repeat) roll();
      if (key === "enter" && ["intro", "victory", "defeat"].includes(phaseRef.current)) start();
      if (key === "escape" && phaseRef.current === "intro") returnToChapters();
      if (key === "f" && !event.repeat) {
        if (document.fullscreenElement) void document.exitFullscreen();
        else void document.documentElement.requestFullscreen();
      }
    };
    const up = (event: KeyboardEvent) =>
      keys.current.delete(event.key.toLowerCase());
    const blur = () => keys.current.clear();
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
  }, [attack, jump, returnToChapters, roll, start]);

  useEffect(() => {
    let frame = 0;
    let before = performance.now();
    const tick = (now: number) => {
      const delta = Math.min(2, (now - before) / 16.67);
      before = now;
      if (phaseRef.current === "playing") {
        recoverExpiredControlLocks(now);
        const left = keys.current.has("a") || keys.current.has("arrowleft");
        const right = keys.current.has("d") || keys.current.has("arrowright");
        const walking =
          left !== right &&
          !attackRef.current &&
          !attackPendingRef.current &&
          !landingRef.current &&
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
            landingRef.current = true;
            landingUntilRef.current = performance.now() + 600;
            setLanding(true);
            later(() => {
              landingRef.current = false;
              landingUntilRef.current = 0;
              setLanding(false);
              const left =
                keys.current.has("a") || keys.current.has("arrowleft");
              const right =
                keys.current.has("d") || keys.current.has("arrowright");
              if (runningJumpRef.current && left !== right) {
                movingRef.current = true;
                locomotionToken.current += 1;
                setLocomotion("running");
              }
              runningJumpRef.current = false;
              setRunningJump(false);
            }, 320);
          }
          setY(yRef.current);
        }
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [later, recoverExpiredControlLocks, stepGatePhysics]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (
        phaseRef.current !== "playing" ||
        chapterRef.current !== "tutorial" ||
        enemyAttackingRef.current ||
        Math.abs(xRef.current - 68) >= 13 ||
        enemyRef.current <= 0 ||
        rollingRef.current
      )
        return;
      enemyAttackingRef.current = true;
      setEnemyWindingUp(true);
      later(() => {
        setEnemyWindingUp(false);
        const stillPlaying = phaseRef.current === "playing";
        const inRange =
          stillPlaying &&
          enemyRef.current > 0 &&
          !rollingRef.current &&
          Math.abs(xRef.current - 68) < 16;
        if (inRange) {
          const next = Math.max(0, hpRef.current - 45);
          hpRef.current = next;
          setHp(next);
          setPlayerHit(true);
          later(() => setPlayerHit(false), 220);
          if (next === 0) finishGame("defeat");
        }
        enemyAttackingRef.current = false;
      }, 360);
    }, 1450);
    return () => window.clearInterval(timer);
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
        actionState: {
          locomotion,
          airState,
          landing: landingRef.current,
          rolling: rollingRef.current,
          attacking: attackRef.current,
          attackPending: attackPendingRef.current,
          automaticRecoveries: controlRecoveryCountRef.current,
          heldKeys: [...keys.current],
          focusedControl:
            document.activeElement instanceof HTMLElement
              ? document.activeElement.className || document.activeElement.tagName
              : null,
        },
        controls: "A/D移动，空格跳跃，K或Shift翻滚，J连斩，F全屏",
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
    return () => {
      delete window.render_game_to_text;
      delete window.advanceTime;
    };
  }, [airState, locomotion, stepGatePhysics]);

  const hold = (key: string, pressed: boolean) => {
    if (pressed) keys.current.add(key);
    else keys.current.delete(key);
  };

  const actionClass = rolling
    ? "rolling"
    : attackStep
      ? `attacking combo-${attackStep}`
      : airState === "rising"
        ? "jumping"
        : airState === "falling"
          ? "falling"
          : locomotion;

  const actionLabel = rolling
    ? "翻滚"
    : attackStep
      ? attackStep === 3
        ? "破墨重斩"
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
        } as CSSProperties)
      : ({ left: `${x}%`, ["--air-y"]: `${y}px` } as CSSProperties);
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
                : "熟悉移动、翻滚与二段剑式"}
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
          className={`stage ${chapter === "gate" ? "gate-stage" : "tutorial-stage"}`}
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
            </div>
            <span className="roll-echo one" />
            <span className="roll-echo two" />
            <span className="landing-ink" />
            <b className="action-label">{actionLabel}</b>
          </div>
          {chapter === "tutorial" && (
            <div
              className={`enemy ${enemyWindingUp ? "winding-up" : ""} ${enemyHit ? "hit" : ""} ${enemyHp === 0 ? "vanquished" : ""}`}
            >
              <div className="enemy-bar">
                <span style={{ width: `${enemyHp}%` }} />
                <b>桥魇 · {enemyHp}</b>
              </div>
              <img src="/assets/enemy.png" alt="守桥墨灵" draggable={false} />
            </div>
          )}
          <div className="stage-caption">
            <span>{chapter === "gate" ? `S${String(gateScreenIndex + 1).padStart(2, "0")}` : "试玩"}</span>
            <strong>
              {chapter === "gate"
                ? `雨蚀山门 · ${GATE_SCREENS[gateScreenIndex].name}`
                : "新手试玩关卡 · 断桥墨魇"}
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
                  <span>依照连续施工图实装 · S01–S12 可步行探索</span>
                  <i>进入章节</i>
                </button>
                <button type="button" className="chapter-card" onClick={() => chooseChapter("tutorial")}>
                  <small>独立练习</small>
                  <strong>新手试玩关卡</strong>
                  <span>断桥对战原型 · 移动、翻滚、跳跃与连斩</span>
                  <i>开始试玩</i>
                </button>
              </div>
            </div>
          )}
          {phase === "intro" && (
            <div className="game-overlay intro-overlay">
              <button type="button" className="chapter-back" onClick={returnToChapters}>← 返回选卷</button>
              <p className="eyebrow">{chapter === "gate" ? "第一卷 · 场景 01" : "独立动作练习"}</p>
              <h1>{chapter === "gate" ? "雨蚀山门" : "新手试玩"}</h1>
              <p>
                {chapter === "gate"
                  ? "从破庙残院启程，沿施工图铺设的山道向东穿行。"
                  : "腾跃、翻滚、连斩，在墨息落下之前击破桥魇。"}
              </p>
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
                      ? chapter === "gate" ? "踏入山门" : "开始试玩"
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
                  <kbd>F</kbd> 全屏
                </span>
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
                  ? "墨魇消散 · 获得「坎水墨印」"
                  : "心墨已竭 · 山河仍待重绘"}
              </p>
              <button
                type="button"
                className="start-button compact"
                onClick={start}
              >
                {phase === "victory" ? "再战一卷" : "重整笔锋"}
              </button>
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
          </div>
          <p>
            {chapter === "gate"
              ? "角色脚底跟随施工图主路高程，镜头会跨越十二屏连续跟随。"
              : "移动中攻击会先收步，连按两次可衔接第二式。灵力耗尽后无法翻滚。"}
          </p>
          <button type="button" className="chapter-menu-button" onClick={returnToChapters}>
            选卷
          </button>
          <div className="touch-controls" aria-label="触控操作">
            <button
              type="button"
              aria-label="向左移动"
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
              onPointerDown={() => hold("d", true)}
              onPointerUp={() => hold("d", false)}
              onPointerCancel={() => hold("d", false)}
              onPointerLeave={() => hold("d", false)}
            >
              →
            </button>
            <button type="button" onClick={jump}>
              跃
            </button>
            <button type="button" className="roll-touch" onClick={roll}>
              闪
            </button>
            <button type="button" className="attack-touch" onClick={attack}>
              斩
            </button>
          </div>
        </footer>
      </section>
    </main>
  );
}
