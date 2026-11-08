// CivicSense AI - Supabase Client & Enterprise Cloud Storage Integration
// Connects to managed PostgreSQL & Supabase Auth when configured.
// Provides graceful fallback to local persistent sandbox storage when offline.

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL) ||
  (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_SUPABASE_URL) ||
  'https://tjuahmabbsfabazuvhdt.supabase.co';

const supabaseKey = 
  (typeof import.meta !== 'undefined' && (import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env?.VITE_SUPABASE_ANON_KEY)) ||
  (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) ||
  'sb_publishable_sg02_5KS7JzZFF5ZDN2b1g_NCyIiIov';

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    })
  : null;

/**
 * Diagnostic health check for Supabase connection.
 */
export async function checkSupabaseHealth() {
  if (!supabase) {
    return {
      connected: false,
      status: 'NOT_CONFIGURED',
      message: 'Supabase URL or Publishable Key is not configured.'
    };
  }

  try {
    const { data, error } = await supabase.from('incidents').select('count', { count: 'exact', head: true });
    if (error) {
      return {
        connected: false,
        status: 'TABLE_CHECK_FAILED',
        error: error.message
      };
    }
    return {
      connected: true,
      status: 'CONNECTED',
      url: supabaseUrl,
      table: 'incidents'
    };
  } catch (err) {
    return {
      connected: false,
      status: 'NETWORK_UNAVAILABLE',
      error: err.message
    };
  }
}

export default supabase;

