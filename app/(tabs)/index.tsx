import React, { useCallback, useRef, useState } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
  Text,
  TouchableOpacity,
  Platform,
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
  } = useApp();

  const [activeIndex, setActiveIndex] = useState(0);
  const [themeModalVisible, setThemeModalVisible] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const articlesRef = useRef(articles);
  articlesRef.current = articles;

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
    // Use ref for latest articles length to avoid stale closure
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

  return (
    <View style={styles.container}>
      {(feedConfig.category || feedConfig.theme) ? (
        <View style={styles.filterBanner}>
          <Text style={styles.filterText}>{feedConfig.theme ?? feedConfig.category}</Text>
          <TouchableOpacity onPress={resetFeed} style={styles.filterClose}>
            <Ionicons name="close-circle" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      ) : null}
      <TouchableOpacity
        style={styles.themeButton}
        onPress={() => setThemeModalVisible(true)}
      >
        <Ionicons name="sparkles" size={22} color={ACCENT} />
      </TouchableOpacity>
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
          onEndReachedThreshold={2}
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
          maxToRenderPerBatch={3}
          windowSize={5}
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
  footer: {
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
