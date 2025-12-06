// src/components/MovieDetailsModal.tsx
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  Image,
  Dimensions,
} from 'react-native';
import type { Media } from '../types/media';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface MovieDetailsModalProps {
  visible: boolean;
  movie: Media | null;
  onClose: () => void;
}

export default function MovieDetailsModal({
  visible,
  movie,
  onClose,
}: MovieDetailsModalProps) {
  if (!movie) return null;

  const usStreamingServices = movie.streamingOptions
    .find((g) => g.countryCode === 'us')?.services || [];

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalContainer}>
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={onClose}
        />
        
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.dragIndicator} />
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
            {/* Poster */}
            {movie.poster && (
              <Image
                source={{ uri: movie.backdrop }}
                style={styles.modalPoster}
                resizeMode="cover"
              />
            )}

            {/* Title and Year */}
            <View style={styles.titleSection}>
              <Text style={styles.modalTitle}>{movie.title}</Text>
              <View style={styles.metaRow}>
                {movie.releaseYear && (
                  <Text style={styles.metaText}>{movie.releaseYear}</Text>
                )}
                {movie.runtime && (
                  <Text style={styles.metaText}> • {movie.runtime} min</Text>
                )}
                {movie.rating && (
                  <Text style={styles.metaText}> • ⭐ {movie.rating}/100</Text>
                )}
              </View>
            </View>

            {/* Genres */}
            {movie.genres.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Genres</Text>
                <View style={styles.genreContainer}>
                  {movie.genres.map((genre, index) => (
                    <View key={index} style={styles.genreTag}>
                      <Text style={styles.genreText}>{genre}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Overview */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Overview</Text>
              <Text style={styles.overview}>{movie.overview}</Text>
            </View>

            {/* Director */}
            {movie.directors.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Director</Text>
                <Text style={styles.sectionText}>
                  {movie.directors.join(', ')}
                </Text>
              </View>
            )}

            {/* Top Cast */}
            {movie.cast.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Top Cast</Text>
                <Text style={styles.sectionText}>
                  {movie.cast.slice(0, 5).join(', ')}
                </Text>
              </View>
            )}

            {/* Streaming Options */}
            {usStreamingServices.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Available On</Text>
                {usStreamingServices.map((service, idx) => (
                  <Text key={idx} style={styles.streamingText}>
                    • {service.serviceName}
                  </Text>
                ))}
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: '#000000ff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: SCREEN_HEIGHT * 0.9,
    paddingBottom: 20,
  },
  header: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 10,
  },
  dragIndicator: {
    width: 40,
    height: 5,
    backgroundColor: '#ccc',
    borderRadius: 3,
  },
  closeButton: {
    position: 'absolute',
    right: 15,
    top: 10,
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 24,
    color: '#ffffffff',
  },
  scrollView: {
    paddingHorizontal: 20,
  },
  modalPoster: {
    width: '100%',
    height: 300,
    borderRadius: 10,
    marginBottom: 20,
    paddingTop: 30
  },
  titleSection: {
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#ffffffff',
    marginBottom: 8,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  metaText: {
    fontSize: 16,
    color: '#ffffffff',
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fbfbfbff',
    marginBottom: 8,
  },
  sectionText: {
    fontSize: 16,
    color: '#ffffffff',
    lineHeight: 24,
  },
  genreContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  genreTag: {
    backgroundColor: '#e0e0e0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  genreText: {
    fontSize: 14,
    color: '#333',
  },
  overview: {
    fontSize: 16,
    color: '#fdfdfdff',
    lineHeight: 24,
  },
  streamingText: {
    fontSize: 16,
    color: '#ffffffff',
    marginBottom: 4,
  },
});