import type { useResearchList } from '@/components/research-panel/hooks';

export type Tech = NonNullable<ReturnType<typeof useResearchList>['data']>['techs'][number];
