export interface WikiArticle {
  title: string;
  pageid: number;
  extract: string;
  thumbnail?: string;
  description?: string;
  categories?: string[];
  links?: string[];
  timestamp?: string;
}

export interface ProcessedArticle extends WikiArticle {
  hookLines: string[];
  score: number;
  category?: string;
  theme?: string;
  sourceType: 'random' | 'interest' | 'trending' | 'category' | 'search' | 'related' | 'bridge' | 'serendipity';
}

export interface UserInterest {
  category: string;
  weight: number;
  lastSeen: number;
  interactions: number;
}

export interface InteractionEvent {
  articleId: number;
  type: 'view' | 'save' | 'dislike' | 'dwell' | 'share' | 'read_full';
  timestamp: number;
  category?: string;
  dwellTime?: number;
}

export interface SessionState {
  categoriesShown: Record<string, number>;
  articlesShown: number;
  sessionStart: number;
  lastInteraction: number;
}

export interface FeedConfig {
  category?: string;
  theme?: string;
  searchQuery?: string;
}

export type TabName = 'feed' | 'today' | 'explore' | 'recent' | 'saved';
