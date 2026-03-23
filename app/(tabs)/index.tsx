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
import { useApp } from '../../src/store/AppContext';
import Card from '../../src/components/Card';
import ThemeModal from '../../src/components/ThemeModal';
import { ProcessedArticle } from '../../src/types';
import { recordLike, loadWeights } from '../../src/lib/preferences';
import { useIsFocused } from '@react-navigation/native';

const ACCENT = '#38BDF8';
const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function FeedScreen() {
  const {
    articles,
    loading,
    loadMore,
    feedConfig,
    resetFeed,
    diveDeeper,
    addToHistory,
    saveArticle,
    unsaveArticle,
    isSaved,
    viewArticle,
    recordDwell,
  } = useApp();

  const [liked, setLiked] = useState(false);

  const [activeIndex, setActiveIndex] = useState(0);
  const [themeModalVisible, setThemeModalVisible] = useState(false);
  const isFocused = useIsFocused();

  // Close modal when navigating away from Feed tab
  useEffect(() => {
    if (!isFocused && themeModalVisible) {
      setThemeModalVisible(false);
    }
  }, [isFocused]);
  const [diveBanner, setDiveBanner] = useState<string | null>(null);
  const [diveActive, setDiveActive] = useState(false);
  const [diveCount, setDiveCount] = useState(0);
  const diveBannerOpacity = useRef(new Animated.Value(0)).current;
  const flatListRef = useRef<FlatList>(null);
  const articlesRef = useRef(articles);
  articlesRef.current = articles;
  const seenRef = useRef(new Set<number>());

  // Load preference weights on mount
  useEffect(() => { loadWeights(); }, []);

  // Track articles as "seen" when they become active (for recent history)
  useEffect(() => {
    if (articles.length > 0 && activeIndex < articles.length) {
      const article = articles[activeIndex];
      if (article && !seenRef.current.has(article.pageid)) {
        seenRef.current.add(article.pageid);
        addToHistory(article);
        // Increment dive counter when viewing related articles during a dive
        if (diveActive && article.sourceType === 'related') {
          setDiveCount(c => c + 1);
        }
      }
    }
  }, [activeIndex, articles, diveActive]);

  // Reset liked state and animate text when scrolling to new article
  const textFade = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    setLiked(false);
    // Fade in text
    textFade.setValue(0);
    Animated.timing(textFade, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  }, [activeIndex]);

  // Prefetch next few images
  useEffect(() => {
    for (let i = activeIndex + 1; i <= activeIndex + 3 && i < articles.length; i++) {
      const thumb = articles[i]?.thumbnail;
      if (thumb) {
        Image.prefetch(thumb).catch(() => {});
      }
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

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 60,
  }).current;

  const handleEndReached = useCallback(() => {
    if (!loading) loadMore();
  }, [loading, loadMore]);

  const scrollToNext = useCallback((index: number) => {
    const nextIndex = index + 1;
    if (flatListRef.current && nextIndex < articlesRef.current.length) {
      try {
        flatListRef.current.scrollToIndex({ index: nextIndex, animated: true });
      } catch (_) {}
    }
  }, []);

  const handleDiveDeeper = useCallback(async (article: ProcessedArticle) => {
    if (diveActive) {
      // Toggle OFF — deactivate dive mode
      setDiveActive(false);
      setDiveCount(0);
      setDiveBanner('Dive ended');
      diveBannerOpacity.setValue(0);
      Animated.sequence([
        Animated.timing(diveBannerOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.delay(1000),
        Animated.timing(diveBannerOpacity, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]).start(() => setDiveBanner(null));
      return;
    }

    // Toggle ON — activate dive mode
    setDiveActive(true);
    setDiveCount(0);
    const topic = article.title;
    setDiveBanner(`Diving into: ${topic}`);
    diveBannerOpacity.setValue(0);
    Animated.sequence([
      Animated.timing(diveBannerOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.delay(1500),
      Animated.timing(diveBannerOpacity, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start(() => setDiveBanner(null));

    await diveDeeper(article);

    const currentIndex = articlesRef.current.findIndex(a => a.pageid === article.pageid);
    if (currentIndex >= 0) {
      setTimeout(() => scrollToNext(currentIndex), 800);
    }
  }, [diveDeeper, scrollToNext, diveActive]);

  const renderItem = useCallback(
    ({ item, index }: { item: ProcessedArticle; index: number }) => (
      <Card article={item} isActive={index === activeIndex} />
    ),
    [activeIndex]
  );

  const keyExtractor = useCallback((item: ProcessedArticle) => String(item.pageid), []);

  return (
    <View style={styles.container}>
      {/* Category/theme filter banner */}
      {(feedConfig.category || feedConfig.theme) ? (
        <View style={styles.filterBanner}>
          <Text style={styles.filterText}>{feedConfig.theme ?? feedConfig.category}</Text>
          <TouchableOpacity onPress={() => { resetFeed(); setDiveActive(false); setDiveCount(0); }} style={styles.filterClose}>
            <Ionicons name="close-circle" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      ) : null}

      {/* Sparkles / Knowledge Trail button */}
      <TouchableOpacity
        style={styles.themeButton}
        onPress={() => setThemeModalVisible(true)}
      >
        <Ionicons name="sparkles" size={22} color={ACCENT} />
      </TouchableOpacity>

      {/* Dive deeper banner animation */}
      {diveBanner ? (
        <Animated.View style={[styles.diveBanner, { opacity: diveBannerOpacity }]}>
          <Ionicons name="boat" size={20} color="#fff" style={{ marginRight: 8 }} />
          <Text style={styles.diveBannerText}>{diveBanner}</Text>
        </Animated.View>
      ) : null}

      {/* Persistent dive counter when active */}
      {diveActive && !diveBanner ? (
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

      {articles.length === 0 && loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={ACCENT} />
          <Text style={styles.loadingText}>Discovering articles...</Text>
        </View>
      ) : (
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
          onEndReached={handleEndReached}
          onEndReachedThreshold={3}
          getItemLayout={(_, index) => ({
            length: SCREEN_HEIGHT,
            offset: SCREEN_HEIGHT * index,
            index,
          })}
          ListFooterComponent={
            loading ? (
              <View style={styles.footer}>
                <ActivityIndicator size="small" color={ACCENT} />
              </View>
            ) : null
          }
          removeClippedSubviews={Platform.OS !== 'web'}
          maxToRenderPerBatch={5}
          windowSize={7}
          initialNumToRender={3}
        />
      )}
      {/* ── STATIC SIDEBAR OVERLAY ── */}
      {articles.length > 0 && activeIndex < articles.length ? (() => {
        const currentArticle = articles[activeIndex];
        if (!currentArticle) return null;
        const currentSaved = isSaved(currentArticle.pageid);
        const isDiving = diveActive && diveCount > 0;

        const handleSidebarLike = () => {
          if (!liked) {
            setLiked(true);
            recordDwell(currentArticle, 5000);
            // Record categories for preference learning (local, no API call)
            if (currentArticle.categories) {
              recordLike(currentArticle.categories);
            }
          }
        };
        const handleSidebarSave = () => {
          if (currentSaved) unsaveArticle(currentArticle.pageid);
          else saveArticle(currentArticle);
        };
        const handleSidebarShare = () => {
          const url = `https://en.wikipedia.org/wiki/${encodeURIComponent(currentArticle.title)}`;
          const text = `Check out "${currentArticle.title}" on WikiTok!`;
          if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.share) {
            navigator.share({ title: currentArticle.title, text, url }).catch(() => {});
          } else if (Platform.OS === 'web' && navigator.clipboard) {
            navigator.clipboard.writeText(`${text}\n${url}`).catch(() => {});
          } else {
            Share.share({ message: `${text}\n${url}`, url }).catch(() => {});
          }
        };

        return (
          <View style={styles.staticSidebar} pointerEvents="box-none">
            <TouchableOpacity style={styles.sidebarItem} onPress={handleSidebarLike} activeOpacity={0.7}>
              <Ionicons name={liked ? 'heart' : 'heart-outline'} size={30} color={liked ? '#EF4444' : '#fff'} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.sidebarItem} onPress={handleSidebarSave} activeOpacity={0.7}>
              <Ionicons name={currentSaved ? 'bookmark' : 'bookmark-outline'} size={28} color={currentSaved ? '#FBBF24' : '#fff'} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.sidebarItem} onPress={() => handleDiveDeeper(currentArticle)} activeOpacity={0.7}>
              <Ionicons name="boat" size={28} color={diveActive ? ACCENT : '#fff'} />
            </TouchableOpacity>
            <Pressable style={styles.sidebarItem} onPress={handleSidebarShare}>
              <Ionicons name="arrow-redo" size={28} color="#fff" />
            </Pressable>
            {isDiving ? (
              <View style={styles.diveCountBadge}>
                <Text style={styles.diveCountText}>{diveCount}</Text>
              </View>
            ) : null}
          </View>
        );
      })() : null}

      {/* ── STATIC BOTTOM TEXT OVERLAY ── */}
      {articles.length > 0 && activeIndex < articles.length && articles[activeIndex] ? (
        <Animated.View style={[styles.staticBottomContent, { opacity: textFade, transform: [{ translateY: textFade.interpolate({ inputRange: [0, 1], outputRange: [15, 0] }) }] }]} pointerEvents="box-none">
          <TouchableOpacity onPress={() => viewArticle(articles[activeIndex])} activeOpacity={0.9}>
            <Text style={styles.articleTitle} numberOfLines={2}>{articles[activeIndex].title}</Text>
            {articles[activeIndex].description ? (
              <Text style={styles.articleDescription} numberOfLines={1}>{articles[activeIndex].description}</Text>
            ) : null}
            <Text style={styles.articleExtract} numberOfLines={2}>{articles[activeIndex].hookLines?.[0] || articles[activeIndex].extract}</Text>
            <Text style={styles.articleTapHint}>Tap to read full article</Text>
          </TouchableOpacity>
        </Animated.View>
      ) : null}

      <ThemeModal
        visible={themeModalVisible}
        onClose={() => setThemeModalVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#9CA3AF',
    fontSize: 14,
    marginTop: 12,
  },
  filterBanner: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 54 : 12,
    left: 16,
    right: 16,
    zIndex: 50,
    backgroundColor: 'rgba(56, 189, 248, 0.9)',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  filterText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  filterClose: {
    padding: 2,
  },
  themeButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 100 : 58,
    right: 16,
    zIndex: 50,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 20,
    padding: 10,
  },
  diveBanner: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 54 : 12,
    left: 16,
    right: 16,
    zIndex: 60,
    backgroundColor: 'rgba(6, 182, 212, 0.9)',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  diveBannerText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  footer: {
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  staticSidebar: {
    position: 'absolute',
    right: 8,
    bottom: (Platform.OS === 'ios' ? 75 : 52) + 120,
    alignItems: 'center',
    zIndex: 50,
  },
  sidebarItem: {
    alignItems: 'center',
    marginBottom: 20,
  },
  diveCountBadge: {
    backgroundColor: ACCENT,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginTop: -10,
  },
  diveCountText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  diveActiveBar: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 54 : 12,
    left: 16,
    right: 16,
    zIndex: 55,
    backgroundColor: 'rgba(6, 182, 212, 0.9)',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  diveActiveText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  diveActiveCount: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 2,
  },
  diveActiveCountText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  staticBottomContent: {
    position: 'absolute',
    bottom: (Platform.OS === 'ios' ? 75 : 52) + 16,
    left: 12,
    right: 70,
    zIndex: 50,
  },
  articleTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 4,
    lineHeight: 22,
    textShadowColor: 'rgba(0,0,0,0.9)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  articleDescription: {
    color: '#D1D5DB',
    fontSize: 13,
    marginBottom: 4,
    fontStyle: 'italic',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  articleExtract: {
    color: '#E5E7EB',
    fontSize: 14,
    lineHeight: 19,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  articleTapHint: {
    color: ACCENT,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 6,
  },
});
