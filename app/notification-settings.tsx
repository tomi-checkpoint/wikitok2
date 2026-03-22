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

export default function NotificationSettingsScreen() {
  const router = useRouter();
  const [newFollowers, setNewFollowers] = useState(true);
  const [commentReplies, setCommentReplies] = useState(true);
  const [trendingArticles, setTrendingArticles] = useState(true);
  const [weeklyDigest, setWeeklyDigest] = useState(false);

  const handleSave = () => {
    Alert.alert('Saved', 'Notification settings saved.');
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
        <Text style={styles.headerTitle}>Notifications</Text>
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
              <Text style={styles.settingLabel}>New followers</Text>
              <Text style={styles.settingDescription}>
                Get notified when someone follows you
              </Text>
            </View>
            <Switch
              value={newFollowers}
              onValueChange={setNewFollowers}
              trackColor={{ false: '#374151', true: ACCENT }}
              thumbColor="#fff"
            />
          </View>

          <View style={styles.divider} />

          <View style={styles.settingRow}>
            <View style={styles.settingTextContainer}>
              <Text style={styles.settingLabel}>Comment replies</Text>
              <Text style={styles.settingDescription}>
                Get notified when someone replies to your comments
              </Text>
            </View>
            <Switch
              value={commentReplies}
              onValueChange={setCommentReplies}
              trackColor={{ false: '#374151', true: ACCENT }}
              thumbColor="#fff"
            />
          </View>

          <View style={styles.divider} />

          <View style={styles.settingRow}>
            <View style={styles.settingTextContainer}>
              <Text style={styles.settingLabel}>Trending articles</Text>
              <Text style={styles.settingDescription}>
                Get notified about trending articles in your interests
              </Text>
            </View>
            <Switch
              value={trendingArticles}
              onValueChange={setTrendingArticles}
              trackColor={{ false: '#374151', true: ACCENT }}
              thumbColor="#fff"
            />
          </View>

          <View style={styles.divider} />

          <View style={styles.settingRow}>
            <View style={styles.settingTextContainer}>
              <Text style={styles.settingLabel}>Weekly digest</Text>
              <Text style={styles.settingDescription}>
                Receive a weekly summary of top articles
              </Text>
            </View>
            <Switch
              value={weeklyDigest}
              onValueChange={setWeeklyDigest}
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
