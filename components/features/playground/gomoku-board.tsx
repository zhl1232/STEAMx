"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";

import { cn } from "@/lib/utils";

type Point = { row: number; col: number };
type GomokuCellValue = "black" | "white" | null;
type GomokuCell = {
    row: number;
    col: number;
    value: GomokuCellValue;
};
type ConfirmPlacement = boolean | "auto";

const BOARD_SIZE = 15;
const LAST_POINT_INDEX = BOARD_SIZE - 1;
const BOARD_LINES = Array.from({ length: BOARD_SIZE }, (_, index) => index);
const STAR_POINTS: Point[] = [
    { row: 3, col: 3 },
    { row: 3, col: 11 },
    { row: 7, col: 7 },
    { row: 11, col: 3 },
    { row: 11, col: 11 },
];

type AudioWindow = Window &
    typeof globalThis & {
        webkitAudioContext?: typeof AudioContext;
    };

let gomokuAudioContext: AudioContext | null = null;

function getAudioContext() {
    if (typeof window === "undefined") return null;
    const audioWindow = window as AudioWindow;
    const AudioContextConstructor =
        audioWindow.AudioContext ?? audioWindow.webkitAudioContext;
    if (!AudioContextConstructor) return null;

    gomokuAudioContext ??= new AudioContextConstructor();
    if (gomokuAudioContext.state === "suspended") {
        void gomokuAudioContext.resume().catch(() => undefined);
    }
    return gomokuAudioContext;
}

function playTone({
    frequency,
    delay = 0,
    duration = 0.09,
    gain = 0.04,
    type = "sine",
}: {
    frequency: number;
    delay?: number;
    duration?: number;
    gain?: number;
    type?: OscillatorType;
}) {
    const audioContext = getAudioContext();
    if (!audioContext) return;

    const start = audioContext.currentTime + delay;
    const oscillator = audioContext.createOscillator();
    const volume = audioContext.createGain();

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    volume.gain.setValueAtTime(0.0001, start);
    volume.gain.exponentialRampToValueAtTime(gain, start + 0.008);
    volume.gain.exponentialRampToValueAtTime(0.0001, start + duration);

    oscillator.connect(volume);
    volume.connect(audioContext.destination);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.02);
}

function playStoneSound() {
    playTone({
        frequency: 420,
        duration: 0.075,
        gain: 0.035,
        type: "triangle",
    });
}

function playVictorySound() {
    playTone({ frequency: 523.25, duration: 0.12, gain: 0.035, type: "triangle" });
    playTone({
        frequency: 659.25,
        delay: 0.09,
        duration: 0.13,
        gain: 0.035,
        type: "triangle",
    });
    playTone({
        frequency: 783.99,
        delay: 0.18,
        duration: 0.2,
        gain: 0.04,
        type: "triangle",
    });
}

function pointPercent(index: number) {
    return `${(index / LAST_POINT_INDEX) * 100}%`;
}

function isSamePoint(left: Point | null, right: Point) {
    return left?.row === right.row && left.col === right.col;
}

function useConfirmPlacement(confirmPlacement: ConfirmPlacement) {
    const [matches, setMatches] = useState(confirmPlacement === true);

    useEffect(() => {
        if (confirmPlacement !== "auto") {
            setMatches(confirmPlacement);
            return;
        }
        if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
            setMatches(false);
            return;
        }

        const media = window.matchMedia(
            "(hover: none), (pointer: coarse), (max-width: 767px)",
        );
        const update = () => setMatches(media.matches);
        update();
        media.addEventListener("change", update);
        return () => media.removeEventListener("change", update);
    }, [confirmPlacement]);

    return matches;
}

function getCellAriaLabel(cell: GomokuCell, isSelected: boolean, confirmPlacement: boolean) {
    const point = `第 ${cell.row + 1} 行第 ${cell.col + 1} 列`;
    if (cell.value === "black") return `${point}已有黑子`;
    if (cell.value === "white") return `${point}已有白子`;
    if (confirmPlacement) {
        return isSelected
            ? `${point}交点已定位，再次点击确认落子`
            : `在${point}交点定位，再次点击确认落子`;
    }
    return `在${point}交点落子`;
}

