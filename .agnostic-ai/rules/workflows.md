---
name: workflows
description: Maintain deployment and Booksy automation workflows.
globs: .github/workflows/*.yml
---

# GitHub Actions Workflow Rules

- `main.yml` - Builds and deploys to GitHub Pages on push to main
- `update-services.yml` - Weekly (Mon 3 AM UTC) fetch services from Booksy, translate, auto-commit
- `update-reviews.yml` - Weekly (Mon 2 AM UTC) fetch reviews from Booksy, auto-commit
- Booksy data comes from its public REST API (`scripts/booksy-api.js`), not headless scraping - datacenter IPs got hCaptcha-blocked when using Playwright
- Automation workflows use `git pull --rebase` before push to handle concurrent updates
- Always verify the Zola build passes before committing data changes
- Content hash comparison prevents redundant commits when data hasn't changed
