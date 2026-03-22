import React, { useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  Alert,
  Share,
  Image,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useApp } from '../../src/store/AppContext';
import { signOut, getCurrentProfile } from '../../src/lib/auth';
import { supabase } from '../../src/lib/supabase';
import { useTheme } from '../../src/store/ThemeContext';
import { useEffect, useState } from 'react';

const ACCENT = '#38BDF8';
const CARD_BG = '#1F2937';
const DANGER = '#EF4444';

export default function ProfileScreen() {
  const router = useRouter();
  const { saved, history } = useApp();
  const { mode, setMode } = useTheme();
  const [profile, setProfile] = useState<{ username: string; display_name: string; avatar_url: string | null } | null>(null);
  const [email, setEmail] = useState('');
  const [profileLoading, setProfileLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      getCurrentProfile(),
      supabase.auth.getSession(),
    ]).then(([profileResult, sessionResult]) => {
      if (profileResult.data) setProfile(profileResult.data as any);
      if (sessionResult.data?.session?.user?.email) setEmail(sessionResult.data.session.user.email);
    }).finally(() => setProfileLoading(false));
  }, []);

  const username = profile?.username || '';
  const displayName = profile?.display_name || '';

  // Entrance animations
  const heroAnim = useRef(new Animated.Value(0)).current;
  const statsAnim = useRef(new Animated.Value(0)).current;
  const actionsAnim = useRef(new Animated.Value(0)).current;
  const settingsAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!profileLoading) {
      heroAnim.setValue(0);
      statsAnim.setValue(0);
      actionsAnim.setValue(0);
      settingsAnim.setValue(0);
      Animated.stagger(100, [
        Animated.spring(heroAnim, { toValue: 1, useNativeDriver: true, tension: 80, friction: 8 }),
        Animated.spring(statsAnim, { toValue: 1, useNativeDriver: true, tension: 80, friction: 8 }),
        Animated.spring(actionsAnim, { toValue: 1, useNativeDriver: true, tension: 80, friction: 8 }),
        Animated.spring(settingsAnim, { toValue: 1, useNativeDriver: true, tension: 80, friction: 8 }),
      ]).start();
    }
  }, [profileLoading]);

  const uniqueCategories = useMemo(() => {
    const cats = new Set<string>();
    for (const article of [...saved, ...history]) {
      if (article.category) {
        cats.add(article.category);
      }
    }
    return cats.size;
  }, [saved, history]);

  const handleQuickAction = (action: string) => {
    switch (action) {
      case 'saved':
        router.push('/(tabs)/saved' as any);
        break;
      case 'history':
        router.push('/(tabs)/recent' as any);
        break;
      case 'interests':
        router.push('/(tabs)/explore' as any);
        break;
      case 'share':
        Share.share({
          message: `Check out @${username} on WikiTok!`,
          url: 'https://wikitok.app',
        }).catch(() => {});
        break;
    }
  };

  const handleSettingsItem = (item: string) => {
    switch (item) {
      case 'edit':
        router.push('/edit-profile' as any);
        break;
      case 'Notifications':
        router.push('/notification-settings' as any);
        break;
      case 'Privacy':
        router.push('/privacy-settings' as any);
        break;
      case 'Theme': {
        Alert.alert('Theme', `Current: ${mode}`, [
          { text: 'System Default', onPress: () => setMode('system') },
          { text: 'Dark', onPress: () => setMode('dark') },
          { text: 'Light', onPress: () => setMode('light') },
          { text: 'Cancel', style: 'cancel' },
        ]);
        break;
      }
      case 'About WikiTok':
        router.push('/about' as any);
        break;
      case 'logout': {
        const doLogout = async () => {
          try { await signOut(); } catch {}
          router.replace('/(auth)/login' as any);
        };
        if (Platform.OS === 'web') {
          if (window.confirm('Are you sure you want to log out?')) {
            doLogout();
          }
        } else {
          Alert.alert('Log Out', 'Are you sure you want to log out?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Log Out', style: 'destructive', onPress: doLogout },
          ]);
        }
        break;
      }
      default:
        Alert.alert(item, 'Coming soon!');
        break;
    }
  };

  if (profileLoading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={ACCENT} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
    >
      {/* Hero Section */}
      <Animated.View style={[styles.heroSection, { opacity: heroAnim, transform: [{ translateY: heroAnim.interpolate({ inputRange: [0, 1], outputRange: [-20, 0] }) }] }]}>
        <View style={styles.avatarContainer}>
          <View style={styles.avatar}>
            {profile?.avatar_url ? (
              <Image source={{ uri: profile.avatar_url }} style={styles.avatarImage} />
            ) : (
              <Ionicons name="person" size={40} color="#6B7280" />
            )}
          </View>
          <TouchableOpacity
            style={styles.avatarEditBadge}
            activeOpacity={0.7}
            onPress={() => router.push('/edit-profile' as any)}
          >
            <Ionicons name="camera" size={12} color="#fff" />
          </TouchableOpacity>
        </View>
        <Text style={styles.username}>{displayName}</Text>
        <Text style={styles.handle}>@{username}</Text>
        {email ? <Text style={styles.emailText}>{email}</Text> : null}
        <TouchableOpacity activeOpacity={0.7} onPress={() => router.push('/(tabs)/recent' as any)}>
          <Text style={styles.viewActivity}>View activity</Text>
        </TouchableOpacity>
      </Animated.View>

      {/* Stats Row */}
      <Animated.View style={[styles.statsRow, { opacity: statsAnim, transform: [{ scale: statsAnim }] }]}>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{history.length}</Text>
          <Text style={styles.statLabel}>Articles Read</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{saved.length}</Text>
          <Text style={styles.statLabel}>Articles Saved</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{uniqueCategories}</Text>
          <Text style={styles.statLabel}>Interests</Text>
        </View>
      </Animated.View>

      {/* Quick Actions */}
      <Animated.View style={[styles.quickActionsGrid, { opacity: actionsAnim, transform: [{ translateY: actionsAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }] }]}>
        <View style={styles.quickActionsRow}>
          <TouchableOpacity
            style={styles.quickActionCard}
            activeOpacity={0.7}
            onPress={() => handleQuickAction('saved')}
          >
            <Ionicons name="bookmark" size={24} color={ACCENT} />
            <Text style={styles.quickActionLabel}>Saved{'\n'}Articles</Text>
          </TouchableOpacity>
          <View style={styles.quickActionSpacer} />
          <TouchableOpacity
            style={styles.quickActionCard}
            activeOpacity={0.7}
            onPress={() => handleQuickAction('history')}
          >
            <Ionicons name="time" size={24} color={ACCENT} />
            <Text style={styles.quickActionLabel}>Reading{'\n'}History</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.quickActionsRowSpacer} />
        <View style={styles.quickActionsRow}>
          <TouchableOpacity
            style={styles.quickActionCard}
            activeOpacity={0.7}
            onPress={() => handleQuickAction('interests')}
          >
            <Ionicons name="heart" size={24} color={ACCENT} />
            <Text style={styles.quickActionLabel}>Interests</Text>
          </TouchableOpacity>
          <View style={styles.quickActionSpacer} />
          <TouchableOpacity
            style={styles.quickActionCard}
            activeOpacity={0.7}
            onPress={() => handleQuickAction('share')}
          >
            <Ionicons name="share-social" size={24} color={ACCENT} />
            <Text style={styles.quickActionLabel}>Share{'\n'}Profile</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>

      {/* Account Settings */}
      <Animated.View style={{ opacity: settingsAnim, transform: [{ translateY: settingsAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }] }}>
        <Text style={styles.sectionHeader}>Account Settings</Text>
      </Animated.View>
      <Animated.View style={[styles.settingsCard, { opacity: settingsAnim, transform: [{ translateY: settingsAnim.interpolate({ inputRange: [0, 1], outputRange: [30, 0] }) }] }]}>
        <SettingsItem
          icon="person"
          label="Edit Profile"
          onPress={() => handleSettingsItem('edit')}
        />
        <View style={styles.settingsDivider} />
        <SettingsItem
          icon="notifications"
          label="Notifications"
          onPress={() => handleSettingsItem('Notifications')}
        />
        <View style={styles.settingsDivider} />
        <SettingsItem
          icon="lock-closed"
          label="Privacy"
          onPress={() => handleSettingsItem('Privacy')}
        />
        <View style={styles.settingsDivider} />
        <SettingsItem
          icon="moon"
          label="Theme"
          onPress={() => handleSettingsItem('Theme')}
        />
        <View style={styles.settingsDivider} />
        <SettingsItem
          icon="information-circle"
          label="About WikiTok"
          onPress={() => handleSettingsItem('About WikiTok')}
        />
        <View style={styles.settingsDivider} />
        <SettingsItem
          icon="log-out"
          label="Log Out"
          onPress={() => handleSettingsItem('logout')}
          danger
        />
      </Animated.View>

      {/* Version */}
      <Text style={styles.versionText}>WikiTok v1.0.0</Text>
    </ScrollView>
  );
}

