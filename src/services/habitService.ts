import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { Habit } from '../types';
import { DbHabit } from '../types/database';
import { calculateHabitStreaks } from '../utils/date';
import { generateUUID } from '../utils/storage';
import { formatDbError, ServiceResult } from './profileService';
import { habitCompletionService } from './habitCompletionService';

export const habitService = {
  /**
   * Fetch all habits and their completions for the authenticated user
   */
  async fetchHabits(): Promise<ServiceResult<Habit[]>> {
    if (!isSupabaseConfigured()) {
      return { data: null, error: 'Supabase client is not configured.' };
    }

    try {
      const { data: { user }, error: authErr } = await supabase.auth.getUser();
      if (authErr || !user) {
        return { data: null, error: 'Unauthenticated: No active Supabase session.' };
      }

      const { data: dbHabits, error: habitsError } = await supabase
        .from('habits')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });

      if (habitsError) {
        return { data: null, error: formatDbError(habitsError) };
      }

      const habitsList = (dbHabits as DbHabit[]) || [];
      if (habitsList.length === 0) {
        return { data: [], error: null };
      }

      const habitIds = habitsList.map((h) => h.id);
      const completionsResult = await habitCompletionService.fetchCompletionsForHabits(habitIds);

      // Build map of completions per habit
      const completionsByHabit: Record<string, Record<string, boolean>> = {};
      habitIds.forEach((id) => {
        completionsByHabit[id] = {};
      });

      if (completionsResult.data) {
        completionsResult.data.forEach((c) => {
          if (completionsByHabit[c.habit_id]) {
            completionsByHabit[c.habit_id][c.completed_date] = true;
          }
        });
      }

      const domainHabits: Habit[] = habitsList.map((h) => {
        const history = completionsByHabit[h.id] || {};
        const streaks = calculateHabitStreaks(history);
        return {
          id: h.id,
          name: h.name,
          createdAt: h.created_at,
          history,
          currentStreak: streaks.currentStreak,
          bestStreak: streaks.bestStreak,
        };
      });

      return { data: domainHabits, error: null };
    } catch (err: any) {
      return { data: null, error: err.message || 'Network error fetching habits from database.' };
    }
  },

  /**
   * Create a new habit
   */
  async createHabit(name: string, customId?: string): Promise<ServiceResult<Habit>> {
    if (!isSupabaseConfigured()) {
      return { data: null, error: 'Supabase client is not configured.' };
    }

    try {
      const { data: { user }, error: authErr } = await supabase.auth.getUser();
      if (authErr || !user) {
        return { data: null, error: 'Unauthenticated: Cannot create habit without active Supabase session.' };
      }

      const id = customId || generateUUID();
      const createdAt = new Date().toISOString();

      const { data, error } = await supabase
        .from('habits')
        .insert({
          id,
          user_id: user.id,
          name: name.trim(),
          created_at: createdAt,
          updated_at: createdAt,
        })
        .select()
        .single();

      if (error) {
        return { data: null, error: formatDbError(error) };
      }

      const created = data as DbHabit;
      return {
        data: {
          id: created.id,
          name: created.name,
          createdAt: created.created_at,
          history: {},
          currentStreak: 0,
          bestStreak: 0,
        },
        error: null,
      };
    } catch (err: any) {
      return { data: null, error: err.message || 'Network error creating habit.' };
    }
  },

  /**
   * Rename an existing habit
   */
  async renameHabit(habitId: string, newName: string): Promise<ServiceResult<boolean>> {
    if (!isSupabaseConfigured()) {
      return { data: false, error: 'Supabase client is not configured.' };
    }

    try {
      const { data: { user }, error: authErr } = await supabase.auth.getUser();
      if (authErr || !user) {
        return { data: false, error: 'Unauthenticated: Cannot rename habit without active Supabase session.' };
      }

      const { error } = await supabase
        .from('habits')
        .update({
          name: newName.trim(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', habitId)
        .eq('user_id', user.id);

      if (error) {
        return { data: false, error: formatDbError(error) };
      }

      return { data: true, error: null };
    } catch (err: any) {
      return { data: false, error: err.message || 'Network error renaming habit.' };
    }
  },

  /**
   * Delete a habit and its completions
   */
  async deleteHabit(habitId: string): Promise<ServiceResult<boolean>> {
    if (!isSupabaseConfigured()) {
      return { data: false, error: 'Supabase client is not configured.' };
    }

    try {
      const { data: { user }, error: authErr } = await supabase.auth.getUser();
      if (authErr || !user) {
        return { data: false, error: 'Unauthenticated: Cannot delete habit without active Supabase session.' };
      }

      // Delete habit completions first in case cascade is not defined
      await supabase.from('habit_completions').delete().eq('habit_id', habitId);

      const { error } = await supabase
        .from('habits')
        .delete()
        .eq('id', habitId)
        .eq('user_id', user.id);

      if (error) {
        return { data: false, error: formatDbError(error) };
      }

      return { data: true, error: null };
    } catch (err: any) {
      return { data: false, error: err.message || 'Network error deleting habit.' };
    }
  },

  /**
   * Record habit completion for a habit in Supabase
   */
  async markHabitDone(habitId: string, dateStr: string): Promise<ServiceResult<boolean>> {
    const res = await habitCompletionService.recordCompletion(habitId, dateStr);
    if (res.error) {
      return { data: false, error: res.error };
    }
    return { data: true, error: null };
  },

  /**
   * Migrate/sync a list of habits and their completion history into Supabase
   */
  async batchSyncHabits(habits: Habit[]): Promise<ServiceResult<number>> {
    if (!isSupabaseConfigured()) {
      return { data: 0, error: 'Supabase client is not configured.' };
    }

    try {
      const { data: { user }, error: authErr } = await supabase.auth.getUser();
      if (authErr || !user) {
        return { data: 0, error: 'Unauthenticated: Cannot sync habits without active Supabase session.' };
      }

      if (habits.length === 0) {
        return { data: 0, error: null };
      }

      const now = new Date().toISOString();
      const dbRows = habits.map((h) => ({
        id: h.id,
        user_id: user.id,
        name: h.name.trim(),
        created_at: h.createdAt || now,
        updated_at: now,
      }));

      const { error } = await supabase
        .from('habits')
        .upsert(dbRows, { onConflict: 'id' });

      if (error) {
        return { data: 0, error: formatDbError(error) };
      }

      // Sync historical completions
      for (const h of habits) {
        if (h.history) {
          const dates = Object.keys(h.history).filter((d) => h.history[d]);
          for (const d of dates) {
            await habitCompletionService.recordCompletion(h.id, d);
          }
        }
      }

      return { data: habits.length, error: null };
    } catch (err: any) {
      return { data: 0, error: err.message || 'Network error syncing habits.' };
    }
  },
};
