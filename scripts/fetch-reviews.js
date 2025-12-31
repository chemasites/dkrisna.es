import { chromium } from 'playwright';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const CONFIG = {
  booksyUrl: 'https://booksy.com/es-es/144031_d-krisna-nails_salon-de-unas_81457_caravaca-de-la-cruz',
  staticDir: join(__dirname, '..', 'static', 'data'),
  timeout: 60000,
  waitForContent: 3000
};

async function launchBrowser() {
  return chromium.launch({ headless: true });
}

async function extractReviewsFromPage(page) {
  return page.evaluate(() => {
    let rating = null;
    let reviewCount = null;

    const bodyText = document.body.innerText;

    // Match patterns like "5.0/5" or "5,0/5"
    const ratingMatch = bodyText.match(/(\d[,.]?\d?)\s*\/\s*5/);
    if (ratingMatch) {
      rating = parseFloat(ratingMatch[1].replace(',', '.'));
    }

    // Match patterns like "19 reseñas" or "19 reviews"
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
          name: name.substring(0, 20),
          text: text,
          service: service,
          date: date,
          rating: 5
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

async function fetchReviewsFromBooksy() {
  console.log('Launching browser...');
  const browser = await launchBrowser();

  try {
    const page = await browser.newPage();
    console.log(`Navigating to ${CONFIG.booksyUrl}...`);

    await page.goto(CONFIG.booksyUrl, {
      waitUntil: 'domcontentloaded',
      timeout: CONFIG.timeout
    });

    await page.waitForTimeout(CONFIG.waitForContent);

    console.log('Extracting reviews...');
    return await extractReviewsFromPage(page);
  } finally {
    await browser.close();
  }
}

function saveReviewsData(reviews) {
  const { staticDir } = CONFIG;

  if (!existsSync(staticDir)) {
    mkdirSync(staticDir, { recursive: true });
  }

  const filePath = join(staticDir, 'booksy-reviews.json');
  writeFileSync(filePath, JSON.stringify(reviews, null, 2), 'utf-8');
  console.log(`Saved reviews data to ${filePath}`);
  console.log(`  - Rating: ${reviews.rating}/5`);
  console.log(`  - Reviews: ${reviews.reviewCount}`);
  console.log(`  - Individual reviews: ${reviews.reviews.length}`);
}

async function main() {
  try {
    console.log('Starting Booksy reviews fetch...');
    const reviews = await fetchReviewsFromBooksy();

    if (reviews && (reviews.reviewCount > 0 || reviews.reviews.length > 0)) {
      saveReviewsData(reviews);
      console.log('✓ Reviews update complete!');
    } else {
      console.error('Failed to fetch reviews data.');
      process.exit(1);
    }
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();
