import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/authContext';
import Login from './Login';
import ProtectedRoute from './components/ProtectedRoute';
import Transactions from './Transactions';
import Unauthorized from './Unauthorized';

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
                  <Transactions />
                </ProtectedRoute>
              }
            />
            {/* <Route 
              path="/profile" 
              element={
                <ProtectedRoute requiredRole="user">
                  <Profile />
                </ProtectedRoute>
              } 
            /> */}

            {/* Default route */}
            <Route path="/" element={<Navigate to="/transactions" replace />} />
          </Routes>
        </div>
      </AuthProvider>
    </Router>
  );
}

export default App;