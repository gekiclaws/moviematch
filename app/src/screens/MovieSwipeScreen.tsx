
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Dimensions,
  Alert,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { movieProvider } from '../services/movies/providerRegistry';
import { SwipeService } from '../services/firebase/swipeService';
import { SessionService } from '../services/firebase/sessionService';
import { UserService } from '../services/firebase/userService';
import MovieCard from '../components/MovieCard';
import MovieDetailsModal from '../components/MovieDetailsModal';
import type { Media } from '../types/media';
import type { User } from '../types/user';
import { styles } from '../styles/MovieSwipeStyles';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type Props = {
  route: {
    params: {
      sessionId: string;
      userId: string;
      sessionTypes?: ('movie' | 'show')[]; // Add this
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
  
  const [showTutorialChoice, setShowTutorialChoice] = useState(true); // Ask user to start tutorial
  const [showTutorial, setShowTutorial] = useState(false);            // Animate tutorial steps
  const [tutorialStep, setTutorialStep] = useState(0);                // 0=left, 1=right, 2=info
  const hasMarkedFinishedRef = useRef(false);
  const hasNavigatedRef = useRef(false);
  const arrowAnim = useRef(new Animated.Value(0)).current;
  const tutorialTime = 3500;

  useEffect(() => {
    loadUserAndMovies();
  }, []);

  useEffect(() => {
    if (!showTutorial) return;

    Animated.loop(
      Animated.sequence([
        Animated.timing(arrowAnim, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(arrowAnim, {
          toValue: 0,
          duration: 600,
          useNativeDriver: true,
        }),
      ])
    ).start();

  }, [showTutorial, tutorialStep]);

  useEffect(() => {
    const unsubscribe = SessionService.subscribeToSession(
      sessionId,
      (updatedSession) => {
        if (
          updatedSession?.sessionStatus === 'complete' &&
          !hasNavigatedRef.current
        ) {
          hasNavigatedRef.current = true;
          navigation.replace('RecommendationScreen', {
            sessionId: updatedSession.id,
          });
        }
      },
      (error) => {
        console.error('Error subscribing to session updates:', error);
      }
    );

    return () => {
      unsubscribe();
    };
  }, [navigation, sessionId]);

  // Preload more movies when running low
  useEffect(() => {
    // if (movies.length - currentIndex <= 3 && movies.length > 0) { // TODO Change based on algorithm
    //   loadMoreMovies();
    // }
  }, [currentIndex]);

    useEffect(() => {
      if (modalVisible) {
        setSelectedMovie(movies[currentIndex]);
      }
    }, [currentIndex, modalVisible]);

  useEffect(() => {
    if (!showTutorial) return;

    let timer: NodeJS.Timeout;

    if (tutorialStep === 0) {
      // After 3s → show "Swipe right"
      timer = setTimeout(() => setTutorialStep(1), tutorialTime);
    } else if (tutorialStep === 1) {
      // After 3s → show "Tap for details"
      timer = setTimeout(() => setTutorialStep(2), tutorialTime);
    } else if (tutorialStep === 2) {
      // After 3s → end tutorial
      timer = setTimeout(() => {
        setShowTutorial(false);
        setTutorialStep(0);
      }, tutorialTime);
    }

    return () => clearTimeout(timer);
  }, [tutorialStep, showTutorial]);

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

      const typesToFetch = route.params.sessionTypes || userData.preferences.selectedTypes;

      const fetchedMovies = await movieProvider.getMoviesByPreferences(
        {
          selectedTypes: typesToFetch,
          selectedGenres: [],
          selectedPlatforms: [],
        },
        'us',
        { limit: 10, orderBy: 'popularity_1year' }
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
      const moreMovies = await movieProvider.getMoviesByPreferences(
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
      await SwipeService.addSwipeToSession(sessionId, userId, movie, 'dislike');

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
      await SwipeService.addSwipeToSession(sessionId, userId, movie, 'like');

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
    console.log('Opening details for:', movies[currentIndex]); // Debug log
    setSelectedMovie(movies[currentIndex]);
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
    if (!hasMarkedFinishedRef.current) {
      hasMarkedFinishedRef.current = true;
      SessionService.markPlayerFinished(sessionId, userId).catch((err) => {
        console.error('Failed to mark player finished:', err);
      });
    }

    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.noMoreContainer}>
          <Text style={styles.noMoreText}>No more movies!</Text>
          <Text style={styles.noMoreSubtext}>
            Waiting for your partner to finish...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const currentMovie = movies[currentIndex];

  return (
    <SafeAreaView style={styles.container}>
      {/* Tutorial Choice Popup */}
      {showTutorialChoice && (
        <View style={styles.fullScreenOverlay}>
          <View style={styles.tutorialBox}>
            <Text style={styles.tutorialTitle}>Want a quick tutorial?</Text>
            <Text style={styles.tutorialText}>
              Learn how swiping works — it only takes a few seconds.
            </Text>

            <TouchableOpacity
              style={styles.tutorialButton}
              onPress={() => {
                setShowTutorialChoice(false);
                setShowTutorial(true);
                setTutorialStep(0);
              }}
            >
              <Text style={styles.tutorialButtonText}>Start Tutorial</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.skipButton}
              onPress={() => setShowTutorialChoice(false)}
            >
              <Text style={styles.skipButtonText}>Skip</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

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
          onSwipeUp={handleOpenDetails}
          isTopCard={true}
        />
      </View>

      {/* Tutorial Step Overlay */}
      {showTutorial && (
        <View style={styles.tutorialHintOverlay} pointerEvents="none">
          {tutorialStep === 0 && (
            <>
              <Text style={styles.hintText}>Swipe left to dislike </Text>
              <Animated.Text
                style={[
                  styles.arrow,
                  {
                    transform: [
                      {
                        translateX: arrowAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0, -20], // ← moves left
                        }),
                      },
                    ],
                  },
                ]}
              >
                ←
              </Animated.Text>
            </>
          )}

          {tutorialStep === 1 && (
            <>
              <Text style={styles.hintText}>Swipe right to like</Text>
              <Animated.Text
                style={[
                  styles.arrow,
                  {
                    transform: [
                      {
                        translateX: arrowAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0, 20], // → moves right
                        }),
                      },
                    ],
                  },
                ]}
              >
                →
              </Animated.Text>
            </>
          )}

          {tutorialStep === 2 && (
          <>
            <Text style={styles.hintText}>Swipe up for more details </Text>
            <Animated.Text
              style={[
                styles.arrow,
                {
                  transform: [
                    {
                      translateY: arrowAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, -20], // ↑ moves upward
                      }),
                    },
                  ],
                },
              ]}
            >
              ↑
            </Animated.Text>
          </>
        )}

        </View>
      )}



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
        key={selectedMovie?.id}
        visible={modalVisible}
        movie={selectedMovie}
        onClose={() => {
          setModalVisible(false);
          setSelectedMovie(null);
        }}
      />
    </SafeAreaView>
  );
}

