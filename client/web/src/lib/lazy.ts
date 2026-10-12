// Components loaded on first use (their code is a separate file of the build), for screens most visits don't open.

import { createElement, lazy, useState, type ComponentType } from 'react';

/** sessionStorage key of the last reload after a file of the app failed to load */
const RELOAD_KEY = 'marchlands-reloaded-at';

/**
 * A file of the app failed to load: after a deploy the open page asks for files that no longer exist, or the
 * network dropped. Reload once (fresh page, current files); a second failure within a minute is thrown instead.
 */
export function reloadOnce(err: unknown): never {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_KEY) ?? 0);
    if (Date.now() - last > 60_000) {
      sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
      window.location.reload();
    }
  } catch {
    // no sessionStorage: don't risk a reload loop
  }
  throw err;
}

/**
 * A component whose code loads when it is first rendered, like React.lazy (render it inside <Suspense>).
 * `preload()` fetches it ahead of time; an instance mounted after that renders at once, without suspending.
 */
export function lazyComponent<P extends object>(load: () => Promise<ComponentType<P>>) {
  let loaded: ComponentType<P> | undefined;
  let pending: Promise<ComponentType<P>> | undefined;
  const fetchOnce = () =>
    (pending ??= load().then(
      (c) => (loaded = c),
      (err: unknown) => {
        pending = undefined;
        throw err;
      },
    ));
  const Lazy = lazy(() => fetchOnce().then((c) => ({ default: c }), reloadOnce));
  function LazyComponent(props: P) {
    // decided once per mount, so an instance never switches between the two (which would remount it)
    const [Component] = useState(() => loaded);
    return createElement(Component ?? Lazy, props);
  }
  /** Fetch the code in the background; a failure is left for the render to retry. */
  const preload = () => void fetchOnce().catch(() => {});
  return Object.assign(LazyComponent, { preload });
}

/** Runs `fn` when the browser is idle (after the page has rendered), or soon where it can't tell. */
export function whenIdle(fn: () => void): () => void {
  if ('requestIdleCallback' in window) {
    const id = window.requestIdleCallback(fn, { timeout: 5000 });
    return () => window.cancelIdleCallback(id);
  }
  const id = setTimeout(fn, 1000);
  return () => clearTimeout(id);
}
