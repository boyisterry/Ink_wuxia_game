"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Phase = "intro" | "playing" | "victory" | "defeat";
type AirState = "grounded" | "rising" | "falling";
type Facing = "left" | "right";

const clamp = (n: number, min: number, max: number) =>
  Math.min(max, Math.max(min, n));

export default function Home() {
  const [phase, setPhase] = useState<Phase>("intro");
  const [x, setX] = useState(18);
  const [y, setY] = useState(0);
  const [hp, setHp] = useState(360);
  const [spirit, setSpirit] = useState(120);
  const [enemyHp, setEnemyHp] = useState(100);
  const [moving, setMoving] = useState(false);
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
  const enemyRef = useRef(100);
  const phaseRef = useRef<Phase>("intro");
  const movingRef = useRef(false);
  const facingRef = useRef<Facing>("right");
  const rollingRef = useRef(false);
  const rollDirection = useRef(1);
  const attackRef = useRef(false);
  const comboRef = useRef(0);
  const lastAttackAt = useRef(0);
  const timers = useRef<number[]>([]);

  const later = useCallback((fn: () => void, delay: number) => {
    const timer = window.setTimeout(fn, delay);
    timers.current.push(timer);
    return timer;
  }, []);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  useEffect(
    () => () => timers.current.forEach((timer) => window.clearTimeout(timer)),
    [],
  );

  const resetActions = useCallback(() => {
    keys.current.clear();
    movingRef.current = false;
    facingRef.current = "right";
    rollingRef.current = false;
    attackRef.current = false;
    comboRef.current = 0;
    setMoving(false);
    setFacing("right");
    setAirState("grounded");
    setRolling(false);
    setAttackStep(0);
    setLanding(false);
    setEnemyWindingUp(false);
  }, []);

  const start = useCallback(() => {
    xRef.current = 18;
    yRef.current = 0;
    velocity.current = 0;
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
      attackRef.current
    )
      return;
    rollingRef.current = true;
    rollDirection.current = facingRef.current === "right" ? 1 : -1;
    setRolling(true);
    setSpirit((value) => Math.max(0, value - 8));
    later(() => {
      rollingRef.current = false;
      setRolling(false);
    }, 430);
  }, [later]);

  const attack = useCallback(() => {
    if (
      phaseRef.current !== "playing" ||
      attackRef.current ||
      rollingRef.current
    )
      return;

    const now = performance.now();
    comboRef.current =
      now - lastAttackAt.current < 760 ? (comboRef.current % 3) + 1 : 1;
    lastAttackAt.current = now;
    const step = comboRef.current;
    const duration = step === 3 ? 480 : 360;
    attackRef.current = true;
    setAttackStep(step);
    setSpirit((value) => Math.max(0, value - (step === 3 ? 8 : 4)));

    later(
      () => {
        const range = step === 3 ? 30 : 24;
        if (Math.abs(xRef.current - 68) >= range || enemyRef.current <= 0)
          return;
        const damage = step === 3 ? 35 : step === 2 ? 25 : 20;
        const next = Math.max(0, enemyRef.current - damage);
        enemyRef.current = next;
        setEnemyHp(next);
        setEnemyHit(true);
        later(() => setEnemyHit(false), 170);
        if (next === 0) later(() => setPhase("victory"), 560);
      },
      step === 3 ? 230 : 155,
    );

    later(() => {
      attackRef.current = false;
      setAttackStep(0);
    }, duration);
  }, [later]);

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
          left !== right && !attackRef.current && !rollingRef.current;

        if (walking !== movingRef.current) {
          movingRef.current = walking;
          setMoving(walking);
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
            setLanding(true);
            later(() => setLanding(false), 300);
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
        Math.abs(xRef.current - 68) >= 13 ||
        enemyRef.current <= 0 ||
        rollingRef.current
      )
        return;
      setEnemyWindingUp(true);
      later(() => {
        setEnemyWindingUp(false);
        if (
          phaseRef.current !== "playing" ||
          rollingRef.current ||
          Math.abs(xRef.current - 68) >= 16
        )
          return;
        setHp((value) => {
          const next = Math.max(0, value - 45);
          setPlayerHit(true);
          later(() => setPlayerHit(false), 220);
          if (next === 0) setPhase("defeat");
          return next;
        });
      }, 360);
    }, 1450);
    return () => window.clearInterval(timer);
  }, [later]);

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
          : moving
            ? "running"
            : "idle";

  const actionLabel = rolling
    ? "翻滚"
    : attackStep
      ? attackStep === 3
        ? "破墨重斩"
        : `剑式 ${attackStep}`
      : airState === "rising"
        ? "踏墨"
        : airState === "falling"
          ? "落势"
          : moving
            ? "疾行"
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
              <kbd>J</kbd> 三段连斩
            </span>
          </div>
          <p>翻滚可闪避墨息，连续挥剑触发第三式重斩。</p>
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
