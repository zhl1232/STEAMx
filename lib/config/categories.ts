export const CATEGORY_CONFIG: Record<string, string[]> = {
    "科学": ["物理实验", "化学实验", "生物观察", "天文地理"],
    "技术": ["编程入门", "电子制作", "机器人", "3D打印"],
    "工程": ["机械结构", "桥梁建造", "简易机器", "模型制作"],
    "艺术": ["绘画", "手工", "雕塑"],
    "数学": ["几何探索", "数学游戏", "逻辑谜题"],
    "其他": [],
};

export const CATEGORIES = Object.keys(CATEGORY_CONFIG);

export const DIFFICULTY_LEVELS = [
    { value: "easy", label: "入门 (1-2星)", stars: 2, description: "适合新手，简单易懂" },
    { value: "medium", label: "进阶 (3-4星)", stars: 4, description: "需要一定基础，稍有挑战" },
    { value: "hard", label: "挑战 (5-6星)", stars: 6, description: "复杂项目，考验综合能力" }
];
