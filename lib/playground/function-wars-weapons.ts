export type WeaponId = "standard" | "heavy" | "drill" | "split" | "mirror"
export type SpecialWeaponId = Exclude<WeaponId, "standard">
export type PickupId = "ammo" | "blast_boost" | "penetration" | "shield" | "repair"
export type FunctionWarsEnemyType = "normal" | "armored"

export type WeaponDefinition = {
    id: WeaponId
    name: string
    shortName: string
    description: string
    unlimited: boolean
    damage: number
    blastRadius: number
    craterRadius: number
    armorDamageMultiplier: number
    penetrationDepth: number
    splitCount: number
    fragmentDamage: number
    fragmentBlastRadius: number
    fragmentCraterRadius: number
    pickupWeight: number
}

export type PickupDefinition = {
    id: PickupId
    name: string
    description: string
    onlineOnly: boolean
    spawnWeight: number
    ammoAmount?: number
    blastRadiusMultiplier?: number
    penetrationDepth?: number
    shieldDamageMultiplier?: number
    repairCoverRadius?: number
}

export type WeaponInventory = Record<SpecialWeaponId, number>

export const WEAPON_DEFINITIONS = {
    standard: {
        id: "standard",
        name: "标准炮弹",
        shortName: "标准",
        description: "无限弹药，造成标准爆炸和弹坑。",
        unlimited: true,
        damage: 50,
        blastRadius: 0.95,
        craterRadius: 0.72,
        armorDamageMultiplier: 1,
        penetrationDepth: 0,
        splitCount: 0,
        fragmentDamage: 0,
        fragmentBlastRadius: 0,
        fragmentCraterRadius: 0,
        pickupWeight: 0,
    },
    heavy: {
        id: "heavy",
        name: "重磅炮弹",
        shortName: "重磅",
        description: "更大的爆炸和弹坑，可一发击破装甲敌人。",
        unlimited: false,
        damage: 70,
        blastRadius: 1.6,
        craterRadius: 1.3,
        armorDamageMultiplier: 1.5,
        penetrationDepth: 0,
        splitCount: 0,
        fragmentDamage: 0,
        fragmentBlastRadius: 0,
        fragmentCraterRadius: 0,
        pickupWeight: 4,
    },
    drill: {
        id: "drill",
        name: "钻地弹",
        shortName: "钻地",
        description: "钻入可破坏掩体后再爆炸，不可穿过钢板或基岩。",
        unlimited: false,
        damage: 50,
        blastRadius: 1,
        craterRadius: 0.82,
        armorDamageMultiplier: 2,
        penetrationDepth: 2.5,
        splitCount: 0,
        fragmentDamage: 0,
        fragmentBlastRadius: 0,
        fragmentCraterRadius: 0,
        pickupWeight: 3,
    },
    split: {
        id: "split",
        name: "分裂弹",
        shortName: "分裂",
        description: "在弹道最高点展开为三枚垂直下落的小弹。",
        unlimited: false,
        damage: 0,
        blastRadius: 0,
        craterRadius: 0,
        armorDamageMultiplier: 1,
        penetrationDepth: 0,
        splitCount: 3,
        fragmentDamage: 25,
        fragmentBlastRadius: 0.62,
        fragmentCraterRadius: 0.42,
        pickupWeight: 2,
    },
    mirror: {
        id: "mirror",
        name: "镜像双弹",
        shortName: "镜像",
        description: "同时发射 f(x) 与 -f(x) 两条镜像弹道。",
        unlimited: false,
        damage: 50,
        blastRadius: 0.9,
        craterRadius: 0.68,
        armorDamageMultiplier: 1,
        penetrationDepth: 0,
        splitCount: 0,
        fragmentDamage: 0,
        fragmentBlastRadius: 0,
        fragmentCraterRadius: 0,
        pickupWeight: 1,
    },
} as const satisfies Record<WeaponId, WeaponDefinition>

export const PICKUP_DEFINITIONS = {
    ammo: {
        id: "ammo",
        name: "弹药补给",
        description: "随机获得一发当前关卡可用的特殊武器。",
        onlineOnly: false,
        spawnWeight: 5,
        ammoAmount: 1,
    },
    blast_boost: {
        id: "blast_boost",
        name: "爆炸增幅",
        description: "下一发的爆炸半径和弹坑半径扩大到 1.5 倍。",
        onlineOnly: false,
        spawnWeight: 4,
        blastRadiusMultiplier: 1.5,
    },
    penetration: {
        id: "penetration",
        name: "穿透强化",
        description: "下一发附加钻入可破坏掩体后爆炸的效果。",
        onlineOnly: false,
        spawnWeight: 3,
        penetrationDepth: 1.1,
    },
    shield: {
        id: "shield",
        name: "护盾",
        description: "抵挡下一次命中伤害的 50%。",
        onlineOnly: true,
        spawnWeight: 2,
        shieldDamageMultiplier: 0.5,
    },
    repair: {
        id: "repair",
        name: "工事修复",
        description: "在炮台前生成一小块可破坏掩体。",
        onlineOnly: true,
        spawnWeight: 2,
        repairCoverRadius: 1.15,
    },
} as const satisfies Record<PickupId, PickupDefinition>

export const SPECIAL_WEAPON_IDS: readonly SpecialWeaponId[] = ["heavy", "drill", "split", "mirror"]

export const FUNCTION_WARS_ENEMY_HP: Record<FunctionWarsEnemyType, number> = {
    normal: 50,
    armored: 100,
}

export function createWeaponInventory(initial: Partial<WeaponInventory> = {}): WeaponInventory {
    return {
        heavy: Math.max(0, Math.floor(initial.heavy ?? 0)),
        drill: Math.max(0, Math.floor(initial.drill ?? 0)),
        split: Math.max(0, Math.floor(initial.split ?? 0)),
        mirror: Math.max(0, Math.floor(initial.mirror ?? 0)),
    }
}

export function getWeaponDefinition(id: WeaponId): WeaponDefinition {
    return WEAPON_DEFINITIONS[id]
}

export function getPickupDefinition(id: PickupId): PickupDefinition {
    return PICKUP_DEFINITIONS[id]
}

export function canUseWeapon(inventory: WeaponInventory, id: WeaponId): boolean {
    return id === "standard" || inventory[id] > 0
}

export function consumeWeapon(inventory: WeaponInventory, id: WeaponId): WeaponInventory {
    if (id === "standard") return { ...inventory }
    return { ...inventory, [id]: Math.max(0, inventory[id] - 1) }
}

export function getDamageAgainstEnemy(
    weaponId: WeaponId,
    enemyType: FunctionWarsEnemyType,
    baseDamage = WEAPON_DEFINITIONS[weaponId].damage,
): number {
    const multiplier = enemyType === "armored" ? WEAPON_DEFINITIONS[weaponId].armorDamageMultiplier : 1
    return Math.round(baseDamage * multiplier)
}

export function chooseSpecialWeapon(
    availableWeapons: readonly WeaponId[],
    randomValue: number,
): SpecialWeaponId | null {
    const candidates = SPECIAL_WEAPON_IDS.filter((id) => availableWeapons.includes(id))
    const totalWeight = candidates.reduce((sum, id) => sum + WEAPON_DEFINITIONS[id].pickupWeight, 0)
    if (totalWeight <= 0) return null

    let cursor = Math.min(Math.max(randomValue, 0), 0.999999999) * totalWeight
    for (const id of candidates) {
        cursor -= WEAPON_DEFINITIONS[id].pickupWeight
        if (cursor < 0) return id
    }
    return candidates.at(-1) ?? null
}
