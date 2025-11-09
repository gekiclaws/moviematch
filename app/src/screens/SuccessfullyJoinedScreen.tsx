import React, { useState, useEffect } from 'react';
import { View, Text, ActivityIndicator, Alert } from 'react-native';
import type { StackScreenProps } from '@react-navigation/stack';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { SessionService } from '../services/firebase/sessionService';
import { Session } from '../types/session';
import type { Unsubscribe } from 'firebase/firestore';
import { SuccessfullyJoinedStyles as styles } from '../styles/SuccessfullyJoinedStyles';

type Props = StackScreenProps<RootStackParamList, 'SuccessfullyJoined'>;

export const SuccessfullyJoinedScreen: React.FC<Props> = ({ route, navigation }) => {
  const { sessionId, userName } = route.params;
  
  // State management
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Real-time listener reference
  const [unsubscribeSession, setUnsubscribeSession] = useState<Unsubscribe | null>(null);

  /**
   * Load initial session data
   */
  const loadSessionData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const sessionData = await SessionService.get(sessionId);
      if (!sessionData) {
        throw new Error('Session not found');
      }
      
      setSession(sessionData);
    } catch (error) {
      console.error('Error loading session data:', error);
      setError('Failed to load session data');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Set up real-time listener for session status changes
   */
  const setupSessionListener = () => {
    try {
      console.log('Setting up session listener for:', sessionId);
      
      const unsubscribe = SessionService.subscribeToSession(
        sessionId,
        (updatedSession) => {
          console.log('Session status updated:', updatedSession?.sessionStatus);
          if (updatedSession) {
            setSession(updatedSession);
            
            // Navigate to game if session starts
            if (updatedSession.sessionStatus === 'in progress') {
              console.log('Session started! Navigating to game...');
              // TODO: Navigate to game screen when implemented
              Alert.alert(
                'Session Started!', 
                'The host has started the session. Game features coming soon!',
                [{ text: 'OK' }]
              );
            }
          } else {
            // Session was deleted
            Alert.alert(
              'Session Ended',
              'The host has ended the session.',
              [
                {
                  text: 'OK',
                  onPress: () => navigation.navigate('Home')
                }
              ]
            );
          }
        },
        (error) => {
          console.error('Session listener error:', error);
          setError('Connection lost. Trying to reconnect...');
        }
      );
      
      setUnsubscribeSession(unsubscribe);
    } catch (error) {
      console.error('Error setting up session listener:', error);
    }
  };

  /**
   * Clean up listeners
   */
  const cleanup = () => {
    if (unsubscribeSession) {
      unsubscribeSession();
      setUnsubscribeSession(null);
    }
  };

  /**
   * Get status display text based on session state
   */
  const getStatusText = () => {
    if (error) return ` ${error}`;
    if (isLoading) return ' Loading...';
    if (!session) return ' Session not found';
    
    switch (session.sessionStatus) {
      case 'awaiting':
        return ' Waiting for host to start';
      case 'in progress':
        return ' Session active';
      case 'complete':
        return ' Session completed';
      default:
        return ' Connected';
    }
  };

  // Load data and setup listeners on mount
  useEffect(() => {
    loadSessionData();
    setupSessionListener();
    
    // Cleanup on unmount
    return cleanup;
  }, [sessionId]);

  // Show loading state
  if (isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Loading session...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        {/* Success Header */}
        <View style={styles.successHeader}>
          <Text style={styles.successIcon}></Text>
          <Text style={styles.successTitle}>Successfully Joined!</Text>
        </View>

        {/* Room Info */}
        <View style={styles.infoContainer}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Room Code:</Text>
            <Text style={styles.infoValue}>{sessionId}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Your Name:</Text>
            <Text style={styles.infoValue}>{userName}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Host:</Text>
            <Text style={styles.infoValue}>
              {session?.userIds[0] ? `${session.userIds[0]}` : 'Unknown'}
            </Text>
          </View>
        </View>

        {/* Status Section */}
        <View style={styles.statusContainer}>
          <Text style={styles.statusLabel}>Status</Text>
          <Text style={styles.statusText}>{getStatusText()}</Text>
        </View>

        {/* Waiting Message */}
        {/* <View style={styles.messageContainer}>
          <Text style={styles.messageTitle}>Please Wait</Text>
          <Text style={styles.messageText}>
            You have successfully joined the room! Please wait for the host to start the session. 
            You will be notified automatically when the game begins.
          </Text>
        </View> */}

        {/* Connection Indicator */}
        <View style={styles.connectionIndicator}>
          <Text style={styles.connectionText}>
            {error ? ' Connection Issues' : ' Connected to Room'}
          </Text>
        </View>
      </View>
    </View>
  );
};
