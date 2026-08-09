# S10 山门前庭 · 地表场景五层清单

画布为 `1672×941`，游戏导出尺寸为 `3840×2160`。

1. `layers/00-background-mountains.png`：雨雾山门、远城墙与冷灰山影。
2. `layers/20-background-architecture.png`：西侧断碑亭、东侧完整碑亭与低矮庭墙；C81/C82 落在自然檐面。
3. `layers/30-decoration.png`：碑片、湿草、排水罐、碎瓦与雨链；中央浅水战区保持清空。
4. `layers/40-effects.png`：斜雨与低雾；不再绘制中央水坑的反光和波纹特效。
5. `layers/50-foundation.png`：C76–C80 连续实体地基及 C83/C84 浅水边缘。

运行时固定加载 `../s10-ink-background-layered-v2-1672.png`；施工图固定加载 `../s10-ink-background-layered-v2-4k.png`，避免旧版同名图片被浏览器缓存。

## 施工锚点

- S09→S10：入口 `Y600`；S10→S11：出口 `Y590`。
- 中央浅水基底：`X660–1080 / Y610`，只降低移速，不改变角色落脚高度。
- 西碑亭屋面：`X220–500 / Y470`；东碑亭屋面：`X1170–1460 / Y455`。
- 美术不烘焙敌人、箭线、减速判定或文字标记。
