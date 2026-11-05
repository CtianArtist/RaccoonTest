import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { useAuth } from '@clerk/react';

declare global {
  interface Window { zE?: (...args: string[]) => void }
}

export function openSupport() {
  if (typeof window.zE !== 'function') {
    window.alert('Support chat is not available right now. Please check your connection and try again.');
    return;
  }
  window.zE('messenger', 'open');
}

export const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
export const publicAsset = (filename: string) => `${import.meta.env.BASE_URL}${filename.replace(/^\//, '')}`;
export const productImage = (image: string) => (/^https?:/.test(image) ? image : publicAsset(image));
export const SUPPORT_EMAIL = 'support@raccoonsupplyco.zendesk.com';

const tones: Record<string, string> = {
  'night-shift-field-kit': '#d9b18f', 'ranger-cap': '#c4d0bd', 'porch-watch-mug': '#e7c3a1', 'bandit-bandana': '#c97f5c',
  'midnight-sticker-sheet': '#a8bbb0', 'little-paws-key-tag': '#e5c987', 'raccoon-ridge-lantern': '#c7d3c3', 'trailblazer-backpack': '#e4ceb0',
  'stormwatch-shell-jacket': '#efd2bf', 'campfire-fleece': '#c9d2c0', 'woodland-merino-socks': '#ede1cb', 'trailhead-utility-shorts': '#e2bda7',
};
export const productTone = (slug: string) => tones[slug] ?? '#dccbb4';

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
export const formatMoney = (cents: number) => money.format(cents / 100);
export const formatDate = (iso: string | null | undefined, withTime = false) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', withTime ? { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' } : { month: 'short', day: 'numeric', year: 'numeric' });
};

/** True only once Clerk has loaded and a session exists. Gate user-scoped queries on this. */
export function useSignedIn() {
  const { isLoaded, isSignedIn } = useAuth();
  return { ready: isLoaded, signedIn: Boolean(isLoaded && isSignedIn) };
}

export function signInHref(returnTo?: string) {
  const target = returnTo ?? (typeof window !== 'undefined' ? window.location.href : '');
  return `/sign-in${target ? `?redirect_url=${encodeURIComponent(target)}` : ''}`;
}

// ---------- Bag (persisted to localStorage so it survives checkout cancel + sign-in) ----------
export type BagItem = { slug: string; quantity: number; size: string };
type BagState = {
  items: BagItem[];
  count: number;
  add: (slug: string, size: string, qty?: number) => void;
  setQuantity: (slug: string, size: string, quantity: number) => void;
  remove: (slug: string, size: string) => void;
  clear: () => void;
};
const KEY = 'raccoon-bag-v2';
export const MAX_QTY = 10;

function readBag(): BagItem[] {
  try {
    const raw = localStorage.getItem(KEY) ?? sessionStorage.getItem('raccoon-bag') ?? '[]';
    const saved: unknown = JSON.parse(raw);
    if (!Array.isArray(saved)) return [];
    return saved
      .filter((i) => typeof i?.slug === 'string' && Number.isInteger(i?.quantity) && i.quantity > 0)
      .map((i) => ({ slug: i.slug as string, quantity: Math.min(MAX_QTY, i.quantity as number), size: typeof i.size === 'string' ? i.size : '' }));
  } catch { return []; }
}

const BagContext = createContext<BagState | null>(null);
export function BagProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<BagItem[]>(readBag);
  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(items)); sessionStorage.removeItem('raccoon-bag'); } catch { /* bag stays in memory */ }
  }, [items]);
  useEffect(() => {
    const onStorage = (e: StorageEvent) => { if (e.key === KEY) setItems(readBag()); };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);
  const setQuantity = useCallback((slug: string, size: string, quantity: number) => setItems((cur) => {
    const q = Math.max(0, Math.min(MAX_QTY, quantity));
    const exists = cur.some((i) => i.slug === slug && i.size === size);
    if (!q) return cur.filter((i) => !(i.slug === slug && i.size === size));
    return exists ? cur.map((i) => (i.slug === slug && i.size === size ? { ...i, quantity: q } : i)) : [...cur, { slug, size, quantity: q }];
  }), []);
  const add = useCallback((slug: string, size: string, qty = 1) => setItems((cur) => {
    const found = cur.find((i) => i.slug === slug && i.size === size);
    if (found) return cur.map((i) => (i === found ? { ...i, quantity: Math.min(MAX_QTY, i.quantity + qty) } : i));
    return [...cur, { slug, size, quantity: Math.min(MAX_QTY, qty) }];
  }), []);
  const remove = useCallback((slug: string, size: string) => setItems((cur) => cur.filter((i) => !(i.slug === slug && i.size === size))), []);
  const clear = useCallback(() => setItems([]), []);
  const count = items.reduce((t, i) => t + i.quantity, 0);
  return <BagContext.Provider value={{ items, count, add, setQuantity, remove, clear }}>{children}</BagContext.Provider>;
}
export function useBag() {
  const ctx = useContext(BagContext);
  if (!ctx) throw new Error('useBag must be used inside BagProvider');
  return ctx;
}

export function errorMessage(err: unknown, fallback = 'Something went wrong. Please try again.') {
  if (err && typeof err === 'object') {
    const e = err as { data?: { detail?: unknown; error?: unknown; message?: unknown }; message?: unknown };
    const d = e.data?.detail ?? e.data?.error ?? e.data?.message;
    if (typeof d === 'string') return d;
    if (Array.isArray(d) && d[0] && typeof d[0].msg === 'string') return d[0].msg as string;
    if (typeof e.message === 'string' && e.message) return e.message;
  }
  return fallback;
}
