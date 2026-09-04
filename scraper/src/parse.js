// Robust number/price parsing for Polish travel sites.
// Polish prices use space (or non-breaking space) as the thousands separator, e.g. "4 599 zł".
// A "proper number" is 1-4 digits optionally followed by groups of exactly 3 digits.
const NUM_RE = /\d{1,4}(?:[ \u00A0.]\d{3})*/;

// Extract the full per-person price ("4 599") from a price line, preferring the
// "/os." or "od" form, then any standalone "X ZŁ" form. Returns a bare digit string or null.
function extractPrice(text) {
  if (!text) return null;
  // Prefer "X zł /os." (itaka)
  let m = text.match(/od\s*(\d{1,4}(?:[ \u00A0.]\d{3})*)\s*zł\s*\/\s*os\.?/i);
  if (m) return m[1];
  m = text.match(/(\d{1,4}(?:[ \u00A0.]\d{3})*)\s*zł\s*\/\s*os\.?/i);
  if (m) return m[1];
  // "X ZŁ OSOBA" (tui)
  m = text.match(/(\d{1,4}(?:[ \u00A0.]\d{3})*)\s*(?:zł|PLN)\s*(?:osoba|os\.)/i);
  if (m) return m[1];
  // "od X zł"
  m = text.match(/od\s*(\d{1,4}(?:[ \u00A0.]\d{3})*)\s*(?:zł|PLN)/i);
  if (m) return m[1];
  // plain "X zł" (use a proper number immediately before the currency)
  m = text.match(/(?<![\d\u00A0.,/])(\d{1,4}(?:[ \u00A0.]\d{3})*)\s*(?:zł|PLN)/i);
  if (m) return m[1];
  return null;
}

function extractLowest(text) {
  const m = text.match(/najniższa[^:]*:\s*(\d{1,4}(?:[ \u00A0.]\d{3})*)\s*zł/i);
  return m ? m[1] : null;
}

function extractReviews(text) {
  const m = text.match(/(\d{1,4}(?:[ \u00A0.]\d{3})*)\s*opin/i);
  return m ? m[1] : null;
}

