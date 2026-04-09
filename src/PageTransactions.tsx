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
import type { FirestoreLedger } from './types/ledgerTypes';
import { useNavigate } from 'react-router-dom';

const Transactions: React.FC = () => {
  const [subType, setSubType] = useState<'non-deductible' | 'non-income' | null>(null);
  const [formData, setFormData] = useState({
    checkNumber: '',
    date: new Date(),
    paidTo: '',
    accountId: '',
    value: '',
    type: 'deposit' as 'deposit' | 'expense'
  });

  const [newAccount, setNewAccount] = useState<FormAccountData>({
    accountName: '',
  });

  const [currentAccount, setCurrentAccount] = useState<FirestoreAccount | null>(null);
  const [showTransactionForm, setShowTransactionForm] = useState(false);
  const [isAccountFormToggled, setIsAccountFormToggled] = useState(false);

  const [showLedgerForm, setShowLedgerForm] = useState(false);

  const [newLedger, setNewLedger] = useState({
    name: '',
    description: '',
    dateCreated: new Date(),
  });

  const {
    user,
    accounts,
    transactions,
    addTransaction,
    deleteTransaction,
    addAccount,
    loading,
    transactionsLoading,
    accountsLoading,
    currentFiscalYear,
    currentBook,
    ledgers,
    addLedger,
    currentLedger,
    setCurrentLedger,
  } = useAuth();

  const navigate = useNavigate()

  useEffect(() => {
    // Navigate to books if no current year or book
    if (!loading && !(currentFiscalYear?.id && currentBook)) {
      navigate('/books')
    }
  }, [loading, currentFiscalYear, currentBook])

  const currentLedgerTransactions = useMemo(
    () => transactions.filter((transaction) => transaction.ledgerId === currentLedger?.id) ?? null,
    [currentLedger, transactions]
  );

  const sortedLedgers = useMemo(() => {
    return [...ledgers].sort(
      (a, b) => new Date(b.dateCreated).getTime() - new Date(a.dateCreated).getTime()
    );
  }, [ledgers]);

  const handleTransactionFormChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;

    if (name === 'type') {
      setSubType(null);
    }

    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleLedgerFormChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setNewLedger(prev => ({ ...prev, [name]: value }));
  };

  const handleAccountFormChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setNewAccount(prev => ({ ...prev, [name]: value }));
  };

  const handleAccountSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const { value } = e.target;
    const selectedAccount = findAccountById(accounts, value);
    setCurrentAccount(selectedAccount || null);
  };

  const handleDateChange = (date: Date | null) => {
    setFormData(prev => ({ ...prev, date: date || new Date() }));
  };

  const handleLedgerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newLedger.name.trim()) return;

    if (!currentFiscalYear?.id || !currentBook) {
      alert('No parent folder selected. Contact support. Redirecting to /books ...')
      navigate('/books')
      return
    }

    const ledgerData: FirestoreLedger = {
      id: generateFirestoreId('ledgers'),
      userId: user?.uid || 'unknown',
      name: newLedger.name.trim(),
      description: newLedger.description.trim(),
      dateCreated: new Date(),
      parentFolderId: currentFiscalYear.id,
    };

    try {
      await addLedger(ledgerData);
      setNewLedger({
        name: '',
        description: '',
        dateCreated: new Date(),
      });
      setCurrentLedger(ledgerData);
      setShowLedgerForm(false);
    } catch (error) {
      console.error('Error creating ledger:', error);
    }
  };

  const handleTransactionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    console.log('transaction submit data ==> ',
      currentLedger
    )

    if (
      formData.paidTo &&
      formData.value &&
      formData.date &&
      formData.type &&
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
        accountId: currentAccount?.id || null,
        value: parseFloat(formData.value),
        type: formData.type as 'expense' | 'deposit',
        subType: subType ? subType : null,
      };

      try {
        await addTransaction(transactionData);
        setFormData({
          date: new Date(),
          checkNumber: '',
          paidTo: '',
          accountId: '',
          value: '',
          type: 'expense',
        });
        setSubType(null);
        setCurrentAccount(null);
        setShowTransactionForm(false);
      } catch (error) {
        console.error('Error submitting transaction:', error);
      }
    }
  };

  const handleAccountSubmit = async () => {
    if (newAccount.accountName && currentBook?.id) {
      const accountData: FirestoreAccount = {
        id: generateFirestoreId('accounts'),
        bookId: currentBook?.id,
        userId: user?.uid || 'unknown',
        dateCreated: new Date(),
        accountName: newAccount.accountName,
      };

      try {
        await addAccount(accountData);
        setNewAccount({ accountName: '' });
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

  const totalDeposits = transactions
    .filter(t => t.type === 'deposit')
    .reduce((sum, t) => sum + t.value, 0);

  const totalNonIncomeDeposits = transactions
    .filter(t => t.type === 'deposit' && t.subType === 'non-income')
    .reduce((sum, t) => sum + t.value, 0);

  const totalIncome = totalDeposits - totalNonIncomeDeposits;

  const totalDeductibleExpenses = transactions
    .filter(t => t.type === 'expense' && (!t.subType || t.subType !== 'non-deductible'))
    .reduce((sum, t) => sum + t.value, 0);

  const totalNonDeductibleExpenses = transactions
    .filter(t => t.type === 'expense' && t.subType === 'non-deductible')
    .reduce((sum, t) => sum + t.value, 0);

  const totalExpenses = transactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + t.value, 0);

  const totalBalance = totalDeposits - totalExpenses;
  const totalBalanceExcludingNonIncomeAndNonDeductible =
    (totalDeposits - totalNonIncomeDeposits) - (totalExpenses - totalNonDeductibleExpenses);

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      {console.log('current book ', currentBook)}
      {console.log('current year ', currentFiscalYear)}

      <main className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
          {/* Left column: Ledgers */}
          <aside className="xl:col-span-3">
            <div className="bg-white rounded-xl shadow-md p-6 h-full">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-800 py-2">Ledgers</h2>
                {!showLedgerForm && <button
                  onClick={() => setShowLedgerForm(true)}
                  className="bg-primary hover:bg-secondary px-3 py-2 rounded-lg transition cursor-pointer"
                >
                  New
                </button>}
              </div>

              {showLedgerForm && (
                <form onSubmit={handleLedgerSubmit} className="mb-4 rounded-lg border border-gray-200 p-4 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Name
                    </label>
                    <input
                      type="text"
                      name="name"
                      value={newLedger.name}
                      onChange={handleLedgerFormChange}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2"
                      placeholder="Quarter 1"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Description
                    </label>
                    <textarea
                      name="description"
                      value={newLedger.description}
                      onChange={handleLedgerFormChange}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2"
                      rows={3}
                      placeholder="January through March"
                    />
                  </div>

                  {/* <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Date Created
                    </label>
                    <input
                      type="date"
                      value={newLedger.dateCreated.toISOString().split('T')[0]}
                      onChange={(e) =>
                        setNewLedger(prev => ({
                          ...prev,
                          dateCreated: new Date(e.target.value),
                        }))
                      }
                      className="w-full rounded-lg border border-gray-300 px-3 py-2"
                    />
                  </div> */}

                  <div className="flex gap-2">
                    <button
                      type="submit"
                      className="bg-primary hover:bg-secondary px-4 py-2 rounded-lg"
                    >
                      Save Ledger
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowLedgerForm(false)}
                      className="border border-gray-300 px-4 py-2 rounded-lg"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
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
                  />
                </div>
              </div>
            </aside>
            <div className="bg-white rounded-xl shadow-md p-6">
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-6">
                <div>
                  <h1 className="text-2xl font-bold text-gray-800">
                    {currentLedger ? currentLedger.name : 'Select a ledger'}
                  </h1>
                  <p className="text-gray-500 mt-1">
                    {currentLedger?.description || 'Choose a ledger from the left to work inside it.'}
                  </p>
                </div>

                <button
                  onClick={() => setShowTransactionForm(true)}
                  className="bg-primary hover:bg-secondary px-4 py-2 rounded-lg flex items-center transition cursor-pointer"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5 mr-1"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z"
                      clipRule="evenodd"
                    />
                  </svg>
                  Add Transaction
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div className="rounded-lg border border-gray-200 p-4">
                  <div className="text-gray-500 mb-1">Ledger Name</div>
                  <div className="font-medium text-gray-900">
                    {currentLedger?.name || '—'}
                  </div>
                </div>

                <div className="rounded-lg border border-gray-200 p-4">
                  <div className="text-gray-500 mb-1">Created</div>
                  <div className="font-medium text-gray-900">
                    {currentLedger
                      ? new Date(currentLedger.dateCreated).toLocaleDateString()
                      : '—'}
                  </div>
                </div>

                <div className="rounded-lg border border-gray-200 p-4 md:col-span-2">
                  <div className="text-gray-500 mb-1">Description</div>
                  <div className="font-medium text-gray-900">
                    {currentLedger?.description || 'No description yet'}
                  </div>
                </div>
              </div>
            </div>

            {showTransactionForm && (
              <div className="bg-white rounded-xl shadow-md p-6">
                <FormTransaction
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
                  subType={subType}
                  setSubType={setSubType}
                />
              </div>
            )}

            <div className="bg-white rounded-xl shadow-md p-6">
              <div className="mb-4">
                <h2 className="text-xl font-bold text-gray-800">Transactions</h2>
              </div>

              <TransactionList
                accounts={accounts}
                transactions={currentLedgerTransactions}
                deleteTransaction={deleteTransaction}
                transactionsLoading={transactionsLoading}
              />
            </div>
          </section>


        </div>

        <div className="mt-8">
          <ReportTrigger />
        </div>
      </main>
    </div>
  );
};

export default Transactions;