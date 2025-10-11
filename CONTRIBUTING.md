# 贡献指南

欢迎你为 **TastKing** 做出贡献！请先阅读以下流程，以便团队高效协作并保持代码质量。

## 环境准备

- 安装微信开发者工具并配置与项目匹配的基础库版本。
- 克隆仓库后，请使用微信开发者工具导入 `miniprogram/` 目录进行调试。
- 如需使用云函数，请在本地配置与 `cloudfunctions/` 对应的云开发环境。

## 分支策略

- `main`：只保存已经发布或准备发布的稳定版本，禁止直接在该分支提交。
- `develop`：日常集成分支，所有功能开发与修复首先合并到此分支。
- `feature/<scope>`：功能分支，从 `develop` 创建，完成后通过 Pull Request 合并回 `develop`。`<scope>` 建议使用简短英文描述，例如 `feature/task-filter`.
- `hotfix/<issue>`：紧急修复分支，从 `main` 创建，修复后需同时向 `main` 与 `develop` 发起合并。
- `release/<version>`（可选）：准备发布前从 `develop` 切出，用于只接受修复与文档更新，发布完成后合并回 `main` 与 `develop`。

## 开发流程

1. 从 `develop` 更新本地代码：`git checkout develop && git pull`.
2. 创建新的功能分支：`git checkout -b feature/<scope>`.
3. 完成需求开发，并在微信开发者工具中自测所有主要流程，包括添加、编辑、删除任务等操作。
4. 按照提交规范撰写提交信息，推送至远端仓库。
5. 提交 Pull Request，选择 `develop` 作为目标分支，并请求评审。
6. 通过代码审查与必要自测后，保持分支为 up-to-date，再执行合并。

## 提交规范

- 使用 `遵循 type: summary` 的格式，例如 `feat: 支持任务优先级筛选`。
- 常用 `type`：`feat`、`fix`、`docs`、`refactor`、`test`、`chore`、`build`。
- 提交信息的正文与页脚可选，正文用于补充背景，页脚可引用 Issue，如 `Refs #123`。

## Pull Request 检查清单

- [ ] 已描述变更背景与目标。
- [ ] 相关 Issue 已在 PR 中关联。
- [ ] 通过微信开发者工具进行真机或模拟器验证。
- [ ] 新增/修改的文档已同步更新（如适用）。
- [ ] 变更不会破坏现有功能或已提供兼容处理。

感谢你的贡献与支持！
