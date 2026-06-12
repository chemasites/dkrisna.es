/**
 * Booksy customer API client.
 *
 * Fetches services and reviews straight from Booksy's public REST API instead
 * of scraping the hydrated __NUXT__ data with a headless browser. GitHub-hosted
 * runners use datacenter IPs that Booksy's hCaptcha bot-detection flags, so the
 * browser never received the embedded service/review data and CI failed. The
 * REST API is gated by a public web api_key (the same one the website ships in
 * its HTML), not by hCaptcha, so it works from CI.
 */

const BUSINESS_ID = 144031;
const PUBLIC_PAGE =
  'https://booksy.com/es-es/144031_d-krisna-nails_salon-de-unas_81457_caravaca-de-la-cruz';
const API_BASE = 'https://es.booksy.com/api/es/2/customer_api';

// Public web api_key shipped in the Booksy website HTML. Used as a fallback if
// live discovery from the page fails; discovery keeps us resilient to rotation.
const FALLBACK_API_KEY = 'web-e3d812bf-d7a2-445d-ab38-55589ae6a121';

// Realistic desktop Chrome UA — Booksy serves a degraded response to obvious bots.
const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

const COMMON_HEADERS = {
  'User-Agent': USER_AGENT,
  'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8'
};

let cachedApiKey = null;

/**
 * Extracts the current web api_key from the public business page so the client
 * keeps working if Booksy rotates the key. Falls back to the known key.
 * @returns {Promise<string>}
 */
async function discoverApiKey() {
  if (cachedApiKey) return cachedApiKey;
  try {
    const res = await fetch(PUBLIC_PAGE, { headers: COMMON_HEADERS });
    if (res.ok) {
      const html = await res.text();
      const match = html.match(/apiKey:"(web-[a-f0-9-]+)"/i);
      if (match) {
        cachedApiKey = match[1];
        return cachedApiKey;
      }
    }
    console.log('Could not discover api_key from page, using fallback.');
  } catch (e) {
    console.log(`api_key discovery failed (${e.message}), using fallback.`);
  }
  cachedApiKey = FALLBACK_API_KEY;
  return cachedApiKey;
}

/**
 * Performs an authenticated GET against the Booksy customer API.
 * @param {string} path - Path relative to the customer_api base.
 * @returns {Promise<any>} Parsed JSON response.
 */
async function booksyGet(path) {
  const apiKey = await discoverApiKey();
  const res = await fetch(`${API_BASE}/${path}`, {
    headers: { ...COMMON_HEADERS, 'x-api-key': apiKey, Accept: 'application/json' }
  });
  if (!res.ok) {
    throw new Error(`Booksy API GET ${path} -> HTTP ${res.status}`);
  }
  return res.json();
}

/**
 * Fetches the business object including its service_categories.
 * @returns {Promise<Object>} The business object.
 */
export async function fetchBusiness() {
  const data = await booksyGet(
    `businesses/${BUSINESS_ID}?with_combos=1&with_services=true`
  );
  if (!data || !data.business) {
    throw new Error('Booksy API returned no business data');
  }
  return data.business;
}

/**
 * Fetches the reviews payload for the business.
 * @returns {Promise<Object>} { reviews, reviews_count, reviews_stars, ... }
 */
export async function fetchReviews() {
  return booksyGet(`businesses/${BUSINESS_ID}/reviews?per_page=20`);
}
