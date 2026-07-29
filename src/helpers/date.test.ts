import { describe, it, expect } from 'vitest';
import { formatFirestoreDate, toComparableTime, fromUTCDateOnly, toUTCDateOnly } from './date';

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

describe('toComparableTime', () => {
  it('sorts a Firestore Timestamp-like object before/after correctly', () => {
    const earlier = { seconds: Math.floor(new Date(2024, 2, 1).getTime() / 1000) };
    const later = { seconds: Math.floor(new Date(2024, 2, 8).getTime() / 1000) };
    expect(toComparableTime(earlier)).toBeLessThan(toComparableTime(later));
  });

  it('handles a JS Date object', () => {
    expect(toComparableTime(new Date(2024, 2, 5))).toBe(new Date(2024, 2, 5).getTime());
  });

  it('handles a date string', () => {
    expect(toComparableTime('2024-03-05T00:00:00')).toBe(new Date('2024-03-05T00:00:00').getTime());
  });

  it('returns 0 for falsy or unrecognized input', () => {
    expect(toComparableTime(null)).toBe(0);
    expect(toComparableTime(undefined)).toBe(0);
    expect(toComparableTime(42)).toBe(0);
  });
});

describe('fromUTCDateOnly', () => {
  it('round-trips through toUTCDateOnly back to the same local Y/M/D', () => {
    const picked = new Date(2024, 2, 5); // March 5, 2024, local midnight
    const stored = toUTCDateOnly(picked);
    const editable = fromUTCDateOnly(stored);
    expect(editable.getFullYear()).toBe(2024);
    expect(editable.getMonth()).toBe(2);
    expect(editable.getDate()).toBe(5);
  });

  it('handles a Firestore Timestamp-like object', () => {
    const seconds = Math.floor(Date.UTC(2024, 2, 5) / 1000);
    const editable = fromUTCDateOnly({ seconds });
    expect(editable.getFullYear()).toBe(2024);
    expect(editable.getMonth()).toBe(2);
    expect(editable.getDate()).toBe(5);
  });

  it('handles a date string', () => {
    const editable = fromUTCDateOnly('2024-03-05T00:00:00.000Z');
    expect(editable.getFullYear()).toBe(2024);
    expect(editable.getMonth()).toBe(2);
    expect(editable.getDate()).toBe(5);
  });
});
