import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Alert,
  Switch,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

const ACCENT = '#38BDF8';
const CARD_BG = '#1F2937';

export default function PrivacySettingsScreen() {
  const router = useRouter();
  const [showReadingHistory, setShowReadingHistory] = useState(true);
  const [allowDiscovery, setAllowDiscovery] = useState(true);
  const [showSavedCount, setShowSavedCount] = useState(true);

  const handleSave = () => {
    Alert.alert('Saved', 'Privacy settings saved.');
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.headerButton}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Privacy</Text>
        <TouchableOpacity
          onPress={handleSave}
          style={styles.headerButton}
          activeOpacity={0.7}
        >
          <Text style={styles.saveButton}>Save</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.card}>
          <View style={styles.settingRow}>
            <View style={styles.settingTextContainer}>
              <Text style={styles.settingLabel}>Show reading history</Text>
              <Text style={styles.settingDescription}>
                Allow others to see your reading history on your profile
              </Text>
            </View>
            <Switch
              value={showReadingHistory}
              onValueChange={setShowReadingHistory}
              trackColor={{ false: '#374151', true: ACCENT }}
              thumbColor="#fff"
            />
          </View>

          <View style={styles.divider} />

          <View style={styles.settingRow}>
            <View style={styles.settingTextContainer}>
              <Text style={styles.settingLabel}>Allow profile discovery</Text>
              <Text style={styles.settingDescription}>
                Let other users find your profile through search
              </Text>
            </View>
            <Switch
              value={allowDiscovery}
              onValueChange={setAllowDiscovery}
              trackColor={{ false: '#374151', true: ACCENT }}
              thumbColor="#fff"
            />
          </View>

          <View style={styles.divider} />

          <View style={styles.settingRow}>
            <View style={styles.settingTextContainer}>
              <Text style={styles.settingLabel}>Show saved articles count</Text>
              <Text style={styles.settingDescription}>
                Display the number of saved articles on your profile
              </Text>
            </View>
            <Switch
              value={showSavedCount}
              onValueChange={setShowSavedCount}
              trackColor={{ false: '#374151', true: ACCENT }}
              thumbColor="#fff"
            />
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 60 : 20,
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: '#000',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#1F2937',
  },
  headerButton: {
    width: 60,
    paddingVertical: 4,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
    textAlign: 'center',
  },
  saveButton: {
    color: ACCENT,
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'right',
  },
  scrollContent: {
    paddingBottom: 100,
    paddingTop: 24,
  },
  card: {
    backgroundColor: CARD_BG,
    borderRadius: 16,
    marginHorizontal: 16,
    overflow: 'hidden',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  settingTextContainer: {
    flex: 1,
    marginRight: 12,
  },
  settingLabel: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  settingDescription: {
    color: '#9CA3AF',
    fontSize: 13,
    marginTop: 4,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#374151',
    marginLeft: 16,
  },
});
