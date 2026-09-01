const { newContext, acceptCookies, scrollToLoad, normalizeNumber } = require('../helpers');
const {
  extractPrice,
  extractReviews,
  extractNights,
  extractDeparture,
  extractMeal,
  extractDateRange,
} = require('../parse');

const NAME = 'tui';

// TUI exposes per-destination "oferty-last-minute" pages from its menu.
const TUI_URLS = [
  'https://www.tui.pl/wypoczynek/turcja/oferty-last-minute',
  'https://www.tui.pl/wypoczynek/grecja/oferty-last-minute',
  'https://www.tui.pl/wypoczynek/hiszpania/majorka/oferty-last-minute',
  'https://www.tui.pl/wypoczynek/egipt/oferty-last-minute',
  'https://www.tui.pl/wypoczynek/bulgaria/oferty-last-minute',
  'https://www.tui.pl/wypoczynek/wyspy-kanaryjskie/oferty-last-minute',
  'https://www.tui.pl/wypoczynek/cypr/oferty-last-minute',
  'https://www.tui.pl/wypoczynek/tunezja/oferty-last-minute',
];

function cleanTitle(raw) {
  if (!raw) return 'Brak nazwy';
  const lines = raw
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
  // Skip badge / meta lines; prefer the longest proper-looking line
  const badgeLike = /tylko w tui|last minute|oferta promowana|bestseller|dla dorosłych|opinii|dla osób|all inclusive|obiekt|office/i;
  const candidates = lines.filter((l) => /[A-Za-zĄĆĘŁŃÓŚŹŻ]/.test(l) && !badgeLike.test(l));
  // pick the longest candidate (usually the real hotel name)
  const chosen = candidates.length
    ? candidates.reduce((a, b) => (b.length > a.length ? b : a))
    : raw.split('\n')[0];
  return (chosen || 'Brak nazwy').trim();
}

async function scrapeSingleDestination(page, url) {
  await page.goto(url, { waitUntil: 'load', timeout: 70000 });
  await page.waitForTimeout(2500);
  await acceptCookies(page);
  await page.waitForTimeout(2500);
  await scrollToLoad(page, 3);

  const tiles = await page.evaluate(() => {
    const out = [];
    document.querySelectorAll('.offer-tile, [class*="offer-tile"]').forEach((tile) => {
      const text = (tile.innerText || '').replace(/\s+/g, ' ').trim();
      if (!text || text.length < 20) return;
      const href = tile.querySelector('a')?.getAttribute('href') || '';
      const title = tile.querySelector('h2, h3, [class*="title"]')?.innerText?.trim() || '';
      const priceEl = tile.querySelector('[class*="price"], [class*="Price"]');
      const priceText = priceEl ? priceEl.innerText.replace(/\s+/g, ' ').trim() : '';
      out.push({ title, href, text, priceText });
    });
    return out;
  });

    const result = [];
    const seen = new Set();
    for (const t of tiles) {
      const tx = t.text;
      // Prefer the element's own price, then fall back to parsing the tile text
      let priceStr = extractPrice(t.priceText) || extractPrice(tx);
      const [startISO, endISO] = extractDateRange(tx);
      // normalize title
      const rawTitle = t.title || tx;
      const hotelName = cleanTitle(rawTitle);
      // source_id: prefer href; if missing, hash of hotel+dates
      const sid = t.href || `tui:${hotelName}:${startISO}:${endISO}`;
      if (seen.has(sid)) continue;
      seen.add(sid);
      // Keep only real offers: must have either a price or a hotel link
      if (!priceStr && !t.href) continue;

    result.push({
      source: NAME,
      source_id: sid,
      hotel_name: hotelName,
      destination: (url.split('/')[4] || null),
      departure_city: extractDeparture(tx),
      price_per_person: priceStr ? normalizeNumber(priceStr) : null,
      currency: 'PLN',
      lowest_price_30d: null,
      start_date: startISO,
      end_date: endISO,
      nights: normalizeNumber(extractNights(tx)),
      meal_plan: extractMeal(tx),
      rating: (tx.match(/(\d(?:[.,]\d)?)\s*\/\s*5/) || [])[1]
        ? parseFloat(tx.match(/(\d(?:[.,]\d)?)\s*\/\s*5/)[1].replace(',', '.'))
        : null,
      reviews: normalizeNumber(extractReviews(tx)),
      url: t.href ? `https://www.tui.pl${t.href}` : url,
      description: tx,
      raw: JSON.stringify(t),
    });
  }
  return result;
}

async function scrapeTui() {
  const { browser, context } = await newContext();
  const page = await context.newPage();
  const all = [];
  try {
    for (const url of TUI_URLS) {
      try {
        const offers = await scrapeSingleDestination(page, url);
        console.log(`  [tui] ${url.split('/')[4]} -> ${offers.length} ofert`);
        all.push(...offers);
      } catch (e) {
        console.log(`  [tui] błąd dla ${url}: ${e.message}`);
      }
    }
  } finally {
    await browser.close();
  }
  return all;
}

module.exports = { NAME, scrapeTui };
