# 敌人攻击特效资产

本目录存放“敌人演武场”的 18 张攻击特效母版。每名敌人对应一张透明
PNG；具体招式通过位移、缩放、方向、闪烁与遮罩动画复用母版中的视觉语言。
`contact-sheet.jpg` 是 18 张透明成品在宣纸底色上的总览。

## 目录

- `combat/<enemy-id>.png`：游戏直接加载的 RGBA 透明图。
- `source/<enemy-id>-chroma.png`：保留的 ImageGen 纯色幕源图，便于后续美术重制。

`combat/` 当前包含：

- 普通敌人：`bamboo_blade`、`rooftop_bow`、`ink_crow`、`ink_spider`、
  `iron_shield`、`lantern_mage`、`ink_beast`、`chain_jailer`、`ink_eel`、
  `drowned_guard`
- 精英怪：`bridge_nightmare`、`lantern_adept`、`scarlet_captain`、
  `faceless_sword`、`lake_maiden`
- Boss：`tomb_warden`、`pine_nightmare`、`formless_lord`

## 透明化流程

源图统一使用纯绿或纯品红幕。单张重新处理：

```bash
python scripts/remove-enemy-effect-chroma.py \
  public/assets/enemies/effects/source/<enemy-id>-chroma.png \
  public/assets/enemies/effects/combat/<enemy-id>.png
```

处理脚本会从画布边缘自动识别幕色、生成软边 alpha，并对半透明边缘做去色，
避免在宣纸背景上出现绿色或品红色描边。

## ImageGen 提示词基线

所有母版均以对应待机 Sprite 作为调色与材质参考，并使用以下共同提示词：

> 透明就绪的横版 2D 攻击 VFX；只画特效，不画角色、场景、UI 或文字；
> 中国水墨动作游戏风格，小尺寸仍有清晰轮廓，侧视角、四周留空；使用整幅纯绿
> `#00FF00` 或纯品红 `#FF00FF` 色幕，不产生幕色溢出。

每名敌人的差异段分别指定其攻击语言，例如竹影刀客的半月刀弧、桥魇的墨爪与
断桥墨潮、剑冢狱主的锁链 / 断剑阵 / 墓印地裂，以及无相殿主的黑白十字剑痕与
水镜领域。完整视觉描述和招式对应关系见动作设计文档。

## 使用约束

- 选择器不批量预载这些高分辨率母版，只加载当前战斗敌人的文件。
- 生效帧使用 `.enemy-effect` 独立层，不能与敌人本体共用 `transform`。
- 轻击以短促、低覆盖率动画呈现；重击必须有更长前摇、范围扩张和第二次亮度峰值。
- 全部招式、概率、时间轴及玩家对策见 `docs/enemy-combat-demo-design.md`。
