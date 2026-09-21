const { newContext, acceptCookies, scrollToLoad, normalizeNumber } = require('../helpers');
const {
  extractPrice,
  extractReviews,
  extractNights,
  extractDeparture,
  extractMeal,
  extractDateRange,
  extractDepartureCity,
  normalizeCountry,
  normalizeMeal,
} = require('../parse');
const { fetchStarsMap } = require('../../../api/src/db');

const NAME = 'wakacje';

// Destination subpages paginate 100 offers at a time; single offers load
// in-place after scrolling. Each destination also pages via ?str-N (1..100).
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

const WAKACJE_MAX_PAGES = 24;

// Hotel category stars are NOT shown on listing tiles (only the opinion rating).
// We grab them from the offer detail page once per hotel and cache in the DB via
// fetchStarsMap (key wakacje|hotel_name). Bound detail visits per run so the GH
// job stays within limits; new hotels get backfilled in later runs.
const MAX_STARS_VISITS = process.env.WAKACJE_STARS_CAP
  ? parseInt(process.env.WAKACJE_STARS_CAP, 10)
  : 150;

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
        const imgSrc = img.getAttribute('src') || img.getAttribute('data-src') || null;
        out.push({ hotel: alt, text, href, imgSrc });
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

    // departure cities: "Katowice, Warszawa, Rzeszów (+6)" — robust extraction
    // that skips meal/night words ("2 posiłki (+1)")
    const departure = extractDepartureCity(tx);

    // rating: "8.7 Bardzo dobry" (scale /10 for wakacje)
    let rating = null;
    const ratingMatch = tx.match(/(\d(?:[.,]\d)?)\s*(?:Bardzo dobry|Dobry|Super|No można lepiej|Przyjaciółski|Wystarczający)/i);
    if (ratingMatch) rating = parseFloat(ratingMatch[1].replace(',', '.'));

    const reviews = extractReviews(tx);
    const price = extractPrice(tx) || extractPriceFromZa(tx);

    const destinationCountry = destination ? destination.split('/')[0].trim() : null;

    result.push({
      source: NAME,
      source_id: c.href || `wakacje:${c.hotel}:${startISO}`,
      hotel_name: c.hotel,
      destination,
      country: destinationCountry ? normalizeCountry(destinationCountry) : null,
      image_url: c.imgSrc || null,
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

// Parse hotel category stars from an offer detail page (text "Kategoria hotelu ... 5").
async function fetchStarsFromDetail(page, url) {
  try {
    await page.goto(url, { waitUntil: 'load', timeout: 60000 }).catch(() => {});
    await page.waitForTimeout(1500);
    const stars = await page.evaluate(() => {
      const body = document.body.innerText || '';
      const m =
        body.match(/Kategoria\s+hotelu[^0-9]{0,40}(\d+)/i) ||
        body.match(/Kategoria\s+lokalna[^0-9]{0,40}(\d+)/i);
      return m ? parseInt(m[1], 10) : null;
    });
    return stars && stars > 0 && stars <= 8 ? stars : null;
  } catch {
    return null;
  }
}

// Enrich offers with hotel category stars. Reuses the DB cache; new hotels are
// visited (capped) and the result is applied so upsert persists it for next runs.
async function enrichStars(page, offers, maxVisits = MAX_STARS_VISITS) {
  const known = await fetchStarsMap().catch(() => new Map());
  const hotelToStars = new Map();
  const visits = [];

  for (const o of offers) {
    const key = `wakacje|${o.hotel_name}`;
    if (known.has(key)) {
      hotelToStars.set(o.hotel_name, known.get(key));
      continue;
    }
    if (!o.url || hotelToStars.has(o.hotel_name)) continue;
    hotelToStars.set(o.hotel_name, null); // placeholder, try once per hotel
    if (visits.length < maxVisits) visits.push(o);
  }

  let ok = 0;
  for (const o of visits) {
    const stars = await fetchStarsFromDetail(page, o.url);
    if (stars) hotelToStars.set(o.hotel_name, stars);
    if (stars) ok++;
    console.log(`  [wakacje] gwiazdki: ${o.hotel_name} -> ${stars || '?'} (${ok}/${visits.length})`);
  }

  let enriched = 0;
  for (const o of offers) {
    const s = hotelToStars.get(o.hotel_name);
    if (s) {
      o.stars = s;
      enriched++;
    }
  }
  console.log(`  [wakacje] gwiazdki: ${enriched}/${offers.length} ofert zaopatrzonych`);
  return hotelToStars;
}

async function scrapeWakacje() {
  const { browser, context } = await newContext();
  const page = await context.newPage();
  const all = [];
  try {
    for (const url of WAKACJE_URLS) {
      const seen = new Set();
      try {
        for (let p = 1; p <= WAKACJE_MAX_PAGES; p++) {
          const pageUrl = p === 1 ? url : `${url}?str-${p}`;
          const offers = await scrapeDestination(page, pageUrl);
          const fresh = offers.filter((o) => {
            if (seen.has(o.source_id)) return false;
            seen.add(o.source_id);
            return true;
          });
          all.push(...fresh);
          console.log(`  [wakacje] ${url.split('/')[4]} strona ${p} -> +${fresh.length} (łącznie ${seen.size})`);
          // koniec paginacji — strona pusta lub bez nowych ofert
          if (offers.length === 0 || fresh.length === 0) break;
        }
      } catch (e) {
        console.log(`  [wakacje] błąd dla ${url}: ${e.message}`);
      }
    }
    // hotel category stars come from detail pages — visit a bounded set once
    if (all.length) await enrichStars(page, all);
  } finally {
    await browser.close();
  }
  return all;
}

module.exports = { NAME, scrapeWakacje, scrapeDestination, enrichStars, fetchStarsFromDetail };
