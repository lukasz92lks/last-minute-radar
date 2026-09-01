const { chromium } = require('playwright');
const { normalizeNumber, normalizeDate } = require('../../api/src/db');

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';

// Shared browser context factory
async function newContext(options = {}) {
  const browser = await chromium.launch({ headless: options.headless ?? true });
  const context = await browser.newContext({
    userAgent: USER_AGENT,
    locale: 'pl-PL',
    viewport: { width: 1366, height: 2000 },
  });
  return { browser, context };
}

// Accept a cookie-consent banner using several known selectors
async function acceptCookies(page) {
  const selectors = [
    'button:has-text("Akceptuję")',
    'button:has-text("Akceptuj")',
    'button:has-text("Zgadzam się")',
    'button:has-text("Zgoda")',
    '#onetrust-accept-btn-handler',
    'button:has-text("OK")',
  ];
  for (const sel of selectors) {
    try {
      const loc = page.locator(sel).first();
      if (await loc.isVisible({ timeout: 1200 })) {
        await loc.click({ timeout: 2000 });
        return true;
      }
    } catch {
      /* try next */
    }
  }
  return false;
}

const RAINBOW_NUMBER_WORDS = {
  jeden: 1, jedno: 1, pierwszy: 1,
  dwa: 2, dwie: 2, drugi: 2,
  trzy: 3, trzeci: 3,
  cztery: 4, czwarty: 4,
  piec: 5, 'pięć': 5, piąty: 5, piaty: 5,
  szesc: 6, 'sześć': 6, szósty: 6, szosty: 6,
};

// Rainbow shows "Kategoria lokalna ***" (stars as asterisks) or words like "Trzy klucze".
function starsFromRainbowCategory(text) {
  if (!text) return null;
  const asterisks = (text.match(/\*/g) || []).length;
  if (asterisks > 0 && asterisks <= 7) return asterisks;
  const low = ' ' + text.toLowerCase().replace(/[.,\n\r\t]+/g, ' ') + ' ';
  for (const [word, n] of Object.entries(RAINBOW_NUMBER_WORDS)) {
    if (new RegExp(`\\b${word}\\b`, 'i').test(low)) return n;
  }
  return null;
}

// Fetch hotel star count from a detail page. Returns integer 1-7 or null.
//  - tui:      "stars":N in #__NEXT_DATA__
//  - rainbow:  "Kategoria lokalna" section (count of * or Polish number words)
async function fetchHotelStars(page, source, url) {
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
    await page.waitForTimeout(1200);
    await acceptCookies(page);
    await page.waitForTimeout(400);

    if (source === 'tui') {
      const val = await page.evaluate(() => {
        const nd = document.getElementById('__NEXT_DATA__')?.textContent || '';
        const m = nd.match(/"stars":\s*(\d)/);
        return m ? parseInt(m[1], 10) : null;
      });
      return val && val >= 1 && val <= 7 ? val : null;
    }

    if (source === 'rainbow') {
      const text = await page.evaluate(() => {
        const all = [...document.querySelectorAll('*')];
        const holder = all.find(
          (el) =>
            el.childElementCount < 40 &&
            /kategoria lokalna/i.test(el.innerText || '') &&
            (el.innerText || '').length < 300
        );
        return holder ? holder.innerText : '';
      });
      return starsFromRainbowCategory(text);
    }
  } catch {
    /* detail page may be slow/blocked; return null */
  }
  return null;
}

// Scroll the page progressively to trigger lazy-loading of results
async function scrollToLoad(page, rounds = 4, step = 1000) {
  for (let r = 0; r < rounds; r++) {
    await page.evaluate(
      async (stepPx) => {
        for (let y = 0; y < 3000; y += stepPx) {
          window.scrollBy(0, stepPx);
          await new Promise((res) => setTimeout(res, 120));
        }
      },
      step
    );
    await page.waitForTimeout(800);
  }
}

module.exports = { newContext, acceptCookies, scrollToLoad, normalizeNumber, normalizeDate, fetchHotelStars };
