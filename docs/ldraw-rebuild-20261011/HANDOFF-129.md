# 129课开发稿交付与复核入口

更新：2026-10-11T14:53:51.986368+00:00。

本次范围为71个缺源稿和58个简化草稿，共129课。全部已依据实际查看的本机原始课件重建并保存源LDR、必要零件、独立开发MPD和逐课证据。原始资料共122份PDF、1,487页及7课图片资料、93页，合计1,580页。原160个已发布模型与11个暂缓课程未纳入本次制作替换。

这些是供用户确认的开发稿。部分课程保留未知部件、缺失几何、连接遗漏、近似几何或源图布局差异，不等同129课都已精确复原或可实物搭建。用户确认和实物验证均未自动标记。

## 逐课查看

1. 从[逐课状态](COURSE-STATUS-CURRENT.md)选择课程，查看对应source、ledger、static和REVIEW报告。
2. [开发MPD](previews/)按课程slug命名，每个文件自包含依赖，包含累计搭建步骤；源LDR位于仓库scripts/ldraw-models同名文件。
3. 先对照课件核查外形、颜色、已知件和遗漏，再逐步查看支承与连接。当前关键视角和全部步骤均已有实际像素查看记录；报告中的图片哈希对应本机留存渲染，未将原课件或PNG批量提交Git。
4. 对未知编号补充部位近照/源页证据；已知件几何、库存额外需求和连接风险分别处理。不要仅因静态检查退出码为0便认定通过。

## 当前验证范围

| 项目 | 结果 |
|---|---:|
| 有源图依据的开发稿 | 129 |
| 当前最终三视图 / 全部步骤覆盖 | 129 / 129 |
| 顶层零件实例 | 9897 |
| 不同本地DAT依赖 | 426 |
| 绑定当前版本的图像记录 | 1862 |
| 结构/依赖/哈希/像素证据问题 | 0 |
| 保留原始报警的课程 | 55 |
| 原始报警组 / 展开诊断项 | 211 / 321 |
| 已知件连接遗漏课程组 / 件数 | 14 / 63 |

展开诊断项不是独立碰撞总数。零检查问题指证据与文件一致，并非零装配风险。详见[独立全量QA](current-development-QA.json)、[问题登记](unknown-parts-registry.json)、[课件来源](sources/)和[检查快照](checkpoint-status.json)。

问题登记共32个分组，涵盖身份、几何、柔性路径及来源证据，不能当作未知编号数或未完成课程数：

- `candidate_flexible_geometry`：1组。
- `candidate_id_missing_geometry`：3组。
- `candidate_identity_unresolved`：6组。
- `confirmed_id_missing_geometry`：6组。
- `flexible_route_unverified`：2组。
- `inventory_id_missing_geometry_source_match_provisional`：2组。
- `known_flat_sheet_formed_geometry_unavailable`：1组。
- `known_id_unverified_license`：1组。
- `known_part_hidden_mould_variant_unverified`：1组。
- `unidentified_figure_components`：1组。
- `unidentified_source_shape`：8组。

问题的分类、去重依据与典型未解决项详见[最终边界说明](final-limit-summary.json)。该说明不会将旧兼容字段的部分计数当作全量，也不会把不同类型问题简单相加。

## 分支边界

提交仅供独立分支复核：models/129-course-source-rebuild-20261011。未创建PR、合入main、部署、写生产数据库/OSS、改白名单或workflow。推送前核查分支触发条件，远端提交与Actions结果另见branch-backup.json（提交内记录上一已核实检查点；最终远端SHA以交付消息为准）。
