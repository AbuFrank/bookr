import { describe, it, expect } from 'vitest';
import { isValidKey } from './spreadsheetTypes';

describe('isValidKey', () => {
  it.each(['E', 'NE', 'D', 'ND'])('accepts "%s"', (key) => {
    expect(isValidKey(key)).toBe(true);
  });

  it.each(['e', 'X', '', 'deposit', 'expense'])('rejects "%s"', (key) => {
    expect(isValidKey(key)).toBe(false);
  });
});
