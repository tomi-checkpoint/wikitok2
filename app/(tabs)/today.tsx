import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
  Text,
  Platform,
} from 'react-native';
import { getTodaysArticles } from '../../src/lib/wikipedia';
import { WikiArticle, ProcessedArticle } from '../../src/types';
import Card from '../../src/components/Card';

const ACCENT = '#38BDF8';
const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function TodayScreen() {
  const [articles, setArticles] = useState<ProcessedArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);
  const articlesRef = useRef(articles);
  articlesRef.current = articles;

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
        console.error('Today load error:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

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

  const scrollToNext = useCallback((index: number) => {
    const nextIndex = index + 1;
    if (flatListRef.current && nextIndex < articlesRef.current.length) {
      try {
        flatListRef.current.scrollToIndex({ index: nextIndex, animated: true });
      } catch (_) {
        // Index out of range - ignore
      }
    }
  }, []);

  const renderItem = useCallback(
    ({ item, index }: { item: ProcessedArticle; index: number }) => (
      <Card
        article={item}
        isActive={index === activeIndex}
        onSwipeComplete={() => scrollToNext(index)}
      />
    ),
    [activeIndex, scrollToNext]
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

  return (
    <View style={styles.container}>
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
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#9CA3AF',
    fontSize: 14,
    marginTop: 12,
  },
});
