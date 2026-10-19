/**
 * Put text on the clipboard. The Clipboard API first; where it is missing (a page served over plain http, other than
 * localhost) or refused, the older way: select the text in a hidden field and copy it. Rejects when neither works.
 * Call it from a click, which both ways need.
 */
export async function copyText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    return;
  } catch {
    // no Clipboard API here, or no permission: try the older way below
  }
  const active = document.activeElement as HTMLElement | null;
  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  area.style.position = 'fixed';
  area.style.opacity = '0';
  document.body.appendChild(area);
  area.select();
  try {
    if (!document.execCommand('copy')) throw new Error('copy refused');
  } finally {
    area.remove();
    active?.focus();
  }
}
