/**
 * Date & Streak calculation utilities for habitOS.
 * Uses integer epoch day numbers in UTC to eliminate timezone, daylight saving time (DST),
 * and leap-year shifts completely.
 * Always operates relative to the user's local calendar day boundaries.
 */

import { Habit } from '../types';

export function getTodayString(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getTomorrowString(): string {
  return daysToDateString(dateStringToDays(getTodayString()) + 1);
}

export function getYesterdayString(): string {
  return daysToDateString(dateStringToDays(getTodayString()) - 1);
}

/**
 * Returns an array of YYYY-MM-DD date strings for the last N days up to and including today.
 */
export function getLastNDays(n: number): string[] {
  const result: string[] = [];
  const todayDays = dateStringToDays(getTodayString());
  for (let i = n - 1; i >= 0; i--) {
    result.push(daysToDateString(todayDays - i));
  }
  return result;
}

/**
 * Converts a YYYY-MM-DD string into an integer epoch day number (UTC).
 * Guarantees arithmetic subtraction/addition of days is 100% accurate.
 */
export function dateStringToDays(dateStr: string): number {
  if (!dateStr || typeof dateStr !== 'string') return 0;
  const parts = dateStr.split('-');
  if (parts.length !== 3) return 0;
  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  const d = parseInt(parts[2], 10);
  if (isNaN(y) || isNaN(m) || isNaN(d)) return 0;
  return Math.floor(Date.UTC(y, m - 1, d) / 86400000);
}

/**
 * Converts integer epoch day number back to YYYY-MM-DD string.
 */
export function daysToDateString(days: number): string {
  const date = new Date(days * 86400000);
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function formatDateDisplay(dateStr: string): string {
  if (!dateStr) return 'Unscheduled';
  const today = getTodayString();
  const tomorrow = getTomorrowString();
  const yesterday = getYesterdayString();

  if (dateStr === today) return `${dateStr} (Today)`;
  if (dateStr === tomorrow) return `${dateStr} (Tomorrow)`;
  if (dateStr === yesterday) return `${dateStr} (Yesterday)`;
  return dateStr;
}

export function formatTimeDisplay(isoString?: string): string {
  if (!isoString) return '';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return '';
    const h = String(d.getHours()).padStart(2, '0');
    const m = String(d.getMinutes()).padStart(2, '0');
    const s = String(d.getSeconds()).padStart(2, '0');
    return `${h}:${m}:${s}`;
  } catch {
    return '';
  }
}

export const MONTH_NAMES: Record<string, number> = {
  jan: 1, january: 1,
  feb: 2, february: 2,
  mar: 3, march: 3,
  apr: 4, april: 4,
  may: 5,
  jun: 6, june: 6,
  jul: 7, july: 7,
  aug: 8, august: 8,
  sep: 9, sept: 9, september: 9,
  oct: 10, october: 10,
  nov: 11, november: 11,
  dec: 12, december: 12,
};

/**
 * Returns number of calendar days in a given month/year with strict leap year rules.
 */
export function getDaysInMonth(year: number, month: number): number {
  if (month < 1 || month > 12) return 0;
  if (month === 2) {
    const isLeap = (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
    return isLeap ? 29 : 28;
  }
  if ([4, 6, 9, 11].includes(month)) {
    return 30;
  }
  return 31;
}

/**
 * Normalizes any supported user date input format to the canonical internal YYYY-MM-DD.
 * Supported formats:
 * - YYYY-MM-DD (e.g. 2026-09-15)
 * - DD-MM-YYYY (e.g. 15-09-2026)
 * - DD/MM/YYYY (e.g. 15/09/2026)
 * - DD.MM.YYYY (e.g. 15.09.2026)
 * - YYYY/MM/DD (e.g. 2026/09/15)
 * - DD-MMM-YYYY (e.g. 15-Sep-2026, 15 September 2026)
 * - Keywords: 'today', 'tomorrow'
 *
 * Ambiguity rule: Always interprets DD/MM/YYYY using Indian date convention.
 * Returns null if the date is invalid or fails strict calendar validation.
 */
export function parseUserDate(input: string): string | null {
  if (!input || typeof input !== 'string') return null;
  const raw = input.trim();
  const low = raw.toLowerCase();

  if (low === 'today' || low === '-today') return getTodayString();
  if (low === 'tomorrow' || low === 'tom' || low === '-tom') return getTomorrowString();
  if (low === 'yesterday') return getYesterdayString();

  // Split by separators -, /, ., or space
  const parts = raw.split(/[-/. ]+/);
  if (parts.length !== 3) return null;

  let y: number;
  let m: number;
  let d: number;

  const p0 = parts[0].trim();
  const p1 = parts[1].trim();
  const p2 = parts[2].trim();

  // Check if year is first: YYYY-MM-DD, YYYY/MM/DD, YYYY.MM.DD
  if (p0.length === 4 && /^\d{4}$/.test(p0)) {
    y = parseInt(p0, 10);
    if (MONTH_NAMES[p1.toLowerCase()]) {
      m = MONTH_NAMES[p1.toLowerCase()];
    } else if (/^\d{1,2}$/.test(p1)) {
      m = parseInt(p1, 10);
    } else {
      return null;
    }
    if (/^\d{1,2}$/.test(p2)) {
      d = parseInt(p2, 10);
    } else {
      return null;
    }
  } else if (p2.length === 4 && /^\d{4}$/.test(p2)) {
    // Year is last: DD-MM-YYYY, DD/MM/YYYY, DD.MM.YYYY (Indian convention)
    y = parseInt(p2, 10);
    if (/^\d{1,2}$/.test(p0)) {
      d = parseInt(p0, 10);
    } else {
      return null;
    }
    if (MONTH_NAMES[p1.toLowerCase()]) {
      m = MONTH_NAMES[p1.toLowerCase()];
    } else if (/^\d{1,2}$/.test(p1)) {
      m = parseInt(p1, 10);
    } else {
      return null;
    }
  } else {
    return null;
  }

  // Strict Calendar Validation
  if (isNaN(y) || isNaN(m) || isNaN(d)) return null;
  if (y < 1000 || y > 9999) return null;
  if (m < 1 || m > 12) return null;
  if (d < 1) return null;

  const maxDays = getDaysInMonth(y, m);
  if (d > maxDays) return null;

  const yStr = String(y);
  const mStr = String(m).padStart(2, '0');
  const dStr = String(d).padStart(2, '0');

  return `${yStr}-${mStr}-${dStr}`;
}

/**
 * Checks if a token appears to be an attempted date input.
 * Used for date detection BEFORE task-name fallback.
 */
export function isDateLike(str: string): boolean {
  if (!str || typeof str !== 'string') return false;
  const s = str.trim();

  // Check 3 parts separated by -, /, or .
  if (/^\d{1,4}[-/.]\w{1,9}[-/.]\d{1,4}$/.test(s)) {
    const parts = s.split(/[-/.]/);
    if (parts.length === 3) {
      const p0 = parseInt(parts[0], 10);
      const p2 = parseInt(parts[2], 10);
      // Either p0 is 4 digits (year) or p2 is 4 digits (year)
      if ((parts[0].length === 4 && !isNaN(p0)) || (parts[2].length === 4 && !isNaN(p2))) {
        return true;
      }
    }
  }

  // Check year prefix (e.g. 2026- or 2026/)
  if (/^\d{4}[-/]/.test(s)) {
    return true;
  }

  return false;
}

/**
 * Validates whether a date string is in canonical YYYY-MM-DD format and is a real calendar date.
 */
export function isValidDateFormat(dateStr: string): boolean {
  if (!dateStr || typeof dateStr !== 'string') return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  return parseUserDate(dateStr) === dateStr;
}

/**
 * Canonical user-facing error message for invalid dates
 */
export function getInvalidDateErrorMessage(
  invalidDateStr: string,
  commandContext: 'add' | 'list' | 'move' = 'add',
  serialNumber = 1
): string {
  let example = 'add 15-09-2026 "Problem Solving"';
  if (commandContext === 'list') {
    example = 'list 15-09-2026';
  } else if (commandContext === 'move') {
    example = `move -${serialNumber} 15-09-2026`;
  }

  return `Invalid date: ${invalidDateStr}

Use a valid date.
Supported formats:
  YYYY-MM-DD
  DD-MM-YYYY
  DD/MM/YYYY
  DD.MM.YYYY
  YYYY/MM/DD

Example:
  ${example}`;
}

/**
 * Generates dynamic output for the 'date' command:
 * Local date, day of week, current time, and browser timezone.
 */
export function generateDateCommandOutput(): string {
  const now = new Date();
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Local';
  const dayName = now.toLocaleDateString('en-US', { weekday: 'long' });
  const day = String(now.getDate()).padStart(2, '0');
  const monthName = now.toLocaleDateString('en-US', { month: 'long' });
  const year = now.getFullYear();
  const dateFormatted = `${day} ${monthName} ${year}`;
  const timeFormatted = now.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });

  return `DATE
────────────────────────
Date:      ${dateFormatted}
Day:       ${dayName}
Time:      ${timeFormatted}
Timezone:  ${timeZone}
────────────────────────`;
}

