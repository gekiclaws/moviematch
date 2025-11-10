// src/screens/GenreSelectionScreen.tsx
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
import { getAvailableGenres } from '../services/api/mediaApiService';
import type { Genre } from '../types/genre';
import SelectableCard from "../components/SelectableCard";
import { UserService } from '../services/firebase/userService';
import { UserManager } from '../services/firebase/userManager';

type Props = {
  route: {
    params?: {
      userId?: string;
    };
  };
  navigation: any;
};

export default function GenreSelectionScreen({ route, navigation }: Props) {
  const [genres, setGenres] = useState<Genre[]>([]);
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadGenres();
  }, []);

  const loadGenres = async () => {
    try {
      setLoading(true);
      const fetchedGenres = await getAvailableGenres();
      setGenres(fetchedGenres);
    } catch (err: any) {
      console.error('Error loading genres:', err);
      setError('Failed to load genres');
    } finally {
      setLoading(false);
    }
  };

  const toggleGenre = (genreId: string) => {
    setSelectedGenres((prev) => {
      if (prev.includes(genreId)) {
        return prev.filter((id) => id !== genreId);
      } else {
        return [...prev, genreId];
      }
    });
  };

  const handleContinue = async () => {
    if (selectedGenres.length === 0) {
        Alert.alert('Select Genres', 'Please select at least one genre to continue');
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

    // Update user preferences with selected genres using the helper method
    await UserService.updatePreferences(userId, {
      selectedGenres: selectedGenres,
    });

    console.log('Genres saved successfully:', selectedGenres);

    // Navigate to streaming services screen
    navigation.navigate('PlatformSelection', {
      userId: userId,
    });

  } catch (error: any) {
    console.error('Error saving genres:', error);
    Alert.alert('Error', 'Failed to save genres. Please try again.');
  } finally {
    setLoading(false);
  }
};

  const renderGenreCard = ({ item }: { item: Genre }) => {
  const isSelected = selectedGenres.includes(item.id);

  return (
    <SelectableCard
      id={item.id}
      label={item.name}
      emoji={getGenreEmoji(item.name)}
      isSelected={isSelected}
      onPress={toggleGenre}
    />
  );
};

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#F5C518" />
          <Text style={styles.loadingText}>Loading genres...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadGenres}>
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
        <Text style={styles.title}>What are your favorite genres?</Text>
        <Text style={styles.subtitle}>Select one or more to continue</Text>
      </View>

      {/* Continue Button */}
      <TouchableOpacity
        style={[
          styles.continueButton,
          selectedGenres.length === 0 && styles.continueButtonDisabled,
        ]}
        onPress={handleContinue}
        disabled={selectedGenres.length === 0}
      >
        <Text style={styles.continueButtonText}>Continue</Text>
      </TouchableOpacity>

      {/* Divider */}
      <View style={styles.divider} />

      {/* Genre Grid */}
      <FlatList
        data={genres}
        renderItem={renderGenreCard}
        keyExtractor={(item) => item.id}
        numColumns={2}
        contentContainerStyle={styles.genreGrid}
        showsVerticalScrollIndicator={false}
        columnWrapperStyle={styles.row}
      />
    </SafeAreaView>
  );
}

// Helper function to get emoji for each genre
const getGenreEmoji = (genreName: string): string => {
  const emojiMap: { [key: string]: string } = {
    'Action': '🎬',
    'Adventure': '🗺️',
    'Animation': '🎨',
    'Comedy': '😂',
    'Crime': '🔫',
    'Documentary': '📹',
    'Drama': '🎭',
    'Family': '👨‍👩‍👧‍👦',
    'Fantasy': '🧙',
    'History': '📜',
    'Horror': '👻',
    'Music': '🎵',
    'Mystery': '🔍',
    'Romance': '❤️',
    'Sci-Fi': '🚀',
    'Thriller': '😱',
    'War': '⚔️',
    'Western': '🤠',
  };

  return emojiMap[genreName] || '🎬';
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
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
