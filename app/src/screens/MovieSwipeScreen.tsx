
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Dimensions,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getMoviesByPreferences } from '../services/api/mediaApiService';
import { SwipeService } from '../services/firebase/swipeService';
import { UserService } from '../services/firebase/userService';
import MovieCard from '../components/MovieCard';
import MovieDetailsModal from '../components/MovieDetailsModal';
import type { Media } from '../types/media';
import type { User } from '../types/user';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type Props = {
  route: {
    params: {
      sessionId: string;
      userId: string;
    };
  };
  navigation: any;
};

export default function MovieSwipeScreen({ route, navigation }: Props) {
  const { sessionId, userId } = route.params;

  // State
  const [movies, setMovies] = useState<Media[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedMovie, setSelectedMovie] = useState<Media | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    loadUserAndMovies();
  }, []);

  // Preload more movies when running low
  useEffect(() => {
    // if (movies.length - currentIndex <= 3 && movies.length > 0) { // TODO Change based on algorithm
    //   loadMoreMovies();
    // }
  }, [currentIndex]);

  /**
   * Load user data and initial movies
   */
  const loadUserAndMovies = async () => {
    try {
      setLoading(true);
      setError(null);

      // Load user to get preferences
      const userData = await UserService.get(userId);
      if (!userData) {
        throw new Error('User not found');
      }
      setUser(userData);

      // Fetch movies based on user preferences
      const fetchedMovies = await getMoviesByPreferences(
        userData.preferences,
        'us',
        { minRating: 70, limit: 10, orderBy: 'popularity_alltime' }
      );

      if (fetchedMovies.length === 0) {
        setError('No movies found matching your preferences');
        return;
      }

      setMovies(fetchedMovies);
    } catch (err: any) {
      console.error('Error loading movies:', err);
      console.error('Full error object:', JSON.stringify(err, null, 2));
      setError(err.message || 'Failed to load movies');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Load more movies to keep the queue full
   */
  const loadMoreMovies = async () => {
    if (!user) return;

    try {
      const moreMovies = await getMoviesByPreferences(
        user.preferences,
        'us',
        { minRating: 60, limit: 10, orderBy: 'popularity_alltime' }
      );

      setMovies((prev) => [...prev, ...moreMovies]);
    } catch (err) {
      console.error('Error loading more movies:', err);
    }
  };

  /**
   * Handle swipe left (dislike)
   */
  const handleDislike = async () => {
    const movie = movies[currentIndex];
    if (!movie) return;

    try {
      // Save swipe to Firebase
      await SwipeService.addSwipeToSession(
        sessionId,
        userId,
        movie.title,
        'dislike'
      );

      // Move to next movie
      setCurrentIndex((prev) => prev + 1);
    } catch (err) {
      console.error('Error saving dislike:', err);
      Alert.alert('Error', 'Failed to save your decision');
    }
  };

  /**
   * Handle swipe right (like)
   */
  const handleLike = async () => {
    const movie = movies[currentIndex];
    if (!movie) return;

    try {
      // Save swipe to Firebase
      await SwipeService.addSwipeToSession(
        sessionId,
        userId,
        movie.title,
        'like'
      );

      // Move to next movie
      setCurrentIndex((prev) => prev + 1);
    } catch (err) {
      console.error('Error saving like:', err);
      Alert.alert('Error', 'Failed to save your decision');
    }
  };

  /**
   * Open movie details modal
   */
  const handleOpenDetails = (movie: Media) => {
    setSelectedMovie(movie);
    setModalVisible(true);
  };

  /**
   * Force swipe via buttons
   */
  const handleDislikeButton = () => {
    handleDislike();
  };

  const handleLikeButton = () => {
    handleLike();
  };

  // Loading state
  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#E50914" />
          <Text style={styles.loadingText}>Loading movies...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Error state
  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadUserAndMovies}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // No more movies
  /* ---------------------------TODO---------------------------------
    Redirect user to recommednation screen based on swipes
    User.swipes are updated every time a user swipes
    You have a swipe interface and media interface
    something easy could be to just recommend a movie that both users liked
    you can fetch a single movie with getMovieById in ApiService 
    
  */
  
  if (currentIndex >= movies.length) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.noMoreContainer}>
          <Text style={styles.noMoreText}>No more movies!</Text>
          <Text style={styles.noMoreSubtext}>
            Waiting for your partner to finish...
          </Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.retryButtonText}>Back to Lobby</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const currentMovie = movies[currentIndex];

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {currentIndex + 1} / {movies.length}
        </Text>
        <View style={{ width: 60 }} />
      </View>

      {/* Single Card */}
      <View style={styles.cardContainer}>
        <MovieCard
          movie={currentMovie}
          onSwipeLeft={handleDislike}
          onSwipeRight={handleLike}
          onPress={() => handleOpenDetails(currentMovie)}
          isTopCard={true}
        />
      </View>

      {/* Action Buttons */}
      <View style={styles.buttonsContainer}>
        <TouchableOpacity
          style={[styles.actionButton, styles.dislikeButton]}
          onPress={handleDislikeButton}
        >
          <Text style={styles.buttonIcon}>✕</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.likeButton]}
          onPress={handleLikeButton}
        >
          <Text style={styles.buttonIcon}>♥</Text>
        </TouchableOpacity>
      </View>

      {/* Movie Details Modal */}
      <MovieDetailsModal
        visible={modalVisible}
        movie={selectedMovie}
        onClose={() => setModalVisible(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000ff',
  },
  header: {
    position: 'absolute',  // Position on top of card
    top: 50,  // Adjust for safe area
    left: 0,
    right: 0,
    zIndex: 100,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  backButton: {
    fontSize: 16,
    color: '#ffffffff',
    width: 60,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffffff',
  },
  cardContainer: {
    color: '#333',
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    paddingBottom: 100
  },
  buttonsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 30,
    gap: 40,
  },
  actionButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  dislikeButton: {
    backgroundColor: '#F44336',
  },
  likeButton: {
    backgroundColor: '#4CAF50',
  },
  buttonIcon: {
    fontSize: 32,
    color: '#fff',
    fontWeight: 'bold',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 15,
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    gap: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#F44336',
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: '#3498db',
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  noMoreContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    gap: 15,
  },
  noMoreText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  noMoreSubtext: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
});