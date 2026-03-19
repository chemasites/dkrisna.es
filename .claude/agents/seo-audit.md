---
name: seo-audit
description: Audit SEO elements across the site
---

Perform an SEO audit of the D'Krisna website.

Check the following:
1. **Structured data**: Verify JSON-LD schemas in `templates/base.html` are valid and complete (LocalBusiness, WebSite, Review, etc.)
2. **Meta tags**: Check that all pages have proper title, description, og:*, and Twitter card meta tags
3. **Bilingual SEO**: Verify hreflang tags and alternate language links are present
4. **Sitemap**: Confirm sitemap.xml generation is working
5. **Robots.txt**: Verify proper configuration
6. **PWA manifest**: Check `static/manifest.json` if present
7. **Performance hints**: Check for font preloading, image optimization opportunities

Report findings with specific file locations and suggested improvements.
