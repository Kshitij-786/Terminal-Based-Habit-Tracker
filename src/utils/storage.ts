import { Task } from '../types';
import { getTodayString, getTomorrowString, calculateHabitStreaks, parseUserDate } from './date';

export { getTodayString, getTomorrowString, calculateHabitStreaks };

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

