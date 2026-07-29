import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { SessionProvider } from './context/sessionContext';
import { DataProvider } from './context/dataContext';
import Login from './Login';
import ProtectedRoute from './components/ProtectedRoute';
import PageTransactions from './PageTransactions';
import Unauthorized from './Unauthorized';
import PageBooks from './PageBooks';

function App() {
  return (
    <Router>
      <SessionProvider>
        <DataProvider>
          <div className="App">
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/unauthorized" element={<Unauthorized />} />

              {/* Protected Routes */}
              <Route
                path="/transactions"
                element={
                  <ProtectedRoute>
                    <PageTransactions />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/books"
                element={
                  <ProtectedRoute>
                    <PageBooks />
                  </ProtectedRoute>
                }
              />

              {/* Default route */}
              <Route path="/" element={<Navigate to="/books" replace />} />
            </Routes>
          </div>
        </DataProvider>
      </SessionProvider>
    </Router>
  );
}

export default App;
