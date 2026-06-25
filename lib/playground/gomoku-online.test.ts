import { describe, expect, it } from "vitest";

import {
    GOMOKU_BOARD_SIZE,
    GOMOKU_ROOM_CODE_LENGTH,
    GOMOKU_TOTAL_CELLS,
    createEmptyBoard,
    generateRoomCode,
    opponentColor,
} from "./gomoku-online";

describe("gomoku-online shared helpers", () => {
    it("creates a 15x15 empty board", () => {
        const board = createEmptyBoard();
        expect(board).toHaveLength(GOMOKU_BOARD_SIZE);
        for (const row of board) {
            expect(row).toHaveLength(GOMOKU_BOARD_SIZE);
            for (const cell of row) {
                expect(cell.value).toBeNull();
            }
        }
    });

    it("generates a 6-character room code from the unambiguous alphabet", () => {
        const code = generateRoomCode();
        expect(code).toHaveLength(GOMOKU_ROOM_CODE_LENGTH);
        // 不含易混淆字符 0/O/1/I/L
        expect(code).not.toMatch(/[01OIL]/);
    });

    it("generates distinct codes across calls (probabilistic)", () => {
        const codes = new Set(Array.from({ length: 20 }, () => generateRoomCode()));
        expect(codes.size).toBeGreaterThan(1);
    });

    it("flips color with opponentColor", () => {
        expect(opponentColor("black")).toBe("white");
        expect(opponentColor("white")).toBe("black");
    });

    it("exposes the expected total cell count", () => {
        expect(GOMOKU_TOTAL_CELLS).toBe(225);
    });
});
