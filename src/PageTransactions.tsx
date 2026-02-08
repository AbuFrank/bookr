import { useState } from 'react';
import Header from './components/Header';
import StatCards from './components/StatCards';
import FormTransaction from './components/FormTransaction';
import TransactionList from './components/TransactionList';
import { useAuth } from './context/authContext';
import type { FirestoreAccount } from './types/accountTypes';
import type { FirestoreTransaction } from './types/transactionTypes';

const Transactions: React.FC = () => {
  const [formData, setFormData] = useState({
    checkNumber: '',
    date: new Date(),
    paidTo: '',
    accountNumber: '',
    value: '',
    type: 'income' as 'income' | 'expense'
  });

  const [newAccount, setNewAccount] = useState<FirestoreAccount>({
    id: 'temp',
    accountType: '',
    accountNumber: '',
    accountName: '',
  });

  const { user, accounts, transactions, addTransaction, updateTransaction, deleteTransaction, addAccount, updateAccount, deleteAccount, loading } = useAuth();


  const handleTransactionChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleAccountChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleDateChange = (date: Date | null) => {
    setFormData(prev => ({ ...prev, date: date || new Date() }));
  };

  const [showTransactionForm, setShowTransactionForm] = useState(false);
  const [showNewAccountForm, setShowNewAccountForm] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      formData.paidTo &&
      formData.value &&
      formData.date
    ) {
      onSubmit({
        paidTo: formData.paidTo,
        accountNumber: formData.accountNumber,
        value: parseFloat(formData.value),
        type: formData.type
      });

      const transactionData: FirestoreTransaction = {
        id: 'temp',
        userId: user?.uid || 'unknown',  // Get the user's UID
        checkNumber: formData.checkNumber,
        date: formData.date,
        dateCreated: new Date,
        paidTo: formData.paidTo,
        accountNumber: formData.accountNumber,
        value: parseFloat(formData.value),
        type: formData.type as 'expense' | 'income',
      };

      try {
        await addTransaction(transactionData);
        // Optionally, reset the form after successful submission
        setFormData({
          date: new Date(),
          checkNumber: '',
          paidTo: '',
          accountNumber: '',
          value: '',
          type: 'expense'
        });
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

  const totalIncome = transactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + t.value, 0);

  const totalExpenses = transactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + t.value, 0);

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <main className="container mx-auto px-4 py-8">
        <StatCards
          totalIncome={totalIncome}
          totalExpenses={totalExpenses}
          balance={totalIncome - totalExpenses}
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

          {showTransactionForm ? (
            <FormTransaction
              onSubmit={handleSubmit}
              onCancel={() => setShowTransactionForm(false)}
              initialAccountOptions={[]}
            />
          ) : (
            <TransactionList
              transactions={transactions}
              onDelete={deleteTransaction}
            />
          )}
        </div>
      </main>
    </div>
  );
}

export default Transactions;