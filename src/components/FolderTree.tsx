import React from 'react';
import { useAuth } from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import type { Folder, FolderNode } from '../types/folderTypes';


interface FolderTreeProps {
  folders: FolderNode[];
  className?: string;
}

const FolderTree: React.FC<FolderTreeProps> = ({ folders, className = '' }) => {
  if (!folders || folders.length === 0) return null;

  const {
    setCurrentFiscalYear,
    setCurrentBook,
  } = useAuth();

  const navigate = useNavigate();

  const handleFolderClick = (book: Folder, year: Folder) => {
    console.log('selected folder parent ===> ', year)
    // Set the current book and fiscal year
    setCurrentFiscalYear(year);
    setCurrentBook(book);

    // Navigate to transactions page
    navigate('/transactions');
  };

  return (
    <div className={`p-4 bg-gray-50 rounded-lg ${className}`}>
      <h2 className="text-lg font-semibold text-gray-800 mb-3">Current Folder Structure</h2>
      <ul className="space-y-2">
        {folders.map(folder => (
          <li key={folder.id} className="flex flex-col">
            <div className="flex items-center">
              <svg
                className="w-4 h-4 mr-2 text-gray-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z"></path>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 5a2 2 0 012-2h4a2 2 0 012 2v6H8V5z"></path>
              </svg>
              <span className="font-medium text-gray-800">{folder.name}</span>
            </div>
            {folder.children && folder.children.length > 0 && (
              <ul className="ml-6 mt-1 space-y-1">
                {folder.children.map(child => (
                  <li key={child.id} className="flex items-center cursor-pointer text-blue-400 hover:text-blue-500 hover:underline transition-colors text-lg"
                    onClick={() => handleFolderClick(folder, child)}>
                    <svg
                      className="w-3 h-3 mr-2"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                    </svg>
                    <span className="text-sm">{child.name}</span>
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default FolderTree;