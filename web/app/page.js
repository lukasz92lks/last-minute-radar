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
      className={`group relative overflow-hidden rounded-[2rem] border border-white/10 bg-[#0f172a] shadow-xl transition-all duration-300 hover:-translate-y-1 hover:shadow-cyan-500/20 ${
        isDealOfDay ? "h-full min-h-[360px]" : "h-[360px]"
      }`}
    >
      {/* Tło - Zdjęcie hotelu z łagodnym przyciemnieniem */}
      {o.image_url && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={o.image_url}
            alt={o.hotel_name}
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
          {/* Wydajny gradient liniowy zamiast blur, z mniejszym kryciem dla lepszej widoczności zdjęcia */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/60 to-transparent" />
        </>
      )}

      {/* Tagi na górze karty */}
      <div className="absolute left-5 top-5 right-5 flex items-start justify-between z-10">
        <span
          className={`rounded-2xl border px-3 py-1.5 text-xs font-black uppercase tracking-wider shadow-md ${
            BADGE_COLORS[o.source] || "border-white/20 bg-black/40 text-white"
          }`}
        >
          {SOURCE_LABELS[o.source] || o.source}
        </span>
        {isDealOfDay && (
          <span className="animate-pulse rounded-2xl bg-amber-500 px-3 py-1.5 text-xs font-black uppercase tracking-widest text-amber-950 shadow-md">
            🔥 Oferta Dnia
          </span>
        )}
      </div>

      {/* Detale na dole karty */}
      <div className="absolute bottom-0 inset-x-0 flex flex-col justify-end p-5">
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
        <p className="mt-1 text-sm text-slate-300 drop-shadow-md">
          {o.destination} {o.country && `• ${o.country}`}
        </p>

        {/* Metadane wycieczki - odchudzone */}
        <div className="mt-3 mb-3 flex flex-wrap gap-2 text-xs font-medium text-slate-200">
          {o.start_date && (
            <span className="rounded-xl bg-black/50 border border-white/5 px-2.5 py-1">
              {new Date(o.start_date).toLocaleDateString("pl-PL").slice(0, 5)}
              {o.end_date &&
                ` - ${new Date(o.end_date).toLocaleDateString("pl-PL").slice(0, 5)}`}
            </span>
          )}
          {o.nights ? (
            <span className="rounded-xl bg-black/50 border border-white/5 px-2.5 py-1">
              {o.nights} nocy
            </span>
          ) : null}
          {o.meal_plan ? (
            <span className="rounded-xl bg-black/50 border border-white/5 px-2.5 py-1">
              {o.meal_plan}
            </span>
          ) : null}
        </div>

        {/* Cena i przycisk */}
        <div className="flex items-end justify-between border-t border-white/10 pt-3">
          <div>
            <div className="text-2xl font-black text-white drop-shadow-lg">
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
              className="flex h-9 items-center justify-center rounded-xl bg-white text-sm font-bold text-black transition-colors hover:bg-cyan-400 px-4 shadow-md"
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

  const inputClass =
    "bg-[#1e293b] border border-white/5 text-white rounded-xl px-4 py-2.5 text-sm transition-colors focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400 w-full placeholder:text-slate-500 shadow-inner";

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-200 selection:bg-cyan-500/30 pb-20">
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8">
        {/* Header - zoptymalizowany */}
        <header className="sticky top-0 z-50 mb-6 py-4 bg-[#0f172a]/95 backdrop-blur-sm border-b border-white/5">
          <div className="flex items-center gap-3 text-2xl font-black tracking-tighter text-white">
            <svg
              className="h-8 w-8 shrink-0 text-cyan-400"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
            <div>
              <span className="text-white">Last Minute</span>
              <span className="text-cyan-400">Radar</span>
            </div>
          </div>
        </header>

        {/* Bento Grid: Oferta Dnia + Statystyki */}
        <div className="mb-6 grid grid-cols-1 lg:grid-cols-3 gap-5">
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
                bg: "bg-[#1e293b]",
              },
              {
                label: "Najtańsza opcja",
                val: stats?.min_price ? `${stats.min_price} zł` : "…",
                bg: "bg-[#1e293b]",
              },
              {
                label: "Średnia rynkowa",
                val: stats?.avg_price ? `${stats.avg_price} zł` : "…",
                bg: "bg-[#1e293b]",
              },
              {
                label: "Ostatni skan",
                val: stats?.updated_at
                  ? new Date(stats.updated_at).toLocaleTimeString("pl-PL", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : "…",
                bg: "bg-[#1e293b]",
              },
            ].map((stat, i) => (
              <div
                key={i}
                className={`relative flex flex-col justify-center rounded-3xl border border-white/5 p-5 shadow-lg ${stat.bg}`}
              >
                <div className="text-2xl font-black text-white">{stat.val}</div>
                <div className="mt-1 text-xs font-semibold uppercase tracking-wider text-slate-400">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Filtry - zoptymalizowane pod wydajność */}
        <div className="mb-8 flex flex-col gap-4 rounded-[2rem] bg-[#1e293b]/50 p-5 shadow-lg border border-white/5">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
            <input
              className={inputClass}
              placeholder="Dokąd chcesz lecieć?"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <select
              className={`${inputClass} appearance-none`}
              value={source}
              onChange={(e) => setSource(e.target.value)}
            >
              <option value="">Wszystkie biura</option>
              {filters.sources.map((s) => (
                <option key={s} value={s}>
                  {SOURCE_LABELS[s] || s}
                </option>
              ))}
            </select>
            <select
              className={`${inputClass} appearance-none`}
              value={country}
              onChange={(e) => setCountry(e.target.value)}
            >
              <option value="">Wszystkie kraje</option>
              {filters.countries.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <select
              className={`${inputClass} appearance-none`}
              value={mealPlan}
              onChange={(e) => setMealPlan(e.target.value)}
            >
              <option value="">Każde wyżywienie</option>
              {filters.meal_plans.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
            <select
              className={`${inputClass} appearance-none`}
              value={minStars}
              onChange={(e) => setMinStars(e.target.value)}
            >
              <option value="">Gwiazdki: dowolne</option>
              <option value="3">3★ lub więcej</option>
              <option value="4">4★ lub więcej</option>
              <option value="5">5★</option>
            </select>
          </div>

          <div className="flex flex-wrap items-center gap-2 border-t border-white/5 pt-3">
            <span className="text-sm font-semibold text-slate-400 mr-2">
              Wyloty:
            </span>
            {filters.departure_cities.map((c) => {
              const active = departureCities.includes(c);
              return (
                <button
                  key={c}
                  type="button"
                  className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${
                    active
                      ? "bg-cyan-500 text-[#0f172a]"
                      : "bg-[#0f172a] text-slate-300 hover:bg-slate-800"
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

          <div className="grid grid-cols-2 md:grid-cols-6 gap-3 border-t border-white/5 pt-3">
            <input
              placeholder="Min nocy"
              className={inputClass}
              value={nightsMin}
              onChange={(e) => setNightsMin(e.target.value.replace(/\D/g, ""))}
            />
            <input
              placeholder="Max nocy"
              className={inputClass}
              value={nightsMax}
              onChange={(e) => setNightsMax(e.target.value.replace(/\D/g, ""))}
            />
            <input
              placeholder="Max cena"
              className={inputClass}
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value.replace(/\D/g, ""))}
            />
            <select
              className={`${inputClass} appearance-none`}
              value={sort}
              onChange={(e) => setSort(e.target.value)}
            >
              <option value="price">Cena</option>
              <option value="rating">Ocena</option>
              <option value="newest">Najnowsze</option>
            </select>
            <select
              className={`${inputClass} appearance-none`}
              value={order}
              onChange={(e) => setOrder(e.target.value)}
            >
              <option value="asc">Rosnąco</option>
              <option value="desc">Malejąco</option>
            </select>
            <button
              onClick={load}
              className="rounded-xl bg-cyan-500 text-[#0f172a] font-black transition-colors hover:bg-cyan-400 h-full min-h-[42px]"
            >
              Szukaj
            </button>
          </div>
        </div>

        {/* Results Grid */}
        <div>
          {error && (
            <div className="py-12 text-center text-slate-400">{error}</div>
          )}

          {loading && (
            <div className="flex animate-pulse py-20 items-center justify-center space-x-2">
              <div className="h-3 w-3 rounded-full bg-cyan-500"></div>
              <div className="h-3 w-3 rounded-full bg-slate-500"></div>
              <div className="h-3 w-3 rounded-full bg-slate-600"></div>
            </div>
          )}

          {!loading && !error && offers.length === 0 && (
            <div className="rounded-3xl border border-white/5 bg-[#1e293b]/30 py-16 text-center">
              <p className="mb-4 text-sm text-slate-400">
                Brak ofert spełniających kryteria.
              </p>
              <button
                className="rounded-lg bg-[#0f172a] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-800 border border-white/10"
                onClick={clearFilters}
              >
                Wyczyść filtry
              </button>
            </div>
          )}

          {!loading && offers.length > 0 && (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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
