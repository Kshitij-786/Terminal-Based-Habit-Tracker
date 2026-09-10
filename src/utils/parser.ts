import { UserState, Task, Habit, OutputType } from '../types';
import {
  getTodayString,
  getTomorrowString,
  getYesterdayString,
  isValidDateFormat,
  isDateLike,
  parseUserDate,
  MONTH_NAMES,
  getInvalidDateErrorMessage,
  generateDateCommandOutput,
  generateTimeCommandOutput,
  generateMonthCalendar,
  calculateHabitStreaks,
  formatDateDisplay,
  formatTimeDisplay,
  formatHabitActivityCard,
} from './date';
import { generateUUID } from './storage';
import { isSupabaseConfigured, SUPABASE_URL } from '../lib/supabase';
import { authService } from '../services/authService';
import { adminService } from '../services/adminService';
import { taskService } from '../services/taskService';
import { habitService } from '../services/habitService';
import { habitCompletionService } from '../services/habitCompletionService';

export interface ParseResult {
  message: string;
  outputType: OutputType;
  updatedUser?: UserState;
  shouldClear?: boolean;
  activeView?: 'tasks' | 'habits' | 'task_stats' | 'habit_stats' | 'help' | 'cmd';
  action?: 'START_CREATE_USER' | 'START_LOGIN' | 'LOGOUT' | 'OPEN_ADMIN';
  actionArg?: string;
}

/**
 * Tokenize input string respecting quotes
 */
export function tokenizeCommand(input: string): string[] {
  const tokens: string[] = [];
  let current = '';
  let inQuotes = false;
  let quoteChar = '';

  for (let i = 0; i < input.length; i++) {
    const char = input[i];

    if ((char === '"' || char === "'") && (!inQuotes || quoteChar === char)) {
      if (inQuotes) {
        tokens.push(current);
        current = '';
        inQuotes = false;
        quoteChar = '';
      } else {
        inQuotes = true;
        quoteChar = char;
      }
    } else if (char === ' ' && !inQuotes) {
      if (current.length > 0) {
        tokens.push(current);
        current = '';
      }
    } else {
      current += char;
    }
  }

  if (current.length > 0) {
    tokens.push(current);
  }

  return tokens;
}

/**
 * Checks if token is a serial number flag like `-1`, `-2`, `-6`, `-10`
 */
export function parseSerialNumberToken(token: string): number | null {
  if (!token || typeof token !== 'string') return null;
  // Match -<digits>
  const match = token.match(/^-(\d+)$/);
  if (match) {
    const num = parseInt(match[1], 10);
    return num > 0 ? num : null;
  }
  return null;
}

