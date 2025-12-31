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
                  // Format price and duration - check variants first
                  let price = '';
                  let originalPrice = '';
                  let duration = '';

                  // Check variants for price, duration, and promotion data
                  if (Array.isArray(svc.variants) && svc.variants.length > 0) {
                    const variant = svc.variants[0];

                    // Get duration from variant
                    if (variant.duration) {
                      const mins = typeof variant.duration === 'number' ? variant.duration : parseInt(variant.duration);
                      if (!isNaN(mins)) {
                        if (mins >= 60) {
                          const hours = Math.floor(mins / 60);
                          const remainMins = mins % 60;
                          duration = remainMins > 0 ? `${hours}h ${remainMins}min` : `${hours}h`;
                        } else {
                          duration = `${mins} min`;
                        }
                      }
                    }

                    // Check for promotion with original price
                    if (variant.promotion) {
                      // Promotion exists - get original and discounted price
                      if (variant.promotion.old_price !== undefined) {
                        originalPrice = `${variant.promotion.old_price.toFixed(2).replace('.', ',')} €`;
                      }
                      if (variant.promotion.new_price !== undefined) {
                        price = `${variant.promotion.new_price.toFixed(2).replace('.', ',')} €`;
                      } else if (variant.price !== undefined) {
                        price = `${variant.price.toFixed(2).replace('.', ',')} €`;
                      }
                    } else if (variant.price !== undefined) {
                      price = `${variant.price.toFixed(2).replace('.', ',')} €`;
                    }
                  }

                  // Fallback to service-level price
                  if (!price) {
                    if (svc.price !== undefined && svc.price !== null) {
                      const priceNum = typeof svc.price === 'number' ? svc.price : parseFloat(svc.price);
                      if (!isNaN(priceNum)) {
                        price = `${priceNum.toFixed(2).replace('.', ',')} €`;
                      }
                    } else if (svc.price_from !== undefined) {
                      price = `${svc.price_from.toFixed(2).replace('.', ',')} €+`;
                    }
                  }

                  // Extract description if available (check various possible field names)
                  const description = svc.description || svc.desc || svc.details ||
                                      svc.info || svc.text || svc.note || svc.notes ||
                                      svc.short_description || svc.about || '';

                  // Extract service/variant ID for direct booking URL
                  const serviceId = svc.id || null;
                  const variantId = Array.isArray(svc.variants) && svc.variants.length > 0
                    ? svc.variants[0].id
                    : null;

                  services.push({ name, price, originalPrice, duration, description, serviceId, variantId });
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
      // Try to enrich with descriptions from DOM for services that don't have them in Nuxt data
      // Structure: h4[data-testid="service-name"] -> parent div -> sibling div -> span -> p
      try {
        const serviceHeaders = document.querySelectorAll('h4[data-testid="service-name"]');
        serviceHeaders.forEach(h4 => {
          const serviceName = h4.textContent.trim();
          const parentDiv = h4.parentElement;
          if (parentDiv) {
            const descP = parentDiv.querySelector('div span p');
            if (descP) {
              const descText = descP.textContent.trim();
              if (descText) {
                categories.forEach(cat => {
                  cat.services.forEach(svc => {
                    if (svc.name === serviceName && !svc.description) {
                      svc.description = descText;
                    }
                  });
                });
              }
            }
          }
        });
      } catch (e) {
        // DOM enrichment failed, continue with existing data
      }
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
        price: service.price || '',
        originalPrice: service.originalPrice || '',
        duration: parseDuration(service.duration, lang),
        description: service.description || '',
        serviceId: service.serviceId || null,
        variantId: service.variantId || null
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
