import { useState, useCallback, useEffect, useRef } from 'react';

export type CellState = {
    row: number;
    col: number;
    isMine: boolean;
    isRevealed: boolean;
    isFlagged: boolean;
    neighborMines: number;
};

export type GameStatus = 'idle' | 'playing' | 'won' | 'lost';

export type DifficultyInfo = {
    rows: number;
    cols: number;
    mines: number;
};

export const DIFFICULTIES: Record<string, DifficultyInfo> = {
    beginner: { rows: 9, cols: 9, mines: 10 },
    intermediate: { rows: 16, cols: 16, mines: 40 },
    expert: { rows: 16, cols: 30, mines: 99 },
};

// 工具函数：获取相邻格子的坐标
const getNeighbors = (row: number, col: number, maxRow: number, maxCol: number) => {
    const neighbors: [number, number][] = [];
    for (let r = Math.max(0, row - 1); r <= Math.min(row + 1, maxRow - 1); r++) {
        for (let c = Math.max(0, col - 1); c <= Math.min(col + 1, maxCol - 1); c++) {
            if (r !== row || c !== col) {
                neighbors.push([r, c]);
            }
        }
    }
    return neighbors;
};

const BEST_TIMES_KEY = 'minesweeper_best_times';

type BestTimes = Record<string, number>; // difficulty -> best seconds

function loadBestTimes(): BestTimes {
    if (typeof window === 'undefined') return {};
    try {
        const raw = localStorage.getItem(BEST_TIMES_KEY);
        return raw ? JSON.parse(raw) : {};
    } catch {
        return {};
    }
}

