import React, { useState } from 'react';
import { UserState, Task, Habit } from '../types';
import { getTodayString, getTomorrowString, formatDateDisplay, getLastNDays } from '../utils/date';
import {
  CheckCircle2,
  Circle,
  Calendar,
  Flame,
  Plus,
  Trash2,
  XCircle,
  Clock,
  TrendingUp,
  BarChart3,
  CalendarCheck2,
  Sparkles,
  ArrowRight,
  ListTodo,
  Activity,
  Edit2
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface GraphicalDashboardProps {
  currentUser: UserState;
  onExecuteCommand: (cmd: string) => void;
  activeSubView?: 'tasks' | 'habits' | 'task_stats' | 'habit_stats' | 'help' | 'cmd';
}

export const GraphicalDashboard: React.FC<GraphicalDashboardProps> = ({
  currentUser,
  onExecuteCommand,
  activeSubView = 'tasks',
}) => {
  const [tab, setTab] = useState<'tasks' | 'habits' | 'analytics'>('tasks');
  const [taskInput, setTaskInput] = useState('');
  const [habitInput, setHabitInput] = useState('');
  const [editingTaskSerial, setEditingTaskSerial] = useState<number | null>(null);
  const [editingTaskText, setEditingTaskText] = useState('');
  const [editingHabitSerial, setEditingHabitSerial] = useState<number | null>(null);
  const [editingHabitText, setEditingHabitText] = useState('');

  // Sync tab with external activeSubView
  React.useEffect(() => {
    if (activeSubView === 'tasks') setTab('tasks');
    if (activeSubView === 'habits') setTab('habits');
    if (activeSubView === 'task_stats' || activeSubView === 'habit_stats') setTab('analytics');
  }, [activeSubView]);

  const today = getTodayString();
  const past7Days = getLastNDays(7);

  // Statistics
  const totalTasks = currentUser.tasks.length;
  const doneTasks = currentUser.tasks.filter((t) => t.status === 'done').length;
  const pendingTasks = currentUser.tasks.filter((t) => t.status === 'todo').length;
  const cancelledTasks = currentUser.tasks.filter((t) => t.status === 'cancelled').length;
  const completionRate = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

  const totalHabits = currentUser.habits.length;
  const habitsDoneToday = currentUser.habits.filter((h) => !!h.history[today]).length;
  const habitRateToday = totalHabits > 0 ? Math.round((habitsDoneToday / totalHabits) * 100) : 0;

  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskInput.trim()) return;
    onExecuteCommand(`add "${taskInput.trim()}"`);
    setTaskInput('');
  };

  const handleCreateHabit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!habitInput.trim()) return;
    onExecuteCommand(`habit add "${habitInput.trim()}"`);
    setHabitInput('');
  };

  const triggerCelebration = () => {
    try {
      confetti({
        particleCount: 45,
        spread: 60,
        origin: { y: 0.8 },
      });
    } catch {
      // safe fallback
    }
  };

  return (
    <div className="flex flex-col h-full bg-zinc-950/60 border border-zinc-800 rounded-xl overflow-hidden shadow-2xl backdrop-blur-sm">
      {/* Dashboard Tab Navigation Bar */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-zinc-900/90 border-b border-zinc-800">
        <div className="flex items-center gap-1.5">
          <button
            id="tab-tasks-btn"
            onClick={() => setTab('tasks')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              tab === 'tasks'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
            }`}
          >
            <ListTodo className="w-3.5 h-3.5" />
            <span>Tasks ({currentUser.tasks.length})</span>
          </button>

          <button
            id="tab-habits-btn"
            onClick={() => setTab('habits')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              tab === 'habits'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
            }`}
          >
            <Flame className="w-3.5 h-3.5" />
            <span>Habits ({currentUser.habits.length})</span>
          </button>

          <button
            id="tab-analytics-btn"
            onClick={() => setTab('analytics')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              tab === 'analytics'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Analytics & Stats</span>
          </button>
        </div>

        <div className="text-[11px] font-mono text-zinc-500 hidden sm:flex items-center gap-1.5">
          <Sparkles className="w-3 h-3 text-emerald-400" />
          <span>Dynamic Serials Synchronized</span>
        </div>
      </div>

      {/* Main Tab Content */}
      <div className="flex-1 p-4 overflow-y-auto space-y-4">
        {/* ======================= TASKS TAB ======================= */}
        {tab === 'tasks' && (
          <div className="space-y-4">
            {/* Quick Add Task Input (Translates to CLI `add "name"`) */}
            <form onSubmit={handleCreateTask} className="flex gap-2">
              <div className="relative flex-1">
                <input
                  id="add-task-input"
                  type="text"
                  value={taskInput}
                  onChange={(e) => setTaskInput(e.target.value)}
                  placeholder="New task title... (Runs: add &quot;task name&quot;)"
                  className="w-full pl-3 pr-24 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-emerald-500/60 font-mono"
                />
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-mono text-zinc-500 bg-zinc-800/80 px-1.5 py-0.5 rounded border border-zinc-700">
                  add "..."
                </span>
              </div>
              <button
                id="add-task-submit-btn"
                type="submit"
                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Task</span>
              </button>
            </form>

            {/* Task Summary Metrics Bar */}
            <div className="grid grid-cols-3 gap-2 text-center font-mono">
              <div className="p-2 bg-zinc-900/60 border border-zinc-800 rounded-lg">
                <div className="text-[10px] text-zinc-500 uppercase">Pending</div>
                <div className="text-sm font-semibold text-amber-400">{pendingTasks}</div>
              </div>
              <div className="p-2 bg-zinc-900/60 border border-zinc-800 rounded-lg">
                <div className="text-[10px] text-zinc-500 uppercase">Done</div>
                <div className="text-sm font-semibold text-emerald-400">{doneTasks}</div>
              </div>
              <div className="p-2 bg-zinc-900/60 border border-zinc-800 rounded-lg">
                <div className="text-[10px] text-zinc-500 uppercase">Progress</div>
                <div className="text-sm font-semibold text-cyan-400">{completionRate}%</div>
              </div>
            </div>

            {/* Task List Items with dynamic serial badge */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[11px] font-mono text-zinc-500 px-1">
                <span>Active Task Queue</span>
                <span>Command Equivalent</span>
              </div>

              {currentUser.tasks.length === 0 ? (
                <div className="p-8 text-center border border-dashed border-zinc-800 rounded-xl text-zinc-500 font-mono text-xs">
                  No tasks scheduled. Run <code className="text-emerald-400">add "my task"</code> in terminal to start.
                </div>
              ) : (
                currentUser.tasks.map((task, idx) => {
                  const serial = idx + 1;
                  const isDone = task.status === 'done';
                  const isCancelled = task.status === 'cancelled';

                  return (
                    <div
                      key={task.id}
                      className={`group flex items-center justify-between p-3 rounded-lg border transition-all ${
                        isDone
                          ? 'bg-zinc-900/30 border-emerald-950/40 text-zinc-400'
                          : isCancelled
                          ? 'bg-zinc-900/20 border-rose-950/40 text-zinc-500 line-through'
                          : 'bg-zinc-900/70 border-zinc-800/80 hover:border-zinc-700 text-zinc-200'
                      }`}
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0 mr-3">
                        {/* Dynamic Serial Number Badge */}
                        <div
                          className={`w-7 h-7 flex-shrink-0 rounded-md font-mono text-xs font-bold flex items-center justify-center border shadow-xs ${
                            isDone
                              ? 'bg-emerald-950/60 text-emerald-400 border-emerald-800/60'
                              : isCancelled
                              ? 'bg-rose-950/40 text-rose-400 border-rose-900/40'
                              : 'bg-zinc-800 text-emerald-300 border-zinc-700'
                          }`}
                          title={`Serial number #${serial}. Use with done -${serial}, remove -${serial}, move -${serial} tomorrow`}
                        >
                          #{serial}
                        </div>

                        {/* Status Checkbox Button (triggers `done -<serial>`) */}
                        <button
                          type="button"
                          onClick={() => {
                            if (!isDone) {
                              triggerCelebration();
                              onExecuteCommand(`done -${serial}`);
                            }
                          }}
                          className="flex-shrink-0 text-zinc-400 hover:text-emerald-400 transition-colors"
                          title={`Execute: done -${serial}`}
                        >
                          {isDone ? (
                            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                          ) : isCancelled ? (
                            <XCircle className="w-5 h-5 text-rose-500/70" />
                          ) : (
                            <Circle className="w-5 h-5 hover:scale-110 transition-transform" />
                          )}
                        </button>

                        {/* Title & Scheduled Date */}
                        <div className="flex-1 min-w-0">
                          {editingTaskSerial === serial ? (
                            <div className="flex items-center gap-1">
                              <input
                                type="text"
                                value={editingTaskText}
                                onChange={(e) => setEditingTaskText(e.target.value)}
                                className="bg-zinc-800 text-xs px-2 py-0.5 rounded border border-emerald-500 outline-none text-zinc-100 font-mono"
                                autoFocus
                              />
                              <button
                                onClick={() => {
                                  if (editingTaskText.trim()) {
                                    onExecuteCommand(`rename -${serial} "${editingTaskText.trim()}"`);
                                  }
                                  setEditingTaskSerial(null);
                                }}
                                className="text-[10px] bg-emerald-700 text-white px-1.5 py-0.5 rounded"
                              >
                                Save
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-baseline gap-2">
                              <span className={`text-xs font-medium truncate ${isDone ? 'line-through text-zinc-400' : ''}`}>
                                {task.name}
                              </span>
                            </div>
                          )}

                          <div className="flex items-center gap-2 mt-0.5 text-[10px] font-mono text-zinc-500">
                            <span className="flex items-center gap-1 text-zinc-400">
                              <Calendar className="w-2.5 h-2.5 text-zinc-500" />
                              {formatDateDisplay(task.scheduledDate)}
                            </span>
                            {isDone && <span className="text-emerald-500 font-semibold">• completed</span>}
                            {isCancelled && <span className="text-rose-400">• cancelled</span>}
                          </div>
                        </div>
                      </div>

                      {/* Quick Interactive Actions */}
                      <div className="flex items-center gap-1 font-mono text-[10px]">
                        {/* Move to tomorrow (move -<serial> tomorrow) */}
                        {!isDone && !isCancelled && (
                          <button
                            type="button"
                            onClick={() => onExecuteCommand(`move -${serial} tomorrow`)}
                            className="px-2 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded border border-zinc-700/60 transition-colors flex items-center gap-1"
                            title={`Execute: move -${serial} tomorrow`}
                          >
                            <Clock className="w-2.5 h-2.5 text-cyan-400" />
                            <span className="hidden sm:inline">move -{serial} tomorrow</span>
                            <span className="sm:hidden">+1d</span>
                          </button>
                        )}

                        {/* Rename */}
                        <button
                          type="button"
                          onClick={() => {
                            setEditingTaskSerial(serial);
                            setEditingTaskText(task.name);
                          }}
                          className="p-1 hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 rounded transition-colors"
                          title={`Rename task #${serial}`}
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>

                        {/* Cancel task (cancel -<serial>) */}
                        {!isDone && !isCancelled && (
                          <button
                            type="button"
                            onClick={() => onExecuteCommand(`cancel -${serial}`)}
                            className="p-1 hover:bg-rose-950/40 text-zinc-500 hover:text-rose-400 rounded transition-colors"
                            title={`Execute: cancel -${serial}`}
                          >
                            <XCircle className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {/* Remove task (remove -<serial>) */}
                        <button
                          type="button"
                          onClick={() => onExecuteCommand(`remove -${serial}`)}
                          className="p-1 hover:bg-rose-950/40 text-zinc-500 hover:text-rose-400 rounded transition-colors"
                          title={`Execute: remove -${serial}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* ======================= HABITS TAB ======================= */}
        {tab === 'habits' && (
          <div className="space-y-4">
            {/* Quick Add Habit Input (Translates to CLI `habit add "name"`) */}
            <form onSubmit={handleCreateHabit} className="flex gap-2">
              <div className="relative flex-1">
                <input
                  id="add-habit-input"
                  type="text"
                  value={habitInput}
                  onChange={(e) => setHabitInput(e.target.value)}
                  placeholder="New daily habit... (Runs: habit add &quot;habit name&quot;)"
                  className="w-full pl-3 pr-24 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-amber-500/60 font-mono"
                />
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-mono text-zinc-500 bg-zinc-800/80 px-1.5 py-0.5 rounded border border-zinc-700">
                  habit add "..."
                </span>
              </div>
              <button
                id="add-habit-submit-btn"
                type="submit"
                className="px-3.5 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Habit</span>
              </button>
            </form>

            {/* Habit Today Check-in Overview */}
            <div className="p-3 bg-amber-950/20 border border-amber-900/40 rounded-xl flex items-center justify-between">
              <div>
                <div className="text-xs font-medium text-amber-200">Daily Habit Consistency</div>
                <div className="text-[11px] text-zinc-400 font-mono mt-0.5">
                  {habitsDoneToday} of {totalHabits} completed today ({habitRateToday}%)
                </div>
              </div>
              <div className="flex items-center gap-1 text-amber-400 font-mono text-xs font-bold bg-amber-950/60 px-2.5 py-1 rounded-lg border border-amber-800/50">
                <Flame className="w-3.5 h-3.5" />
                <span>{habitRateToday}% Today</span>
              </div>
            </div>

            {/* Habit Cards */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between text-[11px] font-mono text-zinc-500 px-1">
                <span>Habits & 7-Day Matrix</span>
                <span>Today's Check-in</span>
              </div>

              {currentUser.habits.length === 0 ? (
                <div className="p-8 text-center border border-dashed border-zinc-800 rounded-xl text-zinc-500 font-mono text-xs">
                  No habits yet. Run <code className="text-amber-400">habit add "habit name"</code> in terminal.
                </div>
              ) : (
                currentUser.habits.map((habit, idx) => {
                  const serial = idx + 1;
                  const isDoneToday = !!habit.history[today];

                  return (
                    <div
                      key={habit.id}
                      className="p-3.5 rounded-xl bg-zinc-900/70 border border-zinc-800/80 hover:border-zinc-700 transition-all space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {/* Habit Serial Badge */}
                          <div
                            className="w-7 h-7 rounded-md bg-amber-950/50 text-amber-400 border border-amber-800/60 font-mono text-xs font-bold flex items-center justify-center shadow-xs"
                            title={`Habit serial #${serial}. Run: habit done -${serial} or habit remove -${serial}`}
                          >
                            #{serial}
                          </div>

                          <div>
                            {editingHabitSerial === serial ? (
                              <div className="flex items-center gap-1">
                                <input
                                  type="text"
                                  value={editingHabitText}
                                  onChange={(e) => setEditingHabitText(e.target.value)}
                                  className="bg-zinc-800 text-xs px-2 py-0.5 rounded border border-amber-500 outline-none text-zinc-100 font-mono"
                                  autoFocus
                                />
                                <button
                                  onClick={() => {
                                    if (editingHabitText.trim()) {
                                      onExecuteCommand(`habit rename -${serial} "${editingHabitText.trim()}"`);
                                    }
                                    setEditingHabitSerial(null);
                                  }}
                                  className="text-[10px] bg-amber-700 text-white px-1.5 py-0.5 rounded"
                                >
                                  Save
                                </button>
                              </div>
                            ) : (
                              <div className="text-xs font-semibold text-zinc-200">{habit.name}</div>
                            )}

                            <div className="flex items-center gap-2 mt-0.5 text-[10px] font-mono text-zinc-400">
                              <span className="text-amber-400 flex items-center gap-0.5 font-bold">
                                <Flame className="w-2.5 h-2.5" /> {habit.currentStreak}d streak
                              </span>
                              <span>• Best: {habit.bestStreak}d</span>
                            </div>
                          </div>
                        </div>

                        {/* Check-in button (triggers `habit done -<serial>`) */}
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              if (!isDoneToday) triggerCelebration();
                              onExecuteCommand(`habit done -${serial}`);
                            }}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-all ${
                              isDoneToday
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                : 'bg-zinc-800 hover:bg-amber-600 hover:text-white text-zinc-300 border border-zinc-700'
                            }`}
                            title={`Execute: habit done -${serial}`}
                          >
                            <CheckCircle2 className={`w-3.5 h-3.5 ${isDoneToday ? 'text-emerald-400' : ''}`} />
                            <span>{isDoneToday ? 'Done Today' : `habit done -${serial}`}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setEditingHabitSerial(serial);
                              setEditingHabitText(habit.name);
                            }}
                            className="p-1 hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 rounded transition-colors"
                            title={`Rename habit #${serial}`}
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>

                          <button
                            type="button"
                            onClick={() => onExecuteCommand(`habit remove -${serial}`)}
                            className="p-1 hover:bg-rose-950/40 text-zinc-500 hover:text-rose-400 rounded transition-colors"
                            title={`Execute: habit remove -${serial}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* 7-Day History Punch Card */}
                      <div className="pt-2 border-t border-zinc-800/60 flex items-center justify-between">
                        <span className="text-[10px] font-mono text-zinc-500">Past 7 days:</span>
                        <div className="flex items-center gap-1.5">
                          {past7Days.map((dStr) => {
                            const completed = !!habit.history[dStr];
                            const isTodayDate = dStr === today;
                            const dayName = new Date(dStr).toLocaleDateString('en-US', { weekday: 'narrow' });

                            return (
                              <div
                                key={dStr}
                                className="flex flex-col items-center gap-0.5"
                                title={`${dStr}: ${completed ? 'Completed' : 'Missed'}`}
                              >
                                <span className={`text-[9px] font-mono ${isTodayDate ? 'text-amber-400 font-bold' : 'text-zinc-500'}`}>
                                  {dayName}
                                </span>
                                <div
                                  className={`w-4 h-4 rounded-sm flex items-center justify-center text-[9px] font-mono border ${
                                    completed
                                      ? 'bg-emerald-500/80 text-zinc-950 border-emerald-400'
                                      : 'bg-zinc-800/80 text-zinc-600 border-zinc-700/60'
                                  }`}
                                >
                                  {completed ? '✓' : ''}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* ======================= ANALYTICS TAB ======================= */}
        {tab === 'analytics' && (
          <div className="space-y-4">
            {/* Task Analytics Card */}
            <div className="p-4 bg-zinc-900/80 border border-zinc-800 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-bold text-zinc-200">Task Analytics</span>
                </div>
                <button
                  type="button"
                  onClick={() => onExecuteCommand('list')}
                  className="px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-emerald-300 font-mono text-[10px] border border-zinc-700"
                >
                  list in CLI
                </button>
              </div>

              {/* Progress Bar Visual */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-zinc-400">Completion Ratio</span>
                  <span className="text-emerald-400 font-bold">{completionRate}%</span>
                </div>
                <div className="h-2.5 w-full bg-zinc-800 rounded-full overflow-hidden flex">
                  <div
                    className="h-full bg-emerald-500 transition-all duration-500"
                    style={{ width: `${(doneTasks / (totalTasks || 1)) * 100}%` }}
                  />
                  <div
                    className="h-full bg-amber-500 transition-all duration-500"
                    style={{ width: `${(pendingTasks / (totalTasks || 1)) * 100}%` }}
                  />
                  <div
                    className="h-full bg-rose-500 transition-all duration-500"
                    style={{ width: `${(cancelledTasks / (totalTasks || 1)) * 100}%` }}
                  />
                </div>
              </div>

              {/* Breakdown Grid */}
              <div className="grid grid-cols-4 gap-2 text-center text-[11px] font-mono pt-1">
                <div className="p-2 bg-zinc-950/60 rounded border border-zinc-800/80">
                  <div className="text-zinc-500">Total</div>
                  <div className="font-bold text-zinc-200 mt-0.5">{totalTasks}</div>
                </div>
                <div className="p-2 bg-zinc-950/60 rounded border border-zinc-800/80">
                  <div className="text-emerald-500">Done</div>
                  <div className="font-bold text-emerald-400 mt-0.5">{doneTasks}</div>
                </div>
                <div className="p-2 bg-zinc-950/60 rounded border border-zinc-800/80">
                  <div className="text-amber-500">Pending</div>
                  <div className="font-bold text-amber-400 mt-0.5">{pendingTasks}</div>
                </div>
                <div className="p-2 bg-zinc-950/60 rounded border border-zinc-800/80">
                  <div className="text-rose-500">Cancelled</div>
                  <div className="font-bold text-rose-400 mt-0.5">{cancelledTasks}</div>
                </div>
              </div>
            </div>

            {/* Habit Streaks & Consistency Card */}
            <div className="p-4 bg-zinc-900/80 border border-zinc-800 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Flame className="w-4 h-4 text-amber-400" />
                  <span className="text-xs font-bold text-zinc-200">Habit Streaks & Progress (habit graph)</span>
                </div>
                <button
                  type="button"
                  onClick={() => onExecuteCommand('habit graph')}
                  className="px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-amber-300 font-mono text-[10px] border border-zinc-700"
                >
                  habit graph in CLI
                </button>
              </div>

              <div className="space-y-2">
                {currentUser.habits.map((habit, idx) => {
                  const maxStreak = Math.max(10, habit.bestStreak);
                  const streakPct = Math.min(100, Math.round((habit.currentStreak / maxStreak) * 100));

                  return (
                    <div key={habit.id} className="p-2.5 bg-zinc-950/60 rounded-lg border border-zinc-800 space-y-1.5">
                      <div className="flex items-center justify-between text-xs font-mono">
                        <span className="text-zinc-200 font-medium">
                          [{idx + 1}] {habit.name}
                        </span>
                        <span className="text-amber-400 font-bold flex items-center gap-1">
                          <Flame className="w-3 h-3" /> {habit.currentStreak} days
                        </span>
                      </div>
                      <div className="h-2 w-full bg-zinc-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-amber-500 to-emerald-400 transition-all duration-500"
                          style={{ width: `${streakPct}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-[10px] font-mono text-zinc-500">
                        <span>Check-ins: {Object.values(habit.history).filter(Boolean).length}</span>
                        <span>Best streak: {habit.bestStreak}d</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
