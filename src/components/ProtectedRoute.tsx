import type { ReactNode } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/authContext';

interface ProtectedRouteProps {
  children: ReactNode;
  requiredRole?: string;
}

const ProtectedRoute = ({ children, requiredRole }: ProtectedRouteProps) => {
  const { isAuthenticated, user, loading } = useAuth();
  const navigate = useNavigate();

  // Show loading state
  if (loading) {
    return <div className="flex justify-center items-center h-screen">Loading...</div>;
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Check role if required (you can implement this based on your user data structure)
  if (requiredRole && user?.uid) {
    // TODO Role
    // Implement role checking logic here if you store roles in Firestore
    // For example, fetch user roles from Firestore and check against requiredRole
  }

  return <>{children}</>;
};

export default ProtectedRoute;