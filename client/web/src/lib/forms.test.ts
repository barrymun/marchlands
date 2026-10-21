import { describe, expect, it } from 'vitest';
import { formText, typedAmounts } from '@/lib/forms';

describe(formText.name, () => {
  it('reads a text field', () => {
    const form = new FormData();
    form.set('username', 'Aldric');
    expect(formText(form, 'username')).toBe('Aldric');
  });
  it('keeps the text as typed, spaces included', () => {
    const form = new FormData();
    form.set('castleName', '  Stone Keep ');
    expect(formText(form, 'castleName')).toBe('  Stone Keep ');
  });
  it('is empty for a field the form does not have', () => {
    expect(formText(new FormData(), 'email')).toBe('');
  });
  it('is empty for a file, never "[object File]"', () => {
    const form = new FormData();
    form.set('flag', new File(['x'], 'flag.png'));
    expect(formText(form, 'flag')).toBe('');
  });
});

describe(typedAmounts.name, () => {
  it('reads each typed amount as a number', () => {
    expect(typedAmounts({ archer: '120', scouter: '5' })).toEqual({ archer: 120, scouter: 5 });
  });
  it('leaves out empty, zero, negative and unreadable amounts', () => {
    expect(typedAmounts({ food: '', wood: '0', stone: '-3', iron: 'abc', gold: '10' })).toEqual({ gold: 10 });
  });
  it('is empty when nothing was typed', () => {
    expect(typedAmounts({})).toEqual({});
  });
});
