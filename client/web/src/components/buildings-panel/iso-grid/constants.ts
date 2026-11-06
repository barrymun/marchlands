/** How far apart slots stand, in tiles: a little grass between neighbours, so tall buildings don't crowd each other. */
export const SLOT_PITCH = 1.3;

/** The Town Hall's and the Walls' positions. */
export const TOWN_HALL = -1;
export const WALLS = -2;

/** What a tile of the isometric grid holds: a building slot, a locked field, or the gate in the walls. */
export const IsoTileKind = { SLOT: 'slot', LOCKED: 'locked', GATE: 'gate' } as const;
export type IsoTileKind = (typeof IsoTileKind)[keyof typeof IsoTileKind];
