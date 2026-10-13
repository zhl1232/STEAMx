# 2026-10-13 旧昆虫工具归档

基线：`7d0dc4a974bc780651febd88a1fe9396a0eabcdf`。

| 原入口 | 归档文件 | 原 Git blob SHA |
|---|---|---|
| `scripts/build-insect-migration.mjs` | [源代码快照](build-insect-migration.mjs.txt) | `faf9b2477e32c366b678e95c301acb8421a37b58` |
| `scripts/fetch-insect-images.mjs` | [源代码快照](fetch-insect-images.mjs.txt) | `e82b5b2c8e57b105709cb7ef67f4b4e3984ad790` |

两者均固定读取已不在受版本管理文件中的根目录 `insect.json`；本次仓库搜索
仅找到它们自身的命令示例，没有其他源码、脚本、文档、package 命令或 CI 调用。
因此移出日常 `scripts/`，按原 blob 保存为 `.mjs.txt` 历史快照，不作为可直接运行的维护工具。
这里的相对路径仍是旧位置下的路径；需要恢复时，必须另行提供经过核对的输入、修复路径，
并重新检查下载、文件覆盖及数据库变更边界，不能直接复制执行历史命令。

本次没有运行这两支脚本，没有生成或删除 SQL 迁移，没有访问或改写生产数据库、OSS、
物种图片、媒体 manifest 或课程素材。归档不证明历史导入或生产清理已经完成。

`fetch-tree-images.mjs`、`profile-icons-remove-bg.mjs` 仍由项目索引列为维护工具，
本批保留；前者的 `tree.json` 输入缺失仍需另行处理。数据分诊与资源清理工具也保留，
在没有核对生产收尾状态前不删除、不执行。`PROJECT_INDEX.md` 的整体精简不包含在本批。
