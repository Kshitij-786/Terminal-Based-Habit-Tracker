import { Task, Habit } from '../types';
import { getInitialTasks, getInitialHabits } from './storage';

export interface MockUserAccount {
  userId: string; // normalized lowercase
  displayUserId: string; // original casing e.g. "shadow"
  mockPassword: string; // temporary mock credential (to be replaced by backend)
  createdAt: string;
  tasks: Task[];
  habits: Habit[];
}

const MOCK_USERS_KEY = 'habitos_mock_accounts_v3';
const MOCK_SESSION_KEY = 'habitos_mock_session_user';

/**
 * Validate User ID according to frontend criteria:
 * - not empty
 * - 3 to 20 characters
 * - alphanumeric, underscore, hyphen
 * - no spaces
 */
export function validateUserId(rawId: string): { valid: boolean; error?: string } {
  if (!rawId || typeof rawId !== 'string') {
    return { valid: false, error: 'ERROR: User ID cannot be empty.' };
  }
  const trimmed = rawId.trim();
  if (!trimmed) {
    return { valid: false, error: 'ERROR: User ID cannot be empty.' };
  }
  if (/\s/.test(trimmed)) {
    return { valid: false, error: 'ERROR: Invalid User ID.' };
  }
  if (trimmed.length < 3 || trimmed.length > 20) {
    return { valid: false, error: 'ERROR: Invalid User ID.' };
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(trimmed)) {
    return { valid: false, error: 'ERROR: Invalid User ID.' };
  }
  return { valid: true };
}

/**
 * Validate Password:
 * - not empty
 * - matches confirm password if provided
 */
export function validatePassword(password: string, confirmPassword?: string): { valid: boolean; error?: string } {
  if (!password || password.trim() === '') {
    return { valid: false, error: 'ERROR: Password cannot be empty.' };
  }
  if (confirmPassword !== undefined && password !== confirmPassword) {
    return { valid: false, error: 'ERROR: Passwords do not match.' };
  }
  return { valid: true };
}

/**
 * Retrieve all registered mock accounts
 */
export function getAllMockAccounts(): Record<string, MockUserAccount> {
  try {
    const raw = localStorage.getItem(MOCK_USERS_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    console.error('Error loading mock user accounts', e);
  }
  return {};
}

/**
 * Persist all mock accounts
 */
function saveAllMockAccounts(accounts: Record<string, MockUserAccount>) {
  try {
    localStorage.setItem(MOCK_USERS_KEY, JSON.stringify(accounts));
  } catch (e) {
    console.error('Error saving mock user accounts', e);
  }
}

/**
 * Case-insensitive search for a mock account
 */
export function findMockAccount(userId: string): MockUserAccount | null {
  if (!userId) return null;
  const normalized = userId.trim().toLowerCase();
  const accounts = getAllMockAccounts();
  return accounts[normalized] || null;
}

/**
 * Register a new mock user account
 */
export function createMockAccount(
  rawUserId: string,
  rawPassword: string
): { success: boolean; error?: string; account?: MockUserAccount } {
  const userValidation = validateUserId(rawUserId);
  if (!userValidation.valid) {
    return { success: false, error: userValidation.error };
  }

  const passValidation = validatePassword(rawPassword);
  if (!passValidation.valid) {
    return { success: false, error: passValidation.error };
  }

  const normalized = rawUserId.trim().toLowerCase();
  const accounts = getAllMockAccounts();

  if (accounts[normalized]) {
    // Preserve existing local tasks/habits for migration and update password
    accounts[normalized].mockPassword = rawPassword;
    saveAllMockAccounts(accounts);
    return { success: true, account: accounts[normalized] };
  }

  const displayUserId = rawUserId.trim();
  const newAccount: MockUserAccount = {
    userId: normalized,
    displayUserId,
    mockPassword: rawPassword,
    createdAt: new Date().toISOString(),
    tasks: getInitialTasks(),
    habits: getInitialHabits(),
  };

  accounts[normalized] = newAccount;
  saveAllMockAccounts(accounts);

  return { success: true, account: newAccount };
}

/**
 * Authenticate against mock user store
 * Does NOT reveal whether User ID or password specifically was wrong
 */
export function verifyMockCredentials(
  rawUserId: string,
  rawPassword: string
): { success: boolean; error?: string; account?: MockUserAccount } {
  if (!rawUserId || !rawPassword) {
    return { success: false, error: 'ERROR: Invalid User ID or password.' };
  }

  const normalized = rawUserId.trim().toLowerCase();
  const accounts = getAllMockAccounts();
  const account = accounts[normalized];

  if (!account || account.mockPassword !== rawPassword) {
    return { success: false, error: 'ERROR: Invalid User ID or password.' };
  }

  return { success: true, account };
}

/**
 * Update and persist tasks and habits for a specific user
 */
export function updateMockAccountData(
  userId: string,
  tasks: Task[],
  habits: Habit[]
): MockUserAccount | null {
  const normalized = userId.trim().toLowerCase();
  const accounts = getAllMockAccounts();
  const account = accounts[normalized];
  if (!account) return null;

  account.tasks = tasks;
  account.habits = habits;
  accounts[normalized] = account;
  saveAllMockAccounts(accounts);
  return account;
}

/**
 * Session persistence (frontend mock state)
 */
export function getActiveSessionUserId(): string | null {
  try {
    return sessionStorage.getItem(MOCK_SESSION_KEY) || null;
  } catch {
    return null;
  }
}

export function setActiveSessionUserId(userId: string | null): void {
  try {
    if (userId) {
      sessionStorage.setItem(MOCK_SESSION_KEY, userId.trim().toLowerCase());
    } else {
      sessionStorage.removeItem(MOCK_SESSION_KEY);
    }
  } catch (e) {
    console.error('Error setting session user ID', e);
  }
}

export function clearActiveSession(): void {
  try {
    sessionStorage.removeItem(MOCK_SESSION_KEY);
  } catch (e) {
    console.error('Error clearing session', e);
  }
}
