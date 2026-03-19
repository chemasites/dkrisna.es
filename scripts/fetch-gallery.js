import { chromium } from 'playwright';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createHash } from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const CONFIG = {
  booksyUrl: 'https://booksy.com/es-es/144031_d-krisna-nails_salon-de-unas_81457_caravaca-de-la-cruz',
  dataDir: join(__dirname, '..', 'static', 'data'),
  imagesDir: join(__dirname, '..', 'static', 'images', 'gallery'),
  timeout: 90000,
  maxRetries: 3,
  retryDelay: 5000
};

async function extractGalleryFromPage(page) {
  return page.evaluate(() => {
    const images = [];

    try {
      const nuxtData = window.__NUXT__;
      if (!nuxtData) return { images: [] };

      const findImages = (obj, depth = 0) => {
        if (depth > 15 || !obj) return;

        if (Array.isArray(obj)) {
          obj.forEach(item => findImages(item, depth + 1));
        } else if (typeof obj === 'object') {
          // Look for inspiration/portfolio images
          if (obj.inspiration && Array.isArray(obj.inspiration)) {
            obj.inspiration.forEach(img => {
              if (img.image_url || img.url || img.image) {
                images.push({
                  url: img.image_url || img.url || img.image,
                  type: 'inspiration'
                });
              }
            });
          }

          // Look for service_photos
          if (obj.service_photos && Array.isArray(obj.service_photos)) {
            obj.service_photos.forEach(img => {
              if (img.image_url || img.url || img.image) {
                images.push({
                  url: img.image_url || img.url || img.image,
                  type: 'service'
                });
              }
            });
          }

          // Look for photo_gallery
          if (obj.photo_gallery && Array.isArray(obj.photo_gallery)) {
            obj.photo_gallery.forEach(img => {
              if (img.image_url || img.url || img.image) {
                images.push({
                  url: img.image_url || img.url || img.image,
                  type: 'gallery'
                });
              }
            });
          }

          // Recurse
          for (const key of Object.keys(obj)) {
            if (key !== 'inspiration' && key !== 'service_photos' && key !== 'photo_gallery') {
              findImages(obj[key], depth + 1);
            }
          }
        }
      };

      findImages(nuxtData);
    } catch (e) {
      // Fallback: extract from DOM
    }

    // Also search for image URLs as plain strings in Nuxt data
    try {
      const jsonStr = JSON.stringify(window.__NUXT__);
      const urlPattern = /https?:\/\/[^"'\s]+(?:service_photos|inspiration|photo_gallery)[^"'\s]+\.(?:jpeg|jpg|png|webp)/gi;
      const matches = jsonStr.match(urlPattern) || [];
      matches.forEach(url => {
        if (!images.some(i => i.url === url)) {
          const type = url.includes('inspiration') ? 'inspiration' : 'service';
          images.push({ url, type });
        }
      });
    } catch (e) {
      // String search failed
    }

    // Fallback/supplement: extract from DOM img elements
    if (images.length === 0) {
      const imgElements = document.querySelectorAll('img[src*="cloudfront"], img[src*="service_photos"], img[src*="inspiration"]');
      imgElements.forEach(img => {
        const src = img.src || img.dataset.src;
        if (src && !images.some(i => i.url === src)) {
          images.push({
            url: src,
            type: src.includes('inspiration') ? 'inspiration' : 'service'
          });
        }
      });
    }

    return { images };
  });
}

async function downloadImage(url, filepath) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to download: ${response.status}`);
  const buffer = await response.arrayBuffer();
  writeFileSync(filepath, Buffer.from(buffer));
}

function createContentHash(images) {
  const content = images.map(i => i.url).sort().join('|');
  return createHash('sha256').update(content).digest('hex').substring(0, 16);
}

async function fetchGallery() {
  console.log('Launching browser...');
  const browser = await chromium.launch({ headless: true });

  try {
    const page = await browser.newPage();
    console.log(`Navigating to ${CONFIG.booksyUrl}...`);

    await page.goto(CONFIG.booksyUrl, {
      waitUntil: 'load',
      timeout: CONFIG.timeout
    });

    await page.waitForTimeout(5000);

    // Scroll to trigger lazy loading
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(3000);

    console.log('Extracting gallery images...');
    return await extractGalleryFromPage(page);
  } finally {
    await browser.close();
  }
}

async function main() {
  try {
    console.log('Starting Booksy gallery fetch...\n');

    let result = null;
    for (let attempt = 1; attempt <= CONFIG.maxRetries; attempt++) {
      console.log(`Attempt ${attempt}/${CONFIG.maxRetries}...`);
      try {
        result = await fetchGallery();
        if (result.images.length > 0) break;
        console.log('No images found, retrying...');
      } catch (error) {
        console.error(`Attempt ${attempt} failed:`, error.message);
      }
      if (attempt < CONFIG.maxRetries) {
        await new Promise(r => setTimeout(r, CONFIG.retryDelay));
      }
    }

    if (!result || result.images.length === 0) {
      console.error('Could not fetch gallery images.');
      process.exit(1);
    }

    // Keep only inspiration images (the top gallery from Booksy profile)
    const inspirationOnly = result.images.filter(img => img.type === 'inspiration');

    // Deduplicate: group by image ID (the hash in the filename), keep highest resolution
    const byId = new Map();
    for (const img of inspirationOnly) {
      // Extract unique image hash from URL (first hash before -d-krisna or the full filename)
      const match = img.url.match(/inspiration\/([a-f0-9]+)/);
      const id = match ? match[1] : img.url;
      const existing = byId.get(id);
      if (!existing) {
        byId.set(id, img);
      }
    }
    const uniqueImages = [...byId.values()];

    console.log(`\nFound ${uniqueImages.length} unique images`);

    // Download images locally
    if (!existsSync(CONFIG.imagesDir)) {
      mkdirSync(CONFIG.imagesDir, { recursive: true });
    }

    const galleryItems = [];
    for (let i = 0; i < uniqueImages.length; i++) {
      const img = uniqueImages[i];
      const ext = img.url.includes('.png') ? 'png' : 'jpg';
      const filename = `gallery-${String(i + 1).padStart(2, '0')}.${ext}`;
      const filepath = join(CONFIG.imagesDir, filename);

      try {
        console.log(`  Downloading ${i + 1}/${uniqueImages.length}: ${filename}`);
        await downloadImage(img.url, filepath);
        galleryItems.push({
          src: `/images/gallery/${filename}`
        });
      } catch (error) {
        console.error(`  Failed to download ${filename}:`, error.message);
      }
    }

    // Write gallery JSON
    const galleryData = {
      images: galleryItems,
      contentHash: createContentHash(uniqueImages),
      fetchedAt: new Date().toISOString()
    };

    const jsonPath = join(CONFIG.dataDir, 'gallery.json');
    writeFileSync(jsonPath, JSON.stringify(galleryData, null, 2), 'utf-8');
    console.log(`\nUpdated ${jsonPath}`);
    console.log(`✓ Gallery update complete! ${galleryItems.length} images saved.`);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();
