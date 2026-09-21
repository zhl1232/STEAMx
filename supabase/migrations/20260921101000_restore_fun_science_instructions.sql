-- Restore 22 fun-science projects from their own videos; see docs/fun-science-content-2026-09-21.md.
-- Apply after content review and authorization using pnpm db:push.
BEGIN;
SET LOCAL request.jwt.claim.role = 'service_role';
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
CREATE TEMP TABLE _fun_content (id bigint PRIMARY KEY, title text, video_url text,
  old_materials jsonb, old_steps jsonb, old_description text,
  materials jsonb, steps jsonb, description text) ON COMMIT DROP;
INSERT INTO _fun_content
SELECT * FROM jsonb_to_recordset($fun_payload$
[
  {
    "id": 526,
    "title": "隔空捏气球",
    "video_url": "https://assets.steamx.cc/qimeng-preview/050_隔空捏气球/video_1.mp4",
    "old_materials": [
      {
        "id": 2685,
        "material": "（见实验说明）",
        "project_id": 526,
        "sort_order": 0
      }
    ],
    "old_steps": [
      {
        "id": 4560,
        "title": "见视频",
        "image_url": null,
        "project_id": 526,
        "sort_order": 0,
        "description": "见视频"
      }
    ],
    "old_description": "材料与步骤见正文。",
    "materials": [
      "透明塑料瓶 1 个",
      "气球 1 个",
      "大头针 1 枚",
      "剪刀 1 把"
    ],
    "steps": [
      {
        "title": "制作瓶底小孔",
        "description": "用大头针在塑料瓶底部扎一个小孔，工具尖端避开手指。"
      },
      {
        "title": "扩大瓶底小孔",
        "description": "用剪刀尖将刚才的小孔稍微扩大，使空气能通过，孔仍须能被指腹完全盖住。检查孔边，避免尖锐毛刺。"
      },
      {
        "title": "装入并套住气球",
        "description": "把气球塞进瓶子，再把气球口套在瓶口上并固定好。"
      },
      {
        "title": "吹气并堵孔观察",
        "description": "在小孔敞开时把瓶内气球吹大，随后用指腹盖住瓶底小孔，再停止吹气，观察气球是否保持膨胀。松开小孔，观察气球缩小。避免过度吹胀，及时收好气球碎片。"
      }
    ],
    "description": "在塑料瓶里吹大气球，通过堵住和松开瓶底小孔，观察气球大小的变化。"
  },
  {
    "id": 528,
    "title": "调皮的纸团",
    "video_url": "https://assets.steamx.cc/qimeng-preview/048_调皮的纸团/video_1.mp4",
    "old_materials": [
      {
        "id": 2690,
        "material": "（见实验说明）",
        "project_id": 528,
        "sort_order": 0
      }
    ],
    "old_steps": [
      {
        "id": 4562,
        "title": "见视频",
        "image_url": null,
        "project_id": 528,
        "sort_order": 0,
        "description": "见视频"
      }
    ],
    "old_description": "材料与步骤见正文。",
    "materials": [
      "干燥的空塑料瓶 1 个",
      "纸巾 1 张"
    ],
    "steps": [
      {
        "title": "准备纸团",
        "description": "用纸巾揉成一大一小两个纸团，两者都应能放在瓶口且不塞紧瓶口。"
      },
      {
        "title": "放置小纸团",
        "description": "将塑料瓶平放在桌面上，把小纸团放在瓶口处。"
      },
      {
        "title": "吹动小纸团",
        "description": "嘴与瓶口保持距离，朝瓶口轻轻吹气，观察小纸团是向瓶内还是向外移动。只吹气，不吸气。"
      },
      {
        "title": "比较大纸团",
        "description": "取出小纸团，换上大纸团，在相同位置以相近力度再吹一次，比较两次纸团移动的方向。"
      }
    ],
    "description": "对着空瓶口吹纸团，比较不同大小纸团的移动方向。"
  },
  {
    "id": 536,
    "title": "神奇的油迹",
    "video_url": "https://assets.steamx.cc/qimeng-preview/040_神奇的油迹/video_1.mp4",
    "old_materials": [
      {
        "id": 2715,
        "material": "（见实验说明）",
        "project_id": 536,
        "sort_order": 0
      }
    ],
    "old_steps": [
      {
        "id": 4577,
        "title": "见视频",
        "image_url": null,
        "project_id": 536,
        "sort_order": 0,
        "description": "见视频"
      }
    ],
    "old_description": "材料与步骤见正文。",
    "materials": [
      "薄白纸 1 小张",
      "食用油少量",
      "滴管 1 根",
      "有印刷文字的废旧书页或废纸（会沾油）"
    ],
    "steps": [
      {
        "title": "用纸覆盖文字",
        "description": "把薄白纸平铺在有印刷文字的废旧书页或废纸上，先观察被遮住的文字是否清晰。"
      },
      {
        "title": "滴加食用油",
        "description": "用滴管往白纸上滴几滴食用油，让油逐渐浸润纸张，保留一部分不滴油的区域作比较。"
      },
      {
        "title": "观察文字显现",
        "description": "比较有油和无油区域下方文字的清晰程度，观察原先被遮住的文字是否更容易看见。结束后收好油瓶并擦净桌面。"
      }
    ],
    "description": "把少量食用油滴在白纸上，比较滴油前后下方文字的清晰程度。"
  },
  {
    "id": 570,
    "title": "美丽的虹吸现象",
    "video_url": "https://assets.steamx.cc/qimeng-preview/006_美丽的虹吸现象/video_1.mp4",
    "old_materials": [
      {
        "id": 2802,
        "material": "（见实验说明）",
        "project_id": 570,
        "sort_order": 0
      }
    ],
    "old_steps": [
      {
        "id": 4642,
        "title": "见视频",
        "image_url": null,
        "project_id": 570,
        "sort_order": 0,
        "description": "见视频"
      }
    ],
    "old_description": "材料与步骤见正文。",
    "materials": [
      "透明塑料杯 4 个",
      "可弯折吸管 3 根",
      "色素少量",
      "清水",
      "剪刀 1 把",
      "蜡烛 1 支和打火机 1 个（用于封住孔隙）",
      "三个不同高度的稳固垫台（视频用额外的杯子垫高）"
    ],
    "steps": [
      {
        "title": "制作出水口",
        "description": "在三个塑料杯的侧面各开一个能穿过吸管的小孔。把弯折吸管穿入，杯内一端斜向杯底，杯外一端伸出杯壁；剪去过长部分，确认吸管通畅。"
      },
      {
        "title": "密封孔隙",
        "description": "视频用蜡油封住吸管与杯壁之间的缝隙。手和塑料杯远离火焰；熄灭蜡烛，等蜡冷却凝固后检查密封，不堵住吸管。"
      },
      {
        "title": "摆成阶梯",
        "description": "将三个带吸管的杯子依次放在由高到低的稳固垫台上，每根吸管的出口对准下一只杯子的杯口；第四只空杯放在最低处接水。"
      },
      {
        "title": "加入颜色和清水",
        "description": "向三个带吸管的杯子中各滴入少量色素，再加入清水，水面先保持在杯壁出水孔以下。"
      },
      {
        "title": "观察逐级流动",
        "description": "缓慢往最高的杯子加水，观察水位升高后，彩色水怎样沿吸管流入下一只杯子，最终进入接水杯。如杯壁渗水，先停止加水并检查密封；不要用嘴吸水。"
      }
    ],
    "description": "用吸管连接高低不同的杯子，观察彩色水如何逐级流入接水杯。"
  },
  {
    "id": 666,
    "title": "造纸术探秘",
    "video_url": "https://assets.steamx.cc/qimeng-preview/013_造纸术探秘/video_1.mp4",
    "old_materials": [
      {
        "id": 2948,
        "material": "（见实验说明）",
        "project_id": 666,
        "sort_order": 0
      }
    ],
    "old_steps": [
      {
        "id": 4749,
        "title": "见视频",
        "image_url": null,
        "project_id": 666,
        "sort_order": 0,
        "description": "见视频"
      }
    ],
    "old_description": "材料与步骤见正文。",
    "materials": [
      "纸巾适量",
      "清水约 60 毫升",
      "带盖塑料瓶 1 个",
      "量杯 1 个",
      "纱布 1 块",
      "搅拌棒 1 根",
      "试管或光滑圆柱筒 1 个（用于滚压）",
      "托盘 1 个",
      "废旧书本 1 本（用于夹压，会受潮）",
      "水彩笔 1 支（可选，用于在成纸上画图）"
    ],
    "steps": [
      {
        "title": "制作纸浆",
        "description": "用量杯取约 60 毫升清水倒入塑料瓶，将纸巾撕碎后放入水中，盖紧瓶盖并晃动，让碎纸充分浸湿。"
      },
      {
        "title": "静置成浆",
        "description": "将瓶中混合物静置约2小时，直到形成纸浆状态；操作时防止瓶中水洒出。"
      },
      {
        "title": "铺平纸浆",
        "description": "将纱布铺在托盘里，把纸浆倒在纱布的一半区域，用搅拌棒均匀铺成薄层，再把另一半纱布盖在纸浆上。"
      },
      {
        "title": "滚压挤水",
        "description": "用试管或光滑圆柱筒在纱布表面轻轻滚压，让多余水分流到托盘里。使用玻璃试管时避免用力压碎。"
      },
      {
        "title": "夹书压平",
        "description": "将包着纸浆的纱布夹入废旧书本压平，视频静置约 12 小时。若仍潮湿，继续放置至完全干燥。"
      },
      {
        "title": "取纸并绘画",
        "description": "纸浆完全干燥后，轻轻揭开纱布取下成形的纸，观察质地；可用水彩笔在纸上画图。"
      }
    ],
    "description": "把纸巾浸湿、铺浆、压平并晾干，体验制作一张纸的过程。"
  },
  {
    "id": 683,
    "title": "牙签五角星",
    "video_url": "https://assets.steamx.cc/qimeng-preview/041_牙签五角星/video_1.mp4",
    "old_materials": [
      {
        "id": 2975,
        "material": "（见实验说明）",
        "project_id": 683,
        "sort_order": 0
      }
    ],
    "old_steps": [
      {
        "id": 4767,
        "title": "见视频",
        "image_url": null,
        "project_id": 683,
        "sort_order": 0,
        "description": "见视频"
      }
    ],
    "old_description": "材料与步骤见正文。",
    "materials": [
      "牙签 5 根",
      "平底盘子 1 个",
      "滴管 1 根",
      "清水少量"
    ],
    "steps": [
      {
        "title": "折弯牙签",
        "description": "取5根牙签，从中间位置将每根折成角形，注意不要完全折断；牙签尖锐，避免刺伤或入口。"
      },
      {
        "title": "摆成五角星",
        "description": "将五根牙签的弯折处朝向盘子中央，沿圆周均匀摆开，形成五角星轮廓；相邻牙签之间留约 0.5 厘米的空隙，不要互相叠压。"
      },
      {
        "title": "滴水观察",
        "description": "用滴管向盘子中央缓慢滴入少量清水，让水接触五根牙签的弯折处。不要一次倒太多水，也不推动牙签，观察它们逐渐展开并连接成星形。"
      }
    ],
    "description": "将半折断的牙签摆在盘中，滴水观察它们逐渐展开形成星形。"
  },
  {
    "id": 714,
    "title": "乌鸦喝水",
    "video_url": "https://assets.steamx.cc/qimeng-preview/010_乌鸦喝水/video_1.mp4",
    "old_materials": [
      {
        "id": 3034,
        "material": "（见实验说明）",
        "project_id": 714,
        "sort_order": 0
      }
    ],
    "old_steps": [
      {
        "id": 4809,
        "title": "见视频",
        "image_url": null,
        "project_id": 714,
        "sort_order": 0,
        "description": "见视频"
      }
    ],
    "old_description": "材料与步骤见正文。",
    "materials": [
      "乌鸦配套图卡 1 张（用于情境展示）",
      "透明量杯 1 个",
      "清水约 20 毫升",
      "洗净的小石子适量",
      "双面胶"
    ],
    "steps": [
      {
        "title": "制作乌鸦卡片",
        "description": "将乌鸦图卡对折，用双面胶把两面粘好，折出底部支撑，使图卡能立在杯子旁边。"
      },
      {
        "title": "准备水杯",
        "description": "在量杯中加入约20毫升水，把粘好的乌鸦卡片与量杯摆放在一起。"
      },
      {
        "title": "加入小石子",
        "description": "将洗净的小石子逐粒轻放入杯中，每加几粒就观察水面位置。石子不入口，避免投入过快溅水。"
      },
      {
        "title": "观察水位",
        "description": "继续加入小石子，观察水位逐渐上升；缓慢加入，避免水溅出。"
      }
    ],
    "description": "逐粒向杯中加入小石子，观察水位如何变化。"
  },
  {
    "id": 728,
    "title": "叛逆的瓶子",
    "video_url": "https://assets.steamx.cc/wanzhuan1/101_叛逆的瓶子/video_1.mp4",
    "old_materials": [
      {
        "id": 3598,
        "material": "（见实验说明）",
        "project_id": 728,
        "sort_order": 0
      }
    ],
    "old_steps": [
      {
        "id": 5403,
        "title": "见视频",
        "image_url": null,
        "project_id": 728,
        "sort_order": 0,
        "description": "见视频"
      }
    ],
    "old_description": "材料与步骤见正文。",
    "materials": [
      "带盖塑料瓶 1 个",
      "清水",
      "色素少量（可选，便于观察）",
      "大头针 1 枚",
      "接水盆或托盘 1 个（自备）"
    ],
    "steps": [
      {
        "title": "装水染色",
        "description": "向塑料瓶中倒满水；为便于观察可加入少量色素并混匀。"
      },
      {
        "title": "密封瓶口",
        "description": "拧紧瓶盖。"
      },
      {
        "title": "扎出小孔",
        "description": "在接水盆上方，用大头针在瓶身靠近底部的位置扎出小孔，针尖远离手指和脸；按视频可在底部周围做几个小孔，孔不要太大。"
      },
      {
        "title": "观察控水",
        "description": "把瓶子竖直放在接水盆上方，先观察瓶盖拧紧时的出水情况；再松开瓶盖，观察水流变化，随后重新拧紧作比较。瓶盖漏气或孔过大会影响现象，不必要求完全不滴水。"
      }
    ],
    "description": "在有小孔的水瓶上松开和拧紧瓶盖，比较出水情况。"
  },
  {
    "id": 730,
    "title": "针扎气球",
    "video_url": "https://assets.steamx.cc/wanzhuan1/094_针扎气球/video_1.mp4",
    "old_materials": [
      {
        "id": 3601,
        "material": "（见实验说明）",
        "project_id": 730,
        "sort_order": 0
      }
    ],
    "old_steps": [
      {
        "id": 5407,
        "title": "见视频",
        "image_url": null,
        "project_id": 730,
        "sort_order": 0,
        "description": "见视频"
      }
    ],
    "old_description": "材料与步骤见正文。",
    "materials": [
      "气球 1 个",
      "大头针 1 枚"
    ],
    "steps": [
      {
        "title": "吹起气球",
        "description": "把气球吹到适中大小并扎紧气嘴，不要吹得过鼓。"
      },
      {
        "title": "从底部最厚处扎入",
        "description": "找准气球底部最厚的位置，即气嘴对面的深色点，从这里将大头针缓慢扎入；针尖远离眼睛、脸和手指。"
      },
      {
        "title": "移除针",
        "description": "缓慢拔出大头针，观察气球是否仍保持完整以及是否开始漏气。气球也可能破裂，始终远离面部。"
      },
      {
        "title": "观察变小",
        "description": "若气球开始缓慢变小，将针插回原来的小孔，比较漏气速度是否改变。结束后收好针具和气球，及时清理碎片。"
      }
    ],
    "description": "在气球较厚位置扎针，观察气球是否漏气以及大小变化。"
  },
  {
    "id": 769,
    "title": "站不稳的火柴盒",
    "video_url": "https://assets.steamx.cc/wanzhuan1/069_站不稳的火柴盒/video_1.mp4",
    "old_materials": [
      {
        "id": 3694,
        "material": "（见实验说明）",
        "project_id": 769,
        "sort_order": 0
      }
    ],
    "old_steps": [
      {
        "id": 5520,
        "title": "见视频",
        "image_url": null,
        "project_id": 769,
        "sort_order": 0,
        "description": "见视频"
      }
    ],
    "old_description": "材料与步骤见正文。",
    "materials": [
      "抽屉式火柴盒 1 个（视频使用装有火柴的盒子，不点燃）"
    ],
    "steps": [
      {
        "title": "拿稳火柴盒",
        "description": "拿出火柴盒并把内盒完全合上，竖直拿稳，让窄端朝下。此实验不点燃火柴，散落火柴及时收起。"
      },
      {
        "title": "同高落下",
        "description": "将火柴盒抬到距桌面约 15—30 厘米处，松手让它竖直落下，观察落地后是否站稳。用同样的方法重复几次。"
      },
      {
        "title": "改变内盒位置",
        "description": "保持同一个火柴盒，把内盒向上推出约 1—2 厘米，突出的一端朝上。从与前面相同的高度竖直松手，比较落地后的姿态。"
      }
    ],
    "description": "比较火柴盒完全合上与内盒推出一小段时，从相同高度落下的姿态。"
  },
  {
    "id": 794,
    "title": "走马灯",
    "video_url": "https://assets.steamx.cc/wanzhuan1/042_走马灯/video_1.mp4",
    "old_materials": [
      {
        "id": 3755,
        "material": "（见实验说明）",
        "project_id": 794,
        "sort_order": 0
      }
    ],
    "old_steps": [
      {
        "id": 5593,
        "title": "见视频",
        "image_url": null,
        "project_id": 794,
        "sort_order": 0,
        "description": "见视频"
      }
    ],
    "old_description": "材料与步骤见正文。",
    "materials": [
      "走马灯配套组件 1 套（木底座、木支杆、套管/笔杆、预切圆形灯罩顶片、长方形图案纸、中心子母扣）",
      "双面胶",
      "配套小蜡烛 1 支",
      "打火机 1 个"
    ],
    "steps": [
      {
        "title": "组装支架",
        "description": "将木支杆插入底座中心孔，再按视频把配套套管/笔杆套到支杆上，确认支架竖直、底座稳固。"
      },
      {
        "title": "折出叶片",
        "description": "将圆形灯罩顶片上的六片扇形叶片沿预切折线向同一方向轻轻翘起约 3 毫米，保留通气缝隙，不撕断叶片。再把顶片外圈沿折线向下折。"
      },
      {
        "title": "围成灯罩",
        "description": "沿顶片折下的外圈贴双面胶，将长方形图案纸围在外圈粘成圆筒，并粘好纸筒接缝。筒底保持敞开。"
      },
      {
        "title": "安装中心支点",
        "description": "按照视频在灯罩顶片中心安装配套子母扣，把灯罩支在支杆顶端。检查灯罩是否平衡、能自由转动，不能用胶把灯罩粘死在支杆上。"
      },
      {
        "title": "演示旋转",
        "description": "将配套小蜡烛放在底座上、灯罩下方并点燃，观察灯罩的转动。确保火焰不接触纸罩或支杆；若纸罩下垂、倾斜或出现焦味，立即熄灭。结束后熄灭蜡烛。"
      }
    ],
    "description": "组装配套走马灯，观察蜡烛加热时灯罩的转动。"
  },
  {
    "id": 855,
    "title": "水卷龙卷风",
    "video_url": "https://assets.steamx.cc/jichu-haohua/041_40.水卷龙卷风/video_1.mp4",
    "old_materials": [
      {
        "id": 3896,
        "material": "（见实验说明）",
        "project_id": 855,
        "sort_order": 0
      }
    ],
    "old_steps": [
      {
        "id": 5796,
        "title": "见视频",
        "image_url": null,
        "project_id": 855,
        "sort_order": 0,
        "description": "见视频"
      }
    ],
    "old_description": "材料与步骤见正文。",
    "materials": [
      "瓶口与连接器匹配的塑料瓶 2 个（至少装水的一只透明）",
      "龙卷风实验专用双瓶口连接器 1 个",
      "清水",
      "色素少量"
    ],
    "steps": [
      {
        "title": "装水并调色",
        "description": "在一个塑料瓶中加入约四分之三瓶清水，滴入少量色素。另一只瓶子保持空着。"
      },
      {
        "title": "连接瓶口",
        "description": "用瓶口连接件把两个塑料瓶对接并拧紧，检查连接处不漏水。"
      },
      {
        "title": "翻转装置",
        "description": "把装水的瓶子翻到上方，握稳上下两个瓶子。"
      },
      {
        "title": "旋转观察",
        "description": "握紧连接处，让上方瓶子沿顺时针或逆时针方向绕圈晃动几次，再保持竖直，观察水中形成的旋涡和向下流动的水。若连接处漏水，先停下重新拧紧。"
      }
    ],
    "description": "连接两只塑料瓶，通过翻转和绕圈晃动观察水中的旋涡。"
  },
  {
    "id": 858,
    "title": "烛火的温度",
    "video_url": "https://assets.steamx.cc/jichu-haohua/027_54.烛火的温度/video_1.mp4",
    "old_materials": [
      {
        "id": 3903,
        "material": "（见实验说明）",
        "project_id": 858,
        "sort_order": 0
      }
    ],
    "old_steps": [
      {
        "id": 5803,
        "title": "步骤 1",
        "image_url": null,
        "project_id": 858,
        "sort_order": 0,
        "description": "点燃蜡烛待燃烧正常。"
      },
      {
        "id": 5804,
        "title": "步骤 2",
        "image_url": null,
        "project_id": 858,
        "sort_order": 1,
        "description": "取牙签横着放在火焰芯处，数3秒，快速取出。"
      },
      {
        "id": 5805,
        "title": "步骤 3",
        "image_url": null,
        "project_id": 858,
        "sort_order": 2,
        "description": "观察牙签灼烧现象，中间被烧最轻，两侧被烧焦较深。"
      }
    ],
    "old_description": "科学原理：蜡烛火焰分三层，从外到内的顺序依次为：外焰，内焰，焰心，与酒精灯的火焰分层相似，由于外火焰部分与氧气充分接触，燃烧充分放热，所以温度高。燃烧时氧气只提供氧元素，所以燃烧产物为二氧化碳和水。",
    "materials": [
      "小蜡烛（茶蜡）1 支",
      "打火机 1 个",
      "牙签",
      "耐热金属镊子或夹子（自备，用于夹持牙签）",
      "耐热托盘（自备）"
    ],
    "steps": [
      {
        "title": "点燃蜡烛",
        "description": "将蜡烛放在耐热托盘上并点燃，等待火焰稳定。"
      },
      {
        "title": "加热牙签",
        "description": "用耐热金属镊子或夹子夹住牙签的一端，让牙签中段横穿火焰下部。观察约 3 秒后立即移开，不要把牙签烧断；若起火立即熄灭。"
      },
      {
        "title": "观察灼烧痕迹",
        "description": "熄灭蜡烛，待牙签冷却后观察中间和两侧的灼烧痕迹，比较哪一部分颜色更深。"
      }
    ],
    "description": null
  },
  {
    "id": 870,
    "title": "同极相斥",
    "video_url": "https://assets.steamx.cc/jichu-haohua/007_154.同极相斥/video_1.mp4",
    "old_materials": [
      {
        "id": 3932,
        "material": "自备（磁铁x2）",
        "project_id": 870,
        "sort_order": 0
      },
      {
        "id": 3933,
        "material": "实验过程：",
        "project_id": 870,
        "sort_order": 1
      },
      {
        "id": 3934,
        "material": "1.把两个磁铁随手放在一起",
        "project_id": 870,
        "sort_order": 2
      },
      {
        "id": 3935,
        "material": "会吸附起来",
        "project_id": 870,
        "sort_order": 3
      },
      {
        "id": 3936,
        "material": "2.把其中一个磁铁磁极翻转",
        "project_id": 870,
        "sort_order": 4
      },
      {
        "id": 3937,
        "material": "靠近会感觉有一股斥力",
        "project_id": 870,
        "sort_order": 5
      }
    ],
    "old_steps": [
      {
        "id": 5840,
        "title": "见视频",
        "image_url": null,
        "project_id": 870,
        "sort_order": 0,
        "description": "见视频"
      }
    ],
    "old_description": "科学原理：当两个磁铁相互靠近时，相同的磁极会互相排斥，不相同的磁极会相互吸引。同极相斥，异极相吸。",
    "materials": [
      "圆片磁铁 2 块"
    ],
    "steps": [
      {
        "title": "观察吸引",
        "description": "在平整桌面上拿一块磁铁慢慢靠近另一块。若互相推开，先将其中一块翻面，再靠近，观察两块磁铁相互吸引。不要让磁铁猛撞或夹住手指。"
      },
      {
        "title": "翻转磁铁",
        "description": "把两块磁铁分开，保持一块朝向不变，将另一块上下翻面，再沿桌面缓慢靠近。"
      },
      {
        "title": "比较现象",
        "description": "观察另一块磁铁是否被推开，再翻面试一次，比较两种朝向下的吸引与排斥。实验后收好磁铁，不放入口中。"
      }
    ],
    "description": null
  },
  {
    "id": 875,
    "title": "色素狂舞",
    "video_url": "https://assets.steamx.cc/jichu-haohua/002_159.色素狂舞/video_1.mp4",
    "old_materials": [
      {
        "id": 3947,
        "material": "色素若干",
        "project_id": 875,
        "sort_order": 0
      },
      {
        "id": 3948,
        "material": "自备（玻璃杯2个、冷水、热水）",
        "project_id": 875,
        "sort_order": 1
      },
      {
        "id": 3949,
        "material": "实验过程:",
        "project_id": 875,
        "sort_order": 2
      },
      {
        "id": 3950,
        "material": "1.首先",
        "project_id": 875,
        "sort_order": 3
      },
      {
        "id": 3951,
        "material": "分别往杯中倒入一杯凉水和一杯热水(约80度)",
        "project_id": 875,
        "sort_order": 4
      },
      {
        "id": 3952,
        "material": "2.然后分别往凉水杯和热水杯各滴入同样的色素",
        "project_id": 875,
        "sort_order": 5
      },
      {
        "id": 3953,
        "material": "冷水杯中的色素呈团状快速往杯底坠落",
        "project_id": 875,
        "sort_order": 6
      },
      {
        "id": 3954,
        "material": "而热水杯中的色素",
        "project_id": 875,
        "sort_order": 7
      },
      {
        "id": 3955,
        "material": "一进到水中便开始舞动着向四周快速弥漫",
        "project_id": 875,
        "sort_order": 8
      },
      {
        "id": 3956,
        "material": "不停打转",
        "project_id": 875,
        "sort_order": 9
      },
      {
        "id": 3957,
        "material": "就像是垫着脚尖跳芭蕾的舞者旋转着身体",
        "project_id": 875,
        "sort_order": 10
      },
      {
        "id": 3958,
        "material": "呈现出曼妙的舞姿",
        "project_id": 875,
        "sort_order": 11
      }
    ],
    "old_steps": [
      {
        "id": 5852,
        "title": "见视频",
        "image_url": null,
        "project_id": 875,
        "sort_order": 0,
        "description": "见视频"
      }
    ],
    "old_description": "科学原理：这是色素分子在凉水和热水中不同的扩散速度所致。物质分子从高浓度区域向低浓度区域转移直到分布均匀的现象叫做扩散，也叫分子传质。密度差越大、温度越高,扩散速度越快。所以，色素在热水中的扩散速度明显要快于在常温凉水中的扩散速度",
    "materials": [
      "相同的透明耐热杯 2 个",
      "同一种色素少量（滴口瓶，或另备滴管）",
      "等量冷水和热水（视频约 80℃）"
    ],
    "steps": [
      {
        "title": "准备两杯水",
        "description": "在两只相同的耐热杯里分别倒入等量冷水和约 80℃的热水，放在平稳桌面。不要触碰热水杯壁。"
      },
      {
        "title": "滴入色素",
        "description": "向两杯水中分别滴入相同滴数的同一种色素，滴入位置和高度尽量相同，不搅拌、不晃动杯子。"
      },
      {
        "title": "比较扩散",
        "description": "观察色素进入水中后的形状、移动和散开过程，比较哪一杯中颜色更快分布开来；可按相同时间间隔记录。实验用水不饮用。"
      }
    ],
    "description": "向冷水和热水中滴入同样的色素，比较色素散开的过程。"
  },
  {
    "id": 892,
    "title": "逃出手心",
    "video_url": "https://assets.steamx.cc/jichu-haohua/069_252.逃出手心/video_1.mp4",
    "old_materials": [
      {
        "id": 4012,
        "material": "铁环",
        "project_id": 892,
        "sort_order": 0
      },
      {
        "id": 4013,
        "material": "细链",
        "project_id": 892,
        "sort_order": 1
      }
    ],
    "old_steps": [
      {
        "id": 5912,
        "title": "见视频",
        "image_url": null,
        "project_id": 892,
        "sort_order": 0,
        "description": "见视频"
      }
    ],
    "old_description": "实验材料铁环、细链",
    "materials": [
      "铁环 1 个",
      "与铁环配套的细链 1 条"
    ],
    "steps": [
      {
        "title": "两人配合准备",
        "description": "一人握拳并竖起拇指。另一人按视频将铁环和细链挂在其拇指处，向外拉出两股细链；链条保持松弛，不勒住手指。"
      },
      {
        "title": "第一次交叉",
        "description": "按照视频约 10—16 秒的方向，将拉出的两股细链交叉，用一根食指撑住远端形成的链圈。"
      },
      {
        "title": "第二次交叉",
        "description": "将另一只手的食指放进拇指与远端食指之间的链圈，按视频约 16—24 秒的方向再交叉一次；保持两根食指的位置，不把链条拉紧。"
      },
      {
        "title": "让细链脱出",
        "description": "将靠近同伴的食指与同伴的拇指相对，另一只手轻轻向后拉，观察细链如何脱出。若未成功，先松开复位，再暂停视频核对两次交叉的方向，不要用力拽。"
      }
    ],
    "description": "两人配合，用铁环和细链练习视频中的交叉与脱环动作。"
  },
  {
    "id": 894,
    "title": "炫彩瀑布",
    "video_url": "https://assets.steamx.cc/jichu-haohua/067_254.炫彩瀑布/video_1.mp4",
    "old_materials": [
      {
        "id": 4016,
        "material": "（见实验说明）",
        "project_id": 894,
        "sort_order": 0
      }
    ],
    "old_steps": [
      {
        "id": 5914,
        "title": "见视频",
        "image_url": null,
        "project_id": 894,
        "sort_order": 0,
        "description": "见视频"
      }
    ],
    "old_description": "材料与步骤见正文。",
    "materials": [
      "透明塑料瓶 1 个（瓶口能容纳粘好糖的搅拌棒）",
      "清水",
      "彩虹糖数粒",
      "长搅拌棒 1 根",
      "双面胶"
    ],
    "steps": [
      {
        "title": "准备水瓶",
        "description": "在透明塑料瓶中加入清水，接近瓶口但留少量空间，避免放入搅拌棒时溢出。"
      },
      {
        "title": "制作粘附段",
        "description": "在搅拌棒约三分之一处缠绕双面胶，做出约 2 厘米宽的粘贴区域，撕去离型纸。"
      },
      {
        "title": "粘上彩色糖果",
        "description": "把彩虹糖逐个粘在双面胶上，检查糖果固定牢靠。"
      },
      {
        "title": "放入瓶中",
        "description": "握住搅拌棒上端，把带有彩虹糖的一端放进装水的透明瓶中。"
      },
      {
        "title": "观察溶解扩散",
        "description": "保持搅拌棒不动，不搅拌，观察糖衣颜色在水中向下散开，形成彩色细流。用过的糖、水和搅拌棒不再用于饮食。"
      }
    ],
    "description": "将粘有彩虹糖的搅拌棒放入清水，观察糖衣颜色形成的彩色细流。"
  },
  {
    "id": 1006,
    "title": "站起来的幽灵",
    "video_url": "https://assets.steamx.cc/gaopei/071_491.站起来的幽灵/video_1.mp4",
    "old_materials": [
      {
        "id": 4262,
        "material": "（见实验说明）",
        "project_id": 1006,
        "sort_order": 0
      }
    ],
    "old_steps": [
      {
        "id": 6296,
        "title": "见视频",
        "image_url": null,
        "project_id": 1006,
        "sort_order": 0,
        "description": "见视频"
      }
    ],
    "old_description": "材料与步骤见正文。",
    "materials": [
      "纸巾",
      "彩色水笔或马克笔",
      "剪刀",
      "双面胶",
      "吸管",
      "毛巾或绒布"
    ],
    "steps": [
      {
        "title": "画幽灵图案",
        "description": "用彩色水笔在纸巾上画出幽灵轮廓和面部细节。"
      },
      {
        "title": "剪下并揭层",
        "description": "沿轮廓剪下纸巾幽灵，再轻轻揭下带有图案的一层，让它足够轻薄。"
      },
      {
        "title": "固定底部",
        "description": "用双面胶只固定幽灵脚部或底部到桌面，保持身体可以被吸引并竖起。"
      },
      {
        "title": "摩擦吸管",
        "description": "用毛巾或绒布摩擦塑料吸管，使吸管带电。"
      },
      {
        "title": "让幽灵站起",
        "description": "把摩擦后的吸管靠近纸幽灵，观察纸幽灵被吸引并竖起。"
      }
    ],
    "description": "用摩擦后的塑料吸管靠近轻薄的纸巾幽灵，观察它被吸起的现象。"
  },
  {
    "id": 1007,
    "title": "奇妙相遇",
    "video_url": "https://assets.steamx.cc/gaopei/070_492.奇妙相遇/video_1.mp4",
    "old_materials": [
      {
        "id": 4263,
        "material": "（见实验说明）",
        "project_id": 1007,
        "sort_order": 0
      }
    ],
    "old_steps": [
      {
        "id": 6297,
        "title": "步骤 1",
        "image_url": null,
        "project_id": 1007,
        "sort_order": 0,
        "description": "在水杯中倒入碘伏"
      },
      {
        "id": 6298,
        "title": "步骤 2",
        "image_url": null,
        "project_id": 1007,
        "sort_order": 1,
        "description": "用搅拌棒将碘酒与水相溶，水被染成红色"
      },
      {
        "id": 6299,
        "title": "步骤 3",
        "image_url": null,
        "project_id": 1007,
        "sort_order": 2,
        "description": "将VC片用手掰碎后放入水中，观察红色的水消失了"
      }
    ],
    "old_description": "科学原理：碘伏会氧化水分子产生自由基就如苹果放在空气中会变色一样，而维生素\nC是水溶性抗体，对自由基是死敌，所以会把自由基杀死，所以维生素C在\n人体内有充当抗体的功能对对抗自由基，延缓衰老有神奇作用。",
    "materials": [
      "透明水杯 1 个",
      "清水适量",
      "碘伏少量（与视频一致，不用碘酒替代）",
      "维生素 C 片 1 片",
      "搅拌棒 1 根"
    ],
    "steps": [
      {
        "title": "准备清水",
        "description": "在透明水杯中倒入适量清水，留出搅拌空间。容器和实验液不用于饮食。"
      },
      {
        "title": "加入碘伏",
        "description": "向水中加入少量碘伏，用搅拌棒轻轻搅匀，观察水的颜色。"
      },
      {
        "title": "加入维生素C",
        "description": "放入维生素 C 片，轻轻搅拌并观察颜色逐渐变浅的过程。不品尝实验液，结束后洗手。"
      }
    ],
    "description": "把碘伏加入清水，再放入维生素 C 片，观察水的颜色怎样变化。"
  },
  {
    "id": 1041,
    "title": "喇叭吹蜡烛",
    "video_url": "https://assets.steamx.cc/gaopei/002_559.喇叭吹蜡烛/video_1.mp4",
    "old_materials": [
      {
        "id": 4347,
        "material": "（见实验说明）",
        "project_id": 1041,
        "sort_order": 0
      }
    ],
    "old_steps": [
      {
        "id": 6417,
        "title": "见视频",
        "image_url": null,
        "project_id": 1041,
        "sort_order": 0,
        "description": "见视频"
      }
    ],
    "old_description": "材料与步骤见正文。",
    "materials": [
      "A4纸 1 张",
      "小蜡烛（茶蜡）1 支",
      "打火机 1 个",
      "耐热托盘（自备）"
    ],
    "steps": [
      {
        "title": "制作纸喇叭",
        "description": "将A4纸卷成喇叭状，保留较小的吹气端和较大的出气口。"
      },
      {
        "title": "点燃蜡烛",
        "description": "将蜡烛放在耐热托盘上点燃。纸张、头发和衣物保持在火焰之外，不把纸筒伸到火焰上方。"
      },
      {
        "title": "大口朝向火焰",
        "description": "将纸喇叭大口朝向蜡烛，从小口平稳吹气，观察火焰的变化。不要为了追求效果把纸喇叭不断贴近火焰。"
      },
      {
        "title": "小口朝向火焰",
        "description": "把纸喇叭调转方向，小口朝向蜡烛，从大口吹气，尽量保持相同的距离和吹气力度，比较两次结果。视频中大口朝蜡烛时未吹灭、小口朝蜡烛时吹灭；实际结果也会受距离和力度影响。结束后确认蜡烛熄灭。"
      }
    ],
    "description": "比较纸喇叭大小口朝向蜡烛时，吹气效果有什么不同。"
  },
  {
    "id": 1097,
    "title": "魔法开花树",
    "video_url": "https://assets.steamx.cc/gaopei/002_魔法开花树/video_1.mp4",
    "old_materials": [
      {
        "id": 4517,
        "material": "（见实验说明）",
        "project_id": 1097,
        "sort_order": 0
      }
    ],
    "old_steps": [
      {
        "id": 6607,
        "title": "见视频",
        "image_url": null,
        "project_id": 1097,
        "sort_order": 0,
        "description": "见视频"
      }
    ],
    "old_description": "材料与步骤见正文。",
    "materials": [
      "魔法开花树配套纸树 2 片",
      "配套托盘 1 个",
      "材料包随附的结晶液 1 袋（按包装说明使用）"
    ],
    "steps": [
      {
        "title": "组装纸树",
        "description": "取出两片配套纸树，沿开口交叉插合成能站立的树形，轻轻展开纸枝。"
      },
      {
        "title": "固定在托盘",
        "description": "将纸树底部插入托盘的插槽，确认树能稳稳站立，把托盘放在不易碰到的平整位置。"
      },
      {
        "title": "浇上配套液体",
        "description": "按材料包说明将配套结晶液缓缓浇在纸树上，让多余液体留在托盘内。不自行调配或替换试剂，不入口、不揉眼。"
      },
      {
        "title": "等待并记录",
        "description": "保持托盘静置，定时观察纸枝上的变化。视频展示约 5—8 小时后的“开花”效果，实际时间以配套说明和观察结果为准；不要触碰刚长出的晶体。"
      }
    ],
    "description": "组装配套纸树并加入结晶液，观察纸枝逐渐出现彩色晶体。"
  },
  {
    "id": 1101,
    "title": "磁铁大转盘",
    "video_url": "https://assets.steamx.cc/qijian/134_496.磁铁大转盘/video_1.mp4",
    "old_materials": [
      {
        "id": 4521,
        "material": "（见实验说明）",
        "project_id": 1101,
        "sort_order": 0
      }
    ],
    "old_steps": [
      {
        "id": 6618,
        "title": "见视频",
        "image_url": null,
        "project_id": 1101,
        "sort_order": 0,
        "description": "见视频"
      }
    ],
    "old_description": "材料与步骤见正文。",
    "materials": [
      "同规格小圆片磁铁 4 块",
      "能承载磁铁漂浮的塑料瓶盖 4 个",
      "水盆 1 个",
      "清水",
      "双面胶"
    ],
    "steps": [
      {
        "title": "统一磁铁朝向",
        "description": "先让四块小圆片磁铁叠在一起，按相同朝向依次分开，避免翻面。确认它们能分别放入瓶盖内；磁铁不要入口，谨防夹手。"
      },
      {
        "title": "固定到瓶盖",
        "description": "在每个瓶盖内侧底部中央贴上双面胶，将一块磁铁固定在中央，四块磁铁朝上的面保持相同。"
      },
      {
        "title": "准备水盆",
        "description": "向水盆倒入清水，水深能让瓶盖自由漂浮即可。轻轻放入第一个瓶盖，确认盖口朝上且不会进水沉底。"
      },
      {
        "title": "逐个加入观察",
        "description": "依次放入第二、第三、第四个瓶盖，每次放入后等待水面平稳，观察瓶盖相互靠近或分开后停留的位置。若互相吸到一起，取出检查磁铁朝向；位置也会受盆形和水流影响，不要求一定排成正方形。"
      }
    ],
    "description": "把同向的小磁铁固定在漂浮的瓶盖里，观察它们在水盆中怎样分开和移动。"
  }
]
$fun_payload$::jsonb) AS x(id bigint, title text, video_url text,
  old_materials jsonb, old_steps jsonb, old_description text,
  materials jsonb, steps jsonb, description text);

