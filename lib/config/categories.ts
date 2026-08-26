import {
    Code2,
    FlaskConical,
    Gamepad2,
    Palette,
    Sigma,
    Sparkles,
    Wrench,
    type LucideIcon,
} from "lucide-react";
import type { CategoryTone } from "@/components/ui/tone-badge";

export const CATEGORY_CONFIG: Record<string, string[]> = {
    "科学": ["物理实验", "化学实验", "动物观察", "植物观察", "地球与天空"],
    "技术": ["编程入门", "电子制作", "机器人", "3D打印"],
    "工程": ["机械结构", "桥梁建造", "简易机器", "模型制作"],
    "艺术": ["绘画", "手工", "雕塑"],
    "数学": ["几何探索", "数学游戏", "逻辑谜题"],
    "其他": [],
};

export const CATEGORIES = Object.keys(CATEGORY_CONFIG);

export interface CategoryMeta {
    key: string;
    label: string;
    icon: LucideIcon;
    tone?: CategoryTone;
    description?: string;
}

export const CATEGORY_META: Record<string, CategoryMeta> = {
    "全部": { key: "全部", label: "全部", icon: Sparkles },
    "科学": { key: "科学", label: "科学", icon: FlaskConical, tone: "science", description: "探索自然规律" },
    "技术": { key: "技术", label: "技术", icon: Code2, tone: "tech", description: "创造数字世界" },
    "工程": { key: "工程", label: "工程", icon: Wrench, tone: "engineering", description: "解决实际问题" },
    "艺术": { key: "艺术", label: "艺术", icon: Palette, tone: "art", description: "表达创意灵感" },
    "数学": { key: "数学", label: "数学", icon: Sigma, tone: "math", description: "发现逻辑之美" },
    "其他": { key: "其他", label: "其他", icon: Gamepad2, tone: "playground", description: "在玩法中探索" },
};

export const DIFFICULTY_LEVELS = [
    { value: "beginner", label: "入门", stars: 2, description: "适合新手，简单易懂" },
    { value: "intermediate", label: "进阶", stars: 4, description: "需要一定基础，稍有挑战" },
    { value: "challenge", label: "挑战", stars: 6, description: "复杂项目，考验综合能力" }
];
