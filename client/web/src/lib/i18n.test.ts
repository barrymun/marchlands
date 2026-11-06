import { describe, expect, it } from 'vitest';
import { i18n, Locale, matchLocale } from '@/lib/i18n';

describe(matchLocale.name, () => {
  it('keeps a supported locale, whatever its case', () => {
    expect(matchLocale('en-US')).toBe(Locale.EN_US);
    expect(matchLocale('en-us')).toBe(Locale.EN_US);
    expect(matchLocale('ja-JP')).toBe(Locale.JA_JP);
  });

  it('matches by language when the region is not supported', () => {
    expect(matchLocale('en-AU')).toBe(Locale.EN_GB);
    expect(matchLocale('en')).toBe(Locale.EN_GB);
    expect(matchLocale('ja')).toBe(Locale.JA_JP);
    expect(matchLocale('ar-EG')).toBe(Locale.AR);
    expect(matchLocale('ar')).toBe(Locale.AR);
  });

  it('falls back to en-GB for an unsupported or missing language', () => {
    expect(matchLocale('fr-FR')).toBe(Locale.EN_GB);
    expect(matchLocale(undefined)).toBe(Locale.EN_GB);
  });
});

describe('i18n', () => {
  it('runs in en-GB under test', () => {
    expect(i18n.language).toBe(Locale.EN_GB);
  });

  it('translates into the requested locale', () => {
    expect(i18n.t('common:actions.cancel')).toBe('Cancel');
    expect(i18n.t('common:actions.cancel', { lng: Locale.JA_JP })).toBe('キャンセル');
  });

  it('falls back to en-GB for a key another locale lacks (en-US holds only spelling differences)', () => {
    expect(i18n.t('common:actions.cancel', { lng: Locale.EN_US })).toBe('Cancel');
  });

  it('uses the plural form for the count', () => {
    expect(i18n.t('common:push.hostileArmies', { count: 1 })).toBe('1 hostile army approaching');
    expect(i18n.t('common:push.hostileArmies', { count: 3 })).toBe('3 hostile armies approaching');
    expect(i18n.t('common:push.hostileArmies', { count: 3, lng: Locale.JA_JP })).toBe('敵軍 3 部隊が接近中');
  });

  it('picks the form by the raw count while showing a formatted number', () => {
    expect(i18n.t('common:troops', { count: 1, n: '1' })).toBe('1 troop');
    expect(i18n.t('common:troops', { count: 12_500, n: '12,500' })).toBe('12,500 troops');
    expect(i18n.t('common:troops', { count: 12_500, n: '12,500', lng: Locale.JA_JP })).toBe('兵 12,500');
  });
});
