// When a spend of gold asks first (AGENTS.md, UI conventions): from a tenth of the gold the paying city holds. A hire
// or new Inn offers in a new city is one click, as is a speed-up in a rich one; anything that would take a large share
// of what the city has (a speed-up or an item in a new city, a hire in a city nearly out of gold) asks.

/** The share of the paying city's gold from which a spend asks first. */
const ASK_FROM_SHARE = 0.1;

/** Whether spending `cost` gold from a city holding `cityGold` asks first. */
export function asksFirst(cost: number, cityGold: number): boolean {
  return cost > 0 && cost >= cityGold * ASK_FROM_SHARE;
}
