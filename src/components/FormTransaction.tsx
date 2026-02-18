import type { FirestoreAccount, FormAccountData } from '../types/accountTypes';
import type { FormEvent } from 'react';
import type { FormData } from '../types/transactionTypes';
import { createAccountLabel } from '../lib/firestore';
import MyDatePicker from './MyDatePicker';

const labelClass = "block text-sm font-medium text-gray-700 mb-1"
const inputClass = "w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"


export interface FormTransactionProps {
  formData: FormData,
  onTransactionSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onTransactionFormChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
  onTransactionCancel: () => void;
  onDateChange: (date: Date | null) => void;
  accounts: FirestoreAccount[];
  handleAccountSelect: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  handleAccountFormChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
  handleAccountSubmit: () => void;
  setIsAccountFormToggled: (show: boolean) => void;
  accountsLoading: Boolean;
  isAccountFormToggled: Boolean;
  newAccount: FormAccountData;
  currentAccount: FirestoreAccount | null;
  setNewAccount: (newAccount: FormAccountData) => void;
}

const FormTransaction: React.FC<FormTransactionProps> = ({
  formData,
  accounts,
  onTransactionSubmit,
  onTransactionFormChange,
  onDateChange,
  handleAccountFormChange,
  onTransactionCancel,
  handleAccountSubmit,
  setIsAccountFormToggled,
  isAccountFormToggled,
  accountsLoading,
  currentAccount,
  newAccount,
  handleAccountSelect,
}) => {

  return (
    <form onSubmit={onTransactionSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        <div>
          <label htmlFor="date" className={labelClass}>Date</label>
          <MyDatePicker date={formData.date} onDateChange={onDateChange} />
        </div>

        <div>
          <label className={labelClass}>Check Number (Optional)</label>
          <input
            type="text"
            name="checkNumber"
            value={formData.checkNumber}
            onChange={onTransactionFormChange}
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
            onChange={onTransactionFormChange}
            className={inputClass}
            placeholder="e.g., Checking Account"
            required
          />
        </div>

        <div className="col-span-2">
          <label className={labelClass}>Account Number</label>
          <select
            name="accountNumber"
            value={currentAccount?.id}
            onChange={handleAccountSelect}
            className={inputClass}
          >
            <option value="">Select an Account</option>
            {accounts.map((account: FirestoreAccount) => (
              <option key={account.id} value={account.id}> {/* Use account.id as the value */}
                {createAccountLabel(account)} {/* Display accountName */}
              </option>
            ))}
          </select>

          {isAccountFormToggled && (
            <div className="mt-2">
              <label className={labelClass}>Account Type</label>
              <select
                name="accountType"
                value={newAccount.accountType[0]}
                onChange={handleAccountFormChange}
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
                name="accountNumber"
                value={newAccount.accountNumber}
                onChange={handleAccountFormChange}
                className={inputClass}
                placeholder="Enter Number"
              />

              <label className="block text-sm font-medium text-gray-700 mb-1 mt-2">Account Name</label>
              <input
                type="text"
                name="accountName"
                value={newAccount.accountName}
                onChange={handleAccountFormChange}
                className={inputClass}
                placeholder="Enter Name"
              />

              <button
                type="button"
                onClick={() => handleAccountSubmit()}
                className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded mt-2"
              >
                Create Account
              </button>
              <button
                type="button"
                onClick={() => setIsAccountFormToggled(false)}
                className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded mt-2 ml-4"
              >
                Cancel
              </button>
            </div>
          )}
          {!isAccountFormToggled && <button
            disabled={!!accountsLoading}
            type="button"
            onClick={() => setIsAccountFormToggled(true)}
            className="bg-gray-200 hover:bg-gray-400 text-gray-700 font-bold py-2 px-4 rounded mt-2"
          >
            Create New Account
          </button>}
        </div>

        <div>
          <label className={labelClass}>Amount</label>
          <input
            type="number"
            name="value"
            value={formData.value}
            onChange={onTransactionFormChange}
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
            onChange={onTransactionFormChange}
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
          onClick={onTransactionCancel}
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