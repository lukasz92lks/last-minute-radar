// Backfill hotel star ratings for TUI (from __NEXT_DATA__ "stars":N) and Rainbow (from
// "Kategoria lokalna" section — count of * or number words).
//
// Usage (from workspace root):
//   node scraper/backfill-stars.js [--limit=50]
// Reads existing offers where stars IS NULL, visits each UNIQUE (source, url) once,
// and updates matching rows in Supabase.
const { chromium } = require('playwright');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || '';
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Brak SUPABASE_URL / SUPABASE_SERVICE_KEY');
  process.exit(1);
}
const client = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';

// Rainbow: count "stars" in "Kategoria lokalna" section (e.g. "***" -> 3) or
// map Polish number words + "klucz(ów)" / "słońc" / "słoneczek".
const NUMBER_WORDS = {
  jeden: 1, jedno: 1, pierwszy: 1,
  dwa: 2, dwie: 2, drugi: 2,
  trzy: 3, trzeci: 3,
  cztery: 4, czwarty: 4,
  piec: 5, 'pięć': 5, piąty: 5, piaty: 5,
  szesc: 6, 'sześć': 6,
};

function rainbowStarsFromCategory(text) {
  if (!text) return null;
  const starCount = (text.match(/\*/g) || []).length;
  if (starCount > 0 && starCount <= 7) return starCount;
  const low = ' ' + text.toLowerCase().replace(/[.,\n\r\t]+/g, ' ') + ' ';
  for (const [word, n] of Object.entries(NUMBER_WORDS)) {
    if (new RegExp(`\\b${word}\\b`, 'i').test(low)) return n;
  }
  return null;
}

// One-page collection. Returns star count or null.
async function collect(page, { source, url }) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => {});
  await page.waitForTimeout(1200);
  for (const sel of ['button:has-text("Akceptuj")', 'button:has-text("Akceptuję")', '#onetrust-accept-btn-handler']) {
    try { if (await page.locator(sel).first().isVisible({ timeout: 600 })) await page.locator(sel).first().click({ timeout: 1000 }); } catch {}
  }
  await page.waitForTimeout(500);

  if (source === 'tui') {
    const res = await page.evaluate(() => {
      const next = document.getElementById('__NEXT_DATA__')?.textContent || '';
      const m = next.match(/"stars":\s*(\d)/);
      return m ? parseInt(m[1], 10) : null;
    }).catch(() => null);
    if (res && res >= 1 && res <= 7) return res;
    return null;
  }

  const cat = await page.evaluate(() => {
    const all = [...document.querySelectorAll('*')];
    const holder = all.find(el => (el.childElementCount < 40) && /kategoria lokalna/i.test(el.innerText || '') && (el.innerText || '').length < 300);
    return holder ? (holder.innerText || '') : '';
  }).catch(() => '');
  return rainbowStarsFromCategory(cat);
}

async function main() {
  const limitFlag = process.argv.find(a => a.startsWith('--limit='));
  const limit = limitFlag ? parseInt(limitFlag.split('=')[1], 10) : Infinity;

  const { data, error } = await client
    .from('offers')
    .select('id, source, url, hotel_name')
    .in('source', ['tui', 'rainbow'])
    .is('stars', null)
    .not('url', 'is', null);
  if (error) { console.error('Błąd odczytu:', error.message); process.exit(1); }

  const uniq = new Map();
  for (const r of data) {
    const key = `${r.source}|${r.url}`;
    if (!uniq.has(key)) uniq.set(key, []);
    uniq.get(key).push(r);
  }
  const rows = [...uniq.entries()];
  const toVisit = rows.slice(0, limit);
  console.log(`Do odwiedzenia: ${toVisit.length} / ${rows.length} unikalnych hoteli (${data.length} ofert)`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ userAgent: UA, locale: 'pl-PL', viewport: { width: 1366, height: 1600 } });
  const page = await context.newPage();

  let found = 0, fail = 0, updated = 0;
  const t0 = Date.now();
  for (let i = 0; i < toVisit.length; i++) {
    const [key, offers] = toVisit[i];
    const [source, url] = key.split('|');
    let stars = null;
    try {
      stars = await collect(page, { source, url });
    } catch { stars = null; }

    if (stars) {
      found++;
      for (const r of offers) {
        const { error: uErr } = await client.from('offers').update({ stars }).eq('id', r.id);
        if (!uErr) updated++;
      }
    } else {
      fail++;
    }

    if ((i + 1) % 20 === 0 || i === toVisit.length - 1) {
      const avg = ((Date.now() - t0) / (i + 1) / 1000).toFixed(1);
      console.log(`  ${i + 1}/${toVisit.length} | znaleziono:${found} brak:${fail} zaktualizowano:${updated} (${avg}s/ofertę)`);
    }
  }
  await browser.close();
  console.log(`GOTOWE: ${toVisit.length} wizyt, ${found} ze gwiazdkami, ${updated} wierszy zaktualizowanych.`);
}

main().catch(e => { console.error('FATAL', e); process.exit(1); });