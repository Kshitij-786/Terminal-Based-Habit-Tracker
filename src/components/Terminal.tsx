import React, { useState, useRef, useEffect, KeyboardEvent } from 'react';
import { TerminalEntry, UserState } from '../types';
import { executeCommand } from '../utils/parser';
import { Terminal as TerminalIcon, CornerDownLeft, Sparkles, Trash2, Copy, Check } from 'lucide-react';

interface TerminalProps {
  currentUser: UserState;
  onUserUpdate: (updatedUser: UserState) => void;
  onViewChange?: (view: 'tasks' | 'habits' | 'task_stats' | 'habit_stats' | 'help' | 'cmd') => void;
  initialCommand?: string;
  onExecuteExternal?: (cmd: string) => void;
}

const AUTOCOMPLETE_COMMANDS = [
  'date',
  'time',
  'cal',
  'list',
  'list today',
  'list tomorrow',
  'add "Task name"',
  'add tomorrow "Task name"',
  'done -1',
  'cancel -1',
  'rename -1 "New task name"',
  'remove -1',
  'move -1 today',
  'move -1 tomorrow',
  'move -1 2026-09-10',
  'habit list',
  'habit add "Habit name"',
  'habit done -1',
  'habit streak -1',
  'habit graph',
  'habit rename -1 "New habit name"',
  'habit remove -1',
  '-help',
  '-cmd',
  'create user',
  'user',
  'login',
  'clear',
  'logout',
];

