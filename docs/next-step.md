# Next step 备忘

待后续迭代的功能与 UX，暂不进入当前版本。

## 自然观察 `/nature`

### 观察手册（原「继续探索」快捷入口）

- **状态**：已从首页移除（2026-05，原 `MobileNatureClassroom` 四宫格：物种百科 / 观察记录 / 观察地图 / 发布记录）。
- **若恢复**：建议做成「观察手册」模块，而非泛化快捷入口；内容可包括观察技巧、野外安全、记录规范、物种识别入门等，与 `/nature/species`、`/nature/submit` 形成学习路径而非重复导航。
- **实现参考**：此前实现在 `app/nature/page.tsx` 的 `MobileNatureClassroom`（`md:hidden` 区块），可从 git 历史恢复结构后重写文案与信息架构。
