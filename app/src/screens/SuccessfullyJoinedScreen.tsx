import React, { useState, useEffect, useRef } from 'react';
import { View, Text, ActivityIndicator, Alert, TouchableOpacity } from 'react-native';
import type { StackScreenProps } from '@react-navigation/stack';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { SessionService } from '../services/firebase/sessionService';
import { Session } from '../types/session';
import type { Unsubscribe } from 'firebase/firestore';
import { SuccessfullyJoinedStyles as styles } from '../styles/SuccessfullyJoinedStyles';

type Props = StackScreenProps<RootStackParamList, 'SuccessfullyJoined'>;

export const SuccessfullyJoinedScreen: React.FC<Props> = ({ route, navigation }) => {
  const { sessionId, userName, userId } = route.params;
  
  // State management
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const hasNavigatedRef = useRef(false);
  const sessionListenerRef = useRef<Unsubscribe | null>(null);
  const isMountedRef = useRef(true);

  /**
   * Load initial session data
   */
  const loadSessionData = async () => {
    try {
      if (!isMountedRef.current) return;
      setIsLoading(true);
      setError(null);

      const sessionData = await SessionService.get(sessionId);
      if (!sessionData) {
        throw new Error('Session not found');
      }
      if (!isMountedRef.current) return;
      setSession(sessionData);
    } catch (error) {
      console.error('Error loading session data:', error);
      if (isMountedRef.current) {
        setError('Failed to load session data');
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  };

  const triggerAutoNavigation = (currentSession: Session) => {
    if (hasNavigatedRef.current) return;
    navigateToMovieMatching(currentSession);
  };

  /**
   * Set up real-time listener for session status changes
   */
  const setupSessionListener = () => {
    try {
      console.log('Setting up session listener for:', sessionId);
      
      sessionListenerRef.current?.();

      const unsubscribe = SessionService.subscribeToSession(
        sessionId,
        (updatedSession) => {
          console.log('Session status updated:', updatedSession?.sessionStatus);
          if (updatedSession) {
            setSession(updatedSession);
            
            if (updatedSession.sessionStatus === 'in progress') {
              triggerAutoNavigation(updatedSession);
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
      
      sessionListenerRef.current = unsubscribe;
    } catch (error) {
      console.error('Error setting up session listener:', error);
    }
  };

  /**
   * Clean up listeners
   */
  const cleanup = () => {
    sessionListenerRef.current?.();
    sessionListenerRef.current = null;
  };

  /**
   * Navigate to movie matching screen
   */
  const navigateToMovieMatching = (sessionOverride?: Session) => {
    const activeSession = sessionOverride || session;
    if (!activeSession || hasNavigatedRef.current) return;

    hasNavigatedRef.current = true;
    
    navigation.navigate('MovieSwipe', {
      sessionId: sessionId,
      userId: userId,
      sessionTypes: activeSession.movieType?.length ? activeSession.movieType : undefined,
      session: activeSession
    });
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
    isMountedRef.current = true;

    const init = async () => {
      await loadSessionData();
      if (isMountedRef.current) {
        setupSessionListener();
      }
    };

    init();
    
    // Cleanup on unmount
    return () => {
      isMountedRef.current = false;
      cleanup();
    };
  }, [sessionId]);

  useEffect(() => {
    if (session?.sessionStatus === 'in progress') {
      triggerAutoNavigation(session);
    }
  }, [session?.sessionStatus]);

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
          <Text style={styles.connectionText}>
            {session?.sessionStatus === 'awaiting'
              ? 'Waiting for host to start…'
              : 'Session ready. Launching movie picker...'}
          </Text>
        </View>

        {/* Waiting Message */}
        <View style={styles.messageContainer}>
          <Text style={styles.messageTitle}>Please Wait</Text>
          <Text style={styles.messageText}>
            You have successfully joined the room! Please wait for the host to start the session. 
            You will be notified automatically when the game begins.
          </Text>
        </View>

        {/* Connection Indicator */}
        <View style={styles.connectionIndicator}>
          <Text style={styles.connectionText}>
            {error ? ' Connection Issues' : ' Connected to Room'}
          </Text>
        </View>

        {/* Go to Movie Matching Button - Only show when session is in progress */}
        {session?.sessionStatus === 'in progress' && (
          <View style={styles.buttonContainer}>
            <TouchableOpacity 
              style={styles.goToMatchingButton}
              onPress={navigateToMovieMatching}
              activeOpacity={0.8}
            >
              <Text style={styles.goToMatchingButtonText}>
                🎬 Go to Movie Matching
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
};
