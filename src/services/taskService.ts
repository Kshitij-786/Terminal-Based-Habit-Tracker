import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { Task } from '../types';
import { DbTask, mapDbTaskToTask, mapTaskToDbTask } from '../types/database';
import { formatDbError, ServiceResult } from './profileService';

export const taskService = {
  /**
   * Fetch all tasks owned by the authenticated Supabase user
   */
  async fetchTasks(): Promise<ServiceResult<Task[]>> {
    if (!isSupabaseConfigured()) {
      return { data: null, error: 'Database service is not configured.' };
    }

    try {
      const { data: { user }, error: authErr } = await supabase.auth.getUser();
      if (authErr || !user) {
        return { data: null, error: 'Unauthenticated: No active database session.' };
      }

      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });

      if (error) {
        return { data: null, error: formatDbError(error) };
      }

      const tasks: Task[] = (data as DbTask[]).map(mapDbTaskToTask);
      return { data: tasks, error: null };
    } catch (err: any) {
      return { data: null, error: err.message || 'Network error fetching tasks from database.' };
    }
  },

  /**
   * Insert a new task record into Supabase
   */
  async createTask(task: Task): Promise<ServiceResult<Task>> {
    if (!isSupabaseConfigured()) {
      return { data: null, error: 'Database service is not configured.' };
    }

    try {
      const { data: { user }, error: authErr } = await supabase.auth.getUser();
      if (authErr || !user) {
        return { data: null, error: 'Unauthenticated: Cannot create task without active database session.' };
      }

      const dbPayload = mapTaskToDbTask(task, user.id);

      const { data, error } = await supabase
        .from('tasks')
        .insert(dbPayload)
        .select()
        .single();

      if (error) {
        return { data: null, error: formatDbError(error) };
      }

      return { data: mapDbTaskToTask(data as DbTask), error: null };
    } catch (err: any) {
      return { data: null, error: err.message || 'Network error creating task.' };
    }
  },

  /**
   * Update an existing task in Supabase
   */
  async updateTask(taskId: string, updates: Partial<Task>): Promise<ServiceResult<Task>> {
    if (!isSupabaseConfigured()) {
      return { data: null, error: 'Database service is not configured.' };
    }

    try {
      const { data: { user }, error: authErr } = await supabase.auth.getUser();
      if (authErr || !user) {
        return { data: null, error: 'Unauthenticated: Cannot update task without active database session.' };
      }

      const dbUpdates: Partial<DbTask> = {};
      if (updates.name !== undefined) dbUpdates.name = updates.name;
      if (updates.status !== undefined) dbUpdates.status = updates.status;
      if (updates.scheduledDate !== undefined) dbUpdates.scheduled_date = updates.scheduledDate;
      if (updates.priority !== undefined) dbUpdates.priority = updates.priority;
      if (updates.completedAt !== undefined) dbUpdates.completed_at = updates.completedAt;
      if (updates.cancelledAt !== undefined) dbUpdates.cancelled_at = updates.cancelledAt;

      const { data, error } = await supabase
        .from('tasks')
        .update(dbUpdates)
        .eq('id', taskId)
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) {
        return { data: null, error: formatDbError(error) };
      }

      return { data: mapDbTaskToTask(data as DbTask), error: null };
    } catch (err: any) {
      return { data: null, error: err.message || 'Network error updating task.' };
    }
  },

  /**
   * Delete a task from Supabase
   */
  async deleteTask(taskId: string): Promise<ServiceResult<boolean>> {
    if (!isSupabaseConfigured()) {
      return { data: false, error: 'Database service is not configured.' };
    }

    try {
      const { data: { user }, error: authErr } = await supabase.auth.getUser();
      if (authErr || !user) {
        return { data: false, error: 'Unauthenticated: Cannot delete task without active database session.' };
      }

      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', taskId)
        .eq('user_id', user.id);

      if (error) {
        return { data: false, error: formatDbError(error) };
      }

      return { data: true, error: null };
    } catch (err: any) {
      return { data: false, error: err.message || 'Network error deleting task.' };
    }
  },

  /**
   * Migrate/sync a list of tasks to Supabase
   */
  async batchSyncTasks(tasks: Task[]): Promise<ServiceResult<number>> {
    if (!isSupabaseConfigured()) {
      return { data: 0, error: 'Database service is not configured.' };
    }

    try {
      const { data: { user }, error: authErr } = await supabase.auth.getUser();
      if (authErr || !user) {
        return { data: 0, error: 'Unauthenticated: Cannot sync tasks without active database session.' };
      }

      if (tasks.length === 0) {
        return { data: 0, error: null };
      }

      const dbRows = tasks.map(t => mapTaskToDbTask(t, user.id));
      const { error } = await supabase
        .from('tasks')
        .upsert(dbRows, { onConflict: 'id' });

      if (error) {
        return { data: 0, error: formatDbError(error) };
      }

      return { data: tasks.length, error: null };
    } catch (err: any) {
      return { data: 0, error: err.message || 'Network error syncing tasks.' };
    }
  },
};
