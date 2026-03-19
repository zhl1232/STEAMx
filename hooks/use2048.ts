import { useState, useCallback, useEffect, useRef } from 'react';
import { getPlaygroundItem, setPlaygroundItem } from "@/lib/playground/storage";

export type Game2048Status = 'idle' | 'playing' | 'won' | 'gameover';

export type Game2048Stats = {
    bestScore: number;
    totalGames: number;
    wins: number;
    maxTile: number;
};

export type TileData = {
    id: number;
    value: number;
    row: number;
    col: number;
    isNew?: boolean;
    isMerged?: boolean;
};

type Grid = number[][];

type Snapshot = {
    grid: Grid;
    score: number;
};

const GRID_SIZE = 4;
const STATS_KEY = 'game_2048_stats';
const SWIPE_THRESHOLD = 30;

function loadStats(): Game2048Stats {
    return getPlaygroundItem<Game2048Stats>(STATS_KEY) ?? { bestScore: 0, totalGames: 0, wins: 0, maxTile: 0 };
}

function saveStats(stats: Game2048Stats) {
    setPlaygroundItem(STATS_KEY, stats);
}

function createEmptyGrid(): Grid {
    return Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(0));
}

function cloneGrid(grid: Grid): Grid {
    return grid.map(row => [...row]);
}

function getMaxTile(grid: Grid): number {
    let max = 0;
    for (const row of grid) {
        for (const val of row) {
            if (val > max) max = val;
        }
    }
    return max;
}

function hasMovesAvailable(grid: Grid): boolean {
    for (let r = 0; r < GRID_SIZE; r++) {
        for (let c = 0; c < GRID_SIZE; c++) {
            if (grid[r][c] === 0) return true;
            if (c < GRID_SIZE - 1 && grid[r][c] === grid[r][c + 1]) return true;
            if (r < GRID_SIZE - 1 && grid[r][c] === grid[r + 1][c]) return true;
        }
    }
    return false;
}

// 将一行向左滑动合并，返回新行和得分增量
function slideRow(row: number[]): { result: number[]; score: number; mergedIndices: Set<number> } {
    const nonZero = row.filter(v => v !== 0);
    const result: number[] = [];
    const mergedIndices = new Set<number>();
    let score = 0;
    let i = 0;

    while (i < nonZero.length) {
        if (i + 1 < nonZero.length && nonZero[i] === nonZero[i + 1]) {
            const merged = nonZero[i] * 2;
            result.push(merged);
            mergedIndices.add(result.length - 1);
            score += merged;
            i += 2;
        } else {
            result.push(nonZero[i]);
            i++;
        }
    }

    while (result.length < GRID_SIZE) result.push(0);
    return { result, score, mergedIndices };
}

// 对整个网格执行一次移动，返回新网格、得分增量、合并位置集合以及是否发生变化
function applyMove(grid: Grid, direction: 'up' | 'down' | 'left' | 'right'): {
    newGrid: Grid;
    scoreGain: number;
    mergedCells: Set<string>;
    changed: boolean;
} {
    const newGrid = createEmptyGrid();
    let scoreGain = 0;
    const mergedCells = new Set<string>();
    let changed = false;

    for (let i = 0; i < GRID_SIZE; i++) {
        let line: number[];

        switch (direction) {
            case 'left':
                line = grid[i].slice();
                break;
            case 'right':
                line = grid[i].slice().reverse();
                break;
            case 'up':
                line = Array.from({ length: GRID_SIZE }, (_, j) => grid[j][i]);
                break;
            case 'down':
                line = Array.from({ length: GRID_SIZE }, (_, j) => grid[GRID_SIZE - 1 - j][i]);
                break;
        }

        const { result, score, mergedIndices } = slideRow(line);
        scoreGain += score;

        for (let j = 0; j < GRID_SIZE; j++) {
            let r: number, c: number;
            switch (direction) {
                case 'left':
                    r = i; c = j;
                    break;
                case 'right':
                    r = i; c = GRID_SIZE - 1 - j;
                    break;
                case 'up':
                    r = j; c = i;
                    break;
                case 'down':
                    r = GRID_SIZE - 1 - j; c = i;
                    break;
            }
            newGrid[r][c] = result[j];
            if (mergedIndices.has(j)) {
                mergedCells.add(`${r},${c}`);
            }
            if (result[j] !== grid[r][c]) {
                changed = true;
            }
        }
    }

    return { newGrid, scoreGain, mergedCells, changed };
}

