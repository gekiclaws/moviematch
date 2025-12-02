import React from 'react';
import {
 View,
 Text,
 TouchableOpacity,
 SafeAreaView,
 Alert,
} from 'react-native';

import type { StackScreenProps } from '@react-navigation/stack';
import type { RootStackParamList } from '../types/navigation';

// Session & User Services
import { SessionService } from '../services/firebase/sessionService';
import { UserManager } from '../services/firebase/userManager';

import FooterNav from "../components/FooterNav";
// Import styles
import { styles } from '../styles/HomeScreenStyles';

type Props = StackScreenProps<RootStackParamList, 'Home'>;

export default function HomeScreen({ navigation }: Props) {
    const handleCreateRoom = async () => {
        try {
            // Get current user from UserManager (already initialized in App.tsx)
            const currentUserId = UserManager.getCurrentUserId();
            if (!currentUserId) {
                Alert.alert('Error', 'User session not initialized. Please restart the app.');
                return;
            }

            // Create session with the persistent user ID
            const sessionId = await SessionService.create(currentUserId, {
                movieType: [],
                genres: [],
                streamingServices: [],
                favoriteTitles: [],
                swipes: [],
                createdAt: Date.now(),
                sessionStatus: 'awaiting',
            });

            const session = await SessionService.get(sessionId);

            navigation.navigate('LobbyWaiting', {
                sessionId,
                userId: currentUserId,
                isHost: true,
                session: session || undefined,
            });
        } catch (error) {
            console.error('Error creating room:', error);
            Alert.alert(
                'Error',
                'Failed to create room. Please try again.',
                [{ text: 'OK' }]
            );
        }
    };

    const handleJoinRoom = () => {
        navigation.navigate('JoinRoom');
    };

    return (
        <View style={styles.container}>
            <View style={styles.content}>
                {/* App Title */}
                <View style={styles.titleContainer}>
                    <Text style={styles.appTitle}>MovieMatch</Text>
                    <Text style={styles.subtitle}>Find your next watch together</Text>
                </View>

                {/* Main Header */}
                <View style={styles.headerContainer}>
                    <Text style={styles.headerText}>
                        
                    </Text>
                </View>

                {/* Action Buttons */}
                <View style={styles.buttonContainer}>
                    {/* Create Room Button */}
                    <TouchableOpacity
                        style={[styles.button, styles.createButton]}
                        onPress={handleCreateRoom}
                        activeOpacity={0.8}
                    >
                        <Text style={styles.createButtonText}>Create Room</Text>
                        <Text style={styles.buttonSubtext}>Start a new matching session</Text>
                    </TouchableOpacity>

                    {/* Join Room Button */}
                    <TouchableOpacity
                        style={[styles.button, styles.joinButton]}
                        onPress={handleJoinRoom}
                        activeOpacity={0.8}
                    >
                        <Text style={styles.joinButtonText}>Join Room</Text>
                        <Text style={styles.buttonSubtext}>Enter your partner's room code</Text>
                    </TouchableOpacity>
                </View>
            </View>
            {/* Footer Navigation Bar */}
            <FooterNav />
        </View>
    )

}