import { describe, it, expect } from 'vitest';
import {
  parsePrice,
  parseDuration,
  categorizeNailServices,
  extractMassageServices,
  generateServiceCardHTML,
  generateManicuraHTML,
  generateMasajesHTML
} from './booksy-parser.js';

describe('parsePrice', () => {
  it('returns "Consultar" for empty input', () => {
    expect(parsePrice('')).toEqual({ price: 'Consultar' });
    expect(parsePrice(null)).toEqual({ price: 'Consultar' });
    expect(parsePrice(undefined)).toEqual({ price: 'Consultar' });
  });

  it('parses simple price', () => {
    expect(parsePrice('15€')).toEqual({ price: '15€' });
    expect(parsePrice('25 €')).toEqual({ price: '25€' });
    expect(parsePrice('10.50€')).toEqual({ price: '10.50€' });
  });

  it('parses "desde" price', () => {
    expect(parsePrice('desde 15€')).toEqual({ price: 'desde 15€' });
    expect(parsePrice('Desde 20€')).toEqual({ price: 'desde 20€' });
  });

  it('parses discounted price with original', () => {
    expect(parsePrice('40€ 20€')).toEqual({
      originalPrice: '40€',
      price: 'desde 20€'
    });
  });

  it('preserves unknown formats', () => {
    expect(parsePrice('Gratis')).toEqual({ price: 'Gratis' });
  });
});

describe('parseDuration', () => {
  it('returns empty string for empty input', () => {
    expect(parseDuration('')).toBe('');
    expect(parseDuration(null)).toBe('');
    expect(parseDuration(undefined)).toBe('');
  });

  it('parses hour formats', () => {
    expect(parseDuration('1h')).toBe('1 hora');
    expect(parseDuration('1 hour')).toBe('1 hora');
    expect(parseDuration('1 hora')).toBe('1 hora');
    expect(parseDuration('2h')).toBe('2 horas');
    expect(parseDuration('1.5h')).toBe('1 hora 30 min');
  });

  it('parses minute formats', () => {
    expect(parseDuration('30min')).toBe('30 min');
    expect(parseDuration('45 min')).toBe('45 min');
    expect(parseDuration('60 minutos')).toBe('60 min');
  });

  it('parses combined formats', () => {
    expect(parseDuration('1h 30min')).toBe('1 hora 30 min');
    expect(parseDuration('2h 15min')).toBe('2 horas 15 min');
  });

  it('preserves unknown formats', () => {
    expect(parseDuration('Variable')).toBe('Variable');
  });
});

describe('categorizeNailServices', () => {
  const mockCategories = [
    {
      name: 'Uñas de más manos',
      services: [{ name: 'Manicura', price: '15€', duration: '30 min' }]
    },
    {
      name: 'Uñas de los pies',
      services: [{ name: 'Pedicura', price: '20€', duration: '45 min' }]
    },
    {
      name: 'Cejas y pestañas',
      services: [{ name: 'Laminado', price: '12€', duration: '45 min' }]
    },
    {
      name: 'Masajes',
      services: [{ name: 'Relajante', price: '30€', duration: '1h' }]
    }
  ];

  it('categorizes hand nail services', () => {
    const result = categorizeNailServices(mockCategories);
    expect(result['Uñas de las Manos']).toHaveLength(1);
    expect(result['Uñas de las Manos'][0].name).toBe('Manicura');
  });

  it('categorizes foot nail services', () => {
    const result = categorizeNailServices(mockCategories);
    expect(result['Uñas de los Pies']).toHaveLength(1);
    expect(result['Uñas de los Pies'][0].name).toBe('Pedicura');
  });

  it('categorizes brow and lash services', () => {
    const result = categorizeNailServices(mockCategories);
    expect(result['Cejas y Pestañas']).toHaveLength(1);
    expect(result['Cejas y Pestañas'][0].name).toBe('Laminado');
  });

  it('excludes massage services', () => {
    const result = categorizeNailServices(mockCategories);
    const allServices = [
      ...result['Uñas de las Manos'],
      ...result['Uñas de los Pies'],
      ...result['Cejas y Pestañas']
    ];
    expect(allServices.find(s => s.name === 'Relajante')).toBeUndefined();
  });
});

describe('extractMassageServices', () => {
  const mockCategories = [
    {
      name: 'Uñas',
      services: [{ name: 'Manicura', price: '15€' }]
    },
    {
      name: 'Masajes',
      services: [
        { name: 'Relajante', price: '30€' },
        { name: 'Piedras Calientes', price: '40€' }
      ]
    }
  ];

  it('extracts only massage services', () => {
    const result = extractMassageServices(mockCategories);
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe('Relajante');
    expect(result[1].name).toBe('Piedras Calientes');
  });

  it('returns empty array when no massages found', () => {
    const result = extractMassageServices([{ name: 'Uñas', services: [] }]);
    expect(result).toHaveLength(0);
  });
});

describe('generateServiceCardHTML', () => {
  it('generates basic service card', () => {
    const service = { name: 'Manicura Básica', price: '15€', duration: '30 min' };
    const html = generateServiceCardHTML(service);

    expect(html).toContain('service-detail-card');
    expect(html).toContain('Manicura Básica');
    expect(html).toContain('15€');
    expect(html).toContain('30 min');
  });

  it('generates card with discounted price', () => {
    const service = {
      name: 'Masaje',
      price: 'desde 20€',
      originalPrice: '40€',
      duration: '1 hora'
    };
    const html = generateServiceCardHTML(service);

    expect(html).toContain('price-original');
    expect(html).toContain('40€');
    expect(html).toContain('desde 20€');
  });

  it('handles missing duration', () => {
    const service = { name: 'Test', price: '10€' };
    const html = generateServiceCardHTML(service);

    expect(html).toContain('Test');
    expect(html).not.toContain('service-duration');
  });

  it('shows "Consultar" for missing price', () => {
    const service = { name: 'Test' };
    const html = generateServiceCardHTML(service);

    expect(html).toContain('Consultar');
  });
});

describe('generateManicuraHTML', () => {
  const mockCategories = [
    {
      name: 'Uñas de más manos',
      services: [{ name: 'Manicura', price: '15€', duration: '30 min' }]
    }
  ];

  it('includes intro text', () => {
    const html = generateManicuraHTML(mockCategories);
    expect(html).toContain('services-intro');
    expect(html).toContain('Descubre nuestros servicios');
  });

  it('includes category titles', () => {
    const html = generateManicuraHTML(mockCategories);
    expect(html).toContain('services-category-title');
    expect(html).toContain('Uñas de las Manos');
  });

  it('includes note at the end', () => {
    const html = generateManicuraHTML(mockCategories);
    expect(html).toContain('services-note');
    expect(html).toContain('Reserva tu cita en Booksy');
  });
});

describe('generateMasajesHTML', () => {
  const mockCategories = [
    {
      name: 'Masajes',
      services: [{ name: 'Relajante', price: '30€', duration: '1h' }]
    }
  ];

  it('includes intro text', () => {
    const html = generateMasajesHTML(mockCategories);
    expect(html).toContain('services-intro');
    expect(html).toContain('liberar tensiones');
  });

  it('includes services', () => {
    const html = generateMasajesHTML(mockCategories);
    expect(html).toContain('Relajante');
    expect(html).toContain('30€');
  });

  it('includes special offer note', () => {
    const html = generateMasajesHTML(mockCategories);
    expect(html).toContain('Oferta especial');
  });
});
