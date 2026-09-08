import { Task, Habit, UserState } from '../types';
import { taskService } from './taskService';
import { habitService } from './habitService';
import { profileService } from './profileService';
import { authService } from './authService';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

export interface StorageStatus {
  isSupabaseConfigured: boolean;
  hasActiveSupabaseSession: boolean;
  supabaseUserId: string | null;
  mode: 'supabase' | 'local_fallback';
  message: string;
}

export const dataAdapter = {
  /**
   * Check whether the application is currently operating against Supabase or local fallback
   */
  async getStorageStatus(): Promise<StorageStatus> {
    const configured = isSupabaseConfigured();
    if (!configured) {
      return {
        isSupabaseConfigured: false,
        hasActiveSupabaseSession: false,
        supabaseUserId: null,
        mode: 'local_fallback',
        message: 'Supabase credentials not configured.',
      };
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        return {
          isSupabaseConfigured: true,
          hasActiveSupabaseSession: true,
          supabaseUserId: user.id,
          mode: 'supabase',
          message: `Connected to Supabase PostgreSQL (User: ${user.id.slice(0, 8)}...).`,
        };
      }
    } catch {
      // Ignored, falls back
    }

    return {
      isSupabaseConfigured: true,
      hasActiveSupabaseSession: false,
      supabaseUserId: null,
      mode: 'local_fallback',
      message: 'Supabase configured. Awaiting active Supabase Auth session.',
    };
  },

  /**
   * Persists task mutation to Supabase if authenticated
   */
  async onTaskCreated(task: Task, userState: UserState): Promise<{ syncedToDb: boolean; error?: string }> {
    if (isSupabaseConfigured()) {
      try {
        const user = await authService.getCurrentUser();
        if (user) {
          const res = await taskService.createTask(task);
          if (res.error) {
            return { syncedToDb: false, error: res.error };
          }
          return { syncedToDb: true };
        }
      } catch (e: any) {
        return { syncedToDb: false, error: e.message };
      }
    }

    return { syncedToDb: false };
  },

  /**
   * Persists task update to Supabase if authenticated
   */
  async onTaskUpdated(taskId: string, updates: Partial<Task>, userState: UserState): Promise<{ syncedToDb: boolean; error?: string }> {
    if (isSupabaseConfigured()) {
      try {
        const user = await authService.getCurrentUser();
        if (user) {
          const res = await taskService.updateTask(taskId, updates);
          if (res.error) {
            return { syncedToDb: false, error: res.error };
          }
          return { syncedToDb: true };
        }
      } catch (e: any) {
        return { syncedToDb: false, error: e.message };
      }
    }

    return { syncedToDb: false };
  },

  /**
   * Persists task deletion to Supabase if authenticated
   */
  async onTaskDeleted(taskId: string, userState: UserState): Promise<{ syncedToDb: boolean; error?: string }> {
    if (isSupabaseConfigured()) {
      try {
        const user = await authService.getCurrentUser();
        if (user) {
          const res = await taskService.deleteTask(taskId);
          if (res.error) {
            return { syncedToDb: false, error: res.error };
          }
          return { syncedToDb: true };
        }
      } catch (e: any) {
        return { syncedToDb: false, error: e.message };
      }
    }

    return { syncedToDb: false };
  },

  /**
   * Persists habit mutation to Supabase if authenticated
   */
  async onHabitCreated(habit: Habit, userState: UserState): Promise<{ syncedToDb: boolean; error?: string }> {
    if (isSupabaseConfigured()) {
      try {
        const user = await authService.getCurrentUser();
        if (user) {
          const res = await habitService.createHabit(habit.name, habit.id);
          if (res.error) {
            return { syncedToDb: false, error: res.error };
          }
          return { syncedToDb: true };
        }
      } catch (e: any) {
        return { syncedToDb: false, error: e.message };
      }
    }

    return { syncedToDb: false };
  },

  /**
   * Persists habit completion to Supabase if authenticated
   */
  async onHabitCompleted(habitId: string, dateStr: string, userState: UserState): Promise<{ syncedToDb: boolean; error?: string }> {
    if (isSupabaseConfigured()) {
      try {
        const user = await authService.getCurrentUser();
        if (user) {
          const res = await habitService.markHabitDone(habitId, dateStr);
          if (res.error) {
            return { syncedToDb: false, error: res.error };
          }
          return { syncedToDb: true };
        }
      } catch (e: any) {
        return { syncedToDb: false, error: e.message };
      }
    }

    return { syncedToDb: false };
  },

  /**
   * Persists habit deletion to Supabase if authenticated
   */
  async onHabitDeleted(habitId: string, userState: UserState): Promise<{ syncedToDb: boolean; error?: string }> {
    if (isSupabaseConfigured()) {
      try {
        const user = await authService.getCurrentUser();
        if (user) {
          const res = await habitService.deleteHabit(habitId);
          if (res.error) {
            return { syncedToDb: false, error: res.error };
          }
          return { syncedToDb: true };
        }
      } catch (e: any) {
        return { syncedToDb: false, error: e.message };
      }
    }

    return { syncedToDb: false };
  },
};
