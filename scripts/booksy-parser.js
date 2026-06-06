/**
 * Booksy service parser - generates HTML from parsed service data
 */

/**
 * @typedef {Object} Service
 * @property {string} name
 * @property {string} price
 * @property {string} duration
 * @property {string} [originalPrice]
 * @property {string} [description]
 * @property {number} [serviceId]
 * @property {number} [variantId]
 */

/**
 * @typedef {Object} ServiceCategory
 * @property {string} name
 * @property {Service[]} services
 */

/**
 * Translations for supported languages
 */
const translations = {
  es: {
    book: 'Reservar',
    contactUs: 'Consultar',
    from: 'desde',
    hour: 'hora',
    hours: 'horas',
    min: 'min',
    categories: {
      hands: 'Uñas de las Manos',
      feet: 'Uñas de los Pies',
      browsLashes: 'Cejas y Pestañas',
      massages: 'Masajes',
      woodTherapy: 'Maderoterapia',
      woodTherapyPackages: 'Bonos Maderoterapia'
    },
    manicuraIntro: 'Descubre nuestros servicios de belleza, donde cada detalle cuenta. Utilizamos productos de alta calidad para garantizar resultados duraderos y un acabado impecable.',
    manicuraNote: '<strong>Nota:</strong> Reserva tu cita en Booksy para consultar disponibilidad.',
    masajesIntro: 'Nuestros masajes están diseñados para liberar tensiones, mejorar la circulación y proporcionar un estado de relajación profunda. Cada sesión es personalizada según tus necesidades.',
    masajesNote: '<strong>Oferta especial:</strong> Aprovecha nuestros precios promocionales. Reserva tu cita en Booksy para consultar disponibilidad.'
  },
  en: {
    book: 'Book',
    contactUs: 'Contact us',
    from: 'from',
    hour: 'hour',
    hours: 'hours',
    min: 'min',
    categories: {
      hands: 'Hand Nails',
      feet: 'Foot Nails',
      browsLashes: 'Brows & Lashes',
      massages: 'Massages',
      woodTherapy: 'Wood Therapy',
      woodTherapyPackages: 'Wood Therapy Packages'
    },
    manicuraIntro: 'Discover our beauty services, where every detail matters. We use high-quality products to ensure long-lasting results and a flawless finish.',
    manicuraNote: '<strong>Note:</strong> Book your appointment on Booksy to check availability.',
    masajesIntro: 'Our massages are designed to release tension, improve circulation, and provide a state of deep relaxation. Each session is personalized to your needs.',
    masajesNote: '<strong>Special offer:</strong> Take advantage of our promotional prices. Book your appointment on Booksy to check availability.'
  }
};

/**
 * Get translations for a language
 * @param {string} lang - 'es' or 'en'
 * @returns {Object}
 */
export function getTranslations(lang = 'es') {
  return translations[lang] || translations.es;
}

/**
 * Categorizes services into nail and beauty categories
 * @param {ServiceCategory[]} categories
 * @param {string} [lang='es'] - Language code
 * @returns {Object} Categorized services for manicura page
 */
export function categorizeNailServices(categories, lang = 'es') {
  const t = getTranslations(lang);
  const categoryMap = {
    [t.categories.hands]: [],
    [t.categories.feet]: [],
    [t.categories.browsLashes]: []
  };

  categories.forEach(cat => {
    const catNameLower = cat.name.toLowerCase();

    if (catNameLower.includes('mano') || catNameLower.includes('uñas de más')) {
      categoryMap[t.categories.hands] = cat.services;
    } else if (catNameLower.includes('pie') || catNameLower.includes('pedicura')) {
      categoryMap[t.categories.feet] = cat.services;
    } else if (catNameLower.includes('ceja') || catNameLower.includes('pestaña')) {
      categoryMap[t.categories.browsLashes] = cat.services;
    }
  });

  return categoryMap;
}

/**
 * Extracts massage services from categories
 * @param {ServiceCategory[]} categories
 * @returns {Service[]}
 */
export function extractMassageServices(categories) {
  const massageServices = [];

  categories.forEach(cat => {
    const catNameLower = cat.name.toLowerCase();
    if (catNameLower.includes('masaje') || catNameLower.includes('massage')) {
      massageServices.push(...cat.services);
    }
  });

  return massageServices;
}

/**
 * Generates HTML for a single service card
 * @param {Service} service
 * @param {Object} [options] - Options object
 * @param {string} [options.bookingUrl] - Optional booking URL for the reserve button
 * @param {string} [options.lang='es'] - Language code
 * @returns {string}
 */
