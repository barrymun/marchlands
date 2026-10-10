export const pct = (x: number) => `${x < 0.1 ? (x * 100).toFixed(1) : Math.round(x * 100)}%`;

export const range = (min: number, max: number) => (min === max ? `${min}` : `${min}–${max}`);
