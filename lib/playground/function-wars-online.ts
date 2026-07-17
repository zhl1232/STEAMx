import {
    generateRoomCode,
    type BaseMatchRow,
} from "@/lib/playground/online-room";
import { parseFunctionExpression } from "@/lib/playground/function-plotter";

export { generateRoomCode };

export const FUNCTION_WARS_WORLD_BOUNDS = {
    minX: -12,
    maxX: 12,
    minY: -7,
    maxY: 7,
} as const;

export const FUNCTION_WARS_TURN_SECONDS = 60;
export const FUNCTION_WARS_MAX_SHOTS = 200;
export const FUNCTION_WARS_MAX_CRATERS = FUNCTION_WARS_MAX_SHOTS * 3;
export const FUNCTION_WARS_ONLINE_MAX_DAMAGE_PER_SHOT = 80;
export const FUNCTION_WARS_DEFAULT_MAP_ID = "symmetric-canyon" as const;
export const FUNCTION_WARS_MAP_IDS = [FUNCTION_WARS_DEFAULT_MAP_ID] as const;

export type FunctionWarsMapId = (typeof FUNCTION_WARS_MAP_IDS)[number];
export type FunctionWarsRole = "host" | "guest";
export type FunctionWarsWinner = FunctionWarsRole | "draw";

export const FUNCTION_WARS_WEAPON_IDS = [
    "standard",
    "heavy",
    "drill",
    "split",
    "mirror",
] as const;
export type FunctionWarsWeaponId = (typeof FUNCTION_WARS_WEAPON_IDS)[number];
export type FunctionWarsSpecialWeaponId = Exclude<FunctionWarsWeaponId, "standard">;

export const FUNCTION_WARS_CRATE_TYPES = [
    "ammo",
    "blast_boost",
    "penetration",
    "shield",
    "repair",
] as const;
export type FunctionWarsCrateType = (typeof FUNCTION_WARS_CRATE_TYPES)[number];

export type FunctionWarsPoint = { x: number; y: number };

export type FunctionWarsRectObstacle = {
    id: string;
    shape: "rect";
    x: number;
    y: number;
    width: number;
    height: number;
    destructible: boolean;
    material: "earth" | "wood" | "steel" | "bedrock";
};

export type FunctionWarsCircleObstacle = {
    id: string;
    shape: "circle";
    x: number;
    y: number;
    radius: number;
    destructible: boolean;
    material: "earth" | "wood" | "steel" | "bedrock";
};

export type FunctionWarsOnlineObstacle =
    | FunctionWarsRectObstacle
    | FunctionWarsCircleObstacle;

export type FunctionWarsRepair = FunctionWarsCircleObstacle & {
    shape: "circle";
    destructible: true;
    material: "earth";
    by: FunctionWarsRole;
    shot_seq: number;
};

export type FunctionWarsOnlineCrate = {
    id: string;
    type: FunctionWarsCrateType;
    x: number;
    y: number;
    spawn_shot: number;
    reward_weapon?: FunctionWarsSpecialWeaponId;
    picked_by: FunctionWarsRole | null;
    picked_seq: number | null;
};

export type FunctionWarsOnlineMap = {
    id: FunctionWarsMapId;
    seed: number;
    theme: "canyon";
    bounds: typeof FUNCTION_WARS_WORLD_BOUNDS;
    turrets: Record<FunctionWarsRole, FunctionWarsPoint>;
    obstacles: FunctionWarsOnlineObstacle[];
    crates: FunctionWarsOnlineCrate[];
};

export type FunctionWarsPlayerInventory = {
    heavy: number;
    drill: number;
    split: number;
    mirror: number;
    blast_boost: boolean;
    penetration: boolean;
    shield: boolean;
};

export type FunctionWarsInventory = Record<FunctionWarsRole, FunctionWarsPlayerInventory>;
export type FunctionWarsHp = Record<FunctionWarsRole, number>;

export type FunctionWarsCrater = {
    id: string;
    x: number;
    y: number;
    radius: number;
    by: FunctionWarsRole;
    weapon: FunctionWarsWeaponId;
    shot_seq: number;
};

