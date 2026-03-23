import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { ProcessedArticle, FeedConfig, TabName } from '../types';
import * as Storage from '../lib/storage';
import { buildFeed, recordInteraction } from '../lib/algorithm';
import { getRelatedArticles, getArticleLinks } from '../lib/wikipedia';

interface AppState {
  articles: ProcessedArticle[];
  saved: ProcessedArticle[];
  history: ProcessedArticle[];
  disliked: number[];
  loading: boolean;
  activeTab: TabName;
  feedConfig: FeedConfig;
  articleViewer: ProcessedArticle | null;
}

interface AppContextValue extends AppState {
  loadMore: () => Promise<void>;
  saveArticle: (article: ProcessedArticle) => Promise<void>;
  unsaveArticle: (pageid: number) => Promise<void>;
  dislikeArticle: (article: ProcessedArticle) => Promise<void>;
  addToHistory: (article: ProcessedArticle) => void;
  viewArticle: (article: ProcessedArticle) => void;
  closeViewer: () => void;
  setActiveTab: (tab: TabName) => void;
  setFeedConfig: (config: FeedConfig) => void;
  recordDwell: (article: ProcessedArticle, duration: number) => Promise<void>;
  shareArticle: (article: ProcessedArticle) => Promise<void>;
  isSaved: (pageid: number) => boolean;
  resetFeed: () => void;
  diveDeeper: (article: ProcessedArticle) => Promise<ProcessedArticle[]>;
  loadMoreDiveArticles: () => Promise<ProcessedArticle[]>;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AppState>({
    articles: [],
    saved: [],
    history: [],
    disliked: [],
    loading: false,
    activeTab: 'feed',
    feedConfig: {},
    articleViewer: null,
  });

  const loadingRef = useRef(false);
  const articleIdsRef = useRef(new Set<number>());

  // Load persisted state on mount — preload cache first for fast reads
  useEffect(() => {
    (async () => {
      await Storage.preloadCache();
      const [saved, history, disliked] = await Promise.all([
        Storage.getSaved(),
        Storage.getHistory(),
        Storage.getDisliked(),
      ]);
      setState(s => ({ ...s, saved, history, disliked }));
    })();
  }, []);

  // Initial feed load
  useEffect(() => {
    loadMore();
  }, [state.feedConfig]);

  const loadMore = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setState(s => ({ ...s, loading: true }));

    try {
      // Race feed build against a 15-second timeout to avoid hanging
      const feedPromise = buildFeed(state.feedConfig, articleIdsRef.current, 8);
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Feed load timeout')), 25000)
      );
      const newArticles = await Promise.race([feedPromise, timeoutPromise]);
      for (const a of newArticles) articleIdsRef.current.add(a.pageid);

