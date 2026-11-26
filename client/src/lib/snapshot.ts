import type { DemoDataset } from './staticDemoData';

const KEY_STORE = 'email_cards_snapshot_key';
const KEY_PREFIX = 'email_cards_snapshot';
const STORE_PREFIX = 'email_cards_snapshot_store_';
const HASH_KEY = /^#k=([A-Za-z0-9_-]{43})(?![A-Za-z0-9_-])/;

let loaded: DemoDataset | null = null;

function takeKey(): string | null {
  const m = HASH_KEY.exec(window.location.hash);
  if (m) {
    try {
      window.localStorage.setItem(KEY_STORE, m[1]);
    } catch {
      // Storage may be blocked; the key still works for this visit
    }
    window.history.replaceState(null, '', window.location.pathname + window.location.search + '#/');
    return m[1];
  }
  try {
    return window.localStorage.getItem(KEY_STORE);
  } catch {
    return null;
  }
}

function removeKeys(prefix: string, keep?: string): void {
  try {
    const keys: string[] = [];
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const k = window.localStorage.key(i);
      if (k && k.startsWith(prefix) && k !== keep) keys.push(k);
    }
    keys.forEach((k) => window.localStorage.removeItem(k));
  } catch {
    // Nothing to clear
  }
}

export function forgetSnapshot(): void {
  removeKeys(KEY_PREFIX);
}

export async function loadSnapshot(): Promise<DemoDataset | null> {
  // Only the static build has snapshots; a build with a real server never enters this mode
  if (import.meta.env.VITE_STATIC_DEMO !== 'true') return null;
  try {
    const keyText = takeKey();
    if (!keyText) return null;
    const res = await fetch(import.meta.env.BASE_URL + 'snapshot.bin', { cache: 'no-store' });
    if (res.status === 404) {
      forgetSnapshot();
      return null;
    }
    if (!res.ok) return null;
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (bytes.length < 31 || String.fromCharCode(bytes[0], bytes[1], bytes[2]) !== 'EC1') return null;
    let data: DemoDataset;
    try {
      const raw = Uint8Array.from(atob(keyText.replace(/-/g, '+').replace(/_/g, '/') + '='), (c) => c.charCodeAt(0));
      const key = await crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['decrypt']);
      const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytes.slice(3, 15) }, key, bytes.slice(15));
      data = JSON.parse(new TextDecoder().decode(plain)) as DemoDataset;
    } catch {
      // The key does not open this file: drop the key and anything saved from an older snapshot
      forgetSnapshot();
      return null;
    }
    if (!data || !Array.isArray(data.accounts) || !Array.isArray(data.threads)) return null;
    loaded = data;
    // A republished snapshot carries a new id, so a store saved from an older one is dropped
    removeKeys(STORE_PREFIX, snapshotStoreKey());
    return data;
  } catch {
    return null;
  }
}

export function isSnapshot(): boolean {
  return loaded !== null;
}

export function snapshotData(): DemoDataset | null {
  return loaded;
}

export function snapshotStoreKey(): string {
  const id = loaded && typeof loaded.snapshotId === 'string' ? loaded.snapshotId.replace(/[^A-Za-z0-9_-]/g, '') : '';
  return STORE_PREFIX + (id || 'v1');
}

/** First name for the sign-off of a drafted reply. */
export function ownerName(fallback: string): string {
  const name = loaded?.accounts[0]?.displayName?.trim().split(/\s+/)[0];
  return name || fallback;
}

export function snapshotLabel(): string | null {
  if (!loaded) return null;
  return typeof loaded.snapshotLabel === 'string' && loaded.snapshotLabel ? loaded.snapshotLabel : 'Snapshot';
}

/** The toast for a send: in snapshot mode nothing leaves, and the toast says so. */
export function sentToast(text: string): string {
  return isSnapshot() ? 'Snapshot. Nothing was sent.' : text;
}
