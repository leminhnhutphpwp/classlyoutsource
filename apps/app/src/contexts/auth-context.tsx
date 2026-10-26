'use client';

import React, { createContext, useContext } from 'react';
import { useAuth } from '@/hooks/use-api';
import type { User } from '@/lib/api-config';

interface UpdateProfileData {
  name?: string;
  email?: string;
  phone?: string;
  address?: string;
  bio?: string;
  avatar?: string;
  [key: string]: unknown;
}

interface ChangePasswordData {
  current_password: string;
  password: string;
  password_confirmation: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string; requires_2fa?: boolean; challenge?: string }>;
  verifyTwoFactor: (challenge: string, code: string) => Promise<{ success: boolean; error?: string; code?: string }>;
  logout: () => Promise<void>;
  updateProfile: (profileData: UpdateProfileData) => Promise<{ success: boolean; error?: string }>;
  changePassword: (passwordData: ChangePasswordData) => Promise<{ success: boolean; error?: string }>;
  refetchUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const auth = useAuth();

  return (
    <AuthContext.Provider value={auth}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }
  return context;
}