function getEmptyCells(grid: Grid): [number, number][] {
    const cells: [number, number][] = [];
    for (let r = 0; r < GRID_SIZE; r++) {
        for (let c = 0; c < GRID_SIZE; c++) {
            if (grid[r][c] === 0) cells.push([r, c]);
        }
    }
    return cells;
}

function addRandomTile(grid: Grid): [number, number] | null {
    const empty = getEmptyCells(grid);
    if (empty.length === 0) return null;
    const [r, c] = empty[Math.floor(Math.random() * empty.length)];
    grid[r][c] = Math.random() < 0.9 ? 2 : 4;
    return [r, c];
}

function gridToTiles(grid: Grid, idCounter: React.MutableRefObject<number>, mergedCells: Set<string>, newCell: [number, number] | null): TileData[] {
    const tiles: TileData[] = [];
    for (let r = 0; r < GRID_SIZE; r++) {
        for (let c = 0; c < GRID_SIZE; c++) {
            if (grid[r][c] !== 0) {
                tiles.push({
                    id: idCounter.current++,
                    value: grid[r][c],
                    row: r,
                    col: c,
                    isMerged: mergedCells.has(`${r},${c}`),
                    isNew: newCell !== null && newCell[0] === r && newCell[1] === c,
                });
            }
        }
    }
    return tiles;
}

