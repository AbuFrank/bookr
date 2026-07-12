import { describe, it, expect } from 'vitest';
import { findAccountById } from './firestore';
import type { FirestoreAccount } from '../types/accountTypes';

const makeAccount = (overrides: Partial<FirestoreAccount> = {}): FirestoreAccount => ({
  id: 'acc-1',
  accountName: 'Checking',
  accountNumber: 1,
  dateCreated: new Date('2024-01-01'),
  userId: 'user-1',
  bookId: 'book-1',
  type: 'deposit',
  subType: null,
  ...overrides,
});

describe('findAccountById', () => {
  const accounts = [makeAccount({ id: 'acc-1' }), makeAccount({ id: 'acc-2' })];

  it('returns the matching account', () => {
    expect(findAccountById(accounts, 'acc-2')?.id).toBe('acc-2');
  });

  it('returns undefined when no account matches', () => {
    expect(findAccountById(accounts, 'missing')).toBeUndefined();
  });
});
