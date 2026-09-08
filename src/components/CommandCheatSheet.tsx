import React, { useState } from 'react';
import { HelpCircle, Terminal, Copy, Check, Info, Sparkles, BookOpen } from 'lucide-react';

interface CommandCheatSheetProps {
  onSelectCommand: (cmd: string) => void;
  onExecuteCommand: (cmd: string) => void;
}

interface CommandGroup {
  category: string;
  badgeColor: string;
  items: {
    cmd: string;
    desc: string;
    example?: string;
  }[];
}

const COMMAND_GROUPS: CommandGroup[] = [
  {
    category: 'Tasks',
    badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    items: [
      { cmd: 'add "Task name"', desc: 'Add a new task for today', example: 'add "Design UI"' },
      { cmd: 'list', desc: 'Display all tasks with item numbers [1], [2]...', example: 'list' },
      { cmd: 'list today', desc: 'Display tasks scheduled for today', example: 'list today' },
      { cmd: 'list tomorrow', desc: 'Display tasks scheduled for tomorrow', example: 'list tomorrow' },
      { cmd: 'done -6', desc: 'Mark task as completed', example: 'done -6' },
      { cmd: 'cancel -6', desc: 'Mark task as cancelled', example: 'cancel -6' },
      { cmd: 'remove -6', desc: 'Remove task by item number', example: 'remove -6' },
      { cmd: 'rename -6 "New name"', desc: 'Rename task by item number', example: 'rename -6 "Build App"' },
      { cmd: 'move -6 tomorrow', desc: 'Move task to tomorrow', example: 'move -6 tomorrow' },
      { cmd: 'move -6 YYYY-MM-DD', desc: 'Move task to specified date', example: 'move -6 2026-09-15' },
    ],
  },
  {
    category: 'Habits',
    badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    items: [
      { cmd: 'habit add "Habit"', desc: 'Add a daily recurring habit (max 10)', example: 'habit add "Morning Run"' },
      { cmd: 'habit list', desc: 'Display habit list with today\'s completion', example: 'habit list' },
      { cmd: 'habit done -3', desc: 'Check in habit for today', example: 'habit done -3' },
      { cmd: 'habit streak -3', desc: 'Display habit streak & 4-week card', example: 'habit streak -3' },
      { cmd: 'habit graph', desc: 'Display habit consistency graph', example: 'habit graph' },
      { cmd: 'habit rename -3 "New name"', desc: 'Rename habit by item number', example: 'habit rename -3 "Morning Walk"' },
      { cmd: 'habit remove -3', desc: 'Remove habit by item number', example: 'habit remove -3' },
    ],
  },
  {
    category: 'User Management',
    badgeColor: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
    items: [
      { cmd: 'create user', desc: 'Create and register a new user profile', example: 'create user' },
      { cmd: 'login', desc: 'Sign in to an existing account', example: 'login' },
      { cmd: 'user', desc: 'Show profile stats and completion rates', example: 'user' },
      { cmd: 'logout', desc: 'Log out of current user session', example: 'logout' },
    ],
  },
  {
    category: 'Date & Time',
    badgeColor: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
    items: [
      { cmd: 'date', desc: 'Show current local date, time, and timezone', example: 'date' },
      { cmd: 'time', desc: 'Show current local, 24-hour, and UTC time', example: 'time' },
      { cmd: 'cal', desc: 'Display current month calendar', example: 'cal' },
      { cmd: 'cal YYYY-MM', desc: 'Display calendar for specific month', example: 'cal 2026-09' },
    ],
  },
  {
    category: 'System',
    badgeColor: 'bg-zinc-700/40 text-zinc-300 border-zinc-600/40',
    items: [
      { cmd: 'db', desc: 'Display Supabase PostgreSQL & RLS connection status', example: 'db' },
      { cmd: '-help', desc: 'Show quick help overview and tips', example: '-help' },
      { cmd: '-cmd', desc: 'Display complete command reference manual', example: '-cmd' },
      { cmd: 'clear', desc: 'Clear the terminal output history', example: 'clear' },
    ],
  },
];

export const CommandCheatSheet: React.FC<CommandCheatSheetProps> = ({
  onSelectCommand,
  onExecuteCommand,
}) => {
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);

  const handleCopy = (text: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopiedCmd(text);
    setTimeout(() => setCopiedCmd(null), 1500);
  };

  return (
    <div className="flex flex-col h-full bg-zinc-950/90 border border-zinc-800 rounded-xl overflow-hidden shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-zinc-900/90 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-emerald-400" />
          <span className="text-xs font-semibold text-zinc-200">Command Syntax Reference</span>
        </div>
        <span className="text-[10px] font-mono text-zinc-500">Click to run or copy</span>
      </div>

      {/* Syntax Callout */}
      <div className="p-3 bg-emerald-950/20 border-b border-emerald-900/30 text-xs font-mono text-emerald-300 flex items-start gap-2">
        <Sparkles className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
        <div>
          <span className="font-bold text-emerald-200">Dynamic Serial Numbers:</span> Any command with{' '}
          <code className="bg-zinc-900 px-1 py-0.5 rounded text-emerald-300 font-bold border border-emerald-800">-6</code> operates on item #6 in the list.
        </div>
      </div>

      {/* Commands List */}
      <div className="flex-1 p-3.5 overflow-y-auto space-y-4 font-mono text-xs">
        {COMMAND_GROUPS.map((group) => (
          <div key={group.category} className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${group.badgeColor}`}>
                {group.category}
              </span>
            </div>

            <div className="space-y-1">
              {group.items.map((item) => (
                <div
                  key={item.cmd}
                  onClick={() => item.example && onExecuteCommand(item.example)}
                  className="group flex items-center justify-between p-2 rounded-lg bg-zinc-900/50 hover:bg-zinc-900 border border-zinc-800/60 hover:border-zinc-700 cursor-pointer transition-all"
                >
                  <div className="space-y-0.5 flex-1 min-w-0 pr-2">
                    <div className="font-bold text-zinc-200 group-hover:text-emerald-300 transition-colors truncate">
                      {item.cmd}
                    </div>
                    <div className="text-[11px] text-zinc-400">{item.desc}</div>
                    {item.example && (
                      <div className="text-[10px] text-zinc-500">
                        e.g. <span className="text-zinc-300">{item.example}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                    <button
                      type="button"
                      onClick={(e) => item.example && handleCopy(item.example, e)}
                      className="p-1 hover:bg-zinc-800 rounded text-zinc-400 hover:text-zinc-200"
                      title="Copy command"
                    >
                      {copiedCmd === item.example ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
