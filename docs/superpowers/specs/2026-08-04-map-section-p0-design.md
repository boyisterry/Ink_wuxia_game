# 2026-08-04 地图模拟器 P0：剖面骨架 + 图例图标

## Goal

Upgrade `/map` from side-by-side zone strips into a mountain **cross-section** with elongated per-zone X corridors, denser small rooms, and a toggleable **legend icon** layer.

## Chosen approach

**C — 剖面骨架 + 区内 X 拉长**

- Shared vertical mountain silhouette; zones nest and overlap on Y
- Each major zone keeps a long mid-layer exploration band (2–3 linked rooms on X)
- Upper/lower branches remain for roofs, shafts, water

## Scope

1. Rebuild zone/room/route coordinates for section layout
2. Expand each zone to **5–7** room nodes; mid-path X length increased
3. Add markers: shrine, mechanism, breakable, oneway, lift, underwater, ability
4. Toolbar legend toggles for marker visibility
5. Keep existing sidebar/detail UX and enemy filters

## Out of scope

Ink wash textures, fog animation, player-scale silhouettes (later).

## Success

Opening `/map` shows nested section geometry, readable mid-corridor length per zone, and switchable legend icons without losing pan/zoom.
