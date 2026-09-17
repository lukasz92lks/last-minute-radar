"use client";

import { useCallback, useEffect, useState } from "react";

const SOURCE_LABELS = {
  tui: "TUI",
  itaka: "ITAKA",
  wakacje: "Wakacje.pl",
  rainbow: "Rainbow",
};

const STAR_LABEL = { 2: "2★", 3: "3★", 4: "4★", 5: "5★" };

const BADGE_COLORS = {
  tui: "bg-cyan-500/10 text-cyan-400",
  itaka: "bg-indigo-500/10 text-indigo-400",
  wakacje: "bg-emerald-500/10 text-emerald-400",
  rainbow: "bg-amber-500/10 text-amber-400",
};

async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function OfferCard({ o, compact }) {
  return (
    <div
      className={`group relative overflow-hidden rounded-2xl border flex transition-all duration-300 hover:shadow-xl ${
        compact
          ? "flex-col sm:flex-row items-center gap-4 border-amber-500/30 bg-gradient-to-r from-amber-500/10 to-amber-500/5 p-3 hover:border-amber-500/50"
          : "flex-col gap-3 border-[#24344f] bg-gradient-to-b from-[#141f33] to-[#101a2c] pb-4 hover:-translate-y-2 hover:border-[#33476b] hover:shadow-cyan-500/10"
      }`}
    >
      {o.image_url && (
        <div
          className={`relative overflow-hidden bg-[#1b2942] ${
            compact
              ? "aspect-[16/10] w-full sm:w-48 shrink-0 rounded-xl shadow-lg"
              : "aspect-video w-full"
          }`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={o.image_url}
            alt={o.hotel_name}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        </div>
      )}
      <div
        className={`flex flex-col gap-2 ${compact ? "flex-1 px-1" : "px-4"}`}
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            <div
              className={`font-bold leading-tight ${compact ? "text-lg text-white" : "text-base text-gray-100"}`}
            >
              {o.hotel_name}
            </div>
            {o.destination && (
              <div className="text-sm text-slate-400 line-clamp-1">
                {o.destination}
              </div>
            )}
            {o.country && !compact && (
              <div className="text-sm text-slate-400">🌍 {o.country}</div>
            )}
          </div>
          <span
            className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-black uppercase tracking-wider ${
              BADGE_COLORS[o.source] || "bg-slate-800 text-slate-300"
            }`}
          >
            {SOURCE_LABELS[o.source] || o.source}
          </span>
        </div>

        {!compact &&
          (o.start_date || o.nights || o.meal_plan || o.departure_city) && (
            <div className="flex flex-wrap gap-1.5 text-[13px] text-slate-400">
              {o.start_date && (
                <span className="rounded-md bg-[#1b2942] px-2 py-1">
                  {new Date(o.start_date).toLocaleDateString("pl-PL")}
                  {o.end_date &&
                    ` – ${new Date(o.end_date).toLocaleDateString("pl-PL")}`}
                </span>
              )}
              {o.nights ? (
                <span className="rounded-md bg-[#1b2942] px-2 py-1">
                  {o.nights} nocy
                </span>
              ) : null}
              {o.meal_plan ? (
                <span className="rounded-md bg-[#1b2942] px-2 py-1">
                  {o.meal_plan}
                </span>
              ) : null}
              {o.departure_city ? (
                <span className="rounded-md bg-[#1b2942] px-2 py-1">
                  wylot: {o.departure_city}
                </span>
              ) : null}
            </div>
          )}

        {!compact && (
          <div className="flex flex-wrap gap-2 text-sm text-slate-400">
            {o.stars ? (
              <span className="font-bold tracking-widest text-amber-400">
                {"★".repeat(o.stars)}
              </span>
            ) : null}
            {o.rating ? (
              <span className="font-bold text-emerald-400">
                ★ {o.rating.toFixed(1)}
              </span>
            ) : null}
            {o.reviews ? <span>{o.reviews} opinii</span> : null}
          </div>
        )}

        <div
          className={`mt-auto flex items-end justify-between gap-2 ${compact ? "pt-2" : "pt-4"}`}
        >
          <div className="leading-none">
            <div
              className={`font-black tracking-tight ${compact ? "text-2xl text-amber-400" : "text-xl text-white"}`}
            >
              {o.price_per_person
                ? `${o.price_per_person.toLocaleString("pl-PL")} zł`
                : "—"}
              <small className="text-xs font-normal text-slate-400">
                {" "}
                / os.
              </small>
            </div>
            {!compact &&
              o.lowest_price_30d &&
              o.lowest_price_30d < o.price_per_person && (
                <div className="mt-1 text-xs text-slate-400">
                  najniżej: {o.lowest_price_30d.toLocaleString("pl-PL")} zł
                </div>
              )}
          </div>
          {o.url && (
            <a
              href={o.url}
              target="_blank"
              rel="noreferrer"
              className="group/btn flex items-center gap-1 whitespace-nowrap text-sm font-bold text-cyan-400 transition-colors hover:text-indigo-400"
            >
              Sprawdź
              <span className="transition-transform group-hover/btn:translate-x-1">
                →
              </span>
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

  const inputClasses =
    "bg-[#141f33] border border-[#24344f] text-slate-200 rounded-xl px-4 py-2.5 text-sm transition-colors focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400 w-full md:w-auto placeholder:text-slate-500";

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      {/* Header */}
      <header className="sticky top-0 z-20 -mx-4 border-b border-[#24344f] bg-[#0b1220]/80 px-4 py-5 backdrop-blur-md sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <div className="flex items-baseline gap-2 text-2xl font-black tracking-tighter text-white sm:text-3xl">
          <svg
            className="h-8 w-8 shrink-0 drop-shadow-[0_0_8px_rgba(56,189,248,0.5)] sm:h-9 sm:w-9"
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
            <g className="radar-spin">
              <path
                d="M32,32 L21.74,3.81 A30,30 0 0 1 61.54,26.79 Z"
                fill="url(#radar-sweep)"
                opacity="0.5"
              />
              <circle cx="47" cy="15" r="3.2" fill="#fbbf24" opacity="0.95" />
            </g>
            <circle cx="32" cy="32" r="4" fill="#e8eef7" />
          </svg>
          <span className="text-red-400">Last Minute</span>
          <span className="bg-gradient-to-r from-cyan-400 to-indigo-400 bg-clip-text text-transparent">
            Radar
          </span>
        </div>
        <div className="mt-1 text-xs text-slate-400 sm:text-sm">
          Oferty z polskich biur podróży zebrane w jedno miejsce.
        </div>
      </header>

      {/* Stats Bar */}
      <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-4">
        {[
          { label: "ofert", val: stats?.total ?? "…" },
          {
            label: "najtańsza",
            val: stats?.min_price ? `od ${stats.min_price} zł` : "…",
          },
          {
            label: "średnia cena",
            val: stats?.avg_price ? `${stats.avg_price} zł` : "…",
          },
          {
            label: "aktualizacja",
            val: stats?.updated_at
              ? new Date(stats.updated_at).toLocaleString("pl-PL", {
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "…",
          },
        ].map((stat, i) => (
          <div
            key={i}
            className="flex flex-col justify-center rounded-2xl border border-[#24344f] bg-gradient-to-b from-[#101a2c] to-[#141f33] p-4 shadow-lg"
          >
            <div className="text-xl font-black text-white sm:text-2xl">
              {stat.val}
            </div>
            <div className="mt-1 text-[10px] uppercase tracking-wider text-slate-400 sm:text-xs">
              {stat.label}
            </div>
          </div>
        ))}
      </div>

      {/* Deal of the day */}
      {dealOfDay && (
        <div className="relative mt-8 overflow-hidden rounded-3xl border border-amber-500/30 bg-gradient-to-br from-amber-500/10 via-transparent to-transparent p-6 shadow-2xl">
          <div className="absolute -top-24 -right-24 h-64 w-64 rounded-full bg-amber-500/20 blur-[80px]" />
          <div className="relative z-10">
            <div className="mb-4 flex items-center gap-3 text-xs font-black uppercase tracking-widest text-amber-400">
              🔥 Oferta dnia
              <div className="h-px flex-1 bg-gradient-to-r from-amber-500/50 to-transparent" />
            </div>
            <OfferCard o={dealOfDay} compact />
            <div className="mt-3 flex justify-end gap-2">
              {dealOfDay.price_per_person && dealOfDay.nights ? (
                <span className="rounded-full bg-amber-500/20 px-3 py-1 text-xs font-bold text-amber-400 shadow-sm">
                  ~
                  {Math.round(
                    dealOfDay.price_per_person / dealOfDay.nights,
                  ).toLocaleString("pl-PL")}{" "}
                  zł / noc
                </span>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="mt-8 flex flex-col gap-4 rounded-2xl bg-[#101a2c]/50 p-4">
        <div className="flex flex-wrap gap-3">
          <input
            className={`${inputClasses} flex-1 md:min-w-[240px]`}
            placeholder="Szukaj hotelu / miejscowości…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <select
            className={inputClasses}
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
            className={inputClasses}
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
            className={inputClasses}
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
            className={inputClasses}
            value={minStars}
            onChange={(e) => setMinStars(e.target.value)}
          >
            <option value="">Gwiazdki: dowolne</option>
            <option value="3">3★ lub więcej</option>
            <option value="4">4★ lub więcej</option>
            <option value="5">5★</option>
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-semibold text-slate-400">
            Lotniska:
          </span>
          <div className="flex flex-wrap gap-2">
            {filters.departure_cities.map((c) => {
              const active = departureCities.includes(c);
              return (
                <button
                  key={c}
                  type="button"
                  className={`rounded-full px-3 py-1.5 text-xs font-bold transition-all ${
                    active
                      ? "bg-gradient-to-r from-cyan-400 to-indigo-400 text-[#0b1220] shadow-[0_0_12px_rgba(56,189,248,0.4)]"
                      : "border border-[#24344f] bg-[#141f33] text-slate-300 hover:border-[#33476b] hover:bg-[#1b2942]"
                  }`}
                  onClick={() =>
                    setDepartureCities((prev) =>
                      active ? prev.filter((x) => x !== c) : [...prev, c],
                    )
                  }
                >
                  {active && <span className="mr-1">✓</span>}
                  {c}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <input
            placeholder="Min. nocy"
            className={`${inputClasses} w-24`}
            value={nightsMin}
            onChange={(e) => setNightsMin(e.target.value.replace(/\D/g, ""))}
          />
          <input
            placeholder="Max. nocy"
            className={`${inputClasses} w-24`}
            value={nightsMax}
            onChange={(e) => setNightsMax(e.target.value.replace(/\D/g, ""))}
          />
          <input
            placeholder="Max cena (zł)"
            className={`${inputClasses} w-32`}
            value={maxPrice}
            onChange={(e) => setMaxPrice(e.target.value.replace(/\D/g, ""))}
          />
          <select
            className={inputClasses}
            value={sort}
            onChange={(e) => setSort(e.target.value)}
          >
            <option value="price">Cena</option>
            <option value="rating">Ocena</option>
            <option value="newest">Najnowsze</option>
          </select>
          <select
            className={inputClasses}
            value={order}
            onChange={(e) => setOrder(e.target.value)}
          >
            <option value="asc">Rosnąco</option>
            <option value="desc">Malejąco</option>
          </select>
          <button
            onClick={load}
            className="ml-auto rounded-xl bg-gradient-to-r from-cyan-400 to-indigo-400 px-6 py-2.5 text-sm font-black text-[#04121f] transition-all hover:scale-105 hover:brightness-110 active:scale-95"
          >
            Szukaj ofert
          </button>
        </div>
      </div>

      {/* Results */}
      <div className="mt-8 mb-20">
        {error && (
          <div className="py-20 text-center text-slate-400">{error}</div>
        )}
        {loading && (
          <div className="flex animate-pulse py-20 items-center justify-center space-x-2 text-cyan-400">
            <div className="h-3 w-3 rounded-full bg-cyan-400"></div>
            <div className="h-3 w-3 rounded-full bg-cyan-400 animation-delay-200"></div>
            <div className="h-3 w-3 rounded-full bg-cyan-400 animation-delay-400"></div>
          </div>
        )}

        {!loading && !error && offers.length === 0 && (
          <div className="py-20 text-center text-slate-400">
            <p className="mb-4 text-sm">
              Brak ofert spełniających kryteria. Spróbuj zmniejszyć liczbę
              filtrów.
            </p>
            <button
              className="rounded-xl border border-[#33476b] px-4 py-2 text-sm font-semibold transition-colors hover:border-cyan-400 hover:text-cyan-400"
              onClick={clearFilters}
            >
              Wyczyść filtry
            </button>
          </div>
        )}

        {!loading && offers.length > 0 && (
          <>
            <div className="mb-4 text-sm font-semibold text-slate-400">
              Znaleziono {total} ofert
            </div>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {offers.map((o) => (
                <OfferCard key={o.id} o={o} />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Footer */}
      <footer className="border-t border-[#24344f] py-8 text-center text-xs text-slate-500 sm:text-sm">
        Dane zbierane automatycznie ze stron biur podróży. Ceny mogą się
        zmieniać — sprawdź na stronie biura przed rezerwacją.
      </footer>
    </div>
  );
}

// ---- Oferta dnia: algorytm punktowy ----
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
