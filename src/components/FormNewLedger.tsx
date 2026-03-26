
interface FormNewLedgerProps {
  error: (error: string) => void;
  handleSubmit: (e: React.FormEvent) => void;
  ledgerNameError: (error: string) => void;
  loading: boolean;
  ledgerName: string;
  setLedgername: (ledger: string) => void;
}

const FormNewLedger: React.FC<FormNewLedgerProps> = ({
  error,
  handleSubmit,
  ledgerNameError,
  loading,
  ledgerName,
  setLedgerName,
}) => {

  return (<form onSubmit={handleSubmit} className="space-y-6">
    {error && (
      <div className="mb-6 bg-red-50 border-l-4 border-red-500 p-4 rounded">
        <div className="flex">
          <div className="shrink-0">
            <svg className="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.06L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        </div>
      </div>
    )}
    <div>
      <label htmlFor="ledgerName" className="block text-sm font-medium text-gray-700 mb-1">
        Ledger Name
      </label>
      <input
        type="text"
        id="ledgerName"
        value={ledgerName}
        onChange={(e) => setledgerName(e.target.value)}
        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-200"
        placeholder="e.g., 2024, 2025, etc."
        required
      />
      {/* TODO form input sanitation based on allowed google naming conventions */}
      {ledgerNameError && (
        <p className="mt-1 text-sm text-red-600">{ledgerNameError}</p>
      )}
    </div>
    <div className="mt-8">
      <button
        type="submit"
        disabled={loading}
        className="w-full bg-linear-to-r from-blue-500 to-indigo-600 text-white py-3 px-4 rounded-lg font-medium hover:from-blue-600 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? (
          <div className="flex items-center justify-center">
            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Creating...
          </div>
        ) : (
          'Create Folder Structure'
        )}
      </button>
    </div>
  </form>)
}

export default FormNewLedger