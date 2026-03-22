import { WikiArticle } from '../types';

const API_BASE = 'https://en.wikipedia.org/w/api.php';
const REST_BASE = 'https://en.wikipedia.org/api/rest_v1';

const BORING_PATTERNS = [
  // Geographic boilerplate
  /\bvillage\b.*\bdistrict\b/i,
  /\bmunicipality\b.*\bcounty\b/i,
  /\bcommune\b.*\bdepartment\b/i,
  /\bcensus[- ]designated place\b/i,
  /\bis a town in\b/i,
  /\bis a city in\b/i,
  /\bis a village in\b/i,
  /\bis a hamlet in\b/i,
  /\bis a settlement in\b/i,
  /\bis a borough in\b/i,
  /\bis a parish in\b/i,
  /\bis a neighbourhood in\b/i,
  /\bis a neighborhood in\b/i,
  /\bis a locality in\b/i,
  /\bis a suburb of\b/i,
  /\bis a municipality in\b/i,
  /\bis a barangay in\b/i,
  /\bis a commune in\b/i,
  /\bis a district of\b/i,
  /\bis a province of\b/i,
  /\bis a county in\b/i,
  /\bis a township in\b/i,
  /\bis a census-designated\b/i,
  /\bis a small town\b/i,
  /\bis an unincorporated community\b/i,
  /\blocated in the\b.*\bregion of\b/i,
  /\bwith a population of\b.*\baccording to\b/i,

  // Sports boilerplate (minor figures)
  /\bis a footballer\b/i,
  /\bis a cricketer\b/i,
  /\bis a\b.*\bfootball\b.*\bplayer\b/i,
  /\bis a\b.*\bsoccer\b.*\bplayer\b/i,
  /\bis a\b.*\brugby\b.*\bplayer\b/i,
  /\bis a\b.*\bbaseball\b.*\bplayer\b/i,
  /\bis a\b.*\bbasketball\b.*\bplayer\b/i,
  /\bis a\b.*\bhockey\b.*\bplayer\b/i,
  /\bis a\b.*\bhandballer\b/i,
  /\bplays for\b.*\bin the\b/i,
  /\bprofessional\b.*\bwho plays\b/i,
  /\bwho currently plays\b/i,
  /\bwho played for\b/i,
  /\b\d{4}.*\bseason\b.*\bwas the\b/i,
  /\bwas a.*league\b.*\bseason\b/i,

  // Politics boilerplate
  /\bpolitician who\b/i,
  /\bis a member of the\b.*\bparliament\b/i,
  /\bis a\b.*\bpolitician\b.*\bserving as\b/i,
  /\bis a\b.*\bpolitician\b.*\bwho served\b/i,
  /\bran for election\b/i,
  /\belection\b.*\bresults\b/i,
  /\bcensus\b.*\bpopulation\b/i,
  /\belectoral district\b/i,
  /\bconstituency\b/i,
  /\blegislative assembly\b/i,

  // Taxonomy / biology stubs
  /\btaxonomy\b.*\bspecies\b/i,
  /\bgenus of\b.*\bfamily\b/i,
  /\bis a species of\b.*\bin the family\b/i,
  /\bis a genus of\b/i,
  /\bis a moth\b.*\bfamily\b/i,
  /\bis a beetle\b.*\bfamily\b/i,
  /\bis a fly\b.*\bfamily\b/i,
  /\bis a\b.*\binsect\b.*\bfamily\b/i,
  /\bis a\b.*\bsnail\b.*\bfamily\b/i,
  /\bis a\b.*\blichen\b.*\bfamily\b/i,
  /\bis a\b.*\bmoss\b.*\bfamily\b/i,
  /\bis a\b.*\bplant\b.*\bin the family\b/i,

  // Wikipedia structural pages
  /\bList of\b/i,
  /\bIndex of\b/i,
  /\bdisambiguation\b/i,
  /\bmay refer to\b/i,
  /\bcan refer to\b/i,
  /\bthis article\b.*\bstub\b/i,
  /\bstub\b.*\bYou can help\b/i,
  /\bTimeline of\b/i,
  /\bGlossary of\b/i,
  /\bOutline of\b/i,
  /\bBibliography of\b/i,
  /\bComparison of\b/i,

  // Academic / minor entries
  /\bis a\b.*\bjournal\b.*\bpublished by\b/i,
  /\bis a peer-reviewed\b/i,
  /\bis a scientific name\b/i,
  /\bis a highway in\b/i,
  /\bis a road in\b/i,
  /\bis a route in\b/i,
  /\bis a station\b.*\bserved by\b/i,
  /\bis a railway station\b/i,
  /\bis a school in\b/i,
  /\bis an elementary school\b/i,
  /\bis a high school in\b/i,
];

