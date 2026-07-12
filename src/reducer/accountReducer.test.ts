import { describe, it, expect } from 'vitest';
import accountReducer from './accountReducer';
import { AccountActions, type FirestoreAccount } from '../types/accountTypes';

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

const initialState = { accounts: [], currentAccounts: [] };

describe('accountReducer', () => {
  it('adds an account', () => {
    const account = makeAccount();
    const state = accountReducer(initialState, { type: AccountActions.ADD_ACCOUNT, payload: account });
    expect(state.accounts).toEqual([account]);
  });

  it('updates an account by id', () => {
    const original = makeAccount({ id: 'acc-1', accountName: 'Checking' });
    const updated = makeAccount({ id: 'acc-1', accountName: 'Savings' });
    const state = accountReducer(
      { accounts: [original], currentAccounts: [] },
      { type: AccountActions.UPDATE_ACCOUNT, payload: updated }
    );
    expect(state.accounts).toEqual([updated]);
  });

  it('deletes an account by id', () => {
    const account = makeAccount({ id: 'acc-1' });
    const state = accountReducer(
      { accounts: [account], currentAccounts: [] },
      { type: AccountActions.DELETE_ACCOUNT, payload: 'acc-1' }
    );
    expect(state.accounts).toEqual([]);
  });

  it('replaces accounts wholesale on SET_ACCOUNTS', () => {
    const accounts = [makeAccount({ id: 'acc-1' }), makeAccount({ id: 'acc-2' })];
    const state = accountReducer(initialState, { type: AccountActions.SET_ACCOUNTS, payload: accounts });
    expect(state.accounts).toEqual(accounts);
  });

  it('sets currentAccounts independently of accounts', () => {
    const accounts = [makeAccount({ id: 'acc-1', bookId: 'book-1' })];
    const state = accountReducer(
      { accounts, currentAccounts: [] },
      { type: AccountActions.SET_CURRENT_ACCOUNTS, payload: accounts }
    );
    expect(state.currentAccounts).toEqual(accounts);
  });

  it('resets to empty state', () => {
    const accounts = [makeAccount()];
    const state = accountReducer(
      { accounts, currentAccounts: accounts },
      { type: AccountActions.RESET }
    );
    expect(state).toEqual(initialState);
  });

  it('returns the same state for an unknown action', () => {
    const state = accountReducer(initialState, { type: 'UNKNOWN' });
    expect(state).toBe(initialState);
  });
});
