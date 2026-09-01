import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || '';

let client = null;

export function supabase() {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    throw new Error('Brak SUPABASE_URL / SUPABASE_KEY w zmiennych środowiskowych');
  }
  if (!client) {
    client = createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { persistSession: false },
    });
  }
  return client;
}