DO $$
DECLARE e record; actual jsonb;
BEGIN
  IF (SELECT count(*) FROM _fun_content) <> 22 THEN
    RAISE EXCEPTION 'Fun science whitelist must contain 22 projects';
  END IF;
  FOR e IN SELECT * FROM _fun_content ORDER BY id LOOP
    PERFORM 1 FROM public.projects WHERE id = e.id FOR UPDATE;
    IF NOT EXISTS (SELECT 1 FROM public.projects p WHERE p.id = e.id
      AND p.title = e.title AND p.video_url = e.video_url
      AND p.status = 'approved' AND p.tags @> ARRAY['趣味实验']::text[]
      AND (e.description IS NULL OR p.description IS NOT DISTINCT FROM e.old_description)) THEN
      RAISE EXCEPTION 'Fun science project % changed; re-review before applying', e.id;
    END IF;
    PERFORM 1 FROM public.project_materials WHERE project_id = e.id FOR UPDATE;
    SELECT jsonb_agg(to_jsonb(m) ORDER BY m.sort_order, m.id) INTO actual
      FROM public.project_materials m WHERE m.project_id = e.id;
    IF actual IS DISTINCT FROM e.old_materials THEN
      RAISE EXCEPTION 'Fun science materials changed for %', e.id;
    END IF;
    PERFORM 1 FROM public.project_steps WHERE project_id = e.id FOR UPDATE;
    SELECT jsonb_agg(to_jsonb(s) ORDER BY s.sort_order, s.id) INTO actual
      FROM public.project_steps s WHERE s.project_id = e.id;
    IF actual IS DISTINCT FROM e.old_steps THEN
      RAISE EXCEPTION 'Fun science steps changed for %', e.id;
    END IF;
    IF jsonb_array_length(e.materials) = 0 OR jsonb_array_length(e.steps) = 0 THEN
      RAISE EXCEPTION 'Empty replacement for %', e.id;
    END IF;
  END LOOP;
