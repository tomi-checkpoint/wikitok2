import { supabase } from './supabase';

type AuthResult<T = unknown> = {
  data: T | null;
  error: string | null;
};

/**
 * Maps raw Supabase error messages to user-friendly strings.
 */
function friendlyError(err: unknown): string {
  const msg =
    err instanceof Error
      ? err.message
      : typeof err === 'string'
        ? err
        : 'Something went wrong. Please try again.';

  // Common Supabase auth error messages
  if (msg.includes('Invalid login credentials'))
    return 'Incorrect email or password.';
  if (msg.includes('User already registered'))
    return 'An account with this email already exists.';
  if (msg.includes('Email not confirmed'))
    return 'Please check your email and confirm your account.';
  if (msg.includes('Password should be at least'))
    return 'Password must be at least 6 characters.';
  if (msg.includes('Email rate limit exceeded'))
    return 'Too many attempts. Please wait a moment and try again.';
  if (msg.includes('network') || msg.includes('fetch'))
    return 'Network error. Please check your connection.';

  return msg;
}

/**
 * Sign up a new user with email and password.
 */
export async function signUpWithEmail(
  email: string,
  password: string,
): Promise<AuthResult> {
  try {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) return { data: null, error: friendlyError(error.message) };
    return { data, error: null };
  } catch (err) {
    return { data: null, error: friendlyError(err) };
  }
}

/**
 * Sign in an existing user with email and password.
 */
export async function signInWithEmail(
  email: string,
  password: string,
): Promise<AuthResult> {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) return { data: null, error: friendlyError(error.message) };
    return { data, error: null };
  } catch (err) {
    return { data: null, error: friendlyError(err) };
  }
}

/**
 * Sign in with a third-party OAuth provider.
 */
export async function signInWithOAuth(
  provider: 'apple' | 'google' | 'github',
): Promise<AuthResult> {
  try {
    const { data, error } = await supabase.auth.signInWithOAuth({ provider });
    if (error) return { data: null, error: friendlyError(error.message) };
    return { data, error: null };
  } catch (err) {
    return { data: null, error: friendlyError(err) };
  }
}

/**
 * Sign out the current user.
 */
export async function signOut(): Promise<AuthResult> {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) return { data: null, error: friendlyError(error.message) };
    return { data: null, error: null };
  } catch (err) {
    return { data: null, error: friendlyError(err) };
  }
}

/**
 * Send a password reset email.
 */
export async function resetPassword(email: string): Promise<AuthResult> {
  try {
    const { data, error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) return { data: null, error: friendlyError(error.message) };
    return { data, error: null };
  } catch (err) {
    return { data: null, error: friendlyError(err) };
  }
}

/**
 * Get the current auth session.
 */
export async function getSession(): Promise<AuthResult> {
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) return { data: null, error: friendlyError(error.message) };
    return { data, error: null };
  } catch (err) {
    return { data: null, error: friendlyError(err) };
  }
}

/**
 * Subscribe to auth state changes.
 * Returns an unsubscribe function.
 */
export function onAuthStateChange(
  callback: (event: string, session: unknown) => void,
) {
  const { data } = supabase.auth.onAuthStateChange(callback);
  return data.subscription.unsubscribe;
}

/**
 * Create a user profile in the profiles table.
 */
export async function createProfile(
  userId: string,
  username: string,
  displayName?: string,
): Promise<AuthResult> {
  try {
    const { data, error } = await supabase.from('profiles').insert({
      id: userId,
      username,
      display_name: displayName || username,
    });
    if (error) {
      if (error.message.includes('duplicate') || error.code === '23505') {
        return { data: null, error: 'This username is already taken.' };
      }
      return { data: null, error: friendlyError(error.message) };
    }
    return { data, error: null };
  } catch (err) {
    return { data: null, error: friendlyError(err) };
  }
}

/**
 * Check if a username is available.
 */
export async function checkUsernameAvailable(
  username: string,
): Promise<AuthResult<boolean>> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id')
      .eq('username', username)
      .maybeSingle();
    if (error) return { data: null, error: friendlyError(error.message) };
    return { data: data === null, error: null };
  } catch (err) {
    return { data: null, error: friendlyError(err) };
  }
}

/**
 * Get the profile for the currently authenticated user.
 */
export async function getCurrentProfile(): Promise<AuthResult> {
  try {
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();
    if (sessionError)
      return { data: null, error: friendlyError(sessionError.message) };
    if (!session?.user)
      return { data: null, error: 'Not signed in.' };

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .maybeSingle();
    if (error) return { data: null, error: friendlyError(error.message) };
    return { data, error: null };
  } catch (err) {
    return { data: null, error: friendlyError(err) };
  }
}
