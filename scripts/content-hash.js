import { createHash } from 'crypto';

/**
 * Creates a content hash for reviews data.
 * Only hashes the actual content (rating, reviewCount, reviews),
 * excluding metadata like fetchedAt to detect real changes.
 */
export function createReviewsContentHash(data) {
  const content = JSON.stringify({
    rating: data.rating,
    reviewCount: data.reviewCount,
    reviews: data.reviews
  });
  return createHash('sha256').update(content).digest('hex').substring(0, 16);
}

/**
 * Creates a content hash for services categories.
 * Only hashes the categories array, excluding metadata like fetchedAt.
 */
export function createServicesContentHash(categories) {
  const content = JSON.stringify(categories);
  return createHash('sha256').update(content).digest('hex').substring(0, 16);
}