const BORING_TITLE_PATTERNS = [
  /^List of /i,
  /^Index of /i,
  /^Outline of /i,
  /^Timeline of /i,
  /^Glossary of /i,
  /^Bibliography of /i,
  /^Comparison of /i,
  /\(disambiguation\)/i,
  /\(electoral district\)/i,
  /\(constituency\)/i,
  /\(TV series\)$/i,
  /\(season \d+\)$/i,
  /^\d{4} in /i,           // "2023 in football"
  /^\d{4}–\d{2,4} /i,     // "2023–24 season"
  /\belections?\b.*\d{4}/i, // "2020 election"
];

const BORING_DESCRIPTION_PATTERNS = [
  /\bstub\b/i,
  /\bdisambiguation\b/i,
  /\bWikimedia\b/i,
  /\bredirect\b/i,
  /\blist article\b/i,
  /\btaxonomic\b/i,
  /\bspecies of\b.*\binsect\b/i,
  /\bspecies of\b.*\bplant\b/i,
  /\bspecies of\b.*\bmollusk\b/i,
  /\bspecies of\b.*\barachnid\b/i,
];

function isBoringArticle(article: WikiArticle): boolean {
  if (!article.extract || article.extract.length < 200) return true;

  // Check title
  if (BORING_TITLE_PATTERNS.some(p => p.test(article.title))) return true;

  // Check description
  if (article.description && BORING_DESCRIPTION_PATTERNS.some(p => p.test(article.description))) return true;

  // Check extract content
  return BORING_PATTERNS.some(p => p.test(article.extract));
}

// Rate limiting: max 2 concurrent requests, 200ms minimum gap
let activeRequests = 0;
let lastRequestTime = 0;
const MAX_CONCURRENT = 2;
const MIN_GAP_MS = 200;

