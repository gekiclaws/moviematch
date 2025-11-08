
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

type Props = {
  route: {
    params?: {
      userId?: string;
    };
  };
  navigation: any;
};

export default function  PlatformSelectionScreen({ route, navigation }: Props) {
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setPlatforms(STREAMING_PLATFORMS);
    setLoading(false);
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

  const handleContinue = async () => {
    if (selectedPlatforms.length === 0) {
        Alert.alert('Select Platform', 'Please select at least one platform to continue');
        return;
    }

    try {
        setLoading(true);

        // Get userId - either from route params or from UserManager
        const userId = route.params?.userId || UserManager.getCurrentUserId();
    
    if (!userId) {
      Alert.alert('Error', 'User session not found');
      return;
    }

    // Update user preferences with selected platforms using the helper method
    await UserService.updatePreferences(userId, {
      selectedPlatforms: selectedPlatforms,
    });

    console.log('Platforms saved successfully:', selectedPlatforms);

    // Navigate to streaming services screen
    navigation.navigate('FavMovieSelection', {
      userId: userId,
    });

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
      emoji={getPlatformEmoji(item.name)}
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
          <TouchableOpacity style={styles.retryButton}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backButton}>←</Text>
        </TouchableOpacity>
      </View>

      {/* Title */}
      <View style={styles.titleContainer}>
        <Text style={styles.title}>What streaming services do you have?</Text>
        <Text style={styles.subtitle}>Select one or more to continue</Text>
      </View>

      {/* Continue Button */}
      <TouchableOpacity
        style={[
          styles.continueButton,
          selectedPlatforms.length === 0 && styles.continueButtonDisabled,
        ]}
        onPress={handleContinue}
        disabled={selectedPlatforms.length === 0}
      >
        <Text style={styles.continueButtonText}>Continue</Text>
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

const getPlatformEmoji = (platformName: string): string => {
  const emojiMap: { [key: string]: string } = {
    'Netflix': '🎬',
    'Prime Video': '📦',
    'Disney+': '🏰',
    'Max': '🎭',
    'Hulu': '🟢',
    'Apple TV+': '🍎',
    'Paramount+': '⛰️',
    'Peacock': '🦚',
  };

  return emojiMap[platformName] || '📺';
};


const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  backButton: {
    fontSize: 32,
    color: '#F5C518',
    fontWeight: 'bold',
  },
  titleContainer: {
    paddingHorizontal: 30,
    paddingVertical: 20,
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: '#aaa',
    textAlign: 'center',
  },
  continueButton: {
    backgroundColor: '#F5C518',
    paddingVertical: 15,
    paddingHorizontal: 40,
    borderRadius: 25,
    alignSelf: 'center',
    marginVertical: 10,
    minWidth: 200,
  },
  continueButtonDisabled: {
    backgroundColor: '#555',
  },
  continueButtonText: {
    color: '#000',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  divider: {
    height: 1,
    backgroundColor: '#333',
    marginHorizontal: 30,
    marginVertical: 15,
  },
  genreGrid: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  row: {
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  genreCard: {
    width: '48%',
    aspectRatio: 1,
    backgroundColor: '#6c230fff',
    borderRadius: 15,
    padding: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'transparent',
  },
  genreCardSelected: {
    borderColor: '#F5C518',
    backgroundColor: '#A0522D',
  },
  genreIcon: {
    marginBottom: 10,
  },
  genreEmoji: {
    fontSize: 48,
  },
  genreText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 15,
  },
  loadingText: {
    color: '#aaa',
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    gap: 20,
  },
  errorText: {
    color: '#F44336',
    fontSize: 16,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: '#F5C518',
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '600',
  },
});