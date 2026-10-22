/** Prices are whole thousandths of a gold (the server rounds every order's price to three decimals). */
export const PRICE_TICKS = 1000;

/**
 * The most steps the depth chart lays along its price axis. Lightweight Charts puts its points an equal distance
 * apart, so the chart has a point at every step between the lowest and highest price; a wide book gets coarser steps.
 */
export const DEPTH_MAX_STEPS = 1000;
