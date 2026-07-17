import { describe, expect, it } from "vitest";

import {
    addFunctionWarsRepairsToMap,
    availableFunctionWarsCrates,
    buildFunctionWarsOnlineMap,
    createFunctionWarsInitialInventory,
    isFunctionWarsMapId,
    isFunctionWarsWeaponId,
    normalizeFunctionWarsExpression,
    opponentFunctionWarsRole,
} from "./function-wars-online";

describe("function-wars-online", () => {
    it("builds the same map for the same seed", () => {
        expect(buildFunctionWarsOnlineMap(42)).toEqual(
            buildFunctionWarsOnlineMap(42),
        );
        expect(buildFunctionWarsOnlineMap(42)).not.toEqual(
            buildFunctionWarsOnlineMap(43),
        );
    });

    it("mirrors turrets, paired obstacles, and scheduled crates", () => {
        const map = buildFunctionWarsOnlineMap(17);

        expect(map.turrets.host.x).toBe(-map.turrets.guest.x);
        expect(map.turrets.host.y).toBe(map.turrets.guest.y);

        const hostCover = map.obstacles.find((obstacle) => obstacle.id === "host-cover");
        const guestCover = map.obstacles.find((obstacle) => obstacle.id === "guest-cover");
        expect(hostCover?.x).toBe(-(guestCover?.x ?? 0));
        expect(hostCover).toMatchObject({
            shape: guestCover?.shape,
            destructible: guestCover?.destructible,
            material: guestCover?.material,
        });

        const floor = map.obstacles.find((obstacle) => obstacle.id === "bedrock-floor");
        expect(floor).toMatchObject({
            shape: "rect",
            x: 0,
            width: 24,
            destructible: false,
            material: "bedrock",
        });
        if (floor?.shape !== "rect") throw new Error("bedrock floor must be rectangular");
        const floorTop = floor.y + floor.height / 2;
        const hostClearance = map.turrets.host.y - floorTop;
        const guestClearance = map.turrets.guest.y - floorTop;
        expect(floorTop).toBeCloseTo(-5.25);
        expect(hostClearance).toBeCloseTo(0.1);
        expect(guestClearance).toBe(hostClearance);
        expect(floor.x - floor.width / 2).toBe(map.bounds.minX);
        expect(floor.x + floor.width / 2).toBe(map.bounds.maxX);

        for (let index = 0; index < map.crates.length; index += 2) {
            const host = map.crates[index];
            const guest = map.crates[index + 1];
            expect(host.x).toBe(-guest.x);
            expect(host.y).toBe(guest.y);
            expect(host.type).toBe(guest.type);
            expect(host.spawn_shot).toBe(guest.spawn_shot);
            expect(host.reward_weapon).toBe(guest.reward_weapon);
        }
    });

    it("reveals only spawned and uncollected crates", () => {
        const crates = buildFunctionWarsOnlineMap(9).crates;
        crates[0] = { ...crates[0], picked_by: "host", picked_seq: 1 };

        const available = availableFunctionWarsCrates(crates, 4);
        expect(available.every((crate) => crate.spawn_shot <= 4)).toBe(true);
        expect(available.some((crate) => crate.id === crates[0].id)).toBe(false);
        expect(available.some((crate) => crate.spawn_shot === 8)).toBe(false);
    });

    it("returns independent and symmetric initial inventories", () => {
        const inventory = createFunctionWarsInitialInventory();
        expect(inventory.host).toEqual(inventory.guest);

        inventory.host.heavy -= 1;
        expect(inventory.guest.heavy).toBe(2);
    });

    it("guards ids and flips roles", () => {
        expect(isFunctionWarsMapId("symmetric-canyon")).toBe(true);
        expect(isFunctionWarsMapId("unknown")).toBe(false);
        expect(isFunctionWarsWeaponId("split")).toBe(true);
        expect(isFunctionWarsWeaponId("laser")).toBe(false);
        expect(opponentFunctionWarsRole("host")).toBe("guest");
        expect(opponentFunctionWarsRole("guest")).toBe("host");
    });

    it("normalizes expressions to the parser's server-safe source", () => {
        expect(normalizeFunctionWarsExpression("2×x − π")).toEqual({
            ok: true,
            expression: "2*x - pi",
        });
        expect(normalizeFunctionWarsExpression("round(x)")).toEqual({
            ok: true,
            expression: "round(x)",
        });
        expect(normalizeFunctionWarsExpression("alert(x)").ok).toBe(false);
    });

    it("adds only repairs created before a replayed shot", () => {
        const map = buildFunctionWarsOnlineMap(4);
        const repairs = [
            {
                id: "repair-1",
                shape: "circle" as const,
                x: -8.6,
                y: -5.2,
                radius: 1.15,
                destructible: true as const,
                material: "earth" as const,
                by: "host" as const,
                shot_seq: 3,
            },
            {
                id: "repair-2",
                shape: "circle" as const,
                x: 8.6,
                y: -5.2,
                radius: 1.15,
                destructible: true as const,
                material: "earth" as const,
                by: "guest" as const,
                shot_seq: 5,
            },
        ];

        const replayMap = addFunctionWarsRepairsToMap(map, repairs, 5);
        expect(replayMap.obstacles.some((obstacle) => obstacle.id === "repair-1")).toBe(true);
        expect(replayMap.obstacles.some((obstacle) => obstacle.id === "repair-2")).toBe(false);
        expect(map.obstacles.some((obstacle) => obstacle.id === "repair-1")).toBe(false);
    });
});