END $$;

-- Retain existing row IDs at corresponding positions; only surplus rows are deleted.
CREATE TEMP TABLE _fun_materials ON COMMIT DROP AS
SELECT e.id AS project_id, (v.ord - 1)::integer AS sort_order, v.value AS material,
       (e.old_materials->((v.ord - 1)::integer)->>'id')::bigint AS old_id
FROM _fun_content e CROSS JOIN LATERAL jsonb_array_elements_text(e.materials) WITH ORDINALITY v(value, ord);
CREATE TEMP TABLE _fun_steps ON COMMIT DROP AS
SELECT e.id AS project_id, (v.ord - 1)::integer AS sort_order,
       v.value->>'title' AS title, v.value->>'description' AS description,
       (e.old_steps->((v.ord - 1)::integer)->>'id')::bigint AS old_id
FROM _fun_content e CROSS JOIN LATERAL jsonb_array_elements(e.steps) WITH ORDINALITY v(value, ord);
CREATE TEMP TABLE _fun_delete_rows (parent_table text, row_id bigint) ON COMMIT DROP;
INSERT INTO _fun_delete_rows
SELECT 'project_materials', m.id FROM public.project_materials m JOIN _fun_content e ON e.id=m.project_id
WHERE NOT EXISTS (SELECT 1 FROM _fun_materials n WHERE n.old_id=m.id)
UNION ALL
SELECT 'project_steps', s.id FROM public.project_steps s JOIN _fun_content e ON e.id=s.project_id
WHERE NOT EXISTS (SELECT 1 FROM _fun_steps n WHERE n.old_id=s.id);

