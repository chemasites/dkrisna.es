import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { parseDuration } from './booksy-parser.js';
import { createServicesContentHash } from './content-hash.js';
import { fetchBusiness } from './booksy-api.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const CONFIG = {
  dataDir: join(__dirname, '..', 'static', 'data'),
  maxRetries: 3,
  retryDelay: 5000
};

// Category translations - maps scraped Spanish names to bilingual structure
const CATEGORY_TRANSLATIONS = {
  manos: { es: 'Uñas de las Manos', en: 'Hand Nails' },
  pies: { es: 'Uñas de los Pies', en: 'Foot Nails' },
  'cejas-pestanas': { es: 'Cejas y Pestañas', en: 'Brows & Lashes' },
  masajes: { es: 'Masajes', en: 'Massages' },
  maderoterapia: { es: 'Maderoterapia', en: 'Wood Therapy' },
  'bonos-maderoterapia': { es: 'Bonos Maderoterapia', en: 'Wood Therapy Packages' }
};

/** Formats a number of euros as "12,00 €". */
function formatEuro(amount) {
  return `${amount.toFixed(2).replace('.', ',')} €`;
}

/** Formats a duration in minutes as "20 min" / "1h" / "1h 30min". */
function formatDuration(mins) {
  if (typeof mins !== 'number' || isNaN(mins)) return '';
  if (mins >= 60) {
    const hours = Math.floor(mins / 60);
    const remainMins = mins % 60;
    return remainMins > 0 ? `${hours}h ${remainMins}min` : `${hours}h`;
  }
  return `${mins} min`;
}

/**
 * Maps a single Booksy API service object to the raw shape consumed by
 * transformToJSON. Mirrors the price/promotion/duration handling that the
 * previous __NUXT__ extraction performed.
 */
function mapService(svc) {
  let price = '';
  let originalPrice = '';
  let duration = '';

  const variant = Array.isArray(svc.variants) && svc.variants.length > 0
    ? svc.variants[0]
    : null;

  if (variant) {
    if (variant.duration) {
      const mins = typeof variant.duration === 'number'
        ? variant.duration
        : parseInt(variant.duration, 10);
      duration = formatDuration(mins);
    }

    // Promotion present: original price is variant.price, discounted is in promotion.
    if (variant.promotion && variant.promotion.price) {
      if (variant.price !== undefined) {
        originalPrice = formatEuro(variant.price);
      }
      if (variant.promotion.price.price !== undefined) {
        price = formatEuro(variant.promotion.price.price);
      } else if (variant.promotion.price.formatted_price) {
        price = variant.promotion.price.formatted_price;
      }
    } else if (variant.price !== undefined) {
      price = formatEuro(variant.price);
    }
  }

  // Fallback to service-level price.
  if (!price) {
    if (svc.price !== undefined && svc.price !== null) {
      const priceNum = typeof svc.price === 'number' ? svc.price : parseFloat(svc.price);
      if (!isNaN(priceNum)) {
        price = formatEuro(priceNum);
      }
    } else if (svc.price_from !== undefined) {
      price = `${formatEuro(svc.price_from)}+`;
    }
  }

  return {
    name: svc.name || svc.title || '',
    price,
    originalPrice,
    duration,
    description: svc.description || '',
    serviceId: svc.id || null,
    variantId: variant ? variant.id : null
  };
}

/**
 * Maps the Booksy business object into the raw { categories } shape that the
 * rest of the pipeline expects.
 */
function mapBusinessToRawServices(business) {
  const categories = [];
  const sourceCategories = Array.isArray(business.service_categories)
    ? business.service_categories
    : [];

  sourceCategories.forEach(cat => {
    const categoryName = cat.name || cat.title || 'Servicios';
    const services = (Array.isArray(cat.services) ? cat.services : [])
      .map(mapService)
      .filter(svc => svc.name);
    if (services.length > 0) {
      categories.push({ name: categoryName, services });
    }
  });

  return { categories };
}

/**
 * Determines category ID from Spanish category name
 */
function getCategoryId(categoryName) {
  const nameLower = categoryName.toLowerCase();
  if (nameLower.includes('mano') || nameLower.includes('uñas de más')) {
    return 'manos';
  } else if (nameLower.includes('pie') || nameLower.includes('pedicura')) {
    return 'pies';
  } else if (nameLower.includes('ceja') || nameLower.includes('pestaña')) {
    return 'cejas-pestanas';
  } else if (nameLower.includes('masaje') || nameLower.includes('massage')) {
    return 'masajes';
  } else if (nameLower.includes('bono') && nameLower.includes('maderoterapia')) {
    return 'bonos-maderoterapia';
  } else if (nameLower.includes('maderoterapia')) {
    return 'maderoterapia';
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
  const categoryOrder = ['manos', 'pies', 'cejas-pestanas', 'masajes', 'maderoterapia', 'bonos-maderoterapia'];
  categorizedServices.sort((a, b) => categoryOrder.indexOf(a.id) - categoryOrder.indexOf(b.id));

  return {
    categories: categorizedServices,
    contentHash: createServicesContentHash(categorizedServices),
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
  console.log(`  - Content hash: ${servicesData.contentHash}`);
}

async function fetchWithRetry() {
  for (let attempt = 1; attempt <= CONFIG.maxRetries; attempt++) {
    console.log(`\nAttempt ${attempt}/${CONFIG.maxRetries}...`);
    try {
      const business = await fetchBusiness();
      const rawServices = mapBusinessToRawServices(business);

      if (!rawServices.categories.length) {
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
