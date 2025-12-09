// src/components/SelectableCard.tsx
import React from 'react';
import { ImageSourcePropType } from 'react-native';
import { TouchableOpacity, Text, View, StyleSheet, Image } from 'react-native';

interface SelectableCardProps {
  id: string;
  label: string;
  emoji?: string;
  imageUrl?: string;
  image?: ImageSourcePropType;
  isSelected: boolean;
  onPress: (id: string) => void;
}

export default function SelectableCard({
  id,
  label,
  emoji,
  imageUrl,
  image,
  isSelected,
  onPress,
}: SelectableCardProps) {
  return (
    <TouchableOpacity
      style={[
        styles.card,
        isSelected && styles.cardSelected,
      ]}
      onPress={() => onPress(id)}
      activeOpacity={0.7}
    >
      <View style={styles.iconContainer}>
        {image ? (
          <Image source={image} style={styles.image} resizeMode="contain" />
        ) : imageUrl ? (
          <Image source={{ uri: imageUrl }} style={styles.image} resizeMode="contain" />
        ) : (
          <Text style={styles.emoji}>{emoji || '🎬'}</Text>
        )}
      </View>
      <Text style={styles.label}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '48%',
    aspectRatio: 1,
    backgroundColor: '#8b2313ff',
    borderRadius: 15,
    padding: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'transparent',
  },
  cardSelected: {
    borderColor: '#F5C518',
    backgroundColor: '#7a1c0dff',
  },
  iconContainer: {
    marginBottom: 10,
    width: 60,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emoji: {
    fontSize: 48,
  },
  image: {
    width: 60,
    height: 60,
    borderRadius: 10,
  },
  label: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
});