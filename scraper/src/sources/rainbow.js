const { newContext, acceptCookies, normalizeNumber, fetchHotelStars, scrollToLoad } = require('../helpers');
const { fetchStarsMap } = require('../../../api/src/db');
const {
  extractPrice,
  extractLowest,
  extractReviews,
  extractMeal,
  normalizeCountry,
} = require('../parse');

const NAME = 'rainbow';

// Rainbow last-minute listing. Each offer card is wrapped by <a class="n-bloczek szukaj-bloczki__element">.
// The listing paginates via ?strona=N (default page shows 10 recommended cards).
const MAX_PAGES = 30;

async function scrapeRainbow() {
  const { browser, context } = await newContext({ viewport: { width: 1366, height: 2400 } });
  const page = await context.newPage();
  const offers = [];
  const seenHrefs = new Set();

  try {
    await page.goto('https://r.pl/last-minute', {
      waitUntil: 'load',
      timeout: 70000,
    });
    await page.waitForTimeout(2500);
    await acceptCookies(page);
    await page.waitForTimeout(2000);

    for (let p = 1; p <= MAX_PAGES; p++) {
      if (p > 1) {
        await page.goto(`https://r.pl/last-minute?strona=${p}`, { waitUntil: 'load', timeout: 60000 });
        await page.waitForTimeout(1500);
      }

      // Trigger lazy-loading of images: Rainbow swaps the 1x1 placeholder GIF in <img src>
      // for the real URL only when the image scrolls into the viewport.
      await scrollToLoad(page, 3, 800);
      await page.waitForTimeout(1200);

      const cards = await page.evaluate(() => {
        const out = [];
        const seen = new Set();
        const anchors = [...document.querySelectorAll('a.n-bloczek[href], [class*="szukaj-bloczki__element"][href]')];
        for (const a of anchors) {
          const href = a.getAttribute('href') || '';
          const card = a.querySelector('.r-bloczek, [class*="r-bloczek"]') || a;
          const text = (card.innerText || '').replace(/\s+/g, ' ').trim();
          if (!href || !/zł\/os/i.test(text) || seen.has(href)) continue;
          seen.add(href);
          const img = card.querySelector('img.r-bloczek__zdjecie, img[src*="grafiki.r.pl"]');
          const imgSrc = img?.getAttribute('src') || img?.getAttribute('data-src') || null;
          out.push({ href, text, imgSrc });
        }
        return out;
      });

      let newCount = 0;
      for (const c of cards) {
        if (seenHrefs.has(c.href)) continue;
        seenHrefs.add(c.href);
        newCount++;
        offers.push(parseCard(c));
      }
      console.log(`  [rainbow] strona ${p}: ${cards.length} kart (+${newCount} nowych)`);

      if (cards.length === 0) break;
      if (p >= MAX_PAGES) console.log(`  [rainbow] osiągnięto limit stron (${MAX_PAGES})`);
    }

    // Fill stars: reuse DB map when known, else visit detail page per unique hotel.
    let knownStars = globalThis.__starsMap;
    if (!knownStars) {
      globalThis.__starsMap = await fetchStarsMap().catch(() => new Map());
      knownStars = globalThis.__starsMap;
    }
    const starsByHotel = new Map();
    for (let i = 0; i < offers.length; i++) {
      const r = offers[i];
      const cached = knownStars.get(`${NAME}|${r.hotel_name}`);
      if (cached) { r.stars = cached; continue; }
      if (!r.url) { r.stars = null; continue; }
      if (!starsByHotel.has(r.hotel_name)) {
        starsByHotel.set(r.hotel_name, await fetchHotelStars(page, NAME, r.url));
      }
      r.stars = starsByHotel.get(r.hotel_name);
    }
  } finally {
    await browser.close();
  }
  return offers;
}

function parseCard(c) {
  const tx = c.text;

  // "… Wypoczynek • Grecja: Kreta - Chania Adele Beach 02.09.2026 (5 dni / 4 noclegi) …"
  const scope = (tx.match(/[•·]\s*(.+?)\s+\d{2}\.\d{2}\.\d{4}/) || [])[1]?.trim() || '';
  let country = null;
  let destination = scope || null;
  const colon = scope.indexOf(':');
  if (colon > 0) {
    country = normalizeCountry(scope.slice(0, colon).trim());
    destination = scope.slice(colon + 1).trim(); // region (may be empty)
  }

  // Hotel from URL slug: last path segment before '?', e.g. "adele-beach" -> "Adele Beach"
  const slug = (c.href.split('?')[0].split('/').filter(Boolean).pop() || '')
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (ch) => ch.toUpperCase());
  let hotel = slug || scope;
  if (/wczasy/i.test(hotel)) hotel = scope || c.text.slice(0, 40);

  // date: "02.09.2026" + nights "(8 dni / 7 noclegów)" -> end = start + nights days
  const dateMatch = tx.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  let startISO = null;
  let endISO = null;
  if (dateMatch) {
    const [, d, mo, y] = dateMatch;
    const start = new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d)));
    startISO = start.toISOString().slice(0, 10);
    const nightsMatch = tx.match(/(\d{1,2})\s*nocleg/);
    const nights = nightsMatch ? parseInt(nightsMatch[1], 10) : 7;
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + nights);
    endISO = end.toISOString().slice(0, 10);
  }

  // departure: "Katowice (+2)" / "Poznań"
  const depMatch = tx.match(/([A-Za-zĄĆĘŁŃÓŚŹŻąćęłńóśźż]{4,})\s*\(\+\d+\)/);
  const departure = depMatch ? depMatch[1].trim() : null;

  const price = extractPrice(tx);
  const lowest = extractLowest(tx) || extractRainbowLowest(tx);
  const nightsMatch = tx.match(/(\d{1,2})\s*nocleg/);

  return {
    source: NAME,
    source_id: c.href,
    hotel_name: hotel,
    destination,
    country,
    image_url: c.imgSrc && !/^data:/i.test(c.imgSrc) ? c.imgSrc : null,
    stars: null, // Rainbow doesn't expose hotel stars on listing cards
    departure_city: departure,
    price_per_person: price ? normalizeNumber(price) : null,
    currency: 'PLN',
    lowest_price_30d: lowest ? normalizeNumber(lowest) : null,
    start_date: startISO,
    end_date: endISO,
    nights: nightsMatch ? normalizeNumber(nightsMatch[1]) : null,
    meal_plan: extractMeal(tx),
    rating: (tx.match(/(\d(?:[.,]\d)?)\s*\/\s*6/) || [])[1]
      ? parseFloat(tx.match(/(\d(?:[.,]\d)?)\s*\/\s*6/)[1].replace(',', '.'))
      : null,
    reviews: normalizeNumber(extractReviews(tx)),
    url: `https://r.pl${c.href}`,
    description: tx,
    raw: JSON.stringify(c),
  };
}

// Rainbow places "Najniższa cena z 30 dni: 761 zł" (no "/os.")
function extractRainbowLowest(text) {
  const m = text.match(/Najniższa cena z 30 dni:\s*(\d{1,4}(?:[ \u00A0.]\d{3})*)\s*zł/i);
  return m ? m[1] : null;
}

module.exports = { NAME, scrapeRainbow };