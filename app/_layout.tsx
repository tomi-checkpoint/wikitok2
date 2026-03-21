import React, { useEffect, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, StyleSheet, ActivityIndicator, Text } from 'react-native';
import { AppProvider, useApp } from '../src/store/AppContext';
import ArticleViewer from '../src/components/ArticleViewer';
import { supabase, isSupabaseConfigured } from '../src/lib/supabase';
import { Session } from '@supabase/supabase-js';

const ACCENT = '#38BDF8';

type AuthState = 'loading' | 'unauthenticated' | 'needs_profile' | 'authenticated';

function useAuthGate() {
  const [authState, setAuthState] = useState<AuthState>('loading');
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      // No Supabase configured — skip auth, go straight to app
      setAuthState('authenticated');
      return;
    }

    // Check initial session
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      if (!s) {
        setAuthState('unauthenticated');
      } else {
        // Check if user has a profile
        checkProfile(s.user.id);
      }
    });

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, s) => {
        setSession(s);
        if (!s) {
          setAuthState('unauthenticated');
        } else {
          await checkProfile(s.user.id);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  async function checkProfile(userId: string) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username')
        .eq('id', userId)
        .maybeSingle();

      if (error || !data) {
        setAuthState('needs_profile');
      } else {
        setAuthState('authenticated');
      }
    } catch {
      setAuthState('needs_profile');
    }
  }

  return { authState, session };
}

function RootContent() {
  const { articleViewer, closeViewer } = useApp();
  const { authState } = useAuthGate();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (authState === 'loading') return;

    const inAuthGroup = segments[0] === '(auth)';

    if (authState === 'unauthenticated' && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (authState === 'needs_profile' && segments[1] !== 'username') {
      router.replace('/(auth)/username');
    } else if (authState === 'authenticated' && inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [authState, segments]);

  if (authState === 'loading') {
    return (
      <View style={styles.loadingScreen}>
        <StatusBar style="light" />
        <ActivityIndicator size="large" color={ACCENT} />
        <Text style={styles.loadingText}>WikiTok</Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="edit-profile"
          options={{ presentation: 'card' }}
        />
      </Stack>
      {articleViewer ? (
        <ArticleViewer article={articleViewer} onClose={closeViewer} />
      ) : null}
    </View>
  );
}

export default function RootLayout() {
  return (
    <AppProvider>
      <RootContent />
    </AppProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  loadingScreen: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '700',
    marginTop: 16,
  },
});
