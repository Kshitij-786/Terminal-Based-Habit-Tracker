import type { ReactNode } from 'react';

export type TaskStatus = 'todo' | 'done' | 'cancelled';

export interface Task {
  id: string;
  name: string;
  status: TaskStatus;
  scheduledDate: string; // YYYY-MM-DD
  createdAt: string;
  completedAt?: string;
  cancelledAt?: string;
  priority?: 'low' | 'medium' | 'high';
}

export interface Habit {
  id: string;
  name: string;
  createdAt: string;
  history: Record<string, boolean>; // key is YYYY-MM-DD, value is completed boolean
  currentStreak: number;
  bestStreak: number;
}

export interface UserState {
  userId: string;
  userName: string;
  tasks: Task[];
  habits: Habit[];
  createdAt: string;
}

export type OutputType = 'text' | 'success' | 'error' | 'warning' | 'info' | 'ascii-graph' | 'table';

export interface TerminalEntry {
  id: string;
  type: 'command' | 'output';
  command?: string;
  outputType?: OutputType;
  content: string | ReactNode;
  timestamp: string;
}

export interface CommandExecutionResult {
  success: boolean;
  message?: string;
  outputType?: OutputType;
  viewMode?: 'tasks' | 'habits' | 'task_stats' | 'habit_stats' | 'help' | 'cmd';
}
