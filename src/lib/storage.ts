import AsyncStorage from '@react-native-async-storage/async-storage';
import { ProcessedArticle, UserInterest, InteractionEvent } from '../types';

const KEYS = {
  SAVED: 'wikitok_saved',
  SEEN: 'wikitok_seen',
  DISLIKED: 'wikitok_disliked',
  HISTORY: 'wikitok_history',
  INTERESTS: 'wikitok_interests',
  INTERACTIONS: 'wikitok_interactions',
} as const;

// ── In-memory cache ──
// All reads come from memory. Writes go to memory first, then persist in background.
// This eliminates redundant disk reads and makes the hot path synchronous.

interface StorageCache {
  saved: ProcessedArticle[] | null;
  history: ProcessedArticle[] | null;
  seen: number[] | null;
  disliked: number[] | null;
  interests: UserInterest[] | null;
  interactions: InteractionEvent[] | null;
}

const cache: StorageCache = {
  saved: null,
  history: null,
  seen: null,
  disliked: null,
  interests: null,
  interactions: null,
};

// Pending writes — debounced to avoid thrashing disk
const pendingWrites = new Map<string, NodeJS.Timeout>();
const WRITE_DEBOUNCE = 500; // ms

function persistKey(key: string, data: any): void {
  // Cancel any pending write for this key
  const existing = pendingWrites.get(key);
  if (existing) clearTimeout(existing);

  // Schedule write
  const timer = setTimeout(() => {
    AsyncStorage.setItem(key, JSON.stringify(data)).catch(() => {});
    pendingWrites.delete(key);
  }, WRITE_DEBOUNCE);
  pendingWrites.set(key, timer);
}

async function loadKey<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

// ── Preload all keys into cache at startup ──
export async function preloadCache(): Promise<void> {
  const [saved, seen, disliked, history, interests, interactions] = await Promise.all([
    loadKey<ProcessedArticle[]>(KEYS.SAVED, []),
    loadKey<number[]>(KEYS.SEEN, []),
    loadKey<number[]>(KEYS.DISLIKED, []),
    loadKey<ProcessedArticle[]>(KEYS.HISTORY, []),
    loadKey<UserInterest[]>(KEYS.INTERESTS, []),
    loadKey<InteractionEvent[]>(KEYS.INTERACTIONS, []),
  ]);
  cache.saved = saved;
  cache.seen = seen;
  cache.disliked = disliked;
  cache.history = history;
  cache.interests = interests;
  cache.interactions = interactions;
}

// ── Saved articles ──
export async function getSaved(): Promise<ProcessedArticle[]> {
  if (cache.saved !== null) return cache.saved;
  cache.saved = await loadKey(KEYS.SAVED, []);
  return cache.saved;
}

export async function addSaved(article: ProcessedArticle): Promise<void> {
  const saved = await getSaved();
  if (!saved.find(a => a.pageid === article.pageid)) {
    const updated = [article, ...saved];
    cache.saved = updated;
    persistKey(KEYS.SAVED, updated);
  }
}

export async function removeSaved(pageid: number): Promise<void> {
  const saved = await getSaved();
  const updated = saved.filter(a => a.pageid !== pageid);
  cache.saved = updated;
  persistKey(KEYS.SAVED, updated);
}

// ── Seen article IDs ──
export async function getSeen(): Promise<number[]> {
  if (cache.seen !== null) return cache.seen;
  cache.seen = await loadKey(KEYS.SEEN, []);
  return cache.seen;
}

export async function addSeen(pageid: number): Promise<void> {
  const seen = await getSeen();
  if (!seen.includes(pageid)) {
    const updated = [pageid, ...seen].slice(0, 500);
    cache.seen = updated;
    persistKey(KEYS.SEEN, updated);
  }
}

// ── Disliked article IDs ──
export async function getDisliked(): Promise<number[]> {
  if (cache.disliked !== null) return cache.disliked;
  cache.disliked = await loadKey(KEYS.DISLIKED, []);
  return cache.disliked;
}

export async function addDisliked(pageid: number): Promise<void> {
  const disliked = await getDisliked();
  if (!disliked.includes(pageid)) {
    const updated = [...disliked, pageid];
    cache.disliked = updated;
    persistKey(KEYS.DISLIKED, updated);
  }
}

// ── View history ──
export async function getHistory(): Promise<ProcessedArticle[]> {
  if (cache.history !== null) return cache.history;
  cache.history = await loadKey(KEYS.HISTORY, []);
  return cache.history;
}

export async function addHistory(article: ProcessedArticle): Promise<void> {
  const history = await getHistory();
  const filtered = history.filter(a => a.pageid !== article.pageid);
  const updated = [article, ...filtered].slice(0, 100);
  cache.history = updated;
  persistKey(KEYS.HISTORY, updated);
}

// ── User interests (decaying weighted profile) ──
export async function getInterests(): Promise<UserInterest[]> {
  if (cache.interests !== null) return cache.interests;
  cache.interests = await loadKey(KEYS.INTERESTS, []);
  return cache.interests;
}

export async function setInterests(interests: UserInterest[]): Promise<void> {
  cache.interests = interests;
  persistKey(KEYS.INTERESTS, interests);
}

// ── Interaction events log ──
export async function getInteractions(): Promise<InteractionEvent[]> {
  if (cache.interactions !== null) return cache.interactions;
  cache.interactions = await loadKey(KEYS.INTERACTIONS, []);
  return cache.interactions;
}

export async function addInteraction(event: InteractionEvent): Promise<void> {
  const events = await getInteractions();
  const updated = [...events, event].slice(-1000);
  cache.interactions = updated;
  persistKey(KEYS.INTERACTIONS, updated);
}

// ── Clear all data ──
export async function clearAll(): Promise<void> {
  // Clear cache
  cache.saved = [];
  cache.history = [];
  cache.seen = [];
  cache.disliked = [];
  cache.interests = [];
  cache.interactions = [];
  // Cancel pending writes
  for (const timer of pendingWrites.values()) clearTimeout(timer);
  pendingWrites.clear();
  // Clear disk
  await AsyncStorage.multiRemove(Object.values(KEYS));
}