      setState(s => ({
        ...s,
        articles: s.articles.concat(newArticles),
        loading: false,
      }));
    } catch (err) {
      // Use warn instead of error to avoid red error overlay
      if (__DEV__) console.warn('Feed load issue:', (err as Error)?.message);
      setState(s => ({ ...s, loading: false }));
    } finally {
      loadingRef.current = false;
    }
  }, [state.feedConfig]);

  const saveArticle = useCallback(async (article: ProcessedArticle) => {
    await Storage.addSaved(article);
    await recordInteraction(article, 'save');
    const saved = await Storage.getSaved();
    setState(s => ({ ...s, saved }));
  }, []);

  const unsaveArticle = useCallback(async (pageid: number) => {
    await Storage.removeSaved(pageid);
    const saved = await Storage.getSaved();
    setState(s => ({ ...s, saved }));
  }, []);

  const dislikeArticle = useCallback(async (article: ProcessedArticle) => {
    await Storage.addDisliked(article.pageid);
    await recordInteraction(article, 'dislike');
    setState(s => ({
      ...s,
      disliked: [...s.disliked, article.pageid],
      articles: s.articles.filter(a => a.pageid !== article.pageid),
    }));
  }, []);

  const addToHistory = useCallback((article: ProcessedArticle) => {
    Storage.addHistory(article);
    Storage.addSeen(article.pageid); // Mark as seen so it never appears again
    articleIdsRef.current.add(article.pageid); // Also track in-session
    setState(s => ({
      ...s,
      history: [article, ...s.history.filter(a => a.pageid !== article.pageid)].slice(0, 100),
    }));
  }, []);

  const viewArticle = useCallback((article: ProcessedArticle) => {
    addToHistory(article);
    recordInteraction(article, 'read_full');
    setState(s => ({
      ...s,
      articleViewer: article,
    }));
  }, [addToHistory]);

  const closeViewer = useCallback(() => {
    setState(s => ({ ...s, articleViewer: null }));
  }, []);

  const setActiveTab = useCallback((tab: TabName) => {
    setState(s => ({ ...s, activeTab: tab }));
  }, []);

  const setFeedConfig = useCallback((config: FeedConfig) => {
    articleIdsRef.current.clear();
    setState(s => ({ ...s, articles: [], feedConfig: config }));
  }, []);

  const recordDwell = useCallback(async (article: ProcessedArticle, duration: number) => {
    if (duration >= 3000) {
      await recordInteraction(article, 'dwell', duration);
    }
  }, []);

  const shareArticle = useCallback(async (article: ProcessedArticle) => {
    await recordInteraction(article, 'share');
  }, []);

  const isSaved = useCallback((pageid: number) => {
    return state.saved.some(a => a.pageid === pageid);
  }, [state.saved]);

  const resetFeed = useCallback(() => {
    articleIdsRef.current.clear();
    setState(s => ({ ...s, articles: [], feedConfig: {} }));
  }, []);

  // ── Deep Dive Engine ──
  // Maintains a local exploration cache that follows Wikipedia's link graph recursively.
  // When user activates deep dive on an article, it:
  // 1. Fetches related articles + links from that article
  // 2. Stores unexplored titles in a queue for recursive expansion
  // 3. When running low, automatically explores the next title in the queue
  const diveQueueRef = useRef<string[]>([]); // titles to explore next
  const diveSeenRef = useRef(new Set<string>()); // titles already explored
  const diveCacheRef = useRef<ProcessedArticle[]>([]); // pre-fetched articles ready to serve

  const fetchDiveArticles = useCallback(async (title: string): Promise<ProcessedArticle[]> => {
    if (diveSeenRef.current.has(title)) return [];
    diveSeenRef.current.add(title);

    try {
      const results = await Promise.allSettled([
        getRelatedArticles(title, 10),
        getArticleLinks(title, 10),
      ]);
      const related = results[0].status === 'fulfilled' ? results[0].value : [];
      const linked = results[1].status === 'fulfilled' ? results[1].value : [];
      const all = [...related, ...linked];

      // Deduplicate and filter
      const seenIds = new Set<number>();
      const unique = all.filter(a => {
        if (!a.extract || a.extract.length < 100) return false;
        if (seenIds.has(a.pageid) || articleIdsRef.current.has(a.pageid)) return false;
        seenIds.add(a.pageid);
        return true;
      });

      // Add unexplored titles to the queue for recursive expansion
      for (const a of unique) {
        if (!diveSeenRef.current.has(a.title) && !diveQueueRef.current.includes(a.title)) {
          diveQueueRef.current.push(a.title);
        }
      }

      const processed: ProcessedArticle[] = unique.map(a => ({
        ...a,
        hookLines: [a.extract.split('.')[0] + '.'],
        score: 75,
        sourceType: 'related' as const,
        timestamp: new Date().toISOString(),
      }));

      for (const a of processed) articleIdsRef.current.add(a.pageid);
      return processed;
    } catch (err) {
      if (__DEV__) console.warn('Dive fetch issue:', (err as Error)?.message);
      return [];
    }
  }, []);

  const diveDeeper = useCallback(async (article: ProcessedArticle): Promise<ProcessedArticle[]> => {
    // Reset dive state for new dive
    diveQueueRef.current = [];
    diveSeenRef.current.clear();
    diveCacheRef.current = [];

    // Seed the queue with the origin article's title
    const articles = await fetchDiveArticles(article.title);

    // Cache extras beyond first batch
    if (articles.length > 5) {
      diveCacheRef.current = articles.slice(5);
      const firstBatch = articles.slice(0, 5);
      setState(s => ({ ...s, articles: s.articles.concat(firstBatch) }));

      // Pre-fetch from first queued title in background
      if (diveQueueRef.current.length > 0) {
        const nextTitle = diveQueueRef.current.shift()!;
        fetchDiveArticles(nextTitle).then(more => {
          diveCacheRef.current = diveCacheRef.current.concat(more);
        });
      }

      return firstBatch;
    }

    if (articles.length > 0) {
      setState(s => ({ ...s, articles: s.articles.concat(articles) }));
    }
    return articles;
  }, [fetchDiveArticles]);

  const loadMoreDiveArticles = useCallback(async (): Promise<ProcessedArticle[]> => {
    // First, serve from cache
    if (diveCacheRef.current.length > 0) {
      const batch = diveCacheRef.current.splice(0, 5);
      setState(s => ({ ...s, articles: s.articles.concat(batch) }));

      // Pre-fetch more in background if cache is running low
      if (diveCacheRef.current.length < 3 && diveQueueRef.current.length > 0) {
        const nextTitle = diveQueueRef.current.shift()!;
        fetchDiveArticles(nextTitle).then(more => {
          diveCacheRef.current = diveCacheRef.current.concat(more);
        });
      }

      return batch;
    }

    // Cache empty — fetch from next title in queue
    if (diveQueueRef.current.length > 0) {
      const nextTitle = diveQueueRef.current.shift()!;
      const articles = await fetchDiveArticles(nextTitle);
      if (articles.length > 0) {
        setState(s => ({ ...s, articles: s.articles.concat(articles) }));
      }
      return articles;
    }

    return [];
  }, [fetchDiveArticles]);

  // Memoize context value to prevent all consumers re-rendering on every state change
  const contextValue = useMemo(() => ({
    ...state,
    loadMore,
    saveArticle,
    unsaveArticle,
    dislikeArticle,
    addToHistory,
    viewArticle,
    closeViewer,
    setActiveTab,
    setFeedConfig,
    recordDwell,
    shareArticle,
    isSaved,
    resetFeed,
    diveDeeper,
    loadMoreDiveArticles,
  }), [state, loadMore, saveArticle, unsaveArticle, dislikeArticle, addToHistory, viewArticle, closeViewer, setActiveTab, setFeedConfig, recordDwell, shareArticle, isSaved, resetFeed, diveDeeper, loadMoreDiveArticles]);

  return (
    <AppContext.Provider value={contextValue}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be inside AppProvider');
  return ctx;
}
