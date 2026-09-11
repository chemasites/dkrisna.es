---
name: scripts
description: Follow Node.js automation and data pipeline conventions.
globs: scripts/**/*.js
---

# Scripts Rules

- All scripts use **ES modules** (`import`/`export`, `"type": "module"` in package.json)
- Tests use **Vitest** - test files are `*.test.js` alongside source files
- Booksy is the source of truth for services and reviews: https://booksy.com/es-es/144031_d-krisna-nails_salon-de-unas_81457_caravaca-de-la-cruz
- Services/reviews fetching uses Booksy's public REST API directly (`booksy-api.js` + global `fetch`) - no browser. `fetch-gallery.js` still uses **Playwright**.
- Content hashing (`content-hash.js`) detects changes to avoid redundant commits
- Translation uses the **Anthropic API** (`@anthropic-ai/sdk`)
- Output JSON files go to `static/data/` - these are committed to the repo
