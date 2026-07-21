import { describe, it, expect } from 'vitest';
import {
  calculateAccountTotals,
  calculateTotals,
  findAccountById,
  getAccountNumberRange,
  getAccountTypeCode,
  isAccountNumberInRange,
} from './ledger';
import type { FirestoreAccount } from '../types/accountTypes';
import type { FirestoreTransaction } from '../types/transactionTypes';
import type { Ledger } from '../types/ledgerTypes';
import type { Folder } from '../types/folderTypes';

const makeAccount = (overrides: Partial<FirestoreAccount> = {}): FirestoreAccount => ({
  id: 'acc-1',
  accountName: 'Account',
  accountNumber: 1,
  dateCreated: new Date('2024-01-01'),
  userId: 'user-1',
  bookId: 'book-1',
  type: 'deposit',
  subType: null,
  ...overrides,
});

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

const makeFiscalYear = (overrides: Partial<Folder> = {}): Folder => ({
  id: 'year-1',
  name: '2024',
  userId: 'user-1',
  dateCreated: new Date('2024-01-01'),
  parentId: 'book-1',
  startingBalance: 0,
  ...overrides,
});

describe('getAccountTypeCode', () => {
  it('maps a plain expense account to "E"', () => {
    expect(getAccountTypeCode(makeAccount({ type: 'expense', subType: null }))).toBe('E');
  });

  it('maps a non-deductible expense account to "NE"', () => {
    expect(getAccountTypeCode(makeAccount({ type: 'expense', subType: 'non-deductible' }))).toBe('NE');
  });

  it('maps a plain deposit account to "D"', () => {
    expect(getAccountTypeCode(makeAccount({ type: 'deposit', subType: null }))).toBe('D');
  });

  it('maps a non-income deposit account to "ND"', () => {
    expect(getAccountTypeCode(makeAccount({ type: 'deposit', subType: 'non-income' }))).toBe('ND');
  });
});

describe('getAccountNumberRange', () => {
  it('returns null for deposit accounts', () => {
    expect(getAccountNumberRange('deposit', null)).toBeNull();
    expect(getAccountNumberRange('deposit', 'non-income')).toBeNull();
  });

  it('returns [1, 51] for deductible expense accounts', () => {
    expect(getAccountNumberRange('expense', null)).toEqual([1, 51]);
  });

  it('returns [75, 81] for non-deductible expense accounts', () => {
    expect(getAccountNumberRange('expense', 'non-deductible')).toEqual([75, 81]);
  });
});

