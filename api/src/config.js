const path = require('path');

// Single shared SQLite database file for both scraper and API
const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'travel.db');

function normalizeNumber(v) {
  const n = parseInt(String(v).replace(/[^\d]/g, ''), 10);
  return Number.isFinite(n) ? n : null;
}

function normalizeDate(str) {
  // Accepts DD.MM.YYYY or DD-MM-YYYY -> ISO date
  if (!str) return null;
  const m = String(str).match(/(\d{1,2})[./-](\d{1,2})[./-](\d{4})/);
  if (!m) return null;
  return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
}

module.exports = { DB_PATH, normalizeNumber, normalizeDate };
