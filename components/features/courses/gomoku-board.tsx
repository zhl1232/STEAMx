import { cn } from "@/lib/utils";
import type {
    GomokuBoardPoint,
    GomokuBoardTone,
    GomokuBoardLine,
    GomokuBoardMark,
    GomokuBoardStone,
} from "@/lib/courses/types";

type GomokuBoardProps = {
    /** 棋盘交点数，默认 15×15 */
    size?: number;
    /** 视觉尺寸（px），SVG 会按此尺寸等比缩放 */
    viewBoxSize?: number;
    className?: string;
    /** 棋子坐标（行、列，0 起）。不传则只画空棋盘。 */
    blackStones?: GomokuBoardStone[];
    whiteStones?: GomokuBoardStone[];
    /** 候选落点、读棋编号等空点标记。 */
    marks?: GomokuBoardMark[];
    /** 威胁线、读棋线等辅助连线。 */
    lines?: GomokuBoardLine[];
    /** 高亮一条连线（黑方五连），传入起点与终点的交点坐标 */
    winLine?: GomokuBoardLine;
    /** 无障碍标签 */
    ariaLabel?: string;
    /** 传入后棋盘交点变为可点击训练点；不传时保持纯展示。 */
    onPointClick?: (point: GomokuBoardPoint) => void;
    getPointAriaLabel?: (point: GomokuBoardPoint) => string;
};

const LINE_TONE_CLASSES = {
    blue: "stroke-[hsl(var(--brand-blue))]",
    amber: "stroke-[hsl(var(--brand-amber))]",
    success: "stroke-[hsl(var(--status-success))]",
    danger: "stroke-[hsl(var(--status-danger))]",
    neutral: "stroke-slate-500 dark:stroke-slate-300",
} as const;

const MARK_TONE_CLASSES = {
    blue: {
        fill: "fill-[hsl(var(--brand-blue)/0.14)]",
        stroke: "stroke-[hsl(var(--brand-blue))]",
        text: "fill-[hsl(var(--brand-blue))]",
    },
    amber: {
        fill: "fill-[hsl(var(--brand-amber)/0.16)]",
        stroke: "stroke-[hsl(var(--brand-amber))]",
        text: "fill-[hsl(var(--brand-amber))]",
    },
    success: {
        fill: "fill-[hsl(var(--status-success)/0.14)]",
        stroke: "stroke-[hsl(var(--status-success))]",
        text: "fill-[hsl(var(--status-success))]",
    },
    danger: {
        fill: "fill-[hsl(var(--status-danger)/0.14)]",
        stroke: "stroke-[hsl(var(--status-danger))]",
        text: "fill-[hsl(var(--status-danger))]",
    },
    neutral: {
        fill: "fill-slate-500/10 dark:fill-slate-200/10",
        stroke: "stroke-slate-500 dark:stroke-slate-300",
        text: "fill-slate-600 dark:fill-slate-200",
    },
} as const;

function getLineToneClass(tone: GomokuBoardTone | undefined) {
    return LINE_TONE_CLASSES[tone ?? "amber"] ?? LINE_TONE_CLASSES.amber;
}

function getMarkToneClasses(tone: GomokuBoardTone | undefined) {
    return MARK_TONE_CLASSES[tone ?? "blue"] ?? MARK_TONE_CLASSES.blue;
}

function getLabelFontSize(label: string, baseSize: number) {
    const length = Array.from(label).length;
    if (length <= 1) return baseSize;
    if (length === 2) return baseSize * 0.86;
    return baseSize * 0.72;
}

/**
 * 纯 SVG 五子棋棋盘组件：15×15 网格 + 星位 + 可选黑白子 + 可选获胜连线。
 * 随主题色变化（amber 木色棋盘、slate 黑白子），不依赖任何位图。
 * 供课程详情页 Hero、playground 课时步骤示意等场景复用。
 */
