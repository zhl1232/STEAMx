export const plantLifeForms = ['tree', 'shrub', 'herb', 'vine', 'other'] as const
export type PlantLifeForm = (typeof plantLifeForms)[number]

export const plantCultivationStatuses = ['wild', 'cultivated', 'mixed', 'unknown'] as const
export type PlantCultivationStatus = (typeof plantCultivationStatuses)[number]

export const plantUseKeys = ['fruit', 'nut', 'vegetable', 'edible'] as const
export type PlantUseKey = (typeof plantUseKeys)[number]
