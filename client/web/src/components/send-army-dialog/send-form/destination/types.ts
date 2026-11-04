/** A place the To field suggests: one of the player's cities (it has a name) or a farm target (named from its tile). */
export interface DestinationOption {
  tileId: number;
  x: number;
  y: number;
  name?: string;
}
