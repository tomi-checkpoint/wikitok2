import {
  ProcessedArticle,
  WikiArticle,
  UserInterest,
  InteractionEvent,
  SessionState,
  FeedConfig,
} from '../types';
import {
  getRandomArticles,
  getRelatedArticles,
  getArticlesByCategory,
  searchArticles,
  getMostReadArticles,
  getArticleLinks,
} from './wikipedia';
import {
  getSaved,
  getSeen,
  getDisliked,
  getInterests,
  setInterests,
  getInteractions,
  addInteraction,
  addSeen,
} from './storage';

// ─── Hook Generator ─────────────────────────────────────────
// Extracts the most compelling lines from an article extract

const HOOK_PATTERNS = [
  /\d{1,3}(?:,\d{3})*(?:\.\d+)?/, // numbers
  /\b(?:first|oldest|largest|smallest|fastest|deadliest|longest|shortest|tallest|rarest|most|least|only|unique|record)\b/i,
  /\b(?:discovered|invented|created|founded|built|destroyed|killed|survived|escaped|won|lost|defeated)\b/i,
  /\b(?:secret|mystery|unknown|ancient|forbidden|legendary|mythical|cursed|haunted|impossible)\b/i,
  /\b\d{3,4}\s*(?:AD|BC|BCE|CE)\b/i,
  /\b(?:million|billion|trillion|thousand)\b/i,
  /\b(?:war|battle|revolution|empire|kingdom|dynasty|civilization)\b/i,
  /\b(?:paradox|theory|phenomenon|anomaly|miracle)\b/i,
];

function scoreHookLine(line: string): number {
  let score = 0;
  for (const pattern of HOOK_PATTERNS) {
    if (pattern.test(line)) score += 2;
  }
  // Prefer medium-length sentences
  const words = line.split(/\s+/).length;
  if (words >= 8 && words <= 25) score += 3;
  if (words >= 5 && words < 8) score += 1;
  // Penalize very short or very long
  if (words < 4) score -= 5;
  if (words > 40) score -= 2;
  // Bonus for question-like or surprising structures
  if (line.includes('?')) score += 2;
  if (/\b(?:but|however|yet|despite|although|surprisingly|remarkably|incredibly)\b/i.test(line)) score += 3;
  return score;
}

function generateHooks(extract: string): string[] {
  const sentences = extract
    .split(/(?<=[.!?])\s+/)
    .filter(s => s.length > 20 && s.length < 200);

  if (sentences.length === 0) return [extract.slice(0, 100)];

  // Score all sentences
  const scored = sentences.map((s, i) => ({
    text: s.trim(),
    score: scoreHookLine(s) + (i === 0 ? 2 : 0), // slight first-sentence bonus
    index: i,
  }));

  // Sort by score, take top 3, then reorder by original position
  const top = scored
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .sort((a, b) => a.index - b.index);

  return top.map(t => t.text);
}

// ─── Content Quality Scorer ─────────────────────────────────
// Scores article quality based on content features
// Stricter scoring: only truly interesting articles should pass

// Keywords that signal an article is likely interesting/amazing
const INTERESTING_KEYWORDS = [
  /\b(?:discover(?:ed|y)|invent(?:ed|ion)|created?|founded?)\b/i,
  /\b(?:first|oldest|largest|smallest|fastest|deadliest|tallest|rarest|longest|shortest)\b/i,
  /\b(?:ancient|mysterious|legendary|mythical|famous|notorious|iconic|renowned)\b/i,
  /\b(?:revolution(?:ary)?|groundbreaking|pioneering|unprecedented)\b/i,
  /\b(?:record[- ]breaking|world record|guinness)\b/i,
  /\b(?:secret|forbidden|unknown|unexplained|enigma|paradox)\b/i,
  /\b(?:billion|million|trillion)\b/i,
  /\b(?:empire|dynasty|civilization|kingdom)\b/i,
  /\b(?:extinct|endangered|surviving|preserved)\b/i,
  /\b(?:conspiracy|scandal|controversy|infamous)\b/i,
  /\b(?:masterpiece|landmark|monument|treasure)\b/i,
  /\b(?:genius|prodigy|visionary|polymath)\b/i,
  /\b(?:catastrophe|disaster|plague|epidemic|pandemic)\b/i,
  /\b(?:assassination|coup|uprising|rebellion|mutiny)\b/i,
  /\b(?:expedition|exploration|voyage|quest)\b/i,
  /\b(?:miracle|phenomenon|anomaly|wonder)\b/i,
  /\b(?:Nobel Prize|Academy Award|Pulitzer|Grammy)\b/i,
];

