import AsyncStorage from '@react-native-async-storage/async-storage';

const PREFS_KEY = 'wikitok_category_weights';

export interface CategoryWeights {
  [category: string]: number;
}

let cachedWeights: CategoryWeights | null = null;

/**
 * Get category weights from local cache (no async on hot path).
 * Returns empty object if not yet loaded.
 */
export function getCachedWeights(): CategoryWeights {
  return cachedWeights || {};
}

/**
 * Load weights from AsyncStorage into memory cache.
 * Call once on app startup.
 */
export async function loadWeights(): Promise<CategoryWeights> {
  try {
    const stored = await AsyncStorage.getItem(PREFS_KEY);
    cachedWeights = stored ? JSON.parse(stored) : {};
  } catch {
    cachedWeights = {};
  }
  return cachedWeights;
}

/**
 * Record a "like" for an article's categories.
 * Increments weight for each category. Stores locally — no API call.
 * Weights decay naturally: newer likes have more impact because
 * the feed algorithm uses these weights to bias category selection.
 */
export async function recordLike(categories: string[]): Promise<void> {
  if (!cachedWeights) await loadWeights();
  const weights = cachedWeights!;

  for (const cat of categories) {
    const normalized = cat.replace(/^Category:/, '').trim();
    if (normalized.length > 0 && normalized.length < 60) {
      weights[normalized] = (weights[normalized] || 0) + 1;
    }
  }

  cachedWeights = weights;

  // Persist (fire and forget — don't block UI)
  AsyncStorage.setItem(PREFS_KEY, JSON.stringify(weights)).catch(() => {});
}

/**
 * Get the top N preferred categories sorted by weight.
 * Returns category names (not wiki-formatted).
 */
export function getTopCategories(n: number = 5): string[] {
  const weights = cachedWeights || {};
  return Object.entries(weights)
    .sort(([, a], [, b]) => b - a)
    .slice(0, n)
    .filter(([, w]) => w >= 2) // minimum 2 likes to count
    .map(([cat]) => cat);
}

/**
 * Get a weighted random category from preferences.
 * Higher-weighted categories are more likely to be selected.
 */
export function getWeightedRandomCategory(): string | null {
  const weights = cachedWeights || {};
  const entries = Object.entries(weights).filter(([, w]) => w >= 2);
  if (entries.length === 0) return null;

  const totalWeight = entries.reduce((sum, [, w]) => sum + w, 0);
  let r = Math.random() * totalWeight;
  for (const [cat, w] of entries) {
    r -= w;
    if (r <= 0) return cat;
  }
  return entries[0][0];
}
