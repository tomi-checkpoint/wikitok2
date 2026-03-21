import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Platform,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

// TODO: Replace with real user data from Supabase auth
const ACCENT = '#38BDF8';
const CARD_BG = '#1F2937';
const BIO_MAX = 160;

export default function EditProfileScreen() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState('Knowledge Explorer');
  const [username] = useState('wikitok_user');
  const [bio, setBio] = useState('');

  const handleSave = () => {
    Alert.alert('Coming soon', 'Profile editing will be available with authentication.');
  };

  const handleChangeBio = (text: string) => {
    if (text.length <= BIO_MAX) {
      setBio(text);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.headerButton}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Profile</Text>
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
        {/* Avatar Section */}
        <View style={styles.avatarSection}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={40} color="#6B7280" />
          </View>
          <TouchableOpacity activeOpacity={0.7} onPress={() => Alert.alert('Coming soon', 'Photo upload will be available soon.')}>
            <Text style={styles.changePhotoText}>Change Photo</Text>
          </TouchableOpacity>
        </View>

        {/* Form */}
        <View style={styles.formSection}>
          {/* Display Name */}
          <View style={styles.fieldContainer}>
            <Text style={styles.fieldLabel}>Display Name</Text>
            <View style={styles.inputCard}>
              <TextInput
                style={styles.input}
                value={displayName}
                onChangeText={setDisplayName}
                placeholderTextColor="#6B7280"
                placeholder="Enter display name"
                autoCapitalize="words"
              />
            </View>
          </View>

          {/* Username */}
          <View style={styles.fieldContainer}>
            <Text style={styles.fieldLabel}>Username</Text>
            <View style={[styles.inputCard, styles.inputDisabled]}>
              <Text style={styles.usernamePrefix}>@</Text>
              <TextInput
                style={[styles.input, styles.inputDisabledText]}
                value={username}
                editable={false}
                placeholderTextColor="#6B7280"
              />
            </View>
          </View>

          {/* Bio */}
          <View style={styles.fieldContainer}>
            <View style={styles.bioLabelRow}>
              <Text style={styles.fieldLabel}>Bio</Text>
              <Text style={styles.charCounter}>
                {bio.length}/{BIO_MAX}
              </Text>
            </View>
            <View style={styles.inputCard}>
              <TextInput
                style={[styles.input, styles.bioInput]}
                value={bio}
                onChangeText={handleChangeBio}
                placeholderTextColor="#6B7280"
                placeholder="Tell us about yourself..."
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                maxLength={BIO_MAX}
              />
            </View>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  // Header
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
  },
  // Avatar
  avatarSection: {
    alignItems: 'center',
    paddingTop: 32,
    paddingBottom: 24,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: CARD_BG,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  changePhotoText: {
    color: ACCENT,
    fontSize: 15,
    fontWeight: '600',
  },
  // Form
  formSection: {
    paddingHorizontal: 16,
  },
  fieldContainer: {
    marginBottom: 20,
  },
  fieldLabel: {
    color: '#9CA3AF',
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 6,
    marginLeft: 4,
  },
  inputCard: {
    backgroundColor: CARD_BG,
    borderRadius: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
    paddingVertical: 14,
  },
  inputDisabled: {
    opacity: 0.6,
  },
  inputDisabledText: {
    color: '#6B7280',
  },
  usernamePrefix: {
    color: '#6B7280',
    fontSize: 16,
    marginRight: 2,
  },
  bioLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
    marginLeft: 4,
    marginRight: 4,
  },
  charCounter: {
    color: '#6B7280',
    fontSize: 12,
  },
  bioInput: {
    height: 100,
    paddingTop: 14,
  },
});
