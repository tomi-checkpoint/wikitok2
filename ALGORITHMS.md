# WikiTok Algorithms

This document explains every algorithm used in WikiTok, where it lives in the codebase, and the logic behind each one.

---

## 1. Content Quality Scorer

**File:** `src/lib/algorithm.ts` — `scoreContentQuality()`

**Purpose:** Scores every Wikipedia article from 0-100 to determine if it's worth showing in the feed.

**How it works:**
- Starts at a base score of 40 (most articles should pass)
- **Extract length bonus:** Articles with 800+ chars get +15, 400+ get +10, 200+ get +5. Longer articles are more substantial.
- **Thumbnail bonus:** +15 if the article has an image. Visual content is critical for a TikTok-style feed.
- **Description bonus:** +5 if the article has a description > 10 chars.
- **Category richness:** 6+ categories = +10, 4+ = +6, 2+ = +3, fewer = -5. Well-connected articles are more interesting.
- **Sentence count:** 5+ sentences = +8, 3+ = +4, fewer = -5. Well-developed articles score higher.
- **Interesting keyword bonus:** Scans for 17 regex patterns covering superlatives ("largest", "oldest"), dramatic events ("assassination", "disaster"), achievements ("Nobel Prize", "world record"), and mystery ("secret", "forbidden"). Each hit adds +4, capped at +20.
- **Hook quality bonus:** Uses the Hook Generator (see below) to score the opening text, adds up to +15.
- **Boilerplate penalty:** Descriptions mentioning "village", "species of", "stub", "disambiguation" get -15 to -30.

**Minimum threshold:** Articles scoring below 20 (or 15 for category/search) are filtered out.

---

## 2. Boring Content Filter

**File:** `src/lib/wikipedia.ts` — `isBoringArticle()`

**Purpose:** Pre-filters articles before they even reach the quality scorer. Catches Wikipedia's vast corpus of mundane entries.

**Three-layer filter:**

### Layer 1: Extract Patterns (70+ regexes)
Matches against article text. Categories of boring content:
- **Geographic boilerplate:** "is a village in", "is a municipality", "census-designated place", "commune in the department of", "unincorporated community"
- **Minor sports figures:** "is a footballer", "is a cricketer", "plays as a midfielder", across all major sports
- **Minor politicians:** "member of parliament", "served in the legislature", "electoral district"
- **Taxonomy stubs:** "species of moth", "genus of beetles", "family of flies", "species of lichen"
- **Wikipedia structural pages:** "list of", "index of", "disambiguation", "timeline of", "glossary of"
- **Miscellaneous:** highways, railway stations, schools, peer-reviewed journals

### Layer 2: Title Patterns (15 regexes)
Catches boring articles by title alone: "List of ...", "... season", "... election", "... (TV series) season ..."

### Layer 3: Description Patterns (10 regexes)
Catches stubs, redirects, Wikimedia internal pages, and taxonomic entries via the description field.

**Minimum extract length:** 200 characters. Anything shorter is rejected.

---

## 3. Hook Generator

**File:** `src/lib/algorithm.ts` — `generateHooks()`, `scoreHookLine()`

**Purpose:** Extracts the most compelling 1-3 sentences from an article to display as the "hook" text on the card.

**How it works:**
1. Splits the article extract into sentences (on `.!?` boundaries)
2. Filters sentences between 20-200 chars
3. Scores each sentence using 8 hook pattern categories:
   - Numbers and statistics
   - Superlatives ("first", "largest", "oldest", "only")
   - Action verbs ("discovered", "invented", "destroyed", "survived")
   - Mystery words ("secret", "ancient", "forbidden", "legendary")
   - Historical dates ("1066 AD", "500 BCE")
   - Scale words ("million", "billion")
   - Dramatic structures ("war", "battle", "empire")
   - Scientific terms ("paradox", "phenomenon", "anomaly")
4. Bonuses for medium-length sentences (8-25 words), questions, and contrasting conjunctions ("but", "however", "surprisingly")
5. Takes top 3 by score, re-sorts by original position to maintain narrative flow

---

## 4. Preference Learning Engine

**File:** `src/lib/preferences.ts`

**Purpose:** Learns what the user likes over time, entirely locally with zero API calls.

**How it works:**
- When the user taps the heart button, the article's Wikipedia categories are extracted
- `recordLike(categories)` increments a weight counter for each category in AsyncStorage
- Weights are cached in memory (`cachedWeights`) so the hot path is synchronous
- `getWeightedRandomCategory()` picks a preferred category using weighted random selection — categories with more likes are more likely to be chosen
- `getTopCategories(n)` returns the user's top N interests
- **Activation threshold:** A category needs at least 2 likes before it influences the feed (prevents accidental single-tap bias)

**Storage:** Single AsyncStorage key (`wikitok_category_weights`) containing a JSON object of `{ categoryName: likeCount }`. Fire-and-forget writes so the UI never blocks.

---

## 5. Feed Builder

**File:** `src/lib/algorithm.ts` — `buildFeed()`

**Purpose:** Orchestrates all content sources into a ranked, deduplicated, diverse feed.

**Three operating modes:**

