"use client";

import { Fragment, type ReactNode } from "react";

import {
    parseScratchRichTextTokens,
    type ScratchBlockCategory,
} from "@/lib/courses/scratch-hints";

type ScratchDisplayCategory = ScratchBlockCategory | "music" | "pen";

/**
 * Scratch 积木分类：中文名 + 官方配色。课程步骤里只写英文 key，
 * 中文名与颜色在此统一映射，避免在 SQL 文案里写错分类名（如「动作」应为「运动」）。
 */
const SCRATCH_CATEGORIES: Record<ScratchDisplayCategory, { name: string; bg: string; stroke: string; fg: string }> = {
    motion: { name: "运动", bg: "#4C97FF", stroke: "#3373CC", fg: "#FFFFFF" },
    looks: { name: "外观", bg: "#9966FF", stroke: "#774DCB", fg: "#FFFFFF" },
    sound: { name: "声音", bg: "#CF63CF", stroke: "#BD42BD", fg: "#FFFFFF" },
    events: { name: "事件", bg: "#FFBF00", stroke: "#CC9900", fg: "#5A4500" },
    control: { name: "控制", bg: "#FFAB19", stroke: "#CF8B17", fg: "#5A3B00" },
    sensing: { name: "侦测", bg: "#5CB1D6", stroke: "#2E8EB8", fg: "#0B3A4A" },
    operators: { name: "运算", bg: "#59C059", stroke: "#389438", fg: "#10401A" },
    data: { name: "变量", bg: "#FF8C1A", stroke: "#DB6E00", fg: "#FFFFFF" },
    myBlocks: { name: "自制积木", bg: "#FF6680", stroke: "#E64D69", fg: "#FFFFFF" },
    music: { name: "音乐", bg: "#0FBD8C", stroke: "#0B8E69", fg: "#FFFFFF" },
    pen: { name: "画笔", bg: "#0FBD8C", stroke: "#0B8E69", fg: "#FFFFFF" },
};

const SCRATCH_CATEGORY_BY_NAME: Record<string, ScratchDisplayCategory> = Object.fromEntries(
    Object.entries(SCRATCH_CATEGORIES).map(([category, value]) => [value.name, category as ScratchDisplayCategory]),
) as Record<string, ScratchDisplayCategory>;

const SCRATCH_CATEGORY_BY_MARKER_KEY: Record<string, ScratchDisplayCategory> = {
    motion: "motion",
    looks: "looks",
    sound: "sound",
    events: "events",
    control: "control",
    sensing: "sensing",
    operators: "operators",
    variables: "data",
    data: "data",
    myblocks: "myBlocks",
    music: "music",
    pen: "pen",
};

const PLAIN_CATEGORY_PHRASE_RE = /(运动|外观|声音|事件|控制|侦测|运算|变量|自制积木|音乐|画笔)分类/g;

const SVG_TEXT_STYLE = {
    fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
    fontSize: 13,
    fontWeight: 600,
} as const;

const HAT_TEXT_STYLE = {
    ...SVG_TEXT_STYLE,
    fontSize: 14,
    fontWeight: 700,
} as const;

/** Scratch 工具箱分类图例：大色点 + 分类名，如 ● 运动 */
export function ScratchCategoryChip({
    category,
    label,
}: {
    category?: ScratchDisplayCategory;
    label: string;
}) {
    const cat = category ? SCRATCH_CATEGORIES[category] : null;
    if (!cat) return <Fragment>{label}</Fragment>;
    return (
        <span
            aria-label={`Scratch 分类：${label}`}
            role="img"
            className="mx-px inline-flex min-h-[22px] items-center gap-1 rounded-[6px] border border-black/10 bg-[hsl(var(--background))] px-1.5 py-0.5 text-[13px] font-extrabold leading-none text-[hsl(var(--foreground))] shadow-[0_1px_2px_rgba(15,23,42,0.12)] align-[-0.25em]"
        >
            <span
                aria-hidden
                className="inline-block h-3.5 w-3.5 rounded-full ring-1 ring-black/20"
                style={{ backgroundColor: cat.bg }}
            />
            {label}
        </span>
    );
}

