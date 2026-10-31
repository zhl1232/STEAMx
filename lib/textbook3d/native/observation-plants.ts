/** Rebuilt from the shipped p1a-1-2 lesson, not recovered textbook source. */
export const OBSERVATION_PLANTS = [
  {
    id: "leaf", name: "叶", feature: "绿色，扁扁的",
    observation: "看一看叶片的颜色和形状，沿着中间和两边找一找叶脉。",
    record: ["叶", "绿色，扁扁的", "有叶脉"],
  },
  {
    id: "stem", name: "茎", feature: "直直的",
    observation: "从下面的细根往上看，找一找茎和叶连接的地方。",
    record: ["茎", "直直的", "连着叶和根"],
  },
  {
    id: "flower", name: "花", feature: "颜色鲜艳",
    observation: "找一找围在花心旁边的花瓣，说说它们的颜色和形状。",
    record: ["花", "颜色鲜艳", "有花瓣"],
  },
] as const

export type ObservationPlantId = typeof OBSERVATION_PLANTS[number]["id"]
export const OBSERVATION_IDS = OBSERVATION_PLANTS.map((part) => part.id)

/** These are observations of the three examples, not claims about every plant. */
export const OBSERVATION_LESSON = {
  id: "p1a-1-2",
  title: "观察植物",
  pageTitles: ["观察植物", "试一试：叶 / 茎 / 花"],
  goals: [
    "用眼睛观察植物的颜色和形状。",
    "在真实观察中比较植物的大小和触感。",
    "把叶、茎、花与自己的发现对应起来。",
    "画一画观察到的植物。",
  ],
  lead: "用眼睛看，用手摸，\n植物有根、茎、叶。\n我们一起仔细观察。",
  methods: [
    { action: "看", detail: "颜色和形状" },
    { action: "摸", detail: "光滑还是粗糙" },
    { action: "比", detail: "大还是小" },
  ],
  touchNote: "触感需要接触真实植物才能知道，屏幕里先观察颜色和形状。",
  question: {
    prompt: "观察植物时，可以用什么？",
    options: ["眼睛和手", "嘴巴尝", "不用看"],
    correctIndex: 0,
    answer: "用眼睛看、用手摸，不能随便尝。",
  },
  steps: [
    "点选叶，找一找叶脉。",
    "点选茎，找一找它连接着什么。",
    "点选花，找一找花瓣和花心。",
    "说一说：你发现了什么？",
  ],
  recordHeaders: ["部位", "样子", "我发现"],
  challenge: "画一画你观察的植物。",
  recordNote: "只记录这次探索，不判断你是否已经掌握。",
} as const
