import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Modal,
  FlatList,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../store/AppContext';

interface ThemeModalProps {
  visible: boolean;
  onClose: () => void;
  onNavigateToFeed?: () => void;
}

const SUGGESTED_THEMES = [
  'Ancient Civilizations',
  'Unsolved Mysteries',
  'Space Exploration',
  'Famous Inventions',
  'Mythological Creatures',
  'Nobel Prize Winners',
  'Natural Wonders',
  'Secret Societies',
  'Lost Cities',
  'Revolutionary Scientists',
  'Deep Sea Creatures',
  'Conspiracy Theories',
  'Quantum Physics',
  'Medieval History',
  'Extinct Animals',
];

export default function ThemeModal({ visible, onClose, onNavigateToFeed }: ThemeModalProps) {
  const { setFeedConfig } = useApp();
  const [searchText, setSearchText] = useState('');

  const handleThemeSelect = (theme: string) => {
    setFeedConfig({ searchQuery: theme, theme });
    onClose();
    setSearchText('');
    if (onNavigateToFeed) onNavigateToFeed();
  };

  const handleCustomSearch = () => {
    if (searchText.trim()) {
      handleThemeSelect(searchText.trim());
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.backdrop}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Knowledge Trail</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
          </View>

          <Text style={styles.subtitle}>
            Create a custom knowledge trail to explore a specific topic
          </Text>

          {/* Search input */}
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={18} color="#6B7280" style={{ marginRight: 8 }} />
            <TextInput
              style={styles.searchInput}
              placeholder="Enter any topic..."
              placeholderTextColor="#6B7280"
              value={searchText}
              onChangeText={setSearchText}
              onSubmitEditing={handleCustomSearch}
              returnKeyType="search"
              autoCorrect={false}
            />
            {searchText.length > 0 && (
              <TouchableOpacity onPress={handleCustomSearch}>
                <Ionicons name="arrow-forward-circle" size={24} color="#38BDF8" />
              </TouchableOpacity>
            )}
          </View>

          {/* Suggested themes */}
          <Text style={styles.sectionTitle}>Suggested Trails</Text>
          <FlatList
            data={SUGGESTED_THEMES}
            keyExtractor={item => item}
            numColumns={2}
            columnWrapperStyle={styles.row}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.themeChip}
                onPress={() => handleThemeSelect(item)}
                activeOpacity={0.7}
              >
                <Text style={styles.themeChipText}>{item}</Text>
              </TouchableOpacity>
            )}
            contentContainerStyle={styles.themeList}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#1F2937',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
    maxHeight: '80%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 20,
    paddingBottom: 8,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '700',
  },
  subtitle: {
    color: '#9CA3AF',
    fontSize: 14,
    marginBottom: 16,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#374151',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 20,
  },
  searchInput: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
    ...(Platform.OS === 'web' ? { outlineStyle: 'none' } : {}),
  } as any,
  sectionTitle: {
    color: '#D1D5DB',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  themeList: {
    paddingBottom: 20,
  },
  row: {
    marginBottom: 8,
    justifyContent: 'space-between',
  },
  themeChip: {
    flex: 1,
    backgroundColor: '#374151',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#4B5563',
  },
  themeChipText: {
    color: '#E5E7EB',
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
});
