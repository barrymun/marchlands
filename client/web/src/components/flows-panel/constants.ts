import { param, type SearchSchema } from '@/lib/search-state';

/** The page's place in the address (lib/search-state.ts): the flow selected. */
export const FLOWS_SEARCH = {
  flow: param.key(),
} satisfies SearchSchema;