function SettingsItem({
  icon,
  label,
  onPress,
  danger,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  danger?: boolean;
}) {
  return (
    <TouchableOpacity
      style={styles.settingsItem}
      activeOpacity={0.7}
      onPress={onPress}
    >
      <Ionicons
        name={icon}
        size={20}
        color={danger ? DANGER : '#9CA3AF'}
        style={styles.settingsItemIcon}
      />
      <Text
        style={[
          styles.settingsItemLabel,
          danger ? styles.settingsItemLabelDanger : undefined,
        ]}
      >
        {label}
      </Text>
      <Ionicons name="chevron-forward" size={18} color="#6B7280" />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  contentContainer: {
    paddingBottom: 100,
  },
  // Hero Section
  heroSection: {
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 60 : 20,
    paddingBottom: 24,
    paddingHorizontal: 20,
    backgroundColor: '#111',
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 12,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: CARD_BG,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  avatarEditBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: ACCENT,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#111',
  },
  username: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
  },
  handle: {
    color: '#9CA3AF',
    fontSize: 14,
    marginTop: 2,
  },
  emailText: {
    color: '#6B7280',
    fontSize: 12,
    marginTop: 4,
  },
  viewActivity: {
    color: ACCENT,
    fontSize: 14,
    fontWeight: '600',
    marginTop: 8,
  },
  // Stats Row
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CARD_BG,
    borderRadius: 16,
    marginHorizontal: 16,
    marginTop: 20,
    paddingVertical: 16,
    paddingHorizontal: 8,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '700',
  },
  statLabel: {
    color: '#9CA3AF',
    fontSize: 12,
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    height: 32,
    backgroundColor: '#374151',
  },
  // Quick Actions
  quickActionsGrid: {
    marginHorizontal: 16,
    marginTop: 20,
  },
  quickActionsRow: {
    flexDirection: 'row',
  },
  quickActionsRowSpacer: {
    height: 12,
  },
  quickActionCard: {
    flex: 1,
    height: 80,
    backgroundColor: CARD_BG,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quickActionSpacer: {
    width: 12,
  },
  quickActionLabel: {
    color: '#9CA3AF',
    fontSize: 12,
    fontWeight: '500',
    marginTop: 6,
    textAlign: 'center',
  },
  // Settings
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
  settingsCard: {
    backgroundColor: CARD_BG,
    borderRadius: 16,
    marginHorizontal: 16,
    overflow: 'hidden',
  },
  settingsItem: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 56,
    paddingHorizontal: 16,
  },
  settingsItemIcon: {
    marginRight: 14,
  },
  settingsItemLabel: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
  },
  settingsItemLabelDanger: {
    color: DANGER,
  },
  settingsDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#374151',
    marginLeft: 50,
  },
  // Version
  versionText: {
    color: '#6B7280',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 24,
  },
});
