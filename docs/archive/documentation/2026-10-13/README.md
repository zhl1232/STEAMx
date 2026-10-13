# 2026-10-13 文档整理与历史快照

本轮基线为 `0d322eda40dfdf81c7feb4f37703c9b38bea2b15`。以下文件直接复用基线的 Git blob，逐字保留原内容；`.md.txt` 仅作历史文本，避免旧相对链接与旧操作被误当现行导航或指南。

现行规则从 [文档导航](../../../README.md) 进入，代码位置从 [项目索引](../../../../PROJECT_INDEX.md) 进入。本目录不是另一套有效规则。

## 保留的原文

| 快照 | 原路径 | 原 Git blob SHA |
|---|---|---|
| [PROJECT_INDEX.md.txt](PROJECT_INDEX.md.txt) | `PROJECT_INDEX.md` | `c59c4170a7f73502c19f38c071d9da3ba2b7786f` |
| [phone-auth.md.txt](phone-auth.md.txt) | `docs/phone-auth.md` | `50c74831448cfdeadbbcd146e2e3304241d04bb0` |
| [membership-handoff.md.txt](membership-handoff.md.txt) | `docs/MEMBERSHIP_PAGE_HANDOFF.md` | `b0b36a54659f3988e2c932c95337b19655f126ae` |
| [tutor-credit-accounting.md.txt](tutor-credit-accounting.md.txt) | `docs/ai/tutor-credit-accounting.md` | `7a5647ffd2cef42b896384cee2bcc5bf7746e1c9` |
| [voice-31-upgrade.md.txt](voice-31-upgrade.md.txt) | `docs/ai/voice-31-upgrade.md` | `f9443b9d60e2f4ffe42b16792d45211301772a4a` |
| [mobile-building-experience.md.txt](mobile-building-experience.md.txt) | `docs/courses/mobile-building-experience.md` | `cf9ee09593b7beaf77ab55f40e451f904374b9f3` |
| [deployment.md.txt](deployment.md.txt) | `docs/deployment.md` | `f3116b74b1e606f0ec8d6fb5a800b24f8e2e768e` |
| [seo-daily-operations.md.txt](seo-daily-operations.md.txt) | `docs/seo-daily-operations.md` | `5e1b457475e7b27222457580f522aff1756b8d94` |

旧索引保留全部历史实现细节与检索线索，不表示其中每条限制都在本轮重新验收；涉及当前行为从新索引的代码入口核对。短信的 9 月切换/排障、会员初版交付、计费/语音/手机搭建的隔离测试和旧成本算例均保留在各自原文中，不能作为当前生产、价格或真实用户证据。

## 本轮做了什么

现行文档明确唯一维护职责；修正迁移限定预检、发布白名单、会员周期待办、首页移动入口、语音取消和旧模型价格引用。登录文档对照实现修正短信渠道优先级、会话建立顺序，并区分邮箱兼容能力与公众入口。

根索引改为模块、实现位置与规则入口，不再复制常量和交付过程。编辑器迁移规则只链接统一命令文档。科学第三、第四批原文另移到 [第三批](../../science/2026-10-12/batch3.md)、[第四批](../../science/2026-10-12/batch4.md)，根路径保留兼容入口，计数和原始正文不变。

## 范围与仍未完成的事项

本轮不修改应用、测试、脚本、数据库迁移、workflow、媒体和运行时配置，也不触发生产操作。不把 PR #76/#79 尚未合入的资源清理或入口退役写成主分支已完成；#79 的旧索引字符串修订应在合并时按新索引实际位置重新核对。

没有生产执行证据的事项标为本次未核验；产品、支付、家庭使用等仍以原日期记录并由 [下一步](../../../next-step.md) 承接。已存在的历史发布清单、哈希和兼容文档不为表面一致而改写。本轮没有验证全部外链或逐行审计全部历史归档，也没有用文档替代任何业务验收。
