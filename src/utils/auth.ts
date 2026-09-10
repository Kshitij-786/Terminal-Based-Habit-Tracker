/**
 * User ID and Password Validation Utilities for HabitOS
 * Production authentication is strictly handled via Supabase Auth and PostgreSQL profiles.
 */

/**
 * Validate User ID according to criteria:
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

