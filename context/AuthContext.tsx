import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useState } from 'react';

type AuthContextType = {
  userId: string | null;
  setUserId: (id: string | null) => Promise<void>;
  isLoading: boolean;
};

const AuthContext = createContext<AuthContextType>({
  userId: null,
  setUserId: async () => {},
  isLoading: true,
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [userId, setUserIdState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check if user is logged in
    const loadSession = async () => {
      try {
        const storedUserId = await AsyncStorage.getItem('tow_naija_user_id');
        if (storedUserId) {
          setUserIdState(storedUserId);
        }
      } catch (e) {
        console.error('Failed to load session', e);
      } finally {
        setIsLoading(false);
      }
    };
    loadSession();
  }, []);

  const setUserId = async (id: string | null) => {
    try {
      if (id) {
        await AsyncStorage.setItem('tow_naija_user_id', id);
      } else {
        await AsyncStorage.removeItem('tow_naija_user_id');
      }
      setUserIdState(id);
    } catch (e) {
      console.error('Failed to set session', e);
    }
  };

  return (
    <AuthContext.Provider value={{ userId, setUserId, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
