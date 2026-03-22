import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Platform,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { CATEGORIES } from '../../src/lib/wikipedia';
import { useApp } from '../../src/store/AppContext';

const ICON_MAP: Record<string, keyof typeof Ionicons.glyphMap> = {
  flask: 'flask',
  landmark: 'business',
  cpu: 'hardware-chip',
  palette: 'color-palette',
  music: 'musical-notes',
  trophy: 'trophy',
  leaf: 'leaf',
  moon: 'moon',
  'book-open': 'book',
  hash: 'grid',
  'heart-pulse': 'heart',
  globe: 'globe',
  book: 'book',
  film: 'film',
  brain: 'bulb',
  'trending-up': 'trending-up',
  building: 'business',
  sparkles: 'sparkles',
  utensils: 'restaurant',
  plane: 'airplane',
  waves: 'water',
  bone: 'skull',
  lightbulb: 'bulb',
  swords: 'shield',
  languages: 'language',
  telescope: 'telescope',
  atom: 'nuclear',
  dna: 'fitness',
  zap: 'flash',
  wrench: 'build',
  camera: 'camera',
  'hardware-chip': 'hardware-chip',
  search: 'search',
  'game-controller': 'game-controller',
  'logo-bitcoin': 'logo-bitcoin',
  shirt: 'shirt',
  tv: 'tv',
  walk: 'walk',
  flame: 'flame',
  skull: 'skull',
  eye: 'eye',
  fitness: 'fitness',
  bulb: 'bulb',
  thermometer: 'thermometer',
  train: 'train',
  chatbubbles: 'chatbubbles',
  medal: 'medal',
  diamond: 'diamond',
  shield: 'shield',
  boat: 'boat',
};

const CATEGORY_COLORS = [
  '#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6',
  '#EC4899', '#06B6D4', '#84CC16', '#F97316', '#6366F1',
  '#14B8A6', '#E11D48', '#A855F7', '#22C55E', '#0EA5E9',
  '#D946EF', '#F43F5E', '#0891B2', '#65A30D', '#7C3AED',
  '#DB2777', '#059669', '#DC2626', '#2563EB', '#9333EA',
];

function AnimatedCard({ item, index, onPress, animKey }: { item: typeof CATEGORIES[0]; index: number; onPress: () => void; animKey: number }) {
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const pressScale = useRef(new Animated.Value(1)).current;
  const color = CATEGORY_COLORS[index % CATEGORY_COLORS.length];
  const iconName = ICON_MAP[item.icon] ?? 'ellipse';

  useEffect(() => {
    scaleAnim.setValue(0);
    Animated.spring(scaleAnim, {
      toValue: 1,
      delay: index * 30,
      useNativeDriver: true,
      tension: 80,
      friction: 8,
    }).start();
  }, [animKey]);

  const handlePressIn = () => {
    Animated.spring(pressScale, {
      toValue: 0.92,
      useNativeDriver: true,
      tension: 200,
      friction: 10,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(pressScale, {
      toValue: 1,
      useNativeDriver: true,
      tension: 200,
      friction: 10,
    }).start();
  };

  return (
    <Animated.View
      style={{
        flex: 1,
        marginHorizontal: 5,
        transform: [
          { scale: Animated.multiply(scaleAnim, pressScale) },
        ],
        opacity: scaleAnim,
      }}
    >
      <TouchableOpacity
        style={[styles.categoryCard, { backgroundColor: color + '18', borderColor: color + '40' }]}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={1}
      >
        <View style={[styles.iconCircle, { backgroundColor: color + '25' }]}>
          <Ionicons name={iconName} size={26} color={color} />
        </View>
        <Text style={styles.categoryName}>{item.name}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function ExploreScreen() {
  const { setFeedConfig } = useApp();
  const [search, setSearch] = useState('');
  const [animKey, setAnimKey] = useState(0);
  const router = useRouter();
  const headerAnim = useRef(new Animated.Value(0)).current;

  // Re-trigger animations every time tab is focused
  const { useIsFocused } = require('@react-navigation/native');
  const isFocused = useIsFocused();
  useEffect(() => {
    if (isFocused) {
      setAnimKey(k => k + 1);
      headerAnim.setValue(0);
      Animated.timing(headerAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }).start();
    }
  }, [isFocused]);

  const filteredCategories = search
    ? CATEGORIES.filter(c => c.name.toLowerCase().includes(search.toLowerCase()))
    : CATEGORIES;

  const handleCategoryPress = (wikiCat: string, name: string) => {
    setFeedConfig({ category: wikiCat });
    router.navigate('/');
  };

  const handleSearch = () => {
    if (search.trim()) {
      setFeedConfig({ searchQuery: search.trim(), theme: search.trim() });
      router.navigate('/');
    }
  };

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.header, { opacity: headerAnim, transform: [{ translateY: headerAnim.interpolate({ inputRange: [0, 1], outputRange: [-20, 0] }) }] }]}>
        <Text style={styles.headerTitle}>Explore</Text>
        <Text style={styles.headerSubtitle}>Dive into a topic</Text>
      </Animated.View>

      {/* Search bar */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={18} color="#6B7280" style={{ marginRight: 8 }} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search any topic..."
          placeholderTextColor="#6B7280"
          value={search}
          onChangeText={setSearch}
          onSubmitEditing={handleSearch}
          returnKeyType="search"
          autoCorrect={false}
        />
        {search.length > 0 ? (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={18} color="#6B7280" />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Category grid */}
      <FlatList
        data={filteredCategories}
        numColumns={2}
        keyExtractor={item => item.wikiCat}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.grid}
        showsVerticalScrollIndicator={false}
        renderItem={({ item, index }) => (
          <AnimatedCard
            item={item}
            index={index}
            animKey={animKey}
            onPress={() => handleCategoryPress(item.wikiCat, item.name)}
          />
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No categories found</Text>
          </View>
        }
      />
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
    paddingBottom: 8,
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
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1F2937',
    borderRadius: 24,
    marginHorizontal: 16,
    marginVertical: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  searchInput: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
    ...(Platform.OS === 'web' ? { outlineStyle: 'none' } : {}),
  } as any,
  grid: {
    paddingHorizontal: 12,
    paddingBottom: 100,
  },
  row: {
    marginBottom: 12,
  },
  categoryCard: {
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    alignItems: 'center',
    paddingVertical: 20,
  },
  iconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  categoryName: {
    color: '#E5E7EB',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  empty: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    color: '#6B7280',
    fontSize: 14,
  },
});
