import { Fragment, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * Renders the app again from scratch when the locale changes, so text read outside a component's own
 * useTranslation (helpers calling i18n.t, labels such as HERO_ATTRIBUTES) is in the new language too.
 */
export function LocaleRoot({ children }: { children: ReactNode }) {
  const { i18n } = useTranslation();
  return <Fragment key={i18n.resolvedLanguage}>{children}</Fragment>;
}
