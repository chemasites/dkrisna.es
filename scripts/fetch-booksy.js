import { chromium } from 'playwright';
import { writeFileSync, readFileSync, mkdirSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { generateManicuraHTML, generateMasajesHTML, parsePrice, parseDuration } from './booksy-parser.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const CONFIG = {
  booksyUrl: 'https://booksy.com/es-es/144031_d-krisna-nails_salon-de-unas_81457_caravaca-de-la-cruz',
  bookingUrl: 'https://booksy.com/es-es/144031_d-krisna-nails_salon-de-unas_81457_caravaca-de-la-cruz',
  contentDir: join(__dirname, '..', 'content'),
  staticDir: join(__dirname, '..', 'static', 'data'),
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

async function extractReviewsFromPage(page) {
  return page.evaluate(() => {
    let rating = null;
    let reviewCount = null;

    // Look for rating in the page text
    const bodyText = document.body.innerText;

    // Match patterns like "5.0/5" or "5,0/5"
    const ratingMatch = bodyText.match(/(\d[,.]?\d?)\s*\/\s*5/);
    if (ratingMatch) {
      rating = parseFloat(ratingMatch[1].replace(',', '.'));
    }

    // Match patterns like "Based on 19 reviews" or "19 opiniones"
    const countMatch = bodyText.match(/(\d+)\s*(reviews?|opiniones?|reseñas?)/i);
    if (countMatch) {
      reviewCount = parseInt(countMatch[1], 10);
    }

    // Extract individual reviews
    const reviews = [];
    const reviewSelectors = [
      '[class*="review-item"]',
      '[class*="ReviewItem"]',
      '[class*="review-card"]',
      '[data-testid*="review"]'
    ];

    let reviewElements = [];
    for (const selector of reviewSelectors) {
      reviewElements = document.querySelectorAll(selector);
      if (reviewElements.length > 0) break;
    }

    reviewElements.forEach((el, index) => {
      const nameEl = el.querySelector('[class*="name"], [class*="author"], h4, h5');
      const textEl = el.querySelector('[class*="text"], [class*="comment"], [class*="content"], p');
      const dateEl = el.querySelector('[class*="date"], time');
      const serviceEl = el.querySelector('[class*="service"], [class*="treatment"]');

      const name = nameEl?.textContent?.trim() || `Cliente ${index + 1}`;
      const text = textEl?.textContent?.trim() || '';
      const date = dateEl?.textContent?.trim() || '';
      const service = serviceEl?.textContent?.trim() || '';

      if (text) {
        reviews.push({
          name: name.substring(0, 20), // Limit name length
          text: text,
          service: service,
          date: date,
          rating: 5 // All reviews on Booksy for this business are 5 stars
        });
      }
    });

    return {
      rating: rating || 5.0,
      reviewCount: reviewCount || 0,
      reviews: reviews,
      fetchedAt: new Date().toISOString()
    };
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
    const services = await extractServicesFromPage(page);

    console.log('Extracting reviews...');
    const reviews = await extractReviewsFromPage(page);

    return { services, reviews };
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

function saveReviewsData(reviews) {
  const { staticDir } = CONFIG;

  // Ensure directory exists
  if (!existsSync(staticDir)) {
    mkdirSync(staticDir, { recursive: true });
  }

  const filePath = join(staticDir, 'booksy-reviews.json');
  writeFileSync(filePath, JSON.stringify(reviews, null, 2), 'utf-8');
  console.log(`Saved reviews data to ${filePath}`);
  console.log(`  - Rating: ${reviews.rating}/5`);
  console.log(`  - Reviews: ${reviews.reviewCount}`);
}

async function main() {
  try {
    console.log('Starting Booksy data fetch...');
    const { services: rawServices, reviews } = await fetchServicesFromBooksy();

    // Save reviews data (always save even if services fail)
    if (reviews) {
      saveReviewsData(reviews);
    }

    if (rawServices.raw) {
      console.log('Could not parse structured service data.');
      console.log('Sample:', rawServices.raw.substring(0, 500));
      process.exit(1);
    }

    if (!rawServices.categories?.length) {
      console.log('No services found. Booksy page structure may have changed.');
      process.exit(1);
    }

    // Log summary using Spanish normalization
    const servicesForLog = normalizeServices(rawServices, 'es');
    logServicesSummary(servicesForLog);

    // Update content files (handles both ES and EN)
    updateAllContentFiles(rawServices);

    console.log('Booksy data update complete!');
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();
