import { describe, it, expect } from 'vitest';
import { createReviewsContentHash, createServicesContentHash } from './content-hash.js';

describe('createReviewsContentHash', () => {
  const sampleReviews = {
    rating: 5,
    reviewCount: 2,
    reviews: [
      { name: 'John D.', text: 'Great service', rating: 5 },
      { name: 'Jane S.', text: 'Excellent', rating: 5 }
    ]
  };

  it('returns a 16-character hex string', () => {
    const hash = createReviewsContentHash(sampleReviews);
    expect(hash).toMatch(/^[a-f0-9]{16}$/);
  });

  it('returns the same hash for identical content', () => {
    const hash1 = createReviewsContentHash(sampleReviews);
    const hash2 = createReviewsContentHash(sampleReviews);
    expect(hash1).toBe(hash2);
  });

  it('ignores fetchedAt timestamp changes', () => {
    const withTimestamp1 = { ...sampleReviews, fetchedAt: '2025-01-01T00:00:00Z' };
    const withTimestamp2 = { ...sampleReviews, fetchedAt: '2025-12-31T23:59:59Z' };

    const hash1 = createReviewsContentHash(withTimestamp1);
    const hash2 = createReviewsContentHash(withTimestamp2);

    expect(hash1).toBe(hash2);
  });

  it('ignores contentHash field', () => {
    const withHash = { ...sampleReviews, contentHash: 'abc123' };

    const hash1 = createReviewsContentHash(sampleReviews);
    const hash2 = createReviewsContentHash(withHash);

    expect(hash1).toBe(hash2);
  });

  it('detects rating changes', () => {
    const changed = { ...sampleReviews, rating: 4.5 };

    const hash1 = createReviewsContentHash(sampleReviews);
    const hash2 = createReviewsContentHash(changed);

    expect(hash1).not.toBe(hash2);
  });

  it('detects reviewCount changes', () => {
    const changed = { ...sampleReviews, reviewCount: 10 };

    const hash1 = createReviewsContentHash(sampleReviews);
    const hash2 = createReviewsContentHash(changed);

    expect(hash1).not.toBe(hash2);
  });

  it('detects review content changes', () => {
    const changed = {
      ...sampleReviews,
      reviews: [
        { name: 'John D.', text: 'Updated review text', rating: 5 },
        { name: 'Jane S.', text: 'Excellent', rating: 5 }
      ]
    };

    const hash1 = createReviewsContentHash(sampleReviews);
    const hash2 = createReviewsContentHash(changed);

    expect(hash1).not.toBe(hash2);
  });

  it('detects new reviews added', () => {
    const changed = {
      ...sampleReviews,
      reviews: [
        ...sampleReviews.reviews,
        { name: 'New R.', text: 'New review', rating: 5 }
      ]
    };

    const hash1 = createReviewsContentHash(sampleReviews);
    const hash2 = createReviewsContentHash(changed);

    expect(hash1).not.toBe(hash2);
  });
});

describe('createServicesContentHash', () => {
  const sampleCategories = [
    {
      id: 'hands',
      name: { es: 'Uñas de las Manos', en: 'Hand Nails' },
      services: [
        { name: 'Manicura', price: '15,00 €', duration: '30 min' }
      ]
    }
  ];

  it('returns a 16-character hex string', () => {
    const hash = createServicesContentHash(sampleCategories);
    expect(hash).toMatch(/^[a-f0-9]{16}$/);
  });

  it('returns the same hash for identical content', () => {
    const hash1 = createServicesContentHash(sampleCategories);
    const hash2 = createServicesContentHash(sampleCategories);
    expect(hash1).toBe(hash2);
  });

  it('detects service name changes', () => {
    const changed = [{
      ...sampleCategories[0],
      services: [
        { name: 'Manicura Premium', price: '15,00 €', duration: '30 min' }
      ]
    }];

    const hash1 = createServicesContentHash(sampleCategories);
    const hash2 = createServicesContentHash(changed);

    expect(hash1).not.toBe(hash2);
  });

  it('detects price changes', () => {
    const changed = [{
      ...sampleCategories[0],
      services: [
        { name: 'Manicura', price: '20,00 €', duration: '30 min' }
      ]
    }];

    const hash1 = createServicesContentHash(sampleCategories);
    const hash2 = createServicesContentHash(changed);

    expect(hash1).not.toBe(hash2);
  });

  it('detects new services added', () => {
    const changed = [{
      ...sampleCategories[0],
      services: [
        ...sampleCategories[0].services,
        { name: 'Pedicura', price: '20,00 €', duration: '45 min' }
      ]
    }];

    const hash1 = createServicesContentHash(sampleCategories);
    const hash2 = createServicesContentHash(changed);

    expect(hash1).not.toBe(hash2);
  });

  it('detects new categories added', () => {
    const changed = [
      ...sampleCategories,
      {
        id: 'feet',
        name: { es: 'Uñas de los Pies', en: 'Foot Nails' },
        services: []
      }
    ];

    const hash1 = createServicesContentHash(sampleCategories);
    const hash2 = createServicesContentHash(changed);

    expect(hash1).not.toBe(hash2);
  });
});
