/**
 * Translates services from Spanish to English using Claude Haiku API
 */

import Anthropic from '@anthropic-ai/sdk';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createHash } from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const CONFIG = {
  inputFile: join(__dirname, '..', 'static', 'data', 'services.json'),
  outputFile: join(__dirname, '..', 'static', 'data', 'services.en.json'),
  model: 'claude-3-5-haiku-20241022'
};

/**
 * Extracts all translatable text from services data
 */
function extractTranslatableText(servicesData) {
  const texts = [];

  servicesData.categories.forEach((category, catIndex) => {
    category.services.forEach((service, svcIndex) => {
      texts.push({
        id: `${catIndex}-${svcIndex}-name`,
        text: service.name
      });
      if (service.description) {
        texts.push({
          id: `${catIndex}-${svcIndex}-desc`,
          text: service.description
        });
      }
    });
  });

  return texts;
}

/**
 * Creates a hash of the translatable content
 */
function createContentHash(texts) {
  const content = texts.map(t => t.text).sort().join('|');
  return createHash('sha256').update(content).digest('hex').substring(0, 16);
}

/**
 * Gets the stored hash from existing translations file
 */
function getStoredHash() {
  if (!existsSync(CONFIG.outputFile)) {
    return null;
  }
  try {
    const data = JSON.parse(readFileSync(CONFIG.outputFile, 'utf-8'));
    return data.sourceHash || null;
  } catch {
    return null;
  }
}

/**
 * Calls Claude Haiku to translate texts
 */
async function translateWithClaude(texts) {
  const client = new Anthropic();

  const prompt = `Translate the following Spanish beauty salon service names and descriptions to English.
Keep the translations natural and professional for a beauty salon context.
Service names should remain concise. Descriptions should be clear and appealing.

Return a JSON object where keys are the IDs and values are the English translations.
Only return the JSON, no other text.

Texts to translate:
${JSON.stringify(texts, null, 2)}`;

  const response = await client.messages.create({
    model: CONFIG.model,
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: prompt
      }
    ]
  });

  const content = response.content[0];
  if (content.type !== 'text') {
    throw new Error('Unexpected response type from Claude');
  }

  // Parse JSON from response (handle potential markdown code blocks)
  let jsonText = content.text.trim();
  if (jsonText.startsWith('```')) {
    jsonText = jsonText.replace(/^```json?\n?/, '').replace(/\n?```$/, '');
  }

  return JSON.parse(jsonText);
}

/**
 * Applies translations to the services data structure
 */
function applyTranslations(servicesData, translations) {
  const translated = JSON.parse(JSON.stringify(servicesData)); // Deep clone

  translated.categories.forEach((category, catIndex) => {
    category.services.forEach((service, svcIndex) => {
      const nameKey = `${catIndex}-${svcIndex}-name`;
      const descKey = `${catIndex}-${svcIndex}-desc`;

      if (translations[nameKey]) {
        service.name = translations[nameKey];
      }
      if (translations[descKey]) {
        service.description = translations[descKey];
      }
    });
  });

  return translated;
}

async function main() {
  try {
    console.log('Reading services.json...');
    const servicesData = JSON.parse(readFileSync(CONFIG.inputFile, 'utf-8'));

    console.log('Extracting translatable text...');
    const texts = extractTranslatableText(servicesData);
    console.log(`Found ${texts.length} texts to translate`);

    // Check if translation is needed by comparing content hash
    const currentHash = createContentHash(texts);
    const storedHash = getStoredHash();

    if (currentHash === storedHash) {
      console.log('✓ No changes to translate (content hash matches)');
      console.log(`  Hash: ${currentHash}`);
      return;
    }

    console.log(`Content changed (${storedHash || 'no previous'} → ${currentHash})`);
    console.log('Calling Claude Haiku for translation...');
    const translations = await translateWithClaude(texts);

    console.log('Applying translations...');
    const translatedData = applyTranslations(servicesData, translations);

    // Store the source hash for future comparison
    translatedData.sourceHash = currentHash;

    console.log(`Writing ${CONFIG.outputFile}...`);
    writeFileSync(CONFIG.outputFile, JSON.stringify(translatedData, null, 2), 'utf-8');

    console.log('✓ Translation complete!');
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();
