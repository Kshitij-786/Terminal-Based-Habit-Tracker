import { User, Session } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { profileService, formatDbError, ServiceResult } from './profileService';
import { DbProfile } from '../types/database';

export interface AuthSuccessResult {
  user: User;
  session: Session | null;
  profile: DbProfile | null;
}

/**
 * Maps a CLI user ID (e.g. "shadow") to a valid email format for Supabase Auth.
 * If the user ID is already an email, it is preserved.
 */
export function mapCliUserIdToEmail(cliUserId: string): string {
  const trimmed = cliUserId.trim().toLowerCase();
  if (trimmed.includes('@')) {
    return trimmed;
  }
  return `${trimmed}@habitos.app`;
}

export const authService = {
  /**
   * Check if Supabase client is properly configured with valid keys
   */
  isConfigured(): boolean {
    return isSupabaseConfigured();
  },

  /**
   * Get the current active Supabase Auth session
   */
  async getSession(): Promise<Session | null> {
    if (!isSupabaseConfigured()) return null;
    try {
      const { data } = await supabase.auth.getSession();
      return data.session;
    } catch {
      return null;
    }
  },

  /**
   * Get the current authenticated Supabase user
   */
  async getCurrentUser(): Promise<User | null> {
    if (!isSupabaseConfigured()) return null;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      return user;
    } catch {
      return null;
    }
  },

  /**
   * Register a new user in Supabase Auth and initialize their profiles record.
   * Maps CLI user ID -> Supabase Auth email identity -> profiles row.
   */
  async signUp(cliUserId: string, rawPassword: string): Promise<ServiceResult<AuthSuccessResult>> {
    if (!isSupabaseConfigured()) {
      return { data: null, error: 'Supabase client is not configured.' };
    }

    try {
      const email = mapCliUserIdToEmail(cliUserId);
      const normalizedUserId = cliUserId.trim().toLowerCase();

      const { data, error } = await supabase.auth.signUp({
        email,
        password: rawPassword,
        options: {
          data: {
            cli_user_id: normalizedUserId,
            display_name: cliUserId.trim(),
          },
        },
      });

      // Requirement 9: If user already exists in Supabase Auth, sign into existing account
      const isAlreadyRegistered =
        (error && (
          error.message?.toLowerCase().includes('already registered') ||
          error.message?.toLowerCase().includes('already exists') ||
          (error as any).status === 422
        )) ||
        (data?.user && (!data.user.identities || data.user.identities.length === 0));

      if (isAlreadyRegistered) {
        const signInRes = await supabase.auth.signInWithPassword({
          email,
          password: rawPassword,
        });

        if (signInRes.error) {
          if (signInRes.error.message?.toLowerCase().includes('email not confirmed') || (signInRes.error as any).code === 'email_not_confirmed') {
            return {
              data: null,
              error: 'Email confirmation is enabled in Supabase project settings. Please disable "Confirm email" in Supabase Dashboard -> Authentication -> Providers -> Email for synthetic accounts.',
            };
          }
          return { data: null, error: formatDbError(signInRes.error) };
        }

        if (signInRes.data?.user && signInRes.data?.session) {
          let profile: DbProfile | null = null;
          const profileRes = await profileService.getCurrentProfile();
          if (profileRes.data) {
            profile = profileRes.data;
          } else {
            const createProfileRes = await profileService.upsertProfile({
              id: signInRes.data.user.id,
              user_id: normalizedUserId,
              display_name: cliUserId.trim(),
            });
            profile = createProfileRes.data;
          }

          return {
            data: {
              user: signInRes.data.user,
              session: signInRes.data.session,
              profile,
            },
            error: null,
          };
        }
      }

      if (error) {
        return { data: null, error: formatDbError(error) };
      }

      if (!data.user) {
        return { data: null, error: 'Failed to create user account.' };
      }

      let activeSession = data.session;
      if (!activeSession) {
        // Attempt immediate login to obtain active session
        const loginRes = await supabase.auth.signInWithPassword({
          email,
          password: rawPassword,
        });
        if (loginRes.data?.session) {
          activeSession = loginRes.data.session;
        } else if (loginRes.error) {
          if (loginRes.error.message?.toLowerCase().includes('email not confirmed') || (loginRes.error as any).code === 'email_not_confirmed') {
            return {
              data: null,
              error: 'User created, but Supabase project requires email confirmation. In Supabase Dashboard -> Authentication -> Providers -> Email, please toggle "Confirm email" to OFF for synthetic accounts.',
            };
          }
        }
      }

      // Prepare profile entry linked directly to auth.users.id
      let profile: DbProfile | null = null;
      if (activeSession) {
        const profileRes = await profileService.upsertProfile({
          id: data.user.id,
          user_id: normalizedUserId,
          display_name: cliUserId.trim(),
        });
        profile = profileRes.data;
      }

      return {
        data: {
          user: data.user,
          session: activeSession,
          profile,
        },
        error: null,
      };
    } catch (err: any) {
      return { data: null, error: err.message || 'Network error during registration.' };
    }
  },

  /**
   * Sign in user with CLI credentials via Supabase Auth
   */
  async signIn(cliUserId: string, rawPassword: string): Promise<ServiceResult<AuthSuccessResult>> {
    if (!isSupabaseConfigured()) {
      return { data: null, error: 'Supabase client is not configured.' };
    }

    try {
      const email = mapCliUserIdToEmail(cliUserId);
      const normalizedUserId = cliUserId.trim().toLowerCase();

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password: rawPassword,
      });

      if (error) {
        return { data: null, error: formatDbError(error) };
      }

      if (!data.user) {
        return { data: null, error: 'Authentication failed.' };
      }

      // Ensure profile exists
      let profile: DbProfile | null = null;
      const profileRes = await profileService.getCurrentProfile();
      if (profileRes.data) {
        profile = profileRes.data;
      } else {
        const createProfileRes = await profileService.upsertProfile({
          id: data.user.id,
          user_id: normalizedUserId,
          display_name: cliUserId.trim(),
        });
        profile = createProfileRes.data;
      }

      return {
        data: {
          user: data.user,
          session: data.session,
          profile,
        },
        error: null,
      };
    } catch (err: any) {
      return { data: null, error: err.message || 'Network error during authentication.' };
    }
  },

  /**
   * Sign out the active Supabase user session
   */
  async signOut(): Promise<void> {
    if (!isSupabaseConfigured()) return;
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.error('Error signing out of Supabase:', err);
    }
  },
};
