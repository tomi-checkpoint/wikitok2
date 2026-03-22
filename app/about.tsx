import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Alert,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

const ACCENT = '#38BDF8';
const CARD_BG = '#1F2937';

export default function AboutScreen() {
  const router = useRouter();

  const handleLink = (label: string) => {
    Alert.alert(label, 'Coming soon');
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
        <Text style={styles.headerTitle}>About</Text>
        <View style={styles.headerButton} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Logo Section */}
        <View style={styles.logoSection}>
          <View style={styles.logoContainer}>
            <Ionicons name="book" size={48} color={ACCENT} />
          </View>
          <Text style={styles.appName}>WikiTok</Text>
          <Text style={styles.version}>Version 1.0.0</Text>
        </View>

        {/* Description */}
        <View style={styles.descriptionCard}>
          <Text style={styles.descriptionText}>
            WikiTok brings the world's knowledge to your fingertips in a fun, swipeable format.
          </Text>
        </View>

        {/* Powered By */}
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Ionicons name="globe" size={20} color={ACCENT} style={styles.infoIcon} />
            <Text style={styles.infoText}>Powered by Wikipedia</Text>
          </View>
          <View style={styles.infoDivider} />
          <View style={styles.infoRow}>
            <Ionicons name="code-slash" size={20} color={ACCENT} style={styles.infoIcon} />
            <Text style={styles.infoText}>Built with Expo & React Native</Text>
          </View>
        </View>

        {/* Remove "Built with" line too — keep it simple */}
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
  scrollContent: {
    paddingBottom: 100,
  },
  // Logo
  logoSection: {
    alignItems: 'center',
    paddingTop: 40,
    paddingBottom: 32,
  },
  logoContainer: {
    width: 88,
    height: 88,
    borderRadius: 22,
    backgroundColor: CARD_BG,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  appName: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
  },
  version: {
    color: '#9CA3AF',
    fontSize: 14,
    marginTop: 4,
  },
  // Description
  descriptionCard: {
    backgroundColor: CARD_BG,
    borderRadius: 16,
    marginHorizontal: 16,
    padding: 20,
    marginBottom: 16,
  },
  descriptionText: {
    color: '#D1D5DB',
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  // Info
  infoCard: {
    backgroundColor: CARD_BG,
    borderRadius: 16,
    marginHorizontal: 16,
    overflow: 'hidden',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  infoIcon: {
    marginRight: 14,
  },
  infoText: {
    color: '#fff',
    fontSize: 16,
    flex: 1,
  },
  infoDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#374151',
    marginLeft: 50,
  },
  // Links
  sectionHeader: {
    color: '#9CA3AF',
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginHorizontal: 16,
    marginTop: 28,
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  linksCard: {
    backgroundColor: CARD_BG,
    borderRadius: 16,
    marginHorizontal: 16,
    overflow: 'hidden',
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  linkText: {
    color: '#fff',
    fontSize: 16,
    flex: 1,
  },
});
