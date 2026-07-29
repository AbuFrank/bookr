import { useContext } from 'react';
import { SessionContext } from '../context/sessionContext';

export const useAuth = () => {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error('useAuth must be used within a SessionProvider');
  }
  return context;
};
