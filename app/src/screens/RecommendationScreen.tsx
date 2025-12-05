import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { StackScreenProps } from '@react-navigation/stack';

import { SessionService } from '../services/firebase/sessionService';
import type { MatchedTitle, Session } from '../types/session';
import type { RootStackParamList } from '../types/navigation';

type Props = StackScreenProps<RootStackParamList, 'RecommendationScreen'>;

const RecommendationScreen: React.FC<Props> = ({ route, navigation }) => {
  const { sessionId } = route.params;
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = SessionService.subscribeToSession(
      sessionId,
      (updatedSession) => {
        setSession(updatedSession);
        setLoading(false);
      },
      (subscriptionError) => {
        console.error('Recommendation listener error:', subscriptionError);
        setError('Unable to load recommendations right now.');
        setLoading(false);
      }
    );

    return () => {
      unsubscribe();
    };
  }, [sessionId]);

  const matchedTitles = session?.matchedTitles ?? [];
  const isFallback = matchedTitles.length > 0 && matchedTitles.every((title) => title.certainty === undefined);

  const handleWatchTogether = () => {
    Alert.alert('Watch Together', 'Feature coming soon!');
  };

  const handleStartNewSession = () => {
    navigation.navigate('Home');
  };

  const renderMatchedItem = ({ item }: { item: MatchedTitle }) => {
    const streamingText = item.streamingServices?.length
      ? item.streamingServices.join(', ')
      : 'Streaming availability unknown';

    return (
      <View style={styles.card}>
        {item.posterUrl ? (
          <Image source={{ uri: item.posterUrl }} style={styles.poster} resizeMode="cover" />
        ) : (
          <View style={[styles.poster, styles.posterPlaceholder]}>
            <Text style={styles.posterPlaceholderText}>No Image</Text>
          </View>
        )}
        <View style={styles.cardContent}>
          <Text style={styles.cardTitle}>{item.title}</Text>
          <Text style={styles.cardSubtext}>{streamingText}</Text>
          {typeof item.certainty === 'number' && (
            <Text style={styles.certaintyText}>{Math.round(item.certainty * 100)}% certainty</Text>
          )}
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color="#E50914" />
          <Text style={styles.statusText}>Loading recommendations...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContent}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.primaryButton} onPress={handleStartNewSession}>
            <Text style={styles.primaryButtonText}>Back to Home</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>You matched!</Text>
        <Text style={styles.headerSubtitle}>
          {matchedTitles.length > 0
            ? isFallback
              ? "We couldn’t determine a strong match, but here are some movies our other users have enjoyed."
              : "We think you'll enjoy these titles."
            : 'No mutual matches yet.'}
        </Text>
      </View>

      {matchedTitles.length > 0 ? (
        <FlatList
          data={matchedTitles}
          keyExtractor={(item) => item.id}
          renderItem={renderMatchedItem}
          contentContainerStyle={styles.listContent}
        />
      ) : (
        <View style={styles.centerContent}>
          <Text style={styles.statusText}>Try swiping on a few more titles.</Text>
        </View>
      )}

      <View style={styles.footer}>
        <TouchableOpacity style={styles.primaryButton} onPress={handleWatchTogether}>
          <Text style={styles.primaryButtonText}>Watch Together</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryButton} onPress={handleStartNewSession}>
          <Text style={styles.secondaryButtonText}>Start New Session</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f141f',
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 32,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#ffffff',
  },
  headerSubtitle: {
    marginTop: 8,
    fontSize: 16,
    color: '#d1d5db',
  },
  listContent: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 120,
  },
  card: {
    flexDirection: 'row',
    backgroundColor: '#1f2937',
    borderRadius: 16,
    marginBottom: 16,
    overflow: 'hidden',
  },
  poster: {
    width: 100,
    height: 150,
    backgroundColor: '#111827',
  },
  posterPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  posterPlaceholderText: {
    color: '#9ca3af',
    fontSize: 12,
  },
  cardContent: {
    flex: 1,
    padding: 16,
    justifyContent: 'center',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#f9fafb',
    marginBottom: 8,
  },
  cardSubtext: {
    fontSize: 14,
    color: '#d1d5db',
  },
  certaintyText: {
    marginTop: 6,
    fontSize: 13,
    color: '#c084fc',
  },
  centerContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  statusText: {
    marginTop: 16,
    fontSize: 16,
    color: '#d1d5db',
    textAlign: 'center',
  },
  errorText: {
    fontSize: 16,
    color: '#fca5a5',
    marginBottom: 24,
    textAlign: 'center',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 24,
    gap: 12,
    backgroundColor: '#0f141fcc',
  },
  primaryButton: {
    backgroundColor: '#ef4444',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#4b5563',
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#e5e7eb',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default RecommendationScreen;
