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
// When a scrape cannot determine stars (null) we omit the field so the upsert
// does not overwrite stars already known from the backfill/detail pages.
function scrubOffer(row) {
  const out = { ...row };
  if (out.stars == null) delete out.stars;
  return out;
}

async function upsertOffer(offer) {
  const client = supabase();
  const now = new Date().toISOString();
  const row = { ...scrubOffer(offer), first_seen_at: now, last_seen_at: now };

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
  const rows = offers.map((o) => ({ ...scrubOffer(o), first_seen_at: now, last_seen_at: now }));

  const { error } = await client
    .from('offers')
    .upsert(rows, { onConflict: 'source,source_id', ignoreDuplicates: false });

  if (error) throw new Error(`Supabase upsert: ${error.message}`);
  return rows.length;
}

// Preload known stars per (source, hotel_name) so scrapers can reuse them
// without re-visiting every detail page.
async function fetchStarsMap() {
  const client = supabase();
  const { data, error } = await client
    .from('offers')
    .select('source, hotel_name, stars')
    .not('stars', 'is', null);
  if (error) throw new Error(`Supabase fetchStarsMap: ${error.message}`);
  const map = new Map();
  for (const r of data || []) map.set(`${r.source}|${r.hotel_name}`, r.stars);
  return map;
}

// Remove offers that have not been seen during the last scrape cycle (they have
// disappeared from the listings). Keeps the table from growing with stale rows.
async function pruneOffers(sources, maxStaleHours = 6) {
  const client = supabase();
  const cutoff = new Date(Date.now() - maxStaleHours * 3600 * 1000).toISOString();
  const { count, error } = await client
    .from('offers')
    .delete({ count: 'exact' })
    .in('source', sources)
    .lt('last_seen_at', cutoff);
  if (error) throw new Error(`Supabase prune: ${error.message}`);
  return count || 0;
}

module.exports = { supabase, upsertOffer, upsertOffers, normalizeNumber, normalizeDate, fetchStarsMap, pruneOffers };
