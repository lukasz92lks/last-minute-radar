const { newContext, acceptCookies, scrollToLoad, normalizeNumber } = require('../helpers');
const {
  extractPrice,
  extractReviews,
  extractNights,
  extractDeparture,
  extractMeal,
  extractDateRange,
  normalizeMeal,
} = require('../parse');

const NAME = 'wakacje';

// Destination subpages keep things focused and paginate 100 offers at a time.
const WAKACJE_URLS = [
  'https://www.wakacje.pl/lastminute/turcja/',
  'https://www.wakacje.pl/lastminute/egipt/',
  'https://www.wakacje.pl/lastminute/grecja/',
  'https://www.wakacje.pl/lastminute/hiszpania/',
  'https://www.wakacje.pl/lastminute/wyspy-kanaryjskie/',
  'https://www.wakacje.pl/lastminute/bulgaria/',
  'https://www.wakacje.pl/lastminute/cypr/',
  'https://www.wakacje.pl/lastminute/tunezja/',
];

// given img[alt] (hotel), find the enclosing offer card that carries full text + link
function findCard(img) {
  let card = img.parentElement;
  while (card && (card.innerText || '').trim().length < 120 && card.parentElement) {
    card = card.parentElement;
  }
  // include price area (a couple more levels up keeps the card + price together)
  for (let i = 0; i < 2 && card && card.parentElement; i++) card = card.parentElement;
  return card;
}

async function scrapeDestination(page, url) {
  const t0 = Date.now();
  await page.goto(url, { waitUntil: 'load', timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(2500);
  await acceptCookies(page);
  await page.waitForTimeout(2000);
  // lighter scrolling; wakacje is slow, keep total bounded
  for (let r = 0; r < 4; r++) {
    await Promise.race([
      page.evaluate(async () => {
        for (let y = 0; y < 2500; y += 600) {
          window.scrollBy(0, 600);
          await new Promise((res) => setTimeout(res, 120));
        }
      }),
      new Promise((res) => setTimeout(res, 15000)),
    ]).catch(() => {});
    await page.waitForTimeout(800);
  }
  await page.waitForTimeout(1500);

  const cards = await Promise.race([
    page.evaluate(() => {
      const out = [];
      const seen = new Set();
      const imgs = [...document.querySelectorAll('img[alt]')].filter(
        (i) => i.getAttribute('alt') && i.getAttribute('alt').length > 6
      );
      for (const img of imgs) {
        const alt = img.getAttribute('alt').trim();
        // skip decorative / generic images
        if (/najbliższ|promo|logo|wakacje na ostatnią/i.test(alt)) continue;
        if (seen.has(alt)) continue;
        seen.add(alt);
        let card = img.parentElement;
        while (card && (card.innerText || '').trim().length < 110 && card.parentElement) {
          card = card.parentElement;
        }
        for (let i = 0; i < 2 && card && card.parentElement; i++) card = card.parentElement;
        if (!card) continue;
        const text = (card.innerText || '').replace(/\s+/g, ' ').trim();
        if (!/zł/i.test(text)) continue;
        const href = card.querySelector('a[href]')?.getAttribute('href') || '';
        out.push({ hotel: alt, text, href });
        if (out.length >= 40) break;
      }
      return out;
    }),
    new Promise((res) => setTimeout(() => res([]), 20000)),
  ]).catch(() => []);

  console.log(`  [wakacje] parse ${cards.length} kart (${Date.now() - t0}ms)`);
  const result = [];
  for (const c of cards) {
    const tx = c.text;
    const [startISO, endISO] = extractDateRange(tx);

    // destination = text between "Lato 2026" and hotel name, e.g. "Turcja / Riwiera Turecka / Mahmutlar"
    let destination = null;
    const destMatch = tx.match(/Lato 2026\s+(.+?)\s+[A-Za-z][A-Za-z\u00A0.,'\-()&]*(?=\s+\d{1,2}\.\d{1,2}\.\d{4})/);
    if (destMatch) destination = destMatch[1].trim();

    // nights: prefer "X nocy" from "(8 dni / 7 nocy)"
    let nights = null;
    const nocyMatch = tx.match(/(\d{1,2})\s*nocy/);
    if (nocyMatch) nights = nocyMatch[1];
    else nights = extractNights(tx);

    // departure cities: "Katowice, Warszawa, Rzeszów (+6)" — keep the first one
    let departure = null;
    const depMatch = tx.match(/([A-Za-zĄĆĘŁŃÓŚŹŻąćęłńóśźż]+(?:,?\s*[A-Za-zĄĆĘŁŃÓŚŹŻąćęłńóśźż]+)*?)\s*\(\+\d+\)/);
    if (depMatch) departure = depMatch[1].trim().split(',')[0].trim();

    // rating: "8.7 Bardzo dobry" (scale /10 for wakacje)
    let rating = null;
    const ratingMatch = tx.match(/(\d(?:[.,]\d)?)\s*(?:Bardzo dobry|Dobry|Super|No można lepiej|Przyjaciółski|Wystarczający)/i);
    if (ratingMatch) rating = parseFloat(ratingMatch[1].replace(',', '.'));

    const reviews = extractReviews(tx);
    const price = extractPrice(tx) || extractPriceFromZa(tx);

    result.push({
      source: NAME,
      source_id: c.href || `wakacje:${c.hotel}:${startISO}`,
      hotel_name: c.hotel,
      destination,
      departure_city: departure,
      price_per_person: price ? normalizeNumber(price) : null,
      currency: 'PLN',
      lowest_price_30d: null,
      start_date: startISO,
      end_date: endISO,
      nights: nights ? normalizeNumber(nights) : null,
      meal_plan: normalizeMeal(extractMeal(tx)),
      rating,
      reviews: reviews ? normalizeNumber(reviews) : null,
      url: c.href && c.href.startsWith('http') ? c.href : `https://www.wakacje.pl${c.href || ''}`,
      description: tx,
      raw: JSON.stringify(c),
    });
  }
  return result;
}

// prices on wakacje look like "od 4 919 zł za wszystkich" (total not per person)
function extractPriceFromZa(text) {
  const m = text.match(/od\s*(\d{1,4}(?:[ \u00A0.]\d{3})*)\s*zł\s*za\s*wszystkich/i);
  return m ? m[1] : null;
}

async function scrapeWakacje() {
  const { browser, context } = await newContext();
  const page = await context.newPage();
  const all = [];
  try {
    for (const url of WAKACJE_URLS) {
      try {
        const offers = await scrapeDestination(page, url);
        console.log(`  [wakacje] ${url.split('/')[4]} -> ${offers.length} ofert`);
        all.push(...offers);
      } catch (e) {
        console.log(`  [wakacje] błąd dla ${url}: ${e.message}`);
      }
    }
  } finally {
    await browser.close();
  }
  return all;
}

module.exports = { NAME, scrapeWakacje, scrapeDestination };