export type FunctionWarsFireCrater = Pick<FunctionWarsCrater, "x" | "y" | "radius">;

export type FunctionWarsFireDamage = {
    target: FunctionWarsRole;
    amount: number;
};

/** Collision patch produced by the shared deterministic simulation. */
export type FunctionWarsFireSummary = {
    damage?: FunctionWarsFireDamage | null;
    craters?: FunctionWarsFireCrater[];
    picked_crate_ids?: string[];
};

export type FunctionWarsLastShotDamage = {
    target: FunctionWarsRole;
    claimed: number;
    applied: number;
    shielded: boolean;
};

export type FunctionWarsLastShot = {
    seq: number;
    by: FunctionWarsRole;
    weapon: FunctionWarsWeaponId;
    expression: string;
    damage: FunctionWarsLastShotDamage | null;
    craters: FunctionWarsFireCrater[];
    picked_crate_ids: string[];
    buffs_used: {
        blast_boost: boolean;
        penetration: boolean;
    };
    fired_at: string;
};

export type FunctionWarsMatchRow = BaseMatchRow & {
    map_seed: number;
    map_id: FunctionWarsMapId;
    craters: FunctionWarsCrater[];
    hp: FunctionWarsHp;
    inventory: FunctionWarsInventory;
    crates: FunctionWarsOnlineCrate[];
    repairs: FunctionWarsRepair[];
    current_turn: FunctionWarsRole;
    turn_deadline_at: string | null;
    last_shot: FunctionWarsLastShot | null;
    shot_seq: number;
    winner: FunctionWarsWinner | null;
    last_activity_at: string;
    host_consecutive_timeouts: number;
    guest_consecutive_timeouts: number;
};

export type NormalizeFunctionWarsExpressionResult =
    | { ok: true; expression: string }
    | { ok: false; error: string };

export type FunctionWarsFireResult = {
    ok: boolean;
    reason: string;
    shot_seq: number | null;
    current_turn: FunctionWarsRole | null;
    winner: FunctionWarsWinner | null;
};

const SPECIAL_WEAPONS: FunctionWarsSpecialWeaponId[] = [
    "heavy",
    "drill",
    "split",
    "mirror",
];

function normalizeSeed(seed: number): number {
    if (!Number.isFinite(seed)) return 0;
    return Math.trunc(seed) >>> 0;
}

/** Mulberry32 keeps map generation stable across browsers and Node. */
function createSeededRandom(seed: number): () => number {
    let state = normalizeSeed(seed);
    return () => {
        state = (state + 0x6d2b79f5) >>> 0;
        let value = state;
        value = Math.imul(value ^ (value >>> 15), value | 1);
        value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
        return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
    };
}

function round(value: number): number {
    return Math.round(value * 100) / 100;
}

function chooseCrateType(random: () => number): FunctionWarsCrateType {
    const roll = random();
    if (roll < 0.34) return "ammo";
    if (roll < 0.56) return "blast_boost";
    if (roll < 0.74) return "penetration";
    if (roll < 0.9) return "shield";
    return "repair";
}

function buildScheduledCrates(random: () => number): FunctionWarsOnlineCrate[] {
    const crates: FunctionWarsOnlineCrate[] = [];
    for (const spawnShot of [0, 4, 8, 12, 16, 20]) {
        const type = chooseCrateType(random);
        const rewardWeapon =
            type === "ammo"
                ? SPECIAL_WEAPONS[Math.floor(random() * SPECIAL_WEAPONS.length)]
                : undefined;
        const x = round(3.2 + random() * 3.2);
        const y = round(-1.4 + random() * 4.4);

        for (const side of ["host", "guest"] as const) {
            crates.push({
                id: `crate-${spawnShot}-${side}`,
                type,
                x: side === "host" ? -x : x,
                y,
                spawn_shot: spawnShot,
                ...(rewardWeapon ? { reward_weapon: rewardWeapon } : {}),
                picked_by: null,
                picked_seq: null,
            });
        }
    }
    return crates;
}

