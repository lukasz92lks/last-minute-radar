'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

const SOURCE_LABELS = { tui: 'TUI', itaka: 'ITAKA', wakacje: 'Wakacje.pl', rainbow: 'Rainbow' };

const STAR_LABEL = { 2: '2★', 3: '3★', 4: '4★', 5: '5★' };

async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function OfferCard({ o, compact }) {
  return (
    <div className={`offer-card${compact ? ' compact' : ''}`}>
      {o.image_url && (
        <div className={`thumb${compact ? ' thumb-compact' : ''}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={o.image_url} alt={o.hotel_name} loading="lazy" />
        </div>
      )}
      <div className="card-body">
      <div className="card-top">
        <div>
          <div className="hotel-name">{o.hotel_name}</div>
          {o.destination && <div className="dest">{o.destination}</div>}
          {o.country && !compact && <div className="dest">🌍 {o.country}</div>}
        </div>
        <span className={`badge ${o.source}`}>
          {SOURCE_LABELS[o.source] || o.source}
        </span>
      </div>

      {!compact && (o.start_date || o.nights || o.meal_plan || o.departure_city) && (
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

      {!compact && (
        <div className="meta">
          {o.stars ? <span className="stars">{'★'.repeat(o.stars)}</span> : null}
          {o.rating ? <span className="rating">★ {o.rating.toFixed(1)}</span> : null}
          {o.reviews ? <span>{o.reviews} opinii</span> : null}
        </div>
      )}

      <div className="price-row">
        <div className="price">
          {o.price_per_person ? `${o.price_per_person.toLocaleString('pl-PL')} zł` : '—'}
          <small> / os.</small>
          {!compact && o.lowest_price_30d && o.lowest_price_30d < o.price_per_person && (
            <div className="lowest">najniżej: {o.lowest_price_30d.toLocaleString('pl-PL')} zł</div>
          )}
        </div>
        {o.url && (
          <a className="cta" href={o.url} target="_blank" rel="noreferrer">
            Sprawdź →
          </a>
        )}
      </div>
      </div>
    </div>
  );
}

export default function Home() {
  const [offers, setOffers] = useState([]);
  const [stats, setStats] = useState(null);
  const [filters, setFilters] = useState({ countries: [], meal_plans: [], sources: [], departure_cities: [] });
  const [dealOfDay, setDealOfDay] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // filters
  const [query, setQuery] = useState('');
  const [source, setSource] = useState('');
  const [country, setCountry] = useState('');
  const [mealPlan, setMealPlan] = useState('');
  const [departureCity, setDepartureCity] = useState('');
  const [minStars, setMinStars] = useState('');
  const [nightsMin, setNightsMin] = useState('');
  const [nightsMax, setNightsMax] = useState('');
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
      if (country) params.set('country', country);
      if (mealPlan) params.set('meal_plan', mealPlan);
      if (departureCity) params.set('departure_city', departureCity);
      if (minStars) params.set('min_stars', minStars);
      if (nightsMin) params.set('nights_min', nightsMin);
      if (nightsMax) params.set('nights_max', nightsMax);
      if (maxPrice) params.set('max_price', maxPrice);
      params.set('sort', sort);
      params.set('order', order);
      params.set('limit', '100');
      const data = await fetchJSON(`/api/offers?${params.toString()}`);
      setOffers(data.offers);
      setTotal(data.total);
      setDealOfDay(pickDeal(data.offers));
      setError(null);
    } catch (e) {
      setError('Nie udało się pobrać ofert. Czy serwer API działa?');
    } finally {
      setLoading(false);
    }
  }, [query, source, country, mealPlan, departureCity, minStars, nightsMin, nightsMax, maxPrice, sort, order]);

  const clearFilters = useCallback(() => {
    setQuery('');
    setSource('');
    setCountry('');
    setMealPlan('');
    setDepartureCity('');
    setMinStars('');
    setNightsMin('');
    setNightsMax('');
    setMaxPrice('');
    setSort('price');
    setOrder('asc');
  }, []);

  useEffect(() => {
    load();
    fetchJSON('/api/stats').then(setStats).catch(() => {});
    fetchJSON('/api/filters').then(setFilters).catch(() => {});
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

      {dealOfDay && (
        <div className="deal-of-day">
          <div className="deal-tag">🔥 Oferta dnia</div>
          <OfferCard o={dealOfDay} compact />
          <div className="deal-sub">
            {dealOfDay.stars && <span>{'★'.repeat(dealOfDay.stars)}</span>}
            {dealOfDay.price_per_person && dealOfDay.nights ? (
              <span>
                {Math.round(dealOfDay.price_per_person / dealOfDay.nights).toLocaleString('pl-PL')} zł / noc
              </span>
            ) : null}
          </div>
        </div>
      )}

      <div className="filters">
        <input
          className="search"
          placeholder="Szukaj hotelu / miejscowości…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select value={source} onChange={(e) => setSource(e.target.value)}>
          <option value="">Wszystkie biura</option>
          {filters.sources.map((s) => (
            <option key={s} value={s}>{SOURCE_LABELS[s] || s}</option>
          ))}
        </select>
        <select value={country} onChange={(e) => setCountry(e.target.value)}>
          <option value="">Wszystkie kraje</option>
          {filters.countries.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <select value={mealPlan} onChange={(e) => setMealPlan(e.target.value)}>
          <option value="">Każde wyżywienie</option>
          {filters.meal_plans.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
        <select value={minStars} onChange={(e) => setMinStars(e.target.value)}>
          <option value="">Gwiazdki: dowolne</option>
          <option value="3">3★ lub więcej</option>
          <option value="4">4★ lub więcej</option>
          <option value="5">5★</option>
        </select>
        <select value={departureCity} onChange={(e) => setDepartureCity(e.target.value)}>
          <option value="">Wszystkie lotniska</option>
          {filters.departure_cities.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <input
          placeholder="Min. nocy"
          className="num-in"
          value={nightsMin}
          onChange={(e) => setNightsMin(e.target.value.replace(/\D/g, ''))}
        />
        <input
          placeholder="Max. nocy"
          className="num-in"
          value={nightsMax}
          onChange={(e) => setNightsMax(e.target.value.replace(/\D/g, ''))}
        />
        <input
          placeholder="Max cena (zł)"
          className="num-in"
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
        <div className="empty">
          Brak ofert spełniających kryteria. Spróbuj zmniejszyć liczbę filtrów (np. wyszukiwana kombinacja kraju i gwiazdek może nie mieć wyników).
          <div><button className="btn-outline" onClick={clearFilters}>Wyczyść filtry</button></div>
        </div>
      )}

      {!loading && offers.length > 0 && (
        <>
          <div className="lbl">Znaleziono {total} ofert</div>
          <div className="offer-grid">
            {offers.map((o) => (
              <OfferCard key={o.id} o={o} />
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

// Simple heuristic: best price per night with a slight bonus for higher star rating.
function pickDeal(offers) {
  if (!offers || !offers.length) return null;
  const withScore = offers
    .filter((o) => o.price_per_person && o.nights)
    .map((o) => {
      const perNight = o.price_per_person / o.nights;
      const starBoost = { 5: 0.8, 4: 0.9, 3: 1.0 }[o.stars] || 1.05;
      return { o, score: perNight * starBoost };
    })
    .filter((x) => x.o.start_date && new Date(x.o.start_date) >= new Date());
  if (!withScore.length) return null;
  return withScore.reduce((a, b) => (b.score < a.score ? b : a)).o;
}