import { Search, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { REPORT_SEARCH_MAX, type ReportKind, type ReportOrder } from '@marchlands/core';

import { ANY_KIND, KIND_OPTIONS, ORDER_OPTIONS } from '@/components/reports-panel/constants';
import type { ReportFilter } from '@/components/reports-panel/types';
import { cleared } from '@/components/reports-panel/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';

/**
 * The search box, the kind (on the tabs that hold every kind), the order and unread only; Clear when anything narrows
 * the list. Typing goes to `onSearch` (the list follows once it pauses), every other change to `onChange`.
 */
export function ReportFilters({
  value,
  kinds,
  filtered,
  onSearch,
  onChange,
}: {
  value: ReportFilter;
  /** the tab holds every kind, so the kind filter shows */
  kinds: boolean;
  filtered: boolean;
  onSearch: (q: string) => void;
  onChange: (f: ReportFilter) => void;
}) {
  const { t } = useTranslation('reports-panel');
  return (
    <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
      <div className="grid min-w-56 flex-1 gap-1.5 sm:max-w-sm">
        <Label htmlFor="report-search" className="text-xs text-muted-foreground">
          {t('filters.search')}
        </Label>
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            id="report-search"
            type="search"
            value={value.q}
            maxLength={REPORT_SEARCH_MAX}
            placeholder={t('filters.searchPlaceholder')}
            onChange={(e) => onSearch(e.target.value)}
            className="pl-8"
          />
        </div>
      </div>
      {kinds && (
        <div className="grid gap-1.5">
          <Label htmlFor="report-kind" className="text-xs text-muted-foreground">
            {t('filters.kind')}
          </Label>
          <Select value={value.kind ?? ANY_KIND} onValueChange={(v) => onChange({ ...value, kind: v === ANY_KIND ? null : (v as ReportKind) })}>
            <SelectTrigger id="report-kind" className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY_KIND}>{t('kinds.any')}</SelectItem>
              {KIND_OPTIONS.map((k) => (
                <SelectItem key={k} value={k}>
                  {t(`kinds.${k}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      <div className="grid gap-1.5">
        <Label htmlFor="report-order" className="text-xs text-muted-foreground">
          {t('filters.order')}
        </Label>
        <Select value={value.order} onValueChange={(v) => onChange({ ...value, order: v as ReportOrder })}>
          <SelectTrigger id="report-order" className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ORDER_OPTIONS.map((o) => (
              <SelectItem key={o} value={o}>
                {t(`orders.${o}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex h-8 items-center gap-2">
        <Switch id="report-unread" checked={value.unread} onCheckedChange={(unread) => onChange({ ...value, unread })} />
        <Label htmlFor="report-unread">{t('filters.unread')}</Label>
      </div>
      {filtered && (
        <Button size="sm" variant="ghost" onClick={() => onChange(cleared(value))}>
          <X /> {t('filters.clear')}
        </Button>
      )}
    </div>
  );
}
