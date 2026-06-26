import { cn } from "@/lib/utils";

type GomokuBoardProps = {
    /** 棋盘交点数，默认 15×15 */
    size?: number;
    /** 视觉尺寸（px），SVG 会按此尺寸等比缩放 */
    viewBoxSize?: number;
    className?: string;
    /** 棋子坐标（行、列，0 起）。不传则只画空棋盘。 */
    blackStones?: Array<{ r: number; c: number }>;
    whiteStones?: Array<{ r: number; c: number }>;
    /** 高亮一条连线（黑方五连），传入起点与终点的交点坐标 */
    winLine?: { from: { r: number; c: number }; to: { r: number; c: number } };
    /** 无障碍标签 */
    ariaLabel?: string;
};

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
    winLine,
    ariaLabel = "五子棋棋盘示意",
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

    return (
        <svg
            viewBox={`0 0 ${viewBoxSize} ${viewBoxSize}`}
            className={cn("h-auto w-full", className)}
            role="img"
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
                    className="stroke-[hsl(var(--brand-blue))]"
                    strokeWidth="3"
                    strokeLinecap="round"
                    opacity="0.85"
                />
            ) : null}

            {/* 白子 */}
            {whiteStones.map(({ r, c }) => {
                const { x, y } = toXY(r, c);
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
                    </g>
                );
            })}

            {/* 黑子 */}
            {blackStones.map(({ r, c }) => {
                const { x, y } = toXY(r, c);
                return (
                    <g key={`b-${r}-${c}`}>
                        <circle cx={x} cy={y} r={radius} className="fill-slate-950 dark:fill-slate-100" strokeWidth="0.8" />
                        <circle cx={x - span * 0.1} cy={y - span * 0.1} r={radius * 0.28} className="fill-slate-700/60 dark:fill-slate-300/60" />
                    </g>
                );
            })}
        </svg>
    );
}
