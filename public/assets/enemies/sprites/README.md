# 敌人游戏内 2D 造型

这套资源用于横版 2D 战斗场景，与宣传画像、说明手册画像分开保存。

## 目录

- `idle/`：已去底的 RGBA PNG，作为角色待机造型和后续动画的身份基准。
- `source/`：ImageGen 输出的色键源图，用于返修边缘、重新抠图或生成动作变体。
- 宣传与手册画像仍位于 `public/assets/enemies/portraits/`。

## 统一规范

- 视角：横版严格侧视，默认朝左面对玩家。
- 构图：单一角色、完整身体与武器、脚底或身体最低点对齐基线。
- 风格：与 `public/assets/player-idle.png` 一致的高细节手绘水墨造型。
- 色彩：灰黑主体、浅色边缘、少量朱红或区域色作为弱点和辨识点。
- 当前状态：仅完成基础战斗待机造型；未制作行走、受击、攻击、死亡、阶段转换或特效帧。
- 接入状态：尚未写入游戏页面或过渡页，等待具体使用位置确认。

## 文件清单

| 层级 | 敌人 | 文件 |
|---|---|---|
| 基础 | 竹影刀客 | `idle/bamboo_blade.png` |
| 基础 | 屋脊弩手 | `idle/rooftop_bow.png` |
| 基础 | 墨羽鸦 | `idle/ink_crow.png` |
| 基础 | 墨腹蛛 | `idle/ink_spider.png` |
| 基础 | 铁甲盾卫 | `idle/iron_shield.png` |
| 基础 | 提灯术士 | `idle/lantern_mage.png` |
| 基础 | 噬墨兽 | `idle/ink_beast.png` |
| 基础 | 链狱卒 | `idle/chain_jailer.png` |
| 基础 | 墨鳞游魂 | `idle/ink_eel.png` |
| 基础 | 沉甲水卒 | `idle/drowned_guard.png` |
| 精英 | 掌灯使 | `idle/lantern_adept.png` |
| 精英 | 赤枪校尉 | `idle/scarlet_captain.png` |
| 精英 | 无面剑侍 | `idle/faceless_sword.png` |
| 精英 | 湖中墨姬 | `idle/lake_maiden.png` |
| Boss | 剑冢狱主 | `idle/tomb_warden.png` |
| Boss | 黑松魇兽 | `idle/pine_nightmare.png` |
| Boss | 无相殿主 | `idle/formless_lord.png` |

## 后续动画建议

每名敌人以当前造型作为身份锁定参考，再分别生成或绘制：`idle`、`move`、`windup`、`attack`、`recover`、`hit`、`death`。Boss 额外增加 `phase-transition`。攻击轨迹、符阵、墨雾、水花和冲击波应作为独立特效层，不烘焙进基础角色帧。