export function useMinesweeper(initialDifficulty: keyof typeof DIFFICULTIES = 'beginner') {
    const [difficulty, setDifficulty] = useState<DifficultyInfo>(DIFFICULTIES[initialDifficulty]);
    const [difficultyKey, setDifficultyKey] = useState<string>(initialDifficulty);
    const [board, setBoard] = useState<CellState[][]>([]);
    const [status, setStatus] = useState<GameStatus>('idle');
    const [flagsCount, setFlagsCount] = useState(0);
    const [time, setTime] = useState(0);
    const [bestTimes, setBestTimes] = useState<BestTimes>(loadBestTimes);
    const [isNewRecord, setIsNewRecord] = useState(false);
    const timeRef = useRef(0);

    // 初始化空盘面（没有雷，点第一下时才布雷）
    const initBoard = useCallback((diff: DifficultyInfo) => {
        const newBoard: CellState[][] = [];
        for (let r = 0; r < diff.rows; r++) {
            const row: CellState[] = [];
            for (let c = 0; c < diff.cols; c++) {
                row.push({
                    row: r,
                    col: c,
                    isMine: false,
                    isRevealed: false,
                    isFlagged: false,
                    neighborMines: 0,
                });
            }
            newBoard.push(row);
        }
        setBoard(newBoard);
        setStatus('idle');
        setFlagsCount(0);
        setTime(0);
    }, []);

    useEffect(() => {
        initBoard(difficulty);
    }, [difficulty, initBoard]);

    // 计时器（用 ref 同步时间，方便 checkWinCondition 读取准确值）
    useEffect(() => {
        let timer: NodeJS.Timeout;
        if (status === 'playing') {
            timer = setInterval(() => {
                setTime((prev) => {
                    const next = prev + 1;
                    timeRef.current = next;
                    return next;
                });
            }, 1000);
        }
        return () => clearInterval(timer);
    }, [status]);

    const updateBestTime = useCallback((key: string, finalTime: number) => {
        setBestTimes((prev) => {
            const current = prev[key];
            if (current === undefined || finalTime < current) {
                const next = { ...prev, [key]: finalTime };
                try { localStorage.setItem(BEST_TIMES_KEY, JSON.stringify(next)); } catch { /* ignore */ }
                setIsNewRecord(true);
                return next;
            }
            setIsNewRecord(false);
            return prev;
        });
    }, []);

    // 布雷并计算数字（规避首次点击位置及其周围）
    const placeMines = (firstClickRow: number, firstClickCol: number) => {
        const newBoard = JSON.parse(JSON.stringify(board)) as CellState[][];
        let minesPlaced = 0;

        // 安全区：点击处及周围一圈不能有雷，保证开局体验（如果盘面足够大）
        const safeZone = new Set(
            getNeighbors(firstClickRow, firstClickCol, difficulty.rows, difficulty.cols)
                .map(([r, c]) => `${r},${c}`)
        );
        safeZone.add(`${firstClickRow},${firstClickCol}`);

        while (minesPlaced < difficulty.mines) {
            const r = Math.floor(Math.random() * difficulty.rows);
            const c = Math.floor(Math.random() * difficulty.cols);

            if (!newBoard[r][c].isMine && !safeZone.has(`${r},${c}`)) {
                newBoard[r][c].isMine = true;
                minesPlaced++;
            }
        }

        // 计算相邻数字
        for (let r = 0; r < difficulty.rows; r++) {
            for (let c = 0; c < difficulty.cols; c++) {
                if (!newBoard[r][c].isMine) {
                    const neighbors = getNeighbors(r, c, difficulty.rows, difficulty.cols);
                    const count = neighbors.reduce((acc, [nr, nc]) => (newBoard[nr][nc].isMine ? acc + 1 : acc), 0);
                    newBoard[r][c].neighborMines = count;
                }
            }
        }

        return newBoard;
    };

    const revealCell = (row: number, col: number) => {
        if (status === 'won' || status === 'lost') return;
        if (board[row][col].isRevealed || board[row][col].isFlagged) return;

        let currentBoard = board;

        // 第一次点击才真正初始化布雷（防杀开局）
        if (status === 'idle') {
            currentBoard = placeMines(row, col);
            setStatus('playing');
        }

        const newBoard = JSON.parse(JSON.stringify(currentBoard)) as CellState[][];

        // 踩雷判断
        if (newBoard[row][col].isMine) {
            // 游戏结束，翻开所有雷
            newBoard.forEach(r => r.forEach(c => {
                if (c.isMine) c.isRevealed = true;
            }));
            setBoard(newBoard);
            setStatus('lost');
            return;
        }

        // Flood Fill (DFS/BFS) 递归翻开周围均为0的空地
        const revealEmpty = (r: number, c: number) => {
            const stack = [[r, c]];
            while (stack.length > 0) {
                const [currR, currC] = stack.pop()!;
                const cell = newBoard[currR][currC];

                if (!cell.isRevealed && !cell.isFlagged) {
                    cell.isRevealed = true;
                    if (cell.neighborMines === 0) {
                        const neighbors = getNeighbors(currR, currC, difficulty.rows, difficulty.cols);
                        for (const [nr, nc] of neighbors) {
                            if (!newBoard[nr][nc].isRevealed) {
                                stack.push([nr, nc]);
                            }
                        }
                    }
                }
            }
        };

        revealEmpty(row, col);
        setBoard(newBoard);
        checkWinCondition(newBoard);
    };

    const toggleFlag = (row: number, col: number, e?: React.MouseEvent | React.TouchEvent) => {
        if (e) e.preventDefault(); // 阻止默认右键菜单
        if (status === 'idle' || status === 'won' || status === 'lost') return;
        if (board[row][col].isRevealed) return;

        const newBoard = [...board];
        const cell = { ...newBoard[row][col] };

        if (!cell.isFlagged) {
            if (flagsCount >= difficulty.mines) return; // 旗子用完不能再插
            cell.isFlagged = true;
            setFlagsCount(prev => prev + 1);
        } else {
            cell.isFlagged = false;
            setFlagsCount(prev => prev - 1);
        }

        newBoard[row][col] = cell;
        setBoard(newBoard);
    };

    // 双击已经翻开的数字：如果周围正确标记了雷，自动翻开其余未知方块
    const autoReveal = (row: number, col: number) => {
        if (status !== 'playing') return;
        const cell = board[row][col];
        if (!cell.isRevealed || cell.neighborMines === 0) return;

        const neighbors = getNeighbors(row, col, difficulty.rows, difficulty.cols);
        const flaggedCount = neighbors.filter(([r, c]) => board[r][c].isFlagged).length;

        if (flaggedCount === cell.neighborMines) {
            let currentBoard = JSON.parse(JSON.stringify(board)) as CellState[][];
            let hasChanged = false;
            let lost = false;

            const revealEmpty = (r: number, c: number) => {
                const stack = [[r, c]];
                while (stack.length > 0) {
                    const [currR, currC] = stack.pop()!;
                    const currentCell = currentBoard[currR][currC];

                    if (!currentCell.isRevealed && !currentCell.isFlagged) {
                        currentCell.isRevealed = true;
                        hasChanged = true;
                        if (currentCell.neighborMines === 0 && !currentCell.isMine) {
                            const currentNeighbors = getNeighbors(currR, currC, difficulty.rows, difficulty.cols);
                            for (const [nr, nc] of currentNeighbors) {
                                if (!currentBoard[nr][nc].isRevealed && !currentBoard[nr][nc].isFlagged) {
                                    stack.push([nr, nc]);
                                }
                            }
                        }
                    }
                }
            };

            neighbors.forEach(([r, c]) => {
                const neighborCell = currentBoard[r][c];
                if (!neighborCell.isRevealed && !neighborCell.isFlagged) {
                    if (neighborCell.isMine) {
                        lost = true;
                        // Reveal all mines on loss
                        currentBoard.forEach(row => row.forEach(cell => {
                            if (cell.isMine) cell.isRevealed = true;
                        }));
                    } else {
                        revealEmpty(r, c);
                    }
                }
            });

            if (hasChanged || lost) {
                setBoard(currentBoard);
                if (lost) {
                    setStatus('lost');
                } else {
                    checkWinCondition(currentBoard);
                }
            }
        }
    };


    const checkWinCondition = (currentBoard: CellState[][]) => {
        let unrevealedSafeCells = 0;
        currentBoard.forEach(row => {
            row.forEach(cell => {
                if (!cell.isMine && !cell.isRevealed) {
                    unrevealedSafeCells++;
                }
            });
        });

        if (unrevealedSafeCells === 0) {
            setStatus('won');
            updateBestTime(difficultyKey, timeRef.current);
        }
    };

    const changeDifficulty = (level: keyof typeof DIFFICULTIES) => {
        setDifficulty(DIFFICULTIES[level]);
        setDifficultyKey(level);
    };

    const resetGame = () => {
        initBoard(difficulty);
        setIsNewRecord(false);
        timeRef.current = 0;
    };

    return {
        board,
        status,
        flagsCount,
        time,
        minesLeft: difficulty.mines - flagsCount,
        revealCell,
        toggleFlag,
        autoReveal,
        resetGame,
        changeDifficulty,
        difficultyName: difficultyKey,
        bestTimes,
        isNewRecord,
    };
}
