import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../src/store/AppContext';


export default function SavedScreen() {
  const { saved, unsaveArticle, viewArticle } = useApp();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Saved</Text>
        <Text style={styles.headerSubtitle}>
          {saved.length} article{saved.length !== 1 ? 's' : ''} saved
        </Text>
      </View>

      {saved.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="heart-outline" size={48} color="#4B5563" />
          <Text style={styles.emptyTitle}>No saved articles</Text>
          <Text style={styles.emptySubtitle}>
            Tap the heart icon to save articles for later
          </Text>
        </View>
      ) : (
        <FlatList
          data={saved}
          keyExtractor={item => String(item.pageid)}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.savedItem}
              onPress={() => viewArticle(item)}
              activeOpacity={0.7}
            >
              {item.thumbnail ? (
                <Image source={{ uri: item.thumbnail }} style={styles.thumb} />
              ) : (
                <View style={[styles.thumb, styles.noThumb]}>
                  <Ionicons name="document-text" size={20} color="#6B7280" />
                </View>
              )}
              <View style={styles.itemContent}>
                <Text style={styles.itemTitle} numberOfLines={1}>
                  {item.title}
                </Text>
                {item.category && (
                  <View style={styles.categoryBadge}>
                    <Text style={styles.categoryText}>{item.category}</Text>
                  </View>
                )}
                <Text style={styles.itemExtract} numberOfLines={2}>
                  {item.extract}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => unsaveArticle(item.pageid)}
                style={styles.removeButton}
              >
                <Ionicons name="heart" size={20} color="#EF4444" />
              </TouchableOpacity>
            </TouchableOpacity>
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
  },
  emptySubtitle: {
    color: '#6B7280',
    fontSize: 14,
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  savedItem: {
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
  },
  itemTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  categoryBadge: {
    backgroundColor: '#374151',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  categoryText: {
    color: '#9CA3AF',
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  itemExtract: {
    color: '#D1D5DB',
    fontSize: 12,
    lineHeight: 16,
    marginTop: 4,
  },
  removeButton: {
    padding: 8,
  },
});
