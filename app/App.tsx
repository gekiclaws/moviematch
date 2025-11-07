import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import AppNavigator from './src/navigation/AppNavigator';
import { UserManager } from './src/services/firebase/userManager';
import type { User } from './src/types/user';

export default function App() {
  const [isUserInitialized, setIsUserInitialized] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [initError, setInitError] = useState<string | null>(null);

  useEffect(() => {
    initializeUserOnLaunch();
  }, []);

  /**
   * Initialize user session when app launches
   */
  const initializeUserOnLaunch = async () => {
    try {
      console.log('Initializing user session...');
      const user = await UserManager.initializeUser();
      setCurrentUser(user);
      setIsUserInitialized(true);
      console.log('User initialized successfully:', user.id);
    } catch (error) {
      console.error('Failed to initialize user:', error);
      setInitError('Failed to initialize user session');
      setIsUserInitialized(true); // Still allow app to load
    }
  };

  // Loading screen while initializing user
  if (!isUserInitialized) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3498db" />
        <Text style={styles.loadingText}>Setting up your profile...</Text>
      </View>
    );
  }

  // Error screen (still shows app but with warning)
  if (initError) {
    console.warn('App initialized with error:', initError);
  }

  return <AppNavigator />;
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#7f8c8d',
  },
});