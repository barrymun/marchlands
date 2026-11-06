/** What one city would get of a city moved out. */
export interface MoveOutShare {
  troops: number;
  injured: number;
  goods: number;
}

/** The city chosen for each hero moving out, by hero id; a hero staying isn't in it. */
export type HeroChoices = Record<number, number>;
