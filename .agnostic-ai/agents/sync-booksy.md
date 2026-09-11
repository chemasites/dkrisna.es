---
name: sync-booksy
description: Fetch latest services and reviews from Booksy
---

Sync data from Booksy (the source of truth for services and reviews).

Source: https://booksy.com/es-es/144031_d-krisna-nails_salon-de-unas_81457_caravaca-de-la-cruz

Steps:
1. Run `cd scripts && npm install` (ensure dependencies are installed)
2. Fetch services: `cd scripts && node fetch-services.js`
3. Fetch reviews: `cd scripts && node fetch-reviews.js`
4. Check if `static/data/services.json` or `static/data/booksy-reviews.json` changed
5. If services changed, translate: `cd scripts && node translate-services.js`
6. Verify the site still builds: `zola build`
7. Report what changed (new services, updated prices, new reviews, etc.)
