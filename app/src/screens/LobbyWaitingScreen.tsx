import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  ActivityIndicator,
  Clipboard,
  BackHandler,
} from 'react-native';
import type { StackScreenProps } from '@react-navigation/stack';
import type { RootStackParamList } from '../types/navigation';

// Import services
import { SessionService } from '../services/firebase/sessionService';
import { UserService } from '../services/firebase/userService';
import type { Session } from '../types/session';
import type { User } from '../types/user';
import type { Unsubscribe } from 'firebase/firestore';

// Import styles
import { styles } from '../styles/LobbyWaitingStyles';

type Props = StackScreenProps<RootStackParamList, 'LobbyWaiting'>;

export default function LobbyWaitingScreen({ navigation, route }: Props) {
  const { sessionId, userId } = route.params;
  // Note: This screen is exclusively for hosts who created the room
  
  // State management
  const [session, setSession] = useState<Session | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUserCount, setLastUserCount] = useState(0);
  
  // Real-time listener references
  const [unsubscribeFunctions] = useState<Unsubscribe[]>([]);

  // Real-time updates - listen for session and user changes
  useEffect(() => {
    loadSessionData();
    setupRealTimeListeners();
    
    // Cleanup function to unsubscribe from listeners when component unmounts
    return () => {
      console.log('Cleaning up real-time listeners');
      unsubscribeFunctions.forEach(unsubscribe => unsubscribe());
      unsubscribeFunctions.length = 0;
    };
  }, [sessionId]);

  // Cleanup on component unmount
  useEffect(() => {
    return () => {
      unsubscribeFunctions.forEach(unsubscribe => unsubscribe());
    };
  }, []);

  // Handle hardware back button
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      handleLeaveSession();
      return true; // Prevent default back behavior
    });

    return () => backHandler.remove();
  }, [sessionId, userId]);

  /**
   * Load initial session and user data
   */
  const loadSessionData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Load session data
      const sessionData = await SessionService.getSession(sessionId);
      if (!sessionData) {
        throw new Error('Session not found');
      }
      setSession(sessionData);

      // Load users in session
      const sessionUsers = await Promise.all(
        sessionData.userIds.map(id => UserService.get(id))
      );
      const validUsers = sessionUsers.filter((user): user is User => user !== null);
      setUsers(validUsers);

    } catch (error) {
      console.error('Error loading session data:', error);
      setError('Failed to load session data');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Set up real-time listeners for session and user changes
   */
  const setupRealTimeListeners = () => {
    try {
      // Clean up any existing listeners
      unsubscribeFunctions.forEach(unsubscribe => unsubscribe());
      unsubscribeFunctions.length = 0;

      console.log('Setting up real-time listeners for session:', sessionId);

      // 1. Listen to session changes (user joins, status changes, etc.)
      const sessionUnsubscribe = SessionService.subscribeToSession(
        sessionId,
        (updatedSession) => {
          console.log('Session updated:', updatedSession);
          if (updatedSession) {
            setSession(updatedSession);
            // Update users list when session userIds change
            loadUsersFromSession(updatedSession);
          } else {
            setSession(null);
            setUsers([]);
          }
        },
        (error) => {
          console.error('Session listener error:', error);
          setError('Connection lost. Trying to reconnect...');
        }
      );
      unsubscribeFunctions.push(sessionUnsubscribe);

      // 2. Listen to users in this room for real-time user updates
      const usersUnsubscribe = UserService.subscribeToRoomUsers(
        sessionId,
        (updatedUsers) => {
          console.log('Users in room updated:', updatedUsers);
          setUsers(updatedUsers);
          setLastUserCount(updatedUsers.length);
        },
        (error) => {
          console.error('Users listener error:', error);
        }
      );
      unsubscribeFunctions.push(usersUnsubscribe);

    } catch (error) {
      console.error('Error setting up real-time listeners:', error);
    }
  };

  /**
   * Load users from session data (helper function)
   */
  const loadUsersFromSession = async (sessionData: Session) => {
    try {
      const sessionUsers = await Promise.all(
        sessionData.userIds.map(id => UserService.get(id))
      );
      const validUsers = sessionUsers.filter((user): user is User => user !== null);
      setUsers(validUsers);
    } catch (error) {
      console.error('Error loading users from session:', error);
    }
  };

  /**
   * Copy room code to clipboard
   */
  const copyRoomCode = () => {
    const roomCode = session?.roomCode || 'Unknown';
    Clipboard.setString(roomCode);
    Alert.alert('Copied!', 'Room code copied to clipboard');
  };

  /**
   * Start the movie matching session
   */
  const handleStartMatching = async () => {
    if (!session) return;

    try {
      setIsStarting(true);

      // Start the session using SessionService
      await SessionService.startMovieMatching(sessionId, userId);

      navigation.navigate('MovieSwipe', {
        sessionId: sessionId,
        userId: userId,
        sessionTypes: session.movieType?.length ? session.movieType : undefined,
        session,
      });

    } catch (error) {
      console.error('Error starting session:', error);
      let errorMessage = 'Failed to start session';
      
      if (error instanceof Error) {
        if (error.message.includes('host')) {
          errorMessage = 'Only the host can start the session';
        } else if (error.message.includes('2 users')) {
          errorMessage = 'Need exactly 2 users to start';
        }
      }

      Alert.alert('Error', errorMessage);
    } finally {
      setIsStarting(false);
    }
  };

  /**
   * Handle canceling the session as host
   */
  const handleLeaveSession = () => {
    Alert.alert(
      'Cancel Session',
      'Are you sure you want to cancel this session? This will end the room for all users.',
      [
        { text: 'Keep Session', style: 'cancel' },
        {
          text: 'Cancel Session',
          style: 'destructive',
          onPress: async () => {
            try {
              // Delete session and clean up all users
              await SessionService.deleteSession(sessionId);
              navigation.navigate('Home');
            } catch (error) {
              console.error('Error deleting session:', error);
              // Navigate anyway even if deletion fails
              navigation.navigate('Home');
            }
          }
        }
      ]
    );
  };

  /**
   * Get status text based on current session state
   */
  const getStatusText = (): string => {
    if (!session) return 'Loading...';
    
    const userCount = users.length;
    const maxUsers = 2;

    if (session.sessionStatus === 'in progress') {
      return 'Session in progress';
    }

    if (userCount === 1) {
      return 'Waiting for partner to join... ';
    }

    if (userCount === 2) {
      return 'Ready to start!';
    }

    return `${userCount}/${maxUsers} users connected`;
  };

  /**
   * Check if start button should be enabled
   */
  const canStartSession = (): boolean => {
    return !!(
      session &&
      users.length === 2 &&
      session.sessionStatus === 'awaiting' &&
      !isStarting
    );
  };

  // Loading screen
  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3498db" />
          <Text style={styles.loadingText}>Loading session...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Error screen
  if (error || !session) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>
            {error || 'Session not found'}
          </Text>
          <TouchableOpacity 
            style={styles.retryButton}
            onPress={loadSessionData}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>

        {/* Header Section */}
        <View style={styles.headerContainer}>
          <Text style={styles.headerText}>
            Your Room
          </Text>
         
        </View>

        {/* Room Code Section */}
        <View style={styles.roomCodeContainer}>
          <Text style={styles.roomCodeLabel}>Room Code</Text>
          <TouchableOpacity 
            style={styles.roomCodeBox}
            onPress={copyRoomCode}
            activeOpacity={0.8}
          >
            <Text style={styles.roomCodeText}>{session?.roomCode || 'Loading...'}</Text>
            <Text style={styles.copyHint}>Tap to copy</Text>
          </TouchableOpacity>
        </View>

        {/* Status Section */}
        <View style={styles.statusContainer}>
          <Text style={styles.statusLabel}>Session Status</Text>
          <View style={styles.statusBox}>
            <View style={styles.statusIndicator}>
              <View style={[
                styles.statusDot,
                users.length === 2 ? styles.statusDotReady : styles.statusDotWaiting
              ]} />
              <Text style={styles.statusText}>{getStatusText()}</Text>
            </View>
            
            {/* User Count Display */}
            <View style={styles.userCountContainer}>
              <Text style={styles.userCountText}>
                 {users.length}/2 users connected
              </Text>
              
              {/* User List */}
              <View style={styles.userList}>
                {users.map((user, index) => (
                  <View key={user.id} style={styles.userItem}>
                    <Text style={styles.userName}>
                      {user.name || `User ${user.id.substring(0, 6)}`}
                      {user.id === userId && ' (You - Host)'}
                      {user.id !== userId && user.id === session.userIds[0] && ' (Host)'}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[
              styles.startButton,
              !canStartSession() && styles.disabledButton
            ]}
            onPress={handleStartMatching}
            disabled={!canStartSession()}
            activeOpacity={0.8}
          >
            {isStarting ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator color="#ffffff" size="small" />
                <Text style={styles.startButtonText}>Starting...</Text>
              </View>
            ) : (
              <>
                <Text style={styles.startButtonText}>
                   Start Movie Matching
                </Text>
                <Text style={styles.buttonSubtext}>
                  {users.length < 2 
                    ? 'Waiting for partner to join'
                    : 'Begin the matching process'
                  }
                </Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.leaveButton}
            onPress={handleLeaveSession}
            activeOpacity={0.8}
          >
            <Text style={styles.leaveButtonText}>
               Cancel Session
            </Text>
          </TouchableOpacity>
        </View>

        {/* Instructions */}
        {/* {users.length < 2 && (
          <View style={styles.instructionsContainer}>
            <Text style={styles.instructionsTitle}>Next steps:</Text>
            <Text style={styles.instructionText}>
              1. Share the room code above with your partner
            </Text>
            <Text style={styles.instructionText}>
              2. Wait for them to join using the code
            </Text>
            <Text style={styles.instructionText}>
              3. Start matching when both users are connected
            </Text>
          </View>
        )} */}

      </View>
    </SafeAreaView>
  );
}

