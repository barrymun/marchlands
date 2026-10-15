import { afterEach, describe, expect, it } from 'vitest';

import { msg, ref, share } from '@marchlands/core';

import { i18n } from '@/lib/i18n';
import { gameRefName, paramText, translateMessage } from '@/lib/messages';

afterEach(async () => {
  await i18n.changeLanguage('en-GB');
});

describe(translateMessage.name, () => {
  it('words a message from its area namespace', async () => {
    expect(translateMessage(msg('auth.notLoggedIn'))).toBe('You are not logged in.');
    await i18n.changeLanguage('ja-JP');
    expect(translateMessage(msg('auth.notLoggedIn'))).toBe('ログインしていません。');
  });

  it('fills in params', () => {
    expect(translateMessage(msg('common.routeNotFound', { method: 'GET', url: '/x' }))).toBe('GET /x does not exist.');
    expect(translateMessage(msg('common.legacyText', { text: 'Old words' }))).toBe('Old words');
  });

  it('words nested messages', () => {
    expect(translateMessage(msg('common.legacyText', { text: msg('auth.needPlayer') }))).toBe('Create your player first.');
  });
});

describe(paramText.name, () => {
  it('formats numbers in the locale, keeping up to 2 decimals', async () => {
    expect(paramText(1234567)).toBe('1,234,567');
    expect(paramText(1.256)).toBe('1.26');
    await i18n.changeLanguage('ja-JP');
    expect(paramText(1234567)).toBe('1,234,567');
  });

  it('joins lists with the locale separator', async () => {
    expect(paramText(['a', 2, ref.resource('wood')])).toBe('a, 2, lumber');
    await i18n.changeLanguage('ja-JP');
    expect(paramText(['a', 'b'])).toBe('a、b');
  });

  it('shows a share as a percent with up to one decimal, in the locale', async () => {
    expect(paramText(share(0.25))).toBe('25%');
    expect(paramText(share(0.125))).toBe('12.5%');
    expect(paramText(share(0.18999999999999995))).toBe('19%');
    await i18n.changeLanguage('ja-JP');
    expect(paramText(share(0.25))).toBe('25%');
  });

  it('words a message with a share param', () => {
    expect(translateMessage(msg('buff.troopAttack', { percent: share(0.2) }))).toBe('+20% troop attack');
    expect(translateMessage(msg('techInfo.effect.construction', { pct: share(0.19) }))).toBe('−19% build, demolish and fortification time');
  });

  it('shows a duration by its two largest units, in the locale', async () => {
    expect(paramText({ duration: 90_000 })).toBe('1m 30s');
    expect(paramText({ duration: 5_400_000 })).toBe('1h 30m');
    await i18n.changeLanguage('ja-JP');
    expect(paramText({ duration: 90_000 })).toBe('1分 30秒');
  });

  it('keeps text and booleans as they are', () => {
    expect(paramText('Keep')).toBe('Keep');
    expect(paramText(true)).toBe('true');
  });
});

describe(gameRefName.name, () => {
  it('names game data by id', async () => {
    expect(gameRefName(ref.troop(7))).toBe('Archer');
    expect(gameRefName(ref.title(0))).toBe('Civilian');
    expect(gameRefName(ref.tile(3))).toBe('Hill');
    expect(gameRefName(ref.stat('power'))).toBe('Attack');
    await i18n.changeLanguage('ja-JP');
    expect(gameRefName(ref.resource('food'))).toBe('食料');
    expect(gameRefName(ref.stat('management'))).toBe('政治');
  });

  it('falls back to the id for unknown data', () => {
    expect(gameRefName(ref.troop(999))).toBe('Unit 999');
    expect(gameRefName(ref.item('no.such.item'))).toBe('no.such.item');
  });
});
