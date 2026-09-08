import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { DbProfile } from '../types/database';

export interface ServiceResult<T> {
  data: T | null;
  error: string | null;
}

export const profileService = {
  /**
   * Get the profile for the currently authenticated Supabase user
   */
  async getCurrentProfile(): Promise<ServiceResult<DbProfile>> {
    if (!isSupabaseConfigured()) {
      return { data: null, error: 'Database service is not configured.' };
    }

    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        return { data: null, error: 'User is not authenticated.' };
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (error) {
        return { data: null, error: formatDbError(error) };
      }

      return { data, error: null };
    } catch (err: any) {
      return { data: null, error: err.message || 'Network error retrieving profile.' };
    }
  },

  /**
   * Look up profile by CLI user ID (e.g. "shadow")
   */
  async getProfileByCliUserId(cliUserId: string): Promise<ServiceResult<DbProfile>> {
    if (!isSupabaseConfigured()) {
      return { data: null, error: 'Database service is not configured.' };
    }

    try {
      const normalized = cliUserId.trim().toLowerCase();
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', normalized)
        .maybeSingle();

      if (error) {
        return { data: null, error: formatDbError(error) };
      }

      return { data, error: null };
    } catch (err: any) {
      return { data: null, error: err.message || 'Network error retrieving profile.' };
    }
  },

  /**
   * Create or update profile for an authenticated user
   */
  async upsertProfile(profile: { id: string; user_id: string; display_name?: string }): Promise<ServiceResult<DbProfile>> {
    if (!isSupabaseConfigured()) {
      return { data: null, error: 'Database service is not configured.' };
    }

    try {
      const { data, error } = await supabase
        .from('profiles')
        .upsert(
          {
            id: profile.id,
            user_id: profile.user_id.toLowerCase(),
            display_name: profile.display_name || profile.user_id,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'id' }
        )
        .select()
        .single();

      if (error) {
        return { data: null, error: formatDbError(error) };
      }

      return { data, error: null };
    } catch (err: any) {
      return { data: null, error: err.message || 'Network error updating profile.' };
    }
  },
};

/**
 * Format PostgreSQL/Supabase errors into clean terminal-friendly messages
 */
export function formatDbError(error: any): string {
  if (!error) return 'Unknown database error.';
  const code = error.code || '';
  const msg = error.message || '';

  if (code === '42501' || msg.includes('row-level security')) {
    return 'Database permission denied by Row Level Security (RLS) policy.';
  }
  if (code === '23505' || msg.includes('duplicate key') || msg.includes('already exists')) {
    return 'Record already exists in the database.';
  }
  if (code === '23503' || msg.includes('foreign key')) {
    return 'Database constraint error: related profile or parent record not found.';
  }
  if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) {
    return 'Network failure connecting to Supabase database.';
  }
  return msg || 'Database operation failed.';
}
