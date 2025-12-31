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
