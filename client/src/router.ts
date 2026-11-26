import { useSyncExternalStore } from 'react';

export interface Route {
  path: string;
  segments: string[];
  query: URLSearchParams;
}

const listeners = new Set<() => void>();
let cachedHash = '';
let cachedRoute: Route = parse('');

function parse(hash: string): Route {
  const raw = hash.replace(/^#/, '') || '/';
  const [pathPart, queryPart = ''] = raw.split('?');
  const path = pathPart.startsWith('/') ? pathPart : `/${pathPart}`;
  return { path, segments: path.split('/').filter(Boolean), query: new URLSearchParams(queryPart) };
}

function notify() {
  listeners.forEach((l) => l());
}

function getSnapshot(): Route {
  const hash = window.location.hash;
  if (hash !== cachedHash) {
    cachedHash = hash;
    cachedRoute = parse(hash);
  }
  return cachedRoute;
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  window.addEventListener('hashchange', cb);
  window.addEventListener('popstate', cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener('hashchange', cb);
    window.removeEventListener('popstate', cb);
  };
}

// history.state.i counts how deep this tab has navigated, so goBack knows whether back exists.
function depth(): number {
  return typeof window.history.state?.i === 'number' ? window.history.state.i : 0;
}

export function useRoute(): Route {
  return useSyncExternalStore(subscribe, getSnapshot);
}

export function navigate(path: string, opts: { replace?: boolean } = {}) {
  const url = `#${path}`;
  if (opts.replace) {
    window.history.replaceState({ i: depth() }, '', url);
  } else {
    window.history.pushState({ i: depth() + 1 }, '', url);
  }
  notify();
}

export function goBack() {
  if (depth() > 0) window.history.back();
  else navigate('/cards/needs-you', { replace: true });
}
