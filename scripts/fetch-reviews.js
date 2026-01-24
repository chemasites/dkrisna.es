import { chromium } from 'playwright';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createReviewsContentHash } from './content-hash.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const CONFIG = {
  booksyUrl: 'https://booksy.com/es-es/144031_d-krisna-nails_salon-de-unas_81457_caravaca-de-la-cruz#reviews-section',
  staticDir: join(__dirname, '..', 'static', 'data'),
  timeout: 90000,
  waitForContent: 5000
};

async function launchBrowser() {
  return chromium.launch({ headless: true });
}

async function extractReviewsFromPage(page) {
  return page.evaluate(() => {
    let rating = null;
    let reviewCount = null;
    const reviews = [];

    // Try to extract from Nuxt's embedded data (window.__NUXT__)
    try {
      const nuxtData = window.__NUXT__;
      if (nuxtData) {
        // Navigate through Nuxt data structure to find reviews
        const findReviews = (obj, depth = 0) => {
          if (depth > 10 || !obj) return null;
          if (Array.isArray(obj)) {
            for (const item of obj) {
              const result = findReviews(item, depth + 1);
              if (result) return result;
            }
          } else if (typeof obj === 'object') {
            // Check if this object has review-like properties
            if (obj.review && obj.user && obj.created) {
              return 'found_review_item';
            }
            // Check if this is an array of reviews
            if (Array.isArray(obj.reviews)) {
              return obj.reviews;
            }
            // Check for business data with reviews
            if (obj.business && obj.business.reviews) {
              return obj.business.reviews;
            }
            // Recursively search
            for (const key of Object.keys(obj)) {
              const result = findReviews(obj[key], depth + 1);
              if (result && result !== 'found_review_item') return result;
            }
          }
          return null;
        };

        // Also try to find rating info
        const findRating = (obj, depth = 0) => {
          if (depth > 10 || !obj) return null;
          if (typeof obj === 'object' && obj !== null) {
            if (typeof obj.rating === 'number' && typeof obj.reviews_count === 'number') {
              return { rating: obj.rating, count: obj.reviews_count };
            }
            if (typeof obj.average_rating === 'number') {
              return { rating: obj.average_rating, count: obj.reviews_count || 0 };
            }
            // Also check for rank field (Booksy uses this)
            if (typeof obj.rank === 'number' && typeof obj.reviews_count === 'number') {
              return { rating: obj.rank, count: obj.reviews_count };
            }
            for (const key of Object.keys(obj)) {
              const result = findRating(obj[key], depth + 1);
              if (result) return result;
            }
          }
          return null;
        };

        const foundReviews = findReviews(nuxtData);
        const foundRating = findRating(nuxtData);

        if (foundRating) {
          rating = foundRating.rating;
          reviewCount = foundRating.count;
        }

        if (Array.isArray(foundReviews)) {
          foundReviews.forEach(r => {
            if (r.review || r.text || r.comment) {
              const userName = r.user
                ? `${r.user.first_name || ''} ${(r.user.last_name || '').charAt(0)}.`.trim()
                : (r.author || r.name || 'Cliente');

              const reviewText = r.review || r.text || r.comment || '';
              const serviceName = Array.isArray(r.services) && r.services.length > 0
                ? r.services[0].name || r.services[0]
                : (r.service || '');

              // Format date from timestamp or string
              let dateStr = '';
              if (r.created) {
                try {
                  const d = new Date(r.created);
                  const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
                  dateStr = `${months[d.getMonth()]}. ${d.getDate()}, ${d.getFullYear()}`;
                } catch (e) {
                  dateStr = r.created;
                }
              } else if (r.date) {
                dateStr = r.date;
              }

              if (reviewText && reviewText.length > 5) {
                reviews.push({
                  name: userName.substring(0, 20),
                  text: reviewText,
                  service: serviceName,
                  date: dateStr,
                  rating: r.rank || r.rating || 5
                });
              }
            }
          });
        }
      }
    } catch (e) {
      console.log('Error extracting from NUXT data:', e);
    }

    // Fallback: try to get rating from page text
    if (!rating) {
      const bodyText = document.body.innerText;
      const ratingMatch = bodyText.match(/(\d[,.]?\d?)\s*\/\s*5/);
      if (ratingMatch) {
        rating = parseFloat(ratingMatch[1].replace(',', '.'));
      }
      const countMatch = bodyText.match(/(\d+)\s*(reviews?|opiniones?|reseñas?)/i);
      if (countMatch) {
        reviewCount = parseInt(countMatch[1], 10);
      }
    }

    return {
      rating: rating || 5.0,
      reviewCount: reviewCount || reviews.length,
      reviews: reviews
    };
  });
}