/** Scratch 配色的圆角「积木块」，内含积木文字 */
export function ScratchBlockChip({
    category,
    label,
}: {
    category?: ScratchDisplayCategory;
    label: string;
}) {
    const cat = category ? SCRATCH_CATEGORIES[category] : null;
    if (!cat) return <span className="font-semibold">{label}</span>;

    const isHat = category === "events" && (/^(当|收到)/u.test(label) || label === "当绿旗被点击");
    if (isHat) return <ScratchHatBlock label={label} categoryStyle={cat} />;
    return <ScratchStackBlock label={label} categoryStyle={cat} />;
}

function getScratchDisplayCategory(
    category: ScratchBlockCategory | undefined,
    categoryKey: string,
): ScratchDisplayCategory | undefined {
    if (category) return category;
    return SCRATCH_CATEGORY_BY_MARKER_KEY[categoryKey.trim().replace(/[-_]/g, "").toLowerCase()];
}

function getDisplayUnits(label: string) {
    return Array.from(label).reduce((total, char) => {
        if (char === " ") return total + 0.45;
        if ((char.codePointAt(0) ?? 0) <= 0x7f) return total + 0.58;
        return total + 1;
    }, 0);
}

function getStackBlockWidth(label: string) {
    return Math.max(68, Math.ceil(24 + getDisplayUnits(label) * 13));
}

function getHatBlockWidth(label: string) {
    if (label === "当绿旗被点击") return 128;
    return Math.max(112, Math.ceil(32 + getDisplayUnits(label) * 14));
}

function stackBlockPath(width: number) {
    const height = 32;
    return [
        `M 4 0 H 16`,
        `c 2 0 3 1 4 2 l 4 4 c 1 1 2 2 4 2 h 12 c 2 0 3 -1 4 -2 l 4 -4 c 1 -1 2 -2 4 -2`,
        `H ${width - 4} a 4 4 0 0 1 4 4 v ${height - 12} a 4 4 0 0 1 -4 4`,
        `H 48 c -2 0 -3 1 -4 2 l -4 4 c -1 1 -2 2 -4 2 H 24 c -2 0 -3 -1 -4 -2 l -4 -4 c -1 -1 -2 -2 -4 -2`,
        `H 4 a 4 4 0 0 1 -4 -4 V 4 a 4 4 0 0 1 4 -4 z`,
    ].join(" ");
}

function hatBlockPath(width: number) {
    const top = 16;
    const bottom = 42;
    return [
        `M 0 ${top}`,
        `C 24 -2 ${Math.max(74, width - 54)} -2 ${Math.max(98, width - 28)} ${top}`,
        `H ${width - 4} a 4 4 0 0 1 4 4 v ${bottom - top - 8} a 4 4 0 0 1 -4 4`,
        `H 48 c -2 0 -3 1 -4 2 l -4 4 c -1 1 -2 2 -4 2 H 24 c -2 0 -3 -1 -4 -2 l -4 -4 c -1 -1 -2 -2 -4 -2`,
        `H 4 a 4 4 0 0 1 -4 -4 V ${top + 4} a 4 4 0 0 1 4 -4 z`,
    ].join(" ");
}

function ScratchStackBlock({
    label,
    categoryStyle,
}: {
    label: string;
    categoryStyle: { bg: string; stroke: string; fg: string };
}) {
    const width = getStackBlockWidth(label);
    const height = 40;
    return (
        <svg
            aria-label={`Scratch 积木：${label}`}
            role="img"
            viewBox={`0 0 ${width} ${height}`}
            width={width}
            height={height}
            className="mx-[2px] inline-block max-w-full translate-y-[0.34em] overflow-visible align-baseline drop-shadow-[0_1px_0_rgba(0,0,0,0.18)]"
        >
            <path
                d={stackBlockPath(width)}
                fill={categoryStyle.bg}
                stroke={categoryStyle.stroke}
                strokeWidth="1"
            />
            <text
                x="12"
                y="20"
                dominantBaseline="middle"
                fill={categoryStyle.fg}
                style={SVG_TEXT_STYLE}
            >
                {label}
            </text>
        </svg>
    );
}

