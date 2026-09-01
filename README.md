# Last Minute Radar

Porównywarka ofert **last minute** z polskich biur podróży. Scraper (Playwright) zbiera oferty i
zapisuje je do bazy **Supabase (PostgreSQL)**, a przeglądarkowy frontend (Next.js) wyświetla je
przez **Route Handlers** działające na **Vercel**.

## Stack

| Warstwa  | Technologia                                             |
|----------|---------------------------------------------------------|
| Scraper  | Node.js + Playwright (headless Chrome)                  |
| Baza     | Supabase (PostgreSQL) — tabela `offers`                 |
| API      | Next.js Route Handlers (`web/app/api/*`)                |
| Frontend | Next.js (App Router), czysty klient odpytujący własne API |
| Hosting  | Vercel (frontend + API), prywatne repo na GitHub         |

> Lokalny serwer Express (`api/`) pozostaje jako opcjonalne narzędzie developerskie.
> Na Vercel API obsługują natywne Route Handlers.

## Struktura

```
.
├── scraper/           # skrypty scrapujące + harmonogram (CRON)
│   └── src/
│       ├── index.js       # orkiestracja źródeł + CRON co 30 min
│       ├── helpers.js      # wspólny Playwright (browser, cookies, scroll)
│       ├── parse.js        # parsowanie cen/dat/ocen itp.
│       └── sources/
│           ├── itaka.js
│           ├── tui.js
│           ├── rainbow.js
│           └── wakacje.js   # opcjonalne (patrz niżej)
├── api/               # Express API (opcjonalne, developerskie)
│   └── src/
│       ├── index.js       # endpointy REST (eksport „app" bez listen)
│       └── db.js          # klient + upsert Supabase
├── web/               # Next.js (frontend + Route Handlers API)
│   ├── app/
│   │   ├── page.js            # strona główna (karty, filtry, oferta dnia)
│   │   └── api/               # API (route handlers)
│   │       ├── offers/route.js
│   │       ├── offers/[id]/route.js
│   │       ├── filters/route.js
│   │       ├── sources/route.js
│   │       └── stats/route.js
│   └── lib/supabase.js        # klient Supabase (lazy)
├── supabase/migration.sql # schema bazy
└── package.json       # workspace + skrypty
```

## Szybki start

```bash
# 1. Zainstaluj zależności (wszystkie workspaces)
npm install

# 2. Zainstaluj przeglądarkę Chromium dla Playwright (wymagane raz)
npx playwright install chromium

# 3. Skonfiguruj zmienne środowiskowe (Supabase token)
#    Skopiuj .env.example i uzupełnij SUPABASE_URL + SUPABASE_SERVICE_KEY

# 4. Uruchom scraper jednorazowo (zbierze oferty do Supabase)
npm run scrape:once

# 5. Uruchom frontend + API (http://localhost:3000)
npm run web
```

Alternatywnie `npm run dev` uruchamia web oraz lokalny API Express (jeśli go potrzebujesz).

### Tryb ciągły (CRON)

```bash
npm run scrape
```

Uruchomi scraper, a następnie będzie aktualizował oferty **co 30 minut** automatycznie.
Na produkcji scraper nie działa na Vercel (serverless) — uruchamiaj go lokalnie lub przez
cron (np. GitHub Actions / osobny serwer).

### Automatyczne odświeżanie: GitHub Actions

W repo znajduje się `.github/workflows/scrape.yml` — uruchamia scraper co 30 minut
(`*/30 * * * *`) i zapisuje oferty do Supabase. Wymagane sekrety w repo (Settings → Secrets → Actions):
- `SUPABASE_URL`
- `SUPABASE_SERVICE_KEY`

Po każdym scrapie oferty, które **nie pojawiły się w listingu od ponad 6 godzin**, są
automatycznie usuwane z bazy (`pruneOffers`), dzięki czemu tabela nie rośnie w nieskończoność.

### Zasilanie gwiazdek

- **TUI** — gwiazdki tylko na stronie oferty (`#__NEXT_DATA__`); scraper pobiera je z cache w bazie
  (klucz `source|hotel_name`), a dla nowych hoteli odwiedza stronę szczegółów.
