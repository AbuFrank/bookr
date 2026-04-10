import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import googleDriveAPI from '../lib/googleDriveClient';

const ReportTrigger: React.FC = () => {
  const { user, isAuthenticated, transactions } = useAuth();
  const [isProcessing, setIsProcessing] = useState(false);
  const [message, setMessage] = useState('');
  const [currentFile, setCurrentFile] = useState('')

  const handleUpdateValues = async () => {
    if (!isAuthenticated || !user) return;


    // TODO pull from data
    const updates = [
      {
        column: 9, // 9th column (accounts)
        startRow: 4, // Starting at row 5 (0-indexed)
        values: ['car', 'bills', 'groceries'] // Will be written to J5, J6, J7
      },
      {
        column: 11, // 11th column (total)
        startRow: 4, // Starting at row 5 (0-indexed)
        values: [40, 25, 311] // Will be written to L5, L6, L7
      }
    ];


    // TODO use context "current file"
    const response = await googleDriveAPI.updateSheetCells(currentFile, updates);

    console.log("trigger button response ==> ", response)

    if (isProcessing) {
      console.log('already processing, skipping...')
      return
    }
    try {

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

        {/* {currentFile ?
          (
            <button
              onClick={handleGenerateReport}
              disabled={!isAuthenticated || isProcessing}
              className="px-6 py-3 mr-2 rounded-md font-medium bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors duration-200 disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed"

            >
              {isProcessing ? 'Generating...' : 'Generate Report'}
            </button>
          ) : ( */}
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