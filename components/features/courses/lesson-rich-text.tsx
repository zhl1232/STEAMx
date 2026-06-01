"use client";

import { Fragment, type ReactNode } from "react";

/**
 * Scratch 积木分类：中文名 + 官方配色。课程步骤里只写英文 key，
 * 中文名与颜色在此统一映射，避免在 SQL 文案里写错分类名（如「动作」应为「运动」）。
 */
const SCRATCH_CATEGORIES: Record<string, { name: string; bg: string; fg: string }> = {
    motion: { name: "运动", bg: "#4C97FF", fg: "#FFFFFF" },
    looks: { name: "外观", bg: "#9966FF", fg: "#FFFFFF" },
    sound: { name: "声音", bg: "#CF63CF", fg: "#FFFFFF" },
    events: { name: "事件", bg: "#FFBF00", fg: "#5A4500" },
    control: { name: "控制", bg: "#FFAB19", fg: "#5A3B00" },
    sensing: { name: "侦测", bg: "#5CB1D6", fg: "#0B3A4A" },
    operators: { name: "运算", bg: "#59C059", fg: "#10401A" },
    variables: { name: "变量", bg: "#FF8C1A", fg: "#FFFFFF" },
    myblocks: { name: "自制积木", bg: "#FF6680", fg: "#FFFFFF" },
    music: { name: "音乐", bg: "#0FBD8C", fg: "#FFFFFF" },
};

const TOKEN_RE = /\[\[(cat|block):([a-z]+)(?:\|([^\]]+))?\]\]/g;

/** 分类色圆点 + 名字，如 ●运动 */
function CategoryChip({ catKey }: { catKey: string }) {
    const cat = SCRATCH_CATEGORIES[catKey];
    if (!cat) return <Fragment>{catKey}</Fragment>;
    return (
        <span className="inline-flex items-center gap-1 align-baseline font-bold">
            <span
                aria-hidden
                className="inline-block h-[0.72em] w-[0.72em] rounded-full ring-1 ring-black/15"
                style={{ backgroundColor: cat.bg }}
            />
            {cat.name}
        </span>
    );
}

/** Scratch 配色的圆角「积木块」，内含积木文字 */
function BlockChip({ catKey, label }: { catKey: string; label: string }) {
    const cat = SCRATCH_CATEGORIES[catKey] ?? {
        bg: "hsl(var(--muted))",
        fg: "hsl(var(--foreground))",
    };
    return (
        <span
            className="mx-[1px] inline-flex items-center whitespace-nowrap rounded-[5px] border border-black/10 px-[0.4em] py-[0.05em] text-[0.92em] font-semibold leading-snug shadow-sm"
            style={{ backgroundColor: cat.bg, color: cat.fg }}
        >
            {label}
        </span>
    );
}

/**
 * 渲染课程步骤文案，把 [[cat:x]] / [[block:x|文字]] 标记渲染成彩色分类与积木块，
 * 其余原样显示。无标记时等同于纯文本。
 */
export function LessonRichText({ text }: { text: string }) {
    if (!text) return null;
    const nodes: ReactNode[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    let key = 0;
    TOKEN_RE.lastIndex = 0;
    while ((match = TOKEN_RE.exec(text)) !== null) {
        if (match.index > lastIndex) {
            nodes.push(
                <Fragment key={key++}>{text.slice(lastIndex, match.index)}</Fragment>,
            );
        }
        const [, kind, catKey, label] = match;
        if (kind === "cat") {
            nodes.push(<CategoryChip key={key++} catKey={catKey} />);
        } else {
            nodes.push(
                <BlockChip key={key++} catKey={catKey} label={label ?? ""} />,
            );
        }
        lastIndex = match.index + match[0].length;
    }
    if (lastIndex < text.length) {
        nodes.push(<Fragment key={key++}>{text.slice(lastIndex)}</Fragment>);
    }
    return <>{nodes}</>;
}
