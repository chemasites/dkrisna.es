---
globs: sass/**/*.scss
---

# SCSS Style Rules

- Organized by SMACSS: `abstracts/` → `base/` → `components/` → `layout/` → `pages/` → `utilities/`
- Variables are in `sass/abstracts/_variables.scss` — use existing color/spacing/font variables
- Zola compiles SCSS automatically — entry point is `sass/style.scss`
- Use BEM-like naming for component classes
- Mobile-first approach — use min-width media queries for larger screens
- No JavaScript framework — all interactivity is CSS-only or minimal vanilla JS