export function use2048() {
    const [grid, setGrid] = useState<Grid>(createEmptyGrid);
    const [tiles, setTiles] = useState<TileData[]>([]);
    const [score, setScore] = useState(0);
    const [status, setStatus] = useState<Game2048Status>('idle');
    const [stats, setStats] = useState<Game2048Stats>(loadStats);
    const [isNewRecord, setIsNewRecord] = useState(false);
    const [canUndo, setCanUndo] = useState(false);

    const idCounterRef = useRef(1);
    const prevSnapshotRef = useRef<Snapshot | null>(null);
    const hasWonRef = useRef(false);
    const touchStartRef = useRef<{ x: number; y: number } | null>(null);

    const refreshTiles = useCallback((g: Grid, mergedCells: Set<string>, newCell: [number, number] | null) => {
        setTiles(gridToTiles(g, idCounterRef, mergedCells, newCell));
    }, []);

    const startNewGame = useCallback(() => {
        const g = createEmptyGrid();
        addRandomTile(g);
        const newCell = addRandomTile(g);
        setGrid(g);
        setScore(0);
        setStatus('playing');
        setCanUndo(false);
        setIsNewRecord(false);
        prevSnapshotRef.current = null;
        hasWonRef.current = false;
        refreshTiles(g, new Set(), newCell);
    }, [refreshTiles]);

    // 初始化：组件挂载时开始新游戏
    const initializedRef = useRef(false);
    useEffect(() => {
        if (!initializedRef.current) {
            initializedRef.current = true;
            startNewGame();
        }
    }, [startNewGame]);

    const updateStats = useCallback((currentScore: number, currentGrid: Grid, didWin: boolean) => {
        setStats(prev => {
            const maxTile = Math.max(prev.maxTile, getMaxTile(currentGrid));
            const bestScore = Math.max(prev.bestScore, currentScore);
            const newRecord = currentScore > prev.bestScore;
            setIsNewRecord(newRecord);
            const next: Game2048Stats = {
                bestScore,
                totalGames: prev.totalGames,
                wins: prev.wins + (didWin ? 1 : 0),
                maxTile,
            };
            saveStats(next);
            return next;
        });
    }, []);

    const move = useCallback((direction: 'up' | 'down' | 'left' | 'right') => {
        if (status !== 'playing' && status !== 'won') return;

        setGrid(prevGrid => {
            const { newGrid, scoreGain, mergedCells, changed } = applyMove(prevGrid, direction);
            if (!changed) return prevGrid;

            prevSnapshotRef.current = { grid: cloneGrid(prevGrid), score: score };
            setCanUndo(true);

            const newCell = addRandomTile(newGrid);

            const newScore = score + scoreGain;
            setScore(newScore);
            refreshTiles(newGrid, mergedCells, newCell);

            const maxTile = getMaxTile(newGrid);
            if (maxTile >= 2048 && !hasWonRef.current) {
                hasWonRef.current = true;
                setStatus('won');
                updateStats(newScore, newGrid, true);
            } else if (!hasMovesAvailable(newGrid)) {
                setStatus('gameover');
                setStats(prev => {
                    const next: Game2048Stats = {
                        bestScore: Math.max(prev.bestScore, newScore),
                        totalGames: prev.totalGames + 1,
                        wins: prev.wins,
                        maxTile: Math.max(prev.maxTile, maxTile),
                    };
                    setIsNewRecord(newScore > prev.bestScore);
                    saveStats(next);
                    return next;
                });
            } else {
                setStats(prev => {
                    const best = Math.max(prev.bestScore, newScore);
                    if (best !== prev.bestScore) {
                        setIsNewRecord(true);
                        const next = { ...prev, bestScore: best, maxTile: Math.max(prev.maxTile, maxTile) };
                        saveStats(next);
                        return next;
                    }
                    return prev;
                });
            }

            return newGrid;
        });
    }, [status, score, refreshTiles, updateStats]);

    const undo = useCallback(() => {
        if (!prevSnapshotRef.current || !canUndo) return;
        const { grid: prevGrid, score: prevScore } = prevSnapshotRef.current;
        setGrid(prevGrid);
        setScore(prevScore);
        setCanUndo(false);
        prevSnapshotRef.current = null;
        refreshTiles(prevGrid, new Set(), null);
        if (status === 'gameover') {
            setStatus('playing');
        }
    }, [canUndo, status, refreshTiles]);

    const resetGame = useCallback(() => {
        setStats(prev => {
            if (status === 'playing' || status === 'won') {
                const next = { ...prev, totalGames: prev.totalGames + 1 };
                saveStats(next);
                return next;
            }
            return prev;
        });
        startNewGame();
    }, [startNewGame, status]);

    const continueAfterWin = useCallback(() => {
        if (status === 'won') {
            setStatus('playing');
        }
    }, [status]);

    // 键盘支持
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const keyMap: Record<string, 'up' | 'down' | 'left' | 'right'> = {
                ArrowUp: 'up',
                ArrowDown: 'down',
                ArrowLeft: 'left',
                ArrowRight: 'right',
                w: 'up',
                W: 'up',
                s: 'down',
                S: 'down',
                a: 'left',
                A: 'left',
                d: 'right',
                D: 'right',
            };
            const direction = keyMap[e.key];
            if (direction) {
                e.preventDefault();
                move(direction);
            }
            if (e.key === 'z' || e.key === 'Z') {
                if (e.ctrlKey || e.metaKey) {
                    e.preventDefault();
                    undo();
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [move, undo]);

    // 触摸事件处理
    const onTouchStart = useCallback((e: React.TouchEvent) => {
        const touch = e.touches[0];
        touchStartRef.current = { x: touch.clientX, y: touch.clientY };
    }, []);

    const onTouchEnd = useCallback((e: React.TouchEvent) => {
        if (!touchStartRef.current) return;
        const touch = e.changedTouches[0];
        const dx = touch.clientX - touchStartRef.current.x;
        const dy = touch.clientY - touchStartRef.current.y;
        touchStartRef.current = null;

        const absDx = Math.abs(dx);
        const absDy = Math.abs(dy);

        if (Math.max(absDx, absDy) < SWIPE_THRESHOLD) return;

        if (absDx > absDy) {
            move(dx > 0 ? 'right' : 'left');
        } else {
            move(dy > 0 ? 'down' : 'up');
        }
    }, [move]);

    return {
        tiles,
        score,
        status,
        stats,
        isNewRecord,
        move,
        undo,
        canUndo,
        resetGame,
        continueAfterWin,
        onTouchStart,
        onTouchEnd,
    };
}
