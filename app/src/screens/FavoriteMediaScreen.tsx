// src/screens/FavoriteMediaScreen.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
  TextInput,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { searchMoviesByTitle, getPopularMovies } from '../services/api/mediaApiService';
import { UserService } from '../services/firebase/userService';
import { UserManager } from '../services/firebase/userManager';
import type { Media } from '../types/media';

type Props = {
  route: {
    params?: {
      userId?: string;
    };
  };
  navigation: any;
};



export default function FavoriteMediasScreen({ route, navigation }: Props) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Media[]>([]);
  const [selectedMedias, setSelectedMedias] = useState<string[]>([]);
  const [searching, setSearching] = useState(false);
  const [loading, setLoading] = useState(false);
  const [initialMedia, setInitialMedia] = useState<Media[]>([]);

  useEffect(() => {
    loadPopularMovies();
  }, []);

  const loadPopularMovies = async () => {
  try {
    setSearching(true);
    // Load popular movies from Netflix (or any service)
    const popular = await getPopularMovies('netflix', 'us');
    setInitialMedia(popular);
    setSearchResults(popular); // Show them in the grid
  } catch (err: any) {
    console.error('Error loading popular movies:', err);
  } finally {
    setSearching(false);
  }
};
  

  const handleSearch = async () => {
  if (!searchQuery.trim()) {
    // If search is cleared, show popular movies again
    setSearchResults(initialMedia);
    return;
  }

  try {
    setSearching(true);
    const results = await searchMoviesByTitle(searchQuery, 'us');
    setSearchResults(results);
  } catch (err: any) {
    console.error('Error searching movies:', err);
    Alert.alert('Error', 'Failed to search movies');
  } finally {
    setSearching(false);
  }
};

  const toggleMedia = (mediaId: string) => {
    setSelectedMedias((prev) => {
      if (prev.includes(mediaId)) {
        return prev.filter((id) => id !== mediaId);
      } else {
        return [...prev, mediaId];
      }
    });
  };

  const handleContinue = async () => {
    if (selectedMedias.length === 0) {
      Alert.alert('Select Movie/Show', 'Please select at least one to continue');
      return;
    }

    try {
      setLoading(true);

      const userId = route.params?.userId || UserManager.getCurrentUserId();
      
      if (!userId) {
        Alert.alert('Error', 'User session not found');
        return;
      }

      // Save favorite titles to user preferences
      await UserService.updatePreferences(userId, {
        favoriteMedia: selectedMedias,
      });

      console.log('Favorite movies/shows saved successfully:', selectedMedias);

      // Navigate to home or next screen
      Alert.alert(
        'Setup Complete!',
        'Your preferences have been saved.',
        [
          {
            text: 'OK',
            onPress: () => navigation.navigate('Home'),
          },
        ]
      );

    } catch (error: any) {
      console.error('Error saving favorite media:', error);
      Alert.alert('Error', 'Failed to save favorite media. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const renderMediaCard = ({ item }: { item: Media }) => {
    const isSelected = selectedMedias.includes(item.id);

    return (
      <TouchableOpacity
        style={[
          styles.mediaCard,
          isSelected && styles.mediaCardSelected,
        ]}
        onPress={() => toggleMedia(item.id)}
        activeOpacity={0.8}
      >
        {item.poster ? (
          <Image
            source={{ uri: item.poster }}
            style={styles.posterImage}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.placeholderPoster}>
            <Text style={styles.placeholderText}>No Poster</Text>
          </View>
        )}
        
        {isSelected && (
          <View style={styles.selectedOverlay}>
            <View style={styles.checkmark}>
              <Text style={styles.checkmarkText}>✓</Text>
            </View>
          </View>
        )}

        <View style={styles.mediaInfo}>
          <Text style={styles.mediaTitle} numberOfLines={2}>
            {item.title}
          </Text>
          {item.releaseYear && (
            <Text style={styles.mediaYear}>{item.releaseYear}</Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>

      {/* Title */}
      <View style={styles.titleContainer}>
        <Text style={styles.title}>What are your favorite movies/shows?</Text>
        <Text style={styles.subtitle}>Select one or more to continue</Text>
      </View>

      {/* Continue Button */}
      <TouchableOpacity
        style={[
          styles.continueButton,
          (selectedMedias.length === 0 || loading) && styles.continueButtonDisabled,
        ]}
        onPress={handleContinue}
        disabled={selectedMedias.length === 0 || loading}
      >
        {loading ? (
          <ActivityIndicator color="#000" />
        ) : (
          <Text style={styles.continueButtonText}>Continue</Text>
        )}
      </TouchableOpacity>

      {/* Divider */}
      <View style={styles.divider} />

      {/* Search Bar */}
      <TextInput
        style={styles.searchInput}
        placeholder="Search ..."
        placeholderTextColor="#5e5e5eff"
        value={searchQuery}
        onChangeText={(text) => {
          setSearchQuery(text);
          if (!text.trim()) {
            setSearchResults(initialMedia); // Show popular when cleared
          }
        }}
        onSubmitEditing={handleSearch}
        returnKeyType="search"
      />

      {/* Search Results */}
      {searching ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#F5C518" />
          <Text style={styles.loadingText}>Searching...</Text>
        </View>
      ) : searchResults.length > 0 ? (
        <FlatList
          data={searchResults}
          renderItem={renderMediaCard}
          keyExtractor={(item) => item.id}
          numColumns={2}
          contentContainerStyle={styles.mediaGrid}
          showsVerticalScrollIndicator={false}
          columnWrapperStyle={styles.row}
        />
      ) : (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>
            {searchQuery ? 'No results found' : 'Search for medias or shows'}
          </Text>
        </View>
      )}
    </SafeAreaView>
  );
}

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
  searchContainer: {
    paddingHorizontal: 30,
    marginBottom: 20,
  },
  searchInput: {
    backgroundColor: '#2a2a2a',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 20,
    color: '#fff',
    fontSize: 16,
  },
  mediaGrid: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  row: {
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  mediaCard: {
    width: '48%',
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#2a2a2a',
    borderWidth: 3,
    borderColor: 'transparent',
  },
  mediaCardSelected: {
    borderColor: '#F5C518',
  },
  posterImage: {
    width: '100%',
    aspectRatio: 2 / 3,
  },
  placeholderPoster: {
    width: '100%',
    aspectRatio: 2 / 3,
    backgroundColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    color: '#666',
    fontSize: 14,
  },
  selectedOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(245, 197, 24, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkmark: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#F5C518',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkmarkText: {
    fontSize: 30,
    color: '#000',
    fontWeight: 'bold',
  },
  mediaInfo: {
    padding: 10,
  },
  mediaTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  mediaYear: {
    color: '#aaa',
    fontSize: 12,
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
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyText: {
    color: '#666',
    fontSize: 16,
    textAlign: 'center',
  },
});