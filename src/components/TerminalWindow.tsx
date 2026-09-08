import React, { useState, useRef, useEffect, KeyboardEvent } from 'react';
import { TerminalEntry, UserState, Task, Habit } from '../types';
import { executeCommand } from '../utils/parser';
import { validateUserId } from '../utils/auth';
import { authService, taskService, habitService } from '../services';
import { AdminPanel } from './AdminPanel';
import { Minus, Square, X } from 'lucide-react';

interface TerminalWindowProps {
  currentUser: UserState | null;
  isAuthenticated: boolean;
  onUserUpdate: (updatedUser: UserState) => void;
  onLoginSuccess: (user: UserState) => void;
  onLogout: () => void;
}

type InteractiveMode =
  | 'NONE'
  | 'CREATE_USER_ID'
  | 'CREATE_PASSWORD'
  | 'CREATE_CONFIRM_PASSWORD'
  | 'CREATE_CONFIRM_SUBMIT'
  | 'LOGIN_USER_ID'
  | 'LOGIN_PASSWORD';

const AUTH_REQUIRED_BANNER = `========================================
              TERMINAL
========================================

User Authentication Required.
Type 'login' to sign in or 'create user' to register.
Type '-help' for command overview.`;

const AUTH_WELCOME_BANNER = `Terminal CLI & Habit/Task Manager [Version 2.7.0]
(C) habitos. Type '-help' for overview, '-cmd' for command reference.
Run 'list' for tasks or 'habit list' for habit tracking.`;

const AUTOCOMPLETE_AUTH_COMMANDS = [
  'date',
  'time',
  'cal',
  'db',
  '-help',
  '-cmd',
  'login',
  'create user',
  'clear',
];

const AUTOCOMPLETE_APP_COMMANDS = [
  'date',
  'time',
  'cal',
  'db',
  'add "Task name"',
  'add tomorrow "Task name"',
  'list',
  'list today',
  'list tomorrow',
  'done -1',
  'cancel -1',
  'remove -1',
  'rename -1 "New task name"',
  'move -1 today',
  'move -1 tomorrow',
  'move -1 2026-09-10',
  'habit add "Habit name"',
  'habit list',
  'habit done -1',
  'habit streak -1',
  'habit graph',
  'habit rename -1 "New habit name"',
  'habit remove -1',
  '-help',
  '-cmd',
  'create user',
  'login',
  'user',
  'logout',
  'clear',
];

