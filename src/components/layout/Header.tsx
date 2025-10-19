import React from 'react';
import { Button } from '../common';
import { useAuthStore } from '../../store/auth';

export interface HeaderProps {
  title?: string;
  subtitle?: string;
}

const Header: React.FC<HeaderProps> = ({ title = 'Atlas2', subtitle }) => {
  const { user, logout } = useAuthStore();

  return (
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <h1 className="text-xl font-semibold text-gray-900">{title}</h1>
              {subtitle && (
                <p className="text-sm text-gray-500">{subtitle}</p>
              )}
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <nav className="hidden md:flex space-x-8">
              <a href="/dashboard" className="text-gray-500 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium">
                Dashboard
              </a>
              <a href="/upload" className="text-gray-500 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium">
                Upload
              </a>
              <a href="/mapping" className="text-gray-500 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium">
                Mapping
              </a>
              <a href="/integrations" className="text-gray-500 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium">
                Integrations
              </a>
            </nav>
            
            <div className="flex items-center space-x-3">
              {user ? (
                <>
                  <div className="flex items-center space-x-2">
                    <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                      <span className="text-white text-sm font-medium">
                        {user.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <span className="text-sm text-gray-700">{user.name}</span>
                  </div>
                  <Button variant="outline" size="sm" onClick={logout}>
                    Logout
                  </Button>
                </>
              ) : (
                <Button size="sm" onClick={() => window.location.href = '/login'}>
                  Login
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;