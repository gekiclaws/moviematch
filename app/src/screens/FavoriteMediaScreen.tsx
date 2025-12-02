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
import { styles } from "../styles/FavoriteMediaStyles";

type Props = {
  route: {
    params?: {
      userId?: string;
      editMode?: boolean;
    };
  };
  navigation: any;
};

export default function FavoriteMediasScreen({ route, navigation }: Props) {
  const editMode = route.params?.editMode ?? false;
  const userId = route.params?.userId || UserManager.getCurrentUserId();

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Media[]>([]);
  const [selectedMedias, setSelectedMedias] = useState<string[]>([]);
  const [searching, setSearching] = useState(false);
  const [loading, setLoading] = useState(false);
  const [initialMedia, setInitialMedia] = useState<Media[]>([]);

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
            setSelectedMedias(user.preferences.favoriteMedia || []);
          }
        }

        // Load popular movies
        await loadPopularMovies();

      } catch (err: any) {
        console.error('Error initializing favorite media screen:', err);
      } finally {
        setLoading(false);
      }
    };

    init();
  }, []);

  const loadPopularMovies = async () => {
    try {
      setSearching(true);
      const popular = await getPopularMovies('netflix', 'us');
      setInitialMedia(popular);
      setSearchResults(popular);
    } catch (err: any) {
      console.error('Error loading popular movies:', err);
    } finally {
      setSearching(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
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

  const handleSave = async () => {
    if (selectedMedias.length === 0) {
      Alert.alert('Select Movie/Show', 'Please select at least one to continue');
      return;
    }

    try {
      setLoading(true);

      if (!userId) {
        Alert.alert('Error', 'User session not found');
        return;
      }

      await UserService.updatePreferences(userId, {
        favoriteMedia: selectedMedias,
      });

      console.log('Favorite movies/shows saved successfully:', selectedMedias);

      if (editMode) {
        navigation.navigate("Profile");
        return;
      }

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
        <Text style={styles.subtitle}>
          {editMode ? "Update your selection" : "Select one or more to continue"}
        </Text>
      </View>

      {/* Continue / Update Button */}
      <TouchableOpacity
        style={[
          styles.continueButton,
          (selectedMedias.length === 0 || loading) && styles.continueButtonDisabled,
        ]}
        onPress={handleSave}
        disabled={selectedMedias.length === 0 || loading}
      >
        {loading ? (
          <ActivityIndicator color="#000" />
        ) : (
          <Text style={styles.continueButtonText}>
            {editMode ? "Update" : "Continue"}
          </Text>
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
            setSearchResults(initialMedia);
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
            {searchQuery ? 'No results found' : 'Search for movies or shows'}
          </Text>
        </View>
      )}
    </SafeAreaView>
  );
}