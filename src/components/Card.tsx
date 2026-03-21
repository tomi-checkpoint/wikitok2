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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ProcessedArticle } from '../types';
import { useApp } from '../store/AppContext';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const ACCENT = '#38BDF8';
const SWIPE_THRESHOLD = 60;
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
}

export default function Card({ article, isActive, onSwipeComplete }: CardProps) {
  const {
    saveArticle,
    unsaveArticle,
    dislikeArticle,
    viewArticle,
    isSaved,
    recordDwell,
    diveDeeper,
  } = useApp();
  const saved = isSaved(article.pageid);
  const dwellStart = useRef<number>(0);
  const [liked, setLiked] = useState(false);
  const [diving, setDiving] = useState(false);

  const translateX = useRef(new Animated.Value(0)).current;
  const cardOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isActive) {
      dwellStart.current = Date.now();
      translateX.setValue(0);
      cardOpacity.setValue(1);
    } else if (dwellStart.current > 0) {
      const duration = Date.now() - dwellStart.current;
      recordDwell(article, duration);
      dwellStart.current = 0;
    }
  }, [isActive]);

  const cardRotate = translateX.interpolate({
    inputRange: [-SCREEN_WIDTH, 0, SCREEN_WIDTH],
    outputRange: ['-8deg', '0deg', '8deg'],
    extrapolate: 'clamp',
  });

  const likeOpacity = translateX.interpolate({
    inputRange: [0, SWIPE_THRESHOLD],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  const dislikeOpacity = translateX.interpolate({
    inputRange: [-SWIPE_THRESHOLD, 0],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gs) => {
        // Only capture horizontal swipes, let vertical scroll through
        return Math.abs(gs.dx) > 12 && Math.abs(gs.dx) > Math.abs(gs.dy) * 1.5;
      },
      onPanResponderGrant: () => {
        // Stop any running animations
        translateX.stopAnimation();
      },
      onPanResponderMove: (_, gs) => {
        translateX.setValue(gs.dx);
      },
      onPanResponderRelease: (_, gs) => {
        const swipedRight = gs.dx > SWIPE_THRESHOLD || (gs.vx > SWIPE_VELOCITY_THRESHOLD && gs.dx > 20);
        const swipedLeft = gs.dx < -SWIPE_THRESHOLD || (gs.vx < -SWIPE_VELOCITY_THRESHOLD && gs.dx < -20);

        if (swipedRight) {
          Animated.timing(translateX, {
            toValue: SCREEN_WIDTH * 1.5,
            duration: 250,
            useNativeDriver: true,
          }).start(() => {
            setLiked(true);
            recordDwell(article, 5000);
            translateX.setValue(0);
            cardOpacity.setValue(1);
            if (onSwipeComplete) {
              setTimeout(() => onSwipeComplete(), 50);
            }
          });
        } else if (swipedLeft) {
          Animated.timing(translateX, {
            toValue: -SCREEN_WIDTH * 1.5,
            duration: 250,
            useNativeDriver: true,
          }).start(() => {
            translateX.setValue(0);
            cardOpacity.setValue(1);
            // dislikeArticle removes current article from array,
            // which auto-shows next one - don't call onSwipeComplete
            dislikeArticle(article);
          });
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
        Animated.spring(translateX, {
          toValue: 0,
          useNativeDriver: true,
        }).start();
      },
    })
  ).current;

  const handleLike = () => {
    setLiked(true);
    recordDwell(article, 5000);
  };

  const handleSave = () => {
    if (saved) {
      unsaveArticle(article.pageid);
    } else {
      saveArticle(article);
    }
  };

  const handleSkip = () => {
    dislikeArticle(article);
  };

  const handleDiveDeeper = async () => {
    if (diving) return;
    setDiving(true);
    try {
      await diveDeeper(article);
    } catch (_) {
      // ignore
    } finally {
      setDiving(false);
    }
  };

  const openArticle = () => {
    viewArticle(article);
  };

  const sourceLabel = SOURCE_LABELS[article.sourceType] ?? 'Discover';
  const sourceColor = SOURCE_COLORS[article.sourceType] ?? '#6B7280';

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [{ translateX }, { rotate: cardRotate }],
        },
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
            backgroundImage: 'linear-gradient(to bottom, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.3) 40%, rgba(0,0,0,0.85) 70%, rgba(0,0,0,0.95) 100%)',
          } as any : null,
        ]}
      />

      {/* Swipe hint overlays */}
      <Animated.View style={[styles.swipeHint, styles.swipeHintRight, { opacity: likeOpacity }]} pointerEvents="none">
        <Ionicons name="thumbs-up" size={60} color="#22C55E" />
      </Animated.View>
      <Animated.View style={[styles.swipeHint, styles.swipeHintLeft, { opacity: dislikeOpacity }]} pointerEvents="none">
        <Ionicons name="close-circle" size={60} color="#EF4444" />
      </Animated.View>

      {/* Source badge */}
      <View style={[styles.sourceBadge, { backgroundColor: sourceColor }]}>
        <Text style={styles.sourceBadgeText}>{sourceLabel}</Text>
      </View>

      {/* Save/bookmark button - top right */}
      <TouchableOpacity style={styles.saveButtonWrap} onPress={handleSave} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
        <Ionicons
          name={saved ? 'bookmark' : 'bookmark-outline'}
          size={26}
          color={saved ? ACCENT : '#fff'}
        />
      </TouchableOpacity>

      {/* Content area - tappable */}
      <View style={styles.content}>
        <TouchableOpacity onPress={openArticle} activeOpacity={0.9}>
          <Text style={styles.title} numberOfLines={3}>{article.title}</Text>
          {article.description ? (
            <Text style={styles.description} numberOfLines={1}>{article.description}</Text>
          ) : null}
          <View style={styles.hookContainer}>
            {article.hookLines.slice(0, 2).map((line, i) => (
              <Text key={i} style={styles.hookLine} numberOfLines={3}>{line}</Text>
            ))}
          </View>
          <Text style={styles.extract} numberOfLines={3}>{article.extract}</Text>
          <Text style={styles.tapHint}>Tap to read full article</Text>
        </TouchableOpacity>
      </View>

      {/* Bottom action bar */}
      <View style={styles.bottomBar}>
        <TouchableOpacity onPress={handleSkip} style={styles.bottomAction} hitSlop={{ top: 10, bottom: 10, left: 15, right: 15 }}>
          <Ionicons name="close-circle" size={30} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity onPress={handleSave} style={styles.bottomAction} hitSlop={{ top: 10, bottom: 10, left: 15, right: 15 }}>
          <Ionicons
            name={saved ? 'heart' : 'heart-outline'}
            size={30}
            color={saved ? '#EF4444' : '#fff'}
          />
        </TouchableOpacity>
        <TouchableOpacity onPress={handleDiveDeeper} style={styles.bottomAction} hitSlop={{ top: 10, bottom: 10, left: 15, right: 15 }}>
          <Ionicons name={diving ? 'hourglass' : 'boat-outline'} size={30} color={diving ? ACCENT : '#fff'} />
        </TouchableOpacity>
        <TouchableOpacity onPress={handleLike} style={styles.bottomAction} hitSlop={{ top: 10, bottom: 10, left: 15, right: 15 }}>
          <Ionicons
            name={liked ? 'thumbs-up' : 'thumbs-up-outline'}
            size={30}
            color={liked ? '#22C55E' : '#fff'}
          />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

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
    backgroundColor: Platform.OS === 'web' ? 'transparent' : 'rgba(0,0,0,0.45)',
  },
  swipeHint: {
    position: 'absolute',
    top: '35%',
    zIndex: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 50,
    padding: 16,
  },
  swipeHintRight: {
    right: 30,
  },
  swipeHintLeft: {
    left: 30,
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
  saveButtonWrap: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 56 : 14,
    right: 16,
    zIndex: 10,
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: 20,
    padding: 8,
  },
  content: {
    position: 'absolute',
    bottom: 140,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingVertical: 16,
    marginHorizontal: 8,
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: 16,
    zIndex: 5,
  },
  title: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 6,
    lineHeight: 34,
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  description: {
    color: '#D1D5DB',
    fontSize: 13,
    marginBottom: 8,
    fontStyle: 'italic',
  },
  hookContainer: {
    marginBottom: 6,
  },
  hookLine: {
    color: '#F3F4F6',
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 4,
    fontWeight: '500',
  },
  extract: {
    color: '#D1D5DB',
    fontSize: 14,
    lineHeight: 20,
  },
  tapHint: {
    color: ACCENT,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 8,
  },
  bottomBar: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 78 : 54,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: 30,
    paddingVertical: 12,
    backgroundColor: 'rgba(0,0,0,0.6)',
    zIndex: 30,
  },
  bottomAction: {
    alignItems: 'center',
    padding: 6,
  },
});
