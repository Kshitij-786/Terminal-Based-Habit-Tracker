import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { generateUUID } from '../utils/storage';
import { formatDbError, ServiceResult } from './profileService';
import { DbHabitCompletion } from '../types/database';

export const habitCompletionService = {
  /**
   * Fetch all completions for a specific habit
   */
  async fetchCompletions(habitId: string): Promise<ServiceResult<DbHabitCompletion[]>> {
    if (!isSupabaseConfigured()) {
      return { data: null, error: 'Supabase client is not configured.' };
    }

    try {
      const { data, error } = await supabase
        .from('habit_completions')
        .select('*')
        .eq('habit_id', habitId);

      if (error) {
        return { data: null, error: formatDbError(error) };
      }

      return { data: data as DbHabitCompletion[], error: null };
    } catch (err: any) {
      return { data: null, error: err.message || 'Network error fetching habit completions.' };
    }
  },

  /**
   * Fetch completions for multiple habits in a single query
   */
  async fetchCompletionsForHabits(habitIds: string[]): Promise<ServiceResult<DbHabitCompletion[]>> {
    if (!isSupabaseConfigured()) {
      return { data: null, error: 'Supabase client is not configured.' };
    }

    if (habitIds.length === 0) {
      return { data: [], error: null };
    }

    try {
      const { data, error } = await supabase
        .from('habit_completions')
        .select('*')
        .in('habit_id', habitIds);

      if (error) {
        return { data: null, error: formatDbError(error) };
      }

      return { data: data as DbHabitCompletion[], error: null };
    } catch (err: any) {
      return { data: null, error: err.message || 'Network error fetching habit completions.' };
    }
  },

  /**
   * Mark habit completed for a specific date (YYYY-MM-DD)
   */
  async recordCompletion(habitId: string, completedDate: string): Promise<ServiceResult<DbHabitCompletion>> {
    if (!isSupabaseConfigured()) {
      return { data: null, error: 'Supabase client is not configured.' };
    }

    try {
      // Check if already completed to prevent duplicate insertion error
      const { data: existing } = await supabase
        .from('habit_completions')
        .select('id')
        .eq('habit_id', habitId)
        .eq('completed_date', completedDate)
        .maybeSingle();

      if (existing) {
        return {
          data: existing as DbHabitCompletion,
          error: null,
        };
      }

      const newId = generateUUID();
      const { data, error } = await supabase
        .from('habit_completions')
        .insert({
          id: newId,
          habit_id: habitId,
          completed_date: completedDate,
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        // If unique constraint triggered by concurrent action, handle gracefully
        if (error.code === '23505') {
          return { data: { id: newId, habit_id: habitId, completed_date: completedDate, created_at: '' }, error: null };
        }
        return { data: null, error: formatDbError(error) };
      }

      return { data: data as DbHabitCompletion, error: null };
    } catch (err: any) {
      return { data: null, error: err.message || 'Network error recording habit completion.' };
    }
  },

  /**
   * Remove completion for a specific habit and date
   */
  async removeCompletion(habitId: string, completedDate: string): Promise<ServiceResult<boolean>> {
    if (!isSupabaseConfigured()) {
      return { data: false, error: 'Supabase client is not configured.' };
    }

    try {
      const { error } = await supabase
        .from('habit_completions')
        .delete()
        .eq('habit_id', habitId)
        .eq('completed_date', completedDate);

      if (error) {
        return { data: false, error: formatDbError(error) };
      }

      return { data: true, error: null };
    } catch (err: any) {
      return { data: false, error: err.message || 'Network error removing habit completion.' };
    }
  },
};
