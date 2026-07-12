import type { FirestoreAccount, FormAccountData } from '../types/accountTypes';
import type { FormData } from '../types/transactionTypes';
import MyDatePicker from './MyDatePicker';

const labelClass = "block text-sm font-medium text-gray-700 mb-1"
const inputClass = "w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"


export interface FormTransactionProps {
  errors: { [key: string]: string }
  formData: FormData,
  onTransactionSubmit: (event: React.FormEvent) => void;
  onTransactionFormChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
  onTransactionCancel: () => void;
  onDateChange: (date: Date | null) => void;
  accounts: FirestoreAccount[];
  handleAccountSelect: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  handleAccountFormChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
  handleAccountSubmit: () => void;
  setIsAccountFormToggled: (show: boolean) => void;
  accountsLoading: boolean;
  isAccountFormToggled: boolean;
  newAccount: FormAccountData;
  currentAccount: FirestoreAccount | null;
  setNewAccount: (newAccount: FormAccountData) => void;
  subType: 'non-deductible' | 'non-income' | null;
  setSubType: (subType: 'non-deductible' | 'non-income' | null) => void;
}

const FormTransaction: React.FC<FormTransactionProps> = ({
  errors,
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
  subType,
  setSubType,
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
          <label className={labelClass}>Payment To / Deposit From</label>
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

        <div className="md:col-span-2">
          {accounts.length > 0 ? <><label className={labelClass}>Account</label>
            <select
              name="accountNumber"
              value={currentAccount?.id || ''}
              onChange={handleAccountSelect}
              className={inputClass}
            >
              <option value=''>Select an Account</option>
              {accounts.map((account: FirestoreAccount) => (
                <option key={account.id} value={account.id}> {/* Use account.id as the value */}
                  {`${account.accountNumber} - ${account.accountName}`}
                </option>
              ))}
            </select></> : <div>No Accounts Found</div>}

          {isAccountFormToggled && (
            <div className="flex flex-col mt-3 p-4 bg-gray-100 gap-y-3">

              <div>
                <label className={labelClass}>Account Name</label>
                <input
                  type="text"
                  name="accountName"
                  value={newAccount.accountName}
                  onChange={handleAccountFormChange}
                  className={inputClass}
                  placeholder="Enter Name"
                />
                {errors.accountName && (
                  <div className="mt-2 p-3 bg-red-100 border border-red-400 text-red-700 rounded-md">
                    {errors.accountName}
                  </div>
                )}
              </div>
              <div>
                <label className={labelClass}>Account Number</label>
                <input
                  type="text"
                  name="accountNumber"
                  value={newAccount.accountNumber ? newAccount.accountNumber.toString() : ""}
                  onChange={handleAccountFormChange}
                  className={inputClass}
                  placeholder="Enter Account Number"
                />
                {errors.accountNumber && (
                  <div className="mt-2 p-3 bg-red-100 border border-red-400 text-red-700 rounded-md">
                    {errors.accountNumber}
                  </div>
                )}
              </div>
              <div>
                <label className={labelClass}>Type</label>
                <select
                  name="type"
                  value={newAccount.type || ""}
                  onChange={onTransactionFormChange}
                  className={inputClass}
                >
                  <option value="">Select Expense/Deposit</option>
                  <option value="deposit">Deposit</option>
                  <option value="expense">Expense</option>
                </select>
              </div>
              {newAccount.type && (
                <div>
                  <label className={labelClass}>
                    {formData.type === 'deposit' ? 'Non-Income' : 'Non-Deductible'}
                  </label>
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      name="subType"
                      checked={subType === (formData.type === 'deposit' ? 'non-income' : 'non-deductible')}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSubType(formData.type === 'deposit' ? 'non-income' : 'non-deductible');
                        } else {
                          setSubType(null);
                        }
                      }}
                      className="mr-2 h-4 w-4 text-blue-600 rounded"
                    />
                    <span className="text-sm text-gray-600">
                      {formData.type === 'deposit' ? 'Non-Income' : 'Non-Deductible'}
                    </span>
                  </div>
                </div>
              )}
              <div className="mb-1 flex flex-col xs:flex-row gap-2">
                <button
                  type="button"
                  onClick={() => handleAccountSubmit()}
                  className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
                >
                  Create Account
                </button>
                <button
                  type="button"
                  onClick={() => setIsAccountFormToggled(false)}
                  className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
          {(!isAccountFormToggled) && <button
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
            <option value="deposit">Deposit</option>
            <option value="expense">Expense</option>
          </select>
        </div>
        {formData.type && (
          <div>
            <label className={labelClass}>
              {formData.type === 'deposit' ? 'Non-Income' : 'Non-Deductible'}
            </label>
            <div className="flex items-center">
              <input
                type="checkbox"
                name="subType"
                checked={subType === (formData.type === 'deposit' ? 'non-income' : 'non-deductible')}
                onChange={(e) => {
                  if (e.target.checked) {
                    setSubType(formData.type === 'deposit' ? 'non-income' : 'non-deductible');
                  } else {
                    setSubType(null);
                  }
                }}
                className="mr-2 h-4 w-4 text-blue-600 rounded"
              />
              <span className="text-sm text-gray-600">
                {formData.type === 'deposit' ? 'Non-Income' : 'Non-Deductible'}
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-col xs:flex-row w-full xs:w-autojustify-end gap-3 pt-4">
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