import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  Image,
  Platform,
} from 'react-native';
import { ProcessedArticle } from '../types';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const SOURCE_LABELS: Record<string, string> = {
  random: 'Discover',
  interest: 'For You',
  trending: 'Trending',
  category: 'Category',
  search: 'Search',
  related: 'Related',
  bridge: 'Knowledge Bridge',
  serendipity: 'Surprise',
};

const SOURCE_COLORS: Record<string, string> = {
  random: '#6B7280',
  interest: '#38BDF8',
  trending: '#EF4444',
  category: '#3B82F6',
  search: '#10B981',
  related: '#F59E0B',
  bridge: '#EC4899',
  serendipity: '#06B6D4',
};

interface CardProps {
  article: ProcessedArticle;
  isActive: boolean;
}

export default React.memo(function Card({ article, isActive }: CardProps) {
  const sourceLabel = SOURCE_LABELS[article.sourceType] ?? 'Discover';
  const sourceColor = SOURCE_COLORS[article.sourceType] ?? '#6B7280';

  return (
    <View style={styles.container}>
      {article.thumbnail ? (
        <Image source={{ uri: article.thumbnail }} style={styles.backgroundImage} resizeMode="cover" />
      ) : null}
      <View
        style={[
          styles.gradient,
          Platform.OS === 'web' ? {
            backgroundImage: 'linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.15) 30%, rgba(0,0,0,0.7) 65%, rgba(0,0,0,0.95) 85%, #000 100%)',
          } as any : null,
        ]}
      />

      {/* Source badge */}
      <View style={[styles.sourceBadge, { backgroundColor: sourceColor }]}>
        <Text style={styles.sourceBadgeText}>{sourceLabel}</Text>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    backgroundColor: '#000',
  },
  backgroundImage: {
    ...StyleSheet.absoluteFillObject,
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  gradient: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Platform.OS === 'web' ? 'transparent' : 'rgba(0,0,0,0.4)',
  },
  sourceBadge: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 58 : 16,
    left: 16,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    zIndex: 10,
  },
  sourceBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
