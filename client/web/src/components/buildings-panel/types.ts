import type { CITY_VIEWS } from '@/components/buildings-panel/constants';

/** How the city's buildings are shown: the isometric town, or a grid of cards. */
export type CityView = (typeof CITY_VIEWS)[number];
