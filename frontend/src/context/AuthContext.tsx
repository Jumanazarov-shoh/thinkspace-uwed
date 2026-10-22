import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, RoleName } from '../types';
import { api } from '../services/api';

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  authError: string | null;
  clearAuthError: () => void;
  isAuthenticated: boolean;
  isMember: boolean;
  isEvaluator: boolean;
  isSeniorReviewer: boolean;
  isModerator: boolean;
  isSuperAdmin: boolean;
  isStaff: boolean;
  loginAs: (role: RoleName) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        initData: string;
        initDataUnsafe: any;
        ready: () => void;
        expand: () => void;
        close: () => void;
        themeParams: any;
      };
    };
  }
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('thinkspace_token'));
  const [loading, setLoading] = useState<boolean>(true);
  const [authError, setAuthError] = useState<string | null>(null);

  const clearAuthError = () => {
    localStorage.removeItem('thinkspace_token');
    setAuthError(null);
  };

  const refreshUser = async () => {
    try {
      const u = await api.getMe();
      setUser(u);
    } catch (e) {
      // Invalid token
      logout();
    }
  };

  const logout = () => {
    localStorage.removeItem('thinkspace_token');
    setToken(null);
    setUser(null);
  };

  const loginAs = async (role: RoleName) => {
    setLoading(true);
    try {
      const res = await api.devLogin(role);
      localStorage.setItem('thinkspace_token', res.access_token);
      setToken(res.access_token);
      setUser(res.user);
    } catch (e) {
      console.error('Failed to dev login:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const initAuth = async () => {
      // 1. If running inside Telegram Mini App, prioritize fresh Telegram initData
      if (window.Telegram?.WebApp) {
        window.Telegram.WebApp.ready();
        window.Telegram.WebApp.expand();

        const initData = window.Telegram.WebApp.initData;
        if (initData) {
          try {
            const res = await api.authenticateTelegram(initData);
            localStorage.setItem('thinkspace_token', res.access_token);
            setToken(res.access_token);
            setUser(res.user);
            setAuthError(null);
            setLoading(false);
            return;
          } catch (e: any) {
            console.warn('Telegram initData authentication failed:', e);
            localStorage.removeItem('thinkspace_token');
            setAuthError(e.message || 'Telegram autentifikatsiyasi tasdiqlanmadi (Invalid or expired Telegram session).');
            setLoading(false);
            return;
          }
        }
      }

      // 2. If opened outside Telegram, check existing saved token
      const savedToken = localStorage.getItem('thinkspace_token');
      if (savedToken) {
        try {
          const u = await api.getMe();
          setUser(u);
        } catch (e) {
          logout();
        }
      } else {
        // Auto dev login as super_admin if local development and no session
        try {
          await loginAs('super_admin');
        } catch (e) {}
      }
      setLoading(false);
    };

    initAuth();
  }, []);

  const hasRole = (role: RoleName) => {
    if (!user) return false;
    if (user.roles.some(r => r.role_name === 'super_admin')) return true;
    return user.roles.some(r => r.role_name === role);
  };

  const isMember = !!user && user.status === 'approved';
  const isEvaluator = hasRole('evaluator');
  const isSeniorReviewer = hasRole('senior_reviewer');
  const isModerator = hasRole('moderator');
  const isSuperAdmin = !!user && user.roles.some(r => r.role_name === 'super_admin');
  const isStaff = isEvaluator || isSeniorReviewer || isModerator || isSuperAdmin;

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        authError,
        clearAuthError,
        isAuthenticated: !!user,
        isMember,
        isEvaluator,
        isSeniorReviewer,
        isModerator,
        isSuperAdmin,
        isStaff,
        loginAs,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
