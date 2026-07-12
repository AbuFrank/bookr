import { describe, it, expect } from 'vitest';
import { transactionReducer } from './transactionReducer';
import { TransactionActions, type FirestoreTransaction } from '../types/transactionTypes';

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

const initialState = { transactions: [], currentTransactions: [] };

describe('transactionReducer', () => {
  it('adds a transaction', () => {
    const txn = makeTransaction();
    const state = transactionReducer(initialState, { type: TransactionActions.ADD_TRANSACTION, payload: txn });
    expect(state.transactions).toEqual([txn]);
  });

  it('updates a transaction by id', () => {
    const original = makeTransaction({ id: 'txn-1', value: 100 });
    const updated = makeTransaction({ id: 'txn-1', value: 200 });
    const state = transactionReducer(
      { transactions: [original], currentTransactions: [] },
      { type: TransactionActions.UPDATE_TRANSACTION, payload: updated }
    );
    expect(state.transactions).toEqual([updated]);
  });

  it('deletes a transaction by id', () => {
    const txn = makeTransaction({ id: 'txn-1' });
    const state = transactionReducer(
      { transactions: [txn], currentTransactions: [] },
      { type: TransactionActions.DELETE_TRANSACTION, payload: 'txn-1' }
    );
    expect(state.transactions).toEqual([]);
  });

  it('replaces transactions wholesale on SET_TRANSACTIONS', () => {
    const txns = [makeTransaction({ id: 'txn-1' }), makeTransaction({ id: 'txn-2' })];
    const state = transactionReducer(initialState, { type: TransactionActions.SET_TRANSACTIONS, payload: txns });
    expect(state.transactions).toEqual(txns);
  });

  it('sets currentTransactions independently of transactions', () => {
    const txns = [makeTransaction({ id: 'txn-1' })];
    const state = transactionReducer(
      { transactions: txns, currentTransactions: [] },
      { type: TransactionActions.SET_CURRENT_TRANSACTIONS, payload: txns }
    );
    expect(state.currentTransactions).toEqual(txns);
    expect(state.transactions).toEqual(txns);
  });

  it('resets to empty state', () => {
    const txns = [makeTransaction()];
    const state = transactionReducer(
      { transactions: txns, currentTransactions: txns },
      { type: TransactionActions.RESET }
    );
    expect(state).toEqual(initialState);
  });

  it('returns the same state for an unknown action', () => {
    const state = transactionReducer(initialState, { type: 'UNKNOWN' });
    expect(state).toBe(initialState);
  });
});