function scoreContentQuality(article: WikiArticle): number {
  let score = 40; // base score — most articles should pass

  const extractLen = article.extract?.length ?? 0;

  // Length bonus (not penalty)
  if (extractLen >= 800) score += 15;
  else if (extractLen >= 400) score += 10;
  else if (extractLen >= 200) score += 5;

  // Thumbnail bonus
  if (article.thumbnail) score += 15;

  // Description bonus
  if (article.description && article.description.length > 10) score += 5;

  // ── Category richness (well-connected articles are more interesting) ──
  const catCount = article.categories?.length ?? 0;
  if (catCount >= 6) score += 10;
  else if (catCount >= 4) score += 6;
  else if (catCount >= 2) score += 3;
  else score -= 5; // very few categories = likely obscure

  // ── Extract quality signals ──
  const extract = article.extract ?? '';
  const sentences = extract.split(/[.!?]+/).filter(s => s.trim().length > 0);

  // Well-developed articles have multiple sentences
  if (sentences.length >= 5) score += 8;
  else if (sentences.length >= 3) score += 4;
  else score -= 5;

  // ── Interesting keyword bonus ──
  let keywordHits = 0;
  for (const pattern of INTERESTING_KEYWORDS) {
    if (pattern.test(extract)) keywordHits++;
  }
  // Reward articles that match multiple "interesting" signals
  score += Math.min(keywordHits * 4, 20);

  // ── Hook-worthy content bonus ──
  const hookScore = scoreHookLine(extract.slice(0, 300));
  score += Math.min(hookScore, 15);

  // ── Penalize generic/boilerplate descriptions ──
  const desc = (article.description ?? '').toLowerCase();
  if (/\b(?:village|hamlet|settlement|commune|municipality|township)\b/.test(desc)) {
    score -= 20;
  }
  if (/\b(?:species of|genus of|family of)\b/.test(desc)) {
    score -= 15;
  }
  if (/\b(?:wikimedia|stub|redirect|disambiguation)\b/.test(desc)) {
    score -= 30;
  }

  return Math.max(0, Math.min(100, score));
}

// ─── Interest Profile Engine ────────────────────────────────
// Builds and maintains a weighted interest profile with time decay

const DECAY_HALF_LIFE = 7 * 24 * 60 * 60 * 1000; // 7 days

function applyTimeDecay(weight: number, lastSeen: number): number {
  const age = Date.now() - lastSeen;
  const decayFactor = Math.pow(0.5, age / DECAY_HALF_LIFE);
  return weight * decayFactor;
}

export async function updateInterestProfile(
  category: string,
  interactionType: 'view' | 'save' | 'dislike' | 'dwell' | 'share' | 'read_full'
): Promise<void> {
  const interests = await getInterests();

  // Interaction weights
  const weights: Record<string, number> = {
    view: 1,
    dwell: 2,
    save: 5,
    share: 4,
    read_full: 3,
    dislike: -3,
  };

  const delta = weights[interactionType] ?? 1;
  const existing = interests.find(i => i.category === category);

  if (existing) {
    existing.weight = applyTimeDecay(existing.weight, existing.lastSeen) + delta;
    existing.lastSeen = Date.now();
    existing.interactions += 1;
  } else if (delta > 0) {
    interests.push({
      category,
      weight: delta,
      lastSeen: Date.now(),
      interactions: 1,
    });
  }

  // Normalize and prune
  const active = interests
    .map(i => ({ ...i, weight: applyTimeDecay(i.weight, i.lastSeen) }))
    .filter(i => i.weight > 0.5)
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 30);

  await setInterests(active);
}

// ─── Diversity Controller ───────────────────────────────────
// Ensures feed doesn't become monotonous

function enforceDiversity(
  articles: ProcessedArticle[],
  session: SessionState,
  maxSameCategory: number = 2
): ProcessedArticle[] {
  const result: ProcessedArticle[] = [];
  const recentCategories: string[] = [];

  for (const article of articles) {
    const cat = article.category ?? 'unknown';
    const recentCount = recentCategories.filter(c => c === cat).length;
    const sessionCount = session.categoriesShown[cat] ?? 0;

    // Skip if too many of same category recently
    if (recentCount >= maxSameCategory) continue;
    // Reduce probability as session fatigue increases
    if (sessionCount > 5 && Math.random() < 0.5) continue;

    result.push(article);
    recentCategories.push(cat);
    if (recentCategories.length > 5) recentCategories.shift();
  }

  return result;
}

