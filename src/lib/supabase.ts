import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Read credentials strictly from Vite or process environment variables (never hardcoded)
const rawUrl =
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_SUPABASE_URL) ||
  (typeof process !== 'undefined' && process.env && process.env.VITE_SUPABASE_URL) ||
  '';
const rawKey =
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY) ||
  (typeof process !== 'undefined' && process.env && process.env.VITE_SUPABASE_PUBLISHABLE_KEY) ||
  '';

// Sanitize URL: normalize trailing slashes and remove accidental /rest/v1/ suffix
function sanitizeSupabaseUrl(url: string): string {
  if (!url) return '';
  return url
    .trim()
    .replace(/\/rest\/v1\/?$/, '')
    .replace(/\/+$/, '');
}

export const SUPABASE_URL = sanitizeSupabaseUrl(rawUrl);
export const SUPABASE_PUBLISHABLE_KEY = rawKey.trim();

export const isSupabaseConfigured = (): boolean => {
  return Boolean(
    SUPABASE_URL &&
    SUPABASE_PUBLISHABLE_KEY &&
    SUPABASE_URL.startsWith('http') &&
    SUPABASE_PUBLISHABLE_KEY.length > 10
  );
};

// Singleton Supabase Client instance
export const supabase: SupabaseClient = createClient(
  SUPABASE_URL || 'https://placeholder.supabase.co',
  SUPABASE_PUBLISHABLE_KEY || 'placeholder-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }
);
