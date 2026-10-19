import { afterEach, describe, expect, it, vi } from 'vitest';
import { copyText } from '@/lib/clipboard';

/** A stand-in for the document: a hidden field that records what it held when copied, and whether copying works. */
function fakeDocument(copies: boolean) {
  const area = { value: '', style: {} as Record<string, string>, setAttribute: vi.fn(), select: vi.fn(), remove: vi.fn() };
  const focused = { focus: vi.fn() };
  const copied: string[] = [];
  const doc = {
    activeElement: focused,
    body: { appendChild: vi.fn() },
    createElement: vi.fn(() => area),
    execCommand: vi.fn(() => {
      copied.push(area.value);
      return copies;
    }),
  };
  return { doc, area, focused, copied };
}

afterEach(() => vi.unstubAllGlobals());

describe(copyText.name, () => {
  it('uses the Clipboard API when it works', async () => {
    const writeText = vi.fn(() => Promise.resolve());
    const { doc } = fakeDocument(true);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    vi.stubGlobal('document', doc);
    await copyText('(271,200)');
    expect(writeText).toHaveBeenCalledWith('(271,200)');
    expect(doc.execCommand).not.toHaveBeenCalled();
  });

  it('copies from a hidden field when the Clipboard API refuses, then tidies up and gives the focus back', async () => {
    const { doc, area, focused, copied } = fakeDocument(true);
    vi.stubGlobal('navigator', { clipboard: { writeText: () => Promise.reject(new Error('denied')) } });
    vi.stubGlobal('document', doc);
    await copyText('(271,200)');
    expect(copied).toEqual(['(271,200)']);
    expect(area.select).toHaveBeenCalled();
    expect(area.remove).toHaveBeenCalled();
    expect(focused.focus).toHaveBeenCalled();
  });

  it('copies from a hidden field when there is no Clipboard API (plain http)', async () => {
    const { doc, copied } = fakeDocument(true);
    vi.stubGlobal('navigator', {});
    vi.stubGlobal('document', doc);
    await copyText('(1,2)');
    expect(copied).toEqual(['(1,2)']);
  });

  it('rejects when neither way copies, still removing the field', async () => {
    const { doc, area } = fakeDocument(false);
    vi.stubGlobal('navigator', {});
    vi.stubGlobal('document', doc);
    await expect(copyText('(1,2)')).rejects.toThrow();
    expect(area.remove).toHaveBeenCalled();
  });
});
