import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import googleDriveAPI from './lib/googleDriveClient';
import { sortFoldersIntoTree } from './helpers/folders';
import FolderTree from './components/FolderTree';
import Header from './components/Header';
import { reauthenticate } from './firebase/authService';
import type { Folder } from './types/folderTypes';
import FormBook from './components/FormBook';

const PageBooks = () => {
  const [folderTree, setFolderTree] = useState<any[]>([])
  const [groupName, setGroupName] = useState('');
  const [groupValue, setGroupValue] = useState('');
  const [fiscalYear, setFiscalYear] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fiscalYearError, setFiscalYearError] = useState<string | null>(null);
  const [showNewGroupInput, setShowNewGroupInput] = useState(false);
  const navigate = useNavigate();

  const {
    user,
    folders,
    addFolder,
    setCurrentFiscalYear,
    setCurrentBook,
    updateBooks
  } = useAuth();

  // Update folder structure whenever folders change
  useEffect(() => {
    setFolderTree(sortFoldersIntoTree(folders))
  }, [folders, user, navigate]);

  // Handle group selection
  const handleGroupChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    setGroupValue(value);
    // Show input when "create new" is selected
    if (value === 'create-new') {
      setShowNewGroupInput(true);
      setGroupName(''); // Reset the group name when creating new
    } else {
      setShowNewGroupInput(false);
      setGroupName('')
    }
  };

  // Validate fiscal year
  const validateFiscalYear = (year: string) => {
    if (!year) {
      setFiscalYearError('Fiscal year is required');
      return false;
    }

    // Check if it's a number
    if (!/^\d+$/.test(year)) {
      setFiscalYearError('Fiscal year must be a number');
      return false;
    }

    const yearNum = parseInt(year, 10);

    // Check range (1985-2100)
    if (yearNum < 1985 || yearNum > 2100) {
      setFiscalYearError('Fiscal year must be between 1985 and 2100');
      return false;
    }

    setFiscalYearError(null);
    return true;
  };

  const handleSubmit = async (e: React.SubmitEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Validate fiscal year before proceeding
    if (!validateFiscalYear(fiscalYear)) {
      setLoading(false);
      return;
    }

    console.log('group value: ', groupValue)
    console.log('group name: ', groupName)
    if (!fiscalYear.trim()) {
      setError("Please provide a year.")
      setLoading(false)
      return
    }

    if (!groupValue) {
      setError('Please select or create a group');
      setLoading(false);
      return;
    }

    try {
      if (!user) {
        throw new Error('No user authenticated');
      }

      if (groupValue === "create-new" && !groupName) {
        throw new Error('Please provide a name for the new group');
      }
      // Get the parent folder ID (should be the "bookr" folder)
      const parentFolder = groupValue === 'create-new'
        ? folders.find(folder => folder.name === "Bookr App")
        : folderTree.find(folder => folder.name === groupValue);

      console.log('parentFolder --> ', parentFolder)
      if (!parentFolder) {
        throw new Error('Parent folder not found');
      }
      // setLoading(false)
      // return

      // Determine if we are creating a new group folder or using an existing one
      let groupFolder
      if (groupValue === 'create-new') {
        groupFolder = await googleDriveAPI.createFolder(groupName.trim(), parentFolder.id)
      } else {
        groupFolder = parentFolder
        const groupYears = parentFolder.children.map((child: Folder) => child.name)
        if (groupYears.includes(fiscalYear.trim())) {
          setFiscalYearError('Fiscal year already exists.');
          setLoading(false)
          return;
        }
      }

      // Create the fiscal year folder
      const yearFolder = await googleDriveAPI.createFolder(fiscalYear.trim(), groupFolder.id)

      addFolder(groupFolder)
      addFolder(yearFolder)

      // Set current group and year folders and navigate to /transactions
      setCurrentFiscalYear(yearFolder);
      setCurrentBook(groupFolder);

      updateBooks(groupFolder, yearFolder);

      // Navigate to transactions page
      navigate('/transactions');

      // reset form
      setGroupName('')
      setFiscalYear('')
      setGroupValue('')

    } catch (error: any) {
      console.log('ERROR +++> ', error)
      if (error.message.includes('Token expired')) {
        console.log('Access token invalid');

        // Show a button to re-authenticate instead of auto-reauth
        const userAction = window.confirm('Your session has expired. Please re-authenticate to continue.');

        if (userAction) {
          console.log('WE HAVE USER ACTION!!!')
          try {
            await reauthenticate()
          } catch (reauthError) {
            console.error('Re-authentication failed:', reauthError);
            alert('Could not re-authenticate. Please refresh the page.');
          }
        }
      } else {
        console.error('Folder creation failed:', error);
        alert('Failed to create folder. Please contact support.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="min-h-screen bg-linear-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
          <div className="text-center mb-8">
            <div className="mx-auto bg-linear-to-br from-blue-500 to-indigo-600 rounded-full h-16 w-16 flex items-center justify-center mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-white" viewBox="0 0 20 20" fill="currentColor">
                <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v8a2 2 0 01-2 2h-2a2 2 0 01-2-2V6z" />
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-gray-800">
              {folderTree.length > 0 ? 'Your Folder Structure' : 'Create Your First Group'}
            </h1>
            <p className="text-gray-600 mt-2">
              {folderTree.length > 0
                ? 'Manage your existing folders below'
                : 'Set up your folder structure to get started'}
            </p>
          </div>

          {/* Folder Tree Display */}
          <FolderTree folders={folderTree} />



          <FormBook
            error={error}
            fiscalYear={fiscalYear}
            fiscalYearError={fiscalYearError}
            folderTree={folderTree}
            groupName={groupName}
            groupValue={groupValue}
            handleGroupChange={handleGroupChange}
            handleSubmit={handleSubmit}
            loading={loading}
            setFiscalYear={setFiscalYear}
            setGroupName={setGroupName}
            showNewGroupInput={showNewGroupInput}
          />

          <div className="mt-6 text-center text-sm text-gray-500">
            <p>Your folder structure will be created as:</p>
            <p className="font-medium">Bookr App / {groupName.trim() || 'Group Name'} / {fiscalYear.trim() || 'Year'}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PageBooks;