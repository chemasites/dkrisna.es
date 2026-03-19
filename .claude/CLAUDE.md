# D'Krisna - Beauty Salon Website

## Project Overview
Static website for D'Krisna beauty salon (Caravaca de la Cruz, Murcia, Spain) built with **Zola** (v0.21.0+), a Rust-based static site generator. Deployed to GitHub Pages at https://dkrisna.es.

## Tech Stack
- **SSG**: Zola (Rust) — templates use Tera/Jinja2 syntax
- **Styles**: SCSS (compiled by Zola) — organized by SMACSS pattern
- **Content**: Markdown with TOML frontmatter, bilingual (es/en)
- **Scripts**: Node.js (ES modules) — Playwright for scraping, Vitest for tests
- **Data sync**: Booksy integration via automated scripts + GitHub Actions
- **Translation**: Anthropic API for auto-translating services to English
- **CI/CD**: GitHub Actions → GitHub Pages

## Key Directories
- `content/` — Markdown pages (`.md` = Spanish, `.en.md` = English)
- `templates/` — Tera HTML templates (base, pages, partials, macros, shortcodes)
- `sass/` — SCSS organized: abstracts, base, components, layout, pages, utilities
- `static/data/` — JSON data files (services, reviews) synced from Booksy
- `scripts/` — Node.js automation (fetch, translate, hash)
- `.github/workflows/` — CI/CD pipelines

## Build & Test Commands
```bash
zola build          # Build the site (output in public/)
zola serve          # Dev server with live reload
cd scripts && npm test       # Run Vitest tests
cd scripts && npm install    # Install script dependencies
```

## Data Pipeline
Services and reviews are fetched from Booksy nightly via GitHub Actions:
- Source: https://booksy.com/es-es/144031_d-krisna-nails_salon-de-unas_81457_caravaca-de-la-cruz
- `scripts/fetch-services.js` → `static/data/services.json`
- `scripts/fetch-reviews.js` → `static/data/booksy-reviews.json`
- `scripts/translate-services.js` → `static/data/services.en.json`
- Content hashing detects changes to avoid redundant commits

## Conventions
- Bilingual: every content page needs both `.md` and `.en.md`
- Translations in `config.toml` under `[translations]` and `[languages.en.translations]`
- All UI text must be translatable — use `{{ trans(key="...", lang=lang) }}` in templates
- SEO: structured data (JSON-LD schemas) in `templates/base.html`
- Commit style: conventional commits (feat, fix, chore, ref, etc.)
