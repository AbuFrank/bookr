import { useEffect, useMemo, useState } from 'react';
import Header from './components/Header';
import StatCards from './components/StatCards';
import FormTransaction from './components/FormTransaction';
import TransactionList from './components/TransactionList';
import { useAuth } from './hooks/useAuth';
import type { FirestoreAccount, FormAccountData } from './types/accountTypes';
import type { EditTransactionFormData, FirestoreTransaction } from './types/transactionTypes';
import { findAccountById, generateFirestoreId } from './lib/firestore';
import ReportTrigger from './components/ReportTrigger';
import { type FormLedgerData, type Ledger, type LedgerInput } from './types/ledgerTypes';
import { useNavigate } from 'react-router-dom';
import { calculateTotals, getAccountNumberRange, isAccountNumberInRange } from './helpers/ledger';
import { getDistinctPaidTo } from './helpers/transactions';
import { fromUTCDateOnly, toUTCDateOnly } from './helpers/date';
import { reauthenticate } from './firebase/authService';
import FormLedger from './components/FormLedger';
import { PencilIcon, PlusIcon, XIcon } from 'lucide-react';

const PageTransactions: React.FC = () => {
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [formData, setFormData] = useState({
    checkNumber: '',
    date: new Date(),
    paidTo: '',
    memo: '',
    accountId: '',
    value: '',
  });

  const [newAccount, setNewAccount] = useState<FormAccountData>({
    accountName: '',
    accountNumber: null,
    type: null,
    subType: null,
  });

  const [currentAccount, setCurrentAccount] = useState<FirestoreAccount | null>(null);
  const [showTransactionForm, setShowTransactionForm] = useState(false);

  const [editingTransactionId, setEditingTransactionId] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState<EditTransactionFormData>({
    checkNumber: '',
    paidTo: '',
    memo: '',
    value: '',
    date: new Date(),
  });
  const [isAccountFormToggled, setIsAccountFormToggled] = useState(false);

  const [showLedgerForm, setShowLedgerForm] = useState(false);
  const [editingLedger, setEditingLedger] = useState<Ledger | null>(null);

  const [isEditingStartingBalance, setIsEditingStartingBalance] = useState(false);
  const [startingBalanceInput, setStartingBalanceInput] = useState('');

  const [newLedger, setNewLedger] = useState<FormLedgerData>({
    name: '',
    description: '',
    dateCreated: new Date(),
    // startingBalance: '',
  });

  const {
    user,
    accounts,
    transactions,
    currentTransactions,
    addTransaction,
    updateTransaction,
    deleteTransaction,
    addAccount,
    loading,
    transactionsLoading,
    accountsLoading,
    currentFiscalYear,
    currentBook,
    ledgersLoading,
    addLedger,
    updateLedger,
    updateFolder,
    currentLedger,
    currentLedgers,
    setCurrentLedger,
  } = useAuth();

  const paidToOptions = useMemo(() => getDistinctPaidTo(transactions), [transactions]);

  const navigate = useNavigate()

  useEffect(() => {
    // Navigate to books if no current year or book
    console.log('navigate useEffect called..... ')
    if (!loading && !(currentFiscalYear?.id && currentBook)) {
      navigate('/books')
    }
  }, [loading, currentFiscalYear, currentBook, navigate])


  const sortedLedgers = useMemo(() => {
    return [...currentLedgers].sort(
      (a, b) => new Date(b.dateCreated).getTime() - new Date(a.dateCreated).getTime()
    );
  }, [currentLedgers]);

  // sortedLedgers is newest-first; the fiscal year's starting balance only ever
  // seeds the chronologically-first ledger's running total (see calculateAccountTotals).
  const firstLedger = sortedLedgers.length > 0 ? sortedLedgers[sortedLedgers.length - 1] : null;

  const ledgerLink = useMemo(() => currentLedger ? `https://docs.google.com/spreadsheets/d/${currentLedger.fileId}` : '', [currentLedger])

  const handleStartingBalanceEditToggle = () => {
    setStartingBalanceInput((currentFiscalYear?.startingBalance ?? 0).toString());
    setIsEditingStartingBalance(true);
  };

  const handleStartingBalanceSave = async () => {
    if (!currentFiscalYear) return;
    const parsed = parseFloat(startingBalanceInput);
    const startingBalance = isNaN(parsed) ? 0 : Number(parsed.toFixed(2));
    await updateFolder({ ...currentFiscalYear, startingBalance });
    setIsEditingStartingBalance(false);
  };

  /*
   * New Ledger Form
   */
  // const handleNewLedgerToggleOn = () => {
  //   if (currentLedgers.length > 0) {
  //     const runningBalance = currentLedgers[-1].runningBalance
  //   }
  // }

  const handleLedgerFormChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;

    // if (name === 'startingBalance') {
    //   console.log('form event is running balance....')
    //   // Allow only valid number characters and prevent invalid input
    //   const isNumberInput = /^-?\d*\.?\d*$/.test(value);
    //   if (value !== '' && !isNumberInput) {
    //     setErrors({ ...errors, startingBalance: 'Value must be a decimal number' })
    //     return;
    //   }
    // }

    setErrors({ ...errors, startingBalance: '' })
    setNewLedger(prev => ({ ...prev, [name]: value }));
  };

  const handleLedgerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newLedger.name.trim()) return;

    if (!currentFiscalYear?.id || !currentBook) {
      navigate('/books')
      return
    }

    // let startingBalance;
    // const parsedBalance = parseFloat(newLedger.startingBalance);
    // if (!isNaN(parsedBalance)) {
    //   startingBalance = Number(parsedBalance.toFixed(2));
    // } else {
    //   startingBalance = 0
    // }

    try {
      // TODO create more robust error management and form requirements
      if (editingLedger) {
        const updated: Ledger = {
          ...editingLedger,
          name: newLedger.name.trim(),
          description: newLedger.description.trim(),
        };
        await updateLedger(updated);
        setEditingLedger(null);
      } else {
        const ledgerData: LedgerInput = {
          id: generateFirestoreId('ledgers'),
          userId: user?.uid || 'unknown',
          name: newLedger.name.trim(),
          description: newLedger.description.trim(),
          dateCreated: new Date(),
          parentFolderId: currentFiscalYear.id,
        };
        await addLedger(ledgerData);
      }
      setNewLedger({
        name: '',
        description: '',
        dateCreated: new Date(),
        // startingBalance: '',
      });
      setShowLedgerForm(false);
    } catch (error: any) {
      console.error('Error creating ledger:', error);
      if (error?.message?.includes('Token expired')) {
        console.log('Access token invalid');

        // Show a button to re-authenticate instead of auto-reauth
        const userAction = window.confirm('Your session has expired. Please re-authenticate to continue.');

        if (userAction) {
          console.log('WE HAVE USER ACTION!!!')
          try {
            await reauthenticate()
          } catch (reauthError) {
            console.error('Re-authentication failed:', reauthError);
            alert('Could not re-authenticate. Please refresh the page.');
          }
        }
      } else {
        console.error('Folder creation failed:', error);
        alert('Failed to create folder. Please contact support.');
      }
    }
  };

  /*
   * Accounts
   */
  const handleAccountFormChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    const parsedValue = name === 'accountNumber' ? (value === '' ? null : Number(value)) : value;
    const nextAccount = { ...newAccount, [name]: parsedValue };

    const nextErrors = { ...errors };

    nextErrors.accountErrors = accounts.some((account: FirestoreAccount) =>
      account.accountName.trim().toLocaleLowerCase() === nextAccount.accountName.trim().toLowerCase()
    ) ? "Account already exists" : '';

    if (nextAccount.type && nextAccount.accountNumber) {
      // Range first: an account number outside its type's allotted range can't
      // be a real duplicate, since every existing account is already in-range.
      if (!isAccountNumberInRange(nextAccount.type, nextAccount.subType, nextAccount.accountNumber)) {
        const [min, max] = getAccountNumberRange(nextAccount.type, nextAccount.subType) || [0, 0];
        nextErrors.accountNumber = `Account number must be between ${min} and ${max} for this account type`;
      } else {
        const numberExists = accounts.some((account: FirestoreAccount) =>
          account.type === nextAccount.type
          && account.subType === nextAccount.subType
          && Number(account.accountNumber) === Number(nextAccount.accountNumber)
        );
        nextErrors.accountNumber = numberExists ? 'An account with this number already exists' : '';
      }
    } else {
      nextErrors.accountNumber = '';
    }

    setErrors(nextErrors);
    setNewAccount(nextAccount);
  };

  const handleAccountSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const { value } = e.target;
    const selectedAccount = findAccountById(accounts, value);
    setCurrentAccount(selectedAccount || null);
  };

  const handleDateChange = (date: Date | null) => {
    setFormData(prev => ({ ...prev, date: date || new Date() }));
  };

  /* 
   * Transactions
   */
  const handleTransactionFormChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;

    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleTransactionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // TODO add a isSynced state to the ledger when state changes (transaction and ledger info) that is remove when the update ledger button is pressed.
    // TODO also hide button when isSynced is true
    // TODO prevent navigating away if isSynced === false

    console.log('transaction submit data ==> ',
      currentLedger
    )

    if (
      formData.paidTo &&
      formData.value &&
      formData.date &&
      currentAccount?.id &&
      currentLedger?.id
    ) {
      const transactionData: FirestoreTransaction = {
        id: generateFirestoreId('transactions'),
        userId: user?.uid || 'unknown',
        checkNumber: formData.checkNumber,
        date: toUTCDateOnly(formData.date),
        dateCreated: new Date(),
        ledgerId: currentLedger.id,
        paidTo: formData.paidTo,
        memo: formData.memo,
        accountId: currentAccount.id,
        value: parseFloat(formData.value),
      };

      try {
        await addTransaction(transactionData);
        setFormData({
          date: formData.date,
          checkNumber: '',
          paidTo: '',
          memo: '',
          accountId: '',
          value: '',
        });
        setCurrentAccount(null);
      } catch (error) {
        console.error('Error submitting transaction:', error);
      }
    }
  };

  const handleEditStart = (transaction: FirestoreTransaction) => {
    setEditingTransactionId(transaction.id);
    setEditFormData({
      checkNumber: transaction.checkNumber || '',
      paidTo: transaction.paidTo,
      memo: transaction.memo || '',
      value: transaction.value.toString(),
      date: fromUTCDateOnly(transaction.date),
    });
  };

  const handleEditFormChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setEditFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleEditDateChange = (date: Date | null) => {
    setEditFormData(prev => ({ ...prev, date: date || new Date() }));
  };

  const handleEditCancel = () => {
    setEditingTransactionId(null);
  };

  const handleEditSave = async (transaction: FirestoreTransaction) => {
    if (!editFormData.paidTo || !editFormData.value) return;

    const updatedTransaction: FirestoreTransaction = {
      ...transaction,
      checkNumber: editFormData.checkNumber,
      paidTo: editFormData.paidTo,
      memo: editFormData.memo,
      value: parseFloat(editFormData.value),
      date: toUTCDateOnly(editFormData.date),
    };

    try {
      await updateTransaction(updatedTransaction);
      setEditingTransactionId(null);
    } catch (error) {
      console.error('Error updating transaction:', error);
    }
  };

  const handleAccountSubmit = async () => {
    // TODO change conditional explicit check and error message accordingly
    if (newAccount.accountName && currentBook?.id && newAccount.type && newAccount.accountNumber) {
      if (accounts.some((account: FirestoreAccount) => account.accountName.trim().toLocaleLowerCase() === newAccount.accountName.trim().toLowerCase())) {
        setErrors({ ...errors, accountErrors: "Account already exists" })
        return
      }
      if (!isAccountNumberInRange(newAccount.type, newAccount.subType, newAccount.accountNumber)) {
        const [min, max] = getAccountNumberRange(newAccount.type, newAccount.subType) || [0, 0];
        setErrors({ ...errors, accountNumber: `Account number must be between ${min} and ${max} for this account type` })
        return
      }
      if (accounts.some((account: FirestoreAccount) =>
        account.type === newAccount.type
        && account.subType === newAccount.subType
        && Number(account.accountNumber) === Number(newAccount.accountNumber)
      )) {
        setErrors({ ...errors, accountNumber: 'An account with this number already exists' })
        return
      }
      const accountData: FirestoreAccount = {
        accountName: newAccount.accountName,
        accountNumber: newAccount.accountNumber,
        bookId: currentBook?.id,
        dateCreated: new Date(),
        id: generateFirestoreId('accounts'),
        type: newAccount.type,
        subType: newAccount.subType,
        userId: user?.uid || 'unknown',
      };

      try {
        await addAccount(accountData);
        setNewAccount({
          accountName: '',
          accountNumber: null,
          type: null,
          subType: null,
        });
        setCurrentAccount(accountData);
        setIsAccountFormToggled(false);
      } catch (error) {
        console.error('Error submitting transaction:', error);
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  const {
    totalDeposits,
    totalNonIncomeDeposits,
    totalIncome,
    totalDeductibleExpenses,
    totalNonDeductibleExpenses,
    totalExpenses,
    totalBalance,
    totalBalanceExcludingNonIncomeAndNonDeductible,
    totalBalanceIncludingPreviousBalance
  } = calculateTotals(currentTransactions, currentFiscalYear?.startingBalance || 0, accounts)
  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <main className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
          {/* Left column: Ledgers */}
          <aside className="xl:col-span-3">
            <div className="bg-white rounded-xl shadow-md p-6 h-full">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-800 py-2">Ledgers</h2>
                {!showLedgerForm &&
                  <button
                    onClick={() => {
                      setEditingLedger(null);
                      setNewLedger({ name: '', description: '', dateCreated: new Date() });
                      setShowLedgerForm(true);
                    }}
                    className="btn-primary px-3 py-2 rounded-lg transition cursor-pointer"
                  >
                    New
                  </button>
                }
              </div>

              {showLedgerForm && (
                <FormLedger
                  errors={errors}
                  handleLedgerFormChange={handleLedgerFormChange}
                  handleLedgerSubmit={handleLedgerSubmit}
                  setShowLedgerForm={(show) => {
                    setShowLedgerForm(show);
                    if (!show) setEditingLedger(null);
                  }}
                  ledgersLoading={ledgersLoading}
                  newLedger={newLedger}
                  isEditing={!!editingLedger} />
              )}

              <div className="space-y-3">
                {sortedLedgers.length === 0 ? (
                  <div className="text-sm text-gray-500 border border-dashed border-gray-300 rounded-lg p-4">
                    No ledgers yet. Create your first ledger.
                  </div>
                ) : (
                  sortedLedgers.map((ledger) => {
                    const isSelected = currentLedger?.id === ledger.id;
                    const isFirstLedger = ledger.id === firstLedger?.id;

                    return (
                      <div
                        key={ledger.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => setCurrentLedger(ledger)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') setCurrentLedger(ledger);
                        }}
                        className={`w-full text-left rounded-lg border p-4 transition cursor-pointer ${isSelected
                          ? 'border-primary bg-blue-50'
                          : 'border-gray-200 hover:bg-gray-50'
                          }`}
                      >
                        <div className="font-semibold text-gray-900">{ledger.name}</div>
                        {ledger.description && (
                          <div className="text-sm text-gray-500 mt-1">{ledger.description}</div>
                        )}
                        <div className="text-xs text-gray-400 mt-2">
                          Created {new Date(ledger.dateCreated).toLocaleDateString()}
                        </div>
                        {isFirstLedger && (
                          <div className="text-xs text-gray-500 mt-2" onClick={(e) => e.stopPropagation()}>
                            {isEditingStartingBalance ? (
                              <div className="flex items-center gap-1">
                                <span>Starting balance: $</span>
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  autoFocus
                                  value={startingBalanceInput}
                                  onChange={(e) => setStartingBalanceInput(e.target.value)}
                                  className="w-20 rounded border border-gray-300 px-1 py-0.5"
                                />
                                <button
                                  type="button"
                                  onClick={handleStartingBalanceSave}
                                  className="text-blue-500 hover:text-blue-700 hover:underline"
                                >
                                  Save
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setIsEditingStartingBalance(false)}
                                  className="text-gray-400 hover:text-gray-600 hover:underline"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <span>
                                Starting balance: ${(currentFiscalYear?.startingBalance ?? 0).toFixed(2)}{' '}
                                <button
                                  type="button"
                                  onClick={handleStartingBalanceEditToggle}
                                  className="inline-flex items-center rounded-full border border-gray-300 bg-white px-2.5 py-0.5 text-xs font-medium text-black hover:bg-gray-50"
                                >
                                  Edit
                                </button>
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </aside>

          {/* Right column: selected stats, ledger fields, and transactions */}
          <section className="xl:col-span-9 space-y-6">
            {/* Right column: stats */}
            <aside>
              <div>
                <div className="bg-white rounded-xl shadow-md p-6">
                  <h2 className="text-xl font-bold text-gray-800 mb-4">Stats</h2>
                  <StatCards
                    totalDeposits={totalDeposits}
                    totalIncome={totalIncome}
                    totalNonIncomeDeposits={totalNonIncomeDeposits}
                    totalDeductibleExpenses={totalDeductibleExpenses}
                    totalNonDeductibleExpenses={totalNonDeductibleExpenses}
                    totalExpenses={totalExpenses}
                    balance={totalBalance}
                    balanceExcludingNonIncomeAndNonDeductible={
                      totalBalanceExcludingNonIncomeAndNonDeductible
                    }
                    balanceIncludingPreviousBalance={totalBalanceIncludingPreviousBalance}
                  />
                </div>
              </div>
            </aside>
            {currentLedger && <div className="bg-white rounded-xl shadow-md p-6">
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-6">
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-2xl font-bold text-gray-800">
                      {currentLedger.name}
                    </h1>
                    <button
                      onClick={() => {
                        setNewLedger({
                          name: currentLedger.name,
                          description: currentLedger.description,
                          dateCreated: currentLedger.dateCreated,
                        });
                        setEditingLedger(currentLedger);
                        setShowLedgerForm(true);
                      }}
                      className="text-gray-400 hover:text-gray-700 cursor-pointer"
                      aria-label="Edit ledger"
                    >
                      <PencilIcon size={16} />
                    </button>
                  </div>
                  {currentLedger.description && <p className="text-gray-500 mt-1">
                    {currentLedger.description}
                  </p>}
                  {ledgerLink && <a target="_blank" rel="noreferrer nofollow" className="flex items-center cursor-pointer text-blue-400 hover:text-blue-500 hover:underline transition-colors text-md" href={ledgerLink}>Link to Google spreadsheet</a>}
                </div>

                <button
                  onClick={() => showTransactionForm ? setShowTransactionForm(false) : setShowTransactionForm(true)}
                  className="px-6 py-3 rounded-md font-medium bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors duration-200 flex items-center gap-2 cursor-pointer"
                >
                  {
                    showTransactionForm
                      ? <><XIcon /> Close Form</>
                      : <><PlusIcon /> Add Transaction</>
                  }
                </button>
              </div>

              {showTransactionForm && (
                <div className="bg-white rounded-xl shadow-md p-6">
                  <FormTransaction
                    errors={errors}
                    formData={formData}
                    onTransactionSubmit={handleTransactionSubmit}
                    onTransactionFormChange={handleTransactionFormChange}
                    onTransactionCancel={() => setShowTransactionForm(false)}
                    onDateChange={handleDateChange}
                    handleAccountSelect={handleAccountSelect}
                    setIsAccountFormToggled={setIsAccountFormToggled}
                    accountsLoading={accountsLoading}
                    handleAccountSubmit={handleAccountSubmit}
                    handleAccountFormChange={handleAccountFormChange}
                    accounts={accounts}
                    currentAccount={currentAccount}
                    isAccountFormToggled={isAccountFormToggled}
                    newAccount={newAccount}
                    setNewAccount={setNewAccount}
                    paidToOptions={paidToOptions}
                  />
                </div>
              )}
            </div>}

          </section>


        </div>
        {currentLedger && <div className="bg-white rounded-xl shadow-md p-6 mt-5">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-4">
            <h2 className="text-xl font-bold text-gray-800 pt-3">Ledger</h2>
            <ReportTrigger />
          </div>

          <TransactionList
            accounts={accounts}
            transactions={currentTransactions}
            deleteTransaction={deleteTransaction}
            transactionsLoading={transactionsLoading}
            editingTransactionId={editingTransactionId}
            editFormData={editFormData}
            onEditStart={handleEditStart}
            onEditFormChange={handleEditFormChange}
            onEditDateChange={handleEditDateChange}
            onEditSave={handleEditSave}
            onEditCancel={handleEditCancel}
          />
        </div>}
      </main>
    </div>
  );
};

export default PageTransactions;