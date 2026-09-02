const cron = require('node-cron');
const { upsertOffers, pruneOffers } = require('../../api/src/db');
const { scrapeItaka } = require('./sources/itaka');
const { scrapeTui } = require('./sources/tui');
const { scrapeRainbow } = require('./sources/rainbow');
const { scrapeWakacje } = require('./sources/wakacje');

const SOURCES = [
  { name: 'itaka', run: scrapeItaka, timeoutMs: 180000 },
  { name: 'tui', run: scrapeTui, timeoutMs: 600000 },
  { name: 'rainbow', run: scrapeRainbow, timeoutMs: 600000 },
  { name: 'wakacje', run: scrapeWakacje, timeoutMs: 480000 },
];

function withTimeout(fn, ms) {
  return Promise.race([
    fn(),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`przekroczono limit czasu (${ms / 1000}s)`)), ms)
    ),
  ]);
}

async function runAll() {
  const start = Date.now();
  console.log(`\n[${new Date().toISOString()}] Rozpoczynam zbieranie ofert...`);
  let total = 0;

  for (const src of SOURCES) {
    try {
      console.log(`\n[${src.name}] Scraping...`);
      const offers = await withTimeout(src.run, src.timeoutMs || 240000);
      const n = await upsertOffers(offers);
      total += n;
      console.log(`[${src.name}] zapisano ${n} ofert`);
      // Remove offers from this source that are no longer in the listings
      // (not seen within the last 6h).
      const pruned = await pruneOffers([src.name], 6);
      if (pruned) console.log(`[${src.name}] usunięto ${pruned} nieaktualnych ofert`);
    } catch (e) {
      console.error(`[${src.name}] BŁĄD:`, e.message);
    }
  }

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`\nZakończono: ${total} ofert zapisanych w ${elapsed}s`);
  return total;
}

const shouldRunOnce = process.argv.includes('--once');

if (shouldRunOnce) {
  runAll()
    .then(() => process.exit(0))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
} else if (!process.env.NODE_ENV || !['PRODUCTION', 'test'].includes(process.env.NODE_ENV.toUpperCase())) {
  // CRON: co 30 minut (local daemon)
  cron.schedule('*/30 * * * *', () => {
    runAll().catch((e) => console.error('CRON błąd:', e.message));
  });
  console.log('Scraper uruchomiony. Będzie działał co 30 minut. (Ctrl+C aby zatrzymać)');
  runAll().catch((e) => console.error('początkowy błąd:', e.message));
}

module.exports = { runAll };
