import { useEffect, useMemo, useState } from 'react';
import Header from './components/Header';
import StatCards from './components/StatCards';
import FormTransaction from './components/FormTransaction';
import TransactionList from './components/TransactionList';
import { useAuth } from './hooks/useAuth';
import type { FirestoreAccount, FormAccountData } from './types/accountTypes';
import type { FirestoreTransaction } from './types/transactionTypes';
import { findAccountById, generateFirestoreId } from './lib/firestore';
import ReportTrigger from './components/ReportTrigger';
import { type FormLedgerData, type Ledger, type LedgerInput } from './types/ledgerTypes';
import { useNavigate } from 'react-router-dom';
import { calculateTotals, getAccountNumberRange, isAccountNumberInRange } from './helpers/ledger';
import { getDistinctPaidTo } from './helpers/transactions';
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
  const [isAccountFormToggled, setIsAccountFormToggled] = useState(false);

  const [showLedgerForm, setShowLedgerForm] = useState(false);
  const [editingLedger, setEditingLedger] = useState<Ledger | null>(null);

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

  const ledgerLink = useMemo(() => currentLedger ? `https://docs.google.com/spreadsheets/d/${currentLedger.fileId}` : '', [currentLedger])

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
    const nextAccount = { ...newAccount, [name]: value };

    if (accounts.some((account: FirestoreAccount) => account.accountName.trim().toLocaleLowerCase() === nextAccount.accountName.trim().toLowerCase()
      || account.accountNumber === nextAccount.accountNumber)) {
      setErrors({ ...errors, accountErrors: "Account already exists" })
      return
    } else {
      setErrors({ ...errors, accountErrors: '' })
    }

    if (nextAccount.type && nextAccount.accountNumber && !isAccountNumberInRange(nextAccount.type, nextAccount.subType, nextAccount.accountNumber)) {
      const [min, max] = getAccountNumberRange(nextAccount.type, nextAccount.subType) || [0, 0];
      setErrors({ ...errors, accountNumber: `Account number must be between ${min} and ${max} for this account type` })
    } else {
      setErrors({ ...errors, accountNumber: '' })
    }

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
        date: formData.date,
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

                    return (
                      <button
                        key={ledger.id}
                        onClick={() => setCurrentLedger(ledger)}
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
                      </button>
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
                  className="bg-primary hover:bg-secondary px-4 py-2 rounded-lg flex items-center transition cursor-pointer"
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
          <div className="mb-4">
            <h2 className="text-xl font-bold text-gray-800">Ledger</h2>
          </div>

          <TransactionList
            accounts={accounts}
            transactions={currentTransactions}
            deleteTransaction={deleteTransaction}
            transactionsLoading={transactionsLoading}
          />
        </div>}

        <div className="mt-8">
          {currentLedger && <ReportTrigger />}
        </div>
      </main>
    </div>
  );
};

export default PageTransactions;