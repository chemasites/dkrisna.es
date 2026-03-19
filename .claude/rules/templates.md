---
globs: templates/**/*.html
---

# Zola Template Rules

- Templates use **Tera** syntax (similar to Jinja2): `{{ variable }}`, `{% if %}`, `{% for %}`
- All user-facing text MUST use `{{ trans(key="key_name", lang=lang) }}` — never hardcode strings
- Translation keys are defined in `config.toml` under `[translations]` (Spanish) and `[languages.en.translations]` (English)
- Access site config via `{{ config.extra.phone }}`, `{{ config.extra.email }}`, etc.
- Partials are in `templates/partials/`, macros in `templates/macros/`, shortcodes in `templates/shortcodes/`
- Base layout is `templates/base.html` — includes all SEO schemas (JSON-LD)
- When adding new translatable text, add the key to BOTH language sections in `config.toml`
