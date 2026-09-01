// Fix remaining Rainbow placeholder images by visiting each offer's detail page
// (which contains the real hotel image URL) and updating image_url.
const { chromium } = require('playwright');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || '';
if (!SUPABASE_URL || !SUPABASE_KEY) { console.error('Brak env'); process.exit(1); }
const client = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';

(async () => {
  const { data } = await client.from('offers')
    .select('id, url, hotel_name, source_id')
    .eq('source', 'rainbow');
  const rows = (data || []).filter(r => r.source_id && r.url);
  console.log('Rainbow ofert w bazie:', rows.length);

  // update only rows whose image_url is still a placeholder or missing
  const ids = rows.map(r => r.id);
  const { data: withImg } = await client.from('offers').select('id, image_url').in('id', ids);
  const has = new Map((withImg || []).map(r => [r.id, r.image_url]));
  const targets = rows.filter(r => {
    const u = has.get(r.id);
    return !u || /^data:/i.test(u);
  });
  console.log('Do naprawy (placeholder/null):', targets.length);

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ userAgent: UA, locale: 'pl-PL', viewport: { width: 1366, height: 2400 } });
  const page = await ctx.newPage();

  let updated = 0, unchanged = 0, failed = 0;
  for (let i = 0; i < targets.length; i++) {
    const r = targets[i];
    let imgUrl = null;
    try {
      await page.goto(r.url, { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => {});
      await page.waitForTimeout(1200);
      for (const sel of ['button:has-text("Akceptuję")', '#onetrust-accept-btn-handler']) {
        try { if (await page.locator(sel).first().isVisible({ timeout: 600 })) await page.locator(sel).first().click({ timeout: 1000 }); } catch {}
      }
      await page.waitForTimeout(500);
      imgUrl = await page.evaluate(() => {
        const imgs = [...document.querySelectorAll('img[src*="grafiki.r.pl"], [style*="grafiki.r.pl"]')];
        const src = (imgs[0] && (imgs[0].getAttribute('src') || imgs[0].getAttribute('data-src'))) || null;
        return src && !/^data:/i.test(src) ? src.split('&width=')[0] : null;
      });
    } catch { imgUrl = null; }
    if (imgUrl) {
      const { error } = await client.from('offers').update({ image_url: imgUrl }).eq('id', r.id);
      if (!error) updated++;
      else unchanged++;
    } else { failed++; }
    if ((i + 1) % 10 === 0 || i === targets.length - 1) {
      console.log(`  ${i + 1}/${targets.length} | zaktualizowano:${updated} bez zmian:${unchanged} błąd:${failed}`);
    }
  }
  await browser.close();
  console.log(`GOTOWE: aktualizacja=${updated}, bez zmian=${unchanged}, nieudane=${failed}`);
})().catch(e => { console.error('FATAL', e); process.exit(1); });