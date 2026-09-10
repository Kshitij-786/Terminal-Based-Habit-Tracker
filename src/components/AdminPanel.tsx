import React, { useState, useEffect, useRef, useMemo, KeyboardEvent } from 'react';
import {
  AdminUser,
  AdminTask,
  AdminHabit,
  AdminHabitCompletion,
  AdminHabitStreak,
} from '../types/database';
import { adminService } from '../services/adminService';
import { generateHabitActivityCalendar, formatDateDisplay, getTodayString } from '../utils/date';
import {
  ShieldAlert,
  ArrowLeft,
  RefreshCw,
  X,
  Users,
  CheckSquare,
  Flame,
  Activity,
  Calendar,
  Clock,
  Terminal,
} from 'lucide-react';

interface AdminPanelProps {
  onExit: () => void;
  currentAdminUserId?: string;
}

type AdminView = 'users' | 'user_detail' | 'tasks' | 'habits' | 'streak';

export const AdminPanel: React.FC<AdminPanelProps> = ({ onExit, currentAdminUserId }) => {
  const [activeView, setActiveView] = useState<AdminView>('users');
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);

  const [userTasks, setUserTasks] = useState<AdminTask[]>([]);
  const [userHabits, setUserHabits] = useState<AdminHabit[]>([]);
  const [selectedHabit, setSelectedHabit] = useState<AdminHabit | null>(null);

  const [habitCompletions, setHabitCompletions] = useState<AdminHabitCompletion[]>([]);
  const [habitStreak, setHabitStreak] = useState<AdminHabitStreak | null>(null);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [unauthorized, setUnauthorized] = useState<boolean>(false);

  // Filter state for users & tasks
  const [userFilter, setUserFilter] = useState<string>('');
  const [taskFilter, setTaskFilter] = useState<'all' | 'todo' | 'done' | 'cancelled'>('all');

  // Command prompt state
  const [cliInput, setCliInput] = useState<string>('');
  const [cliFeedback, setCliFeedback] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Auto-focus CLI input on mount or view change
  useEffect(() => {
    inputRef.current?.focus();
  }, [activeView]);

  // Load Users on Mount
  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    setCliFeedback(null);

    // Re-verify admin authorization
    const adminCheck = await adminService.checkIsAdmin();
    if (adminCheck.error || !adminCheck.data) {
      setUnauthorized(true);
      setIsLoading(false);
      setErrorMessage('Admin access denied: Session invalid or unauthorized.');
      return;
    }

    const res = await adminService.listUsers();
    if (res.error) {
      setErrorMessage(res.error);
    } else {
      setUsers(res.data || []);
    }
    setIsLoading(false);
  };

  const selectUser = async (user: AdminUser) => {
    setSelectedUser(user);
    setSelectedHabit(null);
    setIsLoading(true);
    setErrorMessage(null);
    setCliFeedback(null);

    const [tasksRes, habitsRes] = await Promise.all([
      adminService.listUserTasks(user.id),
      adminService.listUserHabits(user.id),
    ]);

    if (tasksRes.error) {
      setErrorMessage(tasksRes.error);
    } else {
      setUserTasks(tasksRes.data || []);
    }

    if (habitsRes.error) {
      setErrorMessage(habitsRes.error);
    } else {
      setUserHabits(habitsRes.data || []);
    }

    setIsLoading(false);
    setActiveView('user_detail');
  };

  const selectHabit = async (habit: AdminHabit) => {
    setSelectedHabit(habit);
    setIsLoading(true);
    setErrorMessage(null);
    setCliFeedback(null);

    const [compsRes, streakRes] = await Promise.all([
      adminService.listHabitCompletions(habit.id),
      adminService.getHabitStreak(habit.id, undefined, habit.created_at),
    ]);

    if (compsRes.error) {
      setErrorMessage(compsRes.error);
    } else {
      setHabitCompletions(compsRes.data || []);
    }

    if (streakRes.error) {
      // Non-fatal, fallback to completions
    }
    setHabitStreak(
      streakRes.data || {
        currentStreak: 0,
        longestStreak: 0,
        totalCheckins: compsRes.data?.length || 0,
        completionRate: 0,
      }
    );

    setIsLoading(false);
    setActiveView('streak');
  };

  // Keyboard shortcut listener (Escape to exit or go back)
  useEffect(() => {
    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (activeView === 'streak') {
          setActiveView('habits');
        } else if (activeView === 'tasks' || activeView === 'habits') {
          setActiveView('user_detail');
        } else if (activeView === 'user_detail') {
          setActiveView('users');
        } else {
          onExit();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeView, onExit]);

  // Handle CLI command submission inside admin console
  const handleCommandSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const raw = cliInput.trim();
    if (!raw) return;
    setCliInput('');
    setCliFeedback(null);

    const parts = raw.split(/\s+/);
    const cmd = parts[0].toLowerCase();
    const arg = parts.slice(1).join(' ');

    if (cmd === 'exit' || cmd === 'quit' || cmd === 'q') {
      onExit();
      return;
    }

    if (cmd === 'refresh' || cmd === 'r') {
      if (activeView === 'users') {
        loadUsers();
      } else if (selectedUser) {
        selectUser(selectedUser);
      }
      setCliFeedback('Refreshed data.');
      return;
    }

    if (cmd === 'help' || cmd === '?') {
      setCliFeedback(
        'COMMANDS: users | select <#|user_id> | tasks | habits | streak <#|name> | back | refresh | exit'
      );
      return;
    }

    if (cmd === 'users' || cmd === 'ls') {
      setActiveView('users');
      return;
    }

    if (cmd === 'back' || cmd === 'cd' || cmd === '..') {
      if (activeView === 'streak') setActiveView('habits');
      else if (activeView === 'tasks' || activeView === 'habits') setActiveView('user_detail');
      else if (activeView === 'user_detail') setActiveView('users');
      else onExit();
      return;
    }

    if (cmd === 'select' || cmd === 'user' || cmd === 'open') {
      if (!arg) {
        setCliFeedback('Usage: select <# index or user_id>');
        return;
      }
      const num = parseInt(arg, 10);
      let target: AdminUser | undefined;
      if (!isNaN(num) && num >= 1 && num <= filteredUsers.length) {
        target = filteredUsers[num - 1];
      } else {
        target = users.find((u) => u.user_id.toLowerCase() === arg.toLowerCase());
      }

      if (target) {
        selectUser(target);
      } else {
        setCliFeedback(`User "${arg}" not found.`);
      }
      return;
    }

    if (cmd === 'tasks') {
      if (!selectedUser) {
        setCliFeedback('Please select a user first (e.g. select 1).');
        return;
      }
      setActiveView('tasks');
      return;
    }

    if (cmd === 'habits') {
      if (!selectedUser) {
        setCliFeedback('Please select a user first (e.g. select 1).');
        return;
      }
      setActiveView('habits');
      return;
    }

    if (cmd === 'streak') {
      if (!selectedUser) {
        setCliFeedback('Please select a user first (e.g. select 1).');
        return;
      }
      if (userHabits.length === 0) {
        setCliFeedback('Selected user has no habits.');
        return;
      }
      let targetHabit: AdminHabit | undefined;
      if (arg) {
        const num = parseInt(arg, 10);
        if (!isNaN(num) && num >= 1 && num <= userHabits.length) {
          targetHabit = userHabits[num - 1];
        } else {
          targetHabit = userHabits.find((h) => h.name.toLowerCase().includes(arg.toLowerCase()));
        }
      } else {
        targetHabit = userHabits[0];
      }

      if (targetHabit) {
        selectHabit(targetHabit);
      } else {
        setCliFeedback(`Habit "${arg}" not found.`);
      }
      return;
    }

    setCliFeedback(`Unknown admin command: "${cmd}". Type "help" for list.`);
  };

  // Filtered lists
  const filteredUsers = useMemo(() => {
    if (!userFilter.trim()) return users;
    const q = userFilter.toLowerCase().trim();
    return users.filter(
      (u) =>
        u.user_id.toLowerCase().includes(q) ||
        (u.display_name && u.display_name.toLowerCase().includes(q)) ||
        u.role.toLowerCase().includes(q)
    );
  }, [users, userFilter]);

  const filteredTasks = useMemo(() => {
    if (taskFilter === 'all') return userTasks;
    return userTasks.filter((t) => t.status === taskFilter);
  }, [userTasks, taskFilter]);

  // Habit history map for activity calendar heatmap
  const habitHistoryMap = useMemo(() => {
    const map: Record<string, boolean> = {};
    for (const c of habitCompletions) {
      if (c.completed_date) {
        map[c.completed_date] = true;
      }
    }
    return map;
  }, [habitCompletions]);

  if (unauthorized) {
    return (
      <div className="flex flex-col h-full w-full bg-[#0C0C0C] text-[#D1D5DB] font-mono p-6">
        <div className="border border-[#EF4444] bg-[#1F1315] p-6 max-w-2xl mx-auto my-auto rounded">
          <div className="flex items-center gap-3 text-[#EF4444] text-lg font-bold mb-3">
            <ShieldAlert className="w-6 h-6" />
            <span>Admin Access Denied</span>
          </div>
          <p className="text-[#9CA3AF] mb-4 text-sm">
            {errorMessage || 'You do not have administrator privileges to access this console.'}
          </p>
          <div className="text-xs text-[#6B7280] mb-6">
            Authentication verified via Database public.is_admin() RPC.
          </div>
          <button
            onClick={onExit}
            className="px-4 py-2 bg-[#EF4444] hover:bg-[#DC2626] text-white text-xs font-bold uppercase tracking-wider rounded transition-colors"
          >
            Return to Terminal
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={panelRef}
      id="admin-panel-container"
      className="flex flex-col h-full w-full bg-[#0C0C0C] text-[#D1D5DB] font-mono select-text"
      onClick={() => inputRef.current?.focus()}
    >
      {/* 1. Admin Header Bar */}
      <div className="h-10 bg-[#141414] border-b border-[#262626] flex items-center justify-between px-3 select-none shrink-0 text-xs">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-[#38BDF8] font-bold tracking-wider">
            <Terminal className="w-3.5 h-3.5" />
            HABITOS // ADMIN CONSOLE
          </span>
          <span className="text-[#2B2B2B]">|</span>
          <span className="flex items-center gap-1 text-[#4ADE80] text-[11px]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#4ADE80] animate-pulse"></span>
            ROOT PRIVILEGES ACTIVE
          </span>
          {currentAdminUserId && (
            <span className="text-[#6B7280] text-[11px]">({currentAdminUserId})</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadUsers}
            disabled={isLoading}
            className="flex items-center gap-1 px-2.5 py-1 bg-[#1F1F1F] hover:bg-[#2A2A2A] text-[#9CA3AF] hover:text-white rounded border border-[#333] transition-colors text-[11px]"
            title="Refresh database records"
          >
            <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin text-[#38BDF8]' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            onClick={onExit}
            className="flex items-center gap-1 px-2.5 py-1 bg-[#1F1F1F] hover:bg-[#EF4444] text-[#9CA3AF] hover:text-white rounded border border-[#333] transition-colors text-[11px]"
            title="Return to terminal shell (ESC)"
          >
            <X className="w-3 h-3" />
            <span>Exit Shell [ESC]</span>
          </button>
        </div>
      </div>

      {/* 2. Navigation Breadcrumb & Quick Tabs */}
      <div className="bg-[#111111] border-b border-[#222] px-3 py-1.5 flex flex-wrap items-center justify-between gap-2 text-xs select-none shrink-0">
        <div className="flex items-center gap-1.5 text-[11px]">
          <button
            onClick={() => setActiveView('users')}
            className={`hover:text-[#38BDF8] transition-colors ${
              activeView === 'users' ? 'text-[#38BDF8] font-bold' : 'text-[#888]'
            }`}
          >
            Admin Panel
          </button>
          <span className="text-[#444]">&gt;</span>

          <button
            onClick={() => setActiveView('users')}
            className={`hover:text-[#38BDF8] transition-colors ${
              activeView === 'users' ? 'text-[#38BDF8] font-bold' : 'text-[#888]'
            }`}
          >
            Users
          </button>

          {selectedUser && (
            <>
              <span className="text-[#444]">&gt;</span>
              <button
                onClick={() => setActiveView('user_detail')}
                className={`hover:text-[#38BDF8] transition-colors ${
                  activeView === 'user_detail' ? 'text-[#38BDF8] font-bold' : 'text-[#888]'
                }`}
              >
                [{selectedUser.user_id}]
              </button>
            </>
          )}

          {selectedUser && (activeView === 'tasks' || activeView === 'habits' || activeView === 'streak') && (
            <>
              <span className="text-[#444]">&gt;</span>
              <span className="text-[#E2E8F0] font-semibold uppercase">
                {activeView === 'tasks'
                  ? 'Tasks'
                  : activeView === 'habits'
                  ? 'Habits'
                  : selectedHabit
                  ? `Habits > ${selectedHabit.name} > Streak`
                  : 'Streak'}
              </span>
            </>
          )}
        </div>

        {/* Quick Tabs */}
        <div className="flex items-center gap-1 text-[11px]">
          <button
            onClick={() => setActiveView('users')}
            className={`px-2 py-0.5 rounded border transition-colors ${
              activeView === 'users'
                ? 'bg-[#1E293B] border-[#38BDF8] text-[#38BDF8] font-bold'
                : 'bg-[#181818] border-[#2B2B2B] text-[#888] hover:text-white'
            }`}
          >
            [1] Users ({users.length})
          </button>

          {selectedUser && (
            <>
              <button
                onClick={() => setActiveView('user_detail')}
                className={`px-2 py-0.5 rounded border transition-colors ${
                  activeView === 'user_detail'
                    ? 'bg-[#1E293B] border-[#38BDF8] text-[#38BDF8] font-bold'
                    : 'bg-[#181818] border-[#2B2B2B] text-[#888] hover:text-white'
                }`}
              >
                [2] User Details
              </button>
              <button
                onClick={() => setActiveView('tasks')}
                className={`px-2 py-0.5 rounded border transition-colors ${
                  activeView === 'tasks'
                    ? 'bg-[#1E293B] border-[#38BDF8] text-[#38BDF8] font-bold'
                    : 'bg-[#181818] border-[#2B2B2B] text-[#888] hover:text-white'
                }`}
              >
                [3] Tasks ({userTasks.length})
              </button>
              <button
                onClick={() => setActiveView('habits')}
                className={`px-2 py-0.5 rounded border transition-colors ${
                  activeView === 'habits'
                    ? 'bg-[#1E293B] border-[#38BDF8] text-[#38BDF8] font-bold'
                    : 'bg-[#181818] border-[#2B2B2B] text-[#888] hover:text-white'
                }`}
              >
                [4] Habits ({userHabits.length})
              </button>
            </>
          )}

          {selectedHabit && (
            <button
              onClick={() => setActiveView('streak')}
              className={`px-2 py-0.5 rounded border transition-colors ${
                activeView === 'streak'
                  ? 'bg-[#1E293B] border-[#38BDF8] text-[#38BDF8] font-bold'
                  : 'bg-[#181818] border-[#2B2B2B] text-[#888] hover:text-white'
              }`}
            >
              [5] Streaks
            </button>
          )}
        </div>
      </div>

      {/* 3. Main Content View Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {errorMessage && (
          <div className="p-3 border border-[#EF4444] bg-[#221315] text-[#FCA5A5] text-xs rounded flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-[#EF4444] shrink-0" />
              <span>{errorMessage}</span>
            </div>
            <button
              onClick={() => setErrorMessage(null)}
              className="text-[#EF4444] hover:text-white text-xs px-2"
            >
              ✕
            </button>
          </div>
        )}

        {isLoading && (
          <div className="flex items-center gap-2 text-xs text-[#38BDF8] py-4">
            <span className="w-2 h-2 rounded-full bg-[#38BDF8] animate-ping"></span>
            <span>Executing PostgreSQL Database RPC query...</span>
          </div>
        )}

        {/* VIEW 1: USERS LIST */}
        {activeView === 'users' && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-[#222]">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-[#38BDF8]" />
                <h2 className="text-sm font-bold text-white tracking-wide">
                  REGISTERED USERS ({filteredUsers.length})
                </h2>
                <span className="text-[11px] text-[#666]">
                  (loaded via public.admin_list_users())
                </span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Filter users..."
                  value={userFilter}
                  onChange={(e) => setUserFilter(e.target.value)}
                  className="bg-[#181818] border border-[#2E2E2E] px-2.5 py-1 text-xs text-white rounded focus:outline-none focus:border-[#38BDF8] w-48"
                />
              </div>
            </div>

            {filteredUsers.length === 0 && !isLoading ? (
              <div className="text-center py-8 text-[#666] text-xs border border-dashed border-[#222] rounded">
                No user profiles found in database.
              </div>
            ) : (
              <div className="border border-[#262626] rounded overflow-hidden">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-[#181818] text-[#888] border-b border-[#262626]">
                      <th className="py-2 px-3 font-semibold w-12 text-center">#</th>
                      <th className="py-2 px-3 font-semibold">USER ID</th>
                      <th className="py-2 px-3 font-semibold">DISPLAY NAME</th>
                      <th className="py-2 px-3 font-semibold w-24 text-center">ROLE</th>
                      <th className="py-2 px-3 font-semibold">REGISTERED</th>
                      <th className="py-2 px-3 font-semibold text-right">ACTION</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1F1F1F]">
                    {filteredUsers.map((u, index) => {
                      const isCurrentAdmin = u.user_id === currentAdminUserId;
                      const isSelected = selectedUser?.id === u.id;
                      return (
                        <tr
                          key={u.id}
                          onClick={() => selectUser(u)}
                          className={`hover:bg-[#1E293B]/40 cursor-pointer transition-colors ${
                            isSelected ? 'bg-[#1E293B]/60 text-white' : ''
                          }`}
                        >
                          <td className="py-2 px-3 text-center text-[#666]">[{index + 1}]</td>
                          <td className="py-2 px-3 font-bold text-[#38BDF8]">
                            {u.user_id}
                            {isCurrentAdmin && (
                              <span className="ml-1.5 text-[10px] text-[#4ADE80] font-normal">
                                (you)
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-[#A0AEC0]">
                            {u.display_name || <span className="text-[#555]">—</span>}
                          </td>
                          <td className="py-2 px-3 text-center">
                            {u.role === 'admin' ? (
                              <span className="px-1.5 py-0.5 bg-[#065F46] text-[#34D399] rounded text-[10px] font-bold uppercase">
                                admin
                              </span>
                            ) : (
                              <span className="px-1.5 py-0.5 bg-[#1F2937] text-[#9CA3AF] rounded text-[10px] uppercase">
                                user
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-[#888] text-[11px]">
                            {formatDateDisplay(u.created_at)}
                          </td>
                          <td className="py-2 px-3 text-right">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                selectUser(u);
                              }}
                              className="px-2 py-0.5 bg-[#1F1F1F] hover:bg-[#38BDF8] hover:text-black text-[#38BDF8] border border-[#38BDF8]/40 rounded text-[10px] transition-colors"
                            >
                              Inspect →
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <div className="text-[11px] text-[#666]">
              Tip: Click any user row or type <code className="text-[#38BDF8]">select &lt;#&gt;</code> in the prompt below.
            </div>
          </div>
        )}

        {/* VIEW 2: USER DETAIL OVERVIEW */}
        {activeView === 'user_detail' && selectedUser && (
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-[#222]">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setActiveView('users')}
                  className="p-1 text-[#888] hover:text-white hover:bg-[#222] rounded transition-colors"
                  title="Back to Users"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <h2 className="text-sm font-bold text-white tracking-wide">
                  USER PROFILE : [{selectedUser.user_id}]
                </h2>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => selectUser(selectedUser)}
                  className="px-2 py-1 bg-[#1F1F1F] hover:bg-[#2A2A2A] text-xs text-[#9CA3AF] hover:text-white rounded border border-[#333] transition-colors flex items-center gap-1"
                >
                  <RefreshCw className="w-3 h-3" />
                  Reload User Data
                </button>
              </div>
            </div>

            {/* Profile Overview Card */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="border border-[#262626] bg-[#141414] p-4 rounded space-y-2 text-xs">
                <div className="text-[#888] text-[11px] uppercase tracking-wider font-semibold border-b border-[#222] pb-1">
                  Identity & Authorization
                </div>
                <div className="flex justify-between py-1 border-b border-[#1E1E1E]">
                  <span className="text-[#888]">User Handle:</span>
                  <span className="text-[#38BDF8] font-bold">{selectedUser.user_id}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-[#1E1E1E]">
                  <span className="text-[#888]">Display Name:</span>
                  <span className="text-white">{selectedUser.display_name || '—'}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-[#1E1E1E]">
                  <span className="text-[#888]">System Role:</span>
                  <span>
                    {selectedUser.role === 'admin' ? (
                      <span className="px-1.5 py-0.5 bg-[#065F46] text-[#34D399] rounded text-[10px] font-bold uppercase">
                        admin
                      </span>
                    ) : (
                      <span className="px-1.5 py-0.5 bg-[#1F2937] text-[#9CA3AF] rounded text-[10px] uppercase">
                        user
                      </span>
                    )}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-[#1E1E1E]">
                  <span className="text-[#888]">Registration Date:</span>
                  <span className="text-[#CBD5E1]">{formatDateDisplay(selectedUser.created_at)}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-[#888]">Internal Profile UUID:</span>
                  <span className="text-[#64748B] text-[10px] select-all">{selectedUser.id}</span>
                </div>
              </div>

              {/* Quick Actions & Metric Summary */}
              <div className="border border-[#262626] bg-[#141414] p-4 rounded space-y-4 text-xs">
                <div className="text-[#888] text-[11px] uppercase tracking-wider font-semibold border-b border-[#222] pb-1">
                  Activity Overview
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div
                    onClick={() => setActiveView('tasks')}
                    className="p-3 bg-[#1A1A1A] hover:bg-[#222] border border-[#2C2C2C] rounded cursor-pointer transition-colors"
                  >
                    <div className="flex items-center justify-between text-[#888] text-[11px] mb-1">
                      <span>Tasks</span>
                      <CheckSquare className="w-3.5 h-3.5 text-[#38BDF8]" />
                    </div>
                    <div className="text-xl font-bold text-white">{userTasks.length}</div>
                    <div className="text-[10px] text-[#38BDF8] mt-1">Inspect Tasks →</div>
                  </div>

                  <div
                    onClick={() => setActiveView('habits')}
                    className="p-3 bg-[#1A1A1A] hover:bg-[#222] border border-[#2C2C2C] rounded cursor-pointer transition-colors"
                  >
                    <div className="flex items-center justify-between text-[#888] text-[11px] mb-1">
                      <span>Habits</span>
                      <Flame className="w-3.5 h-3.5 text-[#F59E0B]" />
                    </div>
                    <div className="text-xl font-bold text-white">{userHabits.length}</div>
                    <div className="text-[10px] text-[#F59E0B] mt-1">Inspect Habits →</div>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <button
                    onClick={() => setActiveView('tasks')}
                    className="flex-1 py-1.5 bg-[#1F2937] hover:bg-[#374151] text-[#38BDF8] text-xs font-semibold rounded border border-[#374151] transition-colors"
                  >
                    View Tasks Table
                  </button>
                  <button
                    onClick={() => setActiveView('habits')}
                    className="flex-1 py-1.5 bg-[#1F2937] hover:bg-[#374151] text-[#F59E0B] text-xs font-semibold rounded border border-[#374151] transition-colors"
                  >
                    View Habits & Streaks
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* VIEW 3: TASKS VIEW */}
        {activeView === 'tasks' && selectedUser && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-[#222]">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setActiveView('user_detail')}
                  className="p-1 text-[#888] hover:text-white hover:bg-[#222] rounded transition-colors"
                  title="Back to User Profile"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <h2 className="text-sm font-bold text-white tracking-wide">
                  USER TASKS : [{selectedUser.user_id}] ({filteredTasks.length})
                </h2>
                <span className="text-[11px] text-[#666]">
                  (loaded via public.admin_list_user_tasks)
                </span>
              </div>

              {/* Status Filter Tabs */}
              <div className="flex items-center gap-1 text-[11px]">
                {(['all', 'todo', 'done', 'cancelled'] as const).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setTaskFilter(filter)}
                    className={`px-2 py-0.5 rounded uppercase font-semibold border transition-colors ${
                      taskFilter === filter
                        ? 'bg-[#1E293B] border-[#38BDF8] text-[#38BDF8]'
                        : 'bg-[#181818] border-[#2C2C2C] text-[#888] hover:text-white'
                    }`}
                  >
                    {filter}
                  </button>
                ))}
              </div>
            </div>

            {filteredTasks.length === 0 && !isLoading ? (
              <div className="text-center py-8 text-[#666] text-xs border border-dashed border-[#222] rounded">
                No {taskFilter !== 'all' ? taskFilter : ''} tasks found for user [{selectedUser.user_id}].
              </div>
            ) : (
              <div className="border border-[#262626] rounded overflow-hidden">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-[#181818] text-[#888] border-b border-[#262626]">
                      <th className="py-2 px-3 font-semibold w-12 text-center">#</th>
                      <th className="py-2 px-3 font-semibold">TASK NAME</th>
                      <th className="py-2 px-3 font-semibold w-24 text-center">STATUS</th>
                      <th className="py-2 px-3 font-semibold">SCHEDULED DATE</th>
                      <th className="py-2 px-3 font-semibold">COMPLETION / CANCELLATION</th>
                      <th className="py-2 px-3 font-semibold w-20 text-center">PRIORITY</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1F1F1F]">
                    {filteredTasks.map((t, index) => {
                      return (
                        <tr key={t.id} className="hover:bg-[#1E293B]/30 transition-colors">
                          <td className="py-2 px-3 text-center text-[#666]">[{index + 1}]</td>
                          <td className="py-2 px-3 font-semibold text-white">{t.name}</td>
                          <td className="py-2 px-3 text-center">
                            {t.status === 'done' && (
                              <span className="px-1.5 py-0.5 bg-[#065F46] text-[#4ADE80] rounded text-[10px] font-bold">
                                [DONE]
                              </span>
                            )}
                            {t.status === 'todo' && (
                              <span className="px-1.5 py-0.5 bg-[#0C4A6E] text-[#38BDF8] rounded text-[10px] font-bold">
                                [TODO]
                              </span>
                            )}
                            {t.status === 'cancelled' && (
                              <span className="px-1.5 py-0.5 bg-[#262626] text-[#9CA3AF] rounded text-[10px] font-bold">
                                [CANCELLED]
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-[#CBD5E1]">{t.scheduled_date}</td>
                          <td className="py-2 px-3 text-[11px]">
                            {t.completed_at ? (
                              <span className="text-[#4ADE80]">
                                ✓ Completed: {formatDateDisplay(t.completed_at)}
                              </span>
                            ) : t.cancelled_at ? (
                              <span className="text-[#9CA3AF]">
                                ✗ Cancelled: {formatDateDisplay(t.cancelled_at)}
                              </span>
                            ) : (
                              <span className="text-[#555]">—</span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-center text-[10px]">
                            {t.priority === 'high' && (
                              <span className="text-[#EF4444] font-bold">[HIGH]</span>
                            )}
                            {t.priority === 'medium' && (
                              <span className="text-[#F59E0B] font-bold">[MED]</span>
                            )}
                            {t.priority === 'low' && (
                              <span className="text-[#60A5FA] font-bold">[LOW]</span>
                            )}
                            {!t.priority && <span className="text-[#555]">—</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* VIEW 4: HABITS VIEW */}
        {activeView === 'habits' && selectedUser && (
          <div className="space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-[#222]">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setActiveView('user_detail')}
                  className="p-1 text-[#888] hover:text-white hover:bg-[#222] rounded transition-colors"
                  title="Back to User Profile"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <h2 className="text-sm font-bold text-white tracking-wide">
                  USER HABITS : [{selectedUser.user_id}] ({userHabits.length})
                </h2>
                <span className="text-[11px] text-[#666]">
                  (loaded via public.admin_list_user_habits)
                </span>
              </div>
            </div>

            {userHabits.length === 0 && !isLoading ? (
              <div className="text-center py-8 text-[#666] text-xs border border-dashed border-[#222] rounded">
                No habits recorded for user [{selectedUser.user_id}].
              </div>
            ) : (
              <div className="border border-[#262626] rounded overflow-hidden">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-[#181818] text-[#888] border-b border-[#262626]">
                      <th className="py-2 px-3 font-semibold w-12 text-center">#</th>
                      <th className="py-2 px-3 font-semibold">HABIT NAME</th>
                      <th className="py-2 px-3 font-semibold w-24 text-center">STATUS</th>
                      <th className="py-2 px-3 font-semibold">CREATED DATE</th>
                      <th className="py-2 px-3 font-semibold text-right">ACTION</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1F1F1F]">
                    {userHabits.map((h, index) => {
                      const isArchived = Boolean(h.archived_at);
                      return (
                        <tr
                          key={h.id}
                          onClick={() => selectHabit(h)}
                          className="hover:bg-[#1E293B]/40 cursor-pointer transition-colors"
                        >
                          <td className="py-2 px-3 text-center text-[#666]">[{index + 1}]</td>
                          <td className="py-2 px-3 font-semibold text-[#F472B6]">{h.name}</td>
                          <td className="py-2 px-3 text-center">
                            {isArchived ? (
                              <span className="px-1.5 py-0.5 bg-[#262626] text-[#9CA3AF] rounded text-[10px]">
                                ARCHIVED
                              </span>
                            ) : (
                              <span className="px-1.5 py-0.5 bg-[#065F46] text-[#34D399] rounded text-[10px] font-bold">
                                ACTIVE
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-[#888] text-[11px]">
                            {formatDateDisplay(h.created_at)}
                          </td>
                          <td className="py-2 px-3 text-right">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                selectHabit(h);
                              }}
                              className="px-2 py-0.5 bg-[#1F1F1F] hover:bg-[#F59E0B] hover:text-black text-[#F59E0B] border border-[#F59E0B]/40 rounded text-[10px] transition-colors"
                            >
                              Inspect Streak & Graph →
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <div className="text-[11px] text-[#666]">
              Tip: Click any habit row or type <code className="text-[#38BDF8]">streak &lt;#&gt;</code> to inspect completion history and streaks.
            </div>
          </div>
        )}

        {/* VIEW 5: HABIT DETAILS / STREAKS & HEATMAP */}
        {activeView === 'streak' && selectedUser && selectedHabit && (
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-[#222]">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setActiveView('habits')}
                  className="p-1 text-[#888] hover:text-white hover:bg-[#222] rounded transition-colors"
                  title="Back to Habits"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <h2 className="text-sm font-bold text-white tracking-wide">
                  HABIT STREAK & HEATMAP : [{selectedHabit.name}]
                </h2>
                <span className="text-[11px] text-[#666]">
                  (user: {selectedUser.user_id})
                </span>
              </div>
              <button
                onClick={() => selectHabit(selectedHabit)}
                className="px-2 py-1 bg-[#1F1F1F] hover:bg-[#2A2A2A] text-xs text-[#9CA3AF] hover:text-white rounded border border-[#333] transition-colors flex items-center gap-1"
              >
                <RefreshCw className="w-3 h-3" />
                Reload Streaks
              </button>
            </div>

            {/* Streak Metrics Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="border border-[#262626] bg-[#141414] p-3 rounded">
                <div className="flex items-center justify-between text-[#888] text-[11px] mb-1">
                  <span>Current Streak</span>
                  <Flame className="w-3.5 h-3.5 text-[#4ADE80]" />
                </div>
                <div className="text-2xl font-bold text-[#4ADE80]">
                  {habitStreak?.currentStreak ?? 0}{' '}
                  <span className="text-xs font-normal text-[#888]">days</span>
                </div>
              </div>

              <div className="border border-[#262626] bg-[#141414] p-3 rounded">
                <div className="flex items-center justify-between text-[#888] text-[11px] mb-1">
                  <span>Longest Streak</span>
                  <Activity className="w-3.5 h-3.5 text-[#38BDF8]" />
                </div>
                <div className="text-2xl font-bold text-[#38BDF8]">
                  {habitStreak?.longestStreak ?? 0}{' '}
                  <span className="text-xs font-normal text-[#888]">days</span>
                </div>
              </div>

              <div className="border border-[#262626] bg-[#141414] p-3 rounded">
                <div className="flex items-center justify-between text-[#888] text-[11px] mb-1">
                  <span>Total Check-ins</span>
                  <Calendar className="w-3.5 h-3.5 text-[#F59E0B]" />
                </div>
                <div className="text-2xl font-bold text-[#F59E0B]">
                  {habitCompletions.length}{' '}
                  <span className="text-xs font-normal text-[#888]">days</span>
                </div>
              </div>

              <div className="border border-[#262626] bg-[#141414] p-3 rounded">
                <div className="flex items-center justify-between text-[#888] text-[11px] mb-1">
                  <span>Completion Rate</span>
                  <Clock className="w-3.5 h-3.5 text-[#A78BFA]" />
                </div>
                <div className="text-2xl font-bold text-[#A78BFA]">
                  {habitStreak?.completionRate ?? 0}%
                </div>
              </div>
            </div>

            {/* Terminal Activity Heatmap */}
            <div className="border border-[#262626] bg-[#141414] p-4 rounded space-y-2">
              <div className="flex items-center justify-between text-xs border-b border-[#222] pb-1 text-[#888]">
                <span className="font-semibold uppercase tracking-wider text-[11px]">
                  4-Week Activity Heatmap (Terminal Matrix)
                </span>
                <span className="text-[10px] text-[#666]">
                  Legend: █ Complete | ▒ Today Pending | ░ Missed | · Future
                </span>
              </div>
              <pre className="font-mono text-xs leading-relaxed text-[#4ADE80] bg-[#0A0A0A] p-3 rounded border border-[#1F1F1F] overflow-x-auto select-none">
                {generateHabitActivityCalendar(habitHistoryMap, 4)}
              </pre>
            </div>

            {/* Completion History Log */}
            <div className="border border-[#262626] bg-[#141414] p-4 rounded space-y-2 text-xs">
              <div className="flex items-center justify-between border-b border-[#222] pb-1 text-[#888]">
                <span className="font-semibold uppercase tracking-wider text-[11px]">
                  Completion History Log ({habitCompletions.length} records)
                </span>
                <span className="text-[10px] text-[#666]">
                  (loaded via public.admin_list_habit_completions)
                </span>
              </div>

              {habitCompletions.length === 0 ? (
                <div className="text-[#666] py-3 text-center">
                  No check-ins recorded yet for this habit.
                </div>
              ) : (
                <div className="max-h-48 overflow-y-auto space-y-1 divide-y divide-[#1A1A1A]">
                  {habitCompletions.map((comp) => {
                    const isToday = comp.completed_date === getTodayString();
                    return (
                      <div
                        key={comp.id}
                        className="flex items-center justify-between py-1 px-1 text-xs hover:bg-[#1A1A1A]"
                      >
                        <span className="text-[#4ADE80] font-semibold flex items-center gap-2">
                          <span>[✓]</span>
                          <span>{comp.completed_date}</span>
                          {isToday && (
                            <span className="text-[10px] text-[#FBBF24] font-normal">(Today)</span>
                          )}
                        </span>
                        <span className="text-[#666] text-[11px]">
                          Recorded: {formatDateDisplay(comp.created_at)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 4. Interactive Bottom Command Line */}
      <div className="border-t border-[#262626] bg-[#121212] p-2 select-none shrink-0">
        {cliFeedback && (
          <div className="text-xs text-[#FBBF24] px-2 pb-1 font-mono">{cliFeedback}</div>
        )}
        <form onSubmit={handleCommandSubmit} className="flex items-center gap-2 px-1">
          <span className="text-[#4ADE80] text-xs font-bold whitespace-nowrap">
            admin@habitos-panel:
            <span className="text-[#38BDF8]">
              {activeView === 'users'
                ? '/users'
                : activeView === 'user_detail'
                ? `/users/${selectedUser?.user_id}`
                : activeView === 'tasks'
                ? `/users/${selectedUser?.user_id}/tasks`
                : activeView === 'habits'
                ? `/users/${selectedUser?.user_id}/habits`
                : `/users/${selectedUser?.user_id}/habits/${selectedHabit?.name}`}
            </span>
            #
          </span>
          <input
            ref={inputRef}
            type="text"
            value={cliInput}
            onChange={(e) => setCliInput(e.target.value)}
            placeholder="Type 'help', 'select <#>', 'tasks', 'habits', 'streak <#>', 'back', or 'exit'"
            className="flex-1 bg-transparent text-xs text-white focus:outline-none font-mono caret-[#38BDF8]"
            autoComplete="off"
            spellCheck={false}
          />
          <span className="text-[10px] text-[#555] whitespace-nowrap">
            [ESC to go back/exit]
          </span>
        </form>
      </div>
    </div>
  );
};
