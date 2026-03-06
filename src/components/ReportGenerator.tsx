import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import googleDriveAPI from '../lib/googleDriveClient';

const ReportGenerator: React.FC = () => {
  const { user, isAuthenticated } = useAuth();
  const [isGenerating, setIsGenerating] = useState(false);
  const [message, setMessage] = useState('')

  const handleGenerateReport = async () => {
    if (!isAuthenticated || !user) return;

    try {
      setIsGenerating(true);


      const copiedFile = await googleDriveAPI.copyReportTemplate();

      console.log('Copied file:', copiedFile);
      // await googleDriveAPI.updateSheetCell(
      //   'YOUR_FILE_ID',
      //   'Income & Expense Ledger!J5',
      //   'hello world'
      // );

      // console.log('Report generated successfully:', result);
      setMessage('Report generated and saved to your Google Drive!');

    } catch (error) {
      console.error('Error generating report:', error);
      console.log("Error!!! >> ", error)
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div>
      <button
        onClick={handleGenerateReport}
        disabled={!isAuthenticated || isGenerating}
        className="generate-report-btn"
      >
        {isGenerating ? 'Generating...' : 'Generate Report'}
      </button>
      {message && <div className="p-4"><p>{message}</p></div>}
    </div>
  );
};

export default ReportGenerator;