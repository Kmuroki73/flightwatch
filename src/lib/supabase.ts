import { createClient } from '@supabase/supabase-js';
import { envValue } from '@/lib/runtimeConfig';

const supabaseUrl = envValue('VITE_SUPABASE_URL');
const supabaseAnonKey = envValue('VITE_SUPABASE_ANON_KEY');

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);
export const supabase = supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;
