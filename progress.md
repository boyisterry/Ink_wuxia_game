Original prompt: 好，你来增加一个纯美术预览开关

## 2026-08-06

- Completed: added a reversible pure-art preview mode to the S01 continuous construction map.
- Behavior: entering the mode focuses and crops to S01, fits the deep-ink artwork in the expanded center viewport, and hides side panels, status bar, grids, mist, construction bounds, architecture guides, collision, gameplay, camera, seams, and rulers.
- Behavior: exiting restores the continuous 12-screen canvas and preserves the user's previous layer selections.
- Browser verification: entry, exit, layer persistence, layout dimensions, overlay visibility, and console logs all passed in the in-app browser.
- Environment note: the required web-game Playwright client was attempted from an isolated `/tmp` install, but macOS sandboxing denied Chromium's Mach port registration; equivalent interaction and screenshot coverage was completed with the connected in-app browser.
- TODO: none for this feature.

## 2026-08-07 · S08/S09 seam

- User reported an unnecessary step at the J08 boundary between S08 and S09.
- Root cause: the route line descended immediately, but C67 was still a 260px-wide horizontal rectangular floor.
- Completed: replaced C67 with a continuous slope that starts at the J08 seam (Y597 target-space) and ends flush with C68 (Y826 target-space).
- Updated the J08 seam-road and physics-weld visualization so neither draws a false horizontal extension into S09.
- Added validation requiring the C67 slope endpoint to equal the C68 floor height.
- Visual QA: focused J08 screenshot confirms the extra platform is gone; C67 renders as `M30720 597L31317 826V2160H30720Z` and the browser reports no console errors.
- Verification: `npm run build` passed. `npm test` still has one unrelated, pre-existing world-map validation failure (76 rooms versus the historical expectation of 77, with four existing large-drop warnings).
- TODO: none for this seam fix.

## 2026-08-08 · Chapter selection and playable Gate region

- Current request: add chapter selection, rename the existing first-volume combat prototype to a beginner trial, and deploy Scene 01 “雨蚀山门” from the construction plan into the game so the character can walk through it.
- Implemented in progress: chapter menu with “第一卷 · 雨蚀山门” and “新手试玩关卡”; the original bridge combat is preserved as the tutorial choice.
- Implemented in progress: twelve-screen Gate runtime using detailed S01–S08 art and construction-sketch S09–S12 fallbacks, construction-derived surface elevations, a continuous camera, movement/jump/roll/attack animations, fullscreen, `render_game_to_text`, and deterministic `advanceTime` support.
- Completed: construction art fallback is explicit in the runtime; S09–S12 show a “施工草图” badge while S01–S08 use available layered ink artwork.
- Completed: fixed the S09 runtime ground resolver so the player follows the main arrow-gallery route at Y560 rather than snapping to the C75 fall-recovery floor at Y760.
- Completed QA: automated chapter selection and Gate traversal reached S01, S02, S03, S04, S05, S07, S09, and S12; screenshots confirm camera follow, construction-height grounding, jumping, finished-art/sketch transitions, and no new browser console errors.
- Completed QA: tutorial selection, movement, two-hit sword combo, enemy damage, player damage, and victory state passed; the original bridge battle now appears as “新手试玩关卡”.
- Completed QA: `npm run build` passes. `npm test` still has the unrelated pre-existing world-map validation failure: 76 rooms, four large-drop warnings, and `data-map-validation="warning"` where the historical test expects `valid`.
- Environment note: the required web-game client was run successfully against system Chrome outside the macOS sandbox after the bundled Chromium download stalled.
- TODO: replace S09–S12 sketch assets with final layered art as those screens are completed; no runtime code change is needed when filenames remain stable.

## 2026-08-08 · S09 entrance art correction

- Follow-up finding: the C67 collision and seam guide had been corrected, but the raster construction art `region-sketch/screens/s09.png` still contained the old 260px-wide horizontal entrance platform.
- Completed: edited the S09 raster so its left edge immediately descends from source Y260 to Y360, matching C67 and meeting C68 without a horizontal ledge.
- Added an S09-specific asset version query (`s09-entry-ramp-1`) so browsers do not retain the old PNG from cache.
- Visual QA: required Playwright client focused J08; the scene art, red route, green collision surface, and S08/S09 seam now share the same continuous descent. Production build passed.
- The Playwright client still reports the existing generic resource 404; no new compile or page-render errors were introduced.
- TODO: none for the S09 entrance-art correction.

