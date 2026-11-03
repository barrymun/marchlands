/** Where a resource came from (`GAIN_KINDS`) or went (`LOSS_KINDS`). */
export const FlowKind = {
  PRODUCED: 'produced',
  PLUNDERED: 'plundered',
  MARKET_IN: 'marketIn',
  GIFT: 'gift',
  UPKEEP: 'upkeep',
  SPENT: 'spent',
  WASTED: 'wasted',
  TAXED: 'taxed',
  MARKET_OUT: 'marketOut',
  STOLEN: 'stolen',
} as const;
export type FlowKind = (typeof FlowKind)[keyof typeof FlowKind];

/** The gains, in the order they're drawn out from the line. */
export const GAIN_KINDS = [FlowKind.PRODUCED, FlowKind.PLUNDERED, FlowKind.MARKET_IN, FlowKind.GIFT] as const;

/** The losses, in the order they're drawn out from the line. */
export const LOSS_KINDS = [FlowKind.UPKEEP, FlowKind.SPENT, FlowKind.WASTED, FlowKind.TAXED, FlowKind.MARKET_OUT, FlowKind.STOLEN] as const;

/** Each kind's fill: gains in greens and losses in reds (lib/tones.ts), darkest by the line, a legend and a tooltip naming them. */
export const FLOW_FILL: Record<FlowKind, string> = {
  produced: 'bg-emerald-700 dark:bg-emerald-500',
  plundered: 'bg-emerald-500 dark:bg-emerald-400',
  marketIn: 'bg-emerald-300 dark:bg-emerald-300',
  gift: 'bg-emerald-200 dark:bg-emerald-100',
  upkeep: 'bg-red-800 dark:bg-red-500',
  spent: 'bg-red-600 dark:bg-red-400',
  wasted: 'bg-red-500 dark:bg-red-300',
  taxed: 'bg-red-400 dark:bg-red-200',
  marketOut: 'bg-red-300 dark:bg-red-100',
  stolen: 'bg-red-200 dark:bg-red-50',
};
