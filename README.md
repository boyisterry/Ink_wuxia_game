# 墨境行者：战墨破境

一款以中国水墨画为视觉主题的 2D 横版动作游戏原型。玩家操控水墨剑客穿行于宣纸山水之间，以移动、跳跃和挥剑击败朱眼墨灵。

## 在线体验

<https://ink-wanderer.boyisterry167898.chatgpt.site>

## 操作方式

- `A` / `D`：左右移动
- `空格`：跳跃
- `J`：二段连续挥剑
- `K` / `Shift`：翻滚闪避
- 移动设备：使用屏幕虚拟按键

## 已实现内容

- 水墨宣纸风横版关卡
- 键盘与移动端触控操作
- 待机、奔跑、原地跳跃及跑动跳跃动作反馈
- 带位移、闪避时间和续跑衔接的冲刺翻滚
- 二段连续劈砍、剑气轨迹与命中反馈
- 敌人攻击预警与反击
- 生命、灵力、任务及胜负反馈
- 响应式页面布局

## 本地运行

环境要求：Node.js `>=22.13.0`。

```bash
npm ci
npm run dev
```

`npm run install:ci` 仅供使用 GNU/Linux 工具链的 Sites CI 环境；本地开发请使用跨平台的 `npm ci`。

运行测试与生产构建：

```bash
npm test
```

## 技术栈

- React 19
- Next.js 16 / Vinext
- TypeScript
- Vite
- Cloudflare Workers / ChatGPT Sites

## 项目结构

- `app/`：游戏页面与全局样式
- `public/assets/`：水墨场景、角色和敌人素材
- `tests/`：渲染与构建验证
- `worker/`：Cloudflare Worker 入口
- `.openai/hosting.json`：Sites 托管配置
