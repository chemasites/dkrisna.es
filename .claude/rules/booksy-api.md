---
globs: scripts/booksy-api.js,scripts/fetch-services.js,scripts/fetch-reviews.js
---

# Booksy Data Fetching

Services and reviews come from Booksy's **public customer REST API**, not from
scraping the hydrated `__NUXT__` data with Playwright.

## Why (do not revert to headless scraping)

GitHub-hosted runners use datacenter IPs that Booksy's hCaptcha bot-detection
flags. The headless browser loaded the page but the server withheld the
embedded `__NUXT__` service/review data, so the nightly sync failed every run
(see the original failure: 3 retries → "No services extracted" → exit 1). A
realistic user-agent / stealth context did not fix it — the block is on IP
reputation, not the UA. The REST API is gated by a public web `api_key`, not by
hCaptcha, so it works from CI.

## How it works (`scripts/booksy-api.js`)

- Base: `https://es.booksy.com/api/es/2/customer_api`
- Business ID: `144031`
- Auth header: `x-api-key`. The key is the public web key shipped in the Booksy
  website HTML (regex `apiKey:"web-..."`). `discoverApiKey()` scrapes it live
  each run so we survive key rotation, with a hardcoded fallback constant.
- Uses Node global `fetch` (no browser, no Playwright dependency).

### Endpoints

- Services: `GET businesses/144031?with_combos=1&with_services=true`
  → `business.service_categories[].services[]`. Note `with_combos` requires the
  integer `1` (not `true`, which returns HTTP 400).
- Reviews: `GET businesses/144031/reviews?per_page=20`
  → `reviews[]` plus `reviews_count` / `reviews_stars`. `per_page`/`page` are
  effectively capped around 20; ~2 anonymized reviews never return text.

## Constraints

- Output JSON shapes are unchanged from the old scraper so the parser, content
  hashing, translation, and templates all keep working. If you change the
  mapping, keep `services.json` / `booksy-reviews.json` shapes stable.
- `fetch-gallery.js` still uses Playwright — only services/reviews moved to the API.
- Category map lives in `fetch-services.js` (`CATEGORY_TRANSLATIONS`,
  `getCategoryId`, `categoryOrder`). Unmapped categories are silently skipped.
