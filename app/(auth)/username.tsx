import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import {
  checkUsernameAvailable,
  createProfile,
  getSession,
} from '../../src/lib/auth';

function validateUsername(value: string): string | null {
  if (value.length < 3) return 'Must be at least 3 characters';
  if (value.length > 20) return 'Must be 20 characters or fewer';
  if (!/^[a-zA-Z0-9_]+$/.test(value))
    return 'Only letters, numbers, and underscores';
  return null;
}

export default function UsernameScreen() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [checking, setChecking] = useState(false);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const validationError = username.length > 0 ? validateUsername(username) : null;

  const handleUsernameChange = useCallback(
    async (value: string) => {
      const clean = value.toLowerCase().replace(/[^a-z0-9_]/g, '');
      setUsername(clean);
      setAvailable(null);
      setError('');

      if (clean.length < 3) return;
      if (validateUsername(clean)) return;

      setChecking(true);
      const result = await checkUsernameAvailable(clean);
      setChecking(false);
      if (result.error) {
        setError(result.error);
      } else {
        setAvailable(result.data ?? false);
      }
    },
    [],
  );

  const handleContinue = async () => {
    if (validationError || !available) return;

    setLoading(true);
    setError('');

    const sessionResult = await getSession();
    if (sessionResult.error || !sessionResult.data?.session?.user) {
      setError('Session expired. Please log in again.');
      setLoading(false);
      return;
    }

    const userId = sessionResult.data.session.user.id;
    const result = await createProfile(
      userId,
      username,
      displayName.trim() || undefined,
    );
    setLoading(false);

    if (result.error) {
      setError(result.error);
    } else {
      // Profile created, auth state listener in root layout will navigate to tabs
      router.replace('/(tabs)');
    }
  };

  const canSubmit =
    username.length >= 3 && !validationError && available === true && !loading;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Text style={styles.header}>Choose your username</Text>
        <Text style={styles.subtitle}>
          This is how other users will find and mention you.
        </Text>

        {/* Username Input */}
        <View style={styles.formContainer}>
          <View style={styles.usernameRow}>
            <Text style={styles.atPrefix}>@</Text>
            <TextInput
              style={styles.usernameInput}
              placeholder="username"
              placeholderTextColor="#6B7280"
              value={username}
              onChangeText={handleUsernameChange}
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={20}
            />
            {checking && (
              <ActivityIndicator
                size="small"
                color="#6B7280"
                style={styles.checkingIndicator}
              />
            )}
            {!checking && available === true && (
              <Ionicons
                name="checkmark-circle"
                size={22}
                color="#22C55E"
                style={styles.checkingIndicator}
              />
            )}
            {!checking && available === false && (
              <Ionicons
                name="close-circle"
                size={22}
                color="#EF4444"
                style={styles.checkingIndicator}
              />
            )}
          </View>

          {/* Validation Feedback */}
          {validationError && username.length > 0 ? (
            <Text style={styles.validationError}>{validationError}</Text>
          ) : available === false ? (
            <Text style={styles.validationError}>
              This username is already taken
            </Text>
          ) : available === true ? (
            <Text style={styles.validationSuccess}>Username is available</Text>
          ) : null}

          {/* Display Name */}
          <TextInput
            style={styles.input}
            placeholder="Display name (optional)"
            placeholderTextColor="#6B7280"
            value={displayName}
            onChangeText={setDisplayName}
            maxLength={50}
          />

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <TouchableOpacity
            style={[
              styles.continueButton,
              !canSubmit && styles.continueButtonDisabled,
            ]}
            onPress={handleContinue}
            disabled={!canSubmit}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color="#000" />
            ) : (
              <Text style={styles.continueButtonText}>Continue</Text>
            )}
          </TouchableOpacity>
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
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: Platform.OS === 'ios' ? 80 : 40,
    paddingBottom: 40,
  },
  header: {
    fontSize: 32,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#9CA3AF',
    marginBottom: 32,
  },
  formContainer: {
    marginBottom: 32,
  },
  usernameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1F2937',
    borderRadius: 12,
    marginBottom: 8,
    height: 52,
  },
  atPrefix: {
    fontSize: 18,
    fontWeight: '600',
    color: '#9CA3AF',
    paddingLeft: 16,
    paddingRight: 4,
  },
  usernameInput: {
    flex: 1,
    height: 52,
    fontSize: 16,
    color: '#fff',
    paddingRight: 16,
  },
  checkingIndicator: {
    marginRight: 16,
  },
  validationError: {
    fontSize: 13,
    color: '#EF4444',
    marginBottom: 16,
    marginLeft: 4,
  },
  validationSuccess: {
    fontSize: 13,
    color: '#22C55E',
    marginBottom: 16,
    marginLeft: 4,
  },
  input: {
    height: 52,
    backgroundColor: '#1F2937',
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#fff',
    marginBottom: 12,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 14,
    marginBottom: 12,
  },
  continueButton: {
    height: 52,
    backgroundColor: '#38BDF8',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  continueButtonDisabled: {
    opacity: 0.4,
  },
  continueButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000',
  },
});
