// Accessibility checks on the rendered page with axe (WCAG 2.1 A and AA rules): serious and critical findings fail,
// but for the known ones below, on the screens listed.
import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { expect } from './fixtures.ts';

const FAILING_IMPACTS: readonly (string | null | undefined)[] = ['serious', 'critical'];

/**
 * Problems known and not fixed yet, by axe rule and the screens they're on (docs/features/browser-tests.md, phase 4):
 * none now. One goes here only when it can't be fixed in the change that finds it, with a TODO.md item; once it's gone
 * from a screen, the check fails until it's taken off this list too.
 */
const KNOWN: Record<string, readonly string[]> = {};

/** Run axe on the page as it is; `where` names the screen, for the known problems. */
export async function expectAccessible(page: Page, where?: string) {
  // colours are measured as drawn: wait out a fade or a colour change (a dialog opening, a button just pressed), as
  // reduced motion doesn't stop CSS transitions; endless ones (a loading pulse) never finish, so they're left out
  await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running' || a.effect?.getTiming().iterations === Infinity));
  const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  const serious = violations.filter((v) => FAILING_IMPACTS.includes(v.impact));
  const known = (rule: string) => where !== undefined && (KNOWN[rule] ?? []).includes(where);
  const failing = serious.filter((v) => !known(v.id)).map((v) => `${v.impact ?? ''} ${v.id}: ${v.help} (${v.nodes.map((n) => n.target.join(' ')).join(', ')})`);
  expect(failing, `axe on ${page.url()}`).toEqual([]);
  const fixed = Object.keys(KNOWN).filter((rule) => known(rule) && !serious.some((v) => v.id === rule));
  expect(fixed, `fixed on ${where ?? ''}: take it off KNOWN in support/axe.ts`).toEqual([]);
}