export const Terminal: React.FC<TerminalProps> = ({
  currentUser,
  onUserUpdate,
  onViewChange,
}) => {
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const [copied, setCopied] = useState(false);
  const [entries, setEntries] = useState<TerminalEntry[]>([
    {
      id: 'welcome-1',
      type: 'output',
      outputType: 'info',
      content: `habitOS Terminal v2.7.0 (x86_64-habitos-cli)
Type '-help' or '-cmd' for the command reference.
Tasks: list, add "name", done -1, cancel -1, rename -1 "name", move -1 tomorrow, remove -1
Habits: habit list, habit add "name", habit done -1, habit streak -1, habit graph
Authenticated session: ${currentUser.userId}@habitOS`,
      timestamp: new Date().toLocaleTimeString(),
    },
    {
      id: 'welcome-2',
      type: 'command',
      command: 'list',
      content: '',
      timestamp: new Date().toLocaleTimeString(),
    },
  ]);

  const [suggestions, setSuggestions] = useState<string[]>([]);
  const terminalEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Run initial 'list' on mount
  useEffect(() => {
    executeCommand('list', currentUser).then((result) => {
      setEntries(prev => [
        ...prev,
        {
          id: 'init-task-view',
          type: 'output',
          outputType: result.outputType,
          content: result.message,
          timestamp: new Date().toLocaleTimeString(),
        },
      ]);
    });
  }, []);

  // Auto scroll to bottom
  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [entries]);

  // Global key listener so typing anywhere automatically focuses the input
  useEffect(() => {
    const handleGlobalKeyDown = (e: globalThis.KeyboardEvent) => {
      const active = document.activeElement;
      if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) {
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key.length === 1 || e.key === 'Backspace' || e.key === 'Enter') {
        inputRef.current?.focus();
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  // Auto-focus on mount & window focus
  useEffect(() => {
    inputRef.current?.focus();
    const onFocus = () => inputRef.current?.focus();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, []);

  const handleContainerClick = () => {
    inputRef.current?.focus();
  };

  const handleCommandExecution = async (cmdString: string) => {
    const trimmed = cmdString.trim();
    if (!trimmed) return;

    // Add to command history
    setHistory(prev => [...prev, trimmed]);
    setHistoryIndex(-1);

    // Execute command via parser
    const result = await executeCommand(trimmed, currentUser, (newUser) => {
      onUserUpdate(newUser);
    });

    if (result.shouldClear) {
      setEntries([]);
      setInput('');
      return;
    }

    const commandEntry: TerminalEntry = {
      id: `cmd-${Date.now()}`,
      type: 'command',
      command: trimmed,
      content: '',
      timestamp: new Date().toLocaleTimeString(),
    };

    const outputEntry: TerminalEntry = {
      id: `out-${Date.now()}`,
      type: 'output',
      outputType: result.outputType,
      content: result.message,
      timestamp: new Date().toLocaleTimeString(),
    };

    setEntries(prev => [...prev, commandEntry, outputEntry]);
    setInput('');
    setSuggestions([]);

    if (result.updatedUser) {
      onUserUpdate(result.updatedUser);
    }

    if (result.activeView && onViewChange) {
      onViewChange(result.activeView);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleCommandExecution(input);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (history.length === 0) return;
      const nextIndex = historyIndex === -1 ? history.length - 1 : Math.max(0, historyIndex - 1);
      setHistoryIndex(nextIndex);
      setInput(history[nextIndex]);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (history.length === 0 || historyIndex === -1) return;
      const nextIndex = historyIndex + 1;
      if (nextIndex >= history.length) {
        setHistoryIndex(-1);
        setInput('');
      } else {
        setHistoryIndex(nextIndex);
        setInput(history[nextIndex]);
      }
    } else if (e.key === 'Tab') {
      e.preventDefault();
      const val = input.trim();
      if (!val) {
        setSuggestions(['list', 'habit list', 'habit graph', '-cmd', '-help']);
        return;
      }

      // Dynamic task/habit serial suggestions
      const taskSerials = currentUser.tasks.map((_, i) => `${i + 1}`);
      const habitSerials = currentUser.habits.map((_, i) => `${i + 1}`);

      const dynamicList = [
        ...AUTOCOMPLETE_COMMANDS,
        ...taskSerials.map(s => `done -${s}`),
        ...taskSerials.map(s => `cancel -${s}`),
        ...taskSerials.map(s => `rename -${s} "New task name"`),
        ...taskSerials.map(s => `remove -${s}`),
        ...taskSerials.map(s => `move -${s} today`),
        ...taskSerials.map(s => `move -${s} tomorrow`),
        ...taskSerials.map(s => `move -${s} 2026-09-10`),
        ...habitSerials.map(s => `habit done -${s}`),
        ...habitSerials.map(s => `habit streak -${s}`),
        ...habitSerials.map(s => `habit rename -${s} "New habit name"`),
        ...habitSerials.map(s => `habit remove -${s}`),
      ];

      const matches = dynamicList.filter(cmd => cmd.toLowerCase().startsWith(val.toLowerCase()));
      if (matches.length === 1) {
        setInput(matches[0]);
        setSuggestions([]);
      } else if (matches.length > 1) {
        setSuggestions(matches.slice(0, 8));
        const first = matches[0];
        let common = '';
        for (let i = 0; i < first.length; i++) {
          if (matches.every(m => m[i]?.toLowerCase() === first[i]?.toLowerCase())) {
            common += first[i];
          } else {
            break;
          }
        }
        if (common.length > val.length) {
          setInput(common);
        }
      }
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInput(val);
    if (val.length > 1) {
      const matches = AUTOCOMPLETE_COMMANDS.filter(cmd => cmd.toLowerCase().includes(val.toLowerCase()));
      setSuggestions(matches.slice(0, 4));
    } else {
      setSuggestions([]);
    }
  };

  const handleCopyLog = () => {
    const text = entries
      .map(e => (e.type === 'command' ? `${currentUser.userId}@habitOS:~$ ${e.command}` : e.content))
      .join('\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Syntax highlighting renderer for terminal log lines
  const renderFormattedOutput = (content: string | React.ReactNode, type?: string) => {
    if (typeof content !== 'string') return content;

    let baseColor = 'text-[#E0E0E0]';
    if (type === 'success') baseColor = 'text-[#4ADE80] font-medium';
    if (type === 'error') baseColor = 'text-rose-400 font-medium';
    if (type === 'warning') baseColor = 'text-[#FBBF24] font-medium';
    if (type === 'info') baseColor = 'text-[#60A5FA]';
    if (type === 'ascii-graph') baseColor = 'text-cyan-300 font-mono leading-relaxed';

    const lines = content.split('\n');
    return (
      <div className={`whitespace-pre-wrap font-mono text-sm leading-relaxed ${baseColor}`}>
        {lines.map((line, lIdx) => {
          // 1. Task/Habit serial lines: [1], [2], [H1]
          const serialMatch = line.match(/^(\[\d+\]|\[H\d+\])(.*)$/);
          if (serialMatch) {
            const isHabit = serialMatch[1].startsWith('[H');
            const rest = serialMatch[2];

            return (
              <div key={lIdx} className="min-h-[1.25rem]">
                <span className={isHabit ? 'text-[#F472B6] font-bold' : 'text-[#60A5FA] font-bold'}>
                  {serialMatch[1]}
                </span>
                <span>{renderInlineTags(rest)}</span>
              </div>
            );
          }

          // 2. Regular line with inline tags
          return (
            <div key={lIdx} className="min-h-[1.25rem]">
              {renderInlineTags(line)}
            </div>
          );
        })}
      </div>
    );
  };

  // Helper for inline tag coloring ([TODAY], [DONE], [PENDING], [OVERDUE], [HIGH], etc.)
  const renderInlineTags = (text: string) => {
    if (!text) return text;

    if (text.includes('[TODAY]')) {
      const parts = text.split(/(\[TODAY\].*?\[\/TODAY\])/g);
      return parts.map((p, i) => {
        if (p.startsWith('[TODAY]') && p.endsWith('[/TODAY]')) {
          const inner = p.replace(/\[TODAY\]|\[\/TODAY\]/g, '');
          return (
            <span
              key={`today-${i}`}
              className="inline-block w-[2ch] text-center font-bold bg-[#4ADE80] text-[#0A0B0D] rounded-sm ring-1 ring-[#4ADE80]/70 shadow-[0_0_8px_rgba(74,222,128,0.4)] select-all"
            >
              {inner.trim()}
            </span>
          );
        }
        return renderStatusBadges(p);
      });
    }

    return renderStatusBadges(text);
  };

  const renderStatusBadges = (text: string) => {
    if (!text) return text;

    // Check for specific tags
    if (text.includes('[DONE TODAY]') || text.includes('[DONE]')) {
      const parts = text.split(/(\[DONE TODAY\]|\[DONE\])/g);
      return parts.map((p, i) => {
        if (p === '[DONE TODAY]' || p === '[DONE]') {
          return <span key={i} className="text-[#4ADE80] font-bold">{p}</span>;
        }
        return <span key={i}>{p}</span>;
      });
    }

    if (text.includes('[OVERDUE]')) {
      const parts = text.split(/(\[OVERDUE\])/g);
      return parts.map((p, i) => {
        if (p === '[OVERDUE]') {
          return <span key={i} className="text-rose-400 font-bold">{p}</span>;
        }
        return <span key={i}>{p}</span>;
      });
    }

    if (text.includes('[TOMORROW]')) {
      const parts = text.split(/(\[TOMORROW\])/g);
      return parts.map((p, i) => {
        if (p === '[TOMORROW]') {
          return <span key={i} className="text-amber-400 font-bold">{p}</span>;
        }
        return <span key={i}>{p}</span>;
      });
    }

    if (text.includes('[PENDING]')) {
      const parts = text.split(/(\[PENDING\])/g);
      return parts.map((p, i) => {
        if (p === '[PENDING]') {
          return <span key={i} className="text-[#A0A0A0]">{p}</span>;
        }
        return <span key={i}>{p}</span>;
      });
    }

    return text;
  };

  return (
    <div
      id="habitos-terminal-container"
      className="flex flex-col h-full bg-[#0A0B0D] overflow-hidden select-text cursor-text font-mono"
      onClick={handleContainerClick}
    >
      {/* Terminal Title Bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-[#0F1014] border-b border-[#2A2B2F] select-none shrink-0">
        <div className="flex items-center gap-2">
          <TerminalIcon className="w-3.5 h-3.5 text-[#4ADE80]" />
          <span className="text-xs font-mono text-[#A0A0A0]">
            {currentUser.userId}@habitOS: ~/workspace (bash)
          </span>
        </div>

        <div className="flex items-center gap-2 text-[11px] font-mono">
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleCopyLog();
            }}
            className="flex items-center gap-1 px-2 py-0.5 text-xs text-[#6A6B6F] hover:text-[#E0E0E0] hover:bg-[#16171D] rounded border border-transparent hover:border-[#2A2B2F] transition-colors cursor-pointer"
            title="Copy terminal buffer"
          >
            {copied ? <Check className="w-3 h-3 text-[#4ADE80]" /> : <Copy className="w-3 h-3" />}
            <span>{copied ? 'copied' : 'copy'}</span>
          </button>
          <button
            id="clear-terminal-btn"
            onClick={(e) => {
              e.stopPropagation();
              setEntries([]);
            }}
            className="flex items-center gap-1 px-2 py-0.5 text-xs text-[#6A6B6F] hover:text-[#E0E0E0] hover:bg-[#16171D] rounded border border-transparent hover:border-[#2A2B2F] transition-colors cursor-pointer"
            title="Clear terminal buffer"
          >
            <Trash2 className="w-3 h-3" />
            <span>clear</span>
          </button>
        </div>
      </div>

      {/* Terminal Output Log Stream */}
      <div className="flex-1 p-5 overflow-y-auto font-mono text-sm space-y-3.5">
        {entries.map((entry) => (
          <div key={entry.id} className="space-y-1">
            {entry.type === 'command' ? (
              <div className="flex items-center gap-2 text-[#A0A0A0]">
                <span className="text-[#4ADE80] font-bold select-none whitespace-nowrap">
                  {currentUser.userId}@habitOS:~$
                </span>
                <span className="text-[#E0E0E0] font-semibold">{entry.command}</span>
                <span className="text-[10px] text-[#6A6B6F] ml-auto select-none">{entry.timestamp}</span>
              </div>
            ) : (
              <div className="pl-3 border-l border-[#2A2B2F] py-0.5">
                {renderFormattedOutput(entry.content, entry.outputType)}
              </div>
            )}
          </div>
        ))}
        <div ref={terminalEndRef} />
      </div>

      {/* Autocomplete / Suggestions Popover */}
      {suggestions.length > 0 && (
        <div className="px-4 py-1.5 bg-[#0F1014] border-t border-[#2A2B2F] flex flex-wrap items-center gap-1.5 text-xs font-mono text-[#A0A0A0] shrink-0">
          <span className="text-[#6A6B6F] flex items-center gap-1 mr-1 text-[11px]">
            <Sparkles className="w-3 h-3 text-[#4ADE80]" /> Tab:
          </span>
          {suggestions.map((s, idx) => (
            <button
              key={idx}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setInput(s);
                setSuggestions([]);
                inputRef.current?.focus();
              }}
              className="px-2 py-0.5 bg-[#16171D] hover:bg-[#20222A] text-[#4ADE80] border border-[#2A2B2F] rounded text-[11px] transition-colors cursor-pointer"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Quick Launch Command Helper Chips */}
      <div className="px-3 py-1.5 bg-[#0F1014] border-t border-[#2A2B2F] flex items-center gap-1.5 overflow-x-auto text-[11px] font-mono no-scrollbar shrink-0 select-none">
        <span className="text-[#6A6B6F] uppercase tracking-wider text-[9px] font-semibold mr-1 shrink-0">
          Quick:
        </span>
        {[
          { label: 'list', cmd: 'list' },
          { label: 'habit list', cmd: 'habit list' },
          { label: 'habit graph', cmd: 'habit graph' },
          { label: '-cmd', cmd: '-cmd' },
          { label: '-help', cmd: '-help' },
        ].map((q) => (
          <button
            key={q.cmd}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleCommandExecution(q.cmd);
            }}
            className="px-2 py-0.5 rounded bg-[#16171D] hover:bg-[#20222A] text-[#A0A0A0] hover:text-[#4ADE80] border border-[#2A2B2F] transition-colors whitespace-nowrap cursor-pointer"
          >
            {q.label}
          </button>
        ))}
      </div>

      {/* Command Input Prompt Line */}
      <div 
        className="p-3.5 bg-[#0F1014] border-t border-[#2A2B2F] flex items-center gap-2 shrink-0 cursor-text"
        onClick={(e) => {
          e.stopPropagation();
          inputRef.current?.focus();
        }}
      >
        <label htmlFor="habitos-terminal-input" className="text-[#4ADE80] font-mono text-sm font-bold select-none whitespace-nowrap cursor-pointer">
          {currentUser.userId}@habitOS:~$
        </label>
        <input
          id="habitos-terminal-input"
          ref={inputRef}
          type="text"
          value={input}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          autoFocus
          spellCheck={false}
          autoComplete="off"
          placeholder="Type command (e.g. list, habit list, add &quot;Buy groceries&quot;, done -1, -help)..."
          className="flex-1 bg-transparent text-[#E0E0E0] font-mono text-sm outline-none placeholder:text-[#6A6B6F] caret-[#4ADE80] select-text cursor-text"
        />
        <button
          id="submit-command-btn"
          type="button"
          onClick={() => handleCommandExecution(input)}
          className="px-2.5 py-1 rounded bg-[#16171D] hover:bg-[#20222A] text-[#4ADE80] border border-[#2A2B2F] hover:border-[#4ADE80] transition-colors flex items-center gap-1 text-xs font-mono cursor-pointer"
          title="Execute Command (Enter)"
        >
          <CornerDownLeft className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">EXEC</span>
        </button>
      </div>
    </div>
  );
};
