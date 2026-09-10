import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { formatDbError, ServiceResult } from './profileService';
import {
  AdminUser,
  AdminTask,
  AdminHabit,
  AdminHabitCompletion,
  AdminHabitStreak,
} from '../types/database';
import { calculateHabitStreaks } from '../utils/date';

export const adminService = {
  /**
   * Check if currently authenticated user has admin privileges via public.is_admin() RPC
   */
  async checkIsAdmin(): Promise<ServiceResult<boolean>> {
    if (!isSupabaseConfigured()) {
      return { data: false, error: 'Database service is not configured.' };
    }

    try {
      const { data, error } = await supabase.rpc('is_admin');
      if (error) {
        return { data: false, error: formatDbError(error) };
      }
      return { data: Boolean(data), error: null };
    } catch (err: any) {
      return { data: false, error: err.message || 'Error verifying admin privileges.' };
    }
  },

  /**
   * List all registered users via public.admin_list_users() RPC
   * Returns user_id, display_name, role, created_at
   * Does NOT return passwords, tokens, or emails
   */
  async listUsers(): Promise<ServiceResult<AdminUser[]>> {
    if (!isSupabaseConfigured()) {
      return { data: null, error: 'Database service is not configured.' };
    }

    try {
      const { data, error } = await supabase.rpc('admin_list_users');
      if (error) {
        return { data: null, error: formatDbError(error) };
      }
      return { data: (data as AdminUser[]) || [], error: null };
    } catch (err: any) {
      return { data: null, error: err.message || 'Error listing users.' };
    }
  },

  /**
   * List tasks for a target user via public.admin_list_user_tasks(target_user_id) RPC
   */
  async listUserTasks(targetUserId: string): Promise<ServiceResult<AdminTask[]>> {
    if (!isSupabaseConfigured()) {
      return { data: null, error: 'Database service is not configured.' };
    }

    try {
      const { data, error } = await supabase.rpc('admin_list_user_tasks', {
        target_user_id: targetUserId,
      });
      if (error) {
        return { data: null, error: formatDbError(error) };
      }
      return { data: (data as AdminTask[]) || [], error: null };
    } catch (err: any) {
      return { data: null, error: err.message || 'Error listing user tasks.' };
    }
  },

  /**
   * List habits for a target user via public.admin_list_user_habits(target_user_id) RPC
   */
  async listUserHabits(targetUserId: string): Promise<ServiceResult<AdminHabit[]>> {
    if (!isSupabaseConfigured()) {
      return { data: null, error: 'Database service is not configured.' };
    }

    try {
      const { data, error } = await supabase.rpc('admin_list_user_habits', {
        target_user_id: targetUserId,
      });
      if (error) {
        return { data: null, error: formatDbError(error) };
      }
      return { data: (data as AdminHabit[]) || [], error: null };
    } catch (err: any) {
      return { data: null, error: err.message || 'Error listing user habits.' };
    }
  },

  /**
   * List habit completions for a target habit via public.admin_list_habit_completions(target_habit_id) RPC
   */
  async listHabitCompletions(targetHabitId: string): Promise<ServiceResult<AdminHabitCompletion[]>> {
    if (!isSupabaseConfigured()) {
      return { data: null, error: 'Database service is not configured.' };
    }

    try {
      const { data, error } = await supabase.rpc('admin_list_habit_completions', {
        target_habit_id: targetHabitId,
      });
      if (error) {
        return { data: null, error: formatDbError(error) };
      }
      return { data: (data as AdminHabitCompletion[]) || [], error: null };
    } catch (err: any) {
      return { data: null, error: err.message || 'Error listing habit completions.' };
    }
  },

  /**
   * Load streak stats for a target habit via public.admin_get_habit_streak(target_habit_id) RPC,
   * falling back to completions-based calculation if RPC returns null or schema error.
   */
  async getHabitStreak(
    targetHabitId: string,
    completions?: AdminHabitCompletion[],
    habitCreatedAt?: string
  ): Promise<ServiceResult<AdminHabitStreak>> {
    if (!isSupabaseConfigured()) {
      return { data: null, error: 'Database service is not configured.' };
    }

    let rpcData: any = null;
    try {
      const { data, error } = await supabase.rpc('admin_get_habit_streak', {
        target_habit_id: targetHabitId,
      });
      if (!error && data) {
        rpcData = data;
      }
    } catch {
      // Handled by completion fallback
    }

    // The RPC returns TABLE data, which Supabase returns as an array of rows.
    // Correctly handle data[0] if array, or the object directly if single record.
    const row = Array.isArray(rpcData)
      ? (rpcData.length > 0 ? rpcData[0] : null)
      : (rpcData && typeof rpcData === 'object' ? rpcData : null);

    if (row && typeof row === 'object') {
      const currentStreak = Number(row.current_streak ?? row.currentStreak ?? 0);
      const longestStreak = Number(
        row.longest_streak ?? row.longestStreak ?? row.best_streak ?? row.bestStreak ?? 0
      );
      const totalCheckins = Number(
        row.total_checkins ?? row.totalCheckins ?? row.total_completions ?? completions?.length ?? 0
      );
      const completionRate = Number(row.completion_rate ?? row.completionRate ?? 0);

      return {
        data: {
          currentStreak: isNaN(currentStreak) ? 0 : currentStreak,
          longestStreak: isNaN(longestStreak) ? 0 : longestStreak,
          totalCheckins: isNaN(totalCheckins) ? 0 : totalCheckins,
          completionRate: isNaN(completionRate) ? 0 : completionRate,
        },
        error: null,
      };
    }

    // Fallback calculation using completions and calculateHabitStreaks from utils/date
    try {
      let comps = completions;
      if (!comps) {
        const compsRes = await this.listHabitCompletions(targetHabitId);
        comps = compsRes.data || [];
      }

      const history: Record<string, boolean> = {};
      for (const c of comps) {
        if (c.completed_date) {
          history[c.completed_date] = true;
        }
      }

      const stats = calculateHabitStreaks(history, habitCreatedAt);
      return {
        data: {
          currentStreak: stats.currentStreak,
          longestStreak: stats.bestStreak,
          totalCheckins: stats.totalCompletedDays,
          completionRate: stats.completionRate,
        },
        error: null,
      };
    } catch (err: any) {
      return {
        data: { currentStreak: 0, longestStreak: 0, totalCheckins: 0, completionRate: 0 },
        error: err.message || 'Error calculating habit streak.',
      };
    }
  },
};
