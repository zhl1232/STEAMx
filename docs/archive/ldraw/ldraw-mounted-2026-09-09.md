# 已确认 27 个 3+ 模型挂载记录（2026-09-09）

用户限定本次只挂载27个已确认模型。已更新小班大颗粒积木（course_id=5）对应27个既有building_3d课时，仅补充/更新content.building3d.ldrawModelUrl、ldrawColorUrl、steps3d。原有视频、PPT、图片、文案、课时顺序和其他课时保持不变；更新前后逐字段对比通过。未执行schema迁移。

27个MPD及LDConfig已上传OSS；带站点Referer逐文件下载，SHA-256与验收记录完全一致。localhost的27模型首步/末步分步接口全部HTTP200。

**生产部署待完成**：生产分步API从容器的public/courses/ldraw读取文件，不从OSS读取。检查生产望远镜step=0接口仍为404；目前只有数据库与OSS已生效，不能称为生产课程3D全部可用。需将这些MPD纳入下一次应用部署，或将精准资产包同步到运行容器及持久部署资源。没有改动应用服务器，发布凭据仅在GitHub Actions secrets中，当前本地无对应服务器访问配置。

资产包：`.tmp/mount-confirmed-27/confirmed-27-models.tar.gz`；前后快照和线上校验：`.tmp/mount-confirmed-27/`。

|课时|模型|步骤|确认版本 SHA-256|
|---|---|---:|---|
|[花轿（53）](http://localhost:3000/courses/5/lessons/53)|`3-hua-jiao`|8|`9e9643619820588e25f4e4f99eb6cc36245504f461483efca72071d321793d25`|
|[垃圾桶（63）](http://localhost:3000/courses/5/lessons/63)|`3-la-ji-tong`|10|`2bc9bfe8c944551bf8b05b44aa1ca19f9132e3e656aea1d6f2f99753427b248c`|
|[礼盒（66）](http://localhost:3000/courses/5/lessons/66)|`3-li-he`|10|`dbd1868dd381b50aa4501c3c08604f903f2c807bbc10f823315acdfd2850afc7`|
|[美丽的小区（73）](http://localhost:3000/courses/5/lessons/73)|`3-mei-li-de-xiao-qu`|30|`e9306a1869263cd0f7a37e906422d1c1dd06551f9b6a1618d2296556ee0a473c`|
|[螃蟹（74）](http://localhost:3000/courses/5/lessons/74)|`3-pang-xie`|9|`3d97ce95391e8fa7a8878cee42eef5b12503a2332d704508c0c263be8949df07`|
|[盆栽（75）](http://localhost:3000/courses/5/lessons/75)|`3-pen-zai`|17|`533fc8f205d848147d52b6b378c3a5bd54e8e46e37a1765be93daf2c595868ba`|
|[人行天桥（80）](http://localhost:3000/courses/5/lessons/80)|`3-ren-xing-tian-qiao`|8|`5f180b4efa49cd3cc9716cc4a6e402fce26d987bdb64e90994c7a2be81efc328`|
|[洒水壶（81）](http://localhost:3000/courses/5/lessons/81)|`3-sa-shui-hu`|7|`98e329584078289b729370324a7d955cc64015832ca4b576ba157b1fa35e90db`|
|[神秘的金字塔（83）](http://localhost:3000/courses/5/lessons/83)|`3-shen-mi-de-jin-zi-ta`|10|`1ac8169cb5c40852323742dadda8b1cbd7fc4f960dee5a4f965b05f9503c5dc2`|
|[圣诞老人（84）](http://localhost:3000/courses/5/lessons/84)|`3-sheng-dan-lao-ren`|17|`da194d9fdcf77f742e1f64fcc7dd34767b050a4ab3256a31b6bd3159bb982873`|
|[室外咖啡桌（86）](http://localhost:3000/courses/5/lessons/86)|`3-shi-wai-ka-fei-zhuo`|9|`16e9b76b00489abcfde62d578813612d08e8b9e5c63feca81cd094d307e88a8a`|
|[手电筒（87）](http://localhost:3000/courses/5/lessons/87)|`3-shou-dian-tong`|5|`276358ae9ae2a215dcca1220b54d4ab276e9ffa4e97408cb8cc8daae5b6b8f5c`|
|[梳妆台（90）](http://localhost:3000/courses/5/lessons/90)|`3-shu-zhuang-tai`|14|`cd74e03ccb5663314b279459139b879adb47a958a65e2cb2d6bba60d00bfc75c`|
|[台球（93）](http://localhost:3000/courses/5/lessons/93)|`3-tai-qiu`|8|`776395c3a7cffeba42873d6d4e525773a39fc854d26bedd6ffb8d2104017e2c9`|
|[套圈圈（95）](http://localhost:3000/courses/5/lessons/95)|`3-tao-quan-quan`|11|`fd92e0493b8e52afc6f9c5516809026690c1f92f31731b1e6ccc4cbf25bf052b`|
|[推拉门（99）](http://localhost:3000/courses/5/lessons/99)|`3-tui-la-men`|8|`59f64227b05cdb03eb121582c744980f3a11f6f35f7dae2d652eff7cdc210a77`|
|[万圣节南瓜头（101）](http://localhost:3000/courses/5/lessons/101)|`3-wan-sheng-jie-nan-gua-tou`|18|`6a0d8d284373a91f4dc9f53e8927abddfc7c22421f7859c36141d7f7794cbe34`|
|[望远镜（102）](http://localhost:3000/courses/5/lessons/102)|`3-wang-yuan-jing`|10|`04021f9013fe7d1c404e9928d2c200ff2fc1dd93f29b23b61ee715a23db735ce`|
|[蜗牛（103）](http://localhost:3000/courses/5/lessons/103)|`3-wo-niu`|12|`b2c97d7c329a0af6f495c35f2eac786bc5ee16a497adaa8e592483301fea99a0`|
|[乌龟（105）](http://localhost:3000/courses/5/lessons/105)|`3-wu-gui`|12|`437f490799af7979697ff9929699f41cb92aafb66cab1954060a2ead6af8eb9f`|
|[洗手台（109）](http://localhost:3000/courses/5/lessons/109)|`3-xi-shou-tai`|15|`220ca5dcd5fedb190aa6cae25442582e5da3ecfcbc439986b171244abe88363f`|
|[小提灯（117）](http://localhost:3000/courses/5/lessons/117)|`3-xiao-ti-deng`|9|`b3f7e1652900491867726924a7243b704569dc209e6f114a50549a8d6ef47b88`|
|[邮箱（123）](http://localhost:3000/courses/5/lessons/123)|`3-you-xiang`|11|`438677e6d3abe77ff3aa41fe7d27092de5c1a9f6534964d925ebf5241150fde6`|
|[熨斗（125）](http://localhost:3000/courses/5/lessons/125)|`3-yun-dou`|9|`2f30c16723f15ae630dc0a3ec325db3422d13a3ea9883d7ec076034e8a02cc33`|
|[照相机（127）](http://localhost:3000/courses/5/lessons/127)|`3-zhao-xiang-ji`|11|`194a753d85ae199a42e5ef6d3e815a077f879b0854dce6cad3e94b9eeb8e113f`|
|[足球场（128）](http://localhost:3000/courses/5/lessons/128)|`3-zu-qiu-chang`|12|`b332cd5c6e9600d9692c3fe2c13dbdc4cecd898f54589f879bbcf89d41fa4075`|
|[座椅（129）](http://localhost:3000/courses/5/lessons/129)|`3-zuo-yi`|10|`408826ec58e55b568642fdef9ad19b3fcc806344537f6992f8c115746829a052`|
