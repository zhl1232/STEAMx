# Accepted content release — 2026-10-09

Status: public candidate prepared; not deployed, uploaded, or applied to the production database.

Baseline: `793ffd9152c074e2644fa8312244d158997eec2b`. Accepted source commits: `035f0d21`, `28aa4c13`, `11d05012`, `7ad38f1a`. Main PR #41/#40 are preserved.

## Scope

- LED project 149: accepted runtime guide, FAQ and five OSS WebP files; the explanatory SVG remains an intentional versioned application asset.
- 59 science projects: database description/reflection/materials/steps; identity, category, approval state, original video/cover and unrelated metadata retained. Safety, observations, extension and FAQ are reviewed application metadata, shown only when the database instructions match. The 18 reviewed science images remain intentional versioned application assets under `public/assets/projects/`; they are not an OSS fallback.
- 65 exact confirmed MPD revisions: 5 small-class updates, 55 middle-class models and 5 large-class models. Another 94 confirmed canonical versions are unchanged. MPDs are self-contained; no shared DAT or draft LDR edits are included. Original source and all live review records remain in the preserved dev workspace.

Excluded: every unconfirmed/current-mismatched model, all material-preparation calculator/UI work, dev authentication/preview code, the 12 blocked science experiments, PR #33, and all production hard-delete workflow paths.

Science IDs: 1309, 1323, 1322, 1315, 1295, 1181, 1193, 1179, 1202, 1206, 1211, 1200, 1178, 1188, 1192, 1230, 1204, 1212, 1231, 1227, 1239, 1236, 1210, 1254, 1233, 1214, 1194, 1244, 1293, 1246, 1286, 1277, 1216, 1187, 1201, 1218, 1205, 1228, 1248, 1257, 1259, 1176, 1177, 1283, 1180, 1184, 1190, 1191, 1219, 1207, 1217, 1307, 1308, 1262, 1281, 1284, 1183, 1321, 1232.

## Ordered release and checks

1. Revalidate current main and the exact file whitelist. Review this manifest and the immutable source/review SHA256 pairs in `models.json`. Revalidate public snapshots with read-only SQL; never blindly run all pending migrations.
2. Verify existing production OSS configuration without logging values. `ALIYUN_OSS_ACCESS_KEY_ID`, `ALIYUN_OSS_ACCESS_KEY_SECRET`, `ALIYUN_OSS_BUCKET`, either `ALIYUN_OSS_REGION` or `ALIYUN_OSS_ENDPOINT`, and `NEXT_PUBLIC_ASSETS_BASE_URL` are required. The assets base must equal the approved `https://assets.steamx.cc` destination. Use the existing credential only; HEAD/GET/PUT on these approved objects suffices; no deletion permission is needed.
3. Upload the 65 MPDs and hashed LDConfig via `scripts/publish-ldraw-assets.mjs --only=<all 65 slugs> --upload --manifest=<receipt>`. Upload exactly the five LED objects with `scripts/publish-led-assets-20261009.mjs --upload --receipt=<receipt>`. Both stop on an existing different object and verify SHA256 readback. Save receipts and revalidate all public asset URLs with the normal site Referer.
4. After scope and asset readiness are confirmed, push one candidate and create a draft PR. Complete normal PR checks/review, then merge once. Let the single main update trigger the existing Release Deploy workflow; do not add a tag or manual dispatch.
5. Verify deployed application, homepage and LED. Only then apply the two exact approved migrations: science 59 and model lessons 65. Before the repository migration wrapper is used, assert that pending migration names equal precisely these two filenames and that asset receipts match this manifest. The wrapper status/dry-run creates the tracking table; do not use it for read-only inspection. Existing pending migrations were zero in the read-only snapshot.
6. Save postimages. Check all 59 science details, original media preservation and their real step counts. Check each hashed MPD first/last production step, full BOM and course/lesson URL mapping. Verify page images, mobile/desktop output, structured data and the science guide. A successful image deployment alone is not release completion.

## Transactions and rollback

