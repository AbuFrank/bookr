import { useState, useEffect } from 'react';
import Header from './components/Header';
import type { Transaction } from './types/transaction';
import StatCards from './components/StatCards';
import TransactionForm from './components/TransactionForm';
import TransactionList from './components/TransactionList';

const Transactions: React.FC = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  // Mock data for initial state
  useEffect(() => {
    const mockTransactions: Transaction[] = [
      { id: '1', accountName: 'Savings Account', accountNumber: '123456789', value: 2500.00, type: 'income', date: new Date('2023-06-15') },
      { id: '2', accountName: 'Checking Account', accountNumber: '987654321', value: 450.00, type: 'expense', date: new Date('2023-06-10') },
      { id: '3', accountName: 'Investment Account', accountNumber: '456789123', value: 1200.00, type: 'income', date: new Date('2023-06-05') },
      { id: '4', accountName: 'Credit Card', accountNumber: '321654987', value: 320.00, type: 'expense', date: new Date('2023-06-01') },
    ];

    setTransactions(mockTransactions);
    setLoading(false);
  }, []);

  const addTransaction = (transaction: Omit<Transaction, 'id' | 'date'>) => {
    const newTransaction: Transaction = {
      ...transaction,
      id: Date.now().toString(),
      date: new Date()
    };
    setTransactions([newTransaction, ...transactions]);
    setShowForm(false);
  };

  const deleteTransaction = (id: string) => {
    setTransactions(transactions.filter(transaction => transaction.id !== id));
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
              onClick={() => setShowForm(true)}
              className="bg-primary hover:bg-secondary px-4 py-2 rounded-lg flex items-center transition cursor-pointer"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
              </svg>
              Add Transaction
            </button>
          </div>

          {showForm ? (
            <TransactionForm
              onSubmit={addTransaction}
              onCancel={() => setShowForm(false)}
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