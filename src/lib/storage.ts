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

async function getJSON<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

async function setJSON(key: string, value: unknown): Promise<void> {
  await AsyncStorage.setItem(key, JSON.stringify(value));
}

// Saved articles
export async function getSaved(): Promise<ProcessedArticle[]> {
  return getJSON(KEYS.SAVED, []);
}
export async function setSaved(articles: ProcessedArticle[]): Promise<void> {
  await setJSON(KEYS.SAVED, articles);
}
export async function addSaved(article: ProcessedArticle): Promise<void> {
  const saved = await getSaved();
  if (!saved.find(a => a.pageid === article.pageid)) {
    await setSaved([article, ...saved]);
  }
}
export async function removeSaved(pageid: number): Promise<void> {
  const saved = await getSaved();
  await setSaved(saved.filter(a => a.pageid !== pageid));
}

// Seen article IDs
export async function getSeen(): Promise<number[]> {
  return getJSON(KEYS.SEEN, []);
}
export async function addSeen(pageid: number): Promise<void> {
  const seen = await getSeen();
  if (!seen.includes(pageid)) {
    const updated = [pageid, ...seen].slice(0, 500);
    await setJSON(KEYS.SEEN, updated);
  }
}

// Disliked article IDs
export async function getDisliked(): Promise<number[]> {
  return getJSON(KEYS.DISLIKED, []);
}
export async function addDisliked(pageid: number): Promise<void> {
  const disliked = await getDisliked();
  if (!disliked.includes(pageid)) {
    await setJSON(KEYS.DISLIKED, [...disliked, pageid]);
  }
}

// View history
export async function getHistory(): Promise<ProcessedArticle[]> {
  return getJSON(KEYS.HISTORY, []);
}
export async function addHistory(article: ProcessedArticle): Promise<void> {
  const history = await getHistory();
  const filtered = history.filter(a => a.pageid !== article.pageid);
  await setJSON(KEYS.HISTORY, [article, ...filtered].slice(0, 100));
}

// User interests (decaying weighted profile)
export async function getInterests(): Promise<UserInterest[]> {
  return getJSON(KEYS.INTERESTS, []);
}
export async function setInterests(interests: UserInterest[]): Promise<void> {
  await setJSON(KEYS.INTERESTS, interests);
}

// Interaction events log
export async function getInteractions(): Promise<InteractionEvent[]> {
  return getJSON(KEYS.INTERACTIONS, []);
}
export async function addInteraction(event: InteractionEvent): Promise<void> {
  const events = await getInteractions();
  await setJSON(KEYS.INTERACTIONS, [...events, event].slice(-1000));
}

// Clear all data
export async function clearAll(): Promise<void> {
  await AsyncStorage.multiRemove(Object.values(KEYS));
}
