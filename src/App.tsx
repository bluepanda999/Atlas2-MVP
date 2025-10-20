import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { useAuthStore } from './store/auth';
import { apiService } from './services/api';

// Pages
import Dashboard from './pages/Dashboard';
import Upload from './pages/Upload';
import Mapping from './pages/Mapping';

// Components
import { DataValidation } from './components/features/validation/DataValidation';

// Validation route wrapper
const ValidationRoute: React.FC = () => {
  const { fileId, fileName } = useParams<{ fileId: string; fileName: string }>();
  
  if (!fileId || !fileName) {
    return <Navigate to="/upload" replace />;
  }
  
  return (
    <DataValidation 
      fileId={fileId} 
      fileName={decodeURIComponent(fileName)} 
    />
  );
};

// Components
import { Toast } from './components/common';

// Toast management
interface ToastMessage {
  id: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
}

const App: React.FC = () => {
  const { isAuthenticated, token, refreshToken } = useAuthStore();
  const [toasts, setToasts] = React.useState<ToastMessage[]>([]);

  // Initialize API service with token
  useEffect(() => {
    if (token) {
      apiService.setAuthToken(token);
    }
  }, [token]);

  // Handle token refresh
  useEffect(() => {
    if (isAuthenticated && token) {
      // Set up token refresh interval
      const refreshInterval = setInterval(async () => {
        try {
          await refreshToken();
        } catch (error) {
          console.error('Token refresh failed:', error);
        }
      }, 15 * 60 * 1000); // Refresh every 15 minutes

      return () => clearInterval(refreshInterval);
    }
  }, [isAuthenticated, token, refreshToken]);

  // Global error handler
  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      console.error('Global error:', event.error);
      addToast('An unexpected error occurred', 'error');
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      console.error('Unhandled promise rejection:', event.reason);
      addToast('An unexpected error occurred', 'error');
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  const addToast = (message: string, type: ToastMessage['type'] = 'info') => {
    const id = `toast-${Date.now()}-${Math.random()}`;
    setToasts(prev => [...prev, { id, message, type }]);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  };

  // Protected route component
  // TEMPORARY: In development mode, authentication is bypassed for POC testing
  const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    // Bypass authentication in development mode
    if (import.meta.env.DEV) {
      return <>{children}</>;
    }
    
    if (!isAuthenticated) {
      return <Navigate to="/login" replace />;
    }
    return <>{children}</>;
  };

  return (
    <Router>
      <div className="min-h-screen bg-gray-50">
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<div>Login Page (TODO)</div>} />
          
          {/* Protected routes */}
          <Route path="/" element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          } />
          <Route path="/dashboard" element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          } />
          <Route path="/upload" element={
            <ProtectedRoute>
              <Upload />
            </ProtectedRoute>
          } />
          <Route path="/mapping" element={
            <ProtectedRoute>
              <Mapping />
            </ProtectedRoute>
          } />
          <Route path="/validation/:fileId/:fileName" element={
            <ProtectedRoute>
              <ValidationRoute />
            </ProtectedRoute>
          } />
          <Route path="/integrations" element={
            <ProtectedRoute>
              <div>Integrations Page (TODO)</div>
            </ProtectedRoute>
          } />
          <Route path="/settings" element={
            <ProtectedRoute>
              <div>Settings Page (TODO)</div>
            </ProtectedRoute>
          } />
          
          {/* 404 route */}
          <Route path="*" element={<div>404 - Page Not Found</div>} />
        </Routes>

        {/* Toast Container */}
        <div className="fixed bottom-4 right-4 z-50 space-y-2">
          {toasts.map((toast) => (
            <Toast
              key={toast.id}
              id={toast.id}
              message={toast.message}
              type={toast.type}
              onClose={removeToast}
            />
          ))}
        </div>
      </div>
    </Router>
  );
};

export default App;