export function GomokuBoard({
    size = 15,
    viewBoxSize = 320,
    className,
    blackStones = [],
    whiteStones = [],
    marks = [],
    lines = [],
    winLine,
    ariaLabel = "五子棋棋盘示意",
    onPointClick,
    getPointAriaLabel,
}: GomokuBoardProps) {
    const padding = 22;
    const span = (viewBoxSize - padding * 2) / (size - 1);

    const toXY = (r: number, c: number) => ({
        x: padding + c * span,
        y: padding + r * span,
    });

    // 默认星位：四角 + 天元（仅 15×15 时）
    const stars =
        size === 15
            ? [
                  { r: 3, c: 3 },
                  { r: 3, c: 11 },
                  { r: 7, c: 7 },
                  { r: 11, c: 3 },
                  { r: 11, c: 11 },
              ]
            : [{ r: Math.floor(size / 2), c: Math.floor(size / 2) }];

    const radius = span * 0.42;
    const stoneLabelBaseSize = Math.min(Math.max(span * 0.72, 12.5), 15);
    const markLabelBaseSize = Math.min(Math.max(span * 0.74, 12.5), 15);
    const interactivePoints = onPointClick
        ? Array.from({ length: size * size }, (_, index) => ({
              r: Math.floor(index / size),
              c: index % size,
          }))
        : [];

    return (
        <svg
            viewBox={`0 0 ${viewBoxSize} ${viewBoxSize}`}
            className={cn("h-auto w-full", className)}
            role={onPointClick ? "group" : "img"}
            aria-label={ariaLabel}
        >
            {/* 棋盘底板 */}
            <rect
                x="0"
                y="0"
                width={viewBoxSize}
                height={viewBoxSize}
                rx="18"
                className="fill-[hsl(var(--brand-amber)/0.16)] stroke-[hsl(var(--brand-amber)/0.28)]"
                strokeWidth="1.5"
            />
            <rect
                x={padding - 8}
                y={padding - 8}
                width={viewBoxSize - (padding - 8) * 2}
                height={viewBoxSize - (padding - 8) * 2}
                rx="10"
                className="fill-[hsl(var(--brand-amber)/0.1)]"
            />

            {/* 网格线 */}
            {Array.from({ length: size }).map((_, i) => {
                const pos = padding + i * span;
                return (
                    <g
                        key={`grid-${i}`}
                        className="stroke-[hsl(var(--brand-amber)/0.45)] dark:stroke-[hsl(var(--brand-amber)/0.5)]"
                    >
                        <line x1={padding} y1={pos} x2={viewBoxSize - padding} y2={pos} strokeWidth="1" />
                        <line x1={pos} y1={padding} x2={pos} y2={viewBoxSize - padding} strokeWidth="1" />
                    </g>
                );
            })}

            {/* 星位 */}
            {stars.map(({ r, c }) => {
                const { x, y } = toXY(r, c);
                return (
                    <circle
                        key={`star-${r}-${c}`}
                        cx={x}
                        cy={y}
                        r="2.5"
                        className="fill-[hsl(var(--brand-amber)/0.6)]"
                    />
                );
            })}

            {/* 获胜连线 */}
            {winLine ? (
                <line
                    x1={toXY(winLine.from.r, winLine.from.c).x}
                    y1={toXY(winLine.from.r, winLine.from.c).y}
                    x2={toXY(winLine.to.r, winLine.to.c).x}
                    y2={toXY(winLine.to.r, winLine.to.c).y}
                    className={LINE_TONE_CLASSES[winLine.tone ?? "blue"] ?? LINE_TONE_CLASSES.blue}
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeDasharray={winLine.dashed ? "6 5" : undefined}
                    opacity="0.85"
                />
            ) : null}

            {/* 辅助威胁线 */}
            {lines.map((line, index) => (
                <line
                    key={`line-${index}-${line.from.r}-${line.from.c}-${line.to.r}-${line.to.c}`}
                    x1={toXY(line.from.r, line.from.c).x}
                    y1={toXY(line.from.r, line.from.c).y}
                    x2={toXY(line.to.r, line.to.c).x}
                    y2={toXY(line.to.r, line.to.c).y}
                    className={getLineToneClass(line.tone)}
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeDasharray={line.dashed ? "5 5" : undefined}
                    opacity="0.78"
                />
            ))}

            {/* 白子 */}
            {whiteStones.map(({ r, c, label }) => {
                const { x, y } = toXY(r, c);
                const labelFontSize = label ? getLabelFontSize(label, stoneLabelBaseSize) : stoneLabelBaseSize;
                return (
                    <g key={`w-${r}-${c}`}>
                        <circle
                            cx={x}
                            cy={y}
                            r={radius}
                            className="fill-white stroke-slate-300 dark:fill-slate-200 dark:stroke-slate-500"
                            strokeWidth="1.2"
                        />
                        <circle cx={x - span * 0.1} cy={y - span * 0.1} r={radius * 0.28} className="fill-white/70 dark:fill-white/40" />
                        {label ? (
                            <text
                                x={x}
                                y={y + 1}
                                textAnchor="middle"
                                dominantBaseline="middle"
                                fontSize={labelFontSize}
                                className="fill-slate-900 font-black"
                                style={{ fontVariantNumeric: "tabular-nums" }}
                            >
                                {label}
                            </text>
                        ) : null}
                    </g>
                );
            })}

            {/* 黑子 */}
            {blackStones.map(({ r, c, label }) => {
                const { x, y } = toXY(r, c);
                const labelFontSize = label ? getLabelFontSize(label, stoneLabelBaseSize) : stoneLabelBaseSize;
                return (
                    <g key={`b-${r}-${c}`}>
                        <circle cx={x} cy={y} r={radius} className="fill-slate-950 dark:fill-slate-100" strokeWidth="0.8" />
                        <circle cx={x - span * 0.1} cy={y - span * 0.1} r={radius * 0.28} className="fill-slate-700/60 dark:fill-slate-300/60" />
                        {label ? (
                            <text
                                x={x}
                                y={y + 1}
                                textAnchor="middle"
                                dominantBaseline="middle"
                                fontSize={labelFontSize}
                                className="fill-white font-black dark:fill-slate-950"
                                style={{ fontVariantNumeric: "tabular-nums" }}
                            >
                                {label}
                            </text>
                        ) : null}
                    </g>
                );
            })}

            {/* 候选点与读棋编号 */}
            {marks.map((mark, index) => {
                const { x, y } = toXY(mark.r, mark.c);
                const tone = getMarkToneClasses(mark.tone);
                const kind = mark.kind ?? "target";
                const labelFontSize = mark.label ? getLabelFontSize(mark.label, markLabelBaseSize) : markLabelBaseSize;
                const markRadius = mark.label
                    ? Math.max(radius * 0.94, labelFontSize * 0.58)
                    : radius * 0.58;
                const labelBackplateRadius = Math.max(labelFontSize * 0.52, markRadius * 0.62);
                return (
                    <g key={`mark-${index}-${mark.r}-${mark.c}`}>
                        {kind === "dot" ? (
                            <circle
                                cx={x}
                                cy={y}
                                r={radius * 0.28}
                                className={cn(tone.fill, tone.stroke)}
                                strokeWidth="2"
                            />
                        ) : (
                            <circle
                                cx={x}
                                cy={y}
                                r={markRadius}
                                className={cn(kind === "ring" ? "fill-transparent" : tone.fill, tone.stroke)}
                                strokeWidth={kind === "ring" ? "2.6" : "2"}
                            />
                        )}
                        {kind === "target" ? (
                            <>
                                <line
                                    x1={x - markRadius * 0.72}
                                    y1={y}
                                    x2={x + markRadius * 0.72}
                                    y2={y}
                                    className={tone.stroke}
                                    strokeWidth="1.2"
                                    strokeLinecap="round"
                                    opacity="0.72"
                                />
                                <line
                                    x1={x}
                                    y1={y - markRadius * 0.72}
                                    x2={x}
                                    y2={y + markRadius * 0.72}
                                    className={tone.stroke}
                                    strokeWidth="1.2"
                                    strokeLinecap="round"
                                    opacity="0.72"
                                />
                            </>
                        ) : null}
                        {mark.label ? (
                            <>
                                <circle
                                    cx={x}
                                    cy={y}
                                    r={labelBackplateRadius}
                                    className="fill-[hsl(var(--background)/0.9)] dark:fill-[hsl(var(--background)/0.82)]"
                                />
                                <text
                                    x={x}
                                    y={y + 0.8}
                                    textAnchor="middle"
                                    dominantBaseline="middle"
                                    fontSize={labelFontSize}
                                    className={cn(tone.text, "font-black")}
                                    style={{ fontVariantNumeric: "tabular-nums" }}
                                >
                                    {mark.label}
                                </text>
                            </>
                        ) : null}
                    </g>
                );
            })}

            {interactivePoints.map((point) => {
                const { x, y } = toXY(point.r, point.c);
                return (
                    <circle
                        key={`hit-${point.r}-${point.c}`}
                        cx={x}
                        cy={y}
                        r={radius * 0.92}
                        role="button"
                        tabIndex={0}
                        aria-label={
                            getPointAriaLabel?.(point) ??
                            `落子到第 ${point.r + 1} 行第 ${point.c + 1} 列`
                        }
                        className="cursor-pointer fill-transparent transition-colors hover:fill-[hsl(var(--brand-blue)/0.1)] focus:outline-none focus-visible:fill-[hsl(var(--brand-blue)/0.16)]"
                        onClick={() => onPointClick?.(point)}
                        onKeyDown={(event) => {
                            if (event.key !== "Enter" && event.key !== " ") return;
                            event.preventDefault();
                            onPointClick?.(point);
                        }}
                    />
                );
            })}
        </svg>
    );
}
