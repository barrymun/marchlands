import { useTranslation } from 'react-i18next';

import { FONT_SAMPLE } from '@/components/lord-dialog/lord-form/font-select/constants';
import { useFontStyle } from '@/components/lord-dialog/lord-form/font-select/hooks';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FONT_STYLES, fontStyleOf, setFontStyle } from '@/lib/font';
import { fmtExact } from '@/lib/format';

// every style's fonts, so each option shows in its own (Classic's are always there)
import '@/lib/fonts/clear.css';
import '@/lib/fonts/ledger.css';
import '@/lib/fonts/terminal.css';

/** The font style the client shows, applied at once; kept in this browser (not on the server). Each option is shown in its own style. */
export function FontSelect() {
  const { t } = useTranslation('lord-dialog');
  const style = useFontStyle();
  return (
    <div className="grid content-start gap-2">
      <Label htmlFor="player-font">{t('font.label')}</Label>
      <Select value={style} onValueChange={(value) => setFontStyle(fontStyleOf(value))}>
        <SelectTrigger id="player-font" className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {FONT_STYLES.map((s) => (
            <SelectItem key={s} value={s}>
              <span data-font={s} className="flex items-baseline gap-2 font-sans">
                {t(`font.names.${s}`)}
                <span className="text-muted-foreground tabular-nums">{fmtExact(FONT_SAMPLE)}</span>
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-xs text-muted-foreground">{t('font.hint')}</p>
    </div>
  );
}
