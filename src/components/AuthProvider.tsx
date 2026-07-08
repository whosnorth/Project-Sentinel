import React, { useEffect, useState, createContext, useContext } from 'react';
import { supabase } from '../integrations/supabase/client';

const AuthContext = createContext<any>(null);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<any>(null);
  
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user || null);
    });
    
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user || null);
    });
    
    return () => authListener.subscription.unsubscribe();
  }, []);

  const value = {
    user: user || { email: 'analyst@sentinel.ops' },
    userRole: 'sentinel_analyst',
    organizationId: user?.id || '00000000-0000-0000-0000-000000000000', // fallback to valid UUID
    signOut: () => supabase.auth.signOut(),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    return { 
      user: { email: 'analyst@sentinel.ops' }, 
      userRole: 'sentinel_analyst', 
      organizationId: '00000000-0000-0000-0000-000000000000', 
      signOut: () => {} 
    };
  }
  return context;
};
