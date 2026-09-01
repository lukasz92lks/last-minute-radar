// Backfill Rainbow image URLs: scroll each last-minute page to trigger lazy-load,
// then update offers whose image_url is a placeholder data: GIF or missing.
//
// Usage (from workspace root, with SUPABASE env vars):
//   node scraper/backfill-rainbow-images.js
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
const MAX_PAGES = 30;

// Existing rainbow offers: href slug -> row, so we can match scraped cards to rows.
async function loadExisting() {
  const { data, error } = await client
    .from('offers')
    .select('id, url, hotel_name, image_url, source_id')
    .eq('source', 'rainbow');
  if (error) throw new Error(error.message);
  const byHref = new Map();
  for (const r of data || []) {
    const href = (r.source_id || r.url || '');
    byHref.set(href, r);
  }
  return byHref;
}

(async () => {
  const byHref = await loadExisting();
  console.log('Rainbow ofert w bazie:', byHref.size);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ userAgent: UA, locale: 'pl-PL', viewport: { width: 1366, height: 900 } });
  const page = await context.newPage();

  await page.goto('https://r.pl/last-minute', { waitUntil: 'load', timeout: 70000 }).catch(e => console.log('goto', e.message));
  await page.waitForTimeout(2500);
  for (const sel of ['button:has-text("Akceptuję")', '#onetrust-accept-btn-handler']) {
    try { if (await page.locator(sel).first().isVisible({ timeout: 800 })) await page.locator(sel).first().click({ timeout: 1500 }); } catch {}
  }
  await page.waitForTimeout(1000);

  let matched = 0, updated = 0, skipped = 0;

  for (let p = 1; p <= MAX_PAGES; p++) {
    if (p > 1) {
      await page.goto(`https://r.pl/last-minute?strona=${p}`, { waitUntil: 'load', timeout: 60000 });
      await page.waitForTimeout(1500);
    }
    // scroll to trigger lazy image loading
    for (let r = 0; r < 4; r++) {
      await page.evaluate(async () => { for (let y = 0; y < 4000; y += 600) { window.scrollBy(0, 600); await new Promise(res => setTimeout(res, 80)); } });
      await page.waitForTimeout(800);
    }
    await page.waitForTimeout(1200);

    const cards = await page.evaluate(() => {
      const out = [];
      const anchors = [...document.querySelectorAll('a.n-bloczek[href], [class*="szukaj-bloczki__element"][href]')];
      for (const a of anchors) {
        const href = a.getAttribute('href') || '';
        const card = a.querySelector('.r-bloczek, [class*="r-bloczek"]') || a;
        const img = card.querySelector('img.r-bloczek__zdjecie, img[src*="grafiki.r.pl"]');
        const src = img?.getAttribute('src') || img?.getAttribute('data-src') || null;
        if (!href || !src || /^data:/i.test(src)) continue;
        out.push({ href, src });
      }
      return out;
    });

    for (const c of cards) {
      const row = byHref.get(c.href);
      if (!row) { skipped++; continue; }
      matched++;
      if (row.image_url === c.src) continue;
      const { error } = await client.from('offers').update({ image_url: c.src }).eq('id', row.id);
      if (!error) updated++;
    }
    console.log(`strona ${p}: ${cards.length} kart z URL, łącznie zaktualizowano ${updated}`);
    if (cards.length === 0) break;
  }

  await browser.close();
  console.log(`GOTOWE: dopasowano ${matched}, zaktualizowano ${updated}, pominieto ${skipped} (brak w bazie)`);
})().catch(e => { console.error('FATAL', e); process.exit(1); });