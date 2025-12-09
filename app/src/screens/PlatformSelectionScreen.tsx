import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Platform } from '../types/platform';
import SelectableCard from "../components/SelectableCard";
import { UserService } from '../services/firebase/userService';
import { UserManager } from '../services/firebase/userManager';
import { STREAMING_PLATFORMS } from '../types/platform';
import { styles } from "../styles/PlatformSelectionStyles";
import { ImageSourcePropType } from 'react-native';

type Props = {
  route: {
    params?: {
      userId?: string;
      editMode?: boolean;
    };
  };
  navigation: any;
};

export default function PlatformSelectionScreen({ route, navigation }: Props) {
  const editMode = route.params?.editMode ?? false;
  const userId = route.params?.userId || UserManager.getCurrentUserId();

  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    console.log("Edit Mode?:", editMode);
  }, []);

  useEffect(() => {
    const init = async () => {
      try {
        setLoading(true);

        // Load existing user preferences if editing
        if (editMode && userId) {
          const user = await UserService.get(userId);
          if (user) {
            setSelectedPlatforms(user.preferences.selectedPlatforms || []);
          }
        }

        // Load platforms list
        setPlatforms(STREAMING_PLATFORMS);

      } catch (err: any) {
        console.error('Error initializing platform screen:', err);
        setError('Failed to load platforms');
      } finally {
        setLoading(false);
      }
    };

    init();
  }, []);

  const togglePlatform = (platformId: string) => {
    setSelectedPlatforms((prev) => {
      if (prev.includes(platformId)) {
        return prev.filter((id) => id !== platformId);
      } else {
        return [...prev, platformId];
      }
    });
  };

  const handleSave = async () => {
    if (selectedPlatforms.length === 0) {
      Alert.alert('Select Platform', 'Please select at least one platform to continue');
      return;
    }

    try {
      setLoading(true);

      if (!userId) {
        Alert.alert('Error', 'User session not found');
        return;
      }

      await UserService.updatePreferences(userId, {
        selectedPlatforms: selectedPlatforms,
      });

      console.log('Platforms saved successfully:', selectedPlatforms);

      if (editMode) {
        navigation.navigate("Profile");
        return;
      }

      navigation.navigate('FavoriteMediaSelection', { userId });

    } catch (error: any) {
      console.error('Error saving platforms:', error);
      Alert.alert('Error', 'Failed to save platforms. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const renderPlatformCard = ({ item }: { item: Platform }) => {
    const isSelected = selectedPlatforms.includes(item.id);

    return (
      <SelectableCard
        id={item.id}
        label={item.name}
        image={getPlatformImage(item.name)}
        isSelected={isSelected}
        onPress={togglePlatform}
      />
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#F5C518" />
          <Text style={styles.loadingText}>Loading platforms...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity 
            style={styles.retryButton}
            onPress={() => {
              setError(null);
              setLoading(true);
              setPlatforms(STREAMING_PLATFORMS);
              setLoading(false);
            }}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Title */}
      <View style={styles.titleContainer}>
        <Text style={styles.title}>What streaming services do you have?</Text>
        <Text style={styles.subtitle}>
          {editMode ? "Update your selection" : "Select one or more to continue"}
        </Text>
      </View>

      {/* Continue / Update Button */}
      <TouchableOpacity
        style={[
          styles.continueButton,
          selectedPlatforms.length === 0 && styles.continueButtonDisabled,
        ]}
        onPress={handleSave}
        disabled={selectedPlatforms.length === 0}
      >
        <Text style={styles.continueButtonText}>
          {editMode ? "Update" : "Continue"}
        </Text>
      </TouchableOpacity>

      {/* Divider */}
      <View style={styles.divider} />

      {/* Platform Grid */}
      <FlatList
        data={platforms}
        renderItem={renderPlatformCard}
        keyExtractor={(item) => item.id}
        numColumns={2}
        contentContainerStyle={styles.genreGrid}
        showsVerticalScrollIndicator={false}
        columnWrapperStyle={styles.row}
      />
    </SafeAreaView>
  );
}

const getPlatformImage = (platformName: string): ImageSourcePropType => {
  const imageMap: { [key: string]: ImageSourcePropType } = {
    'Action': require('../../assets/genres/action.png'),
    'Apple TV+' : require("../../assets/platforms/apple.png"),
    'CrunchyRoll' : require("../../assets/platforms/crunchyroll.png"),
    'Disney+' : require("../../assets/platforms/disney.png"),
    'Hulu' : require("../../assets/platforms/hulu.png"),
    'Max' : require("../../assets/platforms/max.png"),
    'Netflix' : require("../../assets/platforms/netflix.png"),
    "Paramount+" : require("../../assets/platforms/paramount.png"),
    "Peacock" : require("../../assets/platforms/peacock.jpg"),
    "Prime Video" : require("../../assets/platforms/prime.png")
  };

  return imageMap[platformName];
};