Science forward migration locks 59 exact project identities and child rows, compares all old editable content/media, preserves old material/step row IDs, updates accepted fields and inserts extra rows. It performs no deletes and checks postimages inside the transaction.
Model migration locks 65 exact lesson ID/course/title tuples and compares complete old content. It merges only `building3d.ldrawModelUrl`, `ldrawColorUrl`, and `steps3d`. Existing steps are kept where the production parser count agrees; otherwise neutral 3D step labels use the actual count. Trailing empty preview steps are not published.
Database snapshots, generated migration payloads, generators, local SQL test fixtures and rollback scripts are retained only by the old production-data task; none is in this public branch. Rollback scripts are outside its migration queue so they cannot run automatically. Rollback first compares the changed fields with expected postimages; user edits stop the batch. Science restores original row IDs/values and removes only newly inserted rows if unreferenced; any foreign-key reference aborts. Model rollback restores only the three released fields and preserves unrelated later content. No OSS object is deleted.
If the release must be reverted, restore the content/references first using a reviewed forward rollback migration (do not edit migration history), then revert the app commit through normal CI. This order prevents the science database referencing images absent in the old app. Old OSS references remain usable.

## Local validation

- Full unit suite: 405 files passed, 1 skipped; 2197 tests passed, 31 skipped, using the same placeholder environment as CI.
- TypeScript passed; lint had zero errors (existing warnings retained).
- Existing LDraw publishing/SEO script tests: 14 passed. LED immutable upload tests: 3 passed.
- Actual PostgreSQL 16 in a dedicated network-isolated container: forward + exact rollback roundtrip; science/lesson drift rejection; newer postimage rejection; unrelated lesson content preservation; referenced inserted-row rollback guard all passed.
- 65 MPDs: full SHA256 equals review, no missing dependencies, unique lesson mapping, first/last production-step parser checks passed.
- Full production build passed with the CI placeholder database; expected public-data fetch warnings are not production acceptance. No production mutation has occurred during these checks.

## Model whitelist

