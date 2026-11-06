import { Monitor, Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';

import { noSubscribe } from '@/components/theme-toggle/utils';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Theme } from '@/lib/theme';

/** Light / dark / follow the system. The choice is remembered in this browser (next-themes). */
export function ThemeToggle() {
  const { t } = useTranslation('theme-toggle');
  const { theme, resolvedTheme, setTheme } = useTheme();
  // the theme is only known after mount; render a stable icon until then
  const mounted = useSyncExternalStore(
    noSubscribe,
    () => true,
    () => false,
  );
  const Icon = !mounted ? Sun : theme === Theme.SYSTEM ? Monitor : resolvedTheme === Theme.DARK ? Moon : Sun;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="icon-sm" variant="ghost" aria-label={t('label')}>
          <Icon className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>{t('label')}</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={mounted ? theme : undefined} onValueChange={setTheme}>
          <DropdownMenuRadioItem value={Theme.LIGHT}>
            <Sun className="size-4" /> {t('light')}
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value={Theme.DARK}>
            <Moon className="size-4" /> {t('dark')}
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value={Theme.SYSTEM}>
            <Monitor className="size-4" /> {t('system')}
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
