import React, { useMemo } from 'react';
import type { FirestoreTransaction } from '../types/transactionTypes';
import type { EditTransactionFormData } from '../types/transactionTypes';
import { findAccountById } from '../lib/firestore';
import type { FirestoreAccount } from '../types/accountTypes';
import { formatFirestoreDate, toComparableTime } from '../helpers/date';
import MyDatePicker from './MyDatePicker';

const editInputClass = "w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm";

interface TransactionListProps {
  accounts: FirestoreAccount[]
  transactions: FirestoreTransaction[];
  deleteTransaction: (id: string) => void;
  transactionsLoading: boolean;
  editingTransactionId: string | null;
  editFormData: EditTransactionFormData;
  onEditStart: (transaction: FirestoreTransaction) => void;
  onEditFormChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onEditDateChange: (date: Date | null) => void;
  onEditSave: (transaction: FirestoreTransaction) => void;
  onEditCancel: () => void;
}

const TransactionList: React.FC<TransactionListProps> = ({
  accounts,
  transactions,
  deleteTransaction,
  transactionsLoading,
  editingTransactionId,
  editFormData,
  onEditStart,
  onEditFormChange,
  onEditDateChange,
  onEditSave,
  onEditCancel,
}) => {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const sortedTransactions = useMemo(() => (
    [...transactions].sort((a, b) => toComparableTime(a.dateCreated) - toComparableTime(b.dateCreated))
  ), [transactions]);

  if (transactions.length === 0) {
    return (
      <div className="text-center py-12">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
        <p className="text-gray-500">No transactions found</p>
        <p className="text-gray-400 text-sm mt-1">Add your first transaction to get started</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Check No.</th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Payment To / Deposit From</th>
            <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Acct #</th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Account</th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
            <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {sortedTransactions.map((transaction) => {
            const account = findAccountById(accounts, transaction?.accountId);
            const transactionType = account?.type;
            const isEditing = editingTransactionId === transaction.id;

            return (
              <tr key={transaction.id} className="hover:bg-gray-50">

                <td className="px-6 py-4 whitespace-nowrap">
                  {isEditing ? (
                    <MyDatePicker date={editFormData.date} onDateChange={onEditDateChange} />
                  ) : (
                    <div className="text-sm font-medium text-gray-900">{formatFirestoreDate(transaction.date)}</div>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {isEditing ? (
                    <input
                      type="text"
                      name="checkNumber"
                      value={editFormData.checkNumber}
                      onChange={onEditFormChange}
                      className={editInputClass}
                    />
                  ) : (
                    <div className="text-sm font-medium text-gray-900">{transaction.checkNumber}</div>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {isEditing ? (
                    <div className="flex flex-col gap-1">
                      <input
                        type="text"
                        name="paidTo"
                        value={editFormData.paidTo}
                        onChange={onEditFormChange}
                        className={editInputClass}
                        required
                      />
                      <input
                        type="text"
                        name="memo"
                        value={editFormData.memo}
                        onChange={onEditFormChange}
                        className={editInputClass}
                        placeholder="Memo"
                      />
                    </div>
                  ) : (
                    <>
                      <div className="text-sm font-medium text-gray-900">{transaction.paidTo}</div>
                      {transaction.memo && (
                        <div className="text-xs text-gray-400 mt-1">{transaction.memo}</div>
                      )}
                    </>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-center">
                  <div className="text-sm text-gray-500">{account?.accountNumber ?? ''}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-500">{account?.accountName}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {isEditing ? (
                    <input
                      type="number"
                      name="value"
                      value={editFormData.value}
                      onChange={onEditFormChange}
                      className={editInputClass}
                      min="0"
                      step="0.01"
                      required
                    />
                  ) : (
                    <div className={`text-sm font-medium ${transactionType === 'deposit' ? 'text-green-600' : 'text-red-600'}`}>
                      {formatCurrency(transaction.value)}
                    </div>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full
                    ${transactionType === 'deposit' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    {transactionType
                      ? `${transactionType.charAt(0).toUpperCase() + transactionType.slice(1)}${account?.subType === 'non-income' ? ' | Non-Inc' : account?.subType === 'non-deductible' ? ' | Non-Ded' : ''}`
                      : 'Unknown'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  {isEditing ? (
                    <div className="flex justify-end gap-3">
                      <button
                        disabled={!!transactionsLoading || !editFormData.paidTo || !editFormData.value}
                        onClick={() => onEditSave(transaction)}
                        className="text-blue-600 hover:text-blue-900"
                      >
                        Save
                      </button>
                      <button
                        onClick={onEditCancel}
                        className="text-gray-500 hover:text-gray-700"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div className="flex justify-end gap-3">
                      <button
                        disabled={!!transactionsLoading}
                        onClick={() => onEditStart(transaction)}
                        className="text-blue-600 hover:text-blue-900"
                      >
                        Edit
                      </button>
                      <button
                        disabled={!!transactionsLoading}
                        onClick={() => deleteTransaction(transaction.id)}
                        className="text-red-600 hover:text-red-900"
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default TransactionList;