/**
 * Generates dynamic output for the 'time' command:
 * Current local time (12-hour and 24-hour), timezone, and UTC time.
 */
export function generateTimeCommandOutput(): string {
  const now = new Date();
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Local';
  const time12 = now.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });
  const time24 = now.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const utcHours = String(now.getUTCHours()).padStart(2, '0');
  const utcMinutes = String(now.getUTCMinutes()).padStart(2, '0');
  const utcSeconds = String(now.getUTCSeconds()).padStart(2, '0');
  const timeUTC = `${utcHours}:${utcMinutes}:${utcSeconds} UTC`;

  return `TIME
────────────────────────
Local Time:  ${time12}
24-Hour:     ${time24}
Timezone:    ${timeZone}
UTC:         ${timeUTC}
────────────────────────`;
}

/**
 * Generates dynamic output for the 'cal' command:
 * Full month calendar with weekday headers (Mon-Sun) and day alignment.
 */
export function generateMonthCalendar(year?: number, month?: number): string {
  const now = new Date();
  const targetYear = year ?? now.getFullYear();
  const targetMonth = month ?? (now.getMonth() + 1);

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const monthName = monthNames[targetMonth - 1] || 'Month';

  // 1st of month: get day of week (0=Sun, 1=Mon, ..., 6=Sat)
  const firstDayObj = new Date(targetYear, targetMonth - 1, 1);
  const jsDay = firstDayObj.getDay();
  // Mon=0, Tue=1, ..., Sun=6
  const startCol = (jsDay + 6) % 7;

  const totalDays = getDaysInMonth(targetYear, targetMonth);

  const isCurrentMonthYear =
    now.getFullYear() === targetYear && (now.getMonth() + 1) === targetMonth;
  const todayDay = isCurrentMonthYear ? now.getDate() : -1;

  let output = `${monthName} ${targetYear}\n\n`;
  output += `Mon Tue Wed Thu Fri Sat Sun\n`;

  let currentLine = '';
  // Fill empty spaces before startCol (each day column is 4 characters wide: 3 chars + 1 space)
  for (let c = 0; c < startCol; c++) {
    currentLine += '    ';
  }

  let currentCol = startCol;
  for (let d = 1; d <= totalDays; d++) {
    const isToday = d === todayDay;
    const dayNumStr = d.toString().padStart(2, ' ');
    const dayStr = isToday
      ? ` [TODAY]${dayNumStr}[/TODAY]`
      : ` ${dayNumStr}`;

    currentLine += dayStr;

    if (currentCol === 6 || d === totalDays) {
      output += currentLine + '\n';
      currentLine = '';
      currentCol = 0;
    } else {
      currentLine += ' ';
      currentCol++;
    }
  }

  return output.trimEnd();
}

