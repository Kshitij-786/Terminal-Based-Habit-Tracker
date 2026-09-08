import React, { useState, useEffect } from 'react';
import { UserState, Task, Habit } from './types';
import { TerminalWindow } from './components/TerminalWindow';
import { taskService, habitService, authService, profileService } from './services';
import { supabase, isSupabaseConfigured } from './lib/supabase';

export default function App() {
  const [isRestoring, setIsRestoring] = useState<boolean>(isSupabaseConfigured());
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [currentUser, setCurrentUser] = useState<UserState | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function restoreSession() {
      if (!isSupabaseConfigured()) {
        if (isMounted) {
          setIsAuthenticated(false);
          setCurrentUser(null);
          setIsRestoring(false);
        }
        return;
      }

      try {
        const session = await authService.getSession();
        if (session && session.user && isMounted) {
          const user = session.user;
          const cliUserId =
            user.user_metadata?.cli_user_id ||
            user.user_metadata?.display_name ||
            user.email?.split('@')[0] ||
            'user';

          // Ensure profile exists in profiles table
          try {
            const currentProfile = await profileService.getCurrentProfile();
            if (currentProfile.error) {
              throw new Error(currentProfile.error);
            }
            if (!currentProfile.data) {
              const upsertRes = await profileService.upsertProfile({
                id: user.id,
                user_id: cliUserId,
                display_name: cliUserId,
              });
              if (upsertRes.error) {
                throw new Error(upsertRes.error);
              }
            }
          } catch (profileErr) {
            console.error('Failed to initialize or restore user profile.');
            if (isMounted) {
              setIsAuthenticated(false);
              setCurrentUser(null);
            }
            return;
          }

          let tasks: Task[] = [];
          let habits: Habit[] = [];
          try {
            const [tasksRes, habitsRes] = await Promise.all([
              taskService.fetchTasks(),
              habitService.fetchHabits(),
            ]);
            if (tasksRes.data) tasks = tasksRes.data;
            if (habitsRes.data) habits = habitsRes.data;
          } catch (e) {
            console.warn('Error fetching Supabase tasks/habits during session restore:', e);
          }

          if (isMounted) {
            const userState: UserState = {
              userId: cliUserId,
              userName: cliUserId,
              tasks,
              habits,
              createdAt: user.created_at || new Date().toISOString(),
            };
            setIsAuthenticated(true);
            setCurrentUser(userState);
          }
        } else if (isMounted) {
          // No active Supabase session on reload
          setIsAuthenticated(false);
          setCurrentUser(null);
        }
      } catch (err) {
        console.error('Error restoring Supabase session on mount:', err);
        if (isMounted) {
          setIsAuthenticated(false);
          setCurrentUser(null);
        }
      } finally {
        if (isMounted) {
          setIsRestoring(false);
        }
      }
    }

    restoreSession();

    // Listen to Supabase auth state changes
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!isMounted) return;
      if (event === 'SIGNED_OUT' || !session) {
        setIsAuthenticated(false);
        setCurrentUser(null);
      } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        const user = session.user;
        const cliUserId =
          user.user_metadata?.cli_user_id ||
          user.user_metadata?.display_name ||
          user.email?.split('@')[0] ||
          'user';
        setIsAuthenticated(true);
      }
    });

    return () => {
      isMounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  const handleUserUpdate = (updated: UserState) => {
    setCurrentUser(updated);
  };

  const handleLoginSuccess = (userState: UserState) => {
    setCurrentUser(userState);
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setCurrentUser(null);
    authService.signOut().catch(() => {});
  };

  if (isRestoring) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#0A0D12] text-[#94A3B8] font-mono text-sm">
        <div className="flex items-center space-x-2">
          <span className="w-2 h-2 rounded-full bg-[#4ADE80] animate-pulse"></span>
          <span>Restoring terminal session...</span>
        </div>
      </div>
    );
  }

  return (
    <TerminalWindow
      currentUser={currentUser}
      isAuthenticated={isAuthenticated}
      onUserUpdate={handleUserUpdate}
      onLoginSuccess={handleLoginSuccess}
      onLogout={handleLogout}
    />
  );
}

