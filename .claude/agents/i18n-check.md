---
name: i18n-check
description: Verify bilingual content consistency between Spanish and English
---

Check that all bilingual content is consistent and complete.

Steps:
1. **Content pages**: For every `.md` file in `content/`, verify a matching `.en.md` exists
2. **Translation keys**: Compare `[translations]` and `[languages.en.translations]` in `config.toml` — flag any keys present in one but missing in the other
3. **Template usage**: Search templates for `trans(key=` calls and verify each key exists in both language sections of `config.toml`
4. **Data files**: Verify `static/data/services.en.json` exists alongside `static/data/services.json`

Report any missing translations, orphaned keys, or inconsistencies.
