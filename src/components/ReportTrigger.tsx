import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import googleDriveAPI from '../lib/googleDriveClient';
import { calculateAccountTotals } from '../helpers/ledger';

const ReportTrigger: React.FC = () => {
  const { accounts, user, isAuthenticated, transactions, currentLedger, currentLedgers } = useAuth();
  const [isProcessing, setIsProcessing] = useState(false);
  const [message, setMessage] = useState('');

  const handleUpdateValues = async () => {
    if (!isAuthenticated || !user || !transactions?.length || !currentLedger || !accounts?.length || isProcessing) return;

    try {
      // updates structure
      // const updates = {
      //   fileId: 'abc123',
      //   E: [],
      //   NE: [],
      //   D: [],
      //   ND: [],
      // }
      const { updates, newCurrentLedger, newCurrentLedgers } = calculateAccountTotals(transactions, currentLedger, currentLedgers, accounts)

      // TODO update all current ledgers in firestore and re-set current ledger state
      // bonus: only update firestore ledgers for current ledger and newer
      // TODO create updateLedger function
      // TODO Actually only keep starting total for the given year folder and use that to recalculate running total instead of having to update every ledger
      console.log('updates ==> ', updates)
      setMessage(JSON.stringify(updates, null, 2))


      const response = await googleDriveAPI.updateSheetCells(updates);

      console.log("trigger button response ==> ", response)

    } catch (error) {
      console.error('Error generating report:', error);
      console.log("Error!!! >> ", error)
    } finally {
      setIsProcessing(false);
    }
  }

  return (
    <div>
      {transactions?.length > 0 && <div className="sm:flex flex-row mt-3">
        <button
          onClick={handleUpdateValues}
          disabled={!isAuthenticated || isProcessing}
          className="px-6 py-3 rounded-md font-medium bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors duration-200 disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed"

        >
          {isProcessing ? 'Updating...' : 'Update Report'}
        </button>
        {/* )} */}
      </div>}
      {message && <div className="p-4"><p>{message}</p></div>}
    </div>
  );
};

export default ReportTrigger;