/**
 * Standard 24-hour terminal timestamp (HH:MM:SS)
 */
export function formatTerminalTimestamp(d: Date = new Date()): string {
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  const s = String(d.getSeconds()).padStart(2, '0');
  return `${h}:${m}:${s}`;
}

/**
 * Calculates current, best streak, total completed days, and completion rate
 * with strict mathematical accuracy from consecutive calendar days:
 *
 * - Current Streak:
 *   If checked in TODAY: counts backward consecutive days ending today.
 *   If NOT checked in today, but checked in YESTERDAY: counts backward consecutive days ending yesterday (streak preserved while today is active).
 *   If neither today nor yesterday was checked in: streak is broken (0).
 *
 * - Longest (Best) Streak:
 *   Maximum consecutive run of check-in days across all history.
 *
 * - Total Days:
 *   Count of unique completed calendar days.
 *
 * - Completion Rate:
 *   Percentage of tracked days that were completed.
 */
export function calculateHabitStreaks(
  history: Record<string, boolean>,
  createdAt?: string
): {
  currentStreak: number;
  bestStreak: number;
  totalCompletedDays: number;
  completionRate: number;
} {
  if (!history || typeof history !== 'object') {
    return { currentStreak: 0, bestStreak: 0, totalCompletedDays: 0, completionRate: 0 };
  }

  const todayStr = getTodayString();
  const todayDays = dateStringToDays(todayStr);
  const completedDaysSet = new Set<number>();

  for (const [dateKey, val] of Object.entries(history)) {
    if (val && isValidDateFormat(dateKey)) {
      const dNum = dateStringToDays(dateKey);
      if (dNum > 0) {
        completedDaysSet.add(dNum);
      }
    }
  }

  const totalCompletedDays = completedDaysSet.size;

  if (totalCompletedDays === 0) {
    return { currentStreak: 0, bestStreak: 0, totalCompletedDays: 0, completionRate: 0 };
  }

  const sortedDays = Array.from(completedDaysSet).sort((a, b) => a - b);

  // 1. Calculate All-time Longest Streak
  let bestStreak = 0;
  let tempStreak = 0;
  let prevDay: number | null = null;

  for (const dayNum of sortedDays) {
    if (prevDay === null) {
      tempStreak = 1;
    } else if (dayNum === prevDay + 1) {
      tempStreak += 1;
    } else if (dayNum > prevDay + 1) {
      tempStreak = 1;
    }

    if (tempStreak > bestStreak) {
      bestStreak = tempStreak;
    }
    prevDay = dayNum;
  }

  // 2. Calculate Current Streak
  const isDoneToday = completedDaysSet.has(todayDays);
  const isDoneYesterday = completedDaysSet.has(todayDays - 1);

  let currentStreak = 0;

  if (isDoneToday) {
    let checkDay = todayDays;
    while (completedDaysSet.has(checkDay)) {
      currentStreak += 1;
      checkDay -= 1;
    }
  } else if (isDoneYesterday) {
    let checkDay = todayDays - 1;
    while (completedDaysSet.has(checkDay)) {
      currentStreak += 1;
      checkDay -= 1;
    }
  } else {
    currentStreak = 0;
  }

  if (currentStreak > bestStreak) {
    bestStreak = currentStreak;
  }

  // 3. Completion Rate calculation
  let startDay = sortedDays[0];
  if (createdAt) {
    const createdDateStr = createdAt.split('T')[0];
    if (isValidDateFormat(createdDateStr)) {
      const createdDays = dateStringToDays(createdDateStr);
      if (createdDays > 0) {
        startDay = Math.min(createdDays, startDay);
      }
    }
  }
  const totalTrackableDays = Math.max(1, todayDays - startDay + 1);
  const completionRate = Math.min(100, Math.round((totalCompletedDays / totalTrackableDays) * 100));

  return { currentStreak, bestStreak, totalCompletedDays, completionRate };
}

