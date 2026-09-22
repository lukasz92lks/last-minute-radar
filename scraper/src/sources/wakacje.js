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

// Hotel category stars are NOT shown on listing tiles (only the opinion rating),
// and tile photos are lazy-loaded/not always reliable. For offers that still miss
// stars or an image we visit the detail page and pull BOTH in one go, cached in
// the DB (key wakacje|hotel_name). Bound detail visits per run so the GH job
// stays within limits; new hotels get backfilled in later runs.
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
        // lazy-loaded tile images hide the real URL in data-*/srcset attrs
        const imgSrc = (() => {
          for (const attr of ['data-src', 'data-lazy-src', 'data-original', 'data-url', 'data-srcset', 'srcset', 'src']) {
            const v = img.getAttribute(attr);
            if (!v) continue;
            const first = v.trim().split(',')[0].trim().split(/[ \t]/)[0];
            if (/^https?:\/\//i.test(first) || first.startsWith('/')) {
              if (/\/static\/|placeholder|no.?photo|\bblank\b|1x1|pixel|logo/i.test(first)) continue;
              return first;
            }
          }
          return null;
        })();
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

// Normalize a wakacje.pl CDN image URL to a card-friendly size.
function normalizeWakacjeImage(url) {
  if (!url) return null;
  return url
    .replace(/-\d+x\d+\.(jpe?g|png|webp)$/i, '-343-228.$1')
    .replace(/-\d+-\d+\.(jpe?g|png|webp)$/i, '-343-228.$1');
}

// Visit an offer detail page and pull BOTH the hotel category stars and the main
// hotel photo in a single navigation. Returns { stars, image }.
async function fetchDetailFromPage(page, url) {
  try {
    await page.goto(url, { waitUntil: 'load', timeout: 60000 }).catch(() => {});
    await page.waitForTimeout(1500);
    const info = await page.evaluate(() => {
      const body = document.body.innerText || '';
      const m =
        body.match(/Kategoria\s+hotelu[^0-9]{0,40}(\d+)/i) ||
        body.match(/Kategoria\s+lokalna[^0-9]{0,40}(\d+)/i);
      let stars = m ? parseInt(m[1], 10) : null;
      if (!stars || stars <= 0 || stars > 8) stars = null;

      const og = document.querySelector('meta[property="og:image"]')?.getAttribute('content');
      let image = og || null;
      if (!image) {
        const img = [...document.querySelectorAll('img[src*="i.wakacje.pl"]')].find(
          (i) => !/menu-widget|\/static\//.test((i.getAttribute('src') || i.getAttribute('data-src') || ''))
        );
        image = (img && (img.getAttribute('src') || img.getAttribute('data-src'))) || null;
      }
      return { stars, image };
    });
    return { stars: info.stars, image: normalizeWakacjeImage(info.image) };
  } catch {
    return { stars: null, image: null };
  }
}

// Legacy convenience wrapper used by probe/backfill scripts.
async function fetchStarsFromDetail(page, url) {
  return (await fetchDetailFromPage(page, url)).stars;
}

// Enrich offers with hotel category stars AND hotel photos from detail pages.
// Stars are reused from the DB cache; each hotel missing stars or an image gets
// exactly one detail-page visit (capped per run) that extracts both at once.
async function enrichFromDetails(page, offers, maxVisits = MAX_STARS_VISITS) {
  const known = await fetchStarsMap().catch(() => new Map());
  const perHotel = new Map();
  for (const o of offers) {
    const key = o.hotel_name;
    if (!perHotel.has(key)) {
      perHotel.set(key, {
        url: o.url,
        offers: [],
        haveStars: known.has(`wakacje|${key}`),
        haveImg: Boolean(o.image_url),
      });
    }
    const slot = perHotel.get(key);
    if (!slot.url && o.url) slot.url = o.url;
    slot.haveStars = slot.haveStars || known.has(`wakacje|${key}`);
    slot.haveImg = slot.haveImg || Boolean(o.image_url);
    slot.offers.push(o);
  }

  const need = [...perHotel.values()].filter((s) => s.url && (!s.haveStars || !s.haveImg));
  const visits = need.slice(0, maxVisits);
  console.log(`  [wakacje] do odwiedzenia: ${need.length} hoteli, ${visits.length} w tej rundzie`);

  let starsOk = 0;
  let imgOk = 0;
  for (const slot of visits) {
    const { stars, image } = await fetchDetailFromPage(page, slot.url);
    if (stars) {
      slot.stars = stars;
      starsOk++;
    }
    if (image) {
      slot.image = image;
      imgOk++;
    }
    const hotel = slot.offers[0].hotel_name;
    console.log(`  [wakacje] detal: ${hotel} -> gwiazdki ${stars || '?'}, zdjęcie ${image ? 'tak' : 'nie'} (${starsOk}/${imgOk})`);
  }

  // stale stars from the DB cache apply to every offer, even those not visited
  for (const o of offers) {
    const cached = known.get(`wakacje|${o.hotel_name}`);
    if (cached) o.stars = cached;
  }

  let starsEnriched = 0;
  let imgEnriched = 0;
  for (const slot of perHotel.values()) {
    if (slot.stars) {
      for (const o of slot.offers) {
        o.stars = slot.stars;
        starsEnriched++;
      }
    }
    if (slot.image) {
      for (const o of slot.offers) {
        if (!o.image_url) o.image_url = slot.image;
        imgEnriched++;
      }
    }
  }
  console.log(`  [wakacje] gwiazdki: ${starsEnriched}/${offers.length} ofert, zdjęcia uzupełnione: ${imgEnriched}`);
  return perHotel;
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
    // hotel category stars + photos come from detail pages — visit a bounded set once
    if (all.length) await enrichFromDetails(page, all);
  } finally {
    await browser.close();
  }
  return all;
}

module.exports = { NAME, scrapeWakacje, scrapeDestination, enrichFromDetails, fetchStarsFromDetail, fetchDetailFromPage, normalizeWakacjeImage };
