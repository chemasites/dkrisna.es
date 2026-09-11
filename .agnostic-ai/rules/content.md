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
- Use shortcodes for dynamic elements: `{{ whatsapp_link() }}`
- Keep content focused on SEO - include relevant local keywords (Caravaca de la Cruz, Murcia, etc.)
