"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Phase = "intro" | "playing" | "victory" | "defeat";
const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

export default function Home() {
  const [phase, setPhase] = useState<Phase>("intro");
  const [x, setX] = useState(18);
  const [y, setY] = useState(0);
  const [hp, setHp] = useState(360);
  const [spirit, setSpirit] = useState(120);
  const [enemyHp, setEnemyHp] = useState(100);
  const [attacking, setAttacking] = useState(false);
  const [enemyHit, setEnemyHit] = useState(false);
  const [playerHit, setPlayerHit] = useState(false);
  const [muted, setMuted] = useState(false);
  const keys = useRef(new Set<string>());
  const xRef = useRef(18);
  const yRef = useRef(0);
  const velocity = useRef(0);
  const enemyRef = useRef(100);
  const phaseRef = useRef<Phase>("intro");

  useEffect(() => { phaseRef.current = phase; }, [phase]);

  const start = useCallback(() => {
    xRef.current = 18; yRef.current = 0; velocity.current = 0; enemyRef.current = 100;
    setX(18); setY(0); setHp(360); setSpirit(120); setEnemyHp(100);
    setAttacking(false); setEnemyHit(false); setPlayerHit(false); setPhase("playing");
  }, []);

  const jump = useCallback(() => {
    if (phaseRef.current === "playing" && yRef.current <= 1) velocity.current = 17;
  }, []);

  const attack = useCallback(() => {
    if (phaseRef.current !== "playing" || attacking) return;
    setAttacking(true);
    setSpirit((n) => Math.max(0, n - 4));
    if (Math.abs(xRef.current - 68) < 22) {
      const next = Math.max(0, enemyRef.current - 25);
      enemyRef.current = next; setEnemyHp(next); setEnemyHit(true);
      window.setTimeout(() => setEnemyHit(false), 180);
      if (next === 0) window.setTimeout(() => setPhase("victory"), 520);
    }
    window.setTimeout(() => setAttacking(false), 360);
  }, [attacking]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (["a", "d", " ", "j", "arrowleft", "arrowright"].includes(k)) e.preventDefault();
      keys.current.add(k);
      if ([" ", "w", "arrowup"].includes(k)) jump();
      if (k === "j") attack();
      if (k === "enter" && phaseRef.current !== "playing") start();
    };
    const up = (e: KeyboardEvent) => keys.current.delete(e.key.toLowerCase());
    window.addEventListener("keydown", down); window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  }, [attack, jump, start]);

  useEffect(() => {
    let frame = 0; let before = performance.now();
    const tick = (now: number) => {
      const delta = Math.min(2, (now - before) / 16.67); before = now;
      if (phaseRef.current === "playing") {
        const left = keys.current.has("a") || keys.current.has("arrowleft");
        const right = keys.current.has("d") || keys.current.has("arrowright");
        if (left !== right) { xRef.current = clamp(xRef.current + (right ? .48 : -.48) * delta, 6, 82); setX(xRef.current); }
        if (yRef.current > 0 || velocity.current !== 0) {
          yRef.current += velocity.current * delta; velocity.current -= 1.05 * delta;
          if (yRef.current <= 0) { yRef.current = 0; velocity.current = 0; }
          setY(yRef.current);
        }
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick); return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (phaseRef.current !== "playing" || Math.abs(xRef.current - 68) >= 12) return;
      setHp((value) => {
        const next = Math.max(0, value - 45); setPlayerHit(true);
        window.setTimeout(() => setPlayerHit(false), 220);
        if (next === 0) setPhase("defeat"); return next;
      });
    }, 1250);
    return () => window.clearInterval(timer);
  }, []);

  const hold = (key: string, pressed: boolean) => pressed ? keys.current.add(key) : keys.current.delete(key);

  return (
    <main className="game-shell">
      <div className="paper-noise" aria-hidden="true" />
      <section className="game-frame" aria-label="墨境行者游戏区域">
        <header className="hud">
          <div className="brand-mark" aria-label="墨境行者"><span>墨境</span><span>行者</span><i>开卷</i></div>
          <div className="vitals">
            <div className={`portrait ${playerHit ? "hit" : ""}`}><img src="/assets/player.png" alt="水墨剑客头像" /></div>
            <div className="bars">
              <div className="bar health-bar"><span style={{width:`${hp/3.6}%`}} /><b>{hp} / 360</b></div>
              <div className="bar spirit-bar"><span style={{width:`${spirit/1.2}%`}} /><b>{spirit} / 120</b></div>
            </div>
          </div>
          <div className="resources"><div><span>◉</span><b>1250</b></div><div><span>◌</span><b>3</b></div><div><span>♟</span><b>2</b></div></div>
          <div className="quest-card"><small>当前目标</small><strong>寻回散落的四方墨印</strong><div className="seal-row"><i className="found">壹</i><i>贰</i><i>叁</i><i>肆</i></div></div>
          <button className="sound-button" type="button" aria-label={muted?"开启声音":"关闭声音"} onClick={()=>setMuted(!muted)}>{muted?"静":"声"}</button>
        </header>

        <div className="stage">
          <div className="mist one"/><div className="mist two"/><div className="ink-specks"><i/><i/><i/><i/><i/></div>
          <div className={`player ${attacking?"attacking":""} ${playerHit?"damaged":""}`} style={{left:`${x}%`,bottom:`calc(11% + ${y}px)`}}>
            <img src="/assets/player.png" alt="持剑的墨境行者" draggable={false}/><span className="slash"/>
          </div>
          <div className={`enemy ${enemyHit?"hit":""} ${enemyHp===0?"vanquished":""}`}>
            <div className="enemy-bar"><span style={{width:`${enemyHp}%`}}/><b>桥魇 · {enemyHp}</b></div>
            <img src="/assets/enemy.png" alt="守桥墨灵" draggable={false}/>
          </div>
          <div className="stage-caption"><span>第一卷</span><strong>断桥 · 墨魇初现</strong></div>

          {phase === "intro" && <div className="game-overlay intro-overlay">
            <p className="eyebrow">二维水墨横版 · 可玩原型</p><h1>战墨破境</h1><p>执一笔为剑，踏入正在褪色的山河。</p>
            <button type="button" className="start-button" onClick={start}><span>进入墨境</span><small>ENTER</small></button>
            <div className="keyboard-guide"><span><kbd>A</kbd><kbd>D</kbd> 移动</span><span><kbd>空格</kbd> 跳跃</span><span><kbd>J</kbd> 挥剑</span></div>
          </div>}
          {(phase === "victory" || phase === "defeat") && <div className={`game-overlay result-overlay ${phase}`}>
            <div className="result-seal">{phase==="victory"?"胜":"败"}</div><p>{phase==="victory"?"墨魇消散 · 获得「坎水墨印」":"心墨已竭 · 山河仍待重绘"}</p>
            <button type="button" className="start-button compact" onClick={start}>{phase==="victory"?"再战一卷":"重整笔锋"}</button>
          </div>}
        </div>

        <footer className="control-strip">
          <div className="desktop-controls"><span><kbd>A</kbd><kbd>D</kbd> 移动</span><span><kbd>SPACE</kbd> 跳跃</span><span><kbd>J</kbd> 挥剑</span></div>
          <p>靠近墨灵后挥剑；注意它的墨息反击。</p>
          <div className="touch-controls" aria-label="触控操作">
            <button type="button" aria-label="向左移动" onPointerDown={()=>hold("a",true)} onPointerUp={()=>hold("a",false)} onPointerLeave={()=>hold("a",false)}>←</button>
            <button type="button" aria-label="向右移动" onPointerDown={()=>hold("d",true)} onPointerUp={()=>hold("d",false)} onPointerLeave={()=>hold("d",false)}>→</button>
            <button type="button" onClick={jump}>跃</button><button type="button" className="attack-touch" onClick={attack}>斩</button>
          </div>
        </footer>
      </section>
    </main>
  );
}
