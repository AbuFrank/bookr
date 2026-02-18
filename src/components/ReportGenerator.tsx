import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import googleDriveAPI from '../lib/googleDriveClient';

const ReportGenerator: React.FC = () => {
  const { user, isAuthenticated } = useAuth();
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerateReport = async () => {
    if (!isAuthenticated || !user) return;

    try {
      setIsGenerating(true);

      await googleDriveAPI.updateSheetCell(
        'YOUR_FILE_ID',
        'Sheet1!J5',
        'hello world'
      );

      // console.log('Report generated successfully:', result);
      alert('Report generated and saved to your Google Drive!');

    } catch (error) {
      console.error('Error generating report:', error);
      alert('Failed to generate report');
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
    </div>
  );
};

export default ReportGenerator;