export function GomokuBoard({
    board,
    winLine,
    onCellClick,
    disabled,
    confirmPlacement = "auto",
}: {
    board: GomokuCell[][];
    winLine?: Point[] | null;
    onCellClick?: (row: number, col: number) => void;
    disabled?: boolean;
    confirmPlacement?: ConfirmPlacement;
}) {
    const requiresConfirmation = useConfirmPlacement(confirmPlacement);
    const [selectedPoint, setSelectedPoint] = useState<Point | null>(null);
    const flat = Array.isArray(board) && board.length > 0 ? board.flat() : [];
    const stoneCount = flat.reduce((count, cell) => count + (cell.value ? 1 : 0), 0);
    const previousStoneCountRef = useRef<number | null>(null);
    const previousWinLineKeyRef = useRef<string | null | undefined>(undefined);
    const boardStyle = {
        "--gomoku-edge": "clamp(14px, 3.7%, 30px)",
    } as CSSProperties;
    const pointButtonSize = "min(44px, calc(100% / 14))";
    const winLineKey = winLine?.map((point) => `${point.row}-${point.col}`).join("|") ?? null;
    const winLinePoints = winLine ?? [];

    useEffect(() => {
        setSelectedPoint(null);
    }, [board, disabled, requiresConfirmation]);

    useEffect(() => {
        const previousStoneCount = previousStoneCountRef.current;
        if (previousStoneCount !== null && stoneCount === previousStoneCount + 1) {
            playStoneSound();
        }
        previousStoneCountRef.current = stoneCount;
    }, [stoneCount]);

    useEffect(() => {
        const previousWinLineKey = previousWinLineKeyRef.current;
        if (
            previousWinLineKey !== undefined &&
            winLineKey !== null &&
            winLineKey !== previousWinLineKey
        ) {
            playVictorySound();
        }
        previousWinLineKeyRef.current = winLineKey;
    }, [winLineKey]);

    const handlePointClick = (cell: GomokuCell) => {
        if (disabled || cell.value !== null) return;
        if (!onCellClick) return;
        getAudioContext();
        if (!requiresConfirmation) {
            onCellClick(cell.row, cell.col);
            return;
        }

        const point = { row: cell.row, col: cell.col };
        if (isSamePoint(selectedPoint, point)) {
            setSelectedPoint(null);
            onCellClick(cell.row, cell.col);
            return;
        }
        setSelectedPoint(point);
    };

    return (
        <div
            className="w-full pb-2"
            aria-label={
                requiresConfirmation
                    ? "五子棋棋盘，先点交点定位，再点同一交点确认落子"
                    : "五子棋棋盘，棋子落在 15×15 交叉点上"
            }
        >
            <div
                className="aspect-square w-full max-w-[675px] mx-auto rounded-md border border-amber-900/20 bg-linear-to-br from-amber-100 to-amber-200/80 shadow-inner dark:border-amber-200/10 dark:from-amber-950/40 dark:to-amber-900/30"
                style={boardStyle}
            >
                <div className="relative h-full w-full">
                    <div className="absolute inset-(--gomoku-edge)">
                        {BOARD_LINES.map((index) => (
                            <span
                                key={`v-${index}`}
                                aria-hidden
                                className="absolute top-0 h-full w-px -translate-x-1/2 bg-amber-900/35 dark:bg-amber-100/20"
                                style={{ left: pointPercent(index) }}
                            />
                        ))}
                        {BOARD_LINES.map((index) => (
                            <span
                                key={`h-${index}`}
                                aria-hidden
                                className="absolute left-0 h-px w-full -translate-y-1/2 bg-amber-900/35 dark:bg-amber-100/20"
                                style={{ top: pointPercent(index) }}
                            />
                        ))}
                        {STAR_POINTS.map((point) => (
                            <span
                                key={`star-${point.row}-${point.col}`}
                                aria-hidden
                                className="absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-950/55 dark:bg-amber-100/45"
                                style={{
                                    left: pointPercent(point.col),
                                    top: pointPercent(point.row),
                                }}
                            />
                        ))}
                        {winLinePoints.map((point, index) => (
                            <span
                                key={`win-ring-${point.row}-${point.col}`}
                                aria-hidden
                                className="gomoku-win-ring pointer-events-none absolute"
                                style={{
                                    left: pointPercent(point.col),
                                    top: pointPercent(point.row),
                                    animationDelay: `${index * 35}ms`,
                                }}
                            />
                        ))}

                        {flat.map((cell) => {
                            const occupied = cell.value !== null;
                            const selected = !occupied && isSamePoint(selectedPoint, cell);
                            return (
                                <button
                                    key={`${cell.row}-${cell.col}`}
                                    type="button"
                                    onClick={() => handlePointClick(cell)}
                                    disabled={disabled || occupied}
                                    aria-label={getCellAriaLabel(
                                        cell,
                                        selected,
                                        requiresConfirmation,
                                    )}
                                    style={{
                                        left: pointPercent(cell.col),
                                        top: pointPercent(cell.row),
                                        width: pointButtonSize,
                                        height: pointButtonSize,
                                    }}
                                    className={cn(
                                        "group absolute flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full transition",
                                        "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-amber-100 dark:focus-visible:ring-offset-amber-950",
                                        selected ? "z-20" : "z-10",
                                        disabled || occupied ? "cursor-default" : "cursor-pointer",
                                    )}
                                >
                                    {cell.value === "black" ? (
                                        <span className="gomoku-stone h-[72%] w-[72%] rounded-full border border-gray-700 bg-gray-900 shadow-xs shadow-black/40 dark:border-gray-300 dark:bg-gray-100 sm:shadow-md" />
                                    ) : cell.value === "white" ? (
                                        <span className="gomoku-stone h-[72%] w-[72%] rounded-full border border-gray-400 bg-linear-to-br from-white to-gray-100 shadow-xs shadow-black/25 dark:from-gray-800 dark:to-gray-900 dark:border-gray-500 sm:border-2 sm:shadow-md" />
                                    ) : selected ? (
                                        <span className="relative h-[78%] w-[78%] rounded-full border-2 border-primary bg-primary/15 shadow-[0_0_0_4px_hsl(var(--primary)/0.14)]">
                                            <span
                                                className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary"
                                                aria-hidden
                                            />
                                        </span>
                                    ) : (
                                        <span
                                            className={cn(
                                                "h-2.5 w-2.5 rounded-full bg-primary/35 opacity-0 transition-opacity",
                                                !disabled && "group-hover:opacity-100 group-focus-visible:opacity-100",
                                            )}
                                            aria-hidden
                                        />
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}
