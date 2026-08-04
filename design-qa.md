# Design QA — 遭遇设计 v5

- Source visual truth: `/Users/li_air/Downloads/ChatGPT Image 2026年8月4日 14_03_16.png`
- Implementation screenshot: `/Volumes/T7/workspace/Ink_wuxia_game/Ink_wuxia_game/audit-map/encounter-v5-old-bell.jpg`
- Focused screenshots: `audit-map/encounter-v5-water.jpg`, `audit-map/encounter-v5-final-boss.jpg`
- Side-by-side comparison: `/Volumes/T7/workspace/Ink_wuxia_game/Ink_wuxia_game/qa-comparison-v5.jpg`
- Viewport: 1280 × 720 CSS px, device scale factor 1
- Source pixels: 1672 × 941, proportionally normalized into 1280 × 720
- Implementation pixels: 1280 × 720, no density normalization required
- State: desktop, 55% map zoom; old-town encounter selected, then water and final-boss focused states

## Findings

No remaining actionable P0/P1/P2 findings for the requested encounter-design scope.

## Full-view comparison evidence

- The reference remains the composition and topology target; the implementation intentionally remains a level-design whitebox.
- The new encounter panel occupies the existing inspector column and does not reduce the central map viewport or obscure architectural geometry.
- Enemy identity colors, route colors and ability/transport tokens remain distinct.

## Focused-region evidence

- Old bell: two waves, four units, trigger, position, lock, refresh rule and budget are visible in one inspector card.
- Water corridor: aquatic units appear in the submerged room with middle-water and bottom-water positions; aerial/land units are absent.
- Final boss: the dossier visibly lists hook, shock, double-jump, breath and water mechanics matching the map ability chain.

## Required fidelity surfaces

- Fonts and typography: encounter hierarchy uses the existing mono eyebrow/body system; W/B/count values scan separately from explanatory copy.
- Spacing and layout rhythm: wave rows, rule chips and unit rows fit the existing inspector rhythm without overlap.
- Colors and visual tokens: aquatic cyan, elite coral and boss red remain differentiated from route and marker colors.
- Image quality and asset fidelity: no new raster assets were required; the whitebox continues to use the existing real player silhouette and scalable map geometry.
- Copy and content: enemy tiers, water physics, ability names, rewards, triggers and refresh semantics are now internally consistent.

## Comparison history

- P1 — Water rooms used aerial/land enemies. Fixed with 墨鳞游魂 and 沉甲水卒; post-fix water screenshot shows only aquatic units.
- P1 — The ability-gate mage was simultaneously a basic and an elite. Fixed with a distinct 掌灯使 elite used only in reward encounters.
- P1 — Final boss mirrored abilities absent from the map chain. Fixed by rewriting all three phases around the five acquired abilities.
- P1 — Room deployments expressed type only. Fixed with structured encounter plans containing counts, waves, triggers, positions, lock, respawn and budget.
- P2 — Multi-axis reward fights could be read as simultaneous spawns. Fixed with explicit staged waves in old town, forest, cliff and palace.
- P2 — 沉水印 looked like a fourth terminal seal. Fixed by renaming it 水镜信物; final-boss reward is now 归途传送权限.

## Primary interactions and runtime checks

- Enemy filters: 17 / 17, including 10 basic, 4 elite and 3 boss entries.
- Room selection tested: old bell, water corridor, moon altar and final boss.
- Enemy dossier tested: 墨鳞游魂 and 无相殿主.
- Encounter cards tested for single-wave and two-wave rooms.
- Browser console: zero error-level entries.
- Production build: passed.

## Follow-up polish

- P3 — Add optional on-map spawn anchors once exact screen boundaries and camera volumes are authored.
- P3 — Calibrate B budgets with real combat telemetry after enemy prototypes exist.

final result: passed
