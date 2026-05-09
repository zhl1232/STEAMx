-- ============================================
-- 修正 species 文案中的相对描述，确保物种详情可独立阅读
-- ============================================

WITH note_fixes(slug, identification_notes, habitat_notes) AS (
  VALUES
    (
      'cygnus-columbianus',
      NULL,
      '喜欢栖息于大型开阔水域，迁徙和越冬期常在水库、湖泊、河道以及市区较大水面停歇。'
    ),
    (
      'anas-poecilorhyncha',
      NULL,
      '栖息于河流、湖泊、公园水面、鱼塘和水库等多种湿地环境。'
    ),
    (
      'aix-galericulata',
      '小型游禽，全长38~45厘米。成年雄鸟繁殖期羽色绚丽，具橙色扇形冠羽、栗色胸部和醒目的翼帆；非繁殖期雄鸟整体转为灰褐色，眼周仍可见浅色纹。雌鸟羽色灰暗，眼周有明显的白色眼圈和眼线。',
      NULL
    ),
    (
      'bombycilla-japonica',
      '小型鸣禽，全长16~20厘米。整体为浅紫褐色，头顶有明显羽冠，贯眼纹及颏部黑色；最明显的识别特征是12枚尾羽末端有红色斑点。',
      '从市区公园、居民区绿地到郊区山野都有分布，常见于有松柏类针叶林和结果树木的环境，也经常混群活动。'
    ),
    (
      'turdus-eunomus',
      NULL,
      '在果园、林地环境比较常见，北京市区园林中也有一定数量分布。'
    )
)
UPDATE public.species AS species
   SET identification_notes = COALESCE(note_fixes.identification_notes, species.identification_notes),
       habitat_notes = COALESCE(note_fixes.habitat_notes, species.habitat_notes),
       updated_at = now()
  FROM note_fixes
 WHERE species.slug = note_fixes.slug;
