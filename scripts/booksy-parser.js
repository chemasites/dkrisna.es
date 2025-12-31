/**
 * Booksy service parser - generates HTML from parsed service data
 */

/**
 * @typedef {Object} Service
 * @property {string} name
 * @property {string} price
 * @property {string} duration
 * @property {string} [originalPrice]
 */

/**
 * @typedef {Object} ServiceCategory
 * @property {string} name
 * @property {Service[]} services
 */

/**
 * Categorizes services into nail and beauty categories
 * @param {ServiceCategory[]} categories
 * @returns {Object} Categorized services for manicura page
 */
export function categorizeNailServices(categories) {
  const categoryMap = {
    'Uñas de las Manos': [],
    'Uñas de los Pies': [],
    'Cejas y Pestañas': []
  };

  categories.forEach(cat => {
    const catNameLower = cat.name.toLowerCase();

    if (catNameLower.includes('mano') || catNameLower.includes('uñas de más')) {
      categoryMap['Uñas de las Manos'] = cat.services;
    } else if (catNameLower.includes('pie') || catNameLower.includes('pedicura')) {
      categoryMap['Uñas de los Pies'] = cat.services;
    } else if (catNameLower.includes('ceja') || catNameLower.includes('pestaña')) {
      categoryMap['Cejas y Pestañas'] = cat.services;
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
 * @returns {string}
 */
export function generateServiceCardHTML(service) {
  const price = service.price || 'Consultar';
  const duration = service.duration || '';

  let priceHTML = price;
  if (service.originalPrice) {
    priceHTML = `<span class="price-original">${service.originalPrice}</span> ${price}`;
  }

  return `<div class="service-detail-card">
<div class="service-header">
<h3>${service.name}</h3>
<span class="service-price">${priceHTML}</span>
</div>
${duration ? `<span class="service-duration">${duration}</span>` : ''}
</div>`;
}

/**
 * Generates HTML for the manicura page
 * @param {ServiceCategory[]} categories
 * @returns {string}
 */
export function generateManicuraHTML(categories) {
  const categoryMap = categorizeNailServices(categories);

  let html = `<div class="services-full">
<div class="services-intro">
<p>Descubre nuestros servicios de belleza, donde cada detalle cuenta. Utilizamos productos de alta calidad para garantizar resultados duraderos y un acabado impecable.</p>
</div>

`;

  for (const [categoryName, categoryServices] of Object.entries(categoryMap)) {
    if (categoryServices.length > 0) {
      html += `<h2 class="services-category-title">${categoryName}</h2>
<div class="services-list">
`;

      categoryServices.forEach(service => {
        html += generateServiceCardHTML(service) + '\n\n';
      });

      html += `</div>

`;
    }
  }

  html += `<div class="services-note">
<p><strong>Nota:</strong> Reserva tu cita en Booksy para consultar disponibilidad.</p>
</div>
</div>`;

  return html;
}

/**
 * Generates HTML for the masajes page
 * @param {ServiceCategory[]} categories
 * @returns {string}
 */
export function generateMasajesHTML(categories) {
  const massageServices = extractMassageServices(categories);

  let html = `<div class="services-full">
<div class="services-intro">
<p>Nuestros masajes están diseñados para liberar tensiones, mejorar la circulación y proporcionar un estado de relajación profunda. Cada sesión es personalizada según tus necesidades.</p>
</div>

<div class="services-list">
`;

  massageServices.forEach(service => {
    html += generateServiceCardHTML(service) + '\n\n';
  });

  html += `</div>

<div class="services-note">
<p><strong>Oferta especial:</strong> Aprovecha nuestros precios promocionales. Reserva tu cita en Booksy para consultar disponibilidad.</p>
</div>
</div>`;

  return html;
}

/**
 * Parses price string to extract original and current price
 * @param {string} priceText
 * @returns {{ price: string, originalPrice?: string }}
 */
export function parsePrice(priceText) {
  if (!priceText) return { price: 'Consultar' };

  // Check for discounted price pattern (e.g., "40€ 20€" or "desde 15€")
  const discountMatch = priceText.match(/(\d+[.,]?\d*)\s*€?\s+(\d+[.,]?\d*)\s*€/);
  if (discountMatch) {
    return {
      originalPrice: `${discountMatch[1]}€`,
      price: `desde ${discountMatch[2]}€`
    };
  }

  // Check for "desde" pattern
  const desdeMatch = priceText.match(/desde\s*(\d+[.,]?\d*)\s*€/i);
  if (desdeMatch) {
    return { price: `desde ${desdeMatch[1]}€` };
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
 * @returns {string}
 */
export function parseDuration(durationText) {
  if (!durationText) return '';

  // Normalize various duration formats
  const text = durationText.trim().toLowerCase();

  // Match patterns like "1h", "1 hour", "1.5 hours", "90 min", etc.
  const hourMatch = text.match(/(\d+[.,]?\d*)\s*(h|hour|hora)/i);
  const minMatch = text.match(/(\d+)\s*(m|min|minuto)/i);

  if (hourMatch && minMatch) {
    return `${hourMatch[1]} hora${hourMatch[1] !== '1' ? 's' : ''} ${minMatch[1]} min`;
  } else if (hourMatch) {
    const hours = parseFloat(hourMatch[1].replace(',', '.'));
    if (hours === 1) return '1 hora';
    if (hours === 1.5) return '1 hora 30 min';
    return `${hours} horas`;
  } else if (minMatch) {
    return `${minMatch[1]} min`;
  }

  return durationText.trim();
}
