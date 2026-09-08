import { Task, Habit, TaskStatus } from '../types';

export interface DbProfile {
  id: string; // uuid, references auth.users.id
  user_id: string; // cli username/slug e.g. "shadow"
  display_name: string | null;
  created_at: string;
  updated_at?: string;
}

export interface DbTask {
  id: string; // uuid
  user_id: string; // uuid references profiles.id
  name: string;
  status: TaskStatus;
  scheduled_date: string; // YYYY-MM-DD
  priority?: 'low' | 'medium' | 'high' | null;
  created_at: string;
  completed_at?: string | null;
  cancelled_at?: string | null;
}

export interface DbHabit {
  id: string; // uuid
  user_id: string; // uuid references profiles.id
  name: string;
  created_at: string;
  updated_at?: string;
}

export interface DbHabitCompletion {
  id: string; // uuid
  habit_id: string; // uuid references habits.id
  completed_date: string; // YYYY-MM-DD
  created_at: string;
}

/**
 * Adapter helpers to convert between Database rows and UI domain models
 */
export function mapDbTaskToTask(db: DbTask): Task {
  return {
    id: db.id,
    name: db.name,
    status: db.status,
    scheduledDate: db.scheduled_date,
    createdAt: db.created_at,
    completedAt: db.completed_at || undefined,
    cancelledAt: db.cancelled_at || undefined,
    priority: db.priority || undefined,
  };
}

export function mapTaskToDbTask(task: Task, userId: string): DbTask {
  return {
    id: task.id,
    user_id: userId,
    name: task.name,
    status: task.status,
    scheduled_date: task.scheduledDate,
    priority: task.priority || null,
    created_at: task.createdAt,
    completed_at: task.completedAt || null,
    cancelled_at: task.cancelledAt || null,
  };
}

export interface AdminUser {
  id: string; // uuid from profiles
  user_id: string; // CLI user handle (e.g. "shadow")
  display_name: string | null;
  role: string; // "admin" | "user"
  created_at: string;
}

export interface AdminTask {
  id: string;
  user_id: string;
  name: string;
  status: TaskStatus;
  scheduled_date: string;
  priority?: 'low' | 'medium' | 'high' | null;
  created_at: string;
  completed_at?: string | null;
  cancelled_at?: string | null;
  updated_at?: string;
}

export interface AdminHabit {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
  archived_at?: string | null;
  updated_at?: string;
}

export interface AdminHabitCompletion {
  id: string;
  habit_id: string;
  completed_date: string;
  created_at: string;
}

export interface AdminHabitStreak {
  currentStreak: number;
  longestStreak: number;
  totalCheckins: number;
  completionRate: number;
}
