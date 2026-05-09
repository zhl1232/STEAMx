-- Remove placeholder bird observation events that escaped the previous cleanup
-- because their notes use Chinese full stops.
WITH fake_events AS (
    SELECT id
    FROM public.observation_events
    WHERE id IN (1, 2, 3)
      AND (
          (location_name = '奥林匹克森林公园南园湿地'
           AND notes = '湖面边缘活动较多，晨间人流较少，适合初学者连续观察。')
       OR (location_name = '校园树林与操场边绿地'
           AND notes = '以晨间听声辨位为主，先记录出现位置，再补充外形特征。')
       OR (location_name = '北海公园湖区'
           AND notes = '定点停留约 50 分钟，优先记录行为而不是拍照。')
      )
),
deleted_species AS (
    DELETE FROM public.observation_event_species
    WHERE observation_event_id IN (SELECT id FROM fake_events)
    RETURNING 1
)
DELETE FROM public.observation_events
WHERE id IN (SELECT id FROM fake_events);
