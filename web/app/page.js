'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

const SOURCE_LABELS = { tui: 'TUI', itaka: 'ITAKA', wakacje: 'Wakacje.pl' };

async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export default function Home() {
  const [offers, setOffers] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // filters
  const [query, setQuery] = useState('');
  const [source, setSource] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [sort, setSort] = useState('price');
  const [order, setOrder] = useState('asc');
  const [total, setTotal] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (query) params.set('q', query);
      if (source) params.set('source', source);
      if (maxPrice) params.set('max_price', maxPrice);
      params.set('sort', sort);
      params.set('order', order);
      params.set('limit', '100');
      const data = await fetchJSON(`/api/offers?${params.toString()}`);
      setOffers(data.offers);
      setTotal(data.total);
      setError(null);
    } catch (e) {
      setError('Nie udało się pobrać ofert. Czy serwer API działa?');
    } finally {
      setLoading(false);
    }
  }, [query, source, maxPrice, sort, order]);

  useEffect(() => {
    load();
    fetchJSON('/api/stats').then(setStats).catch(() => {});
  }, [load]);

  return (
    <div className="container">
      <header className="main">
        <div className="container">
          <div className="brand">
            <span className="last">Last Minute</span> <span className="radar">Radar</span>
          </div>
          <div className="subtitle">
            Oferty z polskich biur podróży zebrane w jedno miejsce.
          </div>
        </div>
      </header>

      <div className="stats-bar">
        <div className="stat"><div className="num">{stats?.total ?? '…'}</div><div className="lbl">ofert</div></div>
        <div className="stat"><div className="num">od {stats?.min_price ?? '…'} zł</div><div className="lbl">najtańsza</div></div>
        <div className="stat"><div className="num">{stats?.avg_price ?? '…'} zł</div><div className="lbl">średnia cena</div></div>
        <div className="stat">
          <div className="num small-updated">
            {stats?.updated_at ? new Date(stats.updated_at).toLocaleString('pl-PL') : '…'}
          </div>
          <div className="lbl">aktualizacja</div>
        </div>
      </div>

      <div className="filters">
        <input
          className="search"
          placeholder="Szukaj hotelu / miejscowości…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select value={source} onChange={(e) => setSource(e.target.value)}>
          <option value="">Wszystkie biura</option>
          <option value="tui">TUI</option>
          <option value="itaka">ITAKA</option>
          <option value="wakacje">Wakacje.pl</option>
        </select>
        <input
          placeholder="Max cena (zł)"
          value={maxPrice}
          onChange={(e) => setMaxPrice(e.target.value.replace(/\D/g, ''))}
        />
        <select value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="price">Cena</option>
          <option value="rating">Ocena</option>
          <option value="newest">Najnowsze</option>
        </select>
        <select value={order} onChange={(e) => setOrder(e.target.value)}>
          <option value="asc">Rosnąco</option>
          <option value="desc">Malejąco</option>
        </select>
        <button onClick={load}>Szukaj</button>
      </div>

      {error && <div className="empty">{error}</div>}
      {loading && <div className="empty">Ładowanie ofert…</div>}

      {!loading && !error && offers.length === 0 && (
        <div className="empty">Brak ofert spełniających kryteria.</div>
      )}

      {!loading && offers.length > 0 && (
        <>
          <div className="lbl">Znaleziono {total} ofert</div>
          <div className="offer-grid">
            {offers.map((o) => (
              <div key={o.id} className="offer-card">
                <div className="card-top">
                  <div>
                    <div className="hotel-name">{o.hotel_name}</div>
                    {o.destination && <div className="dest">{o.destination}</div>}
                  </div>
                  <span className={`badge ${o.source}`}>
                    {SOURCE_LABELS[o.source] || o.source}
                  </span>
                </div>

                {(o.start_date || o.nights || o.meal_plan || o.departure_city) && (
                  <div className="meta">
                    {o.start_date && (
                      <span>
                        {new Date(o.start_date).toLocaleDateString('pl-PL')}
                        {o.end_date && ` – ${new Date(o.end_date).toLocaleDateString('pl-PL')}`}
                      </span>
                    )}
                    {o.nights ? <span>{o.nights} nocy</span> : null}
                    {o.meal_plan ? <span>{o.meal_plan}</span> : null}
                    {o.departure_city ? <span>wylot: {o.departure_city}</span> : null}
                  </div>
                )}

                <div className="meta">
                  {o.rating ? <span className="rating">★ {o.rating.toFixed(1)}</span> : null}
                  {o.reviews ? <span>{o.reviews} opinii</span> : null}
                </div>

                <div className="price-row">
                  <div className="price">
                    {o.price_per_person ? `${o.price_per_person.toLocaleString('pl-PL')} zł` : '—'}
                    <small> / os.</small>
                  </div>
                  {o.url && (
                    <a className="cta" href={o.url} target="_blank" rel="noreferrer">
                      Sprawdź →
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <footer>
        <div className="container">
          Dane zbierane automatycznie ze stron biur podróży. Ceny mogą się zmieniać — sprawdź na
          stronie biura przed rezerwacją.
        </div>
      </footer>
    </div>
  );
}
