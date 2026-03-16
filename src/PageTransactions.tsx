import { useState } from 'react';
import Header from './components/Header';
import StatCards from './components/StatCards';
import FormTransaction from './components/FormTransaction';
import TransactionList from './components/TransactionList';
import { useAuth } from './hooks/useAuth';
import type { FirestoreAccount, FormAccountData } from './types/accountTypes';
import type { FirestoreTransaction } from './types/transactionTypes';
import { findAccountById, generateFirestoreId } from './lib/firestore';
import ReportTrigger from './components/ReportTrigger';

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

  const [currentAccount, setCurrentAccount] = useState<FirestoreAccount | null>(null)

  const { user, accounts, transactions, addTransaction, deleteTransaction, addAccount, loading, transactionsLoading, accountsLoading } = useAuth();


  const handleTransactionFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;

    if (name === 'type') {
      // Reset subType when type changes
      setSubType(null);
    }

    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleAccountFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setNewAccount(prev => ({ ...prev, [name]: value }));
  };

  const handleAccountSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const { value } = e.target;
    const selectedAccount = findAccountById(accounts, value)
    setCurrentAccount(selectedAccount || null)
  };

  const handleDateChange = (date: Date | null) => {
    setFormData(prev => ({ ...prev, date: date || new Date() }));
  };

  const [showTransactionForm, setShowTransactionForm] = useState(false);
  const [isAccountFormToggled, setIsAccountFormToggled] = useState(false);

  const handleTransactionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      formData.paidTo &&
      formData.value &&
      formData.date &&
      formData.type
    ) {

      const transactionData: FirestoreTransaction = {
        id: generateFirestoreId('transactions'),
        userId: user?.uid || 'unknown',  // Get the user's UID
        checkNumber: formData.checkNumber,
        date: formData.date,
        dateCreated: new Date,
        paidTo: formData.paidTo,
        accountId: currentAccount?.id || null,
        value: parseFloat(formData.value),
        type: formData.type as 'expense' | 'deposit',
        subType: subType ? subType : null
      };

      try {
        await addTransaction(transactionData);
        setFormData({
          date: new Date(),
          checkNumber: '',
          paidTo: '',
          accountId: '',
          value: '',
          type: 'expense'
        });
        setSubType(null);
        setCurrentAccount(null)
      } catch (error) {
        console.error('Error submitting transaction:', error);
      }
    }
  };

  const handleAccountSubmit = async () => {
    if (
      newAccount.accountName
    ) {

      const accountData: FirestoreAccount = {
        id: generateFirestoreId('accounts'),
        userId: user?.uid || 'unknown',  // Get the user's UID
        dateCreated: new Date,
        accountName: newAccount.accountName
      };


      try {
        await addAccount(accountData);
        setNewAccount({
          accountName: '',
        });
        setCurrentAccount(accountData)
        setIsAccountFormToggled(false)
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

  // Calculate the balance excluding non-income and non-deductible
  const totalBalance = totalDeposits - totalExpenses;
  const totalBalanceExcludingNonIncomeAndNonDeductible =
    (totalDeposits - totalNonIncomeDeposits) - (totalExpenses - totalNonDeductibleExpenses);

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <main className="container mx-auto px-4 py-8">
        <StatCards
          totalDeposits={totalDeposits}
          totalIncome={totalIncome}
          totalNonIncomeDeposits={totalNonIncomeDeposits}
          totalDeductibleExpenses={totalDeductibleExpenses}
          totalNonDeductibleExpenses={totalNonDeductibleExpenses}
          totalExpenses={totalExpenses}
          balance={totalBalance}
          balanceExcludingNonIncomeAndNonDeductible={totalBalanceExcludingNonIncomeAndNonDeductible}
        />

        <div className="mt-8 bg-white rounded-xl shadow-md p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-gray-800">Ledger Transactions</h2>
            <button
              onClick={() => setShowTransactionForm(true)}
              className="bg-primary hover:bg-secondary px-4 py-2 rounded-lg flex items-center transition cursor-pointer"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
              </svg>
              Add Transaction
            </button>
          </div>

          {showTransactionForm && (
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
          )}

        </div>
        <div className="mt-8 bg-white rounded-xl shadow-md p-6">
          <TransactionList
            accounts={accounts}
            transactions={transactions}
            deleteTransaction={deleteTransaction}
            transactionsLoading={transactionsLoading}
          />

        </div>
        <ReportTrigger />
      </main>
    </div>
  );
}

export default Transactions;