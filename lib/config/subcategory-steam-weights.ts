export interface SteamWeights {
  S: number
  T: number
  E: number
  A: number
  M: number
}

export const SUBCATEGORY_STEAM_WEIGHTS: Record<string, SteamWeights> = {
  "物理实验": { S: 35, T: 5,  E: 5,  A: 0,  M: 15 },
  "化学实验": { S: 35, T: 10, E: 5,  A: 0,  M: 5  },
  "动物观察": { S: 35, T: 5,  E: 0,  A: 5,  M: 5  },
  "植物观察": { S: 35, T: 5,  E: 0,  A: 5,  M: 5  },
  "地球与天空": { S: 30, T: 10, E: 0,  A: 0,  M: 10 },
  "编程入门": { S: 5,  T: 35, E: 5,  A: 0,  M: 10 },
  "电子制作": { S: 10, T: 25, E: 20, A: 0,  M: 5  },
  "机器人":   { S: 10, T: 25, E: 25, A: 0,  M: 5  },
  "3D打印":   { S: 0,  T: 25, E: 15, A: 20, M: 5  },
  "机械结构": { S: 5,  T: 10, E: 35, A: 0,  M: 10 },
  "桥梁建造": { S: 10, T: 5,  E: 30, A: 0,  M: 15 },
  "简易机器": { S: 10, T: 15, E: 30, A: 0,  M: 5  },
  "模型制作": { S: 5,  T: 5,  E: 25, A: 20, M: 5  },
  "绘画":     { S: 0,  T: 0,  E: 0,  A: 40, M: 5  },
  "手工":     { S: 0,  T: 0,  E: 10, A: 35, M: 0  },
  "雕塑":     { S: 0,  T: 5,  E: 10, A: 35, M: 5  },
  "几何探索": { S: 5,  T: 0,  E: 5,  A: 10, M: 35 },
  "数学游戏": { S: 0,  T: 5,  E: 0,  A: 5,  M: 35 },
  "逻辑谜题": { S: 5,  T: 10, E: 0,  A: 0,  M: 35 },
}

export const CATEGORY_STEAM_WEIGHTS: Record<string, SteamWeights> = {
  "科学": { S: 30, T: 5,  E: 5,  A: 0,  M: 10 },
  "技术": { S: 5,  T: 30, E: 10, A: 0,  M: 5  },
  "工程": { S: 10, T: 10, E: 30, A: 0,  M: 10 },
  "艺术": { S: 0,  T: 5,  E: 5,  A: 30, M: 0  },
  "数学": { S: 5,  T: 5,  E: 5,  A: 0,  M: 30 },
  "其他": { S: 5,  T: 5,  E: 5,  A: 5,  M: 5  },
}

export function getSteamWeights(subCategory?: string | null, category?: string | null): SteamWeights {
  if (subCategory && subCategory in SUBCATEGORY_STEAM_WEIGHTS) {
    return SUBCATEGORY_STEAM_WEIGHTS[subCategory]
  }
  if (category && category in CATEGORY_STEAM_WEIGHTS) {
    return CATEGORY_STEAM_WEIGHTS[category]
  }
  return { S: 5, T: 5, E: 5, A: 5, M: 5 }
}
