### [S2] 游乐场设置在窄屏缺少入口，且云端清理失败时没有错误态（已修复）
- 文件：`app/playground/layout.tsx:124`、`app/playground/layout.tsx:258`、`hooks/usePlaygroundSync.ts:28`、`hooks/usePlaygroundSync.ts:133`
- 行号：`124`、`258`、`28`、`133`
- 现象：移动端无法打开游乐场设置；清理本地/云端数据时即使 Supabase 同步失败也会直接刷新页面，用户看不到失败结果。
- 原因：设置按钮只在 `md` 及以上展示，且 `flushToCloud` / `clearCloud` 只记录控制台日志，没有把失败状态返回给调用方。
- 建议：为窄屏补设置入口；用户触发的同步/清理动作需要显式返回失败，并在对话框中展示错误态、禁用重复提交。