function extractNights(text) {
  const m = text.match(/\((\d{1,2})\s*(?:nocy|nocli?|dni)/i) ||
            text.match(/(\d{1,2})\s*(?:nocy|nocli?)\b/i);
  return m ? m[1] : null;
}

// Departure city known list placed right before a clock "Katowice 07:00"
// or "Warszawa-Chopina (07:40)".
const CITIES = 'Katowice|Warszawa|Wrocław|Gdańsk|Kraków|Poznań|Bydgoszcz|Rzeszów|Łódź|Szczecin|Lublin|Berlin|Zielona Góra|Częstochowa|Radom';
function extractDeparture(text) {
  if (!text) return null;
  // "City (-Airport) (HH:MM)" or "City HH:MM"
  let m = text.match(new RegExp(`(${CITIES})(?:-[A-Za-ząćęłńóśźż]+)?\\s*\\(?\\d{1,2}:\\d{2}`));
  return m ? m[1] : null;
}

// Words that must never be treated as a departure city (meal/night/booking junk
// that sits before "(+N)" on Rainbow/Wakacje tiles).
const CITY_BLOCKLIST = new Set([
  'posiłki', 'posiłek', 'śniadania', 'śniadanie', 'obiadokolacje', 'obiadokolacja',
  'kolacje', 'kolacja', 'wyżywienia', 'wyżywienie', 'noclegi', 'nocleg', 'noclegów',
  'noc', 'nocy', 'terminy', 'termin', 'sal', 'sall', 'studia', 'dni', 'inwestycja',
  'wypoczynek', 'objazd', 'pobyt', 'pokój', 'pokoju', 'apartamenty',
]);

// Extra departure cities seen on Rainbow/Wakacje tiles (beyond the allowlist above).
const KNOWN_CITIES = [
  ...CITIES.split('|'),
  'Modlin', 'Olsztyn', 'Tarnów', 'Jasionka', 'Starachowice', 'Szymany',
];

// Robust departure-city extraction for tiles that use "City (...)" patterns.
// Prefers a known airport city appearing anywhere on the tile (skips meal/night
// junk). Falls back to scanning the token right before "(+N)".
function extractDepartureCity(text) {
  if (!text) return null;
  const known = text.match(new RegExp(`(${KNOWN_CITIES.join('|')})`));
  if (known) return known[1];

  const candidateRe = /([A-Za-zĄĆĘŁŃÓŚŹŻąćęłńóśźż]+(?:\s+[A-Za-zĄĆĘŁŃÓŚŹŻąćęłńóśźż]+)?)\s*\(\+\d+\)/g;
  let m;
  while ((m = candidateRe.exec(text))) {
    const cand = m[1].trim();
    const words = cand.split(/\s+/);
    const knownWord = words.find((w) => KNOWN_CITIES.includes(w));
    if (knownWord) return knownWord;
    if (words.some((w) => CITY_BLOCKLIST.has(w.toLowerCase()))) continue;
    return words[0];
  }
  return null;
}

// Map country names (TUI uses URL slugs) to a canonical Polish display name.
const COUNTRY_MAP = {
  'turcja': 'Turcja', 'grecja': 'Grecja', 'hiszpania': 'Hiszpania', 'majorka': 'Hiszpania',
  'egipt': 'Egipt', 'bulgaria': 'Bułgaria', 'wyspy kanaryjskie': 'Wyspy Kanaryjskie',
  'wyspy-kanaryjskie': 'Wyspy Kanaryjskie', 'cypr': 'Cypr', 'tunezja': 'Tunezja',
};
function normalizeCountry(c) {
  if (!c) return null;
  const key = String(c).trim().toLowerCase();
  return COUNTRY_MAP[key] || String(c).trim() || null;
}
const MEALS = 'all inclusive|śniadania i obiadokolacje|śniadanie i obiadokolacja|śniadania i obiadokolacja|śniadanie|3 posiłki|2 posiłki|bez wyżywienia|half board|full board|bed and breakfast|śniadania i kolacje|śniadania i kolacja';
function extractMeal(text) {
  const m = text.match(new RegExp(MEALS, 'i'));
  return m ? m[0] : null;
}

// Normalize meal_plan to canonical lowercase form.
const MEAL_ALIASES = {
  'śniadania i obiadokolacje': 'śniadania i obiadokolacje',
  'śniadanie i obiadokolacja': 'śniadania i obiadokolacje',
  'śniadania i obiadokolacja': 'śniadania i obiadokolacje',
  'śniadania i kolacje': 'śniadania i obiadokolacje',
  'śniadania i kolacja': 'śniadania i obiadokolacje',
  'śniadanie': 'śniadanie',
  '3 posiłki': '3 posiłki',
  '2 posiłki': '2 posiłki',
  'bez wyżywienia': 'bez wyżywienia',
  'all inclusive': 'all inclusive',
  'half board': 'half board',
  'full board': 'full board',
  'bed and breakfast': 'bed and breakfast',
};
function normalizeMeal(meal) {
  if (!meal) return null;
  const key = String(meal).trim().toLowerCase();
  return MEAL_ALIASES[key] || key;
}

// Dates like "7.09.2026 - 14.09.2026" or "7.09 - 14.09.2026". First date may omit year.
// Returns [startISO, endISO] where ISO = YYYY-MM-DD.
function extractDateRange(text) {
  const m = text.match(
    /(\d{1,2})\.(\d{1,2})\s*[-–]\s*(\d{1,2})\.(\d{1,2})\.(\d{4})/
  );
  if (!m) return [null, null];
  const [, sd, sm, ed, em, ey] = m;
  // start year inferred from end year
  let sy = Number(ey);
  let se = `${sy}-${sm.padStart(2, '0')}-${sd.padStart(2, '0')}`;
  let end = `${ey}-${em.padStart(2, '0')}-${ed.padStart(2, '0')}`;
  // if start comes after end (e.g. Dec->Jan), adjust start year backwards
  if (sy > Number(ey) || (sy === Number(ey) && Number(sm) > Number(em))) {
    sy -= 1;
    se = `${sy}-${sm.padStart(2, '0')}-${sd.padStart(2, '0')}`;
  }
  return [se, end];
}

module.exports = {
  NUM_RE,
  extractPrice,
  extractLowest,
  extractReviews,
  extractNights,
  extractDeparture,
  extractDepartureCity,
  extractMeal,
  extractDateRange,
  normalizeCountry,
  normalizeMeal,
};
