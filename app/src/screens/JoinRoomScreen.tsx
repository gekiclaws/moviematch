import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import type { StackScreenProps } from '@react-navigation/stack';
import type { RootStackParamList } from '../types/navigation';

// Import services
import { SessionService } from '../services/firebase/sessionService';
import { UserService } from '../services/firebase/userService';
import { UserManager } from '../services/firebase/userManager';

// Import styles
import { styles } from '../styles/JoinRoomStyles';

type Props = StackScreenProps<RootStackParamList, 'JoinRoom'>;

export default function JoinRoomScreen({ navigation }: Props) {
  const [roomCode, setRoomCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleJoinRoom = async () => {
    // Validate input
    if (!roomCode.trim()) {
      Alert.alert('Error', 'Please enter a room code');
      return;
    }

    setIsLoading(true);

    try {
      // Get current user from UserManager (already initialized in App.tsx)
      const currentUserId = UserManager.getCurrentUserId();
      if (!currentUserId) {
        Alert.alert('Error', 'User session not initialized. Please restart the app.');
        setIsLoading(false);
        return;
      }

      // Check if session exists
      const session = await SessionService.get(roomCode.trim());
      if (!session) {
        Alert.alert('Error', 'Room code not found. Please check and try again.');
        setIsLoading(false);
        return;
      }

      // Check if room is full
      if (session.userIds.length >= 2) {
        Alert.alert('Error', 'This room is already full.');
        setIsLoading(false);
        return;
      }

      // Check if session has already started
      if (session.sessionStatus === 'in progress') {
        Alert.alert('Error', 'This session has already started.');
        setIsLoading(false);
        return;
      }

      // Join the session with current user
      await SessionService.joinSession(roomCode.trim(), currentUserId);

      // Get updated session data
      const updatedSession = await SessionService.get(roomCode.trim());

      // Get host user information
      const hostUser = await UserService.get(session.userIds[0]);

      // Navigate to SuccessfullyJoined screen
      navigation.navigate('SuccessfullyJoined', {
        sessionId: roomCode.trim(),
        userId: currentUserId,
        session: updatedSession || undefined,
        hostUser: hostUser || undefined,
        isHost: false,
      });

    } catch (error) {
      console.error('Error joining room:', error);
      
      // Handle specific error messages
      let errorMessage = 'Failed to join room. Please try again.';
      if (error instanceof Error) {
        if (error.message.includes('already in room')) {
          errorMessage = 'You are already in this room.';
        } else if (error.message.includes('full')) {
          errorMessage = 'This room is full.';
        } else if (error.message.includes('does not exist')) {
          errorMessage = 'Room code not found.';
        }
      }

      Alert.alert('Error', errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Handle room code input changes
   */
  const handleRoomCodeChange = (text: string) => {
    // Convert to uppercase and remove spaces for consistency
    setRoomCode(text.toUpperCase().trim());
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        style={styles.keyboardContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.content}>

          {/* Header Section */}
          <View style={styles.headerContainer}>
            <Text style={styles.headerText}> Join Room</Text>
            <Text style={styles.descriptionText}>
              Enter the room code shared by your friend to join their session
            </Text>
          </View>

          {/* Input Section */}
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Room Code</Text>
            <TextInput
              style={styles.textInput}
              value={roomCode}
              onChangeText={handleRoomCodeChange}
              placeholder="Enter room code here..."
              placeholderTextColor="#95a5a6"
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={20}
              editable={!isLoading}
            />
            <Text style={styles.inputHint}>
              💡 Room codes are provided by the session host
            </Text>
          </View>

          {/* Action Button */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[
                styles.joinButton,
                (!roomCode.trim() || isLoading) && styles.disabledButton
              ]}
              onPress={handleJoinRoom}
              disabled={!roomCode.trim() || isLoading}
              activeOpacity={0.8}
            >
              {isLoading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator color="#ffffff" size="small" />
                  <Text style={styles.loadingText}>Joining...</Text>
                </View>
              ) : (
                <>
                  <Text style={styles.joinButtonText}> Enter Room</Text>
                  <Text style={styles.buttonSubtext}>Join the matching session</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* Instructions */}
          <View style={styles.instructionsContainer}>
            <Text style={styles.instructionsTitle}>How to join:</Text>
            <Text style={styles.instructionText}>1. Get the room code from your friend</Text>
            <Text style={styles.instructionText}>2. Enter it in the text box above</Text>
            <Text style={styles.instructionText}>3. Tap "Enter Room" to join</Text>
            <Text style={styles.instructionText}>4. Wait for the host to start matching!</Text>
          </View>

        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}


