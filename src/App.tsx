import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/authContext';
import Login from './Login';
import ProtectedRoute from './components/ProtectedRoute';
import PageTransactions from './PageTransactions';
import Unauthorized from './Unauthorized';
import PageBooks from './PageBooks';

function App() {
  return (
    <Router>
      <AuthProvider>
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
      </AuthProvider>
    </Router>
  );
}

export default App;