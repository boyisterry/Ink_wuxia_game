"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Phase = "intro" | "playing" | "victory" | "defeat";
type AirState = "grounded" | "rising" | "falling";
type Facing = "left" | "right";
type Locomotion = "idle" | "starting" | "running" | "stopping";

const clamp = (n: number, min: number, max: number) =>
  Math.min(max, Math.max(min, n));

const ATTACK_DAMAGE = 22;
const COMBO_DAMAGE = 28;
const EXHAUSTED_DAMAGE_RATIO = 0.3;

export default function Home() {
  const [phase, setPhase] = useState<Phase>("intro");
  const [x, setX] = useState(18);
  const [y, setY] = useState(0);
  const [hp, setHp] = useState(360);
  const [spirit, setSpirit] = useState(120);
  const [enemyHp, setEnemyHp] = useState(100);
  const [locomotion, setLocomotion] = useState<Locomotion>("idle");
  const [facing, setFacing] = useState<Facing>("right");
  const [airState, setAirState] = useState<AirState>("grounded");
  const [rolling, setRolling] = useState(false);
  const [attackStep, setAttackStep] = useState(0);
  const [landing, setLanding] = useState(false);
  const [enemyHit, setEnemyHit] = useState(false);
  const [playerHit, setPlayerHit] = useState(false);
  const [enemyWindingUp, setEnemyWindingUp] = useState(false);
  const [muted, setMuted] = useState(false);

  const keys = useRef(new Set<string>());
  const xRef = useRef(18);
  const yRef = useRef(0);
  const velocity = useRef(0);
  const hpRef = useRef(360);
  const spiritRef = useRef(120);
  const enemyRef = useRef(100);
  const phaseRef = useRef<Phase>("intro");
  const movingRef = useRef(false);
  const locomotionToken = useRef(0);
  const facingRef = useRef<Facing>("right");
  const rollingRef = useRef(false);
  const rollDirection = useRef(1);
  const attackRef = useRef(false);
  const landingRef = useRef(false);
  const attackPendingRef = useRef(false);
  const currentAttackStep = useRef(0);
  const comboQueuedRef = useRef(false);
  const attackToken = useRef(0);
  const enemyAttackingRef = useRef(false);
  const timers = useRef<number[]>([]);

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

  useEffect(() => () => clearTimers(), [clearTimers]);

  const resetActions = useCallback(() => {
    clearTimers();
    keys.current.clear();
    movingRef.current = false;
    locomotionToken.current += 1;
    facingRef.current = "right";
    rollingRef.current = false;
    attackRef.current = false;
    landingRef.current = false;
    attackPendingRef.current = false;
    currentAttackStep.current = 0;
    comboQueuedRef.current = false;
    attackToken.current += 1;
    enemyAttackingRef.current = false;
    setLocomotion("idle");
    setFacing("right");
    setAirState("grounded");
    setRolling(false);
    setAttackStep(0);
    setLanding(false);
    setEnemyWindingUp(false);
  }, [clearTimers]);

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
      movingRef.current = false;
      enemyAttackingRef.current = false;
      clearTimers();
      setEnemyWindingUp(false);

      if (delay > 0) later(() => setPhase(outcome), delay);
      else setPhase(outcome);
    },
    [clearTimers, later],
  );

  const start = useCallback(() => {
    xRef.current = 18;
    yRef.current = 0;
    velocity.current = 0;
    hpRef.current = 360;
    spiritRef.current = 120;
    enemyRef.current = 100;
    resetActions();
    setX(18);
    setY(0);
    setHp(360);
    setSpirit(120);
    setEnemyHp(100);
    setEnemyHit(false);
    setPlayerHit(false);
    setPhase("playing");
  }, [resetActions]);

  const jump = useCallback(() => {
    if (
      phaseRef.current !== "playing" ||
      yRef.current > 1 ||
      rollingRef.current ||
      landingRef.current ||
      attackPendingRef.current ||
      attackRef.current
    )
      return;
    velocity.current = 18;
    setAirState("rising");
  }, []);

  const roll = useCallback(() => {
    if (
      phaseRef.current !== "playing" ||
      yRef.current > 1 ||
      rollingRef.current ||
      landingRef.current ||
      attackPendingRef.current ||
      attackRef.current ||
      spiritRef.current <= 0
    )
      return;
    rollingRef.current = true;
    rollDirection.current = facingRef.current === "right" ? 1 : -1;
    setRolling(true);
    spendSpirit(8);
    later(() => {
      rollingRef.current = false;
      setRolling(false);
    }, 430);
  }, [later, spendSpirit]);

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
    attackRef.current = true;
    currentAttackStep.current = 1;
    comboQueuedRef.current = false;
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

    later(() => {
      if (token === attackToken.current) dealDamage(firstDamage, 24);
    }, 300);

    later(() => {
      if (token !== attackToken.current) return;
      const canCombo =
        !exhausted && comboQueuedRef.current && spiritRef.current > 0;
      comboQueuedRef.current = false;
      if (canCombo) {
        currentAttackStep.current = 2;
        setAttackStep(2);
        spendSpirit(4);
        later(() => {
          if (token === attackToken.current) dealDamage(COMBO_DAMAGE, 27);
        }, 195);
        later(() => {
          if (token !== attackToken.current) return;
          attackRef.current = false;
          currentAttackStep.current = 0;
          setAttackStep(0);
        }, 440);
      } else {
        later(() => {
          if (token !== attackToken.current) return;
          attackRef.current = false;
          currentAttackStep.current = 0;
          setAttackStep(0);
        }, 150);
      }
    }, 450);
  }, [finishGame, later, spendSpirit]);

  const attack = useCallback(() => {
    if (
      phaseRef.current !== "playing" ||
      rollingRef.current ||
      landingRef.current
    )
      return;

    if (attackRef.current || attackPendingRef.current) {
      if (currentAttackStep.current <= 1 && spiritRef.current > 0)
        comboQueuedRef.current = true;
      return;
    }

    comboQueuedRef.current = false;
    if (movingRef.current || locomotion !== "idle") {
      attackPendingRef.current = true;
      movingRef.current = false;
      const token = ++locomotionToken.current;
      setLocomotion("stopping");
      later(() => {
        if (token !== locomotionToken.current || !attackPendingRef.current)
          return;
        beginAttack();
      }, 460);
      return;
    }

    beginAttack();
  }, [beginAttack, later, locomotion]);

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
        ].includes(key)
      )
        event.preventDefault();
      keys.current.add(key);
      if ([" ", "w", "arrowup"].includes(key) && !event.repeat) jump();
      if (key === "j" && !event.repeat) attack();
      if (["k", "shift"].includes(key) && !event.repeat) roll();
      if (key === "enter" && phaseRef.current !== "playing") start();
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
  }, [attack, jump, roll, start]);

  useEffect(() => {
    let frame = 0;
    let before = performance.now();
    const tick = (now: number) => {
      const delta = Math.min(2, (now - before) / 16.67);
      before = now;
      if (phaseRef.current === "playing") {
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
          xRef.current = clamp(
            xRef.current + (right ? 0.5 : -0.5) * delta,
            6,
            82,
          );
          setX(xRef.current);
        }

        if (rollingRef.current) {
          xRef.current = clamp(
            xRef.current + rollDirection.current * 1.08 * delta,
            6,
            82,
          );
          setX(xRef.current);
        }

        if (yRef.current > 0 || velocity.current !== 0) {
          yRef.current += velocity.current * delta;
          velocity.current -= 1.05 * delta;
          if (velocity.current < -1) setAirState("falling");
          if (yRef.current <= 0) {
            yRef.current = 0;
            velocity.current = 0;
            setAirState("grounded");
            landingRef.current = true;
            setLanding(true);
            later(() => {
              landingRef.current = false;
              setLanding(false);
            }, 320);
          }
          setY(yRef.current);
        }
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [later]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (
        phaseRef.current !== "playing" ||
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
            <strong>寻回散落的四方墨印</strong>
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

        <div className="stage">
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
            className={`player facing-${facing} ${actionClass} ${landing ? "landing" : ""} ${playerHit ? "damaged" : ""}`}
            style={{ left: `${x}%`, bottom: `calc(11% + ${y}px)` }}
          >
            <div className="actor-visual">
              <img
                src="/assets/player.png"
                alt="持剑的墨境行者"
                draggable={false}
              />
              <span className="run-sprite" aria-hidden="true" />
              <span className="attack-sprite" aria-hidden="true" />
              <span className="jump-sprite" aria-hidden="true" />
              <span className="slash primary" />
              <span className="slash echo" />
            </div>
            <span className="roll-echo one" />
            <span className="roll-echo two" />
            <span className="landing-ink" />
            <b className="action-label">{actionLabel}</b>
          </div>
          <div
            className={`enemy ${enemyWindingUp ? "winding-up" : ""} ${enemyHit ? "hit" : ""} ${enemyHp === 0 ? "vanquished" : ""}`}
          >
            <div className="enemy-bar">
              <span style={{ width: `${enemyHp}%` }} />
              <b>桥魇 · {enemyHp}</b>
            </div>
            <img src="/assets/enemy.png" alt="守桥墨灵" draggable={false} />
          </div>
          <div className="stage-caption">
            <span>第一卷</span>
            <strong>断桥 · 墨魇初现</strong>
          </div>

          {phase === "intro" && (
            <div className="game-overlay intro-overlay">
              <p className="eyebrow">二维水墨横版 · 动作原型</p>
              <h1>战墨破境</h1>
              <p>腾跃、翻滚、连斩，在墨息落下之前破境。</p>
              <button type="button" className="start-button" onClick={start}>
                <span>进入墨境</span>
                <small>ENTER</small>
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
            移动中攻击会先收步，连按两次可衔接第二式。灵力耗尽后无法翻滚，攻击仅剩轻击。
          </p>
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
