import { chromium } from 'playwright';
import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { parseDuration } from './booksy-parser.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const CONFIG = {
  booksyUrl: 'https://booksy.com/es-es/144031_d-krisna-nails_salon-de-unas_81457_caravaca-de-la-cruz',
  dataDir: join(__dirname, '..', 'static', 'data'),
  timeout: 90000,
  waitForContent: 5000,
  maxRetries: 3,
  retryDelay: 5000
};

// Category translations - maps scraped Spanish names to bilingual structure
const CATEGORY_TRANSLATIONS = {
  hands: { es: 'Uñas de las Manos', en: 'Hand Nails' },
  feet: { es: 'Uñas de los Pies', en: 'Foot Nails' },
  brows_lashes: { es: 'Cejas y Pestañas', en: 'Brows & Lashes' },
  massages: { es: 'Masajes', en: 'Massages' }
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
                    if (variant.promotion && variant.promotion.price) {
                      // Promotion exists - original price is variant.price, discounted is promotion.price.price
                      if (variant.price !== undefined) {
                        originalPrice = `${variant.price.toFixed(2).replace('.', ',')} €`;
                      }
                      if (variant.promotion.price.price !== undefined) {
                        price = `${variant.promotion.price.price.toFixed(2).replace('.', ',')} €`;
                      } else if (variant.promotion.price.formatted_price) {
                        price = variant.promotion.price.formatted_price;
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

async function waitForNuxtData(page, timeout = 30000) {
  const startTime = Date.now();
  while (Date.now() - startTime < timeout) {
    const hasData = await page.evaluate(() => {
      const nuxt = window.__NUXT__;
      if (!nuxt) return false;
      // Check if service data is loaded by looking for service_categories
      const checkForServices = (obj, depth = 0) => {
        if (depth > 10 || !obj) return false;
        if (Array.isArray(obj.service_categories) && obj.service_categories.length > 0) return true;
        if (obj.business?.service_categories?.length > 0) return true;
        if (typeof obj === 'object') {
          for (const key of Object.keys(obj)) {
            if (checkForServices(obj[key], depth + 1)) return true;
          }
        }
        return false;
      };
      return checkForServices(nuxt);
    });
    if (hasData) return true;
    await page.waitForTimeout(500);
  }
  return false;
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

    // Wait for __NUXT__ data to be populated with services
    console.log('Waiting for service data to load...');
    const nuxtReady = await waitForNuxtData(page);
    if (!nuxtReady) {
      console.log('Warning: __NUXT__ data not fully loaded, proceeding anyway...');
    }

    await page.waitForTimeout(CONFIG.waitForContent);

    console.log('Extracting services...');
    return await extractServicesFromPage(page);
  } finally {
    await browser.close();
  }
}

/**
 * Determines category ID from Spanish category name
 */
function getCategoryId(categoryName) {
  const nameLower = categoryName.toLowerCase();
  if (nameLower.includes('mano') || nameLower.includes('uñas de más')) {
    return 'hands';
  } else if (nameLower.includes('pie') || nameLower.includes('pedicura')) {
    return 'feet';
  } else if (nameLower.includes('ceja') || nameLower.includes('pestaña')) {
    return 'brows_lashes';
  } else if (nameLower.includes('masaje') || nameLower.includes('massage')) {
    return 'massages';
  }
  return null;
}

/**
 * Transforms raw services into JSON structure with bilingual category names
 */
function transformToJSON(rawServices) {
  if (!rawServices.categories) return { categories: [], fetchedAt: new Date().toISOString() };

  const categorizedServices = [];

  rawServices.categories.forEach(category => {
    const categoryId = getCategoryId(category.name);
    if (!categoryId) {
      console.log(`Skipping unknown category: ${category.name}`);
      return;
    }

    const services = category.services.map(service => ({
      name: service.name,
      price: service.price || null,
      originalPrice: service.originalPrice || null,
      duration: parseDuration(service.duration, 'es'),
      description: service.description || null,
      variantId: service.variantId || null
    }));

    // Check if we already have this category (merge services)
    const existingCategory = categorizedServices.find(c => c.id === categoryId);
    if (existingCategory) {
      existingCategory.services.push(...services);
    } else {
      categorizedServices.push({
        id: categoryId,
        name: CATEGORY_TRANSLATIONS[categoryId],
        services
      });
    }
  });

  // Sort categories in preferred order
  const categoryOrder = ['hands', 'feet', 'brows_lashes', 'massages'];
  categorizedServices.sort((a, b) => categoryOrder.indexOf(a.id) - categoryOrder.indexOf(b.id));

  return {
    categories: categorizedServices,
    fetchedAt: new Date().toISOString()
  };
}

/**
 * Writes services data to JSON file
 */
function writeServicesJSON(servicesData) {
  const filePath = join(CONFIG.dataDir, 'services.json');
  writeFileSync(filePath, JSON.stringify(servicesData, null, 2), 'utf-8');
  console.log(`Updated ${filePath}`);
}

function logServicesSummary(servicesData) {
  console.log(`Found ${servicesData.categories.length} service categories:`);
  servicesData.categories.forEach(cat => {
    console.log(`  - ${cat.name.es}: ${cat.services.length} services`);
  });
}

async function fetchWithRetry() {
  for (let attempt = 1; attempt <= CONFIG.maxRetries; attempt++) {
    console.log(`\nAttempt ${attempt}/${CONFIG.maxRetries}...`);
    try {
      const rawServices = await fetchServicesFromBooksy();

      if (rawServices.raw || !rawServices.categories?.length) {
        if (attempt < CONFIG.maxRetries) {
          console.log(`No services extracted, retrying in ${CONFIG.retryDelay / 1000}s...`);
          await new Promise(r => setTimeout(r, CONFIG.retryDelay));
          continue;
        }
        return null;
      }

      return rawServices;
    } catch (error) {
      console.error(`Attempt ${attempt} failed:`, error.message);
      if (attempt < CONFIG.maxRetries) {
        console.log(`Retrying in ${CONFIG.retryDelay / 1000}s...`);
        await new Promise(r => setTimeout(r, CONFIG.retryDelay));
      }
    }
  }
  return null;
}

async function main() {
  try {
    console.log('Starting Booksy services fetch...');
    const rawServices = await fetchWithRetry();

    if (!rawServices) {
      console.error('Could not fetch services after all retries.');
      process.exit(1);
    }

    // Transform to JSON structure with bilingual names
    const servicesData = transformToJSON(rawServices);

    // Log summary
    logServicesSummary(servicesData);

    // Write JSON file
    writeServicesJSON(servicesData);

    console.log('✓ Services update complete!');
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();
