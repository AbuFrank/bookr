import React, { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import googleDriveAPI from '../lib/googleDriveClient';
import { calculateAccountTotals } from '../helpers/ledger';

const ReportTrigger: React.FC = () => {
  const { accounts, user, isAuthenticated, transactions, currentFiscalYear, currentLedger, currentLedgers, hasUnsavedReportChanges, markReportSaved } = useAuth();
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (!hasUnsavedReportChanges) return;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      // Chrome requires returnValue to be set to show the confirmation prompt
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedReportChanges]);

  const handleUpdateValues = async () => {
    if (!isAuthenticated || !user || !transactions?.length || !currentLedger || !accounts?.length || !currentFiscalYear || isProcessing) return;

    setIsProcessing(true);

    try {
      // updates structure
      // const updates = {
      //   fileId: 'abc123',
      //   E: [],
      //   NE: [],
      //   D: [],
      //   ND: [],
      // }
      const { updates } = calculateAccountTotals(transactions, currentLedger, currentLedgers, accounts, currentFiscalYear)

      // TODO update all current ledgers in firestore and re-set current ledger state
      // bonus: only update firestore ledgers for current ledger and newer
      // TODO create updateLedger function
      // TODO Actually only keep starting total for the given year folder and use that to recalculate running total instead of having to update every ledger
      const response = await googleDriveAPI.updateSheetCells(updates);

      const allSucceeded = Array.isArray(response) && response.every((result) => result?.success);
      if (allSucceeded) {
        markReportSaved();
      }

    } catch (error) {
      console.error('Error generating report:', error);
    } finally {
      setIsProcessing(false);
    }
  }

  return (
    <div>
      {transactions?.length > 0 && <div className="sm:flex flex-row items-center">
        {hasUnsavedReportChanges && !isProcessing && (
          <p className="text-amber-600 text-sm mb-2 sm:mb-0 sm:mr-3">You have unsaved changes. Click "Update Report" to save them.</p>
        )}
        <button
          onClick={handleUpdateValues}
          disabled={!isAuthenticated || isProcessing || !hasUnsavedReportChanges}
          className="px-6 py-3 rounded-md font-medium bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors duration-200 disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed"
        >
          {isProcessing ? 'Updating...' : 'Update Report'}
        </button>
      </div>}
    </div>
  );
};

export default ReportTrigger;