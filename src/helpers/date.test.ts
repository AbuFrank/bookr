import { describe, it, expect } from 'vitest';
import { formatFirestoreDate } from './date';

describe('formatFirestoreDate', () => {
  it('formats a Firestore Timestamp-like object', () => {
    const localDate = new Date(2024, 2, 5); // March 5, 2024, local midnight
    const seconds = Math.floor(localDate.getTime() / 1000);
    expect(formatFirestoreDate({ seconds })).toBe('03/05/24');
  });

  it('formats a JS Date object', () => {
    expect(formatFirestoreDate(new Date(2024, 2, 5))).toBe('03/05/24');
  });

  it('formats a date string', () => {
    expect(formatFirestoreDate('2024-03-05T00:00:00')).toBe('03/05/24');
  });

  it('returns an empty string for falsy input', () => {
    expect(formatFirestoreDate(null)).toBe('');
    expect(formatFirestoreDate(undefined)).toBe('');
    expect(formatFirestoreDate('')).toBe('');
  });

  it('returns an empty string for an unrecognized input shape', () => {
    expect(formatFirestoreDate(42)).toBe('');
  });
});