- **Rainbow** — gwiazdki z sekcji „Kategoria lokalna” (znaki `*` lub słownie, np. „Trzy klucze”).
  Zdjęcia Rainbow są lazy-loadowane — scraper scrolluje stronę, zanim pobierze `src` kafelków.

## API (Route Handlers, na Vercel bez Build Config)

| Endpoint              | Opis                                          |
|-----------------------|-----------------------------------------------|
| `GET /api/offers`      | Lista ofert (filtrowanie, sortowanie, paginacja) |
| `GET /api/offers/:id`  | Pojedyncza oferta                             |
| `GET /api/filters`     | Unikalne kraje, wyżywienia i źródła do filtrów |
| `GET /api/sources`     | Statystyki per biuro podróży                  |
| `GET /api/stats`       | Ogólne statystyki                             |

Parametry `GET /api/offers`:
`?source=tui&q=hotel&destination=...&country=Grecja&meal_plan=all inclusive&min_stars=4&nights_min=5&nights_max=8&max_price=2000&min_rating=7&sort=price|rating|newest&order=asc|desc&limit=100&offset=0`

## Jak to działa

1. **Scraper (lokalnie/CI)** → Playwright otwiera headless Chrome i wchodzi na strony biur podróży,
   akceptuje cookies, przewija stronę, by wymusić lazy-loading kafelków.
2. **Ekstrakcja** → nazwa hotelu, destynacja, cena za osobę, terminy, liczba nocy, miasto wylotu,
   wyżywienie, ocena i liczba opinii.
3. **Zapis** → oferty upsertowane do Supabase (klucz naturalny `source + source_id`), więc
   wielokrotne uruchomienia nie tworzą duplikatów.
4. **Vercel** → frontend (Next.js) odpytywa własne Route Handlers (`/api/*`), które czytają
   z Supabase. Wszystko w jednym origin — bez CORS i bez proxy.
5. **CRON (lokalny/CI)** → świeży kontakt co 30 minut.

## Zmienne środowiskowe

| Zmienna                 | Gdzie potrzebna                     | Uwagi |
|-------------------------|-------------------------------------|-------|
| `SUPABASE_URL`          | scraper, Vercel (Route Handlers)   | URL projektu |
| `SUPABASE_SERVICE_KEY`  | scraper (writes), Vercel (reads)   | service_role = pełny dostęp; anon wystarcza do odczytu |

> **Nie komituj** sekretów. `.env`, `*.local` i pliki z kluczami są w `.gitignore`.
> Na Vercel ustaw `SUPABASE_URL` oraz `SUPABASE_SERVICE_KEY` w **Environment Variables**
> (Settings → Environment Variables).

## Źródła i znane ograniczenia

- **ITAKA** — działa stabilnie; gwiazdki hotelu i zdjęcie z kafelka.
- **TUI** — działa stabilnie (oferty per destynacja z menu Last Minute); zdjęcie z kafelka.
  Gwiazdki hotelu pobierane ze strony oferty (`#__NEXT_DATA__` → `"stars":N`), korzystając
  z cache w bazie (dla nowych hoteli realizowane przez wizytę na stronie szczegółów).
- **Rainbow (r.pl)** — pełna lista przez paginację `?strona=N` (limit ~30 stron); zdjęcie i ocena
  gości z karty. Gwiazdki hotelu pobierane ze strony oferty jako sekcja **"Kategoria lokalna"**
  (liczba `*` jak `***` = 3, a słownie np. „Trzy klucze”), również z cache w bazie.
- **Wakacje.pl** — mocna ochrona anty-bot, bywa niestabilna. **Domyślnie wyłączona**:

  ```bash
  SCRAPE_WAKACJE=1 node scraper/src/index.js --once
  ```

### Uwagi prawne / etyczne

- Scraper pobiera dane publicznie dostępne. **Nie obchodź** captcha, nie przeciążaj serwerów,
  szanuj `robots.txt`.
- Ceny zmieniają się — zawsze sprawdzaj finalną cenę na stronie biura przed rezerwacją.

## Rozwój (pomysły na next)

- Grupowe scrapowanie w cronie CI (np. GitHub Actions co godzinę).
- Obsługa kolejnych biur (Rainbow, Coral Travel, Nexter, Exim).
- Monitoring spadków cen (powiadomienia e-mail/push).
- Historia cen w czasie.
- User accounts + ulubione.