// ─── Engagement Predictor ───────────────────────────────────
// Predicts article engagement based on content features + user profile

async function predictEngagement(
  article: WikiArticle,
  interests: UserInterest[]
): Promise<number> {
  let score = scoreContentQuality(article);

  // Interest alignment bonus
  const articleCats = article.categories ?? [];
  for (const interest of interests) {
    const match = articleCats.some(
      c => c.toLowerCase().includes(interest.category.toLowerCase()) ||
           interest.category.toLowerCase().includes(c.toLowerCase().replace(/ /g, '_'))
    );
    if (match) {
      score += Math.min(applyTimeDecay(interest.weight, interest.lastSeen) * 3, 20);
    }
  }

  return Math.min(100, Math.max(0, Math.round(score)));
}

// ─── Bridge Article Discovery ───────────────────────────────
// Finds articles that connect two interest areas (knowledge bridges)

async function findBridgeArticles(
  interests: UserInterest[],
  limit: number = 3
): Promise<WikiArticle[]> {
  if (interests.length < 2) return [];

  const sorted = interests
    .map(i => ({ ...i, weight: applyTimeDecay(i.weight, i.lastSeen) }))
    .sort((a, b) => b.weight - a.weight);

  // Pick two strong interests and search for intersection
  const a = sorted[0];
  const b = sorted[Math.min(1, sorted.length - 1)];

  if (a.category === b.category) return [];

  try {
    const bridgeQuery = `${a.category} ${b.category}`;
    return await searchArticles(bridgeQuery, limit);
  } catch {
    return [];
  }
}

// ─── Serendipity Engine ─────────────────────────────────────
// Controlled randomness that discovers surprising connections

async function getSerendipitousArticles(
  interests: UserInterest[],
  limit: number = 3
): Promise<WikiArticle[]> {
  if (interests.length === 0) return getRandomArticles(limit);

  // Pick a random interest and follow its Wikipedia link graph
  const randomInterest = interests[Math.floor(Math.random() * interests.length)];

  try {
    // Get articles from the interest category
    const seedArticles = await getArticlesByCategory(randomInterest.category, 3);
    if (seedArticles.length === 0) return getRandomArticles(limit);

    // Get links from a random seed article
    const seed = seedArticles[Math.floor(Math.random() * seedArticles.length)];
    const links = await getArticleLinks(seed.title);

    if (links.length === 0) return getRandomArticles(limit);

    // Pick random links and fetch their content
    const shuffled = links.sort(() => Math.random() - 0.5).slice(0, limit * 3);
    const url = `https://en.wikipedia.org/w/api.php?${new URLSearchParams({
      action: 'query',
      titles: shuffled.join('|'),
      prop: 'extracts|pageimages|description',
      exintro: '1',
      explaintext: '1',
      piprop: 'thumbnail',
      pithumbsize: '800',
      format: 'json',
      origin: '*',
    })}`;

    const res = await fetch(url);
    const data = await res.json();
    const pages = data?.query?.pages;
    if (!pages) return getRandomArticles(limit);

    const articles: WikiArticle[] = [];
    for (const page of Object.values(pages) as any[]) {
      if (page.missing !== undefined || !page.extract || page.extract.length < 150) continue;
      articles.push({
        title: page.title,
        pageid: page.pageid,
        extract: page.extract,
        thumbnail: page.thumbnail?.source,
        description: page.description,
      });
    }

    return articles.slice(0, limit);
  } catch {
    return getRandomArticles(limit);
  }
}

// ─── Spaced Repetition Surface ──────────────────────────────
// Re-surfaces previously seen articles at optimal intervals for retention

