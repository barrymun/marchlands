import { useTranslation } from 'react-i18next';

import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LOCALES, matchLocale } from '@/lib/i18n';

/** The locale the client shows, applied at once; kept in this browser (not on the server). */
export function LanguageSelect() {
  const { t, i18n } = useTranslation('common');
  return (
    <div className="grid content-start gap-2">
      <Label htmlFor="player-language">{t('language.label')}</Label>
      <Select value={matchLocale(i18n.resolvedLanguage)} onValueChange={(lng) => void i18n.changeLanguage(lng)}>
        <SelectTrigger id="player-language" className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {LOCALES.map((l) => (
            <SelectItem key={l} value={l}>
              {t(`language.names.${l}`)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
