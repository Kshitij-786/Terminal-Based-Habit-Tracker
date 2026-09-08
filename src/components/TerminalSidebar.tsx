import React, { useState } from 'react';
import { UserState } from '../types';
import { getTodayString } from '../utils/storage';
import { Sparkles, Terminal, CheckCircle2, Flame, User, ArrowRight, Plus, RefreshCw } from 'lucide-react';

interface TerminalSidebarProps {
  currentUser: UserState;
  onExecuteCommand: (cmd: string) => void;
  onUserSwitch: (user: UserState) => void;
  onResetData: () => void;
}

export const TerminalSidebar: React.FC<TerminalSidebarProps> = ({
  currentUser,
  onExecuteCommand,
  onUserSwitch,
  onResetData,
}) => {
  const [showSwitchInput, setShowSwitchInput] = useState(false);
  const [newUserId, setNewUserId] = useState('');

  // Task completion calculation
  const totalTasks = currentUser.tasks.length;
  const doneTasks = currentUser.tasks.filter(t => t.status === 'done').length;
  const taskPct = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

  // Habit consistency calculation for today
  const today = getTodayString();
  const totalHabits = currentUser.habits.length;
  const doneHabitsToday = currentUser.habits.filter(h => !!h.history[today]).length;
  const habitPct = totalHabits > 0 ? Math.round((doneHabitsToday / totalHabits) * 100) : 0;

  // Best streak
  const bestOverallStreak = currentUser.habits.reduce((acc, h) => Math.max(acc, h.currentStreak), 0);

  const handleSwitchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserId.trim()) return;
    onExecuteCommand(`user "${newUserId.trim()}"`);
    setNewUserId('');
    setShowSwitchInput(false);
  };

  return (
    <aside className="w-full lg:w-72 p-5 bg-[#0F1014] border-r border-[#2A2B2F] flex flex-col gap-6 select-none overflow-y-auto shrink-0 font-mono text-[#E0E0E0]">
      {/* 1. Graphical Progress Section */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[10px] text-[#6A6B6F] uppercase tracking-[0.2em] font-bold">
            Progress Overview
          </h2>
          <button
            onClick={() => onExecuteCommand('habit graph')}
            className="text-[10px] text-amber-400 hover:underline"
            title="Run habit graph in terminal"
          >
            habit graph
          </button>
        </div>

        <div className="space-y-3.5">
          {/* Task Completion Bar */}
          <div className="p-2.5 bg-[#16171D] border border-[#2A2B2F] rounded">
            <div className="flex justify-between text-[11px] mb-1.5">
              <span className="text-[#A0A0A0]">Task Completion</span>
              <span className="text-[#4ADE80] font-bold">{taskPct}%</span>
            </div>
            <div className="h-1.5 bg-[#1A1B1F] w-full rounded overflow-hidden">
              <div
                className="h-full bg-[#4ADE80] transition-all duration-300"
                style={{ width: `${taskPct}%` }}
              />
            </div>
            <div className="flex justify-between text-[9px] text-[#6A6B6F] mt-1.5">
              <span>{doneTasks} of {totalTasks} done</span>
              <span>{totalTasks - doneTasks} remaining</span>
            </div>
          </div>

          {/* Habit Consistency Bar */}
          <div className="p-2.5 bg-[#16171D] border border-[#2A2B2F] rounded">
            <div className="flex justify-between text-[11px] mb-1.5">
              <span className="text-[#A0A0A0]">Habit Consistency</span>
              <span className="text-amber-400 font-bold">{habitPct}%</span>
            </div>
            <div className="h-1.5 bg-[#1A1B1F] w-full rounded overflow-hidden">
              <div
                className="h-full bg-amber-400 transition-all duration-300"
                style={{ width: `${habitPct}%` }}
              />
            </div>
            <div className="flex justify-between text-[9px] text-[#6A6B6F] mt-1.5">
              <span>{doneHabitsToday}/{totalHabits} today</span>
              <span className="text-pink-400 flex items-center gap-0.5">
                <Flame className="w-2.5 h-2.5" /> Best: {bestOverallStreak}d
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Quick Command Triggers */}
      <div>
        <h2 className="text-[10px] text-[#6A6B6F] uppercase tracking-[0.2em] mb-2.5 font-bold">
          Quick Commands (Click to Run)
        </h2>
        <div className="text-[11px] space-y-1.5">
          {[
            { cmd: '-help', desc: 'show manual & commands' },
            { cmd: '-cmd', desc: 'syntax cheatsheet' },
            { cmd: 'list', desc: 'display task list' },
            { cmd: 'date', desc: 'current date & time' },
            { cmd: 'time', desc: 'current local & UTC time' },
            { cmd: 'cal', desc: 'month calendar' },
            { cmd: 'habit list', desc: 'display habits list' },
            { cmd: 'habit graph', desc: 'habit consistency graph' },
            { cmd: 'habit streak -1', desc: 'habit activity card' },
            { cmd: 'clear', desc: 'clear terminal screen' },
          ].map((item) => (
            <button
              key={item.cmd}
              onClick={() => onExecuteCommand(item.cmd)}
              className="w-full flex items-center justify-between p-1.5 rounded hover:bg-[#16171D] border border-transparent hover:border-[#2A2B2F] text-left transition-colors group cursor-pointer"
            >
              <span className="text-[#4ADE80] font-mono group-hover:underline">
                {item.cmd}
              </span>
              <span className="text-[10px] text-[#6A6B6F]">{item.desc}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 3. Live Dynamic Serials Index */}
      <div className="flex-1 flex flex-col min-h-0">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-[10px] text-[#6A6B6F] uppercase tracking-[0.2em] font-bold">
            Active Serials
          </h2>
          <span className="text-[9px] text-[#6A6B6F]">Dynamic Index</span>
        </div>

        <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 max-h-48 text-[11px]">
          {currentUser.tasks.length === 0 && currentUser.habits.length === 0 ? (
            <div className="text-[10px] text-[#6A6B6F] italic py-2">
              No active items. Use <span className="text-[#4ADE80]">add "name"</span>
            </div>
          ) : (
            <>
              {/* Tasks List with Serials */}
              {currentUser.tasks.map((task, idx) => {
                const serial = idx + 1;
                const isDone = task.status === 'done';
                return (
                  <div
                    key={task.id}
                    className="flex items-center justify-between p-1.5 bg-[#16171D] border border-[#2A2B2F] rounded text-left group"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span className="text-[#60A5FA] font-bold shrink-0">[{serial}]</span>
                      <span
                        className={`truncate text-[11px] ${
                          isDone ? 'line-through text-[#6A6B6F]' : 'text-[#E0E0E0]'
                        }`}
                        title={task.name}
                      >
                        {task.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 shrink-0">
                      <button
                        onClick={() => onExecuteCommand(`done -${serial}`)}
                        className={`px-1 py-0.5 rounded text-[9px] border transition-colors ${
                          isDone
                            ? 'bg-[#1A2E1A] text-[#4ADE80] border-[#4ADE80]/30'
                            : 'bg-[#1E2028] text-[#A0A0A0] hover:text-[#4ADE80] border-[#2A2B2F]'
                        }`}
                        title={isDone ? `Unmark (undone -${serial})` : `Complete (done -${serial})`}
                      >
                        {isDone ? 'DONE' : 'DO'}
                      </button>
                    </div>
                  </div>
                );
              })}

              {/* Habits List with Serials */}
              {currentUser.habits.map((habit, idx) => {
                const serial = idx + 1;
                const isDoneToday = !!habit.history[today];
                return (
                  <div
                    key={habit.id}
                    className="flex items-center justify-between p-1.5 bg-[#16171D] border border-[#2A2B2F] rounded text-left group"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span className="text-[#F472B6] font-bold shrink-0">[H{serial}]</span>
                      <span className="truncate text-[11px] text-[#E0E0E0]" title={habit.name}>
                        {habit.name}
                      </span>
                    </div>
                    <button
                      onClick={() => onExecuteCommand(`habit done -${serial}`)}
                      className={`px-1 py-0.5 rounded text-[9px] border transition-colors shrink-0 ${
                        isDoneToday
                          ? 'bg-[#1A2E1A] text-[#4ADE80] border-[#4ADE80]/30'
                          : 'bg-[#1E2028] text-pink-300 hover:text-pink-100 border-[#2A2B2F]'
                      }`}
                      title={`Mark habit done (habit done -${serial})`}
                    >
                      {isDoneToday ? 'DONE' : 'CHECK'}
                    </button>
                  </div>
                );
              })}
            </>
          )}
        </div>
      </div>

      {/* 4. Current User Profile Box */}
      <div className="mt-auto p-3.5 border border-[#2A2B2F] rounded bg-[#16171D]">
        <div className="flex items-center justify-between mb-2">
          <div className="text-[10px] text-[#6A6B6F] uppercase tracking-widest font-bold">
            Current User
          </div>
          <button
            onClick={() => setShowSwitchInput(!showSwitchInput)}
            className="text-[10px] text-[#4ADE80] hover:underline"
          >
            {showSwitchInput ? 'Cancel' : 'Switch'}
          </button>
        </div>

        {showSwitchInput ? (
          <form onSubmit={handleSwitchSubmit} className="space-y-2 mt-2">
            <input
              type="text"
              value={newUserId}
              onChange={(e) => setNewUserId(e.target.value)}
              placeholder="user_id (e.g. dev_admin)"
              className="w-full px-2 py-1 bg-[#0F1014] border border-[#2A2B2F] rounded text-xs text-[#E0E0E0] placeholder:text-[#6A6B6F] focus:outline-none focus:border-[#4ADE80]"
              autoFocus
            />
            <div className="flex gap-1">
              <button
                type="submit"
                className="flex-1 py-1 bg-[#4ADE80] text-black font-bold text-[10px] rounded hover:bg-emerald-400"
              >
                Log In / Switch
              </button>
            </div>
          </form>
        ) : (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-emerald-500 to-blue-600 flex items-center justify-center text-black font-bold text-xs">
                {currentUser.userId.slice(0, 2).toUpperCase()}
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-bold text-[#E0E0E0]">{currentUser.userId}</span>
                <span className="text-[9px] text-[#4ADE80] flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#4ADE80] animate-pulse"></span>
                  Active Session
                </span>
              </div>
            </div>
            <button
              onClick={onResetData}
              className="p-1.5 text-[#6A6B6F] hover:text-[#E0E0E0] hover:bg-[#20222A] rounded border border-transparent hover:border-[#2A2B2F]"
              title="Reset to default sample data"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </aside>
  );
};