describe('isAccountNumberInRange', () => {
  it('allows any number for deposit accounts', () => {
    expect(isAccountNumberInRange('deposit', null, 9999)).toBe(true);
  });

  it('enforces 1-51 for deductible expense accounts', () => {
    expect(isAccountNumberInRange('expense', null, 1)).toBe(true);
    expect(isAccountNumberInRange('expense', null, 51)).toBe(true);
    expect(isAccountNumberInRange('expense', null, 52)).toBe(false);
    expect(isAccountNumberInRange('expense', null, 0)).toBe(false);
  });

  it('enforces 75-81 for non-deductible expense accounts', () => {
    expect(isAccountNumberInRange('expense', 'non-deductible', 75)).toBe(true);
    expect(isAccountNumberInRange('expense', 'non-deductible', 81)).toBe(true);
    expect(isAccountNumberInRange('expense', 'non-deductible', 74)).toBe(false);
    expect(isAccountNumberInRange('expense', 'non-deductible', 82)).toBe(false);
  });

  it('rejects non-numeric input', () => {
    expect(isAccountNumberInRange('expense', null, null)).toBe(false);
    expect(isAccountNumberInRange('expense', null, 'abc')).toBe(false);
  });
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

describe('calculateTotals', () => {
  const checking = makeAccount({ id: 'checking', type: 'deposit', subType: null });
  const nonIncomeDeposit = makeAccount({ id: 'gift', type: 'deposit', subType: 'non-income' });
  const vehicle = makeAccount({ id: 'vehicle', type: 'expense', subType: null });
  const donations = makeAccount({ id: 'donations', type: 'expense', subType: 'non-deductible' });
  const accounts = [checking, nonIncomeDeposit, vehicle, donations];

  it('sums deposits and expenses by account type/subType', () => {
    const transactions = [
      makeTransaction({ accountId: 'checking', value: 500 }),
      makeTransaction({ accountId: 'gift', value: 100 }),
      makeTransaction({ accountId: 'vehicle', value: 50 }),
      makeTransaction({ accountId: 'donations', value: 20 }),
    ];

    const totals = calculateTotals(transactions, 0, accounts);

    expect(totals.totalDeposits).toBe(600);
    expect(totals.totalNonIncomeDeposits).toBe(100);
    expect(totals.totalIncome).toBe(500);
    expect(totals.totalDeductibleExpenses).toBe(50);
    expect(totals.totalNonDeductibleExpenses).toBe(20);
    expect(totals.totalExpenses).toBe(70);
    expect(totals.totalBalance).toBe(530);
    expect(totals.totalBalanceExcludingNonIncomeAndNonDeductible).toBe(500 - 50);
    expect(totals.totalBalanceIncludingPreviousBalance).toBe(530);
  });

  it('folds in the starting balance', () => {
    const transactions = [makeTransaction({ accountId: 'checking', value: 100 })];
    const totals = calculateTotals(transactions, 1000, accounts);
    expect(totals.totalBalanceIncludingPreviousBalance).toBe(1100);
  });

  it('returns all zeros for no transactions, aside from the starting balance', () => {
    const totals = calculateTotals([], 250, accounts);
    expect(totals.totalDeposits).toBe(0);
    expect(totals.totalExpenses).toBe(0);
    expect(totals.totalBalance).toBe(0);
    expect(totals.totalBalanceIncludingPreviousBalance).toBe(250);
  });

  it('ignores transactions whose account cannot be found', () => {
    const transactions = [
      makeTransaction({ accountId: 'checking', value: 500 }),
      makeTransaction({ accountId: 'deleted-account', value: 999 }),
    ];
    const totals = calculateTotals(transactions, 0, accounts);
    expect(totals.totalDeposits).toBe(500);
    expect(totals.totalBalance).toBe(500);
  });
});

describe('calculateAccountTotals', () => {
  const checking = makeAccount({ id: 'checking', accountName: 'Checking', accountNumber: 3, type: 'deposit', subType: null });
  const vehicle = makeAccount({ id: 'vehicle', accountName: 'Vehicle', accountNumber: 12, type: 'expense', subType: null });
  const accounts = [checking, vehicle];

  const ledgerA = makeLedger({ id: 'ledger-a', fileId: 'file-a', dateCreated: new Date('2024-01-01') });
  const ledgerB = makeLedger({ id: 'ledger-b', fileId: 'file-b', dateCreated: new Date('2024-01-08') });
  const ledgerC = makeLedger({ id: 'ledger-c', fileId: 'file-c', dateCreated: new Date('2024-01-15') });

  const transactions = [
    makeTransaction({ id: 'txn-1', ledgerId: 'ledger-a', accountId: 'checking', value: 500, date: new Date('2024-01-02'), paidTo: 'Employer' }),
    makeTransaction({ id: 'txn-2', ledgerId: 'ledger-a', accountId: 'vehicle', value: 50, date: new Date('2024-01-03') }),
    makeTransaction({ id: 'txn-3', ledgerId: 'ledger-b', accountId: 'vehicle', value: 30, date: new Date('2024-01-09') }),
    makeTransaction({ id: 'txn-4', ledgerId: 'ledger-c', accountId: 'checking', value: 200, date: new Date('2024-01-16'), paidTo: 'Client' }),
  ];

  const fiscalYear = makeFiscalYear({ startingBalance: 100 });

  it('walks ledgers chronologically and carries running per-account totals forward for E/NE', () => {
    // Deliberately unsorted input to verify the function sorts by dateCreated itself.
    const currentLedgers = [ledgerC, ledgerA, ledgerB];

    const { updates } = calculateAccountTotals(transactions, ledgerA, currentLedgers, accounts, fiscalYear);

    expect(updates).toHaveLength(3);
    const [a, b, c] = updates;

    // Ledger A: first ledger, nothing accumulated yet.
    expect(a.fileId).toBe('file-a');
    expect(a.lastTotal).toBe(100);
    expect(a.lastDTotal).toBe(0);
    expect(a.D).toEqual([{ date: transactions[0].date, description: 'Employer', amount: 500 }]);
    expect(a.E).toEqual([{ accountName: 'Vehicle', accountNumber: 12, value: 50, previousTotal: 0 }]);

    // Ledger B: no deposit activity, so D is empty (no more zero-value carry-forward
    // placeholder row now that deposits are listed chronologically per-transaction).
    // Vehicle's previousTotal still reflects ledger A's expense.
    expect(b.fileId).toBe('file-b');
    expect(b.lastTotal).toBe(550); // 100 starting + 500 deposit - 50 expense from ledger A
    expect(b.lastDTotal).toBe(500); // accumulated from ledger A's deposit
    expect(b.D).toEqual([]);
    expect(b.E).toEqual([{ accountName: 'Vehicle', accountNumber: 12, value: 30, previousTotal: 50 }]);

    // Ledger C: reflects the full history of both prior ledgers.
    expect(c.fileId).toBe('file-c');
    expect(c.lastTotal).toBe(520); // 550 - 30 expense from ledger B
    expect(c.D).toEqual([{ date: transactions[3].date, description: 'Client', amount: 200 }]);
    // E/NE still carry forward a zero-value row (unlike D/ND) since the sheet needs
    // each account's cumulative previousTotal even in a ledger with no new activity.
    expect(c.E).toEqual([{ accountName: 'Vehicle', accountNumber: 12, value: 0, previousTotal: 80 }]);
  });

  it('slices the returned updates to the current ledger onward, while keeping full history in the running totals', () => {
    const { updates } = calculateAccountTotals(transactions, ledgerB, [ledgerA, ledgerB, ledgerC], accounts, fiscalYear);

    expect(updates).toHaveLength(2);
    expect(updates.map(u => u.fileId)).toEqual(['file-b', 'file-c']);
    // Even though ledger A isn't returned, ledger B's numbers still reflect it.
    expect(updates[0].lastDTotal).toBe(500);
    expect(updates[0].D).toEqual([]);
  });

  it('lists multiple deposits in a ledger chronologically, regardless of transaction insertion order', () => {
    const outOfOrderDeposits = [
      makeTransaction({ id: 'txn-later', ledgerId: 'ledger-a', accountId: 'checking', value: 100, date: new Date('2024-01-10'), paidTo: 'Later Payer' }),
      makeTransaction({ id: 'txn-earlier', ledgerId: 'ledger-a', accountId: 'checking', value: 200, date: new Date('2024-01-01'), paidTo: 'Earlier Payer' }),
    ];

    const { updates } = calculateAccountTotals(outOfOrderDeposits, ledgerA, [ledgerA], accounts, fiscalYear);

    expect(updates[0].D).toEqual([
      { date: outOfOrderDeposits[1].date, description: 'Earlier Payer', amount: 200 },
      { date: outOfOrderDeposits[0].date, description: 'Later Payer', amount: 100 },
    ]);
  });

  it('skips transactions referencing an account that no longer exists', () => {
    const withOrphanTransaction = [
      ...transactions,
      makeTransaction({ id: 'txn-orphan', ledgerId: 'ledger-a', accountId: 'deleted-account', value: 9999 }),
    ];

    const { updates } = calculateAccountTotals(withOrphanTransaction, ledgerA, [ledgerA], accounts, fiscalYear);

    expect(updates).toHaveLength(1);
    expect(updates[0].D).toEqual([{ date: transactions[0].date, description: 'Employer', amount: 500 }]);
    expect(updates[0].E).toEqual([{ accountName: 'Vehicle', accountNumber: 12, value: 50, previousTotal: 0 }]);
  });
});
