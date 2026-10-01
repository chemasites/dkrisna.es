---
name: content
description: Maintain bilingual Markdown content and TOML frontmatter.
globs: content/**/*.md
---

# Content Rules

- Content files use **Markdown with TOML frontmatter** (delimited by `+++`)
- Bilingual: every page needs both `.md` (Spanish) and `.en.md` (English)
- Frontmatter fields: `title`, `description`, `template` (optional), `extra` (optional)
- Spanish is the default language - English pages mirror the same slug
- Use components from `templates/components/` for dynamic elements: `{% <whatsapp_link> %}text{% </whatsapp_link> %}`, `{{ <business_phone /> }}`. Content is rendered as a Tera template, so wrap literal `{{` or `{%` in `{% raw %}`
- Keep content focused on SEO - include relevant local keywords (Caravaca de la Cruz, Murcia, etc.)
