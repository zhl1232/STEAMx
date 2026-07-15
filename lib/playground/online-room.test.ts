import { describe, expect, it } from "vitest";

import { generateRoomCode, ROOM_CODE_LENGTH } from "./online-room";

describe("online-room shared helpers", () => {
    it("generates a 6-character room code from the unambiguous alphabet", () => {
        const code = generateRoomCode();
        expect(code).toHaveLength(ROOM_CODE_LENGTH);
        // 不含易混淆字符 0/O/1/I/L
        expect(code).not.toMatch(/[01OIL]/);
    });

    it("generates distinct codes across calls (probabilistic)", () => {
        const codes = new Set(Array.from({ length: 20 }, () => generateRoomCode()));
        expect(codes.size).toBeGreaterThan(1);
    });
});