### Mode 1: Home Feed (no filter active)
Makes 2-3 parallel Wikipedia API calls:
1. **Random articles** (`getRandomArticles`) — discovery content, scored by quality
2. **Trending/most-read** (`getMostReadArticles`) — Wikipedia's daily popular articles, +8 score boost
3. **Preference-based** (only if user has liked enough articles) — `getWeightedRandomCategory()` picks a category, articles from that category get +15 score boost and show as "For You"

### Mode 2: Category Feed (from Explore tab)
Two parallel calls:
1. `getArticlesByCategory()` — direct category API
2. `searchArticles()` — search fallback for broader results
Falls back to random if not enough results.

### Mode 3: Search/Theme Feed (from Knowledge Trails)
Single call to `searchArticles()` with the theme query. Results get +20 score boost to rank above any random filler. Random limited to 20% of feed to keep it relevant.

**Post-processing pipeline:**
1. **Dedup by page ID** — keeps highest-scoring version
2. **Dedup by normalized title** — strips parentheticals and punctuation to catch near-duplicates like "Battle of Gettysburg" vs "Battle of Gettysburg (1863)"
3. **Minimum quality filter** — rejects articles below score threshold
4. **Score-based ranking** — sorts by score with +-5 random jitter to prevent staleness
5. **Diversity filter** — max 2 consecutive same-category articles, session fatigue reduction after 5+ articles from same category

---

## 6. Diversity Controller

**File:** `src/lib/algorithm.ts` — `enforceDiversity()`

**Purpose:** Prevents the feed from becoming monotonous by limiting category repetition.

**Rules:**
- Maximum 2 consecutive articles from the same category in the output
- Tracks a sliding window of the last 5 categories shown
- Session-level fatigue: after 5+ articles from the same category in one session, randomly skips 50% of additional articles from that category
- Maintains an in-memory session state (`SessionState`) with category counts and article totals

---

## 7. Interest Profile Engine

**File:** `src/lib/algorithm.ts` — `updateInterestProfile()`

**Purpose:** Maintains a weighted interest profile that decays over time.

**Interaction weights:**
| Action | Weight |
|--------|--------|
| View | +1 |
| Dwell (3+ seconds) | +2 |
| Read full article | +3 |
| Share | +4 |
| Save/bookmark | +5 |
| Dislike | -3 |

**Time decay:** Uses a 7-day half-life exponential decay. An interest's effective weight halves every 7 days without reinforcement. This ensures the feed evolves with the user's changing interests.

**Pruning:** Interests below weight 0.5 are removed. Maximum 30 interests tracked.

---

## 8. Deep Dive (Related Article Exploration)

**File:** `src/store/AppContext.tsx` — `diveDeeper()`

**Purpose:** When the user toggles the boat icon, loads articles related to the current one.

**How it works:**
1. Two parallel API calls: `getRelatedArticles(title)` and `getArticleLinks(title)`
2. Merges results, deduplicates by page ID
3. Filters: must have extract > 100 chars, not already in the feed
4. Processes into `ProcessedArticle` with sourceType `'related'`
5. Appends to the existing articles array
6. Feed screen tracks a `diveCount` that increments as the user views each related article
7. Toggling the boat off resets the counter and returns to the normal algorithm

---

## 9. Wikipedia API Rate Limiter

**File:** `src/lib/wikipedia.ts` — `fetchJSON()`

**Purpose:** Prevents Wikipedia from rate-limiting the app.

**Mechanism:**
- **Concurrency limit:** Max 2 simultaneous requests
- **Minimum gap:** 200ms between requests
- **Retry with backoff:** On HTTP 429, waits 2-4 seconds and retries (max 2 retries)
- **User-Agent header:** All requests include `Api-User-Agent: WikiTokApp/1.0` as required by Wikipedia's API policy
- **Request queuing:** If at max concurrency, new requests wait 100ms and check again

---

## 10. Knowledge Trails (Themed Search)

**File:** `src/lib/wikipedia.ts` — `searchArticles()`

**Purpose:** Powers the "Knowledge Trail" feature where users explore themed topics like "Secret Societies" or "Ancient Civilizations".

**Dual search strategy:**
1. **Keyword search** (`list=search`): Direct title/content matching, 20 results
2. **Semantic search** (`generator=search`): Wikipedia's semantic matching with extracts and thumbnails included in a single API call, 20 results
3. Both run in parallel, results merged and deduplicated by page ID
4. Boring articles filtered out before returning

The feed builder gives search results a +20 score boost so they dominate the themed feed, with random articles limited to at most 20% filler.

---

## Data Flow Summary

```
User opens app
    → buildFeed() called with feedConfig
    → 2-3 parallel Wikipedia API calls (rate-limited)
    → Articles scored by scoreContentQuality()
    → Boring articles filtered by isBoringArticle()
    → Hooks generated by generateHooks()
    → Deduplicated, quality-filtered, diversity-enforced
    → Rendered in FlatList with pagingEnabled

User taps heart
    → recordLike(categories) updates local weights
    → Next buildFeed() call picks preferred category via getWeightedRandomCategory()
    → "For You" articles appear with +15 boost

User toggles deep dive
    → diveDeeper() loads related articles
    → Counter tracks viewed related articles
    → Toggling off returns to normal feed
```