async function getSpacedRepetitionArticles(limit: number = 2): Promise<ProcessedArticle[]> {
  const saved = await getSaved();
  if (saved.length === 0) return [];

  const now = Date.now();
  const intervals = [
    1 * 24 * 60 * 60 * 1000,   // 1 day
    3 * 24 * 60 * 60 * 1000,   // 3 days
    7 * 24 * 60 * 60 * 1000,   // 1 week
    14 * 24 * 60 * 60 * 1000,  // 2 weeks
    30 * 24 * 60 * 60 * 1000,  // 1 month
  ];

  // Find saved articles that are due for review
  const due = saved.filter(article => {
    if (!article.timestamp) return Math.random() < 0.1; // 10% chance for undated
    const age = now - new Date(article.timestamp).getTime();
    return intervals.some(interval => {
      const windowStart = interval * 0.8;
      const windowEnd = interval * 1.2;
      return age >= windowStart && age <= windowEnd;
    });
  });

  if (due.length > 0) {
    return due.sort(() => Math.random() - 0.5).slice(0, limit);
  }

  // Fallback: randomly resurface old saves
  if (saved.length > 5 && Math.random() < 0.15) {
    const old = saved.slice(5);
    return [old[Math.floor(Math.random() * old.length)]];
  }

  return [];
}

// ─── Main Feed Builder ──────────────────────────────────────
// Orchestrates all algorithms to build an optimal feed

function processArticle(
  article: WikiArticle,
  score: number,
  sourceType: ProcessedArticle['sourceType'],
  category?: string,
  theme?: string
): ProcessedArticle {
  return {
    ...article,
    hookLines: generateHooks(article.extract),
    score,
    category,
    theme,
    sourceType,
    timestamp: new Date().toISOString(),
  };
}

let currentSession: SessionState = {
  categoriesShown: {},
  articlesShown: 0,
  sessionStart: Date.now(),
  lastInteraction: Date.now(),
};

function getSession(): SessionState {
  // Reset session after 30 minutes of inactivity
  if (Date.now() - currentSession.lastInteraction > 30 * 60 * 1000) {
    currentSession = {
      categoriesShown: {},
      articlesShown: 0,
      sessionStart: Date.now(),
      lastInteraction: Date.now(),
    };
  }
  return currentSession;
}

function updateSession(categories: string[]): void {
  const session = getSession();
  for (const cat of categories) {
    session.categoriesShown[cat] = (session.categoriesShown[cat] ?? 0) + 1;
  }
  session.articlesShown += categories.length;
  session.lastInteraction = Date.now();
}

