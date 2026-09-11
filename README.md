# D'Krisna - Centro de Belleza y Bienestar

Website for D'Krisna, a beauty and wellness center located in Caravaca de la Cruz, Murcia, Spain.

## Tech

### Prerequisites

- [Zola](https://www.getzola.org/documentation/getting-started/installation/) (0.21.0 or higher)

### Getting Started

1. Clone the repository:
```bash
git clone https://github.com/Chemaclass/dkrisna.es.git
cd dkrisna.es
```

2. Run the development server:
```bash
zola serve
```

Open http://127.0.0.1:1111/ in your browser.

### Build for Production

```bash
zola build
```

The static files will be generated in the `public/` directory.

## Features

- Multilingual support (Spanish/English)
- Responsive design
- Service listings with Booksy integration
- Team section
- Location with Google Maps
- Social media links (Instagram, Facebook, TikTok, WhatsApp)

## Agent Configuration

[agnostic-ai](https://github.com/Chemaclass/agnostic-ai) manages the shared
instructions, agents, and rules for Claude and Codex. Targets are configured in
`agnostic-ai.yaml`; edit the source files under `.agnostic-ai/`.

Install the pinned CLI version on macOS or Linux (matching CI):

```bash
curl -fsSL https://raw.githubusercontent.com/Chemaclass/agnostic-ai/v0.51.0/scripts/install.sh | AGNOSTIC_AI_VERSION=v0.51.0 bash
```

After cloning or creating a worktree, run `agnostic-ai sync` before using Claude
or Codex. After editing the shared sources, regenerate and check the configuration:

```bash
agnostic-ai validate
agnostic-ai lint --strict
agnostic-ai sync
agnostic-ai sync --check
```

Commit `.agnostic-ai/` and `agnostic-ai.yaml`; native outputs are generated locally
and ignored through the managed `.gitignore` block. Do not edit generated files
directly. Shared project
instructions live in `.agnostic-ai/AGNOSTIC_AI.md`; file-specific conventions live
in `rules/`, and task agents live in `agents/` under the same directory.

`.github/workflows/agent-config.yml` validates and lints sources, then verifies
generation from a fresh checkout on pull requests and pushes to `main`. Use
`agnostic-ai sync --check --diff` to inspect local output drift.

Keep machine-specific overrides in the ignored `agnostic-ai.local.yaml` and keep
credentials out of shared specs. When upgrading the CLI, update the version in
the workflow, schema URL, shared instructions, and this installation command,
then regenerate and review all outputs.

## Automation

### Booksy Service Sync

A GitHub Action runs nightly at 3:00 AM UTC to fetch the latest services and prices from Booksy and update the website content automatically.

- Workflow: `.github/workflows/update-services.yml`
- Script: `scripts/fetch-booksy.js`

To run manually:
```bash
cd scripts
npm install
npx playwright install chromium
node fetch-booksy.js
```

## License

MIT
