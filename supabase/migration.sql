-- Supabase / PostgreSQL migration for Last Minute Radar
-- Paste this into Supabase SQL Editor and run it.

-- Offers table
CREATE TABLE IF NOT EXISTS offers (
  id                BIGSERIAL PRIMARY KEY,
  source            TEXT NOT NULL,
  source_id         TEXT,
  hotel_name        TEXT NOT NULL,
  destination       TEXT,
  departure_city    TEXT,
  price_per_person  INTEGER,
  currency          TEXT DEFAULT 'PLN',
  lowest_price_30d  INTEGER,
  start_date        DATE,
  end_date          DATE,
  nights            INTEGER,
  meal_plan         TEXT,
  rating            REAL,
  reviews           INTEGER,
  url               TEXT,
  description       TEXT,
  raw               TEXT,
  first_seen_at     TIMESTAMPTZ DEFAULT now(),
  last_seen_at      TIMESTAMPTZ
);

-- Unique natural key (source + source_id)
CREATE UNIQUE INDEX IF NOT EXISTS idx_offer_unique ON offers (source, source_id);

-- Query indexes
CREATE INDEX IF NOT EXISTS idx_offers_price     ON offers (price_per_person);
CREATE INDEX IF NOT EXISTS idx_offers_source    ON offers (source);
CREATE INDEX IF NOT EXISTS idx_offers_last_seen ON offers (last_seen_at);
CREATE INDEX IF NOT EXISTS idx_offers_hotel     ON offers (hotel_name);

-- RLS: enable but allow all access via the API (adjust as needed for auth later)
ALTER TABLE offers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read offers" ON offers;
CREATE POLICY "Allow public read offers" ON offers
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow service write offers" ON offers;
CREATE POLICY "Allow service write offers" ON offers
  FOR ALL USING (true) WITH CHECK (true);
