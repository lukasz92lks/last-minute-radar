"use client";

import { useCallback, useEffect, useState } from "react";

const SOURCE_LABELS = {
  tui: "TUI",
  itaka: "ITAKA",
  wakacje: "Wakacje.pl",
  rainbow: "Rainbow",
};
const BADGE_COLORS = {
  tui: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
  itaka: "bg-indigo-500/20 text-indigo-300 border-indigo-500/30",
  wakacje: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  rainbow: "bg-amber-500/20 text-amber-300 border-amber-500/30",
};

async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function OfferCard({ o, isDealOfDay = false }) {
  return (
    <div
      className={`group relative overflow-hidden rounded-[2rem] border border-white/10 bg-[#0f172a] shadow-2xl transition-all duration-500 hover:-translate-y-2 hover:shadow-cyan-500/20 ${
        isDealOfDay ? "h-full min-h-[360px]" : "h-[380px]"
      }`}
    >
      {/* Tło - Zdjęcie hotelu */}
      {o.image_url && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={o.image_url}
            alt={o.hotel_name}
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
          />
          {/* Gradient przyciemniający, by tekst był czytelny */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-black/10" />
        </>
      )}

      {/* Tagi na górze karty */}
      <div className="absolute left-5 top-5 flex items-start justify-between right-5 z-10">
        <span
          className={`rounded-2xl border px-3 py-1.5 text-xs font-black uppercase tracking-wider backdrop-blur-md ${
            BADGE_COLORS[o.source] || "border-white/20 bg-white/10 text-white"
          }`}
        >
          {SOURCE_LABELS[o.source] || o.source}
        </span>
        {isDealOfDay && (
          <span className="animate-pulse rounded-2xl bg-amber-500/90 px-3 py-1.5 text-xs font-black uppercase tracking-widest text-amber-950 shadow-[0_0_20px_rgba(245,158,11,0.5)]">
            🔥 Oferta Dnia
          </span>
        )}
      </div>

      {/* Szklany panel na dole (Glassmorphism) */}
      <div className="absolute bottom-0 inset-x-0 flex flex-col justify-end border-t border-white/10 bg-white/5 p-5 backdrop-blur-xl">
        <div className="mb-1 flex items-center gap-2">
          {o.stars ? (
            <span className="text-sm font-bold tracking-widest text-amber-400 drop-shadow-md">
              {"★".repeat(o.stars)}
            </span>
          ) : null}
          {o.rating ? (
            <span className="rounded-md bg-emerald-500/20 px-1.5 py-0.5 text-xs font-bold text-emerald-300">
              {o.rating.toFixed(1)}/5
            </span>
          ) : null}
        </div>

        <h3 className="line-clamp-2 text-xl font-bold leading-tight text-white drop-shadow-lg">
          {o.hotel_name}
        </h3>
        <p className="mt-1 text-sm text-slate-300">
          {o.destination} {o.country && `• ${o.country}`}
        </p>

        {/* Metadane wycieczki */}
        <div className="mt-4 mb-4 flex flex-wrap gap-2 text-xs font-medium text-slate-200">
          {o.start_date && (
            <span className="rounded-xl bg-black/40 px-2.5 py-1 backdrop-blur-md">
              {new Date(o.start_date).toLocaleDateString("pl-PL").slice(0, 5)}
              {o.end_date &&
                ` - ${new Date(o.end_date).toLocaleDateString("pl-PL").slice(0, 5)}`}
            </span>
          )}
          {o.nights ? (
            <span className="rounded-xl bg-black/40 px-2.5 py-1 backdrop-blur-md">
              {o.nights} nocy
            </span>
          ) : null}
          {o.meal_plan ? (
            <span className="rounded-xl bg-black/40 px-2.5 py-1 backdrop-blur-md">
              {o.meal_plan}
            </span>
          ) : null}
        </div>

        {/* Cena i przycisk */}
        <div className="flex items-end justify-between border-t border-white/10 pt-3">
          <div>
            <div className="text-3xl font-black text-white drop-shadow-lg">
              {o.price_per_person
                ? `${o.price_per_person.toLocaleString("pl-PL")} zł`
                : "—"}
            </div>
            <div className="text-xs text-slate-400">
              za osobę{" "}
              {o.lowest_price_30d &&
                o.lowest_price_30d < o.price_per_person &&
                `• najniżej: ${o.lowest_price_30d.toLocaleString("pl-PL")} zł`}
            </div>
          </div>

          {o.url && (
            <a
              href={o.url}
              target="_blank"
              rel="noreferrer"
              className="flex h-10 items-center justify-center rounded-xl bg-white text-sm font-bold text-black transition-transform hover:scale-105 hover:bg-cyan-400 px-5 shadow-lg"
            >
              Sprawdź
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
  const [filters, setFilters] = useState({
    countries: [],
    meal_plans: [],
    sources: [],
    departure_cities: [],
  });
  const [dealOfDay, setDealOfDay] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // filters
  const [query, setQuery] = useState("");
  const [source, setSource] = useState("");
  const [country, setCountry] = useState("");
  const [mealPlan, setMealPlan] = useState("");
  const [departureCities, setDepartureCities] = useState([]);
  const [minStars, setMinStars] = useState("");
  const [nightsMin, setNightsMin] = useState("");
  const [nightsMax, setNightsMax] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [sort, setSort] = useState("price");
  const [order, setOrder] = useState("asc");
  const [total, setTotal] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (query) params.set("q", query);
      if (source) params.set("source", source);
      if (country) params.set("country", country);
      if (mealPlan) params.set("meal_plan", mealPlan);
      if (departureCities.length)
        params.set("departure_city", departureCities.join(","));
      if (minStars) params.set("min_stars", minStars);
      if (nightsMin) params.set("nights_min", nightsMin);
      if (nightsMax) params.set("nights_max", nightsMax);
      if (maxPrice) params.set("max_price", maxPrice);
      params.set("sort", sort);
      params.set("order", order);
      params.set("limit", "100");
      const data = await fetchJSON(`/api/offers?${params.toString()}`);
      setOffers(data.offers);
      setTotal(data.total);
      setDealOfDay(pickDeal(data.offers));
      setError(null);
    } catch (e) {
      setError("Nie udało się pobrać ofert. Czy serwer API działa?");
    } finally {
      setLoading(false);
    }
  }, [
    query,
    source,
    country,
    mealPlan,
    departureCities,
    minStars,
    nightsMin,
    nightsMax,
    maxPrice,
    sort,
    order,
  ]);

  const clearFilters = useCallback(() => {
    setQuery("");
    setSource("");
    setCountry("");
    setMealPlan("");
    setDepartureCities([]);
    setMinStars("");
    setNightsMin("");
    setNightsMax("");
    setMaxPrice("");
    setSort("price");
    setOrder("asc");
  }, []);

  useEffect(() => {
    load();
    fetchJSON("/api/stats")
      .then(setStats)
      .catch(() => {});
    fetchJSON("/api/filters")
      .then(setFilters)
      .catch(() => {});
  }, [load]);

  const glassInputClass =
    "bg-white/5 backdrop-blur-md border border-white/10 text-white rounded-2xl px-4 py-3 text-sm transition-all focus:border-cyan-400 focus:bg-white/10 focus:outline-none focus:ring-1 focus:ring-cyan-400 w-full placeholder:text-slate-500 shadow-lg";

  return (
    <div className="relative min-h-screen bg-[#020617] text-slate-200 selection:bg-cyan-500/30">
      {/* Kolorowe "bloby" w tle tworzące ambientowy klimat */}
      <div className="pointer-events-none absolute -top-[10%] -left-[10%] h-[50vw] w-[50vw] rounded-full bg-cyan-600/10 blur-[120px]" />
      <div className="pointer-events-none absolute top-[20%] -right-[10%] h-[40vw] w-[40vw] rounded-full bg-indigo-600/10 blur-[120px]" />
      <div className="pointer-events-none absolute bottom-0 left-[20%] h-[30vw] w-[40vw] rounded-full bg-emerald-600/10 blur-[120px]" />

      <div className="relative z-10 mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8 pb-20">
        {/* Header Glassmorphism */}
        <header className="sticky top-4 z-50 mb-8 mt-4 rounded-3xl border border-white/10 bg-white/5 px-6 py-4 backdrop-blur-xl shadow-2xl">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-3 text-2xl font-black tracking-tighter text-white">
              <svg
                className="h-10 w-10 shrink-0 drop-shadow-[0_0_15px_rgba(56,189,248,0.5)]"
                viewBox="0 0 64 64"
                aria-hidden="true"
              >
                <defs>
                  <linearGradient id="radar-sweep" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#38bdf8" />
                    <stop offset="100%" stopColor="#818cf8" />
                  </linearGradient>
                </defs>
                <circle
                  cx="32"
                  cy="32"
                  r="30"
                  fill="none"
                  stroke="rgba(56,189,248,0.4)"
                  strokeWidth="3"
                />
                <circle
                  cx="32"
                  cy="32"
                  r="20"
                  fill="none"
                  stroke="rgba(56,189,248,0.22)"
                  strokeWidth="2"
                />
                <circle
                  cx="32"
                  cy="32"
                  r="10"
                  fill="none"
                  stroke="rgba(56,189,248,0.18)"
                  strokeWidth="1.5"
                />
                <g
                  className="animate-[spin_4s_linear_infinite]"
                  style={{ transformOrigin: "32px 32px" }}
                >
                  <path
                    d="M32,32 L21.74,3.81 A30,30 0 0 1 61.54,26.79 Z"
                    fill="url(#radar-sweep)"
                    opacity="0.5"
                  />
                  <circle
                    cx="47"
                    cy="15"
                    r="3.2"
                    fill="#fbbf24"
                    opacity="0.95"
                  />
                </g>
                <circle cx="32" cy="32" r="4" fill="#e8eef7" />
              </svg>
              <div>
                <span className="text-white">Last Minute</span>
                <span className="bg-gradient-to-r from-cyan-400 to-indigo-400 bg-clip-text text-transparent">
                  Radar
                </span>
              </div>
            </div>
          </div>
        </header>

        {/* Bento Grid: Oferta Dnia + Statystyki */}
        <div className="mb-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
          {dealOfDay && (
            <div className="lg:col-span-2">
              <OfferCard o={dealOfDay} isDealOfDay={true} />
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            {[
              {
                label: "Aktywnych ofert",
                val: stats?.total ?? "…",
                color: "from-cyan-500/20 to-transparent",
              },
              {
                label: "Najtańsza opcja",
                val: stats?.min_price ? `${stats.min_price} zł` : "…",
                color: "from-emerald-500/20 to-transparent",
              },
              {
                label: "Średnia rynkowa",
                val: stats?.avg_price ? `${stats.avg_price} zł` : "…",
                color: "from-indigo-500/20 to-transparent",
              },
              {
                label: "Ostatni skan",
                val: stats?.updated_at
                  ? new Date(stats.updated_at).toLocaleTimeString("pl-PL", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : "…",
                color: "from-amber-500/20 to-transparent",
              },
            ].map((stat, i) => (
              <div
                key={i}
                className={`relative flex flex-col justify-end overflow-hidden rounded-[2rem] border border-white/10 bg-white/5 p-6 backdrop-blur-md shadow-xl bg-gradient-to-br ${stat.color}`}
              >
                <div className="mb-1 text-xs font-bold uppercase tracking-wider text-slate-400">
                  {stat.label}
                </div>
                <div className="text-2xl lg:text-3xl font-black text-white">
                  {stat.val}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Filtry - Glassmorphism Pills */}
        <div className="mb-8 flex flex-col gap-4 rounded-[2rem] border border-white/10 bg-white/5 p-6 backdrop-blur-xl shadow-2xl">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <input
              className={glassInputClass}
              placeholder="Dokąd chcesz lecieć? (hotel, kraj...)"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <select
              className={`${glassInputClass} appearance-none`}
              value={source}
              onChange={(e) => setSource(e.target.value)}
            >
              <option value="" className="bg-slate-900">
                Wszystkie biura
              </option>
              {filters.sources.map((s) => (
                <option key={s} value={s} className="bg-slate-900">
                  {SOURCE_LABELS[s] || s}
                </option>
              ))}
            </select>
            <select
              className={`${glassInputClass} appearance-none`}
              value={country}
              onChange={(e) => setCountry(e.target.value)}
            >
              <option value="" className="bg-slate-900">
                Wszystkie kraje
              </option>
              {filters.countries.map((c) => (
                <option key={c} value={c} className="bg-slate-900">
                  {c}
                </option>
              ))}
            </select>
            <select
              className={`${glassInputClass} appearance-none`}
              value={mealPlan}
              onChange={(e) => setMealPlan(e.target.value)}
            >
              <option value="" className="bg-slate-900">
                Każde wyżywienie
              </option>
              {filters.meal_plans.map((m) => (
                <option key={m} value={m} className="bg-slate-900">
                  {m}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-wrap items-center gap-3 border-t border-white/10 pt-4">
            <span className="text-sm font-semibold text-slate-400">
              Wyloty z:
            </span>
            {filters.departure_cities.map((c) => {
              const active = departureCities.includes(c);
              return (
                <button
                  key={c}
                  type="button"
                  className={`rounded-xl px-4 py-2 text-sm font-bold transition-all backdrop-blur-md ${
                    active
                      ? "bg-cyan-500 text-black shadow-[0_0_20px_rgba(34,211,238,0.4)] scale-105"
                      : "border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"
                  }`}
                  onClick={() =>
                    setDepartureCities((prev) =>
                      active ? prev.filter((x) => x !== c) : [...prev, c],
                    )
                  }
                >
                  {c}
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-6 gap-4 border-t border-white/10 pt-4">
            <input
              placeholder="Min nocy"
              className={glassInputClass}
              value={nightsMin}
              onChange={(e) => setNightsMin(e.target.value.replace(/\D/g, ""))}
            />
            <input
              placeholder="Max nocy"
              className={glassInputClass}
              value={nightsMax}
              onChange={(e) => setNightsMax(e.target.value.replace(/\D/g, ""))}
            />
            <input
              placeholder="Max cena"
              className={glassInputClass}
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value.replace(/\D/g, ""))}
            />
            <select
              className={`${glassInputClass} appearance-none`}
              value={sort}
              onChange={(e) => setSort(e.target.value)}
            >
              <option value="price" className="bg-slate-900">
                Cena
              </option>
              <option value="rating" className="bg-slate-900">
                Ocena
              </option>
              <option value="newest" className="bg-slate-900">
                Najnowsze
              </option>
            </select>
            <select
              className={`${glassInputClass} appearance-none`}
              value={order}
              onChange={(e) => setOrder(e.target.value)}
            >
              <option value="asc" className="bg-slate-900">
                Rosnąco
              </option>
              <option value="desc" className="bg-slate-900">
                Malejąco
              </option>
            </select>
            <button
              onClick={load}
              className="rounded-2xl bg-white text-black font-black transition-all hover:bg-cyan-400 hover:scale-105 shadow-xl w-full h-full min-h-[48px]"
            >
              Szukaj
            </button>
          </div>
        </div>

        {/* Results Grid */}
        <div>
          {error && (
            <div className="py-20 text-center text-slate-400">{error}</div>
          )}

          {loading && (
            <div className="flex animate-pulse py-32 items-center justify-center space-x-3">
              <div className="h-4 w-4 rounded-full bg-cyan-400"></div>
              <div className="h-4 w-4 rounded-full bg-indigo-400"></div>
              <div className="h-4 w-4 rounded-full bg-emerald-400"></div>
            </div>
          )}

          {!loading && !error && offers.length === 0 && (
            <div className="rounded-[2rem] border border-white/10 bg-white/5 py-24 text-center backdrop-blur-md">
              <p className="mb-6 text-lg text-slate-300">
                Brak ofert spełniających kryteria.
              </p>
              <button
                className="rounded-xl bg-white/10 px-6 py-3 font-semibold text-white transition-colors hover:bg-white/20"
                onClick={clearFilters}
              >
                Wyczyść filtry
              </button>
            </div>
          )}

          {!loading && offers.length > 0 && (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 mt-6">
              {offers.map((o) => (
                <OfferCard key={o.id} o={o} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Algorytm Oceny
const MEAL_FACTOR = {
  "all inclusive": 1.8,
  "3 posiłki": 1.5,
  "full board": 1.45,
  "śniadania i obiadokolacje": 1.35,
  "2 posiłki": 1.25,
  śniadanie: 1.1,
  "bez wyżywienia": 0.85,
};
const STAR_FACTOR = { 2: 1.0, 3: 1.25, 4: 1.55, 5: 1.85 };

function dealScore(o) {
  const perNight = o.price_per_person / o.nights;
  const mealW = MEAL_FACTOR[o.meal_plan] ?? 0.9;
  const starW = STAR_FACTOR[o.stars] ?? 0.95;
  let promoW = 1;
  if (o.lowest_price_30d && o.lowest_price_30d > 0) {
    promoW =
      o.price_per_person < o.lowest_price_30d
        ? 1 +
          ((o.lowest_price_30d - o.price_per_person) / o.lowest_price_30d) * 1.5
        : 0.95;
  }
  return perNight / (mealW * starW * promoW);
}

function pickDeal(offers) {
  if (!offers || !offers.length) return null;
  const candidates = offers
    .filter((o) => o.price_per_person && o.nights >= 4)
    .filter((o) => o.start_date && new Date(o.start_date) >= new Date());
  if (!candidates.length) return null;
  return candidates.reduce((a, b) => (dealScore(b) < dealScore(a) ? b : a));
}