export function generateServiceCardHTML(service, options = {}) {
  const { bookingUrl, lang = 'es' } = options;
  const t = getTranslations(lang);
  const price = service.price || t.contactUs;
  const duration = service.duration || '';
  const description = service.description || '';

  let priceHTML = price;
  if (service.originalPrice) {
    priceHTML = `<span class="price-original">${service.originalPrice}</span> ${price}`;
  }

  // Build service-specific booking URL using variant ID
  let serviceBookingUrl = bookingUrl;
  if (bookingUrl && service.variantId) {
    serviceBookingUrl = `${bookingUrl}#ba-s1v${service.variantId}`;
  }

  const bookingButton = serviceBookingUrl
    ? `<a href="${serviceBookingUrl}" class="service-book-btn" target="_blank" rel="noopener">${t.book}</a>`
    : '';

  return `<div class="service-detail-card">
<div class="service-header">
<h3>${service.name}</h3>
<div class="service-meta">
${duration ? `<span class="service-duration">${duration}</span>` : ''}
<span class="service-price">${priceHTML}</span>
</div>
</div>
${description ? `<p class="service-description">${description}</p>` : ''}
${bookingButton}
</div>`;
}

/**
 * Generates HTML for the manicura page
 * @param {ServiceCategory[]} categories
 * @param {Object} [options] - Options object
 * @param {string} [options.bookingUrl] - Optional booking URL for service buttons
 * @param {string} [options.lang='es'] - Language code
 * @returns {string}
 */
export function generateManicuraHTML(categories, options = {}) {
  const { bookingUrl, lang = 'es' } = options;
  const t = getTranslations(lang);
  const categoryMap = categorizeNailServices(categories, lang);

  let html = `<div class="services-full">
<p class="services-intro">${t.manicuraIntro}</p>
`;

  for (const [categoryName, categoryServices] of Object.entries(categoryMap)) {
    if (categoryServices.length > 0) {
      html += `<h2 class="services-category-title">${categoryName}</h2>
<div class="services-list">
`;

      categoryServices.forEach(service => {
        html += generateServiceCardHTML(service, { bookingUrl, lang }) + '\n\n';
      });

      html += `</div>

`;
    }
  }

  html += `<div class="services-note">
<p>${t.manicuraNote}</p>
</div>
</div>`;

  return html;
}

/**
 * Generates HTML for the masajes page
 * @param {ServiceCategory[]} categories
 * @param {Object} [options] - Options object
 * @param {string} [options.bookingUrl] - Optional booking URL for service buttons
 * @param {string} [options.lang='es'] - Language code
 * @returns {string}
 */
export function generateMasajesHTML(categories, options = {}) {
  const { bookingUrl, lang = 'es' } = options;
  const t = getTranslations(lang);
  const massageServices = extractMassageServices(categories);

  let html = `<div class="services-full">
<p class="services-intro">${t.masajesIntro}</p>
<h2 class="services-category-title">${t.categories.massages}</h2>
<div class="services-list">
`;

  massageServices.forEach(service => {
    html += generateServiceCardHTML(service, { bookingUrl, lang }) + '\n\n';
  });

  html += `</div>

<div class="services-note">
<p>${t.masajesNote}</p>
</div>
</div>`;

  return html;
}

/**
 * Parses price string to extract original and current price
 * @param {string} priceText
 * @param {string} [lang='es'] - Language code
 * @returns {{ price: string, originalPrice?: string }}
 */
export function parsePrice(priceText, lang = 'es') {
  const t = getTranslations(lang);
  if (!priceText) return { price: t.contactUs };

  // Check for discounted price pattern (e.g., "40€ 20€" or "desde 15€")
  const discountMatch = priceText.match(/(\d+[.,]?\d*)\s*€?\s+(\d+[.,]?\d*)\s*€/);
  if (discountMatch) {
    return {
      originalPrice: `${discountMatch[1]}€`,
      price: `${t.from} ${discountMatch[2]}€`
    };
  }

  // Check for "desde" pattern
  const desdeMatch = priceText.match(/desde\s*(\d+[.,]?\d*)\s*€/i);
  if (desdeMatch) {
    return { price: `${t.from} ${desdeMatch[1]}€` };
  }

  // Simple price
  const simpleMatch = priceText.match(/(\d+[.,]?\d*)\s*€/);
  if (simpleMatch) {
    return { price: `${simpleMatch[1]}€` };
  }

  return { price: priceText.trim() };
}

/**
 * Parses duration string to normalize format
 * @param {string} durationText
 * @param {string} [lang='es'] - Language code
 * @returns {string}
 */
export function parseDuration(durationText, lang = 'es') {
  const t = getTranslations(lang);
  if (!durationText) return '';

  // Normalize various duration formats
  const text = durationText.trim().toLowerCase();

  // Match patterns like "1h", "1 hour", "1.5 hours", "90 min", etc.
  const hourMatch = text.match(/(\d+[.,]?\d*)\s*(h|hour|hora)/i);
  const minMatch = text.match(/(\d+)\s*(m|min|minuto)/i);

  if (hourMatch && minMatch) {
    return `${hourMatch[1]} ${hourMatch[1] !== '1' ? t.hours : t.hour} ${minMatch[1]} ${t.min}`;
  } else if (hourMatch) {
    const hours = parseFloat(hourMatch[1].replace(',', '.'));
    if (hours === 1) return `1 ${t.hour}`;
    if (hours === 1.5) return `1 ${t.hour} 30 ${t.min}`;
    return `${hours} ${t.hours}`;
  } else if (minMatch) {
    return `${minMatch[1]} ${t.min}`;
  }

  return durationText.trim();
}
