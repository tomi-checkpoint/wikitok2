import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  Image,
  Animated,
  PanResponder,
  Platform,
  Share,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ProcessedArticle } from '../types';
import { useApp } from '../store/AppContext';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const ACCENT = '#38BDF8';
const SWIPE_THRESHOLD = 50;
const SWIPE_VELOCITY_THRESHOLD = 0.3;

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
  interest: ACCENT,
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
  onSwipeComplete?: () => void;
  onDiveDeeper?: (article: ProcessedArticle) => void;
}

export default function Card({ article, isActive, onSwipeComplete, onDiveDeeper }: CardProps) {
  const {
    saveArticle,
    unsaveArticle,
    dislikeArticle,
    viewArticle,
    isSaved,
    recordDwell,
  } = useApp();
  const saved = isSaved(article.pageid);
  const dwellStart = useRef<number>(0);
  const [liked, setLiked] = useState(false);

  const translateX = useRef(new Animated.Value(0)).current;
  const heartScale = useRef(new Animated.Value(0)).current;
  const dislikeScale = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isActive) {
      dwellStart.current = Date.now();
      translateX.setValue(0);
    } else if (dwellStart.current > 0) {
      const duration = Date.now() - dwellStart.current;
      recordDwell(article, duration);
      dwellStart.current = 0;
    }
  }, [isActive]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gs) => {
        return Math.abs(gs.dx) > 12 && Math.abs(gs.dx) > Math.abs(gs.dy) * 1.5;
      },
      onPanResponderGrant: () => {
        translateX.stopAnimation();
      },
      onPanResponderMove: (_, gs) => {
        translateX.setValue(gs.dx);
      },
      onPanResponderRelease: (_, gs) => {
        const swipedRight = gs.dx > SWIPE_THRESHOLD || (gs.vx > SWIPE_VELOCITY_THRESHOLD && gs.dx > 20);
        const swipedLeft = gs.dx < -SWIPE_THRESHOLD || (gs.vx < -SWIPE_VELOCITY_THRESHOLD && gs.dx < -20);

        if (swipedRight) {
          // Like animation - show heart then advance
          showHeartAnimation();
          translateX.setValue(0);
          setLiked(true);
          recordDwell(article, 5000);
          if (onSwipeComplete) setTimeout(() => onSwipeComplete(), 600);
        } else if (swipedLeft) {
          // Dislike animation - show X then advance
          showDislikeAnimation();
          translateX.setValue(0);
          setTimeout(() => {
            dislikeArticle(article);
          }, 600);
        } else {
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true,
            tension: 120,
            friction: 8,
          }).start();
        }
      },
      onPanResponderTerminate: () => {
        Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start();
      },
    })
  ).current;

  const showHeartAnimation = () => {
    heartScale.setValue(0);
    Animated.sequence([
      Animated.spring(heartScale, {
        toValue: 1.2,
        useNativeDriver: true,
        tension: 100,
        friction: 5,
      }),
      Animated.timing(heartScale, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const showDislikeAnimation = () => {
    dislikeScale.setValue(0);
    Animated.sequence([
      Animated.spring(dislikeScale, {
        toValue: 1.2,
        useNativeDriver: true,
        tension: 100,
        friction: 5,
      }),
      Animated.timing(dislikeScale, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handleLike = () => {
    if (!liked) {
      setLiked(true);
      showHeartAnimation();
      recordDwell(article, 5000);
    }
  };

  const handleSave = () => {
    if (saved) {
      unsaveArticle(article.pageid);
    } else {
      saveArticle(article);
    }
  };

  const handleDiveDeeper = () => {
    if (onDiveDeeper) {
      onDiveDeeper(article);
    }
  };

  const handleShare = async () => {
    const url = `https://en.wikipedia.org/wiki/${encodeURIComponent(article.title)}`;
    try {
      await Share.share({
        message: `Check out "${article.title}" on WikiTok!\n${url}`,
        url: url,
      });
    } catch (_) {}
  };

  const openArticle = () => {
    viewArticle(article);
  };

  const sourceLabel = SOURCE_LABELS[article.sourceType] ?? 'Discover';
  const sourceColor = SOURCE_COLORS[article.sourceType] ?? '#6B7280';

  const cardRotate = translateX.interpolate({
    inputRange: [-SCREEN_WIDTH, 0, SCREEN_WIDTH],
    outputRange: ['-5deg', '0deg', '5deg'],
    extrapolate: 'clamp',
  });

  return (
    <Animated.View
      style={[
        styles.container,
        { transform: [{ translateX }, { rotate: cardRotate }] },
      ]}
      {...panResponder.panHandlers}
    >
      {/* Background image */}
      {article.thumbnail ? (
        <Image
          source={{ uri: article.thumbnail }}
          style={styles.backgroundImage}
          resizeMode="cover"
        />
      ) : null}
      <View
        style={[
          styles.gradient,
          Platform.OS === 'web' ? {
            backgroundImage: 'linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.15) 30%, rgba(0,0,0,0.7) 65%, rgba(0,0,0,0.95) 85%, #000 100%)',
          } as any : null,
        ]}
      />

      {/* Center heart animation (like TikTok double-tap heart) */}
      <Animated.View style={[styles.centerAnimation, { transform: [{ scale: heartScale }], opacity: heartScale }]} pointerEvents="none">
        <Ionicons name="heart" size={100} color="#EF4444" />
      </Animated.View>

      {/* Center dislike animation */}
      <Animated.View style={[styles.centerAnimation, { transform: [{ scale: dislikeScale }], opacity: dislikeScale }]} pointerEvents="none">
        <Ionicons name="close-circle" size={100} color="#EF4444" />
      </Animated.View>

      {/* Source badge - top left */}
      <View style={[styles.sourceBadge, { backgroundColor: sourceColor }]}>
        <Text style={styles.sourceBadgeText}>{sourceLabel}</Text>
      </View>

      {/* ── TikTok-style RIGHT SIDEBAR ── */}
      <View style={styles.rightSidebar}>
        {/* Like / Heart */}
        <TouchableOpacity style={styles.sidebarItem} onPress={handleLike} activeOpacity={0.7}>
          <Ionicons
            name={liked ? 'heart' : 'heart-outline'}
            size={30}
            color={liked ? '#EF4444' : '#fff'}
          />
        </TouchableOpacity>

        {/* Comments (opens article) */}
        <TouchableOpacity style={styles.sidebarItem} onPress={openArticle} activeOpacity={0.7}>
          <Ionicons name="chatbubble-ellipses" size={28} color="#fff" />
        </TouchableOpacity>

        {/* Bookmark / Save */}
        <TouchableOpacity style={styles.sidebarItem} onPress={handleSave} activeOpacity={0.7}>
          <Ionicons
            name={saved ? 'bookmark' : 'bookmark-outline'}
            size={28}
            color={saved ? '#FBBF24' : '#fff'}
          />
        </TouchableOpacity>

        {/* Dive Deeper */}
        <TouchableOpacity style={styles.sidebarItem} onPress={handleDiveDeeper} activeOpacity={0.7}>
          <Ionicons name="boat-outline" size={28} color="#fff" />
        </TouchableOpacity>

        {/* Share */}
        <TouchableOpacity style={styles.sidebarItem} onPress={handleShare} activeOpacity={0.7}>
          <Ionicons name="arrow-redo" size={28} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* ── BOTTOM CONTENT (TikTok-style left-aligned) ── */}
      <TouchableOpacity
        style={styles.bottomContent}
        onPress={openArticle}
        activeOpacity={0.9}
      >
        <Text style={styles.title} numberOfLines={2}>{article.title}</Text>
        {article.description ? (
          <Text style={styles.description} numberOfLines={1}>{article.description}</Text>
        ) : null}
        <Text style={styles.extract} numberOfLines={2}>{article.hookLines[0] || article.extract}</Text>
        <Text style={styles.tapHint}>Tap to read full article</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

const TAB_BAR_HEIGHT = Platform.OS === 'ios' ? 75 : 52;

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
  centerAnimation: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 50,
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
  rightSidebar: {
    position: 'absolute',
    right: 8,
    bottom: TAB_BAR_HEIGHT + 120,
    alignItems: 'center',
    zIndex: 15,
  },
  sidebarItem: {
    alignItems: 'center',
    marginBottom: 20,
  },
  bottomContent: {
    position: 'absolute',
    bottom: TAB_BAR_HEIGHT + 16,
    left: 12,
    right: 70,
    zIndex: 10,
  },
  title: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 4,
    lineHeight: 22,
    textShadowColor: 'rgba(0,0,0,0.9)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  description: {
    color: '#D1D5DB',
    fontSize: 13,
    marginBottom: 4,
    fontStyle: 'italic',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  extract: {
    color: '#E5E7EB',
    fontSize: 14,
    lineHeight: 19,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  tapHint: {
    color: ACCENT,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 6,
  },
});
