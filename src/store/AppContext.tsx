import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
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
  diveDeeper: (article: ProcessedArticle) => void;
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

  // Load persisted state on mount
  useEffect(() => {
    (async () => {
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
        articles: [...s.articles, ...newArticles],
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

  const diveDeeper = useCallback(async (article: ProcessedArticle) => {
    try {
      const results = await Promise.allSettled([
        getRelatedArticles(article.title, 8),
        getArticleLinks(article.title, 8),
      ]);
      const related = results[0].status === 'fulfilled' ? results[0].value : [];
      const linked = results[1].status === 'fulfilled' ? results[1].value : [];
      const all = [...related, ...linked];
      const unique = all.filter((a, i) =>
        a.extract &&
        a.extract.length > 100 &&
        all.findIndex(b => b.pageid === a.pageid) === i &&
        !articleIdsRef.current.has(a.pageid)
      );
      const processed: ProcessedArticle[] = unique.map(a => ({
        ...a,
        hookLines: [a.extract.split('.')[0] + '.'],
        score: 75,
        sourceType: 'related' as const,
        timestamp: new Date().toISOString(),
      }));
      for (const a of processed) articleIdsRef.current.add(a.pageid);
      if (processed.length > 0) {
        setState(s => ({
          ...s,
          articles: [...s.articles, ...processed],
        }));
      }
    } catch (err) {
      if (__DEV__) console.warn('Dive deeper issue:', (err as Error)?.message);
    }
  }, []);

  return (
    <AppContext.Provider
      value={{
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
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be inside AppProvider');
  return ctx;
}
