import React from 'react';
import { View, StyleSheet } from 'react-native';
import YoutubePlayer from 'react-native-youtube-iframe';

export function TrailerPlayer({ trailerUrl }: { trailerUrl?: string }) {
  if (!trailerUrl) return null;

  const videoId = trailerUrl.split('embed/')[1];

  return (
    <View style={{ width: '100%', height: 220 }}>
      <YoutubePlayer
        height={220}
        videoId={videoId}
      />
    </View>
  );
}