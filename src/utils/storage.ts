import { UserState, Task, Habit } from '../types';
import { getTodayString, getTomorrowString, calculateHabitStreaks, parseUserDate } from './date';

export { getTodayString, getTomorrowString, calculateHabitStreaks };

const MOCK_USERS_KEY = 'habitos_mock_accounts_v3';

/**
 * Conservatively sanitizes loaded tasks:
 * - Normalizes any valid non-canonical scheduledDate to YYYY-MM-DD
 * - If a task was created before the date fix with date mistakenly prefixed in the name
 *   (e.g. "15-09-2026 problem solving" while scheduledDate was defaulted to today),
 *   repairs scheduledDate and restores task name.
 */
export function sanitizeLoadedTasks(tasks: Task[]): Task[] {
  if (!Array.isArray(tasks)) return [];
  const todayStr = getTodayString();
  return tasks.map(t => {
    let scheduledDate = (t.scheduledDate && parseUserDate(t.scheduledDate)) || t.scheduledDate || todayStr;
    let name = t.name;

    const match = name.match(/^(\d{1,4}[-/.]\w{1,9}[-/.]\d{1,4})\s+(.+)$/);
    if (match) {
      const candidateDate = match[1];
      const parsed = parseUserDate(candidateDate);
      if (parsed && t.scheduledDate === todayStr && parsed !== todayStr) {
        scheduledDate = parsed;
        name = match[2].replace(/^["']|["']$/g, '').trim();
      }
    }

    return {
      ...t,
      name,
      scheduledDate,
    };
  });
}

/**
 * Generate a collision-resistant unique ID (UUID v4)
 */
export function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function getInitialTasks(): Task[] {
  const today = getTodayString();
  const tomorrow = getTomorrowString();

  return [
    {
      id: generateUUID(),
      name: 'Build website',
      status: 'done',
      scheduledDate: today,
      createdAt: new Date(Date.now() - 3600000 * 5).toISOString(),
      completedAt: new Date(Date.now() - 3600000 * 1).toISOString(),
    },
    {
      id: generateUUID(),
      name: 'Study React',
      status: 'todo',
      scheduledDate: today,
      createdAt: new Date(Date.now() - 3600000 * 4).toISOString(),
    },
    {
      id: generateUUID(),
      name: 'Workout',
      status: 'todo',
      scheduledDate: today,
      createdAt: new Date(Date.now() - 3600000 * 3).toISOString(),
    },
    {
      id: generateUUID(),
      name: 'Read book',
      status: 'todo',
      scheduledDate: tomorrow,
      createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
    },
    {
      id: generateUUID(),
      name: 'Deploy app',
      status: 'todo',
      scheduledDate: tomorrow,
      createdAt: new Date(Date.now() - 3600000 * 1).toISOString(),
    },
    {
      id: generateUUID(),
      name: 'Design UI',
      status: 'todo',
      scheduledDate: today,
      createdAt: new Date().toISOString(),
    },
  ];
}

export function getInitialHabits(): Habit[] {
  const today = getTodayString();
  const d = new Date();
  
  // create history for past 7 days
  const h1History: Record<string, boolean> = {};
  const h2History: Record<string, boolean> = {};
  const h3History: Record<string, boolean> = {};

  for (let i = 0; i < 7; i++) {
    const day = new Date();
    day.setDate(d.getDate() - i);
    const dayStr = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
    if (i !== 3) h1History[dayStr] = true;
    if (i < 4) h2History[dayStr] = true;
    if (i % 2 === 0) h3History[dayStr] = true;
  }
  h1History[today] = true; // done today

  const h1Streaks = calculateHabitStreaks(h1History);
  const h2Streaks = calculateHabitStreaks(h2History);
  const h3Streaks = calculateHabitStreaks(h3History);

  return [
    {
      id: generateUUID(),
      name: 'Morning Exercise',
      createdAt: new Date(Date.now() - 86400000 * 14).toISOString(),
      history: h1History,
      currentStreak: h1Streaks.currentStreak,
      bestStreak: h1Streaks.bestStreak,
    },
    {
      id: generateUUID(),
      name: 'Read 20 mins',
      createdAt: new Date(Date.now() - 86400000 * 10).toISOString(),
      history: h2History,
      currentStreak: h2Streaks.currentStreak,
      bestStreak: h2Streaks.bestStreak,
    },
    {
      id: generateUUID(),
      name: 'Drink 2L Water',
      createdAt: new Date(Date.now() - 86400000 * 8).toISOString(),
      history: h3History,
      currentStreak: h3Streaks.currentStreak,
      bestStreak: h3Streaks.bestStreak,
    },
  ];
}

export function getRegisteredUsers(): string[] {
  try {
    const raw = localStorage.getItem(MOCK_USERS_KEY);
    if (!raw) return [];
    const accounts = JSON.parse(raw);
    return Object.keys(accounts);
  } catch {
    return [];
  }
}

export function loadUserData(userId: string): UserState | null {
  try {
    const raw = localStorage.getItem(MOCK_USERS_KEY);
    if (raw) {
      const accounts = JSON.parse(raw);
      const normalized = userId.trim().toLowerCase();
      const account = accounts[normalized];
      if (account) {
        return {
          userId: account.displayUserId,
          userName: account.displayUserId,
          tasks: sanitizeLoadedTasks(account.tasks || []),
          habits: account.habits || [],
          createdAt: account.createdAt || new Date().toISOString(),
        };
      }
    }
  } catch (e) {
    console.error('Error loading user data', e);
  }
  return null;
}

export function saveUserData(state: UserState) {
  try {
    const raw = localStorage.getItem(MOCK_USERS_KEY);
    const accounts = raw ? JSON.parse(raw) : {};
    const normalized = state.userId.trim().toLowerCase();
    if (accounts[normalized]) {
      accounts[normalized].tasks = state.tasks;
      accounts[normalized].habits = state.habits;
      localStorage.setItem(MOCK_USERS_KEY, JSON.stringify(accounts));
    }
  } catch (e) {
    console.error('Error saving user data', e);
  }
}
