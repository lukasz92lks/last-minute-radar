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

module.exports = { newContext, acceptCookies, scrollToLoad, normalizeNumber, normalizeDate };