/**
 * Terminal-style habit activity calendar/heatmap for past weeks.
 * Displays Mon-to-Sun columns with monospaced terminal intensity levels:
 *  █ = completed
 *  ▒ = today pending
 *  ░ = no completion
 *  · = future in week
 */
export function generateHabitActivityCalendar(
  history: Record<string, boolean>,
  weeksToShow: number = 4
): string {
  const todayStr = getTodayString();
  const todayDays = dateStringToDays(todayStr);

  // Determine current day-of-week index (0 = Mon, 1 = Tue, ..., 6 = Sun)
  const utcDay = new Date(todayDays * 86400000).getUTCDay();
  const dayOfWeekIndex = (utcDay + 6) % 7;

  // Monday of the current week
  const currentWeekMonday = todayDays - dayOfWeekIndex;
  // Monday of the first week to display
  const startMonday = currentWeekMonday - (weeksToShow - 1) * 7;

  const lines: string[] = [];
  lines.push(' Mon Tue Wed Thu Fri Sat Sun');

  for (let w = 0; w < weeksToShow; w++) {
    const weekStart = startMonday + w * 7;
    const rowCells: string[] = [];

    for (let d = 0; d < 7; d++) {
      const dayNum = weekStart + d;
      const dateStr = daysToDateString(dayNum);

      let symbol = '░';
      if (dayNum > todayDays) {
        symbol = '·';
      } else if (history[dateStr]) {
        symbol = '█';
      } else if (dateStr === todayStr) {
        symbol = '▒';
      } else {
        symbol = '░';
      }

      rowCells.push(symbol);
    }

    // Matches ' Mon Tue Wed Thu Fri Sat Sun' column spacing exactly:
    // Leading 2 spaces, then each symbol followed by 3 spaces
    const formattedRow = '  ' + rowCells.join('   ');
    lines.push(formattedRow);
  }

  return lines.join('\n');
}

/**
 * Formats a single habit's activity card for `habit streak -<number>` and `habit graph`
 */
export function formatHabitActivityCard(habit: Habit, serial?: number): string {
  const stats = calculateHabitStreaks(habit.history, habit.createdAt);
  const calendar = generateHabitActivityCalendar(habit.history, 4);
  const today = getTodayString();
  const isDoneToday = !!habit.history[today];
  const todayStatus = isDoneToday ? '[✓] Completed Today' : '[ ] Pending Today';
  const headerTitle = serial ? `HABIT STREAK : [${serial}] ${habit.name}` : `HABIT STREAK : ${habit.name}`;

  return `────────────────────────────────────────────────────────────
 ${headerTitle}
────────────────────────────────────────────────────────────

 Current Streak : ${stats.currentStreak} day${stats.currentStreak === 1 ? '' : 's'}
 Longest Streak : ${stats.bestStreak} day${stats.bestStreak === 1 ? '' : 's'}
 Total Check-ins: ${stats.totalCompletedDays} day${stats.totalCompletedDays === 1 ? '' : 's'}
 Completion Rate: ${stats.completionRate}%
 Today's Status : ${todayStatus}

Activity Heatmap (Past 4 Weeks):
${calendar}

────────────────────────────────────────────────────────────`;
}