export async function buildFeed(
  config: FeedConfig,
  existingIds: Set<number>,
  count: number = 10
): Promise<ProcessedArticle[]> {
  const seenTitles = new Set<string>();
  const normalizeTitle = (title: string) =>
    title.toLowerCase().replace(/\s*\(.*?\)\s*/g, '').replace(/[^a-z0-9]/g, '');

  const isFiltered = (a: WikiArticle) => {
    if (existingIds.has(a.pageid)) return true;
    const norm = normalizeTitle(a.title);
    if (seenTitles.has(norm)) return true;
    seenTitles.add(norm);
    return false;
  };

  let candidates: ProcessedArticle[] = [];

  // ── Category or Theme mode ──
  if (config.category) {
    const [catArticles, searchFallback] = await Promise.all([
      getArticlesByCategory(config.category, count * 2),
      searchArticles(config.category.replace(/_/g, ' '), count),
    ]);
    const allArticles = [...catArticles, ...searchFallback];
    const seen = new Set<number>();
    const unique = allArticles.filter(a => { if (seen.has(a.pageid)) return false; seen.add(a.pageid); return true; });
    for (const article of unique.filter(a => !isFiltered(a))) {
      candidates.push(processArticle(article, scoreContentQuality(article), 'category', config.category));
    }
    if (candidates.length < count) {
      const random = await getRandomArticles(count);
      for (const article of random.filter(a => !isFiltered(a))) {
        candidates.push(processArticle(article, scoreContentQuality(article), 'random'));
      }
    }
  } else if (config.searchQuery) {
    const articles = await searchArticles(config.searchQuery, count * 3);
    for (const article of articles.filter(a => !isFiltered(a))) {
      candidates.push(processArticle(article, scoreContentQuality(article) + 20, 'search', undefined, config.theme));
    }
    if (candidates.length < count) {
      const random = await getRandomArticles(count);
      for (const article of random.filter(a => !isFiltered(a))) {
        candidates.push(processArticle(article, scoreContentQuality(article), 'random'));
      }
    }
  } else {
    // ── Home feed: fast approach with preference learning ──
    const { getTopCategories, getWeightedRandomCategory } = require('./preferences');
    const feedPromises: Promise<void>[] = [];

    // 1. Random articles (always — fast, single API call)
    feedPromises.push((async () => {
      const random = await getRandomArticles(count * 3);
      for (const article of random.filter(a => !isFiltered(a))) {
        const score = scoreContentQuality(article);
        candidates.push(processArticle(article, score, 'random'));
      }
    })());

    // 2. Trending/most-read (single API call)
    feedPromises.push((async () => {
      const trending = await getMostReadArticles(count);
      for (const article of trending.filter(a => !isFiltered(a))) {
        const score = scoreContentQuality(article) + 8;
        candidates.push(processArticle(article, score, 'trending'));
      }
    })());

    // 3. Preference-based (only if user has liked enough articles)
    const preferredCategory = getWeightedRandomCategory();
    if (preferredCategory) {
      feedPromises.push((async () => {
        const articles = await getArticlesByCategory(preferredCategory, count);
        for (const article of articles.filter(a => !isFiltered(a))) {
          const score = scoreContentQuality(article) + 15; // boost preferred
          candidates.push(processArticle(article, score, 'interest', preferredCategory));
        }
      })());
    }

    await Promise.all(feedPromises);
  }

  // ── Score-based ranking with diversity ──

  // Deduplicate by page ID (keep highest score)
  const uniqueMap = new Map<number, ProcessedArticle>();
  for (const c of candidates) {
    const existing = uniqueMap.get(c.pageid);
    if (!existing || c.score > existing.score) {
      uniqueMap.set(c.pageid, c);
    }
  }

  // Deduplicate by normalized title to avoid similar content
  // e.g., "Battle of Gettysburg" and "Battle of Gettysburg (1863)" are too similar
  const titleMap = new Map<string, ProcessedArticle>();
  for (const c of Array.from(uniqueMap.values())) {
    const normalizedTitle = c.title
      .toLowerCase()
      .replace(/\s*\(.*?\)\s*/g, '')  // strip parentheticals
      .replace(/[^a-z0-9]/g, '');      // strip punctuation/spaces
    const existing = titleMap.get(normalizedTitle);
    if (!existing || c.score > existing.score) {
      titleMap.set(normalizedTitle, c);
    }
  }
  candidates = Array.from(titleMap.values());

  // ── Minimum quality threshold ──
  // Don't surface articles below this score — they aren't "amazing" enough
  const MIN_QUALITY_SCORE = config.category || config.searchQuery ? 15 : 20;
  candidates = candidates.filter(c => c.score >= MIN_QUALITY_SCORE);

  // Sort by score with slight randomization to prevent staleness
  candidates.sort((a, b) => {
    const jitterA = a.score + (Math.random() * 10 - 5);
    const jitterB = b.score + (Math.random() * 10 - 5);
    return jitterB - jitterA;
  });

  // Apply diversity filter
  const session = getSession();
  const diverse = enforceDiversity(candidates, session);

  // Take requested count
  const result = diverse.slice(0, count);

  // Update session tracking (lightweight, in-memory)
  updateSession(result.map(a => a.category ?? 'unknown'));

  return result;
}

// ─── Record user interaction ────────────────────────────────

export async function recordInteraction(
  article: ProcessedArticle,
  type: InteractionEvent['type'],
  dwellTime?: number
): Promise<void> {
  const event: InteractionEvent = {
    articleId: article.pageid,
    type,
    timestamp: Date.now(),
    category: article.category,
    dwellTime,
  };

  await addInteraction(event);

  // Update interest profile based on interaction
  if (article.category) {
    await updateInterestProfile(article.category, type);
  }

  // Also update interests based on article categories from Wikipedia
  if (article.categories) {
    const primaryCat = article.categories[0];
    if (primaryCat) {
      await updateInterestProfile(primaryCat, type);
    }
  }
}

// ─── Feed Statistics (for debug/display) ────────────────────

export function getFeedStats(articles: ProcessedArticle[]): {
  sourceBreakdown: Record<string, number>;
  avgScore: number;
  categoryBreakdown: Record<string, number>;
} {
  const sourceBreakdown: Record<string, number> = {};
  const categoryBreakdown: Record<string, number> = {};
  let totalScore = 0;

  for (const a of articles) {
    sourceBreakdown[a.sourceType] = (sourceBreakdown[a.sourceType] ?? 0) + 1;
    if (a.category) {
      categoryBreakdown[a.category] = (categoryBreakdown[a.category] ?? 0) + 1;
    }
    totalScore += a.score;
  }

  return {
    sourceBreakdown,
    avgScore: articles.length > 0 ? Math.round(totalScore / articles.length) : 0,
    categoryBreakdown,
  };
}
