# Last Minute Radar

Porównywarka ofert **last minute** z polskich biur podróży. Scraper (Playwright) zbiera oferty,
zapisuje do bazy SQLite, a frontend (Next.js) wyświetla je przez API (Express).

## Stack

| Warstwa  | Technologia                                             |
|----------|---------------------------------------------------------|
| Scraper  | Node.js + Playwright (headless Chrome)                  |
| Baza     | SQLite (better-sqlite3)                                 |
| API      | Express                                                 |
| Frontend | Next.js (App Router), czysty klient odpytujący własne API |

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
│           └── wakacje.js   # opcjonalne (patrz niżej)
├── api/               # Express + SQLite
│   └── src/
│       ├── index.js       # endpointy REST
│       ├── db.js          # schema + upsert ofert
│       └── config.js
├── web/               # Next.js frontend
└── package.json       # workspace + skrypty
```

## Szybki start

```bash
# 1. Zainstaluj zależności (wszystkie workspaces)
npm install

# 2. Zainstaluj przeglądarkę Chromium dla Playwright (wymagane raz)
npx playwright install chromium

# 3. Uruchom scraper jednorazowo (zbierze świeże oferty do bazy)
npm run scrape:once

# 4. Uruchom API (http://localhost:4000) w osobnym terminalu
npm run api

# 5. Uruchom frontend (http://localhost:3000) w osobnym terminalu
npm run web
```

Alternatywnie `npm run dev` uruchamia API i web w jednym (odtwarzaj oba w rożnych terminalach,
bo używają `&&`).

### Tryb ciągły (CRON)

```bash
npm run scrape
```
Uruchomi scraper, a następnie będzie pobierał oferty **co 30 minut** automatycznie.

## API

| Endpoint              | Opis                                          |
|-----------------------|-----------------------------------------------|
| `GET /api/offers`      | Lista ofert (filtrowanie, sortowanie, paginacja) |
| `GET /api/offers/:id`  | Pojedyncza oferta                             |
| `GET /api/sources`     | Statystyki per biuro podróży                  |
| `GET /api/stats`       | Ogólne statystyki                             |

Parametry `GET /api/offers`:
`?source=tui&q=hotel&destination=...&max_price=2000&min_rating=7&sort=price|rating|newest&order=asc|desc&limit=100&offset=0&fresh_for=48`

## Jak to działa

1. **Uruchomienie scrapera** → Playwright otwiera headless Chrome i wchodzi na strony biur podróży,
   akceptuje cookies, przewija stronę, by wymusić lazy-loading kafelków.
2. **Ekstrakcja** → z każdego kafelka wyciągane są: nazwa hotelu, destynacja, cena za osobę,
   terminy, liczba nocy, miasto wylotu, wyżywienie, ocena i liczba opinii.
3. **Zapis** → oferty upsertowane do SQLite (klucz naturalny `source + source_id`), więc
   wielokrotne uruchomienia nie tworzą duplikatów.
4. **API** → frontend odpytuje wyłącznie Twoją własną bazę (błyskawicznie, bez obciążania biur).
5. **CRON** → świeży kontakt co 30 minut.

## Źródła i znane ograniczenia

- **ITAKA** — działa stabilnie. Dużo czystych danych (ceny „/os.", terminy, oceny).
- **TUI** — działa stabilnie. Oferty per destynacja z menu Last Minute.
- **Wakacje.pl** — ma bardzo mocną ochronę anty-bot (party znajduje się w `sources/wakacje.js`),
  bywa niestabilna i potrafi zablokować/zwolnić żądania. **Domyślnie wyłączona**. Aby włączyć:

  ```bash
  SCRAPE_WAKACJE=1 node scraper/src/index.js --once
  ```

### Uwagi prawne / etyczne

- Scraper pobiera dane publicznie dostępne na stronach biur podróży. **Nie obchodź** captcha,
  nie przeciążaj serwerów i szanuj `robots.txt`.
- Ceny zmieniają się — zawsze sprawdzaj finalną cenę na stronie biura przed rezerwacją.
- Używaj własnych danych (własna baza) — to główna zaleta tego rozwiązania.

## Rozwój (pomysły na next)

- Obsługa kolejnych biur (Rainbow, Coral Travel, Nexter, Exim).
- Monitorowanie spadków cen (powiadomienia e-mail/push).
- Historia cen w czasie dla każdej oferty.
- User accounts + ulubione.
- Filtr po państwie/miejscowości z mapy.
