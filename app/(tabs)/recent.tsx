import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  Platform,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../src/store/AppContext';

function AnimatedRow({ item, index, onPress }: { item: any; index: number; onPress: () => void }) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(anim, {
      toValue: 1,
      delay: index * 40,
      useNativeDriver: true,
      tension: 80,
      friction: 8,
    }).start();
  }, []);

  return (
    <Animated.View style={{ opacity: anim, transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [30, 0] }) }] }}>
      <TouchableOpacity style={styles.historyItem} onPress={onPress} activeOpacity={0.7}>
        {item.thumbnail ? (
          <Image source={{ uri: item.thumbnail }} style={styles.thumb} />
        ) : (
          <View style={[styles.thumb, styles.noThumb]}>
            <Ionicons name="document-text" size={20} color="#6B7280" />
          </View>
        )}
        <View style={styles.itemContent}>
          <Text style={styles.itemTitle} numberOfLines={1}>{item.title}</Text>
          {item.description ? (
            <Text style={styles.itemDescription} numberOfLines={1}>{item.description}</Text>
          ) : null}
          <Text style={styles.itemExtract} numberOfLines={2}>{item.extract}</Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color="#4B5563" />
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function RecentScreen() {
  const { history, viewArticle } = useApp();
  const headerAnim = useRef(new Animated.Value(0)).current;

  // Re-trigger animations on focus
  let isFocused = true;
  try {
    const nav = require('@react-navigation/native');
    isFocused = nav.useIsFocused();
  } catch {}

  useEffect(() => {
    if (isFocused) {
      headerAnim.setValue(0);
      Animated.timing(headerAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }).start();
    }
  }, [isFocused]);

  const safeHistory = (history || []).filter(item => item && item.pageid && item.title).map(item => ({
    ...item,
    hookLines: item.hookLines || [item.extract ? item.extract.split('.')[0] + '.' : ''],
    score: item.score || 50,
    sourceType: item.sourceType || ('random' as const),
    timestamp: item.timestamp || new Date().toISOString(),
  }));

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.header, { opacity: headerAnim, transform: [{ translateY: headerAnim.interpolate({ inputRange: [0, 1], outputRange: [-20, 0] }) }] }]}>
        <Text style={styles.headerTitle}>Recent</Text>
        <Text style={styles.headerSubtitle}>
          {safeHistory.length} article{safeHistory.length !== 1 ? 's' : ''} viewed
        </Text>
      </Animated.View>

      {safeHistory.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="time-outline" size={48} color="#4B5563" />
          <Text style={styles.emptyTitle}>No history yet</Text>
          <Text style={styles.emptySubtitle}>Articles you read will appear here</Text>
        </View>
      ) : (
        <FlatList
          data={safeHistory}
          keyExtractor={item => String(item.pageid)}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          renderItem={({ item, index }) => (
            <AnimatedRow item={item} index={index} onPress={() => viewArticle(item)} />
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 60 : 20,
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 32,
    fontWeight: '800',
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
  },
  headerSubtitle: {
    color: '#9CA3AF',
    fontSize: 14,
    marginTop: 4,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyTitle: {
    color: '#E5E7EB',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 12,
  },
  emptySubtitle: {
    color: '#6B7280',
    fontSize: 14,
    marginTop: 4,
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1F2937',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  thumb: {
    width: 56,
    height: 56,
    borderRadius: 8,
  },
  noThumb: {
    backgroundColor: '#374151',
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemContent: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },
  itemTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  itemDescription: {
    color: '#9CA3AF',
    fontSize: 11,
    fontStyle: 'italic',
    marginTop: 2,
  },
  itemExtract: {
    color: '#D1D5DB',
    fontSize: 12,
    lineHeight: 16,
    marginTop: 4,
  },
});
