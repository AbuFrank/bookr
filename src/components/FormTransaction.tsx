import { useState, useEffect } from 'react';
import type { AccountCreationState, FirestoreTransaction, Transaction } from '../types/transactionTypes';
import DatePicker from 'react-datepicker';
import { createTransaction } from '../firebase/crud';
import { useAuth } from '../context/authContext';

const labelClass = "block text-sm font-medium text-gray-700 mb-1"
const inputClass = "w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"

interface FormTransactionProps {
  onSubmit: (transaction: Omit<Transaction, 'id' | 'date'>) => void;
  onCancel: () => void;
  initialAccountOptions: string[];
}

const FormTransaction: React.FC<FormTransactionProps> = ({ onSubmit, onCancel, initialAccountOptions }) => {


  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        <div>
          <label htmlFor="date" className={labelClass}>Date:</label>
          <DatePicker
            selected={formData.date}
            onChange={handleDateChange}
            dateFormat="MM/dd/yyyy" // Or your preferred format
            // placeholder={placeholderText}
            className={inputClass}
          />
        </div>

        <div>
          <label className={labelClass}>Check Number (Optional)</label>
          <input
            type="text"
            name="checkNumber"
            value={formData.checkNumber}
            onChange={handleChange}
            className={inputClass}
            placeholder="Optional"
          />
        </div>

        <div>
          <label className={labelClass}>To Whom Paid</label>
          <input
            type="text"
            name="paidTo"
            value={formData.paidTo}
            onChange={handleChange}
            className={inputClass}
            placeholder="e.g., Checking Account"
            required
          />
        </div>

        <div className="col-span-2">
          <label className={labelClass}>Account Number</label>
          <select
            name="accountNumber"
            value={formData.accountNumber}
            onChange={handleChange}
            className={inputClass}
          >
            <option value="">Select or Create</option>
            {accountOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>

          {accountCreation.isCreatingAccount && (
            <div className="mt-2">
              <label className={labelClass}>Account Type</label>
              <select
                value={accountCreation.accountType}
                onChange={handleAccountTypeChange}
                className={inputClass}
              >
                <option value="">Select Type</option>
                <option value="E">Expense</option>
                <option value="NE">Non-Expense</option>
                <option value="R">Receipts</option>
                <option value="NI">Non-Income Deposits</option>
              </select>

              <label className="block text-sm font-medium text-gray-700 mb-1 mt-2">Account Number</label>
              <input
                type="number"
                value={accountCreation.accountNumber}
                onChange={handleAccountNumberChange}
                className={inputClass}
                placeholder="Enter Number"
              />

              <label className="block text-sm font-medium text-gray-700 mb-1 mt-2">Account Name</label>
              <input
                type="text"
                value={accountCreation.accountName}
                onChange={handleAccountNameChange}
                className={inputClass}
                placeholder="Enter Name"
              />

              <button
                type="button"
                onClick={handleCreateAccount}
                className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded mt-2"
              >
                Create Account
              </button>
            </div>
          )}
          <button
            type="button"
            onClick={() => setAccountCreation(prev => ({ ...prev, isCreatingAccount: true }))}
            className="bg-gray-200 hover:bg-gray-400 text-gray-700 font-bold py-2 px-4 rounded mt-2"
          >
            Create New Account
          </button>
        </div>

        <div>
          <label className={labelClass}>Amount</label>
          <input
            type="number"
            name="value"
            value={formData.value}
            onChange={handleChange}
            className={inputClass}
            placeholder="0.00"
            min="0"
            step="0.01"
            required
          />
        </div>

        <div>
          <label className={labelClass}>Type</label>
          <select
            name="type"
            value={formData.type}
            onChange={handleChange}
            className={inputClass}
          >
            <option value="income">Income</option>
            <option value="expense">Expense</option>
          </select>
        </div>
      </div>

      <div className="flex justify-end space-x-3 pt-4">
        <button
          type="button"
          onClick={onCancel}
          className="btn-secondary"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="btn-primary"
        >
          Add Transaction
        </button>
      </div>
    </form>
  );
};

export default FormTransaction;