## 2026-08-08 · J08 height weld and S09 art V1

- User identified that the S08 finished-art ground and the edited S09 sketch still appeared at different heights at J08, then requested S09 art production.
- Root cause: construction/collision coordinates already met at source Y260, but the prior AI-edited S09 sketch drew its extreme-left black ground edge roughly 10px too high.
- Completed: produced S09 finished-art V1 from the locked construction silhouette plus S08 as the style/seam reference. The new left edge begins at Y260 and immediately descends, so S08 art, S09 art, route, and collider meet at one point.
- Art direction: three descending rain pavilions, wet black tiles, arrow targets/scars, deep ink retaining walls, pale rain mountains, and distant gate silhouettes; no player/enemy/UI baked into the art.
- Added `s09-ink-background-layered-1672.png` for runtime and `s09-ink-background-layered-4k.png` for the construction map; S09 no longer displays the construction-sketch badge, which now starts at S10.
- Visual QA: required Playwright screenshots for J08 and focused S09 confirm the seam height and the foreground route/collider alignment. Production build passed.
- TODO: if further S09 art revisions are requested, split V1 into editable background/architecture/decoration/effects/foundation source layers before fine-detail iteration.

## 2026-08-08 · Gate jump and S07 stair physics

- Current request: increase the gameplay jump to match the designed reachable platforms and make the S07 ascent require jumping rather than automatic ground snapping.
- Implemented: Gate gameplay now tracks the player’s actual foot Y, vertical velocity, grounded state, platform tops, upward step blocking, falling, and one-way/platform landing in construction-source coordinates.
- Implemented: automatic walk-up is limited to 28 source pixels; the S07 rises of 70/80/90/50 source pixels therefore block normal walking and require jumps.
- Tuned: source-space launch velocity -18.5 with gravity 0.9 reaches a measured 181 source pixels, above the construction plan’s 170px baseline.
- Verified with the required browser game client: walking alone stops at the first S07 rise (`x=10545`, `footY=590`); four jumps climb the S07 staircase and reach S08 (`x=11819`, `footY=300`).
- Restored the S01/S02 construction-plan upper platforms as one-way landing surfaces; verified a jump from the S01 main path lands on C06 at `footY=600`.

## 2026-08-08 · Player control-lock recovery

- Current request: fix the player becoming permanently unresponsive after operating for a while.
- Root cause: landing, rolling, moving-attack preparation, and active attacks were unlocked only by delayed callbacks. If a browser delayed or invalidated one callback, the corresponding ref remained true permanently and every later input was rejected.
- Implemented: every transient control lock now has an explicit expiry deadline; the game loop and direct input handlers recover expired locks even if their normal callback never completes.
- Implemented: chapter/game resets and victory/defeat transitions clear every control-lock deadline together with existing timers.
- Gate stress QA: eight repeated run/attack/jump/roll cycles advanced continuously from S01 to S04; all lock flags were false at every cycle boundary, movement still worked after spirit reached zero, and no browser errors appeared.
- Tutorial shared-control QA: movement, moving attack, combo input, jump, landing, roll, and direction change all completed with every blocking flag released and no browser errors.
- Completed: production build passes after the control-lock recovery change.
- TODO: none for this fix.

## 2026-08-11 · Player charged heavy strike

