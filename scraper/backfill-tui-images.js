// Backfill TUI image URLs for offers missing them, by visiting each detail page
// and extracting an og:image / first img.
const { chromium } = require('playwright');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || '';
if (!SUPABASE_URL || !SUPABASE_KEY) { console.error('Brak env'); process.exit(1); }
const client = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';

(async () => {
  const { data } = await client.from('offers')
    .select('id, url, hotel_name')
    .eq('source', 'tui')
    .is('image_url', null)
    .not('url', 'is', null);
  const rows = data || [];
  console.log('TUI bez obrazka:', rows.length);
  if (!rows.length) return;

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ userAgent: UA, locale: 'pl-PL', viewport: { width: 1366, height: 1600 } });
  const page = await ctx.newPage();

  let updated = 0, failed = 0;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    let imgUrl = null;
    try {
      await page.goto(r.url, { waitUntil: 'domcontentloaded', timeout: 40000 }).catch(() => {});
      await page.waitForTimeout(1200);
      for (const sel of ['button:has-text("Akceptuj")', '#onetrust-accept-btn-handler']) {
        try { if (await page.locator(sel).first().isVisible({ timeout: 600 })) await page.locator(sel).first().click({ timeout: 1000 }); } catch {}
      }
      await page.waitForTimeout(400);
      imgUrl = await page.evaluate(() => {
        const og = document.querySelector('meta[property="og:image"]')?.getAttribute('content');
        if (og && /^https?:/.test(og)) return og;
        const img = document.querySelector('img[src*="redgalaxy"], img[src*="tui"], img[src*="cdn"]');
        const src = img?.getAttribute('src') || img?.getAttribute('data-src');
        if (src && /^https?:/.test(src)) return src;
        return null;
      });
    } catch { imgUrl = null; }
    if (imgUrl) {
      const { error } = await client.from('offers').update({ image_url: imgUrl }).eq('id', r.id);
      if (!error) updated++; else failed++;
    } else { failed++; }
    if ((i + 1) % 5 === 0 || i === rows.length - 1) {
      console.log(`  ${i + 1}/${rows.length} | zaktualizowano:${updated} brak:${failed}`);
    }
  }
  await browser.close();
  console.log(`GOTOWE: zaktualizowano ${updated}, brak ${failed}`);
})().catch(e => { console.error('FATAL', e); process.exit(1); });