// src/screens/SessionTypeSelectionScreen.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SessionService } from '../services/firebase/sessionService';

type Props = {
  route: {
    params: {
      sessionId: string;
      userId: string;
    };
  };
  navigation: any;
};

export default function SessionTypeSelectionScreen({ route, navigation }: Props) {
  const { sessionId, userId } = route.params;
  const [selectedTypes, setSelectedTypes] = useState<('movie' | 'show')[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const toggleType = (type: 'movie' | 'show') => {
    setSelectedTypes((prev) => {
      if (prev.includes(type)) {
        return prev.filter((t) => t !== type);
      } else {
        return [...prev, type];
      }
    });
  };

  const handleContinue = async () => {
    if (selectedTypes.length === 0) {
      Alert.alert('Select Type', 'Please select at least Movies or Shows');
      return;
    }

    try {
      setIsSaving(true);
      await SessionService.update(sessionId, { movieType: selectedTypes });

      // Navigate to movie swipe screen with selected types
      navigation.navigate('MovieSwipe', {
        sessionId: sessionId,
        userId: userId,
        sessionTypes: selectedTypes, // Pass the selected types
      });
    } catch (error) {
      console.error('Failed to persist session type selection', error);
      Alert.alert(
        'Failed to continue',
        'Unable to save your selection. Please check your connection and try again.'
      );
    } finally {
      setIsSaving(false);
    }
  };

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
        <Text style={styles.title}>What do you want to watch?</Text>
        <Text style={styles.subtitle}>Select Movies, Shows, or both</Text>
      </View>

      {/* Type Selection Cards */}
      <View style={styles.cardsContainer}>
        <TouchableOpacity
          style={[
            styles.typeCard,
            selectedTypes.includes('movie') && styles.typeCardSelected,
          ]}
          onPress={() => toggleType('movie')}
          activeOpacity={0.8}
        >
          <Text style={styles.typeEmoji}>🎬</Text>
          <Text style={styles.typeText}>Movies</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.typeCard,
            selectedTypes.includes('show') && styles.typeCardSelected,
          ]}
          onPress={() => toggleType('show')}
          activeOpacity={0.8}
        >
          <Text style={styles.typeEmoji}>📺</Text>
          <Text style={styles.typeText}>Shows</Text>
        </TouchableOpacity>
      </View>

      {/* Continue Button */}
      <TouchableOpacity
        style={[
          styles.continueButton,
          (selectedTypes.length === 0 || isSaving) && styles.continueButtonDisabled,
        ]}
        onPress={handleContinue}
        disabled={selectedTypes.length === 0 || isSaving}
      >
        <Text style={styles.continueButtonText}>
          {isSaving ? 'Saving...' : 'Continue'}
        </Text>
      </TouchableOpacity>
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
    paddingVertical: 40,
    alignItems: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 18,
    color: '#aaa',
    textAlign: 'center',
  },
  cardsContainer: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 30,
    paddingHorizontal: 30,
  },
  typeCard: {
    width: 150,
    height: 200,
    backgroundColor: '#7a1c0dff',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: 'transparent',
    gap: 20,
  },
  typeCardSelected: {
    borderColor: '#F5C518',
    backgroundColor: '#7a1c0dff',
  },
  typeEmoji: {
    fontSize: 80,
  },
  typeText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  continueButton: {
    backgroundColor: '#F5C518',
    paddingVertical: 18,
    paddingHorizontal: 50,
    borderRadius: 30,
    alignSelf: 'center',
    marginBottom: 50,
    minWidth: 250,
  },
  continueButtonDisabled: {
    backgroundColor: '#555',
  },
  continueButtonText: {
    color: '#000',
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
  },
});