- Current request: integrate the supplied protagonist charged-heavy animation and complete its VFX, damage, and hit range.
- Asset work: split the 4.06s / 97-frame green-screen source into transparent `player-heavy-charge.webp` (15 frames) and `player-heavy-release.webp` (18 frames), with green despill and the original ground-ink impact retained.
- Controls: hold `L` to charge, release to strike; touch controls gain a press-and-hold “重” button. The action costs 20 spirit and is unavailable below that amount.
- Combat tuning: damage scales from 54 to 86 and forward range from 30 to 40 tutorial-stage percentage points over a 1.1s full charge; the strike auto-releases after 1.5s.
- Hit rule: one hit is evaluated 420ms into the release, only in the character's facing direction, with a 1.5-point rear overlap tolerance for close contact.
- VFX: charge aura and meter, full-charge emphasis, source-animation ink impact, ground shockwave, enemy hit flash, and a short stage impact shake.
- QA so far: full charge dealt exactly 86 damage (260→174); 300ms partial charge dealt 63 (260→197); an enemy behind the facing direction took zero damage; six uses consumed 120 spirit and a seventh input at zero spirit was rejected. Screenshots and text state agreed, with no browser errors.
- Shared-control regression: after a heavy strike, Gate movement advanced to `worldX=1043`, jump peak remained 181, roll consumed its expected 8 spirit, and no attack/control lock remained.
- Completed: final production build passes; no browser/page/resource errors were reported in the required game-client runs.
- TODO: none for this feature.

## 2026-08-12 · Charged-heavy sprite scale and grounding

- Follow-up request: the heavy-strike animation made the whole actor appear smaller and float above the ground.
- Root cause: the video-derived heavy sheets retain more transparent capture space than the idle cutout, so fitting every frame into the same CSS box reduced the visible actor and left its source-frame bottom padding above the physics line.
- Fixed: the heavy sprite is uniformly scaled to 1.24× from its bottom-center anchor and receives a 20% downward visual offset. This changes only the artwork layer; the player foot coordinate and collision physics remain untouched.
- Visual QA: inspected matching Gate idle, 92% charge, full-charge release-impact, and post-release movement screenshots. The visible body now matches the normal actor scale, the feet/impact meet the ground art, and the player stays `grounded` with `footY=groundY=720` throughout.
- Control regression: after release, movement advanced from world X120 to X256; heavy state returned to idle, all input locks cleared, and no browser errors appeared.
- TODO: none for this fix.

## 2026-08-12 · Project footprint reduction phase 1

- Removed regenerable `dist/` and `.sites-runtime/` output/cache directories; `node_modules/` is retained so local development remains immediately runnable.
- Moved 254 MB of editable map layers, generated source images, enemy chroma sources, and documentation portraits from `public/` to `art-source/`. Composition scripts now read source material there and continue writing runtime composites to `public/assets/`.
- Canonicalized S02, S03, S07, and S10 runtime filenames and removed their byte-identical legacy variants, plus the duplicate shrine composite. This removes about 45 MB of duplicate production assets.
- Deployment-facing `public/` fell from 501 MB to 204 MB (about 59% smaller) without reducing visual resolution or changing runtime rendering.
- Validation: every composition `.mjs` passes `node --check`; `npm run build` passes; required browser-client checks passed for both the playable S01 scene and the S09 construction view, with no captured browser errors.
- Test status: 4 of 5 tests pass. The remaining failure is the pre-existing world-map validation warning (`76` rooms and two large-drop warnings) rather than an asset-cleanup regression.
- TODO for phase 2: convert large runtime PNG composites/sprites to WebP or AVIF, then window/lazy-load map screens and character actions to reduce initial network and decode cost.

## 2026-08-12 · Project footprint reduction phase 2

- Consolidated all editable and lossless original art under ignored `local-art-source/`: `editable/` contains layers/chroma/generated sources and `runtime-originals/assets/` contains lossless deployment masters. Git ignores the complete directory.
- Added a reproducible WebP pipeline: `npm run assets:optimize` generates only stale derivatives; `npm run assets:verify` validates all required assets, decodes every WebP, rejects raw PNG/JPEG in `public/assets/`, and now runs before every production build.
- Converted 86 lossless runtime images from 183.97 MiB PNG to 18.26 MiB WebP (90.1% smaller), preserving source dimensions and alpha. Including existing animation sheets, `public/assets/` now contains 100 verified WebP files totaling 24.62 MiB.
- Deployment-facing `public/` fell from 204 MB after phase 1 to 25 MB; the production `dist/` fell from roughly 241 MB to 30 MB.
- Runtime loading: Gate now mounts only the current screen plus a two-screen buffer on each side instead of all twelve map images. Only five core character images block entry; the remaining action sheets preload in the background.
- Visual QA: walked from S01 to S03 across dynamically mounted WebP screens; checked focused S09 4K construction art; checked Bridge Nightmare transparency and the active ink-claw effect. State output matched all screenshots and no browser/resource errors were captured.
- Verification: production build passes and the enemy asset contract test now validates RIFF/WEBP headers. Test suite returns to 4/5 passing; only the pre-existing world-map validation warning remains (76 rooms and two large-drop warnings).
- TODO: keep `local-art-source/` backed up outside Git. No further asset migration is required for normal builds.

