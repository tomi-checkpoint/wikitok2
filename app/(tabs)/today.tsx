import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
  Text,
  TouchableOpacity,
  Pressable,
  Platform,
  Image,
  Animated,
  Share,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getTodaysArticles } from '../../src/lib/wikipedia';
import { WikiArticle, ProcessedArticle } from '../../src/types';
import { useApp } from '../../src/store/AppContext';
import Card from '../../src/components/Card';
import { recordLike } from '../../src/lib/preferences';

const ACCENT = '#38BDF8';
const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function TodayScreen() {
  const { addToHistory, diveDeeper, saveArticle, unsaveArticle, isSaved, viewArticle, recordDwell, dislikeArticle } = useApp();
  const [articles, setArticles] = useState<ProcessedArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const [liked, setLiked] = useState(false);
  const [diveActive, setDiveActive] = useState(false);
  const [diveCount, setDiveCount] = useState(0);
  const flatListRef = useRef<FlatList>(null);
  const articlesRef = useRef(articles);
  articlesRef.current = articles;
  const seenRef = useRef(new Set<number>());
  const textFade = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    (async () => {
      try {
        const today = await getTodaysArticles();
        const processed: ProcessedArticle[] = today.map((item, i) => ({
          ...item,
          hookLines: [item.extract.split('.')[0] + '.'],
          score: 80,
          sourceType: i === 0 ? 'interest' as const : ['trending', 'related', 'random', 'serendipity'][i % 4] as any,
          timestamp: new Date().toISOString(),
        }));
        setArticles(processed);
      } catch (err) {
        if (__DEV__) console.warn('Today load error:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (articles.length > 0 && activeIndex < articles.length) {
      const article = articles[activeIndex];
      if (article && !seenRef.current.has(article.pageid)) {
        seenRef.current.add(article.pageid);
        addToHistory(article);
        if (diveActive && article.sourceType === 'related') {
          setDiveCount(c => c + 1);
        }
      }
    }
  }, [activeIndex, articles, diveActive]);

  useEffect(() => {
    setLiked(false);
    textFade.setValue(0);
    Animated.timing(textFade, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  }, [activeIndex]);

  useEffect(() => {
    for (let i = activeIndex + 1; i <= activeIndex + 3 && i < articles.length; i++) {
      const thumb = articles[i]?.thumbnail;
      if (thumb) Image.prefetch(thumb).catch(() => {});
    }
  }, [activeIndex, articles]);

  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: any) => {
      if (viewableItems.length > 0) {
        setActiveIndex(viewableItems[0].index ?? 0);
      }
    },
    []
  );

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 60 }).current;

  const scrollToNext = useCallback((index: number) => {
    const nextIndex = index + 1;
    if (flatListRef.current && nextIndex < articlesRef.current.length) {
      try { flatListRef.current.scrollToIndex({ index: nextIndex, animated: true }); } catch (_) {}
    }
  }, []);

  const renderItem = useCallback(
    ({ item, index }: { item: ProcessedArticle; index: number }) => (
      <Card article={item} isActive={index === activeIndex} />
    ),
    [activeIndex]
  );

  const keyExtractor = useCallback((item: ProcessedArticle) => String(item.pageid), []);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={ACCENT} />
        <Text style={styles.loadingText}>Loading today's articles...</Text>
      </View>
    );
  }

  const currentArticle = articles.length > 0 && activeIndex < articles.length ? articles[activeIndex] : null;
  const currentSaved = currentArticle ? isSaved(currentArticle.pageid) : false;

  return (
    <View style={styles.container}>
      {/* Dive counter overlay */}
      {diveActive ? (
        <View style={styles.diveActiveBar}>
          <Ionicons name="boat" size={16} color="#fff" style={{ marginRight: 6 }} />
          <Text style={styles.diveActiveText}>Deep Dive</Text>
          <View style={styles.diveActiveCount}>
            <Text style={styles.diveActiveCountText}>{diveCount}</Text>
          </View>
          <TouchableOpacity onPress={() => { setDiveActive(false); setDiveCount(0); }} style={{ marginLeft: 8 }}>
            <Ionicons name="close-circle" size={18} color="rgba(255,255,255,0.7)" />
          </TouchableOpacity>
        </View>
      ) : null}

      <FlatList
        ref={flatListRef}
        data={articles}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        snapToInterval={SCREEN_HEIGHT}
        snapToAlignment="start"
        decelerationRate="fast"
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        getItemLayout={(_, index) => ({
          length: SCREEN_HEIGHT,
          offset: SCREEN_HEIGHT * index,
          index,
        })}
        removeClippedSubviews={Platform.OS !== 'web'}
        maxToRenderPerBatch={3}
        windowSize={5}
      />

      {/* Static sidebar */}
      {currentArticle ? (
        <View style={styles.staticSidebar} pointerEvents="box-none">
          <TouchableOpacity style={styles.sidebarItem} onPress={() => { if (!liked) { setLiked(true); recordDwell(currentArticle, 5000); if (currentArticle.categories) recordLike(currentArticle.categories); } }} activeOpacity={0.7}>
            <Ionicons name={liked ? 'heart' : 'heart-outline'} size={30} color={liked ? '#EF4444' : '#fff'} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.sidebarItem} onPress={() => { if (currentSaved) unsaveArticle(currentArticle.pageid); else saveArticle(currentArticle); }} activeOpacity={0.7}>
            <Ionicons name={currentSaved ? 'bookmark' : 'bookmark-outline'} size={28} color={currentSaved ? '#FBBF24' : '#fff'} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.sidebarItem} onPress={async () => {
            if (diveActive) { setDiveActive(false); setDiveCount(0); return; }
            setDiveActive(true); setDiveCount(0);
            await diveDeeper(currentArticle);
            const idx = articlesRef.current.findIndex(a => a.pageid === currentArticle.pageid);
            if (idx >= 0) setTimeout(() => scrollToNext(idx), 800);
          }} activeOpacity={0.7}>
            <Ionicons name="boat" size={28} color={diveActive ? ACCENT : '#fff'} />
          </TouchableOpacity>
          <Pressable style={styles.sidebarItem} onPress={() => {
            const url = `https://en.wikipedia.org/wiki/${encodeURIComponent(currentArticle.title)}`;
            const text = `Check out "${currentArticle.title}" on WikiTok!`;
            if (Platform.OS === 'web' && navigator.share) navigator.share({ title: currentArticle.title, text, url }).catch(() => {});
            else if (Platform.OS === 'web' && navigator.clipboard) navigator.clipboard.writeText(`${text}\n${url}`).catch(() => {});
            else Share.share({ message: `${text}\n${url}`, url }).catch(() => {});
          }}>
            <Ionicons name="arrow-redo" size={28} color="#fff" />
          </Pressable>
        </View>
      ) : null}

      {/* Static bottom text */}
      {currentArticle ? (
        <Animated.View style={[styles.staticBottomContent, { opacity: textFade, transform: [{ translateY: textFade.interpolate({ inputRange: [0, 1], outputRange: [15, 0] }) }] }]} pointerEvents="box-none">
          <TouchableOpacity onPress={() => viewArticle(currentArticle)} activeOpacity={0.9}>
            <Text style={styles.articleTitle} numberOfLines={2}>{currentArticle.title}</Text>
            {currentArticle.description ? <Text style={styles.articleDescription} numberOfLines={1}>{currentArticle.description}</Text> : null}
            <Text style={styles.articleExtract} numberOfLines={2}>{currentArticle.hookLines?.[0] || currentArticle.extract}</Text>
            <Text style={styles.articleTapHint}>Tap to read full article</Text>
          </TouchableOpacity>
        </Animated.View>
      ) : null}
    </View>
  );
}

