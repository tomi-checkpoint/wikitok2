import React, { useState } from 'react';
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
import { signInWithEmail } from '../../src/lib/auth';
import { useAuthGateContext } from '../_layout';

export default function LoginScreen() {
  const router = useRouter();
  const { skipAuth } = useAuthGateContext();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      setError('Please enter your email and password.');
      return;
    }
    setLoading(true);
    setError('');
    const result = await signInWithEmail(email.trim(), password);
    setLoading(false);
    if (result.error) {
      setError(result.error);
    }
    // On success, auth state change in root layout will handle navigation
  };

  // OAuth providers removed — requires developer app credentials to be configured

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
        {/* Branding */}
        <View style={styles.brandingContainer}>
          <View style={styles.logoRow}>
            <Ionicons name="book" size={40} color="#38BDF8" />
            <Text style={styles.logoText}>WikiTok</Text>
          </View>
          <Text style={styles.tagline}>Discover the world's knowledge</Text>
        </View>

        {/* Email & Password */}
        <View style={styles.formContainer}>
          <TextInput
            style={styles.input}
            placeholder="Email address"
            placeholderTextColor="#6B7280"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <View style={styles.passwordContainer}>
            <TextInput
              style={styles.passwordInput}
              placeholder="Password"
              placeholderTextColor="#6B7280"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
            />
            <TouchableOpacity
              style={styles.eyeButton}
              onPress={() => setShowPassword(!showPassword)}
            >
              <Ionicons
                name={showPassword ? 'eye-off' : 'eye'}
                size={20}
                color="#6B7280"
              />
            </TouchableOpacity>
          </View>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <TouchableOpacity
            style={[styles.loginButton, loading && styles.loginButtonDisabled]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color="#000" />
            ) : (
              <Text style={styles.loginButtonText}>Log In</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Footer Links */}
        <View style={styles.footerContainer}>
          <TouchableOpacity onPress={() => router.push('/(auth)/signup')}>
            <Text style={styles.footerLink}>Create Account</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => router.push('/(auth)/forgot-password')}
          >
            <Text style={styles.footerLinkSecondary}>Forgot Password?</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={skipAuth}
            style={styles.skipButton}
          >
            <Text style={styles.skipButtonText}>Continue without account</Text>
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
    paddingTop: Platform.OS === 'ios' ? 60 : 20,
    paddingBottom: 40,
    justifyContent: 'center',
  },
  brandingContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  logoText: {
    fontSize: 32,
    fontWeight: '700',
    color: '#fff',
    marginLeft: 10,
  },
  tagline: {
    fontSize: 16,
    color: '#9CA3AF',
  },
  socialContainer: {
    marginBottom: 24,
  },
  socialButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 52,
    borderRadius: 12,
    marginBottom: 12,
  },
  socialIcon: {
    marginRight: 10,
  },
  socialButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#1F2937',
  },
  dividerText: {
    color: '#6B7280',
    fontSize: 14,
    marginHorizontal: 16,
  },
  formContainer: {
    marginBottom: 24,
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
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1F2937',
    borderRadius: 12,
    marginBottom: 12,
  },
  passwordInput: {
    flex: 1,
    height: 52,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#fff',
  },
  eyeButton: {
    paddingHorizontal: 16,
    height: 52,
    justifyContent: 'center',
  },
  errorText: {
    color: '#EF4444',
    fontSize: 14,
    marginBottom: 12,
  },
  loginButton: {
    height: 52,
    backgroundColor: '#38BDF8',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loginButtonDisabled: {
    opacity: 0.7,
  },
  loginButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000',
  },
  footerContainer: {
    alignItems: 'center',
  },
  footerLink: {
    fontSize: 16,
    fontWeight: '600',
    color: '#38BDF8',
    marginBottom: 16,
  },
  footerLinkSecondary: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  skipButton: {
    marginTop: 32,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: '#374151',
    borderRadius: 12,
    alignItems: 'center',
  },
  skipButtonText: {
    fontSize: 15,
    color: '#6B7280',
    fontWeight: '500',
  },
});
