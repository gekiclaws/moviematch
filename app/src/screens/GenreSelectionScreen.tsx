import React, { useState, useEffect, useCallback } from 'react';
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
import type { Genre } from '../types/genre';
import SelectableCard from "../components/SelectableCard";
import { UserService } from '../services/firebase/userService';
import { UserManager } from '../services/firebase/userManager';
import { styles } from '../styles/GenreSelectionStyles';
import { ImageSourcePropType } from 'react-native';
import { movieProvider } from '../services/movies/providerRegistry';

type Props = {
  route: {
    params?: {
      userId?: string;
      editMode?: boolean;
    };
  };
  navigation: any;
};

export default function GenreSelectionScreen({ route, navigation }: Props) {
  const editMode = route.params?.editMode ?? false;
  const userId = route.params?.userId || UserManager.getCurrentUserId();

  const [genres, setGenres] = useState<Genre[]>([]);
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
  
        // Log the favoriteMedia to debug
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
            setSelectedGenres(user.preferences.selectedGenres || []);
          }
        }

        // Load genre list
        const fetchedGenres = await movieProvider.getAvailableGenres();
        setGenres(fetchedGenres);

      } catch (err: any) {
        console.error('Error initializing genre screen:', err);
        setError('Failed to load genres');
      } finally {
        setLoading(false);
      }
    };

    init();
  }, []);

  // --- Toggle selection ---
  const toggleGenre = (genreId: string) => {
    setSelectedGenres((prev) =>
      prev.includes(genreId)
        ? prev.filter((id) => id !== genreId)
        : [...prev, genreId]
    );
  };

    const loadGenres = useCallback(async () => {
      try {
        setLoading(true);
        const fetchedGenres = await movieProvider.getAvailableGenres();
        setGenres(fetchedGenres);
      } catch (err: any) {
        console.error('Error loading genres:', err);
        setError('Failed to load genres');
      } finally {
        setLoading(false);
      }
    }, []);

  // --- Continue or Update ---
  const handleSave = async () => {
    if (selectedGenres.length === 0) {
      Alert.alert('Select Genres', 'Please select at least one genre to continue');
      return;
    }

    try {
      setLoading(true);

      if (!userId) {
        Alert.alert('Error', 'User session not found');
        return;
      }

      await UserService.updatePreferences(userId, {
        selectedGenres,
      });

      console.log('Genres saved successfully:', selectedGenres);

      if (editMode) {
        navigation.navigate("Profile");
        return;
      }

      navigation.navigate("PlatformSelection", { userId });

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
        image = {getGenreImage(item.name)}
        isSelected={isSelected}
        onPress={toggleGenre}
      />
    );
  };

  // --- Loading screen ---
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

  // --- Error screen ---
  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => loadGenres()}>
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
        <Text style={styles.subtitle}>
          {editMode ? "Update your selection" : "Select one or more to continue"}
        </Text>
      </View>

      {/* Continue / Update Button */}
      <TouchableOpacity
        style={[
          styles.continueButton,
          selectedGenres.length === 0 && styles.continueButtonDisabled,
        ]}
        onPress={handleSave}
        disabled={selectedGenres.length === 0}
      >
        <Text style={styles.continueButtonText}>
          {editMode ? "Update" : "Continue"}
        </Text>
      </TouchableOpacity>

      {/* Divider */}
      <View style={styles.divider} />

      {/* Genres */}
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

const getGenreImage = (genreName: string): ImageSourcePropType => {
  const imageMap: { [key: string]: ImageSourcePropType } = {
    'Action': require('../../assets/genres/action.png'),
    'Adventure': require('../../assets/genres/adventure.png'),
    'Animation': require('../../assets/genres/animation.png'),
    'Comedy': require('../../assets/genres/comedy.png'),
    'Crime': require('../../assets/genres/crime.png'),
    'Documentary': require('../../assets/genres/documentary.png'),
    'Drama': require('../../assets/genres/drama.png'),
    'Family': require('../../assets/genres/family.png'),
    'Fantasy': require('../../assets/genres/fantasy.png'),
    'History': require('../../assets/genres/history.png'),
    'Horror': require('../../assets/genres/horror.png'),
    'Music': require('../../assets/genres/music.png'),
    'Mystery': require('../../assets/genres/mystery.png'),
    'News' : require('../../assets/genres/news.png'),
    'Romance': require('../../assets/genres/romance.png'),
    'Reality': require('../../assets/genres/reality.png'),
    'Science Fiction': require('../../assets/genres/scifi.png'),
    'Talk Show': require('../../assets/genres/talk_show.png'),
    'Thriller': require('../../assets/genres/thriller.png'),
    'War': require('../../assets/genres/war.png'),
    'Western': require('../../assets/genres/western.png'),
  };

  return imageMap[genreName];
};