function buildSymmetricObstacles(random: () => number): FunctionWarsOnlineObstacle[] {
    const coverX = round(7.2 + random() * 0.7);
    const coverHeight = round(1.6 + random() * 0.5);
    const plateX = round(2.8 + random() * 0.6);
    const plateY = round(-0.6 + random() * 0.9);
    const plateHeight = round(2.2 + random() * 0.6);
    const moundRadius = round(1.05 + random() * 0.25);

    return [
        {
            id: "host-cover",
            shape: "rect",
            x: -coverX,
            y: -5.4,
            width: 1.35,
            height: coverHeight,
            destructible: true,
            material: "earth",
        },
        {
            id: "guest-cover",
            shape: "rect",
            x: coverX,
            y: -5.4,
            width: 1.35,
            height: coverHeight,
            destructible: true,
            material: "earth",
        },
        {
            id: "host-steel-plate",
            shape: "rect",
            x: -plateX,
            y: plateY,
            width: 0.42,
            height: plateHeight,
            destructible: false,
            material: "steel",
        },
        {
            id: "guest-steel-plate",
            shape: "rect",
            x: plateX,
            y: plateY,
            width: 0.42,
            height: plateHeight,
            destructible: false,
            material: "steel",
        },
        {
            id: "center-mound",
            shape: "circle",
            x: 0,
            y: -4.9,
            radius: moundRadius,
            destructible: true,
            material: "earth",
        },
        {
            id: "bedrock-floor",
            shape: "rect",
            x: 0,
            y: -6.125,
            width: 24,
            height: 1.75,
            destructible: false,
            material: "bedrock",
        },
    ];
}

export function isFunctionWarsMapId(value: unknown): value is FunctionWarsMapId {
    return FUNCTION_WARS_MAP_IDS.includes(value as FunctionWarsMapId);
}

export function isFunctionWarsWeaponId(value: unknown): value is FunctionWarsWeaponId {
    return FUNCTION_WARS_WEAPON_IDS.includes(value as FunctionWarsWeaponId);
}

export function opponentFunctionWarsRole(role: FunctionWarsRole): FunctionWarsRole {
    return role === "host" ? "guest" : "host";
}

export function normalizeFunctionWarsExpression(
    source: string,
): NormalizeFunctionWarsExpressionResult {
    const parsed = parseFunctionExpression(source);
    if (!parsed.ok) return { ok: false, error: parsed.error.message };
    return { ok: true, expression: parsed.parsed.source };
}

export function createFunctionWarsInitialInventory(): FunctionWarsInventory {
    const player = (): FunctionWarsPlayerInventory => ({
        heavy: 2,
        drill: 1,
        split: 1,
        mirror: 0,
        blast_boost: false,
        penetration: false,
        shield: false,
    });
    return { host: player(), guest: player() };
}

export function buildFunctionWarsOnlineMap(
    seed: number,
    mapId: FunctionWarsMapId = FUNCTION_WARS_DEFAULT_MAP_ID,
): FunctionWarsOnlineMap {
    if (!isFunctionWarsMapId(mapId)) {
        throw new Error(`Unsupported Function Wars map: ${String(mapId)}`);
    }

    const normalizedSeed = normalizeSeed(seed);
    const random = createSeededRandom(normalizedSeed);
    return {
        id: mapId,
        seed: normalizedSeed,
        theme: "canyon",
        bounds: FUNCTION_WARS_WORLD_BOUNDS,
        turrets: {
            host: { x: -10, y: -5.15 },
            guest: { x: 10, y: -5.15 },
        },
        obstacles: buildSymmetricObstacles(random),
        crates: buildScheduledCrates(random),
    };
}

export function addFunctionWarsRepairsToMap(
    map: FunctionWarsOnlineMap,
    repairs: FunctionWarsRepair[],
    beforeShotSeq = Number.POSITIVE_INFINITY,
): FunctionWarsOnlineMap {
    return {
        ...map,
        obstacles: [
            ...map.obstacles,
            ...repairs.filter((repair) => repair.shot_seq < beforeShotSeq),
        ],
    };
}

export function availableFunctionWarsCrates(
    crates: FunctionWarsOnlineCrate[],
    shotSeq: number,
): FunctionWarsOnlineCrate[] {
    return crates.filter(
        (crate) => crate.picked_by === null && crate.spawn_shot <= shotSeq,
    );
}
