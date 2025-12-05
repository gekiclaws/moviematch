import React from 'react';
import { View, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';

type TrailerPlayerProps = {
  trailerUrl?: string;
};

export function TrailerPlayer({ trailerUrl }: TrailerPlayerProps) {
  if (!trailerUrl) return null;

  return (
    <View style={styles.container}>
      <WebView
        source={{ uri: trailerUrl }}
        style={styles.webview}
        allowsFullscreenVideo
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: 200,
    overflow: 'hidden',
    borderRadius: 12,
  },
  webview: {
    flex: 1,
  },
});