async function fetchReviewsFromBooksy() {
  console.log('Launching browser...');
  const browser = await launchBrowser();

  try {
    const page = await browser.newPage();
    console.log(`Navigating to ${CONFIG.booksyUrl}...`);

    // Navigate and wait for DOM to be ready
    await page.goto(CONFIG.booksyUrl, {
      waitUntil: 'domcontentloaded',
      timeout: CONFIG.timeout
    });

    console.log('Waiting for page to fully render...');

    // Wait for NUXT data to be available (this indicates app hydration is complete)
    console.log('Waiting for NUXT data...');
    await page.waitForFunction(() => window.__NUXT__ !== undefined, { timeout: 30000 }).catch(() => {
      console.log('NUXT data not found via waitForFunction, will try extraction anyway...');
    });

    // Additional wait for any async data loading
    await page.waitForTimeout(5000);

    // Scroll to reviews section to trigger lazy loading
    console.log('Scrolling to reviews section...');
    await page.evaluate(() => {
      // Try to find and scroll to reviews section
      const reviewsSection = document.querySelector('[id*="review"], [class*="reviews-section"], [class*="ReviewsSection"]');
      if (reviewsSection) {
        reviewsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else {
        // Scroll down the page to trigger lazy loading
        window.scrollTo(0, document.body.scrollHeight / 2);
      }
    });

    await page.waitForTimeout(2000);

    // Try clicking on reviews tab/link if it exists
    console.log('Looking for reviews tab...');
    const reviewsTab = await page.$('a[href*="review"], button:has-text("reseñas"), button:has-text("reviews"), [data-testid*="review"]');
    if (reviewsTab) {
      console.log('Clicking reviews tab...');
      await reviewsTab.click();
      await page.waitForTimeout(3000);
    }

    // Scroll again after potential tab click
    await page.evaluate(() => {
      window.scrollBy(0, 300);
    });

    // Wait for review content to appear
    console.log('Waiting for review content...');
    await page.waitForSelector('[class*="review"]', { timeout: 15000 }).catch(() => {
      console.log('Review selector not found, continuing anyway...');
    });

    await page.waitForTimeout(CONFIG.waitForContent);

    console.log('Extracting reviews...');
    const result = await extractReviewsFromPage(page);

    // Debug: log extraction results
    console.log(`Extracted: rating=${result.rating}, reviewCount=${result.reviewCount}, reviews=${result.reviews.length}`);

    return result;
  } finally {
    await browser.close();
  }
}

function saveReviewsData(reviews) {
  const { staticDir } = CONFIG;

  if (!existsSync(staticDir)) {
    mkdirSync(staticDir, { recursive: true });
  }

  const dataWithHash = {
    ...reviews,
    contentHash: createReviewsContentHash(reviews),
    fetchedAt: new Date().toISOString()
  };

  const filePath = join(staticDir, 'booksy-reviews.json');
  writeFileSync(filePath, JSON.stringify(dataWithHash, null, 2), 'utf-8');
  console.log(`Saved reviews data to ${filePath}`);
  console.log(`  - Rating: ${reviews.rating}/5`);
  console.log(`  - Reviews: ${reviews.reviewCount}`);
  console.log(`  - Individual reviews: ${reviews.reviews.length}`);
  console.log(`  - Content hash: ${dataWithHash.contentHash}`);
}

function validateReviews(reviews) {
  if (!reviews || !reviews.reviews || reviews.reviews.length === 0) {
    return { valid: false, reason: 'No reviews found' };
  }

  // Check if all names are generic "Cliente X" pattern
  const genericNames = reviews.reviews.filter(r => /^Cliente \d+$/.test(r.name));
  if (genericNames.length === reviews.reviews.length) {
    return { valid: false, reason: 'All names are generic placeholders' };
  }

  // Check if all texts contain "Usuario verificado" (placeholder text)
  const placeholderTexts = reviews.reviews.filter(r =>
    r.text.includes('Usuario verificado') || r.text.includes('Verified user')
  );
  if (placeholderTexts.length === reviews.reviews.length) {
    return { valid: false, reason: 'All review texts are placeholders' };
  }

  // Check if at least some reviews have real content (dates or services)
  const reviewsWithDetails = reviews.reviews.filter(r => r.date || r.service);
  if (reviewsWithDetails.length === 0) {
    return { valid: false, reason: 'No reviews have dates or services' };
  }

  return { valid: true };
}

async function main() {
  try {
    console.log('Starting Booksy reviews fetch...');
    const reviews = await fetchReviewsFromBooksy();

    if (!reviews || reviews.reviewCount === 0) {
      console.error('Failed to fetch reviews data.');
      process.exit(1);
    }

    // Validate that we got real review data, not placeholders
    const validation = validateReviews(reviews);
    if (!validation.valid) {
      console.error(`Review data validation failed: ${validation.reason}`);
      console.error('Skipping update to preserve existing data.');
      process.exit(1);
    }

    saveReviewsData(reviews);
    console.log('✓ Reviews update complete!');
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();
