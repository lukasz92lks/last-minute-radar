const { createClient } = require('@supabase/supabase-js');

// Supabase connection (project URL + anon key).
// Set SUPABASE_URL and SUPABASE_ANON_KEY in environment (use service_role key for writes from scraper/lambda).
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || '';

function supabase() {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    throw new Error('Brak SUPABASE_URL / SUPABASE_KEY w zmiennych środowiskowych');
  }
  return createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });
}

function normalizeNumber(v) {
  const n = parseInt(String(v).replace(/[^\d]/g, ''), 10);
  return Number.isFinite(n) ? n : null;
}

function normalizeDate(str) {
  if (!str) return null;
  const m = String(str).match(/(\d{1,2})[./-](\d{1,2})[./-](\d{4})/);
  if (!m) return null;
  return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
}

// upsert an offer (natural key = source + source_id)
async function upsertOffer(offer) {
  const client = supabase();
  const now = new Date().toISOString();
  const row = { ...offer, first_seen_at: now, last_seen_at: now };

  const { error } = await client
    .from('offers')
    .upsert(row, { onConflict: 'source,source_id', ignoreDuplicates: false });

  if (error) throw new Error(`Supabase upsert: ${error.message}`);
  return { row };
}

// upsert many offers in one request
async function upsertOffers(offers) {
  if (!offers.length) return 0;
  const client = supabase();
  const now = new Date().toISOString();
  const rows = offers.map((o) => ({ ...o, first_seen_at: now, last_seen_at: now }));

  const { error } = await client
    .from('offers')
    .upsert(rows, { onConflict: 'source,source_id', ignoreDuplicates: false });

  if (error) throw new Error(`Supabase upsert: ${error.message}`);
  return rows.length;
}

module.exports = { supabase, upsertOffer, upsertOffers, normalizeNumber, normalizeDate };