export async function executeCommand(
  rawInput: string,
  currentUser: UserState | null,
  isAuthenticatedOrOnSwitch?: boolean | ((newUser: UserState) => void),
  onUserSwitch?: (newUser: UserState) => void
): Promise<ParseResult> {
  let isAuthenticated = true;
  let onSwitch = onUserSwitch;
  if (typeof isAuthenticatedOrOnSwitch === 'boolean') {
    isAuthenticated = isAuthenticatedOrOnSwitch;
  } else if (typeof isAuthenticatedOrOnSwitch === 'function') {
    onSwitch = isAuthenticatedOrOnSwitch;
  }

  const trimmed = rawInput.trim();
  if (!trimmed) {
    return { message: '', outputType: 'text' };
  }

  const tokens = tokenizeCommand(trimmed);
  const baseCmd = tokens[0]?.toLowerCase() || '';

  // -------------------------------------------------------------
  // 1. SYSTEM & HELP COMMANDS
  // -------------------------------------------------------------
  if (baseCmd === '-help' || baseCmd === 'help') {
    const helpText = `╭──────────────── HABITOS HELP ────────────────╮

TASKS
  add "Task name"              Add a task
  list                         Show your tasks
  list today                   Show today's tasks
  done -6                      Complete task #6
  cancel -6                    Cancel task #6
  rename -6 "New name"         Rename task #6
  remove -6                    Remove task #6
  move -6 tomorrow             Move task #6 to tomorrow
  move -6 2026-09-10           Move task #6 to a date

HABITS
  habit add "Name"             Add a habit
  habit list                   Show your habits
  habit done -3                Complete habit #3
  habit streak -3              Show habit #3 streak
  habit graph                  Show habit activity
  habit rename -3 "New name"   Rename habit #3
  habit remove -3              Remove habit #3

DATE & TIME
  date                         Show current date and time
  time                         Show current local and UTC time
  cal                          Show current month calendar

OTHER
  -help                        Show this help
  -cmd                         Show all commands

TIP:
  Numbers such as -3 mean the item number shown in your list.
  Dates accept: YYYY-MM-DD, DD-MM-YYYY, DD/MM/YYYY, DD.MM.YYYY, YYYY/MM/DD.

╰───────────────────────────────────────────────╯`;
    return { message: helpText, outputType: 'info', activeView: 'help' };
  }

  if (baseCmd === '-cmd' || baseCmd === 'cmd') {
    const cmdReference = `TASKS:
  add "Task name"                  Add a task for today
  add tomorrow "Task name"         Add a task scheduled for tomorrow
  add YYYY-MM-DD "Task name"       Add a task scheduled for a specific date (also DD-MM-YYYY, DD/MM/YYYY)
  list                             List all tasks
  list today                       List tasks scheduled for today
  list tomorrow                    List tasks scheduled for tomorrow
  list YYYY-MM-DD                  List tasks scheduled for a date (also DD-MM-YYYY, DD/MM/YYYY)
  done -<number>                   Mark task as completed
  cancel -<number>                 Cancel task
  rename -<number> "New name"      Rename task
  remove -<number>                 Remove task
  move -<number> tomorrow          Move task to tomorrow
  move -<number> today             Move task to today
  move -<number> YYYY-MM-DD        Move task to a specific date (also DD-MM-YYYY, DD/MM/YYYY)

HABITS:
  habit add "Name"                 Add a recurring habit (max 10)
  habit list                       List all habits with today's status
  habit done -<number>             Mark habit as completed for today
  habit streak -<number>           Show streak details and 4-week activity card
  habit graph                      Show activity heatmap for all habits
  habit rename -<number> "Name"    Rename habit
  habit remove -<number>           Remove habit

DATE & TIME:
  date                             Show current local date, time, and timezone
  time                             Show current local, 24-hour, and UTC time
  cal                              Show current month calendar
  cal YYYY-MM                      Show calendar for a specific month (e.g. cal 2026-09)

USER & SYSTEM:
  create user                      Create and register a new user account
  login                            Sign in to an existing account
  user                             Show profile, completion stats, and best streak
  logout                           Log out of the current session
  clear                            Clear the terminal screen
  -help                            Quick overview of common commands
  -cmd                             Full command reference manual

DYNAMIC SERIAL NUMBERS:
  The -<number> (e.g. -1, -6) refers to the item number displayed in \`list\` or \`habit list\`.
  Item numbers update dynamically as tasks and habits are added or removed.

SUPPORTED DATE FORMATS:
  YYYY-MM-DD, DD-MM-YYYY, DD/MM/YYYY, DD.MM.YYYY, YYYY/MM/DD (Indian convention DD/MM/YYYY).`;
    return { message: cmdReference, outputType: 'info', activeView: 'cmd' };
  }

  if (baseCmd === 'clear' || baseCmd === 'cls') {
    return { message: '', outputType: 'text', shouldClear: true };
  }

  // -------------------------------------------------------------
  // DATE COMMAND (date)
  // -------------------------------------------------------------
  if (baseCmd === 'date') {
    return {
      message: generateDateCommandOutput(),
      outputType: 'text',
    };
  }

  // -------------------------------------------------------------
  // TIME COMMAND (time)
  // -------------------------------------------------------------
  if (baseCmd === 'time') {
    return {
      message: generateTimeCommandOutput(),
      outputType: 'text',
    };
  }

  // -------------------------------------------------------------
  // DATABASE STATUS COMMAND (db, db status)
  // -------------------------------------------------------------
  if (baseCmd === 'db') {
    const configured = isSupabaseConfigured();
    let projectHost = 'Not configured';
    if (SUPABASE_URL) {
      try {
        projectHost = new URL(SUPABASE_URL).hostname;
      } catch {
        projectHost = SUPABASE_URL.replace(/^https?:\/\//, '').split('/')[0] || 'Unknown';
      }
    }
    const dbReport = `DATABASE & BACKEND INTEGRATION
────────────────────────────────────────
Database Engine  : PostgreSQL Database
Project Host     : ${projectHost}
Client State     : ${configured ? 'Initialized & Active' : 'Not configured'}
Data Source      : PostgreSQL Database (sole persistent source of truth)
Schema Tables    : profiles, tasks, habits, habit_completions
Row Level Sec.   : Enforced (RLS active on all 4 tables)
Auth Provider    : Database Auth (Active session-based authentication)
Auth Pipeline    : CLI User ID → Database Auth → profiles
Current Mode     : Production Mode
Authentication   : Active Database session (mock/localStorage disabled)
────────────────────────────────────────`;
    return {
      message: dbReport,
      outputType: 'info',
    };
  }

  // -------------------------------------------------------------
  // ADMIN ACCESS COMMAND (admin) - Hidden CLI Command
  // -------------------------------------------------------------
  if (baseCmd === 'admin') {
    if (!isAuthenticated || !currentUser) {
      return {
        message: 'Admin access denied: User authentication required.',
        outputType: 'error',
      };
    }

    const adminCheck = await adminService.checkIsAdmin();
    if (adminCheck.error || !adminCheck.data) {
      return {
        message: 'Admin access denied: Administrator privileges required.',
        outputType: 'error',
      };
    }

    return {
      message: 'Admin access verified. Initializing HabitOS Admin Console...',
      outputType: 'success',
      action: 'OPEN_ADMIN',
    };
  }

  // -------------------------------------------------------------
  // CALENDAR COMMAND (cal, cal YYYY-MM, cal MM-YYYY, or legacy view -cal)
  // -------------------------------------------------------------
  if (baseCmd === 'cal' || baseCmd === 'calendar' || (baseCmd === 'view' && tokens.some(t => t.toLowerCase() === '-cal' || t.toLowerCase() === 'cal'))) {
    const arg = tokens.find(t => t.toLowerCase() !== 'cal' && t.toLowerCase() !== 'calendar' && t.toLowerCase() !== 'view' && t.toLowerCase() !== '-cal');
    let calYear: number | undefined;
    let calMonth: number | undefined;

    if (arg) {
      const parts = arg.split(/[-/.]/);
      if (parts.length === 2) {
        if (parts[0].length === 4 && /^\d{4}$/.test(parts[0])) {
          calYear = parseInt(parts[0], 10);
          calMonth = parseInt(parts[1], 10);
        } else if (parts[1].length === 4 && /^\d{4}$/.test(parts[1])) {
          calYear = parseInt(parts[1], 10);
          calMonth = parseInt(parts[0], 10);
        }
      } else if (parts.length === 3) {
        // e.g. 2026-09-15 or 15-09-2026
        const parsed = parseUserDate(arg);
        if (parsed) {
          const [y, m] = parsed.split('-').map(Number);
          calYear = y;
          calMonth = m;
        }
      }

      if (!calYear || !calMonth || calMonth < 1 || calMonth > 12 || calYear < 1000 || calYear > 9999) {
        return {
          message: `Invalid month or year: ${arg}\n\nUsage:\n  cal\n  cal 2026-09\n  cal 09-2026`,
          outputType: 'error',
        };
      }
    }

    return {
      message: generateMonthCalendar(calYear, calMonth),
      outputType: 'text',
    };
  }

  // -------------------------------------------------------------
  // 2. USER & AUTHENTICATION COMMANDS
  // -------------------------------------------------------------
  // create user
  if (baseCmd === 'create' && tokens[1]?.toLowerCase() === 'user') {
    const rawArg = tokens.slice(2).join(' ').replace(/^["']|["']$/g, '').trim();
    return {
      message: '',
      outputType: 'info',
      action: 'START_CREATE_USER',
      actionArg: rawArg || undefined,
    };
  }

  // login
  if (baseCmd === 'login') {
    if (isAuthenticated && currentUser) {
      return {
        message: `Already logged in as '${currentUser.userId}'. Type 'logout' first to switch accounts.`,
        outputType: 'warning',
      };
    }
    const rawArg = tokens.slice(1).join(' ').replace(/^["']|["']$/g, '').trim();
    return {
      message: '',
      outputType: 'info',
      action: 'START_LOGIN',
      actionArg: rawArg || undefined,
    };
  }

  // logout
  if (baseCmd === 'logout') {
    if (!isAuthenticated || !currentUser) {
      return {
        message: `No active user session to log out. Type 'login' or 'create user'.`,
        outputType: 'warning',
      };
    }
    return {
      message: `Logging out...\n\nSession closed.`,
      outputType: 'info',
      action: 'LOGOUT',
    };
  }

  // user / user "<user-id>"
  if (baseCmd === 'user') {
    if (!isAuthenticated || !currentUser) {
      return {
        message: `ERROR: Authentication required.`,
        outputType: 'error',
      };
    }

    const rawTarget = tokens.slice(1).join(' ').replace(/^["']|["']$/g, '').trim();
    if (rawTarget && rawTarget.toLowerCase() !== currentUser.userId.toLowerCase()) {
      return {
        message: `ERROR: Access denied.\nYou can only view your own profile.`,
        outputType: 'error',
      };
    }

    let currentTasks = currentUser.tasks;
    let currentHabits = currentUser.habits;

    if (isSupabaseConfigured()) {
      try {
        const [tasksRes, habitsRes] = await Promise.all([
          taskService.fetchTasks(),
          habitService.fetchHabits(),
        ]);
        if (tasksRes.data) currentTasks = tasksRes.data;
        if (habitsRes.data) currentHabits = habitsRes.data;
      } catch {
        // Fall back to current memory state
      }
    }

    const today = getTodayString();
    const habitsTotal = currentHabits.length;
    const habitsTodayDone = currentHabits.filter(h => !!h.history[today]).length;
    const tasksTotal = currentTasks.length;
    const tasksCompleted = currentTasks.filter(t => t.status === 'done').length;
    const tasksPending = currentTasks.filter(t => t.status === 'todo').length;
    const currentStreak = currentHabits.length > 0
      ? Math.max(0, ...currentHabits.map(h => h.currentStreak || 0))
      : 0;
    const longestStreak = currentHabits.length > 0
      ? Math.max(0, ...currentHabits.map(h => h.bestStreak || 0))
      : 0;

    const profileText = `----------------------------------------
 USER PROFILE
----------------------------------------

User ID          : ${currentUser.userName || currentUser.userId}
Account Status   : ACTIVE
Storage Backend  : PostgreSQL Database (Authoritative Single Source of Truth)

Habits           : ${habitsTodayDone} / ${habitsTotal}
Total Tasks      : ${tasksTotal}
Completed Tasks  : ${tasksCompleted}
Pending Tasks    : ${tasksPending}

Current Streak   : ${currentStreak} days
Longest Streak   : ${longestStreak} days

----------------------------------------`;

    const updatedUser: UserState = {
      ...currentUser,
      tasks: currentTasks,
      habits: currentHabits,
    };

    return {
      message: profileText,
      outputType: 'text',
      updatedUser,
    };
  }

  // -------------------------------------------------------------
  // AUTHENTICATION GUARD: All remaining commands require active user
  // -------------------------------------------------------------
  if (!isAuthenticated || !currentUser) {
    return {
      message: `ERROR: Authentication required.\nTIP: Type 'login' to sign in or 'create user' to register.`,
      outputType: 'error',
    };
  }

  // Ensure active database session before DB operations (Requirements 6 & 7)
  if (isSupabaseConfigured()) {
    const session = await authService.getSession();
    if (!session || !session.user) {
      if (baseCmd === 'add') {
        return {
          message: `ERROR: Unauthenticated: Cannot create task without active database session.`,
          outputType: 'error',
        };
      }
      return {
        message: `ERROR: Unauthenticated: No active database session.\nTIP: Type 'login' to sign in or 'create user' to register.`,
        outputType: 'error',
      };
    }
  }

  // -------------------------------------------------------------
  // 3. HABIT & TASK COMMAND DISPATCHER
  // -------------------------------------------------------------
  const isHabitCmd = tokens.some(t => t.toLowerCase() === '-h');

  // -------------------------------------------------------------
  // HABIT NAMESPACE COMMANDS:
  // habit add "name" | habit list | habit done -<num> |
  // habit streak -<num> | habit graph | habit rename -<num> "name" |
  // habit remove -<num>
  // -------------------------------------------------------------
  if (baseCmd === 'habit' || baseCmd === 'habits') {
    const subCmd = tokens[1]?.toLowerCase() || '';

    // habit add "Habit name"
    if (subCmd === 'add') {
      if (currentUser.habits.length >= 10) {
        return {
          message: `You can have a maximum of 10 active habits.\nRemove an existing habit before adding another.`,
          outputType: 'error',
          activeView: 'habits',
        };
      }

      const habitName = tokens.slice(2).join(' ').trim();
      if (!habitName) {
        return {
          message: `Missing habit name.\n\nUsage:\n  habit add "Habit name"\nExample:\n  habit add "Exercise"`,
          outputType: 'error',
          activeView: 'habits',
        };
      }

      // Persist to Supabase database
      const res = await habitService.createHabit(habitName);
      if (res.error) {
        return {
          message: `ERROR: ${res.error}`,
          outputType: 'error',
          activeView: 'habits',
        };
      }

      const fetchFresh = await habitService.fetchHabits();
      const updatedHabits = fetchFresh.data || [...currentUser.habits, res.data || {
        id: generateUUID(),
        name: habitName,
        createdAt: new Date().toISOString(),
        history: {},
        currentStreak: 0,
        bestStreak: 0,
      }];

      const updatedUser: UserState = {
        ...currentUser,
        habits: updatedHabits,
      };

      const serial = updatedHabits.findIndex(h => res.data ? h.id === res.data.id : h.name === habitName) + 1 || updatedHabits.length;
      return {
        message: `✓ Added habit #${serial}: "${habitName}". Track it with 'habit done -${serial}' or 'habit list'.`,
        outputType: 'success',
        updatedUser,
        activeView: 'habits',
      };
    }

    // habit list
    if (subCmd === 'list' || subCmd === 'ls' || subCmd === '') {
      // Authoritative read from Supabase
      const res = await habitService.fetchHabits();
      if (res.error) {
        return {
          message: `ERROR: ${res.error}`,
          outputType: 'error',
          activeView: 'habits',
        };
      }

      const dbHabits = res.data || [];
      const updatedUser: UserState = {
        ...currentUser,
        habits: dbHabits,
      };

      if (dbHabits.length === 0) {
        return {
          message: `No habits tracked yet. Add one with: habit add "habit name"`,
          outputType: 'warning',
          updatedUser,
          activeView: 'habits',
        };
      }
      const today = getTodayString();
      let completedTodayCount = 0;

      const lines = dbHabits.map((habit, index) => {
        const serial = `[${index + 1}]`;
        const isDoneToday = !!habit.history[today];
        if (isDoneToday) completedTodayCount++;
        const checkTag = isDoneToday ? '[✓]' : '[ ]';
        const streakInfo = `Streak: ${habit.currentStreak}d (best: ${habit.bestStreak}d)`;
        return `${serial.padEnd(5)} ${checkTag} ${habit.name.padEnd(26)} ${streakInfo}`;
      });

      const percent = Math.round((completedTodayCount / dbHabits.length) * 100);
      const header = `HABIT LIST (Total: ${dbHabits.length})\n────────────────────────────────────────────────────────────\n`;
      const footer = `\n────────────────────────────────────────────────────────────\nToday's Status: ${completedTodayCount}/${dbHabits.length} completed (${percent}%)\nLegend: [✓] Completed Today  [ ] Pending Today\nCommands: habit done -<num> | habit streak -<num> | habit graph`;

      return { message: header + lines.join('\n') + footer, outputType: 'text', updatedUser, activeView: 'habits' };
    }

    // habit done -<serial>
    if (subCmd === 'done') {
      const serialToken = tokens[2];
      const serialIndex = parseSerialNumberToken(serialToken);

      if (serialIndex === null) {
        return {
          message: `Missing habit number.\n\nUsage:\n  habit done -<habit-number>\nExample:\n  habit done -3`,
          outputType: 'error',
          activeView: 'habits',
        };
      }

      if (serialIndex < 1 || serialIndex > currentUser.habits.length) {
        return {
          message: `Habit #${serialIndex} does not exist.\n\nUse \`habit list\` to see your current habits.`,
          outputType: 'error',
          activeView: 'habits',
        };
      }

      const habit = currentUser.habits[serialIndex - 1];
      const today = getTodayString();

      // Idempotency: check if already completed today
      if (habit.history[today]) {
        return {
          message: `Habit #${serialIndex} is already completed today.`,
          outputType: 'info',
          activeView: 'habits',
        };
      }

      // Persist completion row in Supabase
      const res = await habitService.markHabitDone(habit.id, today);
      if (res.error) {
        return {
          message: `ERROR: ${res.error}`,
          outputType: 'error',
          activeView: 'habits',
        };
      }

      const fetchFresh = await habitService.fetchHabits();
      let updatedHabits: Habit[];
      let currentStreak = 1;
      if (fetchFresh.data) {
        updatedHabits = fetchFresh.data;
        const freshH = updatedHabits.find(h => h.id === habit.id);
        if (freshH) currentStreak = freshH.currentStreak;
      } else {
        const updatedHistory = { ...habit.history, [today]: true };
        const streaks = calculateHabitStreaks(updatedHistory, habit.createdAt);
        currentStreak = streaks.currentStreak;
        updatedHabits = currentUser.habits.map((h, idx) => {
          if (idx === serialIndex - 1) {
            return {
              ...h,
              history: updatedHistory,
              currentStreak: streaks.currentStreak,
              bestStreak: streaks.bestStreak,
            };
          }
          return h;
        });
      }

      const updatedUser: UserState = { ...currentUser, habits: updatedHabits };

      return {
        message: `✓ Completed habit #${serialIndex}: "${habit.name}" for today! 🔥 Streak: ${currentStreak} day(s).`,
        outputType: 'success',
        updatedUser,
        activeView: 'habits',
      };
    }

    // habit streak -<serial>
    if (subCmd === 'streak' || subCmd === 'streaks' || subCmd === 'stats') {
      const rawArg = tokens[2];

      if (!rawArg) {
        return {
          message: `Missing habit number.\n\nUsage:\n  habit streak -<habit-number>\nExample:\n  habit streak -1`,
          outputType: 'error',
          activeView: 'habits',
        };
      }

      // Rejection of multi-habit selection / slashes
      const remainingArgs = tokens.slice(2).join(' ');
      if (remainingArgs.includes('/') || tokens.length > 3) {
        return {
          message: `Multi-habit syntax is not supported. Please specify a single habit serial number.\n\nUsage:\n  habit streak -<serial-number>\nExample:\n  habit streak -1`,
          outputType: 'error',
          activeView: 'habits',
        };
      }

      // Bare number without dash (e.g. habit streak 1 or habit streak 3)
      if (/^\d+$/.test(rawArg)) {
        return {
          message: `Habit serial number must be formatted as '-<serial-number>'.\n\nUsage:\n  habit streak -<serial-number>\nExample:\n  habit streak -${rawArg}`,
          outputType: 'error',
          activeView: 'habits',
        };
      }

      const targetIndex = parseSerialNumberToken(rawArg);
      if (targetIndex === null) {
        return {
          message: `Missing habit number.\n\nUsage:\n  habit streak -<habit-number>\nExample:\n  habit streak -1`,
          outputType: 'error',
          activeView: 'habits',
        };
      }

      // Authoritative read from Supabase
      const res = await habitService.fetchHabits();
      if (res.error) {
        return {
          message: `ERROR: ${res.error}`,
          outputType: 'error',
          activeView: 'habits',
        };
      }

      const freshHabits = res.data || [];
      if (targetIndex < 1 || targetIndex > freshHabits.length) {
        return {
          message: `Habit #${targetIndex} does not exist.\n\nUse \`habit list\` to see your current habits.`,
          outputType: 'error',
          activeView: 'habits',
        };
      }

      const habit = freshHabits[targetIndex - 1];
      const card = formatHabitActivityCard(habit, targetIndex);
      return {
        message: `${card}\n\nLegend: █ Completed  ▒ Today Pending  ░ Missed  · Upcoming\nCommands: habit done -${targetIndex} | habit streak -${targetIndex} | habit list`,
        outputType: 'ascii-graph',
        activeView: 'habit_stats',
      };
    }

    // habit graph
    if (subCmd === 'graph' || subCmd === 'g') {
      // Authoritative read from Supabase
      const res = await habitService.fetchHabits();
      if (res.error) {
        return {
          message: `ERROR: ${res.error}`,
          outputType: 'error',
          activeView: 'habit_stats',
        };
      }

      const freshHabits = res.data || [];
      if (freshHabits.length === 0) {
        return {
          message: `No habits to generate graphs for. Use: habit add "habit name"`,
          outputType: 'warning',
          activeView: 'habit_stats',
        };
      }

      // Check for optional serial (e.g. habit graph -1)
      const targetSerial = tokens[2] ? parseSerialNumberToken(tokens[2]) : null;
      if (targetSerial !== null) {
        if (targetSerial < 1 || targetSerial > freshHabits.length) {
          return {
            message: `Habit #${targetSerial} does not exist.\n\nUse \`habit list\` to see your current habits.`,
            outputType: 'error',
            activeView: 'habits',
          };
        }
        const habit = freshHabits[targetSerial - 1];
        const card = formatHabitActivityCard(habit, targetSerial);
        return {
          message: card + `\n\nLegend: █ Completed  ▒ Today Pending  ░ Missed  · Upcoming\nCommands: habit done -${targetSerial} | habit streak -${targetSerial} | habit list`,
          outputType: 'ascii-graph',
          activeView: 'habit_stats',
        };
      }

      const cards = freshHabits.map((h, idx) => formatHabitActivityCard(h, idx + 1));
      const fullGraph = cards.join('\n\n') + `\n\nLegend: █ Completed  ▒ Today Pending  ░ Missed  · Upcoming\nCommands: habit done -<serial> | habit streak -<serial> | habit list`;
      return { message: fullGraph, outputType: 'ascii-graph', activeView: 'habit_stats' };
    }

    // habit rename -<serial> "New Name"
    if (subCmd === 'rename') {
      const serialToken = tokens[2];
      const serialIndex = parseSerialNumberToken(serialToken);

      if (serialIndex === null) {
        return {
          message: `Missing habit number.\n\nUsage:\n  habit rename -<habit-number> "new name"\nExample:\n  habit rename -3 "Morning Exercise"`,
          outputType: 'error',
          activeView: 'habits',
        };
      }

      if (serialIndex < 1 || serialIndex > currentUser.habits.length) {
        return {
          message: `Habit #${serialIndex} does not exist.\n\nUse \`habit list\` to see your current habits.`,
          outputType: 'error',
          activeView: 'habits',
        };
      }

      const newName = tokens.slice(3).join(' ').trim();
      if (!newName) {
        return {
          message: `Missing new habit name.\n\nUsage:\n  habit rename -${serialIndex} "new name"\nExample:\n  habit rename -${serialIndex} "Morning Exercise"`,
          outputType: 'error',
          activeView: 'habits',
        };
      }

      const oldHabit = currentUser.habits[serialIndex - 1];

      // Supabase-backed rename
      const res = await habitService.renameHabit(oldHabit.id, newName);
      if (res.error) {
        return {
          message: `ERROR: ${res.error}`,
          outputType: 'error',
          activeView: 'habits',
        };
      }

      const fetchFresh = await habitService.fetchHabits();
      const updatedHabits = fetchFresh.data || currentUser.habits.map((h, idx) => idx === serialIndex - 1 ? { ...h, name: newName } : h);
      const updatedUser: UserState = { ...currentUser, habits: updatedHabits };

      return {
        message: `✓ Renamed habit #${serialIndex} from "${oldHabit.name}" to "${newName}".`,
        outputType: 'success',
        updatedUser,
        activeView: 'habits',
      };
    }

    // habit remove -<serial> (or habit remove "name")
    if (subCmd === 'remove' || subCmd === 'rem' || subCmd === 'rm') {
      const serialToken = tokens[2];
      const serialIndex = parseSerialNumberToken(serialToken);

      if (serialIndex !== null) {
        if (serialIndex < 1 || serialIndex > currentUser.habits.length) {
          return {
            message: `Habit #${serialIndex} does not exist.\n\nUse \`habit list\` to see your current habits.`,
            outputType: 'error',
            activeView: 'habits',
          };
        }
        const removed = currentUser.habits[serialIndex - 1];

        // Supabase-backed deletion
        const res = await habitService.deleteHabit(removed.id);
        if (res.error) {
          return {
            message: `ERROR: ${res.error}`,
            outputType: 'error',
            activeView: 'habits',
          };
        }

        const fetchFresh = await habitService.fetchHabits();
        const updatedHabits = fetchFresh.data || currentUser.habits.filter((_, idx) => idx !== serialIndex - 1);
        const updatedUser: UserState = { ...currentUser, habits: updatedHabits };

        return {
          message: `✓ Removed habit #${serialIndex}: "${removed.name}".`,
          outputType: 'success',
          updatedUser,
          activeView: 'habits',
        };
      }

      const targetName = tokens.slice(2).join(' ').trim();
      if (targetName) {
        const foundIndex = currentUser.habits.findIndex(h => h.name.toLowerCase() === targetName.toLowerCase());
        if (foundIndex === -1) {
          return {
            message: `Habit "${targetName}" does not exist.\n\nUse \`habit list\` to see your current habits.`,
            outputType: 'error',
            activeView: 'habits',
          };
        }
        const removed = currentUser.habits[foundIndex];

        // Supabase-backed deletion
        const res = await habitService.deleteHabit(removed.id);
        if (res.error) {
          return {
            message: `ERROR: ${res.error}`,
            outputType: 'error',
            activeView: 'habits',
          };
        }

        const fetchFresh = await habitService.fetchHabits();
        const updatedHabits = fetchFresh.data || currentUser.habits.filter((_, idx) => idx !== foundIndex);
        const updatedUser: UserState = { ...currentUser, habits: updatedHabits };

        return {
          message: `✓ Removed habit #${foundIndex + 1}: "${removed.name}".`,
          outputType: 'success',
          updatedUser,
          activeView: 'habits',
        };
      }

      return {
        message: `Missing habit number.\n\nUsage:\n  habit remove -<habit-number>\nExample:\n  habit remove -3`,
        outputType: 'error',
        activeView: 'habits',
      };
    }

    // habit undone -<serial>
    if (subCmd === 'undone' || subCmd === 'undo') {
      const serialToken = tokens[2];
      const serialIndex = parseSerialNumberToken(serialToken);

      if (serialIndex === null) {
        return {
          message: `Missing habit number.\n\nUsage:\n  habit undone -<habit-number>\nExample:\n  habit undone -1`,
          outputType: 'error',
          activeView: 'habits',
        };
      }

      if (serialIndex < 1 || serialIndex > currentUser.habits.length) {
        return {
          message: `Habit #${serialIndex} does not exist.\n\nUse \`habit list\` to see your current habits.`,
          outputType: 'error',
          activeView: 'habits',
        };
      }

      const habit = currentUser.habits[serialIndex - 1];
      const today = getTodayString();
      if (!habit.history[today]) {
        return {
          message: `Habit "${habit.name}" was not completed today.`,
          outputType: 'warning',
          activeView: 'habits',
        };
      }

      // Remove completion record from Supabase
      const res = await habitCompletionService.removeCompletion(habit.id, today);
      if (res.error) {
        return {
          message: `ERROR: ${res.error}`,
          outputType: 'error',
          activeView: 'habits',
        };
      }

      const fetchFresh = await habitService.fetchHabits();
      let updatedHabits: Habit[];
      let currentStreak = 0;
      if (fetchFresh.data) {
        updatedHabits = fetchFresh.data;
        const freshH = updatedHabits.find(h => h.id === habit.id);
        if (freshH) currentStreak = freshH.currentStreak;
      } else {
        const updatedHistory = { ...habit.history };
        delete updatedHistory[today];
        const streaks = calculateHabitStreaks(updatedHistory, habit.createdAt);
        currentStreak = streaks.currentStreak;
        updatedHabits = currentUser.habits.map((h, idx) => {
          if (idx === serialIndex - 1) {
            return {
              ...h,
              history: updatedHistory,
              currentStreak: streaks.currentStreak,
              bestStreak: streaks.bestStreak,
            };
          }
          return h;
        });
      }

      const updatedUser: UserState = { ...currentUser, habits: updatedHabits };

      return {
        message: `✓ Unchecked habit #${serialIndex}: "${habit.name}" for today. Current streak: ${currentStreak} day(s).`,
        outputType: 'warning',
        updatedUser,
        activeView: 'habits',
      };
    }

    return {
      message: `Habit Command Reference:\n  habit add "Name"             Add a habit\n  habit list                   Show your habits\n  habit done -3                Complete habit #3\n  habit streak -3              Show habit #3 streak\n  habit graph                  Show habit activity\n  habit rename -3 "New name"   Rename habit #3\n  habit remove -3              Remove habit #3`,
      outputType: 'info',
      activeView: 'habits',
    };
  }

  // -------------------------------------------------------------
  // LIST COMMAND (list, list today, list tomorrow, list YYYY-MM-DD)
  // and VIEW COMMAND (view -list, view -g, view -h -list, view -h -g)
  // -------------------------------------------------------------
  if (baseCmd === 'list' || baseCmd === 'view') {
    // view -h -list or view -h
    if (baseCmd === 'view' && tokens.some(t => t.toLowerCase() === '-h') && tokens.some(t => t.toLowerCase() === '-list' || t.toLowerCase() === 'list')) {
      return await executeCommand('habit list', currentUser, isAuthenticated, onSwitch);
    }

    // view -h -g
    if (baseCmd === 'view' && tokens.some(t => t.toLowerCase() === '-h') && tokens.some(t => t.toLowerCase() === '-g' || t.toLowerCase() === 'graph')) {
      return await executeCommand('habit graph', currentUser, isAuthenticated, onSwitch);
    }

    // Authoritative fetch from Supabase
    const fetchRes = await taskService.fetchTasks();
    if (fetchRes.error) {
      return {
        message: `ERROR: ${fetchRes.error}`,
        outputType: 'error',
        activeView: 'tasks',
      };
    }

    const currentTasks = fetchRes.data || [];
    const updatedUser: UserState = {
      ...currentUser,
      tasks: currentTasks,
    };

    // view -g (Task Graphical Progress)
    if (baseCmd === 'view' && tokens.some(t => t.toLowerCase() === '-g')) {
      if (currentTasks.length === 0) {
        return { message: `No tasks to generate graphs for. Use: add "task name"`, outputType: 'warning', updatedUser, activeView: 'task_stats' };
      }

      const total = currentTasks.length;
      const done = currentTasks.filter(t => t.status === 'done').length;
      const todo = currentTasks.filter(t => t.status === 'todo').length;
      const cancelled = currentTasks.filter(t => t.status === 'cancelled').length;
      const percent = Math.round((done / total) * 100);

      const barWidth = 28;
      const filled = Math.round((percent / 100) * barWidth);
      const progressBar = '█'.repeat(filled) + '░'.repeat(Math.max(0, barWidth - filled));

      let graph = `TASK COMPLETION & STATISTICAL BREAKDOWN\n────────────────────────────────────────────────────────────\n\n`;
      graph += `Overall Completion Rate: [${progressBar}] ${percent}%\n\n`;
      graph += `  • Total Tasks:     ${total.toString().padEnd(4)}  ${'■'.repeat(Math.min(24, total))}\n`;
      graph += `  • Completed (done): ${done.toString().padEnd(4)}  ${'■'.repeat(Math.min(24, done))}\n`;
      graph += `  • Pending (todo):   ${todo.toString().padEnd(4)}  ${'■'.repeat(Math.min(24, todo))}\n`;
      graph += `  • Cancelled:        ${cancelled.toString().padEnd(4)}  ${'■'.repeat(Math.min(24, cancelled))}\n\n`;
      
      const todayTasks = currentTasks.filter(t => t.scheduledDate === getTodayString());
      graph += `Today's Schedule (${getTodayString()}): ${todayTasks.length} tasks scheduled.\n`;
      graph += `────────────────────────────────────────────────────────────\nTip: Use 'done -<serial-number>' or 'move -<serial-number> tomorrow' to update.`;

      return { message: graph, outputType: 'ascii-graph', updatedUser, activeView: 'task_stats' };
    }

    // List tasks (list, list today, list tomorrow, list YYYY-MM-DD, list 15-09-2026, view -list)
    let filterDate: string | null = null;
    const args = tokens.slice(1).filter(t => t.toLowerCase() !== '-list' && t.toLowerCase() !== 'list');

    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      const low = arg.toLowerCase();

      // Check 3-token date sequence: e.g. "15" "Sep" "2026"
      if (i + 2 < args.length && /^\d{1,2}$/.test(arg) && MONTH_NAMES[args[i + 1].toLowerCase()] && /^\d{4}$/.test(args[i + 2])) {
        const candidate3 = `${arg} ${args[i + 1]} ${args[i + 2]}`;
        const parsed3 = parseUserDate(`${arg}-${args[i + 1]}-${args[i + 2]}`);
        if (parsed3) {
          filterDate = parsed3;
          i += 2;
          continue;
        } else {
          return {
            message: getInvalidDateErrorMessage(candidate3, 'list'),
            outputType: 'error',
            updatedUser,
            activeView: 'tasks',
          };
        }
      }

      if (low === 'today' || low === '-today') {
        filterDate = getTodayString();
      } else if (low === 'tomorrow' || low === 'tom' || low === '-tom') {
        filterDate = getTomorrowString();
      } else if (isDateLike(arg)) {
        const parsed = parseUserDate(arg);
        if (parsed) {
          filterDate = parsed;
        } else {
          return {
            message: getInvalidDateErrorMessage(arg, 'list'),
            outputType: 'error',
            updatedUser,
            activeView: 'tasks',
          };
        }
      } else {
        return {
          message: getInvalidDateErrorMessage(arg, 'list'),
          outputType: 'error',
          updatedUser,
          activeView: 'tasks',
        };
      }
    }

    if (currentTasks.length === 0) {
      return {
        message: `Task list is empty. Add a task with: add "task name"`,
        outputType: 'warning',
        updatedUser,
        activeView: 'tasks',
      };
    }

    const tasksToDisplay = filterDate
      ? currentTasks.map((task, originalIndex) => ({ task, originalIndex })).filter(item => item.task.scheduledDate === filterDate)
      : currentTasks.map((task, originalIndex) => ({ task, originalIndex }));

    if (filterDate && tasksToDisplay.length === 0) {
      return {
        message: `No tasks scheduled for ${formatDateDisplay(filterDate)}. Run 'list' to see all tasks.`,
        outputType: 'info',
        updatedUser,
        activeView: 'tasks',
      };
    }

    const lines = tasksToDisplay.map(({ task, originalIndex }) => {
      const serial = `[${originalIndex + 1}]`;
      let statusTag = '[TODO]';
      if (task.status === 'done') statusTag = '[DONE]';
      if (task.status === 'cancelled') statusTag = '[CANCELLED]';

      const dateTag = formatDateDisplay(task.scheduledDate);
      let timeInfo = '';
      if (task.status === 'done' && task.completedAt) {
        timeInfo = ` Completed: ${formatTimeDisplay(task.completedAt)}`;
      } else if (task.status === 'cancelled' && task.cancelledAt) {
        timeInfo = ` Cancelled: ${formatTimeDisplay(task.cancelledAt)}`;
      } else if (task.createdAt) {
        timeInfo = ` Created: ${formatTimeDisplay(task.createdAt)}`;
      }

      return `${serial.padEnd(5)} ${statusTag.padEnd(13)} ${task.name.padEnd(26)} (${dateTag})${timeInfo}`;
    });

    const title = filterDate
      ? `TASK LIST for ${formatDateDisplay(filterDate)} (Total: ${tasksToDisplay.length})`
      : `TASK LIST (Total: ${currentTasks.length})`;
    const output = `${title}\n────────────────────────────────────────────────────────────\n` +
      lines.join('\n') +
      `\n────────────────────────────────────────────────────────────\nCommands: done -<num> | cancel -<num> | move -<num> tomorrow | remove -<num>`;
    return { message: output, outputType: 'text', updatedUser, activeView: 'tasks' };
  }

  // -------------------------------------------------------------
  // STREAK COMMAND (streak -<serial-number> -> alias for habit streak)
  // -------------------------------------------------------------
  if (baseCmd === 'streak' || baseCmd === 'streaks') {
    const forwardTokens = ['habit', 'streak', ...tokens.slice(1)];
    return await executeCommand(forwardTokens.join(' '), currentUser, isAuthenticated, onSwitch);
  }

  // -------------------------------------------------------------
  // ADD COMMAND (add "task name", add tomorrow "task name", add YYYY-MM-DD "task name")
  // (or add -h "habit name")
  // -------------------------------------------------------------
  if (baseCmd === 'add') {
    if (isHabitCmd) {
      const forwardTokens = ['habit', 'add', ...tokens.filter(t => t.toLowerCase() !== 'add' && t.toLowerCase() !== '-h')];
      return await executeCommand(forwardTokens.join(' '), currentUser, isAuthenticated, onSwitch);
    }

    let scheduledDate = getTodayString();
    let dateFound = false;
    const taskTokens: string[] = [];
    let invalidDateStr: string | null = null;

    for (let i = 1; i < tokens.length; i++) {
      const t = tokens[i];
      const low = t.toLowerCase();

      // Check 3-token date sequence: e.g. "15" "Sep" "2026"
      if (!dateFound && i + 2 < tokens.length) {
        if (/^\d{1,2}$/.test(t) && MONTH_NAMES[tokens[i + 1].toLowerCase()] && /^\d{4}$/.test(tokens[i + 2])) {
          const candidate3 = `${t} ${tokens[i + 1]} ${tokens[i + 2]}`;
          const parsed3 = parseUserDate(`${t}-${tokens[i + 1]}-${tokens[i + 2]}`);
          if (parsed3) {
            scheduledDate = parsed3;
            dateFound = true;
            i += 2;
            continue;
          } else {
            invalidDateStr = candidate3;
            break;
          }
        }
      }

      if (!dateFound && (low === 'tomorrow' || low === 'tom' || low === '-tom')) {
        scheduledDate = getTomorrowString();
        dateFound = true;
      } else if (!dateFound && (low === 'today' || low === '-today')) {
        scheduledDate = getTodayString();
        dateFound = true;
      } else if (isDateLike(t)) {
        const parsed = parseUserDate(t);
        if (parsed) {
          if (!dateFound) {
            scheduledDate = parsed;
            dateFound = true;
          }
        } else {
          invalidDateStr = t;
          break;
        }
      } else {
        taskTokens.push(t);
      }
    }

    if (invalidDateStr) {
      return {
        message: getInvalidDateErrorMessage(invalidDateStr, 'add'),
        outputType: 'error',
      };
    }

    const taskName = taskTokens.join(' ').trim();
    if (!taskName) {
      return {
        message: `Missing task name.\n\nUsage:\n  add "Task name"\n  add YYYY-MM-DD "Task name"\n  add DD-MM-YYYY "Task name"\nExample:\n  add 15-09-2026 "Problem Solving"`,
        outputType: 'error',
      };
    }

    const newTask: Task = {
      id: generateUUID(),
      name: taskName,
      status: 'todo',
      scheduledDate,
      createdAt: new Date().toISOString(),
    };

    // Persist to database (ensure session is available first)
    if (isSupabaseConfigured()) {
      const session = await authService.getSession();
      if (!session || !session.user) {
        return {
          message: `ERROR: Unauthenticated: Cannot create task without active database session.`,
          outputType: 'error',
          activeView: 'tasks',
        };
      }
    }

    const res = await taskService.createTask(newTask);
    if (res.error) {
      return {
        message: `ERROR: ${res.error}`,
        outputType: 'error',
        activeView: 'tasks',
      };
    }

    const fetchFresh = await taskService.fetchTasks();
    const createdTask = res.data || newTask;
    const updatedTasks = fetchFresh.data || [...currentUser.tasks, createdTask];
    const updatedUser: UserState = {
      ...currentUser,
      tasks: updatedTasks,
    };

    const serial = updatedTasks.findIndex(t => t.id === createdTask.id) + 1 || updatedTasks.length;
    return {
      message: `✓ Added task #${serial}: "${createdTask.name}" (${formatDateDisplay(scheduledDate)}).`,
      outputType: 'success',
      updatedUser,
      activeView: 'tasks',
    };
  }

  // -------------------------------------------------------------
  // REMOVE COMMAND (remove -<serial>, rem -<serial>, rm -<serial>)
  // -------------------------------------------------------------
  if (baseCmd === 'remove' || baseCmd === 'rem' || baseCmd === 'rm') {
    if (isHabitCmd) {
      const forwardTokens = ['habit', 'remove', ...tokens.filter(t => t.toLowerCase() !== baseCmd && t.toLowerCase() !== '-h')];
      return await executeCommand(forwardTokens.join(' '), currentUser, isAuthenticated, onSwitch);
    }

    const otherTokens = tokens.filter(t => t.toLowerCase() !== baseCmd);
    let serialIndex: number | null = null;
    let targetName: string | null = null;

    for (const t of otherTokens) {
      const parsed = parseSerialNumberToken(t);
      if (parsed !== null) {
        serialIndex = parsed;
        break;
      }
    }

    if (serialIndex === null && otherTokens.length > 0) {
      targetName = otherTokens.join(' ');
    }

    if (serialIndex !== null) {
      if (serialIndex < 1 || serialIndex > currentUser.tasks.length) {
        return {
          message: `Task #${serialIndex} does not exist.\n\nUse \`list\` to see your current task numbers.`,
          outputType: 'error',
        };
      }
      const removed = currentUser.tasks[serialIndex - 1];

      // Delete from Supabase
      const res = await taskService.deleteTask(removed.id);
      if (res.error) {
        return {
          message: `ERROR: ${res.error}`,
          outputType: 'error',
          activeView: 'tasks',
        };
      }

      const fetchFresh = await taskService.fetchTasks();
      const updatedTasks = fetchFresh.data || currentUser.tasks.filter((_, idx) => idx !== serialIndex - 1);
      const updatedUser: UserState = { ...currentUser, tasks: updatedTasks };

      return {
        message: `✓ Removed task #${serialIndex}: "${removed.name}".`,
        outputType: 'success',
        updatedUser,
        activeView: 'tasks',
      };
    }

    if (targetName) {
      const foundIndex = currentUser.tasks.findIndex(t => t.name.toLowerCase() === targetName!.toLowerCase());
      if (foundIndex === -1) {
        return {
          message: `Task "${targetName}" does not exist.\n\nUse \`list\` to see your current task numbers.`,
          outputType: 'error',
        };
      }
      const removed = currentUser.tasks[foundIndex];

      // Delete from Supabase
      const res = await taskService.deleteTask(removed.id);
      if (res.error) {
        return {
          message: `ERROR: ${res.error}`,
          outputType: 'error',
          activeView: 'tasks',
        };
      }

      const fetchFresh = await taskService.fetchTasks();
      const updatedTasks = fetchFresh.data || currentUser.tasks.filter((_, idx) => idx !== foundIndex);
      const updatedUser: UserState = { ...currentUser, tasks: updatedTasks };

      return {
        message: `✓ Removed task #${foundIndex + 1}: "${removed.name}".`,
        outputType: 'success',
        updatedUser,
        activeView: 'tasks',
      };
    }

    return {
      message: `Missing task number.\n\nUsage:\n  remove -<task-number>\nExample:\n  remove -6`,
      outputType: 'error',
    };
  }

  // -------------------------------------------------------------
  // DONE COMMAND (done -<serial-number>, done -h -<serial-number>)
  // -------------------------------------------------------------
  if (baseCmd === 'done') {
    if (isHabitCmd) {
      const forwardTokens = ['habit', 'done', ...tokens.filter(t => t.toLowerCase() !== 'done' && t.toLowerCase() !== '-h')];
      return await executeCommand(forwardTokens.join(' '), currentUser, isAuthenticated, onSwitch);
    }

    const otherTokens = tokens.filter(t => t.toLowerCase() !== 'done');
    let serialIndex: number | null = null;
    for (const t of otherTokens) {
      const p = parseSerialNumberToken(t);
      if (p !== null) {
        serialIndex = p;
        break;
      }
    }

    if (serialIndex === null) {
      return {
        message: `Missing task number.\n\nUsage:\n  done -<task-number>\nExample:\n  done -6`,
        outputType: 'error',
      };
    }

    if (serialIndex < 1 || serialIndex > currentUser.tasks.length) {
      return {
        message: `Task #${serialIndex} does not exist.\n\nUse \`list\` to see your current task numbers.`,
        outputType: 'error',
      };
    }

    const task = currentUser.tasks[serialIndex - 1];

    // Idempotency: if already completed, do not overwrite completion timestamp
    if (task.status === 'done') {
      return {
        message: `Task #${serialIndex} is already completed.`,
        outputType: 'info',
        activeView: 'tasks',
      };
    }

    const completedAt = new Date().toISOString();
    // Persist to Supabase
    const res = await taskService.updateTask(task.id, { status: 'done', completedAt });
    if (res.error) {
      return {
        message: `ERROR: ${res.error}`,
        outputType: 'error',
        activeView: 'tasks',
      };
    }

    const fetchFresh = await taskService.fetchTasks();
    const updatedTasks = fetchFresh.data || currentUser.tasks.map((t, idx) => {
      if (idx === serialIndex! - 1) {
        return { ...t, status: 'done' as const, completedAt };
      }
      return t;
    });

    const updatedUser: UserState = { ...currentUser, tasks: updatedTasks };

    return {
      message: `✓ Marked task #${serialIndex} ("${task.name}") as completed!`,
      outputType: 'success',
      updatedUser,
      activeView: 'tasks',
    };
  }

  // -------------------------------------------------------------
  // UNDONE COMMAND (undone -<serial-number>, undone -h -<serial-number>)
  // -------------------------------------------------------------
  if (baseCmd === 'undone' || baseCmd === 'undo') {
    if (isHabitCmd) {
      const forwardTokens = ['habit', 'undone', ...tokens.filter(t => t.toLowerCase() !== baseCmd && t.toLowerCase() !== '-h')];
      return await executeCommand(forwardTokens.join(' '), currentUser, isAuthenticated, onSwitch);
    }

    const otherTokens = tokens.filter(t => t.toLowerCase() !== baseCmd);
    let serialIndex: number | null = null;
    for (const t of otherTokens) {
      const p = parseSerialNumberToken(t);
      if (p !== null) {
        serialIndex = p;
        break;
      }
    }

    if (serialIndex === null) {
      return {
        message: `Missing task number.\n\nUsage:\n  undone -<task-number>\nExample:\n  undone -1`,
        outputType: 'error',
      };
    }

    if (serialIndex < 1 || serialIndex > currentUser.tasks.length) {
      return {
        message: `Task #${serialIndex} does not exist.\n\nUse \`list\` to see your current task numbers.`,
        outputType: 'error',
      };
    }

    const task = currentUser.tasks[serialIndex - 1];

    // Persist to Supabase
    const res = await taskService.updateTask(task.id, { status: 'todo' });
    if (res.error) {
      return {
        message: `ERROR: ${res.error}`,
        outputType: 'error',
        activeView: 'tasks',
      };
    }

    const fetchFresh = await taskService.fetchTasks();
    const updatedTasks = fetchFresh.data || currentUser.tasks.map((t, idx) => {
      if (idx === serialIndex! - 1) {
        return { ...t, status: 'todo' as const, completedAt: undefined, cancelledAt: undefined };
      }
      return t;
    });

    const updatedUser: UserState = { ...currentUser, tasks: updatedTasks };

    return {
      message: `✓ Reopened task #${serialIndex}: "${task.name}" as [TODO].`,
      outputType: 'info',
      updatedUser,
      activeView: 'tasks',
    };
  }

  // -------------------------------------------------------------
  // CANCEL COMMAND (cancel -<serial-number>)
  // -------------------------------------------------------------
  if (baseCmd === 'cancel') {
    const otherTokens = tokens.filter(t => t.toLowerCase() !== 'cancel');
    let serialIndex: number | null = null;
    for (const t of otherTokens) {
      const p = parseSerialNumberToken(t);
      if (p !== null) {
        serialIndex = p;
        break;
      }
    }

    if (serialIndex === null) {
      return {
        message: `Missing task number.\n\nUsage:\n  cancel -<task-number>\nExample:\n  cancel -6`,
        outputType: 'error',
      };
    }

    if (serialIndex < 1 || serialIndex > currentUser.tasks.length) {
      return {
        message: `Task #${serialIndex} does not exist.\n\nUse \`list\` to see your current task numbers.`,
        outputType: 'error',
      };
    }

    const task = currentUser.tasks[serialIndex - 1];
    const cancelledAt = new Date().toISOString();

    // Persist to Supabase
    const res = await taskService.updateTask(task.id, { status: 'cancelled', cancelledAt });
    if (res.error) {
      return {
        message: `ERROR: ${res.error}`,
        outputType: 'error',
        activeView: 'tasks',
      };
    }

    const fetchFresh = await taskService.fetchTasks();
    const updatedTasks = fetchFresh.data || currentUser.tasks.map((t, idx) => {
      if (idx === serialIndex! - 1) {
        return { ...t, status: 'cancelled' as const, cancelledAt };
      }
      return t;
    });

    const updatedUser: UserState = { ...currentUser, tasks: updatedTasks };

    return {
      message: `✓ Cancelled task #${serialIndex} ("${task.name}").`,
      outputType: 'warning',
      updatedUser,
      activeView: 'tasks',
    };
  }

  // -------------------------------------------------------------
  // MOVE COMMANDS (move -6 tomorrow, move -6 today, move -6 YYYY-MM-DD, mv)
  // -------------------------------------------------------------
  if (baseCmd === 'move' || baseCmd === 'mv') {
    // Check if user entered reversed order: e.g. move tomorrow -1 or move 2026-09-10 -1
    const firstArg = tokens[1]?.toLowerCase();
    const secondArg = tokens[2];
    const secondSerial = secondArg ? parseSerialNumberToken(secondArg) : null;
    const firstSerial = firstArg ? parseSerialNumberToken(firstArg) : null;

    if (firstArg && (firstArg === 'tomorrow' || firstArg === 'today' || isDateLike(firstArg) || firstArg === '-tom' || firstArg === '-today') && secondSerial !== null) {
      return {
        message: `Missing task number or invalid order.\n\nUsage:\n  move -<task-number> tomorrow\n  move -<task-number> YYYY-MM-DD\nExample:\n  move -1 tomorrow`,
        outputType: 'error',
      };
    }

    // Canonical order: tokens[1] is -<serial-number>
    let serialIndex: number | null = firstSerial;
    let targetDateStr: string | null = null;
    let isTomorrow = false;
    let isToday = false;
    let invalidDateToken: string | null = null;

    if (serialIndex !== null) {
      const destTokens = tokens.slice(2);
      if (destTokens.length === 0) {
        return {
          message: `Missing destination date.\n\nUsage:\n  move -${serialIndex} tomorrow\n  move -${serialIndex} YYYY-MM-DD\n  move -${serialIndex} DD-MM-YYYY\nExample:\n  move -${serialIndex} tomorrow`,
          outputType: 'error',
        };
      }

      if (destTokens.length >= 3 && /^\d{1,2}$/.test(destTokens[0]) && MONTH_NAMES[destTokens[1].toLowerCase()] && /^\d{4}$/.test(destTokens[2])) {
        const candidate3 = `${destTokens[0]} ${destTokens[1]} ${destTokens[2]}`;
        const parsed3 = parseUserDate(`${destTokens[0]}-${destTokens[1]}-${destTokens[2]}`);
        if (parsed3) {
          targetDateStr = parsed3;
        } else {
          invalidDateToken = candidate3;
        }
      } else {
        const destToken = destTokens[0];
        const destLow = destToken.toLowerCase();
        if (destLow === 'tomorrow' || destLow === 'tom' || destLow === '-tom') {
          isTomorrow = true;
        } else if (destLow === 'today' || destLow === '-today') {
          isToday = true;
        } else if (isDateLike(destToken)) {
          const parsed = parseUserDate(destToken);
          if (parsed) {
            targetDateStr = parsed;
          } else {
            invalidDateToken = destToken;
          }
        } else {
          invalidDateToken = destToken;
        }
      }
    } else {
      // Check if backward compatibility alias: mv -tom -6 or mv YYYY-MM-DD -6
      for (const t of tokens.slice(1)) {
        const p = parseSerialNumberToken(t);
        if (p !== null) {
          serialIndex = p;
        } else if (t.toLowerCase() === '-tom' || t.toLowerCase() === 'tomorrow') {
          isTomorrow = true;
        } else if (t.toLowerCase() === '-today' || t.toLowerCase() === 'today') {
          isToday = true;
        } else if (isDateLike(t)) {
          const parsed = parseUserDate(t);
          if (parsed) {
            targetDateStr = parsed;
          } else {
            invalidDateToken = t;
          }
        }
      }
    }

    if (invalidDateToken) {
      return {
        message: getInvalidDateErrorMessage(invalidDateToken, 'move', serialIndex || 1),
        outputType: 'error',
      };
    }

    if (serialIndex === null) {
      return {
        message: `Missing task number.\n\nUsage:\n  move -<task-number> tomorrow\n  move -<task-number> YYYY-MM-DD\nExample:\n  move -6 tomorrow`,
        outputType: 'error',
      };
    }

    if (serialIndex < 1 || serialIndex > currentUser.tasks.length) {
      return {
        message: `Task #${serialIndex} does not exist.\n\nUse \`list\` to see your current task numbers.`,
        outputType: 'error',
      };
    }

    let effectiveDate: string | null = null;
    if (isTomorrow) effectiveDate = getTomorrowString();
    else if (isToday) effectiveDate = getTodayString();
    else effectiveDate = targetDateStr;

    if (!effectiveDate) {
      return {
        message: `Missing destination date.\n\nUsage:\n  move -${serialIndex} tomorrow\n  move -${serialIndex} YYYY-MM-DD\n  move -${serialIndex} DD-MM-YYYY\nExample:\n  move -${serialIndex} tomorrow`,
        outputType: 'error',
      };
    }

    const task = currentUser.tasks[serialIndex - 1];

    // Persist to Supabase
    const res = await taskService.updateTask(task.id, { scheduledDate: effectiveDate! });
    if (res.error) {
      return {
        message: `ERROR: ${res.error}`,
        outputType: 'error',
        activeView: 'tasks',
      };
    }

    const fetchFresh = await taskService.fetchTasks();
    const updatedTasks = fetchFresh.data || currentUser.tasks.map((t, idx) => {
      if (idx === serialIndex! - 1) {
        return { ...t, scheduledDate: effectiveDate! };
      }
      return t;
    });

    const updatedUser: UserState = { ...currentUser, tasks: updatedTasks };

    return {
      message: `✓ Moved task #${serialIndex} ("${task.name}") to ${formatDateDisplay(effectiveDate)}.`,
      outputType: 'success',
      updatedUser,
      activeView: 'tasks',
    };
  }

  // -------------------------------------------------------------
  // RENAME COMMANDS:
  // rename -<serial-number> "new task name"
  // (and backward-compatible: rename -r -<serial> / rename -h -<serial>)
  // -------------------------------------------------------------
  if (baseCmd === 'rename') {
    if (isHabitCmd) {
      const forwardTokens = ['habit', 'rename', ...tokens.filter(t => t.toLowerCase() !== 'rename' && t.toLowerCase() !== '-h')];
      return await executeCommand(forwardTokens.join(' '), currentUser, isAuthenticated, onSwitch);
    }

    const nonFlagTokens = tokens.slice(1).filter(t => t.toLowerCase() !== '-r');
    if (nonFlagTokens.length === 0) {
      return {
        message: `Missing task number.\n\nUsage:\n  rename -<task-number> "new name"\nExample:\n  rename -6 "Finish project"`,
        outputType: 'error',
      };
    }

    const firstToken = nonFlagTokens[0];
    const serialIndex = parseSerialNumberToken(firstToken);

    if (serialIndex === null) {
      return {
        message: `Missing task number.\n\nUsage:\n  rename -<task-number> "new name"\nExample:\n  rename -6 "Finish project"`,
        outputType: 'error',
      };
    }

    if (serialIndex < 1 || serialIndex > currentUser.tasks.length) {
      return {
        message: `Task #${serialIndex} does not exist.\n\nUse \`list\` to see your current task numbers.`,
        outputType: 'error',
      };
    }

    const newName = nonFlagTokens.slice(1).join(' ').trim();
    if (!newName) {
      return {
        message: `Missing new name.\n\nUsage:\n  rename -${serialIndex} "new name"\nExample:\n  rename -${serialIndex} "Finish project"`,
        outputType: 'error',
      };
    }

    const oldTask = currentUser.tasks[serialIndex - 1];

    // Persist to Supabase
    const updateRes = await taskService.updateTask(oldTask.id, { name: newName });
    if (updateRes.error) {
      return {
        message: `ERROR: ${updateRes.error}`,
        outputType: 'error',
        activeView: 'tasks',
      };
    }

    const fetchFresh = await taskService.fetchTasks();
    const updatedTasks = fetchFresh.data || currentUser.tasks.map((t, idx) => idx === serialIndex - 1 ? (updateRes.data || { ...t, name: newName }) : t);
    const updatedUser: UserState = { ...currentUser, tasks: updatedTasks };

    return {
      message: `✓ Renamed task #${serialIndex} from "${oldTask.name}" to "${newName}".`,
      outputType: 'success',
      updatedUser,
      activeView: 'tasks',
    };
  }

  // -------------------------------------------------------------
  // UNRECOGNIZED COMMAND (With helpful self-correction / suggestions)
  // -------------------------------------------------------------
  if (baseCmd === 'renam' || baseCmd === 'renmae') {
    return {
      message: `Did you mean: rename -6 "New name"?`,
      outputType: 'error',
    };
  }

  return {
    message: `ERROR: Unknown command '${rawInput}'.\nTIP: Type -help for available commands.`,
    outputType: 'error',
  };
}
