import React, { useEffect, useState } from "react";
import { View, Text, ScrollView, ActivityIndicator, TouchableOpacity } from "react-native";
import UserManager from "../services/firebase/userManager";
import UserService from "../services/firebase/userService";
import FooterNav from "../components/FooterNav";
import { styles } from "../styles/ProfileScreenStyles"; // adjust path as needed
import { Media } from "../types/media";
import { getMovieById } from "../services/api/mediaApiService";

export default function ProfileScreen({ navigation }: any) {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const userId = UserManager.getCurrentUserId();
    if (!userId) return;

    const unsubscribe = UserService.subscribeToUser(userId, (updatedUser) => {
      setUser(updatedUser);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const [favoriteMedia, setFavoriteMedia] = useState<Media[]>([]);

  useEffect(() => {
    async function loadFavorites() {
      if (!user || !user.preferences.favoriteMedia) return;

      setLoading(true);

      try {
        const mediaObjects: Media[] = await Promise.all(
          user.preferences.favoriteMedia.map((id: string) => getMovieById(id))
        );
        setFavoriteMedia(mediaObjects);
      } catch (error) {
        console.error("Failed to fetch favorite movies:", error);
      } finally {
        setLoading(false);
      }
    }

    loadFavorites();
  }, [user]);

  useEffect(() => {
      const currentUser = UserManager.getCurrentUser();
      setUser(currentUser);

      // Log the favoriteMedia to debug
      console.log("User object:", currentUser);
      console.log("Favorite Media:", currentUser?.preferences?.favoriteMedia);
    }, []);

  if (loading || !user) {
    return (
      <View style={[styles.container, { justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator size="large" color="#F5C518" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>

        {/* Title */}
        <Text style={styles.title}>Profile</Text>

        {/* Favorite Genres */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Favorite Genres</Text>
            <TouchableOpacity onPress={() => navigation.navigate("GenreSelection")}>
              <Text style={styles.editText}>Edit</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.box}>
            {(user.preferences.selectedGenres.length > 0
              ? user.preferences.selectedGenres
              : ["None selected"]
            ).map((genre: string, idx: number) => (
              <Text key={idx} style={styles.boxItem}>
                • {genre}
              </Text>
            ))}
          </View>
        </View>

        {/* Streaming Platforms */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>My Streaming Platforms</Text>
            <TouchableOpacity onPress={() => navigation.navigate("PlatformSelection")}>
              <Text style={styles.editText}>Edit</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.box}>
            {(user.preferences.selectedPlatforms.length > 0
              ? user.preferences.selectedPlatforms
              : ["None selected"]
            ).map((platform: string, idx: number) => (
              <Text key={idx} style={styles.boxItem}>
                • {platform}
              </Text>
            ))}
          </View>
        </View>

        {/* Favorite Movies */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Favorite Movies</Text>
            <TouchableOpacity
              onPress={() => navigation.navigate("FavoriteMediaSelection")}
            >
              <Text style={styles.editText}>Edit</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.box}>
            {loading && <Text style={styles.boxItem}>Loading...</Text>}

            {!loading && favoriteMedia.length === 0 && (
              <Text style={styles.boxItem}>None added</Text>
            )}

            {!loading &&
              favoriteMedia.map((movie) => (
                <Text key={movie.id} style={styles.boxItem}>
                  • {movie.title}
                </Text>
              ))}
          </View>
        </View>
      </ScrollView>

      {/* Footer Navigation Bar */}
        <FooterNav />
    </View>
  );
}
