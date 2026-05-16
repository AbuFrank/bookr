import { useAuth } from '../hooks/useAuth';
import type { FormLedgerData } from '../types/ledgerTypes';
import LoadingSpinner from './LoadingSpinner';

export interface FormLedgerProps {
  errors: { [key: string]: string };
  handleLedgerFormChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  handleLedgerSubmit: (e: React.SubmitEvent) => void;
  setShowLedgerForm: (show: boolean) => void;
  ledgersLoading: boolean;
  newLedger: FormLedgerData;
}

const FormLedger: React.FC<FormLedgerProps> = ({
  errors,
  handleLedgerFormChange,
  handleLedgerSubmit,
  setShowLedgerForm,
  ledgersLoading,
  newLedger,
}) => {

  const { currentLedgers } = useAuth()

  return (
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

      <div className="relative">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Running Total as of Last Register
        </label>
        <input
          type="string"
          name="startingBalance"
          value={newLedger.startingBalance}
          disabled={currentLedgers.length > 0}
          onChange={handleLedgerFormChange}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 input-disabled"
          placeholder="0"
          required
        />
        {errors.startingBalance && (
          <p className="mt-1 text-sm text-red-600">{errors.startingBalance}</p>
        )}
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

      <div className="flex flex-col sm:flex-row gap-2">
        <button
          disabled={ledgersLoading}
          type="submit"
          className="btn-primary"
        >
          {ledgersLoading ? <LoadingSpinner /> : "Save Ledger"}
        </button>
        <button
          type="button"
          onClick={() => setShowLedgerForm(false)}
          className="btn-secondary"
        >
          Cancel
        </button>
      </div>
    </form>
  );
};

export default FormLedger;