function ScratchHatBlock({
    label,
    categoryStyle,
}: {
    label: string;
    categoryStyle: { bg: string; stroke: string; fg: string };
}) {
    const width = getHatBlockWidth(label);
    const height = 54;
    const isGreenFlag = label === "当绿旗被点击";

    return (
        <svg
            aria-label={`Scratch 积木：${label}`}
            role="img"
            viewBox={`0 -2 ${width} ${height}`}
            width={width}
            height={height}
            className="mx-[2px] inline-block max-w-full translate-y-[0.48em] overflow-visible align-baseline drop-shadow-[0_1px_0_rgba(0,0,0,0.18)]"
        >
            <path
                d={hatBlockPath(width)}
                fill={categoryStyle.bg}
                stroke={categoryStyle.stroke}
                strokeWidth="1"
            />
            {isGreenFlag ? (
                <>
                    <text
                        x="16"
                        y="28"
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fill={categoryStyle.fg}
                        style={HAT_TEXT_STYLE}
                    >
                        当
                    </text>
                    <g transform="translate(36 17)">
                        <path d="M4 2 v20" stroke="#2E4D2E" strokeWidth="2" strokeLinecap="round" />
                        <path d="M5 3 C11 0 16 5 22 2 v13 c-6 3-11-2-17 1 z" fill="#00A651" stroke="#0B7F3A" strokeWidth="1" />
                    </g>
                    <text
                        x="94"
                        y="28"
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fill={categoryStyle.fg}
                        style={HAT_TEXT_STYLE}
                    >
                        被点击
                    </text>
                </>
            ) : (
                <text
                    x="14"
                    y="28"
                    dominantBaseline="middle"
                    fill={categoryStyle.fg}
                    style={HAT_TEXT_STYLE}
                >
                    {label}
                </text>
            )}
        </svg>
    );
}

function renderPlainScratchCategoryPhrases(text: string, keyPrefix: string) {
    const nodes: ReactNode[] = [];
    let lastIndex = 0;
    let partIndex = 0;
    let match: RegExpExecArray | null;
    PLAIN_CATEGORY_PHRASE_RE.lastIndex = 0;

    while ((match = PLAIN_CATEGORY_PHRASE_RE.exec(text)) !== null) {
        if (match.index > lastIndex) {
            nodes.push(
                <Fragment key={`${keyPrefix}-text-${partIndex++}`}>
                    {text.slice(lastIndex, match.index)}
                </Fragment>,
            );
        }

        const label = match[1] ?? "";
        const category = SCRATCH_CATEGORY_BY_NAME[label];
        nodes.push(
            category ? (
                <ScratchCategoryChip
                    key={`${keyPrefix}-cat-${partIndex++}`}
                    category={category}
                    label={label}
                />
            ) : (
                <Fragment key={`${keyPrefix}-cat-${partIndex++}`}>{match[0]}</Fragment>
            ),
        );
        lastIndex = match.index + match[0].length;
    }

    if (lastIndex < text.length) {
        nodes.push(
            <Fragment key={`${keyPrefix}-text-${partIndex++}`}>
                {text.slice(lastIndex)}
            </Fragment>,
        );
    }

    return nodes.length ? nodes : [<Fragment key={`${keyPrefix}-text-0`}>{text}</Fragment>];
}

/**
 * 渲染课程步骤文案，把 [[cat:x]] / [[block:x|文字]] 标记渲染成彩色分类与积木块，
 * 其余原样显示。无标记时等同于纯文本。
 */
export function ScratchRichText({ text }: { text: string }) {
    if (!text) return null;
    const nodes: ReactNode[] = [];

    parseScratchRichTextTokens(text).forEach((token, index) => {
        if (token.type === "text") {
            nodes.push(...renderPlainScratchCategoryPhrases(token.text, `plain-${index}`));
            return;
        }
        if (token.type === "category") {
            nodes.push(
                <ScratchCategoryChip
                    key={index}
                    category={getScratchDisplayCategory(token.category, token.categoryKey)}
                    label={token.label}
                />,
            );
            return;
        }
        nodes.push(
            <ScratchBlockChip
                key={index}
                category={getScratchDisplayCategory(token.category, token.categoryKey)}
                label={token.label}
            />,
        );
    });

    return <>{nodes}</>;
}

export function LessonRichText({ text }: { text: string }) {
    return <ScratchRichText text={text} />;
}
