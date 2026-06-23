import React, { createContext, useState, useContext, useEffect } from 'react';
import { gqlClient } from '@/api/graphqlClient';
import { gql } from 'graphql-request';
import { appParams } from '@/lib/app-params';

const AuthContext = createContext();

const ME_QUERY = gql`
  query Me {
    me {
      id
      email
      role
      organizationId
      employeeId
      avatarUrl
      mustCompleteProfile
    }
  }
`;

const LOGOUT_MUTATION = gql`
  mutation Logout {
    logout
  }
`;

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [authError, setAuthError] = useState(null);

  useEffect(() => {
    checkUserAuth();
  }, []);

  const checkUserAuth = async () => {
    try {
      setIsLoadingAuth(true);
      // Check if we have a token (from local storage or appParams)
      const token = localStorage.getItem('token') || appParams.token;
      
      if (!token) {
        setIsLoadingAuth(false);
        setIsAuthenticated(false);
        setAuthError({
          type: 'auth_required',
          message: 'Authentication required'
        });
        return;
      }

      // Fetch current user from GraphQL backend
      const data = await gqlClient.request(ME_QUERY);
      
      if (data.me) {
        setUser(data.me);
        setIsAuthenticated(true);
      } else {
        setIsAuthenticated(false);
      }
      setIsLoadingAuth(false);
    } catch (error) {
      console.error('User auth check failed:', error);
      setIsLoadingAuth(false);
      setIsAuthenticated(false);
      
      setAuthError({
        type: 'auth_required',
        message: 'Authentication required or token expired'
      });
    }
  };

  const logout = async (shouldRedirect = true) => {
    try {
      if (isAuthenticated) {
        await gqlClient.request(LOGOUT_MUTATION);
      }
    } catch (e) {
      console.error('Failed to log out on server:', e);
    }

    setUser(null);
    setIsAuthenticated(false);
    localStorage.removeItem('token');
    
    if (shouldRedirect) {
      window.location.href = '/login';
    }
  };

  const navigateToLogin = () => {
    if (!window.location.pathname.toLowerCase().includes('/login')) {
      window.location.href = '/Login';
    }
  };

  // Mocking the checkAppState function since we don't use base44 app state anymore
  const checkAppState = async () => {
    await checkUserAuth();
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      isAuthenticated, 
      isLoadingAuth,
      isLoadingPublicSettings: false,
      authError,
      appPublicSettings: null,
      logout,
      navigateToLogin,
      checkAppState
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

