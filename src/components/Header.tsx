import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../hooks/useAuth';

const Header = () => {
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { logout, user, hasUnsavedReportChanges } = useAuth()

  const handleSignOut = () => {
    if (hasUnsavedReportChanges && !window.confirm('You have unsaved changes to your report. Sign out anyway without clicking "Update Report"?')) {
      return;
    }
    logout();
  };

  // Handle clicks outside the dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };

    // Bind the event listener
    document.addEventListener('mousedown', handleClickOutside);

    // Cleanup the event listener
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <header className="bg-white shadow">
      <div className="container mx-auto px-4 py-6">
        <div className="flex justify-between items-center">
          <h1 className="text-xl font-bold text-gray-800 flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 mr-2 text-primary" viewBox="0 0 20 20" fill="currentColor">
              <path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4z" />
              <path fillRule="evenodd" d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h6a1 1 0 110 2H5a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H5z" clipRule="evenodd" />
            </svg>Income & Expense Tracker
          </h1>
          <div className="flex items-center space-x-4">

            <div className="relative" ref={dropdownRef}>
              <div
                className="h-10 w-10 rounded-full bg-blue-500 flex items-center justify-center text-white font-semibold cursor-pointer hover:bg-blue-600 transition-colors"
                onClick={() => setShowDropdown(!showDropdown)}
              >
                {(user?.displayName || 'u').split('')[0]}
              </div>
              {showDropdown && (
                <div className="absolute right-0 mt-2 bg-white rounded-md shadow-lg py-4 z-10 px-2">
                  <p>Sign is as {user?.displayName}</p>
                  <p>{user?.email}</p>
                  <p>{user?.uid}</p>
                  <button
                    onClick={handleSignOut}
                    className="block py-2 text-sm text-blue-600 hover:bg-gray-100 w-full text-left"
                  >
                    Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;