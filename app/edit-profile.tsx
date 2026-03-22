import React, { useState, useEffect } from 'react';
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
  Image,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { supabase } from '../src/lib/supabase';

const ACCENT = '#38BDF8';
const CARD_BG = '#1F2937';
const BIO_MAX = 160;

export default function EditProfileScreen() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const { data } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .maybeSingle();
        if (data) {
          setDisplayName(data.display_name || '');
          setUsername(data.username || '');
          setBio(data.bio || '');
          setAvatarUrl(data.avatar_url || null);
        }
      }
    } catch {
      // ignore load errors
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const { error } = await supabase
          .from('profiles')
          .update({ display_name: displayName, bio })
          .eq('id', session.user.id);
        if (error) {
          Alert.alert('Error', 'Failed to save profile. Please try again.');
          return;
        }
        Alert.alert('Saved', 'Profile updated successfully.');
        router.back();
      } else {
        Alert.alert('Error', 'You must be signed in to save your profile.');
      }
    } catch {
      Alert.alert('Error', 'Failed to save profile. Please try again.');
    }
  };

  const uploadAvatarBlob = async (blob: Blob, ext: string) => {
    setUploading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        Alert.alert('Error', 'Not signed in.');
        setUploading(false);
        return;
      }
      const fileName = `${session.user.id}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, blob, { upsert: true, contentType: `image/${ext}` });
      if (uploadError) {
        Alert.alert('Upload failed', uploadError.message);
        setUploading(false);
        return;
      }
      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(fileName);
      const publicUrl = urlData.publicUrl + '?t=' + Date.now(); // cache bust
      await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', session.user.id);
      setAvatarUrl(publicUrl);
    } catch {
      Alert.alert('Error', 'Failed to upload photo.');
    } finally {
      setUploading(false);
    }
  };

  const handleChangePhoto = async () => {
    if (Platform.OS === 'web') {
      // Web: use native file input
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = async (e: any) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const ext = file.name.split('.').pop() || 'jpg';
        await uploadAvatarBlob(file, ext);
      };
      input.click();
      return;
    }
    // Native: use expo-image-picker
    try {
      const ImagePicker = require('expo-image-picker');
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please grant camera roll access.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      const ext = asset.uri.split('.').pop() || 'jpg';
      const response = await fetch(asset.uri);
      const blob = await response.blob();
      await uploadAvatarBlob(blob, ext);
    } catch {
      Alert.alert('Error', 'Failed to pick photo.');
    }
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
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
            ) : (
              <Ionicons name="person" size={40} color="#6B7280" />
            )}
            {uploading ? (
              <View style={styles.avatarOverlay}>
                <ActivityIndicator color="#fff" />
              </View>
            ) : null}
          </View>
          <TouchableOpacity activeOpacity={0.7} onPress={handleChangePhoto} disabled={uploading}>
            <Text style={styles.changePhotoText}>{uploading ? 'Uploading...' : 'Change Photo'}</Text>
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
    overflow: 'hidden',
  },
  avatarImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  avatarOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 40,
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