export const TerminalWindow: React.FC<TerminalWindowProps> = ({
  currentUser,
  isAuthenticated,
  onUserUpdate,
  onLoginSuccess,
  onLogout,
}) => {
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);

  // Interactive flow state (for multi-step prompt sequences like create user and login)
  const [interactiveMode, setInteractiveMode] = useState<InteractiveMode>('NONE');
  const [flowUserId, setFlowUserId] = useState('');
  const [flowPassword, setFlowPassword] = useState('');
  const [isAdminPanelOpen, setIsAdminPanelOpen] = useState(false);

  const [entries, setEntries] = useState<TerminalEntry[]>(() => [
    {
      id: 'init-header-1',
      type: 'output',
      outputType: 'info',
      content: isAuthenticated ? AUTH_WELCOME_BANNER : AUTH_REQUIRED_BANNER,
      timestamp: new Date().toLocaleTimeString(),
    },
  ]);

  const terminalEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto scroll to bottom whenever entries, input, or interactiveMode changes
  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [entries, input, interactiveMode]);

  // Keep input focused automatically
  useEffect(() => {
    inputRef.current?.focus();
    const handleGlobalClick = () => {
      const selection = window.getSelection();
      if (selection && selection.toString().length > 0) {
        return;
      }
      inputRef.current?.focus();
    };
    window.addEventListener('click', handleGlobalClick);
    return () => window.removeEventListener('click', handleGlobalClick);
  }, []);

  // Global keydown focus catcher
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

  // Reset flow helper
  const resetInteractiveFlow = () => {
    setInteractiveMode('NONE');
    setFlowUserId('');
    setFlowPassword('');
    setInput('');
  };

  const handleCommandExecution = async (cmdString: string) => {
    // If in interactive mode, route to step handler
    if (interactiveMode !== 'NONE') {
      handleInteractiveStep(cmdString);
      return;
    }

    const trimmed = cmdString.trim();
    if (!trimmed) {
      // Empty Enter prints a new prompt line
      setEntries((prev) => [
        ...prev,
        {
          id: `empty-${Date.now()}`,
          type: 'command',
          command: '',
          content: '',
          timestamp: new Date().toLocaleTimeString(),
        },
      ]);
      return;
    }

    // Only non-password, standard top-level commands enter command history
    setHistory((prev) => [...prev, trimmed]);
    setHistoryIndex(-1);

    if (trimmed.toLowerCase() === 'clear' || trimmed.toLowerCase() === 'cls') {
      setEntries([]);
      setInput('');
      return;
    }

    const result = await executeCommand(trimmed, currentUser, isAuthenticated, (newUser) => {
      onUserUpdate(newUser);
    });

    if (result.shouldClear) {
      setEntries([]);
      setInput('');
      return;
    }

    // Append user command entry
    const commandEntry: TerminalEntry = {
      id: `cmd-${Date.now()}`,
      type: 'command',
      command: trimmed,
      content: '',
      timestamp: new Date().toLocaleTimeString(),
    };

    // Check actions
    if (result.action === 'START_CREATE_USER') {
      const initialId = result.actionArg?.trim();
      if (initialId) {
        // Fast-path: User supplied ID in command (e.g. create user shadow)
        const val = validateUserId(initialId);
        if (!val.valid) {
          const errEntry: TerminalEntry = {
            id: `out-${Date.now()}`,
            type: 'output',
            outputType: 'error',
            content: val.error || 'ERROR: Invalid User ID.',
            timestamp: new Date().toLocaleTimeString(),
          };
          setEntries((prev) => [...prev, commandEntry, errEntry]);
          setInput('');
          return;
        }
        setFlowUserId(initialId);
        setInteractiveMode('CREATE_PASSWORD');
        const headerEntry: TerminalEntry = {
          id: `out-${Date.now()}`,
          type: 'output',
          outputType: 'text',
          content: `Create New User\n------------------------------\nUser ID: ${initialId}`,
          timestamp: new Date().toLocaleTimeString(),
        };
        setEntries((prev) => [...prev, commandEntry, headerEntry]);
        setInput('');
        return;
      }

      // Standard multi-step creation flow
      setInteractiveMode('CREATE_USER_ID');
      const headerEntry: TerminalEntry = {
        id: `out-${Date.now()}`,
        type: 'output',
        outputType: 'text',
        content: `Create New User\n------------------------------`,
        timestamp: new Date().toLocaleTimeString(),
      };
      setEntries((prev) => [...prev, commandEntry, headerEntry]);
      setInput('');
      return;
    }

    if (result.action === 'START_LOGIN') {
      const initialId = result.actionArg?.trim();
      if (initialId) {
        // Fast-path: User supplied ID in command (e.g. login shadow)
        setFlowUserId(initialId);
        setInteractiveMode('LOGIN_PASSWORD');
        const headerEntry: TerminalEntry = {
          id: `out-${Date.now()}`,
          type: 'output',
          outputType: 'text',
          content: `User ID: ${initialId}`,
          timestamp: new Date().toLocaleTimeString(),
        };
        setEntries((prev) => [...prev, commandEntry, headerEntry]);
        setInput('');
        return;
      }

      // Standard multi-step login flow
      setInteractiveMode('LOGIN_USER_ID');
      setEntries((prev) => [...prev, commandEntry]);
      setInput('');
      return;
    }

    if (result.action === 'LOGOUT') {
      setIsAdminPanelOpen(false);
      authService.signOut().catch(() => {});
      const logoutBannerEntry: TerminalEntry = {
        id: `out-${Date.now()}`,
        type: 'output',
        outputType: 'info',
        content: `Logging out...\n\nSession closed.\n\n${AUTH_REQUIRED_BANNER}`,
        timestamp: new Date().toLocaleTimeString(),
      };
      setEntries((prev) => [...prev, commandEntry, logoutBannerEntry]);
      setInput('');
      onLogout();
      return;
    }

    if (result.action === 'OPEN_ADMIN') {
      const outputEntry: TerminalEntry = {
        id: `out-${Date.now()}`,
        type: 'output',
        outputType: result.outputType,
        content: result.message,
        timestamp: new Date().toLocaleTimeString(),
      };
      setEntries((prev) => [...prev, commandEntry, outputEntry]);
      setInput('');
      setIsAdminPanelOpen(true);
      return;
    }

    const outputEntry: TerminalEntry = {
      id: `out-${Date.now()}`,
      type: 'output',
      outputType: result.outputType,
      content: result.message,
      timestamp: new Date().toLocaleTimeString(),
    };

    setEntries((prev) => [...prev, commandEntry, outputEntry]);
    setInput('');

    if (result.updatedUser) {
      onUserUpdate(result.updatedUser);
    }
  };

  const handleInteractiveStep = async (rawVal: string) => {
    const trimmed = rawVal.trim();

    // Cancellation check
    if (trimmed.toLowerCase() === 'cancel' || trimmed.toLowerCase() === 'exit') {
      const cancelEntry: TerminalEntry = {
        id: `out-${Date.now()}`,
        type: 'output',
        outputType: 'warning',
        content: 'Operation cancelled.',
        timestamp: new Date().toLocaleTimeString(),
      };
      setEntries((prev) => [...prev, cancelEntry]);
      resetInteractiveFlow();
      return;
    }

    // Step 1: CREATE_USER_ID
    if (interactiveMode === 'CREATE_USER_ID') {
      const val = validateUserId(trimmed);
      if (!val.valid) {
        const errEntry: TerminalEntry = {
          id: `out-${Date.now()}`,
          type: 'output',
          outputType: 'error',
          content: `User ID: ${trimmed}\n${val.error || 'ERROR: Invalid User ID.'}`,
          timestamp: new Date().toLocaleTimeString(),
        };
        setEntries((prev) => [...prev, errEntry]);
        resetInteractiveFlow();
        return;
      }

      setFlowUserId(trimmed);
      const echoEntry: TerminalEntry = {
        id: `out-${Date.now()}`,
        type: 'output',
        outputType: 'text',
        content: `User ID: ${trimmed}`,
        timestamp: new Date().toLocaleTimeString(),
      };
      setEntries((prev) => [...prev, echoEntry]);
      setInteractiveMode('CREATE_PASSWORD');
      setInput('');
      return;
    }

    // Step 2: CREATE_PASSWORD
    if (interactiveMode === 'CREATE_PASSWORD') {
      if (!trimmed) {
        const errEntry: TerminalEntry = {
          id: `out-${Date.now()}`,
          type: 'output',
          outputType: 'error',
          content: `Password: ********\nERROR: Password cannot be empty.`,
          timestamp: new Date().toLocaleTimeString(),
        };
        setEntries((prev) => [...prev, errEntry]);
        resetInteractiveFlow();
        return;
      }

      setFlowPassword(rawVal);
      const echoEntry: TerminalEntry = {
        id: `out-${Date.now()}`,
        type: 'output',
        outputType: 'text',
        content: `Password: ********`,
        timestamp: new Date().toLocaleTimeString(),
      };
      setEntries((prev) => [...prev, echoEntry]);
      setInteractiveMode('CREATE_CONFIRM_PASSWORD');
      setInput('');
      return;
    }

    // Step 3: CREATE_CONFIRM_PASSWORD
    if (interactiveMode === 'CREATE_CONFIRM_PASSWORD') {
      if (rawVal !== flowPassword) {
        const errEntry: TerminalEntry = {
          id: `out-${Date.now()}`,
          type: 'output',
          outputType: 'error',
          content: `Confirm Password: ********\nERROR: Passwords do not match.`,
          timestamp: new Date().toLocaleTimeString(),
        };
        setEntries((prev) => [...prev, errEntry]);
        resetInteractiveFlow();
        return;
      }

      const echoEntry: TerminalEntry = {
        id: `out-${Date.now()}`,
        type: 'output',
        outputType: 'text',
        content: `Confirm Password: ********`,
        timestamp: new Date().toLocaleTimeString(),
      };
      setEntries((prev) => [...prev, echoEntry]);
      setInteractiveMode('CREATE_CONFIRM_SUBMIT');
      setInput('');
      return;
    }

    // Step 4: CREATE_CONFIRM_SUBMIT
    if (interactiveMode === 'CREATE_CONFIRM_SUBMIT') {
      const choice = trimmed.toLowerCase();
      if (choice === 'n' || choice === 'no') {
        const cancelEntry: TerminalEntry = {
          id: `out-${Date.now()}`,
          type: 'output',
          outputType: 'warning',
          content: `Create account? [y/n]: ${choice}\nAccount creation cancelled.`,
          timestamp: new Date().toLocaleTimeString(),
        };
        setEntries((prev) => [...prev, cancelEntry]);
        resetInteractiveFlow();
        return;
      }

      if (choice !== 'y' && choice !== 'yes') {
        const errEntry: TerminalEntry = {
          id: `out-${Date.now()}`,
          type: 'output',
          outputType: 'warning',
          content: `Create account? [y/n]: ${trimmed}\n\nPlease enter 'y' to confirm or 'n' to cancel.`,
          timestamp: new Date().toLocaleTimeString(),
        };
        setEntries((prev) => [...prev, errEntry]);
        setInput('');
        return;
      }

      // Supabase registration integration
      if (!authService.isConfigured()) {
        const errEntry: TerminalEntry = {
          id: `out-${Date.now()}`,
          type: 'output',
          outputType: 'error',
          content: `Create account? [y/n]: y\nERROR: Supabase client is not configured.`,
          timestamp: new Date().toLocaleTimeString(),
        };
        setEntries((prev) => [...prev, errEntry]);
        resetInteractiveFlow();
        return;
      }

      let activeSession = null;
      let supaUser = null;
      try {
        const supaRes = await authService.signUp(flowUserId, flowPassword);
        if (supaRes.error || !supaRes.data) {
          const errEntry: TerminalEntry = {
            id: `out-${Date.now()}`,
            type: 'output',
            outputType: 'error',
            content: `Create account? [y/n]: y\nERROR: ${supaRes.error || 'Registration failed.'}`,
            timestamp: new Date().toLocaleTimeString(),
          };
          setEntries((prev) => [...prev, errEntry]);
          resetInteractiveFlow();
          return;
        }
        activeSession = supaRes.data.session;
        supaUser = supaRes.data.user;
      } catch (err: any) {
        const errEntry: TerminalEntry = {
          id: `out-${Date.now()}`,
          type: 'output',
          outputType: 'error',
          content: `Create account? [y/n]: y\nERROR: ${err.message || 'Registration error.'}`,
          timestamp: new Date().toLocaleTimeString(),
        };
        setEntries((prev) => [...prev, errEntry]);
        resetInteractiveFlow();
        return;
      }

      const displayUserId =
        supaUser?.user_metadata?.cli_user_id ||
        supaUser?.user_metadata?.display_name ||
        flowUserId.trim();

      // Fetch current database data to ensure state is synchronized from Supabase
      let userTasks: Task[] = [];
      let userHabits: Habit[] = [];
      if (activeSession) {
        try {
          const [dbTasks, dbHabits] = await Promise.all([
            taskService.fetchTasks(),
            habitService.fetchHabits(),
          ]);
          if (dbTasks.data) userTasks = dbTasks.data;
          if (dbHabits.data) userHabits = dbHabits.data;
        } catch {
          userTasks = [];
          userHabits = [];
        }
      }

      const activeUser: UserState = {
        userId: displayUserId,
        userName: displayUserId,
        tasks: userTasks,
        habits: userHabits,
        createdAt: supaUser?.created_at || new Date().toISOString(),
      };

      const successEntry: TerminalEntry = {
        id: `out-${Date.now()}`,
        type: 'output',
        outputType: 'success',
        content: `Create account? [y/n]: y\n\nUSER CREATED SUCCESSFULLY\n\nUser ID          : ${displayUserId}\nDatabase Info    : Supabase profile provisioned in PostgreSQL\n\nYou can now log in.`,
        timestamp: new Date().toLocaleTimeString(),
      };
      setEntries((prev) => [...prev, successEntry]);
      if (activeSession) {
        onLoginSuccess(activeUser);
      }
      resetInteractiveFlow();
      return;
    }

    // Step 5: LOGIN_USER_ID
    if (interactiveMode === 'LOGIN_USER_ID') {
      if (!trimmed) {
        const errEntry: TerminalEntry = {
          id: `out-${Date.now()}`,
          type: 'output',
          outputType: 'error',
          content: `ERROR: User ID cannot be empty.`,
          timestamp: new Date().toLocaleTimeString(),
        };
        setEntries((prev) => [...prev, errEntry]);
        resetInteractiveFlow();
        return;
      }

      setFlowUserId(trimmed);
      const echoEntry: TerminalEntry = {
        id: `out-${Date.now()}`,
        type: 'output',
        outputType: 'text',
        content: `User ID: ${trimmed}`,
        timestamp: new Date().toLocaleTimeString(),
      };
      setEntries((prev) => [...prev, echoEntry]);
      setInteractiveMode('LOGIN_PASSWORD');
      setInput('');
      return;
    }

    // Step 6: LOGIN_PASSWORD
    if (interactiveMode === 'LOGIN_PASSWORD') {
      if (!authService.isConfigured()) {
        const errEntry: TerminalEntry = {
          id: `out-${Date.now()}`,
          type: 'output',
          outputType: 'error',
          content: `Password: ********\nERROR: Supabase client is not configured.`,
          timestamp: new Date().toLocaleTimeString(),
        };
        setEntries((prev) => [...prev, errEntry]);
        resetInteractiveFlow();
        return;
      }

      try {
        const supaRes = await authService.signIn(flowUserId, rawVal);

        if (supaRes.error || !supaRes.data?.session) {
          const errEntry: TerminalEntry = {
            id: `out-${Date.now()}`,
            type: 'output',
            outputType: 'error',
            content: `Password: ********\nERROR: ${supaRes.error || 'Authentication failed: Invalid User ID or password.'}`,
            timestamp: new Date().toLocaleTimeString(),
          };
          setEntries((prev) => [...prev, errEntry]);
          resetInteractiveFlow();
          return;
        }

        const supaUser = supaRes.data.user;
        const displayUserId =
          supaUser.user_metadata?.cli_user_id ||
          supaUser.user_metadata?.display_name ||
          flowUserId.trim();

        // Fetch database tasks & habits with active Supabase session
        let initialTasks: Task[] = [];
        let initialHabits: Habit[] = [];
        try {
          const [dbTasks, dbHabits] = await Promise.all([
            taskService.fetchTasks(),
            habitService.fetchHabits(),
          ]);
          if (dbTasks.data) {
            initialTasks = dbTasks.data;
          }
          if (dbHabits.data) {
            initialHabits = dbHabits.data;
          }
        } catch (e) {
          console.warn('Error loading Supabase data after login:', e);
        }

        const userState: UserState = {
          userId: displayUserId,
          userName: displayUserId,
          tasks: initialTasks,
          habits: initialHabits,
          createdAt: supaUser.created_at || new Date().toISOString(),
        };

        const successEntry: TerminalEntry = {
          id: `out-${Date.now()}`,
          type: 'output',
          outputType: 'success',
          content: `Password: ********\n\nAuthentication successful.\nDatabase Status  : Connected to Supabase PostgreSQL\n\nLoading user environment...\n\nWelcome, ${displayUserId}.`,
          timestamp: new Date().toLocaleTimeString(),
        };
        setEntries((prev) => [...prev, successEntry]);
        onLoginSuccess(userState);
        resetInteractiveFlow();
        return;
      } catch (err: any) {
        const errEntry: TerminalEntry = {
          id: `out-${Date.now()}`,
          type: 'output',
          outputType: 'error',
          content: `Password: ********\nERROR: ${err.message || 'Authentication error.'}`,
          timestamp: new Date().toLocaleTimeString(),
        };
        setEntries((prev) => [...prev, errEntry]);
        resetInteractiveFlow();
        return;
      }
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleCommandExecution(input);
    } else if (e.key === 'ArrowUp') {
      // In password prompt mode, do not recall command history
      if (
        interactiveMode === 'CREATE_PASSWORD' ||
        interactiveMode === 'CREATE_CONFIRM_PASSWORD' ||
        interactiveMode === 'LOGIN_PASSWORD'
      ) {
        return;
      }
      e.preventDefault();
      if (history.length === 0) return;
      const nextIndex = historyIndex === -1 ? history.length - 1 : Math.max(0, historyIndex - 1);
      const recalledCmd = history[nextIndex];
      setHistoryIndex(nextIndex);
      setInput(recalledCmd);
      requestAnimationFrame(() => {
        if (inputRef.current) {
          inputRef.current.selectionStart = recalledCmd.length;
          inputRef.current.selectionEnd = recalledCmd.length;
          inputRef.current.focus();
        }
      });
    } else if (e.key === 'ArrowDown') {
      // In password prompt mode, do not recall command history
      if (
        interactiveMode === 'CREATE_PASSWORD' ||
        interactiveMode === 'CREATE_CONFIRM_PASSWORD' ||
        interactiveMode === 'LOGIN_PASSWORD'
      ) {
        return;
      }
      e.preventDefault();
      if (history.length === 0 || historyIndex === -1) return;
      const nextIndex = historyIndex + 1;
      if (nextIndex >= history.length) {
        setHistoryIndex(-1);
        setInput('');
        requestAnimationFrame(() => {
          if (inputRef.current) {
            inputRef.current.selectionStart = 0;
            inputRef.current.selectionEnd = 0;
            inputRef.current.focus();
          }
        });
      } else {
        const recalledCmd = history[nextIndex];
        setHistoryIndex(nextIndex);
        setInput(recalledCmd);
        requestAnimationFrame(() => {
          if (inputRef.current) {
            inputRef.current.selectionStart = recalledCmd.length;
            inputRef.current.selectionEnd = recalledCmd.length;
            inputRef.current.focus();
          }
        });
      }
    } else if (e.key === 'Tab') {
      e.preventDefault();
      if (interactiveMode !== 'NONE') return;

      const val = input.trim();
      if (!val) {
        setInput(isAuthenticated ? 'list' : '-help');
        return;
      }

      let candidates: string[] = [];
      if (!isAuthenticated) {
        candidates = AUTOCOMPLETE_AUTH_COMMANDS;
      } else {
        const taskSerials = (currentUser?.tasks || []).map((_, i) => `${i + 1}`);
        const habitSerials = (currentUser?.habits || []).map((_, i) => `${i + 1}`);

        candidates = [
          ...AUTOCOMPLETE_APP_COMMANDS,
          ...taskSerials.map((s) => `done -${s}`),
          ...taskSerials.map((s) => `cancel -${s}`),
          ...taskSerials.map((s) => `remove -${s}`),
          ...taskSerials.map((s) => `rename -${s} "New task name"`),
          ...taskSerials.map((s) => `move -${s} today`),
          ...taskSerials.map((s) => `move -${s} tomorrow`),
          ...taskSerials.map((s) => `move -${s} 2026-09-10`),
          ...habitSerials.map((s) => `habit done -${s}`),
          ...habitSerials.map((s) => `habit streak -${s}`),
          ...habitSerials.map((s) => `habit rename -${s} "New habit name"`),
          ...habitSerials.map((s) => `habit remove -${s}`),
        ];
      }

      const matches = candidates.filter((cmd) => cmd.toLowerCase().startsWith(val.toLowerCase()));
      if (matches.length > 0) {
        const currentIndex = matches.findIndex((m) => m.toLowerCase() === input.toLowerCase());
        if (currentIndex !== -1 && currentIndex < matches.length - 1) {
          setInput(matches[currentIndex + 1]);
        } else {
          setInput(matches[0]);
        }
      }
    }
  };

  const renderFormattedOutput = (content: string | React.ReactNode, type?: string) => {
    if (typeof content !== 'string') return content;

    let baseColor = 'text-[#D1D5DB]';
    if (type === 'error') baseColor = 'text-rose-400';
    if (type === 'success') baseColor = 'text-[#4ADE80]';
    if (type === 'warning') baseColor = 'text-amber-400';

    const lines = content.split('\n');
    return (
      <div className={`whitespace-pre-wrap font-mono text-[13.5px] leading-[1.35] ${baseColor}`}>
        {lines.map((line, lIdx) => {
          // Serial matches [1], [2], etc.
          const serialMatch = line.match(/^(\s*\[\d+\])(.*)$/);
          if (serialMatch) {
            const numTag = serialMatch[1];
            const rest = serialMatch[2];
            return (
              <div key={lIdx}>
                <span className="text-[#60A5FA] font-bold">{numTag}</span>
                <span>{renderInlineTags(rest)}</span>
              </div>
            );
          }

          return <div key={lIdx}>{renderInlineTags(line)}</div>;
        })}
      </div>
    );
  };

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
        return renderCheckmarks(p, i);
      });
    }

    return renderCheckmarks(text, 0);
  };

  const renderCheckmarks = (text: string, baseKey: number | string) => {
    if (text.includes('[✓]')) {
      const parts = text.split(/(\[✓\])/g);
      return parts.map((p, i) =>
        p === '[✓]' ? (
          <span key={`${baseKey}-chk-${i}`} className="text-[#4ADE80] font-bold">
            {p}
          </span>
        ) : (
          renderStatusBadges(p, `${baseKey}-${i}`)
        )
      );
    }

    return renderStatusBadges(text, String(baseKey));
  };

  const renderStatusBadges = (text: string, baseKey: number | string) => {
    if (text.includes('[DONE]')) {
      const parts = text.split(/(\[DONE\])/g);
      return parts.map((p, i) =>
        p === '[DONE]' ? (
          <span key={`${baseKey}-${i}`} className="text-[#4ADE80] font-bold">
            {p}
          </span>
        ) : (
          renderOtherBadges(p, `${baseKey}-${i}`)
        )
      );
    }
    return renderOtherBadges(text, String(baseKey));
  };

  const renderOtherBadges = (text: string, keyPrefix: string) => {
    if (text.includes('[CANCELLED]')) {
      const parts = text.split(/(\[CANCELLED\])/g);
      return parts.map((p, i) =>
        p === '[CANCELLED]' ? (
          <span key={`${keyPrefix}-${i}`} className="text-[#9CA3AF] font-bold">
            {p}
          </span>
        ) : (
          <span key={`${keyPrefix}-${i}`}>{p}</span>
        )
      );
    }
    if (text.includes('[TODO]')) {
      const parts = text.split(/(\[TODO\])/g);
      return parts.map((p, i) =>
        p === '[TODO]' ? (
          <span key={`${keyPrefix}-${i}`} className="text-[#38BDF8] font-bold">
            {p}
          </span>
        ) : (
          <span key={`${keyPrefix}-${i}`}>{p}</span>
        )
      );
    }
    return <span key={keyPrefix}>{text}</span>;
  };

  // Determine active input properties based on interactive prompt state
  const isPasswordInput =
    interactiveMode === 'CREATE_PASSWORD' ||
    interactiveMode === 'CREATE_CONFIRM_PASSWORD' ||
    interactiveMode === 'LOGIN_PASSWORD';

  const getInteractivePromptLabel = () => {
    switch (interactiveMode) {
      case 'CREATE_USER_ID':
      case 'LOGIN_USER_ID':
        return 'User ID: ';
      case 'CREATE_PASSWORD':
      case 'LOGIN_PASSWORD':
        return 'Password: ';
      case 'CREATE_CONFIRM_PASSWORD':
        return 'Confirm Password: ';
      case 'CREATE_CONFIRM_SUBMIT':
        return 'Create account? [y/n]: ';
      default:
        return '';
    }
  };

  const promptUsername = isAuthenticated && currentUser ? currentUser.userId : 'guest';

  return (
    <div
      ref={containerRef}
      id="terminal-shell"
      className="flex flex-col h-screen w-screen bg-[#0C0C0C] text-[#D1D5DB] font-mono select-text cursor-text overflow-hidden"
    >
      {/* 1. Terminal Top Tab Bar */}
      <div className="h-9 bg-[#1F1F1F] flex items-center justify-between px-2 select-none border-b border-[#2B2B2B] shrink-0 text-xs">
        <div className="flex items-end h-full pt-1 gap-1">
          <button
            type="button"
            id="tab-terminal"
            onClick={() => setIsAdminPanelOpen(false)}
            className={`flex items-center gap-2 px-3.5 h-8 rounded-t text-xs font-mono transition-colors ${
              !isAdminPanelOpen
                ? 'bg-[#0C0C0C] text-[#FFFFFF] border-t-2 border-[#38BDF8]'
                : 'bg-[#161616] text-[#888888] hover:text-[#FFFFFF]'
            }`}
          >
            <span className="text-[#38BDF8] text-xs font-bold">&gt;_</span>
            <span className="font-semibold tracking-wide">Terminal</span>
          </button>

          {isAdminPanelOpen && (
            <div
              id="tab-admin"
              className="flex items-center gap-2 px-3.5 h-8 rounded-t text-xs font-mono bg-[#0C0C0C] text-[#FFFFFF] border-t-2 border-[#4ADE80]"
            >
              <span className="text-[#4ADE80] text-xs font-bold">#</span>
              <span className="font-semibold tracking-wide">Admin Console</span>
            </div>
          )}
        </div>

        {/* Right Window Controls (Minimize, Maximize, Close) */}
        <div className="flex items-center text-[#A0A0A0] h-full">
          <button
            id="btn-minimize"
            type="button"
            className="h-full px-3.5 hover:bg-[#2A2A2A] hover:text-white flex items-center justify-center transition-colors"
            title="Minimize"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
          <button
            id="btn-maximize"
            type="button"
            className="h-full px-3.5 hover:bg-[#2A2A2A] hover:text-white flex items-center justify-center transition-colors"
            title="Maximize"
          >
            <Square className="w-3 h-3" />
          </button>
          <button
            id="btn-clear-buffer"
            type="button"
            onClick={() => {
              if (isAdminPanelOpen) {
                setIsAdminPanelOpen(false);
              } else {
                setEntries([]);
              }
            }}
            className="h-full px-3.5 hover:bg-[#E81123] hover:text-white flex items-center justify-center transition-colors"
            title={isAdminPanelOpen ? 'Exit Admin Console' : 'Clear buffer'}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 2. Main Content Area: Admin Panel or Standard Terminal Buffer */}
      {isAdminPanelOpen ? (
        <AdminPanel
          currentAdminUserId={currentUser?.userId}
          onExit={() => {
            setIsAdminPanelOpen(false);
            setEntries((prev) => [
              ...prev,
              {
                id: `exit-admin-${Date.now()}`,
                type: 'output',
                outputType: 'info',
                content: 'Session returned to standard terminal shell.',
                timestamp: new Date().toLocaleTimeString(),
              },
            ]);
          }}
        />
      ) : (
        <div
          id="terminal-scroll-area"
          className="flex-1 overflow-y-auto px-4 py-3 space-y-2 bg-[#0C0C0C]"
        >
          {entries.map((entry) => (
            <div key={entry.id} className="space-y-1">
              {entry.type === 'command' ? (
                <div className="space-y-0.5">
                  {/* Linux Kali-style top prompt line */}
                  <div className="flex items-center text-[13.5px] select-none">
                    <span className="text-[#38BDF8]">┌──(</span>
                    <span className="text-[#38BDF8] font-bold">{promptUsername}</span>
                    <span className="text-[#4ADE80] font-bold">㉿</span>
                    <span className="text-[#38BDF8] font-bold">terminal</span>
                    <span className="text-[#38BDF8]">)-[</span>
                    <span className="text-[#E0E0E0] font-bold">~</span>
                    <span className="text-[#38BDF8]">]</span>
                  </div>
                  <div className="flex items-center gap-1 text-[13.5px]">
                    <span className="text-[#38BDF8]">└─</span>
                    <span className="text-[#38BDF8] font-bold">$</span>
                    <span className="text-[#FFFFFF] ml-1">{entry.command}</span>
                  </div>
                </div>
              ) : (
                <div>{renderFormattedOutput(entry.content, entry.outputType)}</div>
              )}
            </div>
          ))}

          {/* Current Active Input Prompt Line */}
          <div id="active-prompt-container" className="space-y-0.5 pt-0.5">
            {interactiveMode === 'NONE' ? (
              <>
                {/* Top prompt line: ┌──(user㉿terminal)-[~] */}
                <div className="flex items-center text-[13.5px] select-none">
                  <span className="text-[#38BDF8]">┌──(</span>
                  <span className="text-[#38BDF8] font-bold">{promptUsername}</span>
                  <span className="text-[#4ADE80] font-bold">㉿</span>
                  <span className="text-[#38BDF8] font-bold">terminal</span>
                  <span className="text-[#38BDF8]">)-[</span>
                  <span className="text-[#E0E0E0] font-bold">~</span>
                  <span className="text-[#38BDF8]">]</span>
                </div>

                {/* Bottom prompt line: └─$ <input> */}
                <div className="flex items-center gap-1 text-[13.5px]">
                  <span className="text-[#38BDF8] select-none">└─</span>
                  <span className="text-[#38BDF8] font-bold select-none">$</span>
                  <div className="flex-1 flex items-center ml-1">
                    <input
                      id="terminal-cli-input"
                      ref={inputRef}
                      type="text"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={handleKeyDown}
                      autoFocus
                      spellCheck={false}
                      autoComplete="off"
                      className="w-full bg-transparent text-[#FFFFFF] font-mono text-[13.5px] outline-none caret-[#38BDF8]"
                    />
                  </div>
                </div>
              </>
            ) : (
              /* Interactive sub-prompt line (User ID: , Password: , etc.) */
              <div className="flex items-center gap-1 text-[13.5px]">
                <span className="text-[#38BDF8] font-bold select-none whitespace-pre">
                  {getInteractivePromptLabel()}
                </span>
                <div className="flex-1 flex items-center">
                  <input
                    id="terminal-interactive-input"
                    ref={inputRef}
                    type={isPasswordInput ? 'password' : 'text'}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    autoFocus
                    spellCheck={false}
                    autoComplete="off"
                    className="w-full bg-transparent text-[#FFFFFF] font-mono text-[13.5px] outline-none caret-[#38BDF8]"
                  />
                </div>
              </div>
            )}
          </div>

          <div ref={terminalEndRef} />
        </div>
      )}
    </div>
  );
};