const TAB_BAR_HEIGHT = Platform.OS === 'ios' ? 75 : 52;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  loadingContainer: { flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: '#9CA3AF', fontSize: 14, marginTop: 12 },
  staticSidebar: {
    position: 'absolute',
    right: 8,
    bottom: TAB_BAR_HEIGHT + 120,
    alignItems: 'center',
    zIndex: 50,
  },
  sidebarItem: { alignItems: 'center', marginBottom: 20 },
  staticBottomContent: {
    position: 'absolute',
    bottom: TAB_BAR_HEIGHT + 16,
    left: 12,
    right: 70,
    zIndex: 50,
  },
  articleTitle: {
    color: '#fff', fontSize: 18, fontWeight: '800', marginBottom: 4, lineHeight: 22,
    textShadowColor: 'rgba(0,0,0,0.9)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4,
  },
  articleDescription: {
    color: '#D1D5DB', fontSize: 13, marginBottom: 4, fontStyle: 'italic',
    textShadowColor: 'rgba(0,0,0,0.8)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3,
  },
  articleExtract: {
    color: '#E5E7EB', fontSize: 14, lineHeight: 19,
    textShadowColor: 'rgba(0,0,0,0.8)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3,
  },
  articleTapHint: { color: '#38BDF8', fontSize: 12, fontWeight: '600', marginTop: 6 },
  diveActiveBar: {
    position: 'absolute', top: Platform.OS === 'ios' ? 54 : 12,
    left: 16, right: 16, zIndex: 55,
    backgroundColor: 'rgba(6, 182, 212, 0.9)', borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 8, flexDirection: 'row', alignItems: 'center',
  },
  diveActiveText: { color: '#fff', fontSize: 14, fontWeight: '600', flex: 1 },
  diveActiveCount: { backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 2 },
  diveActiveCountText: { color: '#fff', fontSize: 13, fontWeight: '700' },
});
