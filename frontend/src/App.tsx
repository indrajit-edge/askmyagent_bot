import React, { useState, useEffect } from 'react';
import Home from './pages/Home';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import OAuthCallback from './pages/OAuthCallback';

export default function App() {
  const [path, setPath] = useState(window.location.pathname);
  const [search, setSearch] = useState(window.location.search);

  useEffect(() => {
    const handleLocationChange = () => {
      setPath(window.location.pathname);
      setSearch(window.location.search);
    };

    window.addEventListener('popstate', handleLocationChange);
    return () => window.removeEventListener('popstate', handleLocationChange);
  }, []);

  const navigate = (to: string, queryString: string = '') => {
    const fullUrl = queryString ? `${to}${queryString}` : to;
    window.history.pushState({}, '', fullUrl);
    setPath(to);
    setSearch(queryString);
  };

  const simulateOAuth = (provider: string) => {
    const mockChatId = Math.floor(100000 + Math.random() * 900000);
    const mockCode = `4/0AfB_mock_code_${Date.now()}`;
    const mockState = `${mockChatId}:${provider}`;
    navigate('/oauth/callback', `?code=${encodeURIComponent(mockCode)}&state=${encodeURIComponent(mockState)}`);
  };

  if (path === '/login') {
    return (
      <Login
        onLoginSuccess={() => navigate('/admin')}
        onNavigateHome={() => navigate('/')}
      />
    );
  }

  if (path === '/admin') {
    return (
      <Dashboard
        onLogout={() => navigate('/login')}
        onNavigateHome={() => navigate('/')}
      />
    );
  }

  if (path === '/oauth/callback') {
    return (
      <OAuthCallback
        onNavigateHome={() => navigate('/')}
      />
    );
  }

  // Default: Home Page
  return (
    <Home
      onNavigateLogin={() => navigate('/login')}
      onNavigateAdmin={() => navigate('/admin')}
      onSimulateOAuth={simulateOAuth}
    />
  );
}