DO $$
DECLARE fk record; has_refs boolean;
BEGIN
  FOR fk IN
    SELECT c.conkey, c.confkey, n.nspname AS child_schema, child.relname AS child_table,
      a.attname AS child_column, parent.relname AS parent_table
    FROM pg_constraint c JOIN pg_class child ON child.oid=c.conrelid
    JOIN pg_namespace n ON n.oid=child.relnamespace
    JOIN pg_class parent ON parent.oid=c.confrelid
    JOIN pg_namespace pn ON pn.oid=parent.relnamespace
    JOIN pg_attribute a ON a.attrelid=child.oid AND a.attnum=c.conkey[1]
    WHERE c.contype='f' AND pn.nspname='public'
      AND parent.relname IN (SELECT DISTINCT parent_table FROM _fun_delete_rows)
  LOOP
    IF array_length(fk.conkey,1) <> 1 OR array_length(fk.confkey,1) <> 1 THEN
      RAISE EXCEPTION 'Composite reference to % requires review before deletion', fk.parent_table;
    END IF;
    EXECUTE format('SELECT EXISTS (SELECT 1 FROM %I.%I c JOIN pg_temp._fun_delete_rows d ON c.%I=d.row_id WHERE d.parent_table=%L)',
      fk.child_schema, fk.child_table, fk.child_column, fk.parent_table) INTO has_refs;
    IF has_refs THEN
      RAISE EXCEPTION 'Referenced content row in %.%; aborting', fk.child_schema, fk.child_table;
    END IF;
  END LOOP;
END $$;

UPDATE public.project_materials m SET material=n.material, sort_order=n.sort_order
FROM _fun_materials n WHERE m.id=n.old_id;
INSERT INTO public.project_materials(project_id, material, sort_order)
SELECT project_id, material, sort_order FROM _fun_materials WHERE old_id IS NULL ORDER BY project_id, sort_order;
DELETE FROM public.project_materials m USING _fun_delete_rows d WHERE d.parent_table='project_materials' AND m.id=d.row_id;
UPDATE public.project_steps s SET title=n.title, description=n.description, sort_order=n.sort_order
FROM _fun_steps n WHERE s.id=n.old_id;
INSERT INTO public.project_steps(project_id,title,description,sort_order)
SELECT project_id,title,description,sort_order FROM _fun_steps WHERE old_id IS NULL ORDER BY project_id,sort_order;
DELETE FROM public.project_steps s USING _fun_delete_rows d WHERE d.parent_table='project_steps' AND s.id=d.row_id;
UPDATE public.projects p SET description=coalesce(e.description,p.description),updated_at=now()
FROM _fun_content e WHERE p.id=e.id;
COMMIT;
