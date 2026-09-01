const express = require('express');
const cors = require('cors');
const { supabase } = require('./db');

const app = express();
app.use(cors());
app.use(express.json());

// GET /api/offers - list offers with filters
app.get('/api/offers', async (req, res) => {
  try {
    const {
      source,
      q,
      destination,
      max_price,
      min_rating,
      fresh_for,
      sort = 'price',
      order = 'asc',
      limit = 100,
      offset = 0,
    } = req.query;

    let query = supabase().from('offers').select('*', { count: 'exact' });

    query = query.not('price_per_person', 'is', null);

    if (source) query = query.eq('source', source);
    if (q) query = query.ilike('hotel_name', `%${q}%`);
    if (destination) query = query.ilike('destination', `%${destination}%`);
    if (max_price) query = query.lte('price_per_person', Number(max_price));
    if (min_rating) query = query.gte('rating', Number(min_rating));

    const hours = Number(fresh_for) || 48;
    const cutoff = new Date(Date.now() - hours * 3600 * 1000).toISOString();
    query = query.gte('last_seen_at', cutoff);

    const sortMap = { price: 'price_per_person', newest: 'first_seen_at', rating: 'rating' };
    const orderCol = sortMap[sort] || 'price_per_person';
    const orderDir = order.toLowerCase() === 'desc' ? { ascending: false } : { ascending: true };

    const lim = Math.min(Number(limit) || 100, 500);
    const off = Number(offset) || 0;

    // NOTE: postgREST allows order on one column; nullable price already filtered so ordering is fine
    query = query.order(orderCol, orderDir).range(off, off + lim - 1);

    const { data, count, error } = await query;
    if (error) throw error;

    res.json({ total: count || 0, count: (data || []).length, offers: data || [] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/offers/:id
app.get('/api/offers/:id', async (req, res) => {
  try {
    const { data, error } = await supabase()
      .from('offers')
      .select('*')
      .eq('id', req.params.id)
      .maybeSingle();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Nie znaleziono oferty' });
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/sources - stats per travel agency
app.get('/api/sources', async (_req, res) => {
  try {
    const client = supabase();
    const records = ['itaka', 'tui', 'wakacje'];
    const sources = [];
    for (const s of records) {
      const { data, error } = await client
        .from('offers')
        .select('price_per_person')
        .eq('source', s)
        .not('price_per_person', 'is', null);
      if (error) throw error;
      const prices = (data || []).map((r) => r.price_per_person);
      const { data: lastRow } = await client
        .from('offers')
        .select('last_seen_at')
        .eq('source', s)
        .order('last_seen_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      sources.push({
        source: s,
        offers: prices.length,
        min_price: prices.length ? Math.min(...prices) : null,
        max_price: prices.length ? Math.max(...prices) : null,
        last_seen: lastRow ? lastRow.last_seen_at : null,
      });
    }
    res.json({ sources });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/stats - overall stats
app.get('/api/stats', async (_req, res) => {
  try {
    const client = supabase();

    const { count: total, error: cErr } = await client
      .from('offers')
      .select('id', { count: 'exact', head: true })
      .not('price_per_person', 'is', null);
    if (cErr) throw cErr;

    const { data: prices } = await client
      .from('offers')
      .select('price_per_person')
      .not('price_per_person', 'is', null);

    const vals = (prices || []).map((r) => r.price_per_person).filter((n) => n != null);
    const avg = vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0;
    const min = vals.length ? Math.min(...vals) : null;

    const { data: updatedRow } = await client
      .from('offers')
      .select('last_seen_at')
      .order('last_seen_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    res.json({
      total: total || 0,
      avg_price: avg,
      min_price: min,
      updated_at: updatedRow ? updatedRow.last_seen_at : null,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = app;

if (require.main === module) {
  const PORT = process.env.PORT || 4000;
  app.listen(PORT, () => {
    console.log(`API działa na http://localhost:${PORT}`);
  });
}
