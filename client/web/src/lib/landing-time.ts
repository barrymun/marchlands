// Camp times (docs/features/camp-times.md): landing times are typed and shown in UTC, by the server's clock.

/** A landing time typed as a UTC date (YYYY-MM-DD) and time (HH:MM or HH:MM:SS): its moment in ms, or null. */
export function landingTime(date: string, time: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}(?::\d{2})?$/.test(time)) return null;
  const ms = Date.parse(`${date}T${time.length === 5 ? `${time}:00` : time}Z`);
  return Number.isNaN(ms) ? null : ms;
}

/** A moment as the landing time's UTC date and time fields, to the second. */
export function utcFields(ms: number): { date: string; time: string } {
  const iso = new Date(ms).toISOString();
  return { date: iso.slice(0, 10), time: iso.slice(11, 19) };
}

/** The landing time offered first: a round minute, at least a minute after the army could land at the soonest. */
export const firstLanding = (now: number, marchMs: number) => Math.ceil((now + marchMs + 60_000) / 60_000) * 60_000;
