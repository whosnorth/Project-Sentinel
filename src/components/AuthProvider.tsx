import React from 'react';
export const useAuth = () => ({
  user: { email: 'analyst@sentinel.ops' },
  userRole: 'sentinel_analyst',
  organizationId: 'sentinel_org',
  signOut: () => {}
});
export const AuthProvider = ({ children }: { children: React.ReactNode }) => <>{children}</>;
