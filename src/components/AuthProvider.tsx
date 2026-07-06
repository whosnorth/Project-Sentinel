import React from 'react';
export const useAuth = () => ({
  user: { email: 'analyst@sentinel.ops' },
  userRole: 'sentinel_analyst',
  signOut: () => {}
});
export const AuthProvider = ({ children }: { children: React.ReactNode }) => <>{children}</>;
