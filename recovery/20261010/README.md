# 开发资料部分恢复（2026-10-10）

本目录仅保存从2026-10-09完整开发交接原文中提取的历史内容，供后续核对；不是故障前开发环境的完整快照，也不是最新实现。文件未接入应用运行路径。

## 已恢复

- historical-science-remaining.data.json：原计划保存为 lib/project/science-remaining.data.json 的完整10项原稿，ID为710、733、781、787、844、987、580、713、786、983。后续69项科学内容更新曾修改这批项目，本文件不能代表那些更新。
- 三个 fragment.txt 文件：同次交接中的接入差异、追加测试和索引片段。它们不是完整源码或可直接应用的补丁；保留了记录中的字面转义，例如 &gt;，未自行补全或修复。

## 尚未恢复

最新69项及后续7项科学更新、材料准备和套装核算实现、9076独立版本与137人工清单的未提交修改，以及其余最新dev文件。没有根据成果描述重写这些代码；也不能据此断言原数据已永久丢失。

## 验证与限制

已验证JSON可解析、10个ID唯一，并检查保存内容未包含凭据或无关个人资料。本次未运行应用测试、构建或浏览器验收，未实施或发布任何功能。历史片段中的测试内容与数量不代表本次测试结果。分支仅在recovery/20261010新增文件，未修改main或工作流，未创建PR、标签或手动触发CI。

## 原文SHA-256

- historical-science-remaining.data.json: ec9f713c271bd7625eda66fbe9cd4b3fe408b30aef2f055d991308653829f403
- science-samples.integration.fragment.txt: 1fa5ef66291ca75204fbb1f178d3c069fa03c6cb29e021447a3c5ea1a96314b9
- science-samples.tests.fragment.txt: c99deeb5787ad26abbcc8180fffbe12d105374827651c0243dfa2c7c002e22c2
- project-index.fragment.txt: a81a109424a7b6b6330cd2f4ce268c7ad1d4d5593bcf44884e2e4c8e95c30863
