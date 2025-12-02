import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import type { RootStackParamList } from '../types/navigation';
import { View, Text } from 'react-native';

// Import actual screen components
import HomeScreen from '../screens/HomeScreen';
import ProfileScreen from "../screens/ProfileScreen";
import JoinRoomScreen from '../screens/JoinRoomScreen';
import LobbyWaitingScreen from '../screens/LobbyWaitingScreen';
import { SuccessfullyJoinedScreen } from '../screens/SuccessfullyJoinedScreen';
import MovieSwipeScreen from "../screens/MovieSwipeScreen";
import GenreSelectionScreen from "../screens/GenreSelectionScreen";
import PlatformSelectionScreen from "../screens/PlatformSelectionScreen";
import FavoriteMediaSelectionScreen from "../screens/FavoriteMediaScreen";
import SessionTypeSelectionScreen from "../screens/SessionTypeSelectionScreen"
import RecommendationScreen from "../screens/RecommendationScreen";

const Stack = createStackNavigator<RootStackParamList>();

export default function AppNavigator() {
    return (
        <NavigationContainer>
            <Stack.Navigator
                initialRouteName="GenreSelection"
                screenOptions= {{
                    title: "",
                    headerStyle: { backgroundColor: '#000000ff' }, // Dark blue header
                    headerTintColor: '#ecf0f1',                 // Light text
                    headerTitleStyle: { fontWeight: 'bold' },   // Bold titles
                    cardStyle: { backgroundColor: '#ecf0f1' },  // Light background
                }}
            >
                {/* Genre Selection Screen (Onboarding #1)*/}
                <Stack.Screen
                    name="GenreSelection"
                    component={ GenreSelectionScreen }
        
                />

                {/* Platform Selection Screen (Onboarding #2)*/}
                <Stack.Screen
                    name="PlatformSelection"
                    component={ PlatformSelectionScreen }
                />

                {/* Favorite Media Selection Screen (Onboarding #3)*/}
                <Stack.Screen
                    name="FavoriteMediaSelection"
                    component={ FavoriteMediaSelectionScreen }
                />
                
                {/* Home Screen */}
                <Stack.Screen
                    name="Home"
                    component={HomeScreen}
                    options={{ 
                        headerLeft: () => null,
                        animation: "slide_from_left"}} // No back button on home screen

                />
                {/* Profile Edit Screen */}
                <Stack.Screen
                    name="Profile"
                    component={ProfileScreen}

                />
                
                {/* Lobby Waiting Screen (Host) */}
                <Stack.Screen
                    name='LobbyWaiting'
                    component={LobbyWaitingScreen}
                    options={({ route }) => {
                        const sessionId = route.params && 'sessionId' in route.params ? route.params.sessionId : 'Unknown';
                        return {
                            title: `Room: ${sessionId}`,
                            backTitle: 'Back to Home', // Custom back title
                            gestureEnabled: false, // Disable swipe back
                        };
                    }}
                />

                {/* Join Room Screen */}
                <Stack.Screen
                    name='JoinRoom'
                    component={JoinRoomScreen}
                    options={{
                        title: 'Join a Room',
                        headerBackTitle: 'Back to Home',
                        gestureEnabled: false,
                    }}
                />

                {/* Successfully Joined Screen (Guest) */}
                <Stack.Screen
                    name='SuccessfullyJoined'
                    component={SuccessfullyJoinedScreen}
                    options={({ route }) => ({
                        title: `Room: ${route.params.sessionId}`,
                        headerBackTitle: 'Back to Home',
                        gestureEnabled: false
                    })}
                />

                { /* Session Type Selection Screen */ }
                <Stack.Screen
                    name="SessionTypeSelection"
                    component={SessionTypeSelectionScreen}
                    options={{headerShown: false}}
                />

                { /* Movie Swip Screen */ }
                <Stack.Screen
                    name="MovieSwipe"
                    component={MovieSwipeScreen}
                    options={{ headerShown: false }}
                />
                { /* Recommendation Screen */ }
                <Stack.Screen
                    name="RecommendationScreen"
                    component={RecommendationScreen}
                    options={{ headerShown: false }}
                />
            </Stack.Navigator>
        </NavigationContainer>
    );
}

export type { RootStackParamList } from '../types/navigation';