## 2026-08-13 · Basic enemy two-skill contract

- Current request: every basic enemy must have exactly one normal attack skill (which may contain a combo) and one heavy attack skill.
- Implemented: all 10 basic enemies now expose exactly two attacks: a 75% common normal attack and a 25% low-frequency heavy attack. Movement, guarding, repositioning, enraging, and hit reactions remain behavior states rather than extra skills.
- Added: 10 distinct heavy attacks with 0.90–1.10s telegraphs, 46–58 damage, longer recovery/cooldowns, red danger signals, and range-specific counterplay.
- Updated: runtime validation now enforces the two-skill composition and 50 total arena attacks; both enemy design documents use the same rule and names.
- Added: a production-ready animation-generation prompt under every one of the 20 basic-enemy skills, with action-specific timing and poses plus shared constraints for identity, scale, grounding, root motion, chroma background, and separate gameplay VFX.
- Browser QA: all 10 basic enemies show exactly two skills in the picker with `light/75%` followed by `heavy/25%`; names, markers, and order match runtime data.
- Combat QA: forced and visually inspected Bamboo Blade's melee heavy, Rooftop Bow's projectile heavy, and Lantern Mage's ground-target heavy through windup, active VFX/damage, recovery, and return to idle. Damage was 48, 50, and 54 respectively; no browser errors occurred.
- Validation: production build passes; the enemy roster contract test passes and now asserts the two-skill composition. The suite remains 4/5 because of the pre-existing world-map warning (76 rooms versus the historical 77-room assertion and two existing large-drop warnings).
- Prompt refinement: expanded all 20 basic-enemy skill prompts into numbered fixed-camera storyboards with exact time ranges matching windup/active/follow-through/recovery, runtime movement descriptions, complete generation copy, and per-skill constraints.
- Locomotion prompts: added one loopable 24fps movement storyboard for each of the 10 basic enemies, including runtime speed, root-motion handling, body mechanics, and loop constraints.
- Hit-reaction prompts: added one timed hit-reaction storyboard for each basic enemy, including impact direction, recoil/knockback handoff to runtime logic, recovery pose, and anatomy/equipment constraints.
- Documentation contract check: 10 enemy prompt groups, 40 animation entries, and exactly 40 each of storyboard, movement, complete-prompt, and constraint fields.
- TODO: generate and integrate the 10 movement loops, 10 hit reactions, and 20 skill action sheets as art becomes available.

## 2026-08-15 · Consolidated pre-push verification

- Reviewed the complete dirty worktree before publication: runtime PNG/JPEG assets are replaced by verified WebP derivatives, editable/lossless art remains under ignored `local-art-source/`, and the basic-enemy two-skill/prompt documentation changes are included.
- Verification: `npm run build` passes and validates 100 WebP runtime assets totaling 24.62 MiB; `npm run lint` completes with zero errors and six existing `no-img-element` warnings.
- Test suite remains 4/5: the sole failure is the documented world-map validation warning (`76` rooms and two existing large-drop warnings), not an asset or enemy-combat regression.
- Required browser-client QA: entered Gate gameplay, moved and jumped from S01 into S02 with `jumpPeak=181`; entered the enemy arena, exercised movement, normal attack, charged heavy attack, and observed the Bridge Nightmare heavy telegraph. State output matched screenshots and no console/page errors were captured.
- Local Bamboo Blade storyboard and failed Dreamina-generation audit files remain ignored and are not part of the Git publication.
