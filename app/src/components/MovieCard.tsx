// src/components/MovieCard.tsx
import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  Animated,
  PanResponder,
  Image,
  TouchableOpacity,
} from 'react-native';
import type { Media } from '../types/media';
import { TrailerPlayer } from './TrailerPlayer';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const SWIPE_THRESHOLD = 120;
const VERTICAL_THRESHOLD = 80; // swipe-up distance

interface MovieCardProps {
  movie: Media;
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
  onSwipeUp: (movie: Media) => void;
  isTopCard: boolean;
  disableSwipes?: boolean;
}

export default function MovieCard({
  movie,
  onSwipeLeft,
  onSwipeRight,
  onSwipeUp,
  isTopCard,
  disableSwipes = false,
}: MovieCardProps) {
  const position = useRef(new Animated.ValueXY()).current;
  const [showTrailer, setShowTrailer] = useState(false);

  const panResponder = useRef(
    PanResponder.create({
      // Only start the swipe responder after a horizontal move so taps (e.g. trailer WebView) still work
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gesture) =>
        isTopCard &&
        !disableSwipes &&
        (
          // horizontal swipe
          (Math.abs(gesture.dx) > 10 && Math.abs(gesture.dx) > Math.abs(gesture.dy)) ||
          // upward swipe to open details
          (gesture.dy < -10 && Math.abs(gesture.dy) > Math.abs(gesture.dx))
        ),
      onPanResponderMove: (_, gesture) => {
        position.setValue({ x: gesture.dx, y: gesture.dy });
      },
      onPanResponderRelease: (_, gesture) => {
        const { dx, dy } = gesture;
        
        // Swipe up for more info
        if (dy < -VERTICAL_THRESHOLD && Math.abs(dx) < 50) {
          resetPosition(); // reset card so it doesn't stay dragged
          onSwipeUp(movie);       // open modal
          return;
        }

        if (dx > SWIPE_THRESHOLD) {
          forceSwipe('right');
        } else if (dx < -SWIPE_THRESHOLD) {
          forceSwipe('left');
        } else {
          resetPosition();
        }
      }
    })
  ).current;

  const forceSwipe = (direction: 'left' | 'right') => {
    const x = direction === 'right' ? SCREEN_WIDTH + 100 : -SCREEN_WIDTH - 100;
    Animated.timing(position, {
      toValue: { x, y: 0 },
      duration: 250,
      useNativeDriver: false,
    }).start(() => {
      if (direction === 'right') {
        onSwipeRight();
      } else {
        onSwipeLeft();
      }
      position.setValue({ x: 0, y: 0 });
    });
  };

  const resetPosition = () => {
    Animated.spring(position, {
      toValue: { x: 0, y: 0 },
      useNativeDriver: false,
    }).start();
  };

  const getCardStyle = () => {
    const rotate = position.x.interpolate({
      inputRange: [-SCREEN_WIDTH * 1.5, 0, SCREEN_WIDTH * 1.5],
      outputRange: ['-30deg', '0deg', '30deg'],
    });

    return {
      ...position.getLayout(),
      transform: [{ rotate }],
    };
  };

  const getLikeOpacity = () => {
    return position.x.interpolate({
      inputRange: [0, SWIPE_THRESHOLD],
      outputRange: [0, 1],
      extrapolate: 'clamp',
    });
  };

  const getDislikeOpacity = () => {
    return position.x.interpolate({
      inputRange: [-SWIPE_THRESHOLD, 0],
      outputRange: [1, 0],
      extrapolate: 'clamp',
    });
  };

  const usStreamingServices = movie.streamingOptions
    .find((g) => g.countryCode === 'us')?.services || [];

  return (
    <Animated.View
      style={[styles.card, isTopCard && getCardStyle()]}
      {...(isTopCard && !disableSwipes ? panResponder.panHandlers : {})}
    >
      {/* Like/Dislike Overlays */}
      {isTopCard && (
        <>
          <Animated.View
            style={[styles.likeOverlay, { opacity: getLikeOpacity() }]}
          >
            <Text style={styles.likeText}>LIKE</Text>
          </Animated.View>

          <Animated.View
            style={[styles.dislikeOverlay, { opacity: getDislikeOpacity() }]}
          >
            <Text style={styles.dislikeText}>DISLIKE</Text>
          </Animated.View>
        </>
      )}

      {/* Movie Poster */}
      <Image
        source={{ uri: movie.poster }}
        style={styles.poster}
        resizeMode= "contain"
      />

      {/* Info Overlay */}
      <View
        style={styles.infoOverlay}
      >
        <View style={styles.infoContent}>
          <Text style={styles.title} numberOfLines={2}>
            {movie.title}
          </Text>
          <Text style={styles.rating}>⭐ {movie.rating}/100</Text>
          <Text style={styles.overview} numberOfLines={3}>
            {movie.overview}
          </Text>
        <View style={styles.trailerSection}>
          {showTrailer ? (
            <TrailerPlayer trailerUrl={movie.trailerUrl} />
          ) : (
            !!movie.trailerUrl && (
              <TouchableOpacity
                style={styles.trailerButton}
                onPress={() => setShowTrailer(true)}
                activeOpacity={0.8}
              >
                <Text style={styles.trailerButtonText}>Watch Trailer</Text>
              </TouchableOpacity>
            )
          )}
          </View>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    backgroundColor: '#000',
  },
  poster: {
    width: '100%',
    height: '100%',
  },
  likeOverlay: {
    position: 'absolute',
    top: 100,  // Lower it down so it's below the back button
    left: 30,
    zIndex: 1000,
    borderWidth: 4,
    borderColor: '#4CAF50',
    borderRadius: 10,
    padding: 10,
    transform: [{ rotate: '-20deg' }],
  },
  likeText: {
    color: '#4CAF50',
    fontSize: 32,
    fontWeight: 'bold',
  },
  dislikeOverlay: {
    position: 'absolute',
    top: 100,  // Lower it down
    right: 30,
    zIndex: 1000,
    borderWidth: 4,
    borderColor: '#F44336',
    borderRadius: 10,
    padding: 10,
    transform: [{ rotate: '20deg' }],
  },
  dislikeText: {
    color: '#F44336',
    fontSize: 32,
    fontWeight: 'bold',
  },
  infoOverlay: {
    position: 'absolute',
    bottom: 60,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',  // More transparent (was 0.85)
    padding: 20,
  },
  infoContent: {
    gap: 10,
  },
  title: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  rating: {
    color: '#FFD700',
    fontSize: 16,
  },
  overview: {
    color: '#fff',
    fontSize: 14,
    lineHeight: 20,
  },
  tapHint: {
    color: '#aaa',
    fontSize: 12,
    fontStyle: 'italic',
  },
  trailerSection: {
    marginTop: 8,
    gap: 8,
  },
  trailerButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#3498db',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  trailerButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});
