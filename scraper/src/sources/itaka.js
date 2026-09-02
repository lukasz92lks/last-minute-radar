const { newContext, acceptCookies, scrollToLoad, normalizeNumber } = require('../helpers');
const {
  extractPrice,
  extractLowest,
  extractReviews,
  extractNights,
  extractDeparture,
  extractMeal,
  extractDateRange,
  normalizeCountry,
  normalizeMeal,
} = require('../parse');

const NAME = 'itaka';

async function scrapeItaka() {
  const { browser, context } = await newContext();
  const page = await context.newPage();
  const offers = [];

  try {
    await page.goto('https://www.itaka.pl/last-minute/', {
      waitUntil: 'load',
      timeout: 60000,
    });
    await page.waitForTimeout(2500);
    await acceptCookies(page);
    await page.waitForTimeout(2500);
    await scrollToLoad(page, 5);

    const tiles = await page.evaluate(() => {
      const results = [];
      const anchors = [...document.querySelectorAll('a[href*="/wczasy/"]')];
      const seen = new Set();
      for (const a of anchors) {
        let tile = a;
        for (let i = 0; i < 4 && tile.parentElement; i++) {
          tile = tile.parentElement;
          if ((tile.innerText || '').includes('/os.')) break;
        }
        const text = (tile.innerText || '').replace(/\s+/g, ' ').trim();
        const href = a.getAttribute('href') || '';
        if (!text || !href || seen.has(href)) continue;
        seen.add(href);
        const img = tile.querySelector('img');
        const imgSrc = img?.getAttribute('src') || img?.getAttribute('data-src') || null;
        const stars = tile.querySelectorAll('i.icon-shape-star, [class*="star"]').length;
        results.push({ text, href, imgSrc, stars });
      }
      return results;
    });

    for (const t of tiles) {
      const tx = t.text;
      // destination: text before the word "Hotel"
      const destMatch = tx.match(/^([A-Za-zĄĆĘŁŃÓŚŹŻąćęłńóśźż ,-]+?)\s+Hotel\s/i);
      // fallback: leading "City, Region" before any other info
      const destMeta = tx.match(/^([A-Za-zĄĆĘŁŃÓŚŹŻąćęłńóśźż ,.\-]+?),?\s*Hotel/i)
        || tx.match(/^([A-Za-zĄĆĘŁŃÓŚŹŻąćęłńóśźż][A-Za-zĄĆĘŁŃÓŚŹŻąćęłńóśźż ,.-]+?)\s+\d\.\d\s*\/\s*6/i);
      let destination = destMatch ? destMatch[1].trim() : (destMeta ? destMeta[1].trim() : '');

      // hotel name: right after "Hotel " up to rating/dates
      const hotelMatch = tx.match(
        /Hotel\s+([A-Za-zĄĆĘŁŃÓŚŹŻąćęłńóśźż0-9'\-\.\(\)&,/\s]+?)(?=\s+\d\.\d\s*\/\s*6|\s+\d{1,2}\.\d{1,2}\.\d{4})/i
      );
      const hotelName = hotelMatch ? hotelMatch[1].trim() : destination.split(',').pop().trim();

      const [startISO, endISO] = extractDateRange(tx);

      offers.push({
        source: NAME,
        source_id: t.href,
        hotel_name: hotelName,
        destination,
        country: normalizeCountry(destination.split(',')[0].trim()),
        image_url: t.imgSrc || null,
        stars: t.stars > 0 ? t.stars : null,
        departure_city: extractDeparture(tx),
        price_per_person: normalizeNumber(extractPrice(tx)),
        currency: 'PLN',
        lowest_price_30d: normalizeNumber(extractLowest(tx)),
        start_date: startISO,
        end_date: endISO,
        nights: normalizeNumber(extractNights(tx)),
        meal_plan: normalizeMeal(extractMeal(tx)),
        rating: (tx.match(/(\d(?:\.\d)?)\s*\/\s*6/) || [])[1]
          ? parseFloat(tx.match(/(\d(?:\.\d)?)\s*\/\s*6/)[1])
          : null,
        reviews: normalizeNumber(extractReviews(tx)),
        url: `https://www.itaka.pl${t.href}`,
        description: tx,
        raw: JSON.stringify(t),
      });
    }
  } finally {
    await browser.close();
  }
  return offers;
}

module.exports = { NAME, scrapeItaka };
