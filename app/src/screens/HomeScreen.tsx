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
import { UserService } from '../services/firebase/userService';

// Import styles
import { styles } from '../styles/HomeScreenStyles';

type Props = StackScreenProps<RootStackParamList, 'Home'>;

export default function HomeScreen({ navigation }: Props) {
    const handleCreateRoom = async () => {
        try {
            const tempUserId = `user_${Math.random().toString(36).substring(2, 10)}`;
            const sessionId = await SessionService.create(tempUserId, {
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
                userId: tempUserId,
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
        <SafeAreaView style={styles.container}>
            <View style={styles.content}>
                {/* App Title */}
                <View style={styles.titleContainer}>
                    <Text style={styles.appTitle}>MovieMatch</Text>
                    <Text style={styles.subtitle}>Find your next watch together</Text>
                </View>

                {/* Main Header */}
                <View style={styles.headerContainer}>
                    <Text style={styles.headerText}>
                        Join or Create a Room to get Started
                    </Text>
                    <Text style={styles.descriptionText}>
                        Match with your partner to discover your perfect movie or show
                    </Text>
                </View>

                {/* Action Buttons */}
                <View style={styles.buttonContainer}>
                    {/* Create Room Button */}
                    <TouchableOpacity
                        style={[styles.button, styles.createButton]}
                        // onPress={handleCreateRoom}
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
        </SafeAreaView>
    )

}