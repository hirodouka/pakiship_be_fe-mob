import React, { createContext, useContext, useState } from 'react';
import type { AuthUser } from '../types/authTypes';

type AppRole = 'driver' | 'operator' | 'parcel_sender';

type AuthSessionContextValue = {
  currentUser: AuthUser | null;
  setCurrentUser: (user: AuthUser | null) => void;
  clearCurrentUser: () => void;
};

const AuthSessionContext = createContext<AuthSessionContextValue | undefined>(undefined);

export function normalizeAppRole(role: string | undefined): AppRole {
  const normalizedRole = role?.trim().toLowerCase().replace(/[\s-]+/g, '_') ?? '';

  if (normalizedRole === 'operator' || normalizedRole.includes('operator')) {
    return 'operator';
  }

  if (normalizedRole === 'driver' || normalizedRole.includes('driver')) {
    return 'driver';
  }

  // 'customer' and 'parcel_sender' both go to the sender home
  return 'parcel_sender';
}

export function AuthSessionProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);

  return (
    <AuthSessionContext.Provider
      value={{
        currentUser,
        setCurrentUser,
        clearCurrentUser: () => setCurrentUser(null),
      }}
    >
      {children}
    </AuthSessionContext.Provider>
  );
}

export function useAuthSession() {
  const context = useContext(AuthSessionContext);

  if (!context) {
    throw new Error('useAuthSession must be used within an AuthSessionProvider.');
  }

  return context;
}
