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
  timeout: 90000,
  waitForContent: 5000
};

async function launchBrowser() {
  return chromium.launch({ headless: true });
}

async function extractServicesFromPage(page) {
  return page.evaluate(() => {
    const categories = [];

    // Try to extract from Nuxt's embedded data (window.__NUXT__)
    try {
      const nuxtData = window.__NUXT__;
      if (nuxtData) {
        // Recursively search for service categories in Nuxt data
        const findServices = (obj, depth = 0) => {
          if (depth > 15 || !obj) return null;
          if (Array.isArray(obj)) {
            for (const item of obj) {
              const result = findServices(item, depth + 1);
              if (result) return result;
            }
          } else if (typeof obj === 'object') {
            // Check if this is a service category with services array
            if (obj.name && Array.isArray(obj.services) && obj.services.length > 0) {
              // Check if services have expected properties
              if (obj.services[0].name || obj.services[0].title) {
                return 'found_category';
              }
            }
            // Check for service_categories array
            if (Array.isArray(obj.service_categories)) {
              return obj.service_categories;
            }
            // Check for categories array
            if (Array.isArray(obj.categories) && obj.categories.length > 0 && obj.categories[0].services) {
              return obj.categories;
            }
            // Check for business with service_categories
            if (obj.business && obj.business.service_categories) {
              return obj.business.service_categories;
            }
            // Recursively search
            for (const key of Object.keys(obj)) {
              const result = findServices(obj[key], depth + 1);
              if (result && result !== 'found_category') return result;
            }
          }
          return null;
        };

        const foundCategories = findServices(nuxtData);

        if (Array.isArray(foundCategories)) {
          foundCategories.forEach(cat => {
            const categoryName = cat.name || cat.title || 'Servicios';
            const services = [];

            if (Array.isArray(cat.services)) {
              cat.services.forEach(svc => {
                const name = svc.name || svc.title || '';
                if (name) {
                  // Format price
                  let price = '';
                  if (svc.price !== undefined && svc.price !== null) {
                    const priceNum = typeof svc.price === 'number' ? svc.price : parseFloat(svc.price);
                    if (!isNaN(priceNum)) {
                      price = `${priceNum.toFixed(2).replace('.', ',')} €`;
                    }
                  } else if (svc.price_from !== undefined) {
                    price = `${svc.price_from.toFixed(2).replace('.', ',')} €+`;
                  }

                  // Format duration
                  let duration = '';
                  if (svc.duration) {
                    const mins = typeof svc.duration === 'number' ? svc.duration : parseInt(svc.duration);
                    if (!isNaN(mins)) {
                      if (mins >= 60) {
                        const hours = Math.floor(mins / 60);
                        const remainMins = mins % 60;
                        duration = remainMins > 0 ? `${hours}h${remainMins}min` : `${hours}h`;
                      } else {
                        duration = `${mins}min`;
                      }
                    }
                  }

                  services.push({ name, price, duration });
                }
              });
            }

            if (services.length > 0) {
              categories.push({ name: categoryName, services });
            }
          });
        }
      }
    } catch (e) {
      console.log('Error extracting from NUXT data:', e);
    }

    if (categories.length > 0) {
      return { categories };
    }

    // Fallback: return raw text for debugging
    return { raw: document.body.innerText.substring(0, 1000), categories: [] };
  });
}

async function fetchServicesFromBooksy() {
  console.log('Launching browser...');
  const browser = await launchBrowser();

  try {
    const page = await browser.newPage();
    console.log(`Navigating to ${CONFIG.booksyUrl}...`);

    // Navigate and wait for page load
    await page.goto(CONFIG.booksyUrl, {
      waitUntil: 'load',
      timeout: CONFIG.timeout
    });

    console.log('Waiting for page to fully render...');
    await page.waitForTimeout(5000);

    // Scroll down to trigger lazy loading of services
    console.log('Scrolling to load services...');
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight / 3);
    });

    await page.waitForTimeout(2000);

    // Wait for service content
    await page.waitForSelector('[class*="service"]', { timeout: 15000 })
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
