import type { Metadata } from "next";

import { buildBreadcrumbJsonLd } from "@/lib/seo/json-ld";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { SITE_NAME, buildAbsoluteUrl, getSiteUrl } from "@/lib/seo/site";

export const PLAYGROUND_METADATA = {
  "/playground/minesweeper": {
    title: "扫雷",
    seoTitle: "扫雷 在线逻辑推理游戏",
    description: "在线玩扫雷，用数字线索和确定性推理找出安全格与地雷。初级、中级、高级三档难度，配套「扫雷解局学」图解课程，练习排除法与逻辑推理。",
    keywords: ["扫雷", "逻辑推理", "在线小游戏", "数学思维"],
  },
  "/playground/minesweeper/course": {
    title: "扫雷解局学",
    seoTitle: "扫雷解局学 入门教程",
    description: "从数字线索、排除法和经典定式入门扫雷，边学规则边练习解局。9 课图解加每课练习，从「法则一」讲到「1-2-1 定式」。",
    keywords: ["扫雷教程", "扫雷入门", "逻辑推理", "概率思维"],
  },
  "/playground/gomoku": {
    title: "五子棋",
    seoTitle: "五子棋 在线对弈",
    description: "在线玩五子棋，练习连五、攻防布局与博弈策略。可切换人人对弈或挑战 AI，在落子中学会识别对手威胁、抢占先手。",
    keywords: ["五子棋", "在线五子棋", "博弈论", "策略游戏"],
  },
  "/playground/life": {
    title: "生命游戏",
    seoTitle: "生命游戏 康威元胞自动机",
    description: "探索康威生命游戏，用元胞自动机挑战稳定结构、振荡器与涌现任务。8 个挑战关加自由沙盒，观察简单规则如何演化出复杂图案。",
    keywords: ["生命游戏", "康威生命游戏", "元胞自动机", "算法"],
  },
  "/playground/24game": {
    title: "24 点",
    seoTitle: "24 点 在线四则运算挑战",
    description: "在线挑战 24 点，用四则运算和组合思维把四张牌算出 24。直接输入算式作答，手机端有快捷键盘，连续解题可解锁连胜徽章。",
    keywords: ["24点", "四则运算", "心算", "数学游戏"],
  },
  "/playground/hanoi": {
    title: "汉诺塔",
    seoTitle: "汉诺塔 在线递归益智游戏",
    description: "在线玩汉诺塔，理解递归、分治和最少步数的算法思维。可调圆盘层数并观看自动演示，验证 n 层最少需要 2ⁿ−1 步。",
    keywords: ["汉诺塔", "递归", "算法思维", "数学游戏"],
  },
  "/playground/sudoku": {
    title: "数独",
    seoTitle: "数独 在线九宫格解谜",
    description: "在线玩数独，用行、列和宫的候选数排除法完成九宫格。简单、中等、困难三档难度，支持笔记标记，并讲解约束满足与回溯思路。",
    keywords: ["数独", "在线数独", "约束满足", "逻辑推理"],
  },
  "/playground/nqueens": {
    title: "N 皇后",
    seoTitle: "N 皇后 回溯算法挑战",
    description: "在线挑战 N 皇后问题，理解回溯搜索、冲突检测与剪枝。可手动摆放皇后，也可切换可视化模式观看回溯算法逐步求解。",
    keywords: ["N皇后", "回溯算法", "算法可视化", "棋盘问题"],
  },
  "/playground/memory": {
    title: "记忆翻牌",
    seoTitle: "记忆翻牌 在线记忆力游戏",
    description: "在线玩记忆翻牌，寻找相同图案，训练工作记忆与图案联想。翻开两张卡牌配对 STEAM 主题图案，用更少的翻牌次数完成全部配对。",
    keywords: ["记忆翻牌", "记忆游戏", "在线小游戏", "图案联想"],
  },
  "/playground/maze": {
    title: "迷宫探险",
    seoTitle: "迷宫探险 BFS/DFS/A* 路径规划",
    description: "探索 9×9 到 25×25 五档迷雾迷宫，练习路径记忆与方向判断。通关后解锁算法地图，用 BFS、DFS 和 A* 复盘最佳路线。",
    keywords: ["迷宫游戏", "BFS", "DFS", "A*算法", "路径规划"],
  },
  "/playground/tangram": {
    title: "七巧板",
    seoTitle: "七巧板 在线拼图",
    description: "在线玩七巧板，用 7 块几何拼板拼出方块、高山、滑梯、蘑菇屋等目标剪影。拖拽、旋转与翻转拼块，练习面积关系和空间想象力。",
    keywords: ["七巧板", "几何游戏", "空间想象", "在线益智游戏"],
  },
  "/playground/nonogram": {
    title: "数织",
    seoTitle: "数织 Nonogram 逻辑填图",
    description: "在线挑战数织（Nonogram），根据每行每列的数字线索填出隐藏的像素图案。28 关由易到难，支持滑动连填，每局 3 次试错机会。",
    keywords: ["数织", "Nonogram", "逻辑填图", "像素谜题"],
  },
  "/playground/ballsort": {
    title: "球排序",
    seoTitle: "球排序 在线颜色排序益智游戏",
    description: "在线玩球排序，把同色球倒进同一试管，练习状态空间与规划。10 关从双色入门到七色漩涡，空管可作中转，挑战最少步数。",
    keywords: ["球排序", "颜色排序", "状态空间", "益智游戏"],
  },
  "/playground/balance": {
    title: "天平称重",
    seoTitle: "天平称重 假币推理挑战",
    description: "用有限次称量找出假币，练习三分法和科学推理。从三币寻轻到十二枚硬币挑战，体会「每次称量把可能性分成三份」的思路。",
    keywords: ["天平称重", "假币问题", "三分法", "科学推理"],
  },
  "/playground/symmetry": {
    title: "像素对称",
    seoTitle: "像素对称 镜像补图游戏",
    description: "观察半边图案并补出镜像，练习坐标对应、对称与空间想象。蝴蝶、对称心、镜像塔等 10 个像素关卡，误点越少星级越高。",
    keywords: ["像素对称", "镜像", "坐标", "空间想象"],
  },
  "/playground/functionwars": {
    title: "函数战争",
    seoTitle: "函数战争 函数图像弹道游戏",
    description: "用函数图像和坐标变换控制弹道，在游戏中理解数学函数。输入 f(x) 发射函数弹道，完成 10 个战役关和 5 个挑战关。",
    keywords: ["函数战争", "函数图像", "坐标变换", "数学游戏"],
  },
} as const;

