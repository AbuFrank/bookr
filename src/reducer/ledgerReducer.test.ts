import { describe, it, expect } from 'vitest';
import ledgerReducer from './ledgerReducer';
import { LedgerActions, type Ledger } from '../types/ledgerTypes';

const makeLedger = (overrides: Partial<Ledger> = {}): Ledger => ({
  id: 'ledger-1',
  userId: 'user-1',
  name: 'Ledger',
  description: '',
  dateCreated: new Date('2024-01-01'),
  parentFolderId: 'year-1',
  fileId: 'file-1',
  ...overrides,
});

const initialState = { ledgers: [], currentLedgers: [], currentLedger: null };

describe('ledgerReducer', () => {
  it('adds a ledger', () => {
    const ledger = makeLedger();
    const state = ledgerReducer(initialState, { type: LedgerActions.ADD_LEDGER, payload: ledger });
    expect(state.ledgers).toEqual([ledger]);
  });

  it('updates a ledger by id and keeps currentLedger in sync when it matches', () => {
    const original = makeLedger({ id: 'ledger-1', name: 'Old' });
    const updated = makeLedger({ id: 'ledger-1', name: 'New' });
    const state = ledgerReducer(
      { ledgers: [original], currentLedgers: [], currentLedger: original },
      { type: LedgerActions.UPDATE_LEDGER, payload: updated }
    );
    expect(state.ledgers).toEqual([updated]);
    expect(state.currentLedger).toEqual(updated);
  });

  it('does not touch currentLedger when updating a different ledger', () => {
    const current = makeLedger({ id: 'ledger-1' });
    const other = makeLedger({ id: 'ledger-2', name: 'Updated' });
    const state = ledgerReducer(
      { ledgers: [current, makeLedger({ id: 'ledger-2' })], currentLedgers: [], currentLedger: current },
      { type: LedgerActions.UPDATE_LEDGER, payload: other }
    );
    expect(state.currentLedger).toEqual(current);
  });

  it('deletes a ledger by id and clears currentLedger if it was the one deleted', () => {
    const ledger = makeLedger({ id: 'ledger-1' });
    const state = ledgerReducer(
      { ledgers: [ledger], currentLedgers: [], currentLedger: ledger },
      { type: LedgerActions.DELETE_LEDGER, payload: 'ledger-1' }
    );
    expect(state.ledgers).toEqual([]);
    expect(state.currentLedger).toBeNull();
  });

  it('sets ledgers, currentLedgers, and currentLedger independently', () => {
    const ledger = makeLedger();
    let state = ledgerReducer(initialState, { type: LedgerActions.SET_LEDGERS, payload: [ledger] });
    expect(state.ledgers).toEqual([ledger]);

    state = ledgerReducer(state, { type: LedgerActions.SET_CURRENT_LEDGERS, payload: [ledger] });
    expect(state.currentLedgers).toEqual([ledger]);

    state = ledgerReducer(state, { type: LedgerActions.SET_CURRENT_LEDGER, payload: ledger });
    expect(state.currentLedger).toEqual(ledger);
  });

  it('resets to empty state', () => {
    const ledger = makeLedger();
    const state = ledgerReducer(
      { ledgers: [ledger], currentLedgers: [ledger], currentLedger: ledger },
      { type: LedgerActions.RESET }
    );
    expect(state).toEqual(initialState);
  });

  it('returns the same state for an unknown action', () => {
    const state = ledgerReducer(initialState, { type: 'UNKNOWN' });
    expect(state).toBe(initialState);
  });
});