| MPD filename | Course/lesson | SHA256 | Production steps |
|---|---|---|---|
| 3-ai-fei-er-tie-ta.mpd | 5/30 | `6348810d02fb604d0d25f635282982bcdca6c1a7442b0f02e00cf346db8c03f9` | 12 |
| 3-jing-che.mpd | 5/58 | `145e2fe03af6b9f9f0c20429fcfdafd2f93d310631004f6388bc1c9cb0b1ebf3` | 8 |
| 3-liang-ting.mpd | 5/67 | `46542953b275dc0c7df732bd6fbe34450c7dd13bf4824924fca980f36cbc197d` | 16 |
| 3-liu-bing-xie.mpd | 5/68 | `803ab2f04b35f5f16d95d9765430b3ae8b463f7162b20f533fc36cad6d130432` | 12 |
| 3-xue-gao-che.mpd | 5/119 | `bbde1366aecffe2384026078f382a3c8afdbc325914ee9950cf2e5daaeadc72d` | 13 |
| 4-an-jian-ji.mpd | 6/130 | `007eaf090687fee6bf73c9b43db91aef05b34bf2c37bc9ce5b5b6581b74d4781` | 10 |
| 4-ba-wang-long.mpd | 6/131 | `9ed40b3d90aa8493163a6eab4ed22e9fb31ea206a4b91d6cadf4d3059c77600a` | 13 |
| 4-ban-gong-yi.mpd | 6/132 | `2b582531c44401c3e22cadb3602e5cfc8e1b0e2de613e428f29d36b0e390e1e0` | 12 |
| 4-bao-jian.mpd | 6/133 | `b2cbc3c6a3b1e6e79680fc5d5ad0ad708bda055bc60af544c15b6bc892b8c4ba` | 9 |
| 4-chong-wu-gou.mpd | 6/135 | `570165c62110dbcb7955d3e16f213ef47c420e814b808047c51c78c19d56eace` | 13 |
| 4-da-wen-zi.mpd | 6/139 | `433169422e020a71df7ef0c38a2d060db79a8a5e09380a9df0931c3a024d97b6` | 11 |
| 4-da-zha-xie.mpd | 6/141 | `0a4779b4e71635ba5134913b5a7d2d6971135445a8506b4ae2e5855e9f8cc4b3` | 10 |
| 4-deng-long.mpd | 6/143 | `c30132150234459a43b60c14722b73834dee66656f383aeee4e69846e6848528` | 13 |
| 4-dian-hua-ji.mpd | 6/144 | `2c1f2a56c72121e9c6bb1ce0971eef159acef768ebd6bd0d7f26a31aad9670f5` | 10 |
| 4-dong-fang-ming-zhu.mpd | 6/146 | `441aa0a9f411f5845da65075408d3a4417101726d15a51168ce6be0f323fbb64` | 18 |
| 4-er-hu.mpd | 6/149 | `4854f73d534a5c35b1a14daa9282290831c790445de46bfeb63e3bd300840789` | 11 |
| 4-er-tong-hua-ban-che.mpd | 6/150 | `8c806987f3490bf3df7aa4c2d41e45c0cc1190e1baee778a1570fbea3dad3919` | 10 |
| 4-fan-chuan.mpd | 6/151 | `a1dfd77e597eb3f4db8f4690c6149a42b0529965c90c8cf218617a38a897fa8a` | 13 |
| 4-fan-dou-che.mpd | 6/152 | `970cf8d6faf17682912ac6379fdb4e2d5aa9198d5c42e93415304342c3ced7fe` | 11 |
| 4-fei-die.mpd | 6/153 | `a9988c9c88a3517e9e6b9f50166f2db5a40dc2f066f82d7084b28d8133522ede` | 16 |
| 4-feng-che-fang.mpd | 6/154 | `120bfc2761d8faef79f9b96248665230dcae06e13c5c5caff6e5a9a3ec584a37` | 18 |
| 4-gao-tie-zhan.mpd | 6/155 | `77e26657c17fd1ef8bb97e8f7d1355bb4647c61d4bd78fc8da7fb613e4f97abd` | 18 |
| 4-gong-jian.mpd | 6/156 | `ef2a62629b5e701f77610214fadc7f035bf1b77a82a193cf564e00ba247090ec` | 11 |
| 4-gou-wu-che.mpd | 6/157 | `1ce547319a1d8757eee8b079f8844e1f7d5bfd9604b91012293d802be61d1c11` | 12 |
| 4-hai-shi.mpd | 6/158 | `f4950208d39a8c3f057b34eacaa1ed18afa272cebec5be32739e0d5029c906a5` | 12 |
| 4-han-xue-bao-ma.mpd | 6/159 | `657ffe15aeb73cc9d549e18ccc96f40b1b11c4a2fa9a67d5f89cdc41b9d7f86b` | 13 |
| 4-hu-die.mpd | 6/160 | `bb210744f8402d15b60e3d260747b4bc60ff4a679e67863dc9120a4aa59436a5` | 14 |
| 4-hua-ban.mpd | 6/161 | `33af6f634d82002944b0384824723fa252b0f1b0bac7f3ba3c8aceaa6708f7c5` | 9 |
| 4-hua-kai-hua-luo.mpd | 6/162 | `2078d9d4f778b90c7c7f1dc5768e0fd95aed82b35acffbe5797bea9cdb7f3424` | 16 |
| 4-huang-bao-che.mpd | 6/163 | `b341888ff71e41879f63dce9db6306d36ff918116af177e6371535bbcfa47a14` | 9 |
| 4-huo-jian.mpd | 6/164 | `ba1eeeb67abed774bf0b77cc808cb196e8a6b7720cd1be24cb296f9330a14484` | 15 |
| 4-ji-ta.mpd | 6/166 | `fd6aafaf71d037cd937845453c9e6fe69f387954c76f33be12e64d9c18778793` | 7 |
| 4-jiu-hu-che.mpd | 6/167 | `f95abf5b8a10a411210c725c8c99d526a8e8bf0c0f171d7a76d170e0bb9fbdd0` | 10 |
| 4-la-ji-fen-lei.mpd | 6/173 | `ebd2aa799bc3b4d667f56e3e441fa644ee37b5782790bbb782c361014e60033d` | 12 |
| 4-lan-qiu-jia.mpd | 6/174 | `0960a67095b261b99f9db709dde99e6d836827358ba28ea4d53af69102bde1b2` | 9 |
| 4-lei-da.mpd | 6/175 | `b32882ea6f6211187eca75bdcce8abe7cce4d4875825a01ec3ccbbbab566163a` | 13 |
| 4-long-zhou.mpd | 6/177 | `ee2273f0f46c044f40feddf3fb5e930a2be6c088bfa1cd8c1d8c2d66e2bad618` | 18 |
| 4-lu-yin-ji.mpd | 6/178 | `56a80b9d775cde86576714909c2eca6f59511b3341f81295607bdc8046253bb1` | 11 |
| 4-luo-tuo.mpd | 6/179 | `cf139c589d9727f5dbdf9bb7faa6e2575619deb3c73ac19be8f9267ad6db2ef2` | 10 |
| 4-pang-xie.mpd | 6/181 | `670b39751dd7d4e5b48433057fdc51ba717ebd4f66b2ed628106d86c292b14d6` | 14 |
| 4-re-qi-qiu.mpd | 6/185 | `5d716fa3187c0c40a9f02f33bd820a47029a7d85b8454d13d5b2de221cd47fcb` | 10 |
| 4-she-xiang-ji.mpd | 6/187 | `327386f04365e8a538f757cac86f90b0c334e3f0c24a70b57afd4b5947870fc1` | 13 |
| 4-shi-zi-wang.mpd | 6/190 | `71964d8f34e4e5c86eb28148b139971297bd67619fac34723493c65802f4a65c` | 15 |
| 4-shu-bao.mpd | 6/192 | `e5cdca54cd5d1ab028552f00ea03ac79288041b757c2fa623e658aedce8ba938` | 9 |
| 4-shuang-ceng-ba-shi.mpd | 6/193 | `a13353b5108d0643466547ed94fce23c7a833c2e0b016872a6688c9f923c061c` | 11 |
| 4-tai-deng.mpd | 6/196 | `36d64fbaf6c90a05456962f32aa5741552a66dd47dc12724c61316041197ff9d` | 12 |
| 4-tai-yang-neng-re-shui-qi.mpd | 6/197 | `f20291e20c9107b13c938e760f8d082eafac8e62173b3235a986b850393f26d9` | 11 |
| 4-tan-ke.mpd | 6/198 | `2b62f1e903de974ed0849ec79767971a36cc8fab6e2b40c6f3eec2869bfb53ae` | 15 |
| 4-tian-ping.mpd | 6/200 | `9275d6f5315dbdb33f160fd4b76053bbde03c2b13a5ef5d021f0b2cc9b9237d1` | 11 |
| 4-tuo-niao.mpd | 6/203 | `9273e4b43ab8bcb9ce9622ca88e554fc28fccf2ec54a9c4f5a705906bd7042c6` | 14 |
| 4-wa-tu-ji.mpd | 6/205 | `d4de062124456a621c1f1c30ed4b710eddd1566002734b0fefdd0e436409a96c` | 8 |
| 4-wai-xing-tan-ce-qi.mpd | 6/206 | `da4f46af47724732bc808b02084c0ef57194013e88ef16424317581495b8f208` | 11 |
| 4-wan-long.mpd | 6/207 | `398fa97e01e866bf12d8fdbc054e1b75b753179c01de753b128a937fe3eb63fa` | 11 |
| 4-wang-yuan-jing.mpd | 6/208 | `43025ef643ecd9c4d7afea82ea8bbf41dee2b8d54ddf1cf17f2bbb2e3badc427` | 20 |
| 4-xian-wei-jing.mpd | 6/210 | `41249f4eda81f3e4bcf650875c4247bdedd4a121bdbcf5266818f1aa865b0799` | 13 |
| 4-xie-la-qiao.mpd | 6/213 | `f5a10d28f895eef207fa325e0ccee31825c2233f6629323c7c19a5e35eddb6db` | 14 |
| 4-xing-li-xiang.mpd | 6/215 | `cd0270f5ffff27de0a204ced2f0f25f26da82716177501d03f9fb3699fdfe05c` | 13 |
| 4-xuan-zhuan-mu-ma.mpd | 6/217 | `9db52a8b7417ca9d70a68a2e9a3188b32bc130fb4c280d04f934d186d4223f16` | 16 |
| 4-ying-er-che.mpd | 6/221 | `5dd0c21776f7301091807e8657cb9073641074551d3e68104b6b66c4be31c139` | 17 |
| 4-zhang-yu.mpd | 6/223 | `2f5a7554903d6fecb593df016b3d046d41274d81d234334acb627a45d90fa585` | 14 |
| 5-da-bai-chui.mpd | 7/242 | `b13c0a6fa59b4c3a055ae04bd291f1430f419d321b7bd4bd22b2e21ed73eefa9` | 11 |
| 5-du-lun-shou-tui-che.mpd | 7/251 | `1469f221b5666ac83fd87987eba48d3f2b00b57f19b23665c70a7a562052ef74` | 9 |
| 5-shen-suo-men.mpd | 7/282 | `314dad17a901b4ec59c32ca4b1ee51bbabaa47c1541b22de01d2ce06471f324a` | 10 |
| 5-shi-zi-zha-men.mpd | 7/284 | `31ff2ffad2d23ff0fb5c395fdef8ab41748e412c1ea3a34b00f0bee81b2f4a10` | 10 |
| 5-tuo-luo-da-zhan.mpd | 7/299 | `fc699ea4c5ddc2b59b90469e4b5e3ad905c9e0dece83430645c243c4f7cf6484` | 8 |

Public asset handoff: the new task receives only this branch and `assets.json` / `models.json`. It must not execute database migrations. The old task retains immutable preimages and both validated transactions, and will recheck the exact pending migration whitelist before applying after successful asset/app acceptance.
