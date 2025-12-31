import { chromium } from 'playwright';
import { writeFileSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { generateManicuraHTML, generateMasajesHTML, parsePrice, parseDuration } from './booksy-parser.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const CONFIG = {
  booksyUrl: 'https://booksy.com/es-es/144031_d-krisna-nails_salon-de-unas_81457_caravaca-de-la-cruz',
  bookingUrl: 'https://booksy.com/es-es/144031_d-krisna-nails_salon-de-unas_81457_caravaca-de-la-cruz',
  contentDir: join(__dirname, '..', 'content'),
  timeout: 60000,
  waitForContent: 3000
};

async function launchBrowser() {
  return chromium.launch({ headless: true });
}

async function extractServicesFromPage(page) {
  return page.evaluate(() => {
    const categories = [];
    const categorySelectors = [
      '[data-testid="service-category"]',
      '.service-category',
      '[class*="ServiceCategory"]'
    ];

    let categoryElements = [];
    for (const selector of categorySelectors) {
      categoryElements = document.querySelectorAll(selector);
      if (categoryElements.length > 0) break;
    }

    if (categoryElements.length === 0) {
      return extractFlatServices();
    }

    categoryElements.forEach(category => {
      const parsed = parseCategoryElement(category);
      if (parsed.services.length > 0) {
        categories.push(parsed);
      }
    });

    return { categories };

    function extractFlatServices() {
      const serviceSelectors = [
        '[data-testid="service-item"]',
        '[class*="ServiceItem"]',
        '[class*="service-item"]'
      ];

      let serviceItems = [];
      for (const selector of serviceSelectors) {
        serviceItems = document.querySelectorAll(selector);
        if (serviceItems.length > 0) break;
      }

      if (serviceItems.length === 0) {
        return { raw: document.body.innerText, categories: [] };
      }

      const services = Array.from(serviceItems).map(parseServiceElement).filter(Boolean);
      return services.length > 0
        ? { categories: [{ name: 'Servicios', services }] }
        : { raw: document.body.innerText, categories: [] };
    }

    function parseCategoryElement(category) {
      const nameEl = category.querySelector('[class*="category-name"], h2, h3');
      const categoryName = nameEl?.textContent?.trim() || 'Servicios';

      const serviceItems = category.querySelectorAll('[class*="service-item"], [class*="ServiceItem"]');
      const services = Array.from(serviceItems).map(parseServiceElement).filter(Boolean);

      return { name: categoryName, services };
    }

    function parseServiceElement(item) {
      const nameEl = item.querySelector('[class*="name"], [class*="title"], h3, h4');
      if (!nameEl) return null;

      const priceEl = item.querySelector('[class*="price"]');
      const durationEl = item.querySelector('[class*="duration"], [class*="time"]');

      return {
        name: nameEl.textContent?.trim() || '',
        price: priceEl?.textContent?.trim() || '',
        duration: durationEl?.textContent?.trim() || ''
      };
    }
  });
}

async function fetchServicesFromBooksy() {
  console.log('Launching browser...');
  const browser = await launchBrowser();

  try {
    const page = await browser.newPage();
    console.log(`Navigating to ${CONFIG.booksyUrl}...`);

    await page.goto(CONFIG.booksyUrl, {
      waitUntil: 'domcontentloaded',
      timeout: CONFIG.timeout
    });

    await page.waitForSelector('[class*="service"]', { timeout: 30000 })
      .catch(() => console.log('Service selector not found, continuing...'));

    await page.waitForTimeout(CONFIG.waitForContent);

    console.log('Extracting services...');
    return await extractServicesFromPage(page);
  } finally {
    await browser.close();
  }
}

function normalizeServices(services, lang = 'es') {
  if (!services.categories) return services;

  return {
    categories: services.categories.map(category => ({
      name: category.name,
      services: category.services.map(service => ({
        name: service.name,
        ...parsePrice(service.price, lang),
        duration: parseDuration(service.duration, lang)
      }))
    }))
  };
}

function updateContentFile(filePath, newContent) {
  const content = readFileSync(filePath, 'utf-8');
  const frontmatterMatch = content.match(/^\+\+\+[\s\S]*?\+\+\+/);

  if (!frontmatterMatch) {
    console.error(`Could not find frontmatter in ${filePath}`);
    return false;
  }

  const newFileContent = `${frontmatterMatch[0]}\n\n${newContent}\n`;
  writeFileSync(filePath, newFileContent, 'utf-8');
  console.log(`Updated ${filePath}`);
  return true;
}

function updateAllContentFiles(rawServices) {
  const { contentDir, bookingUrl } = CONFIG;

  // Spanish content
  const servicesES = normalizeServices(rawServices, 'es');
  const manicuraES = generateManicuraHTML(servicesES.categories, { bookingUrl, lang: 'es' });
  const masajesES = generateMasajesHTML(servicesES.categories, { bookingUrl, lang: 'es' });
  updateContentFile(join(contentDir, 'manicura.md'), manicuraES);
  updateContentFile(join(contentDir, 'masajes.md'), masajesES);

  // English content
  const servicesEN = normalizeServices(rawServices, 'en');
  const manicuraEN = generateManicuraHTML(servicesEN.categories, { bookingUrl, lang: 'en' });
  const masajesEN = generateMasajesHTML(servicesEN.categories, { bookingUrl, lang: 'en' });
  updateContentFile(join(contentDir, 'manicura.en.md'), manicuraEN);
  updateContentFile(join(contentDir, 'masajes.en.md'), masajesEN);
}

function logServicesSummary(services) {
  console.log(`Found ${services.categories.length} service categories:`);
  services.categories.forEach(cat => {
    console.log(`  - ${cat.name}: ${cat.services.length} services`);
  });
}

async function main() {
  try {
    console.log('Starting Booksy services fetch...');
    const rawServices = await fetchServicesFromBooksy();

    if (rawServices.raw) {
      console.error('Could not parse structured service data (page structure may have changed).');
      process.exit(1);
    }

    if (!rawServices.categories?.length) {
      console.error('No services found in page.');
      process.exit(1);
    }

    // Log summary using Spanish normalization
    const servicesForLog = normalizeServices(rawServices, 'es');
    logServicesSummary(servicesForLog);

    // Update content files (handles both ES and EN)
    updateAllContentFiles(rawServices);

    console.log('✓ Services update complete!');
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();
