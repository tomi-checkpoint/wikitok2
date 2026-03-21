import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
  Text,
  TouchableOpacity,
  Platform,
  Image,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../src/store/AppContext';
import Card from '../../src/components/Card';
import ThemeModal from '../../src/components/ThemeModal';
import { ProcessedArticle } from '../../src/types';

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
  } = useApp();

  const [activeIndex, setActiveIndex] = useState(0);
  const [themeModalVisible, setThemeModalVisible] = useState(false);
  const [diveBanner, setDiveBanner] = useState<string | null>(null);
  const diveBannerOpacity = useRef(new Animated.Value(0)).current;
  const flatListRef = useRef<FlatList>(null);
  const articlesRef = useRef(articles);
  articlesRef.current = articles;
  const seenRef = useRef(new Set<number>());

  // Track articles as "seen" when they become active (for recent history)
  useEffect(() => {
    if (articles.length > 0 && activeIndex < articles.length) {
      const article = articles[activeIndex];
      if (article && !seenRef.current.has(article.pageid)) {
        seenRef.current.add(article.pageid);
        // Record as viewed for history (lightweight - no modal open)
        addToHistory(article);
      }
    }
  }, [activeIndex, articles]);

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
    // Show banner with topic name
    const topic = article.title;
    setDiveBanner(`Diving into: ${topic}`);
    diveBannerOpacity.setValue(0);
    Animated.sequence([
      Animated.timing(diveBannerOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.delay(1500),
      Animated.timing(diveBannerOpacity, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start(() => setDiveBanner(null));

    // Load related articles
    await diveDeeper(article);

    // Advance to next article
    const currentIndex = articlesRef.current.findIndex(a => a.pageid === article.pageid);
    if (currentIndex >= 0) {
      setTimeout(() => scrollToNext(currentIndex), 800);
    }
  }, [diveDeeper, scrollToNext]);

  const renderItem = useCallback(
    ({ item, index }: { item: ProcessedArticle; index: number }) => (
      <Card
        article={item}
        isActive={index === activeIndex}
        onSwipeComplete={() => scrollToNext(index)}
        onDiveDeeper={handleDiveDeeper}
      />
    ),
    [activeIndex, scrollToNext, handleDiveDeeper]
  );

  const keyExtractor = useCallback((item: ProcessedArticle) => String(item.pageid), []);

  return (
    <View style={styles.container}>
      {/* Category/theme filter banner */}
      {(feedConfig.category || feedConfig.theme) ? (
        <View style={styles.filterBanner}>
          <Text style={styles.filterText}>{feedConfig.theme ?? feedConfig.category}</Text>
          <TouchableOpacity onPress={resetFeed} style={styles.filterClose}>
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
});
