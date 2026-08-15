# 美术资源管线

## 目录约定

原始美术统一保存在项目根目录的 `local-art-source/`。该目录已加入
`.gitignore`，不会被 Git 提交或进入部署包：

- `local-art-source/editable/`：分层图、生成源图、色键图和文档画像；
- `local-art-source/runtime-originals/assets/`：合成后的无损 PNG/JPG 母版，目录结构与
  `public/assets/` 对应；
- `public/assets/`：只保存浏览器使用的 WebP 成品和已优化动作帧。

原图需要通过工作室存储或本地备份单独同步。仅克隆 Git 仓库可以正常构建和运行，
但不能重新合成美术母版。

## 更新流程

1. 在 `local-art-source/editable/` 修改源图或分层图；
2. 执行对应的 `npm run art:*` 命令；这些命令将无损母版写入
   `local-art-source/runtime-originals/assets/`，并自动刷新 WebP；
3. 只更新已有无损母版时，执行 `npm run assets:optimize`；
4. 执行 `npm run assets:verify`，确认 WebP 可解码、引用完整且 `public/assets/`
   没有遗留 PNG/JPEG；
5. 执行 `npm run build` 和浏览器画面回归，再提交 `public/assets/` 中的 WebP。

资源优化脚本按修改时间跳过未变化文件；需要全部重新编码时使用：

```bash
npm run assets:optimize -- --force
```

当前质量策略：地图与静态场景 WebP 质量 84，施工草图 82，带透明通道的敌人造型和
特效 88，透明通道质量均为 100。
