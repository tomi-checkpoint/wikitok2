import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, StyleSheet, ActivityIndicator, Text } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AppProvider, useApp } from '../src/store/AppContext';
import ErrorBoundary from '../src/components/ErrorBoundary';
import ArticleViewer from '../src/components/ArticleViewer';
import { supabase, isSupabaseConfigured } from '../src/lib/supabase';
import { ThemeProvider } from '../src/store/ThemeContext';
import { Session } from '@supabase/supabase-js';

const ACCENT = '#38BDF8';

type AuthState = 'loading' | 'unauthenticated' | 'needs_profile' | 'authenticated';

// Context to expose recheckProfile to auth screens
const AuthGateContext = createContext<{ recheckProfile: () => Promise<void> }>({
  recheckProfile: async () => {},
});
export function useAuthGateContext() {
  return useContext(AuthGateContext);
}

function useAuthGate() {
  const [authState, setAuthState] = useState<AuthState>('loading');
  const [session, setSession] = useState<Session | null>(null);
  // Track if user has ever reached 'authenticated' state in this session.
  // On transient profile-check failures, we keep them authenticated
  // instead of incorrectly showing the username screen.
  const hasEverAuthenticated = useRef(false);

  // Wrapper that tracks when user becomes authenticated
  const setAuthStateTracked = useCallback((newState: AuthState) => {
    if (newState === 'authenticated') {
      hasEverAuthenticated.current = true;
    }
    setAuthState(newState);
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setAuthStateTracked('authenticated');
      return;
    }

    let mounted = true;

    // Race session check against a 5-second timeout
    const timeout = setTimeout(() => {
      if (mounted && authState === 'loading') {
        if (__DEV__) console.warn('Auth check timed out');
        setAuthStateTracked('unauthenticated');
      }
    }, 5000);

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      if (!mounted) return;
      clearTimeout(timeout);
      setSession(s);
      if (!s) {
        setAuthStateTracked('unauthenticated');
      } else {
        checkProfile(s.user.id);
      }
    }).catch(() => {
      if (!mounted) return;
      clearTimeout(timeout);
      setAuthStateTracked('unauthenticated');
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, s) => {
        if (!mounted) return;
        setSession(s);
        if (!s) {
          setAuthStateTracked('unauthenticated');
        } else {
          await checkProfile(s.user.id);
        }
      }
    );

    return () => {
      mounted = false;
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, []);

  async function checkProfile(userId: string) {
    try {
      const profilePromise = supabase
        .from('profiles')
        .select('id, username')
        .eq('id', userId)
        .maybeSingle();

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Profile check timeout')), 5000)
      );

      const { data, error } = await Promise.race([profilePromise, timeoutPromise]) as any;

      if (error || !data) {
        // If user was previously authenticated, a transient failure
        // should NOT kick them to the username screen
        if (hasEverAuthenticated.current) {
          setAuthStateTracked('authenticated');
        } else {
          setAuthStateTracked('needs_profile');
        }
      } else {
        setAuthStateTracked('authenticated');
      }
    } catch {
      // Timeout or network error
      if (hasEverAuthenticated.current) {
        // User already had a profile — keep them authenticated
        setAuthStateTracked('authenticated');
      } else {
        // First-time signup — show username screen
        setAuthStateTracked('needs_profile');
      }
    }
  }

  const recheckProfile = useCallback(async () => {
    if (!isSupabaseConfigured) return;
    const { data: { session: s } } = await supabase.auth.getSession();
    if (s) {
      await checkProfile(s.user.id);
    }
  }, []);

  return { authState, session, recheckProfile };
}

function RootContent() {
  const { articleViewer, closeViewer } = useApp();
  const { authState, recheckProfile } = useAuthGate();
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
    <AuthGateContext.Provider value={{ recheckProfile }}>
      <View style={styles.root}>
        <StatusBar style="light" />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen
            name="edit-profile"
            options={{ presentation: 'card' }}
          />
          <Stack.Screen
            name="privacy-settings"
            options={{ presentation: 'card' }}
          />
          <Stack.Screen
            name="notification-settings"
            options={{ presentation: 'card' }}
          />
          <Stack.Screen
            name="about"
            options={{ presentation: 'card' }}
          />
        </Stack>
        {articleViewer ? (
          <ArticleViewer article={articleViewer} onClose={closeViewer} />
        ) : null}
      </View>
    </AuthGateContext.Provider>
  );
}

export default function RootLayout() {
  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <ThemeProvider>
          <AppProvider>
            <RootContent />
          </AppProvider>
        </ThemeProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
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
