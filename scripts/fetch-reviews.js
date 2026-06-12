import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createReviewsContentHash } from './content-hash.js';
import { fetchReviews } from './booksy-api.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const CONFIG = {
  staticDir: join(__dirname, '..', 'static', 'data')
};

const MONTHS_ES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** Formats a Booksy date string (e.g. "2026-06-11T13:43") as "jun. 11, 2026". */
function formatDate(created) {
  if (!created) return '';
  const d = new Date(created);
  if (isNaN(d.getTime())) return created;
  return `${MONTHS_ES[d.getMonth()]}. ${d.getDate()}, ${d.getFullYear()}`;
}

/** Builds a display name like "Marta S." from the API user object. */
function formatUserName(user) {
  if (!user) return 'Cliente';
  const first = user.first_name || '';
  const lastInitial = (user.last_name || '').charAt(0);
  const name = `${first} ${lastInitial}.`.trim();
  return name.substring(0, 20);
}

/**
 * Maps the Booksy reviews API payload into the shape stored in
 * static/data/booksy-reviews.json.
 */
function mapReviews(payload) {
  const rawReviews = Array.isArray(payload.reviews) ? payload.reviews : [];

  const reviews = rawReviews
    .map(r => {
      const text = r.review || r.text || r.comment || '';
      const service = Array.isArray(r.services) && r.services.length > 0
        ? (r.services[0].name || r.services[0])
        : (r.service || '');
      return {
        name: formatUserName(r.user),
        text,
        service,
        date: formatDate(r.created || r.date),
        rating: r.rank || r.rating || 5
      };
    })
    .filter(r => r.text && r.text.length > 5);

  return {
    rating: payload.reviews_stars || payload.reviews_rank || 5.0,
    reviewCount: payload.reviews_count || reviews.length,
    reviews
  };
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
    const payload = await fetchReviews();
    const reviews = mapReviews(payload);
    console.log(`Fetched: rating=${reviews.rating}, reviewCount=${reviews.reviewCount}, reviews=${reviews.reviews.length}`);

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