export type PlaygroundMetadataPath = keyof typeof PLAYGROUND_METADATA;

export const PLAYGROUND_METADATA_PATHS = Object.keys(PLAYGROUND_METADATA) as PlaygroundMetadataPath[];

/** Document title (before the site suffix): game name plus what it is, never just the bare name. */
export function getPlaygroundSeoTitle(path: PlaygroundMetadataPath): string {
  return PLAYGROUND_METADATA[path].seoTitle;
}

export function buildPlaygroundMetadata(path: PlaygroundMetadataPath): Metadata {
  const page = PLAYGROUND_METADATA[path];

  return buildPageMetadata({
    title: page.seoTitle,
    description: page.description,
    path,
    keywords: [...page.keywords],
  });
}

/**
 * Page-level structured data for a playground game or tutorial: a WebPage whose @id/url is the
 * same absolute canonical as <link rel="canonical"> / og:url, plus the breadcrumb trail.
 * Gives Google one more consistent "this URL is the canonical page" signal for
 * client-rendered games whose server HTML is otherwise thin.
 */
export function buildPlaygroundJsonLd(path: PlaygroundMetadataPath) {
  const page = PLAYGROUND_METADATA[path];
  const url = buildAbsoluteUrl(path);
  const siteUrl = getSiteUrl();
  // The tutorial is about the game, not a separate game at the course URL.
  const gamePath = path === "/playground/minesweeper/course" ? "/playground/minesweeper" : path;
  const breadcrumbs = [
    { name: "首页", url: "/" },
    { name: "游乐场", url: "/playground" },
    ...(path === "/playground/minesweeper/course"
      ? [{ name: PLAYGROUND_METADATA["/playground/minesweeper"].title, url: "/playground/minesweeper" }]
      : []),
    { name: page.title, url: path },
  ];

  return [
    {
      "@context": "https://schema.org",
      "@type": "WebPage",
      "@id": `${url}#webpage`,
      name: page.seoTitle,
      description: page.description,
      url,
      inLanguage: "zh-CN",
      keywords: page.keywords.join(","),
      isPartOf: {
        "@type": "WebSite",
        "@id": `${siteUrl}/#website`,
        name: SITE_NAME,
        url: siteUrl,
      },
      about: {
        "@type": "Game",
        name: PLAYGROUND_METADATA[gamePath].title,
        url: buildAbsoluteUrl(gamePath),
      },
    },
    buildBreadcrumbJsonLd(breadcrumbs),
  ];
}
