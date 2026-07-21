import { describe, it, expect } from 'vitest';
import { getDistinctPaidTo } from './transactions';
import type { FirestoreTransaction } from '../types/transactionTypes';

const makeTransaction = (overrides: Partial<FirestoreTransaction> = {}): FirestoreTransaction => ({
  id: 'txn-1',
  userId: 'user-1',
  date: new Date('2024-01-01'),
  dateCreated: new Date('2024-01-01'),
  paidTo: 'Someone',
  accountId: 'acc-1',
  ledgerId: 'ledger-1',
  value: 100,
  ...overrides,
});

describe('getDistinctPaidTo', () => {
  it('returns distinct, sorted, non-empty paidTo values', () => {
    const transactions = [
      makeTransaction({ paidTo: 'Landlord' }),
      makeTransaction({ paidTo: 'Kroger' }),
      makeTransaction({ paidTo: 'Landlord' }),
      makeTransaction({ paidTo: '' }),
      makeTransaction({ paidTo: '  ' }),
    ];

    expect(getDistinctPaidTo(transactions)).toEqual(['Kroger', 'Landlord']);
  });

  it('returns an empty array for no transactions', () => {
    expect(getDistinctPaidTo([])).toEqual([]);
  });
});