async function fetchJSON(url: string, retries = 2): Promise<any> {
  // Wait for slot
  while (activeRequests >= MAX_CONCURRENT) {
    await new Promise(r => setTimeout(r, 100));
  }
  // Enforce minimum gap
  const now = Date.now();
  const gap = now - lastRequestTime;
  if (gap < MIN_GAP_MS) {
    await new Promise(r => setTimeout(r, MIN_GAP_MS - gap));
  }

  activeRequests++;
  lastRequestTime = Date.now();
  try {
    const res = await fetch(url, {
      headers: {
        'Api-User-Agent': 'WikiTokApp/1.0 (https://wikitok.app; contact@wikitok.app)',
      },
    });
    if (res.status === 429 && retries > 0) {
      // Rate limited — exponential backoff
      activeRequests--;
      const delay = (3 - retries) * 2000;
      await new Promise(r => setTimeout(r, delay));
      return fetchJSON(url, retries - 1);
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  } finally {
    activeRequests--;
  }
}

function buildQueryURL(params: Record<string, string>): string {
  const query = new URLSearchParams({
    format: 'json',
    origin: '*',
    ...params,
  });
  return `${API_BASE}?${query}`;
}

async function getExtracts(titles: string[]): Promise<WikiArticle[]> {
  if (titles.length === 0) return [];
  const batchSize = 20;
  const results: WikiArticle[] = [];

  for (let i = 0; i < titles.length; i += batchSize) {
    const batch = titles.slice(i, i + batchSize);
    const url = buildQueryURL({
      action: 'query',
      titles: batch.join('|'),
      prop: 'extracts|pageimages|categories|description',
      exintro: '1',
      explaintext: '1',
      piprop: 'thumbnail',
      pithumbsize: '800',
      pilimit: String(batchSize),
      cllimit: '10',
    });

    const data = await fetchJSON(url);
    const pages = data?.query?.pages;
    if (!pages) continue;

    for (const page of Object.values(pages) as any[]) {
      if (page.missing !== undefined || !page.extract) continue;
      results.push({
        title: page.title,
        pageid: page.pageid,
        extract: page.extract,
        thumbnail: page.thumbnail?.source,
        description: page.description,
        categories: page.categories?.map((c: any) => c.title.replace('Category:', '')),
      });
    }
  }
  return results;
}

export async function getRandomArticles(limit: number = 10): Promise<WikiArticle[]> {
  const url = buildQueryURL({
    action: 'query',
    list: 'random',
    rnnamespace: '0',
    rnlimit: '50',
  });

  const data = await fetchJSON(url);
  const randomTitles = data?.query?.random?.map((r: any) => r.title) ?? [];
  const articles = await getExtracts(randomTitles);
  return articles.filter(a => !isBoringArticle(a)).slice(0, limit);
}

const categoryContinue: Record<string, string | undefined> = {};

export async function getArticlesByCategory(category: string, limit: number = 10): Promise<WikiArticle[]> {
  const params: Record<string, string> = {
    action: 'query',
    list: 'categorymembers',
    cmtitle: `Category:${category}`,
    cmtype: 'page',
    cmlimit: '50',
    cmsort: 'sortkey',
  };

  const continueToken = categoryContinue[category];
  if (continueToken) {
    params.cmcontinue = continueToken;
  }

  const url = buildQueryURL(params);
  const data = await fetchJSON(url);
  const titles = data?.query?.categorymembers?.map((m: any) => m.title) ?? [];

  // Store continue token for next page
  categoryContinue[category] = data?.continue?.cmcontinue;

  const articles = await getExtracts(titles);
  let filtered = articles.filter(a => !isBoringArticle(a));

  // If we got too few, supplement with search
  if (filtered.length < limit) {
    const extra = await searchArticles(category.replace(/_/g, ' '), limit);
    filtered = [...filtered, ...extra];
  }

  return filtered.slice(0, limit);
}

export async function searchArticles(query: string, limit: number = 10): Promise<WikiArticle[]> {
  // Strategy 1: Standard list=search (keyword matching)
  const listSearchURL = buildQueryURL({
    action: 'query',
    list: 'search',
    srsearch: query,
    srlimit: '20',
    srnamespace: '0',
  });

  // Strategy 2: generator=search (returns better semantic matches with extracts in one call)
  const generatorSearchURL = buildQueryURL({
    action: 'query',
    generator: 'search',
    gsrsearch: query,
    gsrlimit: '20',
    gsrnamespace: '0',
    prop: 'extracts|pageimages|categories|description',
    exintro: '1',
    explaintext: '1',
    piprop: 'thumbnail',
    pithumbsize: '800',
    pilimit: '20',
    cllimit: '10',
  });

  const [listData, genData] = await Promise.all([
    fetchJSON(listSearchURL).catch(() => null),
    fetchJSON(generatorSearchURL).catch(() => null),
  ]);

  // Collect articles from generator=search (already has extracts)
  const seenIds = new Set<number>();
  const allArticles: WikiArticle[] = [];

  const genPages = genData?.query?.pages;
  if (genPages) {
    for (const page of Object.values(genPages) as any[]) {
      if (page.missing !== undefined || !page.extract) continue;
      seenIds.add(page.pageid);
      allArticles.push({
        title: page.title,
        pageid: page.pageid,
        extract: page.extract,
        thumbnail: page.thumbnail?.source,
        description: page.description,
        categories: page.categories?.map((c: any) => c.title.replace('Category:', '')),
      });
    }
  }

  // Collect titles from list=search that weren't in generator results
  const listTitles = (listData?.query?.search ?? [])
    .filter((s: any) => !seenIds.has(s.pageid))
    .map((s: any) => s.title);

  if (listTitles.length > 0) {
    const extraArticles = await getExtracts(listTitles);
    for (const a of extraArticles) {
      if (!seenIds.has(a.pageid)) {
        seenIds.add(a.pageid);
        allArticles.push(a);
      }
    }
  }

  return allArticles.filter(a => !isBoringArticle(a)).slice(0, limit);
}

export async function getRelatedArticles(title: string, limit: number = 10): Promise<WikiArticle[]> {
  try {
    const encoded = encodeURIComponent(title);
    const res = await fetch(`${REST_BASE}/page/related/${encoded}`);
    if (!res.ok) throw new Error('Related API failed');
    const data = await res.json();
    const titles = data?.pages?.map((p: any) => p.title).slice(0, 30) ?? [];
    const articles = await getExtracts(titles);
    return articles.filter(a => !isBoringArticle(a)).slice(0, limit);
  } catch {
    return getRandomArticles(limit);
  }
}

export async function getArticleLinks(title: string): Promise<string[]> {
  const url = buildQueryURL({
    action: 'query',
    titles: title,
    prop: 'links',
    pllimit: '100',
    plnamespace: '0',
  });

  const data = await fetchJSON(url);
  const pages = data?.query?.pages;
  if (!pages) return [];
  const page = Object.values(pages)[0] as any;
  return page?.links?.map((l: any) => l.title) ?? [];
}

export async function getTodaysArticles(): Promise<WikiArticle[]> {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');

  try {
    const res = await fetch(`${REST_BASE}/feed/featured/${year}/${month}/${day}`);
    if (!res.ok) throw new Error('Feed API failed');
    const data = await res.json();

    const titles: string[] = [];
    const seen = new Set<string>();

    const addTitle = (t: string) => {
      if (t && !seen.has(t)) { seen.add(t); titles.push(t); }
    };

    if (data.tfa?.title) addTitle(data.tfa.title);
    data.mostread?.articles?.forEach((a: any) => addTitle(a.title));
    data.news?.forEach((n: any) => n.links?.forEach((l: any) => addTitle(l.title)));
    data.onthisday?.forEach((e: any) => e.pages?.forEach((p: any) => addTitle(p.title)));

    const articles = await getExtracts(titles.slice(0, 40));
    return articles.filter(a => !isBoringArticle(a)).slice(0, 20);
  } catch {
    return getRandomArticles(20);
  }
}

export async function getMostReadArticles(limit: number = 20): Promise<WikiArticle[]> {
  const now = new Date();
  const yesterday = new Date(now.getTime() - 86400000);
  const year = yesterday.getFullYear();
  const month = String(yesterday.getMonth() + 1).padStart(2, '0');
  const day = String(yesterday.getDate()).padStart(2, '0');

  try {
    const res = await fetch(
      `${REST_BASE}/feed/featured/${year}/${month}/${day}`
    );
    if (!res.ok) throw new Error('Feed failed');
    const data = await res.json();
    const titles = data.mostread?.articles
      ?.map((a: any) => a.title)
      .filter((t: string) => !t.startsWith('Special:') && !t.startsWith('Wikipedia:'))
      .slice(0, 40) ?? [];
    const articles = await getExtracts(titles);
    return articles.filter(a => !isBoringArticle(a)).slice(0, limit);
  } catch {
    return [];
  }
}

export const CATEGORIES = [
  { name: 'Science', icon: 'flask', wikiCat: 'Science' },
  { name: 'History', icon: 'landmark', wikiCat: 'History' },
  { name: 'Technology', icon: 'cpu', wikiCat: 'Technology' },
  { name: 'Art', icon: 'palette', wikiCat: 'Art' },
  { name: 'Music', icon: 'music', wikiCat: 'Music' },
  { name: 'Sports', icon: 'trophy', wikiCat: 'Sports' },
  { name: 'Nature', icon: 'leaf', wikiCat: 'Nature' },
  { name: 'Space', icon: 'moon', wikiCat: 'Outer_space' },
  { name: 'Philosophy', icon: 'book-open', wikiCat: 'Philosophy' },
  { name: 'Mathematics', icon: 'hash', wikiCat: 'Mathematics' },
  { name: 'Medicine', icon: 'heart-pulse', wikiCat: 'Medicine' },
  { name: 'Geography', icon: 'globe', wikiCat: 'Geography' },
  { name: 'Literature', icon: 'book', wikiCat: 'Literature' },
  { name: 'Film', icon: 'film', wikiCat: 'Film' },
  { name: 'Psychology', icon: 'brain', wikiCat: 'Psychology' },
  { name: 'Economics', icon: 'trending-up', wikiCat: 'Economics' },
  { name: 'Architecture', icon: 'building', wikiCat: 'Architecture' },
  { name: 'Mythology', icon: 'sparkles', wikiCat: 'Mythology' },
  { name: 'Food', icon: 'utensils', wikiCat: 'Food_and_drink' },
  { name: 'Aviation', icon: 'plane', wikiCat: 'Aviation' },
  { name: 'Ocean', icon: 'waves', wikiCat: 'Oceanography' },
  { name: 'Dinosaurs', icon: 'bone', wikiCat: 'Dinosaurs' },
  { name: 'Inventions', icon: 'lightbulb', wikiCat: 'Inventions' },
  { name: 'Wars', icon: 'swords', wikiCat: 'Wars' },
  { name: 'Languages', icon: 'languages', wikiCat: 'Languages' },
  { name: 'Astronomy', icon: 'telescope', wikiCat: 'Astronomy' },
  { name: 'Chemistry', icon: 'atom', wikiCat: 'Chemistry' },
  { name: 'Biology', icon: 'dna', wikiCat: 'Biology' },
  { name: 'Physics', icon: 'zap', wikiCat: 'Physics' },
  { name: 'Engineering', icon: 'wrench', wikiCat: 'Engineering' },
  { name: 'Photography', icon: 'camera', wikiCat: 'Photography' },
  { name: 'Robotics', icon: 'hardware-chip', wikiCat: 'Robotics' },
  { name: 'Archaeology', icon: 'search', wikiCat: 'Archaeology' },
  { name: 'Gaming', icon: 'game-controller', wikiCat: 'Video_games' },
  { name: 'Crypto', icon: 'logo-bitcoin', wikiCat: 'Cryptocurrency' },
  { name: 'Fashion', icon: 'shirt', wikiCat: 'Fashion' },
  { name: 'Television', icon: 'tv', wikiCat: 'Television' },
  { name: 'Dance', icon: 'walk', wikiCat: 'Dance' },
  { name: 'Volcanoes', icon: 'flame', wikiCat: 'Volcanoes' },
  { name: 'Pirates', icon: 'skull', wikiCat: 'Piracy' },
  { name: 'Espionage', icon: 'eye', wikiCat: 'Espionage' },
  { name: 'Genetics', icon: 'fitness', wikiCat: 'Genetics' },
  { name: 'AI', icon: 'bulb', wikiCat: 'Artificial_intelligence' },
  { name: 'Climate', icon: 'thermometer', wikiCat: 'Climate_change' },
  { name: 'Trains', icon: 'train', wikiCat: 'Rail_transport' },
  { name: 'Comics', icon: 'chatbubbles', wikiCat: 'Comics' },
  { name: 'Olympics', icon: 'medal', wikiCat: 'Olympic_Games' },
  { name: 'Sculpture', icon: 'diamond', wikiCat: 'Sculpture' },
  { name: 'Castles', icon: 'shield', wikiCat: 'Castles' },
  { name: 'Submarines', icon: 'boat', wikiCat: 'Submarines' },
];
